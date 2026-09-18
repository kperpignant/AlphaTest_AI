import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { formatLabel } from "../lib/types";

export function ProjectView({
  projectId,
  onBack,
  onOpenSuite,
  onOpenRun,
}: {
  projectId: Id<"projects">;
  onBack: () => void;
  onOpenSuite: (suiteId: Id<"suites">) => void;
  onOpenRun: (testRunId: Id<"testRuns">) => void;
}) {
  const project = useQuery(api.projects.get, { projectId });
  const suites = useQuery(api.suites.listByProject, { projectId });
  const members = useQuery(api.projects.listMembers, { projectId });
  const runs = useQuery(api.testRuns.listByProject, { projectId });
  const cases = useQuery(api.testCases.listByProject, { projectId });

  const createSuite = useMutation(api.suites.create);
  const addMember = useMutation(api.projects.addMemberByEmail);
  const removeMember = useMutation(api.projects.removeMember);
  const createRun = useMutation(api.testRuns.create);
  const archive = useMutation(api.projects.archive);

  const [suiteName, setSuiteName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [runName, setRunName] = useState("");
  const [runSuiteId, setRunSuiteId] = useState<Id<"suites"> | "">("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreateSuite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const id = await createSuite({ projectId, name: suiteName });
      setSuiteName("");
      onOpenSuite(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create suite");
    }
  }

  async function handleAddMember(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await addMember({ projectId, email: memberEmail });
      setMemberEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    }
  }

  async function handleCreateRun(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const id = await createRun({
        projectId,
        name: runName,
        suiteId: runSuiteId || undefined,
        testCaseIds:
          !runSuiteId && cases
            ? cases.map((c) => c._id)
            : undefined,
      });
      setRunName("");
      onOpenRun(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create run");
    }
  }

  if (project === undefined) {
    return <div className="panel muted">Loading project…</div>;
  }
  if (project === null) {
    return <div className="error">Project not found or access denied.</div>;
  }

  return (
    <div className="stack">
      <div className="crumbs">
        <button type="button" onClick={onBack}>
          Projects
        </button>
        <span className="muted">/</span>
        <span>{project.name}</span>
      </div>

      <div className="row spread">
        <div>
          <h1>{project.name}</h1>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            <span className="mono badge">{project.key}</span>{" "}
            {project.description}
          </p>
        </div>
        <button
          type="button"
          className="btn secondary"
          onClick={() =>
            void archive({ projectId }).then(onBack).catch((err: Error) =>
              setError(err.message),
            )
          }
        >
          Archive
        </button>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="panel stack">
        <h2>Suites</h2>
        <form className="row" onSubmit={handleCreateSuite}>
          <label className="label">
            Suite name
            <input
              value={suiteName}
              onChange={(e) => setSuiteName(e.target.value)}
              placeholder="Smoke / Regression / Checkout"
              required
            />
          </label>
          <button type="submit" className="btn" style={{ alignSelf: "end" }}>
            Add suite
          </button>
        </form>
        {suites === undefined ? (
          <p className="muted">Loading…</p>
        ) : suites.length === 0 ? (
          <div className="empty">No suites yet.</div>
        ) : (
          <ul className="list">
            {suites.map((suite) => (
              <li key={suite._id}>
                <button
                  type="button"
                  className="list-item"
                  onClick={() => onOpenSuite(suite._id)}
                >
                  <div>
                    <strong>{suite.name}</strong>
                    <div className="muted small">{suite.description}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel stack">
        <h2>Test runs</h2>
        <form className="stack" onSubmit={handleCreateRun}>
          <div className="grid-2">
            <label className="label">
              Run name
              <input
                value={runName}
                onChange={(e) => setRunName(e.target.value)}
                placeholder="Sprint 12 smoke"
                required
              />
            </label>
            <label className="label">
              From suite (optional)
              <select
                value={runSuiteId}
                onChange={(e) =>
                  setRunSuiteId(e.target.value as Id<"suites"> | "")
                }
              >
                <option value="">All project cases</option>
                {(suites ?? []).map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <button type="submit" className="btn">
              Start run
            </button>
          </div>
        </form>
        {runs === undefined ? (
          <p className="muted">Loading…</p>
        ) : runs.length === 0 ? (
          <div className="empty">No runs yet.</div>
        ) : (
          <ul className="list">
            {runs.map((run) => (
              <li key={run._id}>
                <button
                  type="button"
                  className="list-item"
                  onClick={() => onOpenRun(run._id)}
                >
                  <div>
                    <strong>{run.name}</strong>
                    <div className="muted small">{run.description}</div>
                  </div>
                  <span className="badge">{formatLabel(run.status)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel stack">
        <h2>Members</h2>
        <form className="row" onSubmit={handleAddMember}>
          <label className="label">
            Invite by email
            <input
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="teammate@example.com"
              required
            />
          </label>
          <button type="submit" className="btn secondary" style={{ alignSelf: "end" }}>
            Add
          </button>
        </form>
        <p className="muted small">
          Invitees must sign in to AlphaTest once before they can be added.
        </p>
        <ul className="list">
          {(members ?? []).map((m) => (
            <li key={m.membershipId} className="row spread">
              <div>
                <strong>{m.user?.name ?? "User"}</strong>
                <div className="muted small">{m.user?.email}</div>
              </div>
              {m.userId !== project.createdById ? (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() =>
                    void removeMember({ projectId, userId: m.userId })
                  }
                >
                  Remove
                </button>
              ) : (
                <span className="badge accent">creator</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
