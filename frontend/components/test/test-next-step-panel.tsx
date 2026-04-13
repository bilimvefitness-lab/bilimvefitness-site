import Link from "next/link";

type TestNextStepPanelProps = {
  title: string;
  support: string;
  label: string;
  href: string;
};

export function TestNextStepPanel({
  title,
  support,
  label,
  href,
}: TestNextStepPanelProps) {
  const content = (
    <>
      <p className="text-xs uppercase tracking-[0.22em] text-white/56">Bir sonraki adim</p>
      <h3 className="mt-4 break-words font-display text-[1.9rem] leading-tight text-white sm:text-[2.3rem]">
        {title}
      </h3>
      <p className="mt-4 max-w-reading text-sm leading-7 text-white/74 sm:text-base">
        {support}
      </p>
      <span className="mt-6 inline-flex w-fit items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-medium tracking-[0.03em] text-ink transition hover:bg-shell">
        {label}
      </span>
    </>
  );

  return (
    <section className="rounded-[2rem] border border-line/10 bg-ink p-6 text-white shadow-panel sm:p-8">
      {href.startsWith("#") ? (
        <a href={href} className="flex flex-col">
          {content}
        </a>
      ) : (
        <Link href={href} className="flex flex-col">
          {content}
        </Link>
      )}
    </section>
  );
}
