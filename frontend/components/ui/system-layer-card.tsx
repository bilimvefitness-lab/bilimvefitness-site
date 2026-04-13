type SystemLayerCardProps = {
  index: string;
  title: string;
  description: string;
};

export function SystemLayerCard({ index, title, description }: SystemLayerCardProps) {
  return (
    <article className="rounded-[1.6rem] border border-line/10 bg-white/78 p-6 sm:p-7">
      <span className="text-xs uppercase tracking-[0.24em] text-ink/44">{index}</span>
      <h3 className="mt-3 font-display text-[1.5rem] leading-tight text-ink">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-ink/68 sm:text-[0.95rem]">{description}</p>
    </article>
  );
}
