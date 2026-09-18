import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  CASE_PRIORITIES,
  CASE_STATUSES,
  CASE_TYPES,
  formatLabel,
  type CasePriority,
  type CaseStatus,
  type CaseType,
} from "../lib/types";

export function SuiteView({
  projectId,
  suiteId,
  onBack,
  onOpenCase,
  onNewCase,
}: {
  projectId: Id<"projects">;
  suiteId: Id<"suites">;
  onBack: () => void;
  onOpenCase: (testCaseId: Id<"testCases">) => void;
  onNewCase: () => void;
}) {
  const project = useQuery(api.projects.get, { projectId });
  const suite = useQuery(api.suites.get, { suiteId });
  const [type, setType] = useState<CaseType | "">("");
  const [priority, setPriority] = useState<CasePriority | "">("");
  const [status, setStatus] = useState<CaseStatus | "">("");

  const filterArgs = useMemo(
    () => ({
      suiteId,
      ...(type ? { type } : {}),
      ...(priority ? { priority } : {}),
      ...(status ? { status } : {}),
    }),
    [suiteId, type, priority, status],
  );

  const cases = useQuery(api.testCases.listBySuite, filterArgs);

  return (
    <div className="stack">
      <div className="crumbs">
        <button type="button" onClick={onBack}>
          {project?.name ?? "Project"}
        </button>
        <span className="muted">/</span>
        <span>{suite?.name ?? "Suite"}</span>
      </div>

      <div className="row spread">
        <div>
          <h1>{suite?.name ?? "Suite"}</h1>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            {suite?.description || "Test cases in this suite"}
          </p>
        </div>
        <button type="button" className="btn" onClick={onNewCase}>
          New case
        </button>
      </div>

      <div className="panel row">
        <label className="label">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CaseType | "")}
          >
            <option value="">All</option>
            {CASE_TYPES.map((t) => (
              <option key={t} value={t}>
                {formatLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as CasePriority | "")}
          >
            <option value="">All</option>
            {CASE_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {formatLabel(p)}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CaseStatus | "")}
          >
            <option value="">All</option>
            {CASE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {formatLabel(s)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="panel stack">
        {cases === undefined ? (
          <p className="muted">Loading…</p>
        ) : cases.length === 0 ? (
          <div className="empty">No cases match these filters.</div>
        ) : (
          <ul className="list">
            {cases.map((c) => (
              <li key={c._id}>
                <button
                  type="button"
                  className="list-item"
                  onClick={() => onOpenCase(c._id)}
                >
                  <div>
                    <strong>{c.title}</strong>
                    <div className="muted small">
                      {formatLabel(c.type)} · {formatLabel(c.priority)}
                    </div>
                  </div>
                  <span
                    className={`badge ${
                      c.status === "passed"
                        ? "ok"
                        : c.status === "failed"
                          ? "fail"
                          : c.status === "blocked"
                            ? "warn"
                            : ""
                    }`}
                  >
                    {formatLabel(c.status)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
