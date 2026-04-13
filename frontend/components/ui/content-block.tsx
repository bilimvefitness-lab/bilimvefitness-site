import type { ReactNode } from "react";

type ContentBlockProps = {
  label: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function ContentBlock({ label, title, description, children }: ContentBlockProps) {
  return (
    <article className="flex flex-col gap-4 rounded-[1.75rem] border border-line/10 bg-white/80 p-8">
      <span className="text-xs uppercase tracking-[0.22em] text-ink/48">{label}</span>
      <h2 className="font-display text-2xl leading-tight text-ink">{title}</h2>
      <p className="max-w-reading text-base leading-8 text-ink/72">{description}</p>
      {children}
    </article>
  );
}
