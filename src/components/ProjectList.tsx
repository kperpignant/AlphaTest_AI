import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function ProjectList({
  onOpen,
}: {
  onOpen: (projectId: Id<"projects">) => void;
}) {
  const projects = useQuery(api.projects.listMine);
  const create = useMutation(api.projects.create);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const id = await create({
        name,
        description: description || undefined,
      });
      setName("");
      setDescription("");
      onOpen(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="row spread">
        <div>
          <h1>Projects</h1>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            Shared workspaces for suites, cases, and test runs.
          </p>
        </div>
      </div>

      <form className="panel stack" onSubmit={handleCreate}>
        <h2>New project</h2>
        <div className="grid-2">
          <label className="label">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Checkout web app"
              required
            />
          </label>
          <label className="label">
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>
        {error ? <div className="error">{error}</div> : null}
        <div>
          <button type="submit" className="btn" disabled={busy || !name.trim()}>
            Create project
          </button>
        </div>
      </form>

      <div className="panel stack">
        <h2>Your projects</h2>
        {projects === undefined ? (
          <p className="muted">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="empty">No projects yet. Create one above.</div>
        ) : (
          <ul className="list">
            {projects.map((project) => (
              <li key={project._id}>
                <button
                  type="button"
                  className="list-item"
                  onClick={() => onOpen(project._id)}
                >
                  <div>
                    <strong>{project.name}</strong>
                    <div className="muted small">{project.description}</div>
                  </div>
                  <span className="badge mono">{project.key}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
