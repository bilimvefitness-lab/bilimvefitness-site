type TrustItem = {
  title: string;
  description: string;
};

type TrustBlockProps = {
  items: TrustItem[];
};

export function TrustBlock({ items }: TrustBlockProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.title}
          className="rounded-[1.45rem] border border-line/10 bg-white/80 p-5 sm:p-6"
        >
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink/62">
            {item.title}
          </h3>
          <p className="mt-3 text-sm leading-7 text-ink/66">{item.description}</p>
        </article>
      ))}
    </div>
  );
}
