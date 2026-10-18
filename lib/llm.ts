import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { z, ZodType } from "zod";
import { withBackoff } from "./retry";

// Retries are owned by withBackoff below; the SDK's built-in retries would multiply them.
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });

export type TokenUsage = { promptTokens: number; completionTokens: number; totalTokens: number };

export const ZERO_USAGE: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

// `usage` covers every attempt made, including ones that failed validation — those tokens were billed too.
export type LLMResult<T> =
  | { ok: true; degraded: false; data: T; usage: TokenUsage }
  | { ok: false; degraded: true; error: string; usage: TokenUsage };

type AttemptResult<Schema extends ZodType> =
  | { success: true; data: z.infer<Schema>; usage: TokenUsage }
  | { success: false; error: string; usage: TokenUsage };

async function attempt<Schema extends ZodType>(
  model: string,
  schema: Schema,
  schemaName: string,
  messages: ChatCompletionMessageParam[]
): Promise<AttemptResult<Schema>> {
  let usage = ZERO_USAGE;
  try {
    const completion = await withBackoff(() =>
      client.chat.completions.parse({
        model,
        messages,
        response_format: zodResponseFormat(schema, schemaName),
      })
    );

    if (completion.usage) {
      usage = {
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
      };
    }

    const message = completion.choices[0]?.message;
    if (message?.refusal) {
      return { success: false, error: `Model refused: ${message.refusal}`, usage };
    }
    if (!message?.parsed) {
      return { success: false, error: "Model returned no parseable content", usage };
    }

    const validated = schema.safeParse(message.parsed);
    if (!validated.success) {
      return { success: false, error: validated.error.message, usage };
    }

    return { success: true, data: validated.data, usage };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err), usage };
  }
}

// Every LLM call in the pipeline goes through here: structured-output request (transient
// 429/5xx errors retried with backoff), zod validation, one retry with the error appended,
// then a typed degraded result. Never throws.
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
    return { ok: true, degraded: false, data: first.data, usage: first.usage };
  }

  messages.push({
    role: "user",
    content: `Your previous response was invalid: ${first.error}\n\nReturn corrected JSON matching the schema exactly.`,
  });

  const second = await attempt(model, schema, schemaName, messages);
  const usage = addUsage(first.usage, second.usage);
  if (second.success) {
    return { ok: true, degraded: false, data: second.data, usage };
  }

  return { ok: false, degraded: true, error: second.error, usage };
}
