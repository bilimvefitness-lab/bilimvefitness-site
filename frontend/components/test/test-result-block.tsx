import type { ReactNode } from "react";

type TestResultBlockProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
};

export function TestResultBlock({ eyebrow, title, children }: TestResultBlockProps) {
  return (
    <section className="rounded-[1.7rem] border border-line/10 bg-white/82 p-6 sm:p-7">
      <p className="text-xs uppercase tracking-[0.2em] text-ink/46">{eyebrow}</p>
      <h3 className="mt-3 break-words font-display text-[1.55rem] leading-tight text-ink">{title}</h3>
      <div className="mt-4 text-sm leading-7 text-ink/68">{children}</div>
    </section>
  );
}
