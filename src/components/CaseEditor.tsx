import { useState, type FormEvent } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  CASE_PRIORITIES,
  CASE_TYPES,
  formatLabel,
  type CasePriority,
  type CaseType,
} from "../lib/types";

type Draft = {
  title: string;
  description: string;
  preconditions: string;
  steps: string;
  expectedResult: string;
  type: CaseType;
  priority: CasePriority;
  labels: string;
  pageUrl: string;
  browserNotes: string;
  estimate: string;
};

const emptyDraft: Draft = {
  title: "",
  description: "",
  preconditions: "",
  steps: "",
  expectedResult: "",
  type: "functional",
  priority: "medium",
  labels: "",
  pageUrl: "",
  browserNotes: "",
  estimate: "",
};

export function CaseEditor({
  projectId,
  suiteId,
  onCancel,
  onSaved,
}: {
  projectId: Id<"projects">;
  suiteId: Id<"suites">;
  onCancel: () => void;
  onSaved: (testCaseId: Id<"testCases">) => void;
}) {
  const create = useMutation(api.testCases.create);
  const draftCase = useAction(api.aiAuthoring.draftCase);
  const findSimilar = useAction(api.aiSimilarity.findSimilar);
  const me = useQuery(api.users.current);
  const members = useQuery(api.users.listForProject, { projectId });

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [aiPrompt, setAiPrompt] = useState("");
  const [assigneeId, setAssigneeId] = useState<Id<"users"> | "">("");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<
    Array<{
      testCaseId: Id<"testCases">;
      title: string;
      status: string;
      score: number;
    }>
  >([]);
  const [similarNote, setSimilarNote] = useState<string | null>(null);

  function patch<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleAiDraft() {
    setAiBusy(true);
    setError(null);
    try {
      const result = await draftCase({
        projectId,
        prompt: aiPrompt,
        pageUrl: draft.pageUrl || undefined,
      });
      setDraft((d) => ({
        ...d,
        title: result.title || d.title,
        description: result.description || d.description,
        preconditions: result.preconditions || d.preconditions,
        steps: result.steps || d.steps,
        expectedResult: result.expectedResult || d.expectedResult,
        type: result.type,
        priority: result.priority,
        labels: result.labels.join(", "),
        pageUrl: result.pageUrl || d.pageUrl,
        browserNotes: result.browserNotes || d.browserNotes,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI draft failed");
    } finally {
      setAiBusy(false);
    }
  }

  async function handleSimilar() {
    setSimilarNote(null);
    try {
      const result = await findSimilar({
        projectId,
        title: draft.title,
        steps: draft.steps,
        expectedResult: draft.expectedResult,
        description: draft.description || undefined,
      });
      if (!result.ok) {
        setSimilar([]);
        setSimilarNote(result.reason);
        return;
      }
      setSimilar(result.matches);
      if (result.matches.length === 0) {
        setSimilarNote("No similar cases found.");
      }
    } catch (err) {
      setSimilarNote(err instanceof Error ? err.message : "Similarity failed");
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const id = await create({
        suiteId,
        title: draft.title,
        description: draft.description || undefined,
        steps: draft.steps,
        expectedResult: draft.expectedResult,
        preconditions: draft.preconditions || undefined,
        estimate: draft.estimate || undefined,
        type: draft.type,
        priority: draft.priority,
        labels: draft.labels
          .split(",")
          .map((l) => l.trim())
          .filter(Boolean),
        assigneeId: assigneeId || undefined,
        pageUrl: draft.pageUrl || undefined,
        browserNotes: draft.browserNotes || undefined,
      });
      onSaved(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save case");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="row spread">
        <h1>New test case</h1>
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <div className="ai-box stack">
        <div className="row spread">
          <strong>Generate with AI</strong>
          {!me?.hasOpenRouterApiKey ? (
            <span className="badge warn">Add OpenRouter key in Settings</span>
          ) : null}
        </div>
        <label className="label">
          What should this case cover?
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Verify guest checkout with invalid credit card on /checkout"
          />
        </label>
        <div>
          <button
            type="button"
            className="btn secondary"
            disabled={aiBusy || !aiPrompt.trim() || !me?.hasOpenRouterApiKey}
            onClick={() => void handleAiDraft()}
          >
            {aiBusy ? "Generating…" : "Draft case"}
          </button>
        </div>
      </div>

      <form className="panel stack" onSubmit={handleSave}>
        <div className="grid-2">
          <label className="label">
            Title
            <input
              value={draft.title}
              onChange={(e) => patch("title", e.target.value)}
              required
            />
          </label>
          <label className="label">
            Page URL
            <input
              value={draft.pageUrl}
              onChange={(e) => patch("pageUrl", e.target.value)}
              placeholder="https://…"
            />
          </label>
        </div>

        <label className="label">
          Description
          <textarea
            value={draft.description}
            onChange={(e) => patch("description", e.target.value)}
          />
        </label>

        <label className="label">
          Preconditions
          <textarea
            value={draft.preconditions}
            onChange={(e) => patch("preconditions", e.target.value)}
          />
        </label>

        <label className="label">
          Steps
          <textarea
            value={draft.steps}
            onChange={(e) => patch("steps", e.target.value)}
            required
          />
        </label>

        <label className="label">
          Expected result
          <textarea
            value={draft.expectedResult}
            onChange={(e) => patch("expectedResult", e.target.value)}
            required
          />
        </label>

        <div className="grid-2">
          <label className="label">
            Type
            <select
              value={draft.type}
              onChange={(e) => patch("type", e.target.value as CaseType)}
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
              value={draft.priority}
              onChange={(e) =>
                patch("priority", e.target.value as CasePriority)
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
            Estimate
            <input
              value={draft.estimate}
              onChange={(e) => patch("estimate", e.target.value)}
              placeholder="15m"
            />
          </label>
          <label className="label">
            Labels (comma-separated)
            <input
              value={draft.labels}
              onChange={(e) => patch("labels", e.target.value)}
            />
          </label>
          <label className="label">
            Assignee
            <select
              value={assigneeId}
              onChange={(e) =>
                setAssigneeId(e.target.value as Id<"users"> | "")
              }
            >
              <option value="">Unassigned</option>
              {(members ?? []).map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name ?? m.email ?? m._id}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Browser notes
            <input
              value={draft.browserNotes}
              onChange={(e) => patch("browserNotes", e.target.value)}
              placeholder="Chrome latest / Safari mobile"
            />
          </label>
        </div>

        <div className="row">
          <button
            type="button"
            className="btn secondary"
            onClick={() => void handleSimilar()}
            disabled={!draft.title.trim() || !draft.steps.trim()}
          >
            Check similar cases
          </button>
          <button type="submit" className="btn" disabled={busy}>
            Save case
          </button>
        </div>

        {similarNote ? <p className="muted small">{similarNote}</p> : null}
        {similar.length > 0 ? (
          <ul className="list">
            {similar.map((m) => (
              <li key={m.testCaseId} className="row spread">
                <span>{m.title}</span>
                <span className="badge">
                  {formatLabel(m.status)} · {(m.score * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {error ? <div className="error">{error}</div> : null}
      </form>
    </div>
  );
}
