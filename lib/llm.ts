import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { z, ZodType } from "zod";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type LLMResult<T> = { ok: true; degraded: false; data: T } | { ok: false; degraded: true; error: string };

async function attempt<Schema extends ZodType>(
  model: string,
  schema: Schema,
  schemaName: string,
  messages: ChatCompletionMessageParam[]
): Promise<{ success: true; data: z.infer<Schema> } | { success: false; error: string }> {
  try {
    const completion = await client.chat.completions.parse({
      model,
      messages,
      response_format: zodResponseFormat(schema, schemaName),
    });

    const message = completion.choices[0]?.message;
    if (message?.refusal) {
      return { success: false, error: `Model refused: ${message.refusal}` };
    }
    if (!message?.parsed) {
      return { success: false, error: "Model returned no parseable content" };
    }

    const validated = schema.safeParse(message.parsed);
    if (!validated.success) {
      return { success: false, error: validated.error.message };
    }

    return { success: true, data: validated.data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Every LLM call in the pipeline goes through here: structured-output request, zod
// validation, one retry with the error appended, then a typed degraded result. Never throws.
export async function callLLM<Schema extends ZodType>(params: {
  model: string;
  schema: Schema;
  schemaName: string;
  system: string;
  user: string;
}): Promise<LLMResult<z.infer<Schema>>> {
  const { model, schema, schemaName, system, user } = params;
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  const first = await attempt(model, schema, schemaName, messages);
  if (first.success) {
    return { ok: true, degraded: false, data: first.data };
  }

  messages.push({
    role: "user",
    content: `Your previous response was invalid: ${first.error}\n\nReturn corrected JSON matching the schema exactly.`,
  });

  const second = await attempt(model, schema, schemaName, messages);
  if (second.success) {
    return { ok: true, degraded: false, data: second.data };
  }

  return { ok: false, degraded: true, error: second.error };
}
