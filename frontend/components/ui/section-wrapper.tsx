import type { ReactNode } from "react";

type SectionWrapperProps = {
  children: ReactNode;
  className?: string;
  surface?: "default" | "panel";
  id?: string;
};

export function SectionWrapper({
  children,
  className = "",
  surface = "default",
  id,
}: SectionWrapperProps) {
  const surfaceClass =
    surface === "panel"
      ? "rounded-[2rem] border border-line/10 bg-white/85 shadow-panel"
      : "";

  return (
    <section id={id} className={`section-rule ${className}`}>
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
        <div className={surfaceClass}>{children}</div>
      </div>
    </section>
  );
}
