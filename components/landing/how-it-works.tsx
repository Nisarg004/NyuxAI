// The four agents run in this order for every brief, so the numbering is real.
const STEPS = [
  {
    name: "Curator",
    body: "Reads the day's stories on your desks and picks the ones that matter for the work you do.",
  },
  {
    name: "Researcher",
    body: "Opens each source and reads the full article, not just the headline or the feed excerpt.",
  },
  {
    name: "Writer",
    body: "Writes a plain summary, and what the story means for someone in your role.",
  },
  {
    name: "Editor",
    body: "Checks every claim against the source. Anything it can't verify is cut before it reaches you.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-6 border-t border-line/60">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="max-w-2xl font-display text-[clamp(2rem,4vw,3.25rem)] font-bold leading-[1] tracking-[-0.035em] text-star">
          Four agents, one brief, every source attached.
        </h2>
        <p className="mt-5 max-w-xl text-[1.0625rem] leading-[1.65] text-haze">
          Nyux works like a small newsroom that only has one reader. Each step hands its work to the next,
          and nothing ships without a link to where it came from.
        </p>

        <ol className="mt-14 grid gap-px overflow-hidden rounded-[20px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.name} className="relative bg-night-2/90 p-7">
              <span className="font-display text-5xl font-bold leading-none tracking-[-0.04em] text-line">
                {i + 1}
              </span>
              <h3 className="mt-6 font-display text-xl font-semibold tracking-[-0.02em] text-star">{step.name}</h3>
              <p className="mt-2 text-[0.95rem] leading-[1.6] text-haze">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
