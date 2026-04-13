import type { ElementType, ReactNode } from "react";

type HeadingSystemProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  children?: ReactNode;
  as?: ElementType;
  tone?: "dark" | "light";
};

export function HeadingSystem({
  eyebrow,
  title,
  description,
  align = "left",
  children,
  as: Tag = "h1",
  tone = "dark",
}: HeadingSystemProps) {
  const alignment = align === "center" ? "text-center items-center" : "text-left items-start";
  const eyebrowClass = tone === "light" ? "text-white/58" : "text-ink/52";
  const titleClass = tone === "light" ? "text-white" : "text-ink";
  const descriptionClass = tone === "light" ? "text-white/74" : "text-ink/72";

  return (
    <div className={`flex max-w-3xl flex-col gap-5 ${alignment}`}>
      {eyebrow ? (
        <span className={`text-xs font-medium uppercase tracking-[0.24em] ${eyebrowClass}`}>
          {eyebrow}
        </span>
      ) : null}
      <Tag
        className={`break-words font-display text-[2.65rem] leading-tight sm:text-5xl lg:text-6xl ${titleClass}`}
      >
        {title}
      </Tag>
      {description ? (
        <p className={`max-w-reading break-words text-base leading-8 sm:text-lg ${descriptionClass}`}>
          {description}
        </p>
      ) : null}
      {children}
    </div>
  );
}
