type ArticleSummaryBlockProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function ArticleSummaryBlock({
  eyebrow,
  title,
  description,
}: ArticleSummaryBlockProps) {
  return (
    <article className="rounded-[2rem] border border-line/10 bg-ink p-7 text-white">
      <p className="text-xs uppercase tracking-[0.22em] text-white/56">{eyebrow}</p>
      <h2 className="mt-4 font-display text-3xl leading-tight">{title}</h2>
      <p className="mt-5 text-sm leading-7 text-white/74 sm:text-base">{description}</p>
    </article>
  );
}
