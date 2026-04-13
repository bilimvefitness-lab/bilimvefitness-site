"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ContinuationPanel } from "@/components/continuation/continuation-panel";
import { TestNextStepPanel } from "@/components/test/test-next-step-panel";
import { TestOptionCard } from "@/components/test/test-option-card";
import { TestProgress } from "@/components/test/test-progress";
import { TestResultBlock } from "@/components/test/test-result-block";
import { RouteBlock } from "@/components/ui/route-block";
import { trackEvent } from "@/lib/analytics/events";
import { testQuestions } from "@/lib/test/questions";
import { buildTestResult } from "@/lib/test/engine";
import type { TestQuestionKey, TestState } from "@/lib/test/types";

const initialState: TestState = {
  primaryGoal: null,
  experienceLevel: null,
  consistencyState: null,
  mainBottleneck: null,
  readinessLevel: null,
};

function isComplete(state: TestState) {
  return Object.values(state).every(Boolean);
}

export function TestEngine() {
  const [state, setState] = useState<TestState>(initialState);
  const [stepIndex, setStepIndex] = useState(0);
  const hasStartedRef = useRef(false);
  const completedSegmentRef = useRef<string | null>(null);

  const currentQuestion = testQuestions[stepIndex];
  const completed = isComplete(state);
  const result = useMemo(() => (completed ? buildTestResult(state) : null), [completed, state]);

  useEffect(() => {
    if (result && completedSegmentRef.current !== result.segment) {
      completedSegmentRef.current = result.segment;
      trackEvent("test_complete", {
        segment: result.segment,
        recommendation: result.recommendation.path,
      });
    }
  }, [result]);

  function updateAnswer(key: TestQuestionKey, value: string) {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      trackEvent("test_start", {
        question: key,
      });
    }

    setState((current) => ({
      ...current,
      [key]: value,
    }));

    setTimeout(() => {
      setStepIndex((current) => Math.min(current + 1, testQuestions.length));
    }, 120);
  }

  function handleRestart() {
    setState(initialState);
    setStepIndex(0);
    completedSegmentRef.current = null;
    hasStartedRef.current = false;
  }

  const currentValue = currentQuestion
    ? state[currentQuestion.key as keyof TestState]
    : null;

  return (
    <div className="space-y-8">
      {!completed && currentQuestion ? (
        <>
          <div className="rounded-[2rem] border border-line/10 bg-white/86 p-6 sm:p-7">
            <TestProgress currentStep={stepIndex + 1} totalSteps={testQuestions.length} />
            <div className="mt-6 space-y-3">
              <p className="text-xs uppercase tracking-[0.22em] text-ink/48">
                {currentQuestion.eyebrow}
              </p>
              <h2 className="break-words font-display text-[1.95rem] leading-tight text-ink sm:text-[2.4rem]">
                {currentQuestion.title}
              </h2>
              <p className="max-w-reading text-sm leading-7 text-ink/68 sm:text-base">
                {currentQuestion.description}
              </p>
              <p className="text-sm font-medium text-ink/56">
                Bu adimda tek bir secim yap. Sistem sonucu bu secimle birlikte kuracak.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            {currentQuestion.options.map((option) => (
              <TestOptionCard
                key={option.value}
                label={option.label}
                description={option.description}
                selected={currentValue === option.value}
                onSelect={() => updateAnswer(currentQuestion.key, option.value)}
              />
            ))}
          </div>
        </>
      ) : null}

      {completed && result ? (
        <div className="space-y-6">
          <div className="rounded-[2.2rem] border border-line/10 bg-ink p-6 text-white shadow-panel sm:p-8">
            <p className="text-xs uppercase tracking-[0.22em] text-white/56">Test sonucu</p>
            <h2 className="mt-4 font-display text-[2.1rem] leading-tight sm:text-[2.6rem]">
              {result.title}
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/74 sm:text-base">
              {result.segmentLabel}
            </p>
          </div>

          <section className="rounded-[1.9rem] border border-line/10 bg-white/84 p-6 sm:p-7">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/46">Neden bu sonuctasin</p>
            <div className="mt-4 grid gap-5 lg:grid-cols-[1.15fr,0.85fr]">
              <ul className="space-y-3 text-sm leading-7 text-ink/72 sm:text-base">
                {result.whyThisResult.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-ink/70" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-[1.45rem] border border-line/10 bg-shell px-5 py-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink/46">Kimlik notu</p>
                <p className="mt-3 text-sm leading-7 text-ink/72 sm:text-base">
                  {result.identityStatement}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <TestResultBlock eyebrow="Yorum" title="Sana ait yorum">
              <p>{result.insight}</p>
            </TestResultBlock>
            <TestResultBlock eyebrow="Ilk Odak" title="Ilk odak">
              <ul className="space-y-2">
                {result.plan.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-ink/70" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </TestResultBlock>
            <TestResultBlock eyebrow="Uygun Katman" title={result.recommendation.title}>
              <p>{result.recommendation.description}</p>
            </TestResultBlock>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
            <TestNextStepPanel
              title={result.nextStep.title}
              support={result.nextStep.support}
              label={result.nextStep.label}
              href={result.nextStep.href}
            />
            {result.supportingRoute ? (
              <RouteBlock
                label={result.supportingRoute.label}
                title={result.supportingRoute.title}
                description={result.supportingRoute.description}
                commandLabel={result.supportingRoute.commandLabel}
                href={result.supportingRoute.href}
              />
            ) : null}
          </div>

          <ContinuationPanel
            id="email-capture"
            eyebrow="Devam Rotasi"
            config={result.continuation}
          />

          <div className="flex justify-start">
            <button
              type="button"
              onClick={handleRestart}
              className="text-sm leading-7 text-ink/62 underline"
            >
              Testi bastan kur
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
