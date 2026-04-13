import Link from "next/link";

type CardSystemProps = {
  title: string;
  description: string;
  href: string;
};

export function CardSystem({ title, description, href }: CardSystemProps) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col justify-between rounded-[1.75rem] border border-line/10 bg-white/75 p-7 transition hover:-translate-y-1 hover:border-line/20 hover:bg-white"
    >
      <div className="space-y-4">
        <h3 className="font-display text-2xl text-ink">{title}</h3>
        <p className="text-sm leading-7 text-ink/68">{description}</p>
      </div>
      <span className="mt-8 text-sm uppercase tracking-[0.18em] text-ink/56 transition group-hover:text-ink">
        Devam Et
      </span>
    </Link>
  );
}
