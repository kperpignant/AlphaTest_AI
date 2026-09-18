import type { Id } from "../../convex/_generated/dataModel";

export type CaseType =
  | "functional"
  | "regression"
  | "smoke"
  | "sanity"
  | "exploratory"
  | "other";

export type CasePriority = "low" | "medium" | "high" | "critical";

export type CaseStatus =
  | "not_started"
  | "in_progress"
  | "passed"
  | "failed"
  | "blocked";

export type View =
  | { kind: "projects" }
  | { kind: "project"; projectId: Id<"projects"> }
  | { kind: "suite"; projectId: Id<"projects">; suiteId: Id<"suites"> }
  | {
      kind: "case";
      projectId: Id<"projects">;
      suiteId: Id<"suites">;
      testCaseId: Id<"testCases">;
    }
  | {
      kind: "caseNew";
      projectId: Id<"projects">;
      suiteId: Id<"suites">;
    }
  | { kind: "run"; projectId: Id<"projects">; testRunId: Id<"testRuns"> }
  | { kind: "settings" };

export const CASE_TYPES: CaseType[] = [
  "functional",
  "regression",
  "smoke",
  "sanity",
  "exploratory",
  "other",
];

export const CASE_PRIORITIES: CasePriority[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const CASE_STATUSES: CaseStatus[] = [
  "not_started",
  "in_progress",
  "passed",
  "failed",
  "blocked",
];

export function formatLabel(value: string): string {
  return value.replace(/_/g, " ");
}
