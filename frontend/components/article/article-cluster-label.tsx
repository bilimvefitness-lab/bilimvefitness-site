type ArticleClusterLabelProps = {
  cluster: string;
  intent: string;
  readingTime: string;
  tone?: "dark" | "light";
};

export function ArticleClusterLabel({
  cluster,
  intent,
  readingTime,
  tone = "dark",
}: ArticleClusterLabelProps) {
  const itemClass =
    tone === "light"
      ? "border-white/12 bg-white/10 text-white/78"
      : "border-line/10 bg-shell text-ink/62";

  return (
    <div className="flex flex-wrap gap-2">
      {[cluster, intent, readingTime].map((item) => (
        <span
          key={item}
          className={`rounded-full border px-3 py-1 text-[0.7rem] uppercase tracking-[0.18em] ${itemClass}`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}
