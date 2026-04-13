"use client";

type TestOptionCardProps = {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
};

export function TestOptionCard({
  label,
  description,
  selected,
  onSelect,
}: TestOptionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[1.6rem] border p-5 text-left transition sm:p-6 ${
        selected
          ? "border-ink bg-ink text-white shadow-panel"
          : "border-line/10 bg-white/84 text-ink hover:border-line/25 hover:bg-white"
      }`}
    >
      <span className={`block text-base font-semibold ${selected ? "text-white" : "text-ink"}`}>
        {label}
      </span>
      <span className={`mt-2 block text-sm leading-7 ${selected ? "text-white/76" : "text-ink/66"}`}>
        {description}
      </span>
    </button>
  );
}
