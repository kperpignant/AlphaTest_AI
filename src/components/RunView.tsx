import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { formatLabel } from "../lib/types";

const RESULT_STATUSES = [
  "not_started",
  "passed",
  "failed",
  "blocked",
  "skipped",
] as const;

type ResultStatus = (typeof RESULT_STATUSES)[number];

export function RunView({
  testRunId,
  onBack,
}: {
  projectId: Id<"projects">;
  testRunId: Id<"testRuns">;
  onBack: () => void;
}) {
  const data = useQuery(api.testRuns.getWithResults, { testRunId });
  const setResultStatus = useMutation(api.testRuns.setResultStatus);
  const regenerate = useAction(api.aiFailureAssist.regenerate);
  const me = useQuery(api.users.current);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [actual, setActual] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (data === undefined) {
    return <div className="panel muted">Loading run…</div>;
  }
  if (data === null) {
    return <div className="error">Run not found.</div>;
  }

  const { run, results } = data;

  async function updateResult(
    resultId: Id<"testRunResults">,
    status: ResultStatus,
  ) {
    setBusyId(resultId);
    setError(null);
    try {
      await setResultStatus({
        resultId,
        status,
        notes: notes[resultId],
        actualResult: actual[resultId],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update result");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="stack">
      <div className="crumbs">
        <button type="button" onClick={onBack}>
          Project
        </button>
        <span className="muted">/</span>
        <span>{run.name}</span>
      </div>

      <div className="row spread">
        <div>
          <h1>{run.name}</h1>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            {run.description}
          </p>
        </div>
        <span className="badge accent">{formatLabel(run.status)}</span>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="stack">
        {results.map((result) => (
          <div key={result._id} className="panel stack">
            <div className="row spread">
              <div>
                <strong>{result.testCase?.title ?? "Case"}</strong>
                <div className="muted small">
                  {result.testCase
                    ? `${formatLabel(result.testCase.type)} · ${formatLabel(result.testCase.priority)}`
                    : null}
                </div>
              </div>
              <span
                className={`badge ${
                  result.status === "passed"
                    ? "ok"
                    : result.status === "failed"
                      ? "fail"
                      : result.status === "blocked"
                        ? "warn"
                        : ""
                }`}
              >
                {formatLabel(result.status)}
              </span>
            </div>

            {result.testCase ? (
              <details>
                <summary className="muted small">Show steps</summary>
                <pre
                  className="mono"
                  style={{
                    whiteSpace: "pre-wrap",
                    background: "var(--bg-muted)",
                    padding: "0.75rem",
                    borderRadius: 8,
                  }}
                >
                  {result.testCase.steps}
                </pre>
                <p>
                  <strong>Expected:</strong> {result.testCase.expectedResult}
                </p>
              </details>
            ) : null}

            <div className="grid-2">
              <label className="label">
                Actual result
                <textarea
                  value={actual[result._id] ?? result.actualResult ?? ""}
                  onChange={(e) =>
                    setActual((prev) => ({
                      ...prev,
                      [result._id]: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="label">
                Notes
                <textarea
                  value={notes[result._id] ?? result.notes ?? ""}
                  onChange={(e) =>
                    setNotes((prev) => ({
                      ...prev,
                      [result._id]: e.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="row">
              {RESULT_STATUSES.filter((s) => s !== "not_started").map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`btn ${s === "failed" ? "danger" : s === "passed" ? "" : "secondary"}`}
                  disabled={busyId === result._id}
                  onClick={() => void updateResult(result._id, s)}
                >
                  {formatLabel(s)}
                </button>
              ))}
            </div>

            {result.status === "failed" ? (
              <div className="ai-box stack">
                <div className="row spread">
                  <strong>Failure assist</strong>
                  {!me?.hasOpenRouterApiKey ? (
                    <span className="badge warn">
                      Add OpenRouter key in Settings
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() =>
                        void regenerate({ resultId: result._id }).catch(
                          (err: Error) => setError(err.message),
                        )
                      }
                    >
                      Regenerate
                    </button>
                  )}
                </div>
                {result.aiFailureAssist?.status === "generating" ||
                result.aiFailureAssist?.status === "pending" ? (
                  <p className="muted">Analyzing failure…</p>
                ) : null}
                {result.aiFailureAssist?.status === "failed" ? (
                  <p className="error">
                    {result.aiFailureAssist.errorMessage ?? "AI assist failed"}
                  </p>
                ) : null}
                {result.aiFailureAssist?.status === "complete" ? (
                  <>
                    {result.aiFailureAssist.likelyCauses?.length ? (
                      <div>
                        <h3>Likely causes</h3>
                        <ul>
                          {result.aiFailureAssist.likelyCauses.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {result.aiFailureAssist.nextChecks?.length ? (
                      <div>
                        <h3>Next checks</h3>
                        <ul>
                          {result.aiFailureAssist.nextChecks.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {result.aiFailureAssist.bugReportDraft ? (
                      <div>
                        <h3>Bug report draft</h3>
                        <pre
                          style={{
                            whiteSpace: "pre-wrap",
                            margin: 0,
                            fontFamily: "var(--mono)",
                            fontSize: "0.85rem",
                          }}
                        >
                          {result.aiFailureAssist.bugReportDraft}
                        </pre>
                      </div>
                    ) : null}
                  </>
                ) : null}
                {!result.aiFailureAssist && me?.hasOpenRouterApiKey ? (
                  <p className="muted small">
                    Mark failed again or click Regenerate to run assist.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
