import { useState, type FormEvent } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
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

export function CaseDetail({
  projectId,
  testCaseId,
  onBack,
}: {
  projectId: Id<"projects">;
  suiteId: Id<"suites">;
  testCaseId: Id<"testCases">;
  onBack: () => void;
}) {
  const testCase = useQuery(api.testCases.get, { testCaseId });
  const attachments = useQuery(api.attachments.listByCase, { testCaseId });
  const members = useQuery(api.users.listForProject, { projectId });
  const update = useMutation(api.testCases.update);
  const remove = useMutation(api.testCases.remove);
  const generateUploadUrl = useMutation(api.attachments.generateUploadUrl);
  const saveAttachment = useMutation(api.attachments.save);
  const removeAttachment = useMutation(api.attachments.remove);
  const findSimilar = useAction(api.aiSimilarity.findSimilar);

  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<
    Array<{ testCaseId: Id<"testCases">; title: string; score: number }>
  >([]);
  const [form, setForm] = useState<{
    title: string;
    description: string;
    steps: string;
    expectedResult: string;
    preconditions: string;
    estimate: string;
    type: CaseType;
    priority: CasePriority;
    status: CaseStatus;
    labels: string;
    pageUrl: string;
    browserNotes: string;
    assigneeId: Id<"users"> | "";
  } | null>(null);

  if (testCase === undefined) {
    return <div className="panel muted">Loading case…</div>;
  }
  if (testCase === null) {
    return <div className="error">Test case not found.</div>;
  }

  const current = form ?? {
    title: testCase.title,
    description: testCase.description ?? "",
    steps: testCase.steps,
    expectedResult: testCase.expectedResult,
    preconditions: testCase.preconditions ?? "",
    estimate: testCase.estimate ?? "",
    type: testCase.type,
    priority: testCase.priority,
    status: testCase.status,
    labels: (testCase.labels ?? []).join(", "),
    pageUrl: testCase.pageUrl ?? "",
    browserNotes: testCase.browserNotes ?? "",
    assigneeId: testCase.assigneeId ?? "",
  };

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await update({
        testCaseId,
        title: current.title,
        description: current.description || undefined,
        steps: current.steps,
        expectedResult: current.expectedResult,
        preconditions: current.preconditions || undefined,
        estimate: current.estimate || undefined,
        type: current.type,
        priority: current.priority,
        status: current.status,
        labels: current.labels
          .split(",")
          .map((l) => l.trim())
          .filter(Boolean),
        pageUrl: current.pageUrl || undefined,
        browserNotes: current.browserNotes || undefined,
        assigneeId: current.assigneeId || null,
      });
      setEditing(false);
      setForm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function handleUpload(file: File) {
    setError(null);
    try {
      const uploadUrl = await generateUploadUrl({ testCaseId });
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await saveAttachment({
        testCaseId,
        storageId,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function handleSimilar() {
    if (!testCase) return;
    try {
      const result = await findSimilar({
        projectId,
        title: testCase.title,
        steps: testCase.steps,
        expectedResult: testCase.expectedResult,
        description: testCase.description,
        excludeTestCaseId: testCaseId,
      });
      if (result.ok) setSimilar(result.matches);
      else setError(result.reason);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Similarity failed");
    }
  }

  return (
    <div className="stack">
      <div className="crumbs">
        <button type="button" onClick={onBack}>
          Suite
        </button>
        <span className="muted">/</span>
        <span>{testCase.title}</span>
      </div>

      <div className="row spread">
        <div>
          <h1>{testCase.title}</h1>
          <div className="row" style={{ marginTop: "0.5rem" }}>
            <span className="badge">{formatLabel(testCase.type)}</span>
            <span className="badge">{formatLabel(testCase.priority)}</span>
            <span
              className={`badge ${
                testCase.status === "passed"
                  ? "ok"
                  : testCase.status === "failed"
                    ? "fail"
                    : ""
              }`}
            >
              {formatLabel(testCase.status)}
            </span>
          </div>
        </div>
        <div className="row">
          <button
            type="button"
            className="btn secondary"
            onClick={() => void handleSimilar()}
          >
            Similar cases
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setEditing(true);
              setForm({
                title: testCase.title,
                description: testCase.description ?? "",
                steps: testCase.steps,
                expectedResult: testCase.expectedResult,
                preconditions: testCase.preconditions ?? "",
                estimate: testCase.estimate ?? "",
                type: testCase.type,
                priority: testCase.priority,
                status: testCase.status,
                labels: (testCase.labels ?? []).join(", "),
                pageUrl: testCase.pageUrl ?? "",
                browserNotes: testCase.browserNotes ?? "",
                assigneeId: testCase.assigneeId ?? "",
              });
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() =>
              void remove({ testCaseId })
                .then(onBack)
                .catch((err: Error) => setError(err.message))
            }
          >
            Delete
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {editing ? (
        <form className="panel stack" onSubmit={handleSave}>
          <label className="label">
            Title
            <input
              value={current.title}
              onChange={(e) =>
                setForm({ ...current, title: e.target.value })
              }
              required
            />
          </label>
          <label className="label">
            Steps
            <textarea
              value={current.steps}
              onChange={(e) =>
                setForm({ ...current, steps: e.target.value })
              }
              required
            />
          </label>
          <label className="label">
            Expected result
            <textarea
              value={current.expectedResult}
              onChange={(e) =>
                setForm({ ...current, expectedResult: e.target.value })
              }
              required
            />
          </label>
          <div className="grid-2">
            <label className="label">
              Type
              <select
                value={current.type}
                onChange={(e) =>
                  setForm({ ...current, type: e.target.value as CaseType })
                }
              >
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
                value={current.priority}
                onChange={(e) =>
                  setForm({
                    ...current,
                    priority: e.target.value as CasePriority,
                  })
                }
              >
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
                value={current.status}
                onChange={(e) =>
                  setForm({
                    ...current,
                    status: e.target.value as CaseStatus,
                  })
                }
              >
                {CASE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {formatLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              Assignee
              <select
                value={current.assigneeId}
                onChange={(e) =>
                  setForm({
                    ...current,
                    assigneeId: e.target.value as Id<"users"> | "",
                  })
                }
              >
                <option value="">Unassigned</option>
                {(members ?? []).map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name ?? m.email}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="row">
            <button type="submit" className="btn">
              Save
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setEditing(false);
                setForm(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="panel stack">
          {testCase.pageUrl ? (
            <p>
              <strong>URL:</strong>{" "}
              <a href={testCase.pageUrl} target="_blank" rel="noreferrer">
                {testCase.pageUrl}
              </a>
            </p>
          ) : null}
          {testCase.description ? (
            <section>
              <h3>Description</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{testCase.description}</p>
            </section>
          ) : null}
          {testCase.preconditions ? (
            <section>
              <h3>Preconditions</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{testCase.preconditions}</p>
            </section>
          ) : null}
          <section>
            <h3>Steps</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{testCase.steps}</p>
          </section>
          <section>
            <h3>Expected result</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{testCase.expectedResult}</p>
          </section>
          {testCase.browserNotes ? (
            <p className="muted small">Browser: {testCase.browserNotes}</p>
          ) : null}
        </div>
      )}

      {similar.length > 0 ? (
        <div className="panel stack">
          <h2>Similar cases</h2>
          <ul className="list">
            {similar.map((m) => (
              <li key={m.testCaseId} className="row spread">
                <span>{m.title}</span>
                <span className="badge">{(m.score * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="panel stack">
        <h2>Attachments</h2>
        <input
          type="file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
            e.target.value = "";
          }}
        />
        <ul className="list">
          {(attachments ?? []).map((att) => (
            <li key={att._id} className="row spread">
              <a href={att.url ?? "#"} target="_blank" rel="noreferrer">
                {att.fileName}
              </a>
              <button
                type="button"
                className="btn ghost"
                onClick={() => void removeAttachment({ attachmentId: att._id })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
