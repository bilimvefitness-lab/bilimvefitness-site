import type { ContinuationConfig, RouteRecommendation } from "@/lib/continuation/types";

export type PrimaryGoal =
  | "fat_loss"
  | "muscle_gain"
  | "performance"
  | "health_routine";

export type ExperienceLevel =
  | "beginner"
  | "restarting"
  | "intermediate"
  | "advanced";

export type ConsistencyState =
  | "fragile"
  | "inconsistent"
  | "mostly_consistent"
  | "disciplined";

export type MainBottleneck =
  | "confusion"
  | "time"
  | "consistency"
  | "recovery"
  | "plateau";

export type ReadinessLevel =
  | "exploring"
  | "starting"
  | "committing"
  | "optimizing";

export type TestState = {
  primaryGoal: PrimaryGoal | null;
  experienceLevel: ExperienceLevel | null;
  consistencyState: ConsistencyState | null;
  mainBottleneck: MainBottleneck | null;
  readinessLevel: ReadinessLevel | null;
};

export type RecommendationPath = "content_email" | "book" | "education" | "app";

export type TestSegment =
  | "foundation_clarity"
  | "foundation_action"
  | "consistency_reset"
  | "plateau_breakthrough"
  | "performance_precision"
  | "advanced_optimization";

export type TestResult = {
  segment: TestSegment;
  segmentLabel: string;
  title: string;
  insight: string;
  whyThisResult: string[];
  identityStatement: string;
  plan: string[];
  recommendation: {
    path: RecommendationPath;
    title: string;
    description: string;
  };
  nextStep: {
    title: string;
    label: string;
    href: string;
    support: string;
  };
  supportingRoute?: RouteRecommendation;
  continuation: ContinuationConfig;
};

export type TestQuestionKey = keyof TestState;

export type TestOption<T extends string> = {
  value: T;
  label: string;
  description: string;
};

export type TestQuestion<T extends string> = {
  key: TestQuestionKey;
  eyebrow: string;
  title: string;
  description: string;
  options: TestOption<T>[];
};
