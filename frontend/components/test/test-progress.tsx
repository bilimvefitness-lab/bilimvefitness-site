"use client";

type TestProgressProps = {
  currentStep: number;
  totalSteps: number;
};

export function TestProgress({ currentStep, totalSteps }: TestProgressProps) {
  const progress = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-ink/48">
        <span>Ilerleme</span>
        <span>
          {currentStep}/{totalSteps}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line/10">
        <div
          className="h-full rounded-full bg-ink transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
