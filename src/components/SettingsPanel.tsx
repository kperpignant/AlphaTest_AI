import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function SettingsPanel({ onBack }: { onBack: () => void }) {
  const me = useQuery(api.users.current);
  const setAiKeys = useMutation(api.users.setAiKeys);
  const clearAiKeys = useMutation(api.users.clearAiKeys);
  const [openRouterApiKey, setOpenRouterApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await setAiKeys({
        openRouterApiKey: openRouterApiKey || undefined,
        openaiApiKey: openaiApiKey || undefined,
      });
      setOpenRouterApiKey("");
      setOpenaiApiKey("");
      setMessage("Keys saved. They are never returned to the browser.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save keys");
    }
  }

  return (
    <div className="stack">
      <div className="crumbs">
        <button type="button" onClick={onBack}>
          Projects
        </button>
        <span className="muted">/</span>
        <span>Settings</span>
      </div>

      <h1>Settings</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Bring-your-own-key (BYOK) for AI assists. Keys are stored on your user
        record in Convex and are visible to deployment admins — prefer
        revocable keys.
      </p>

      <form className="panel stack" onSubmit={handleSave}>
        <h2>AI keys</h2>
        <div className="row">
          <span
            className={`badge ${me?.hasOpenRouterApiKey ? "ok" : "warn"}`}
          >
            OpenRouter: {me?.hasOpenRouterApiKey ? "configured" : "missing"}
          </span>
          <span className={`badge ${me?.hasOpenaiApiKey ? "ok" : "warn"}`}>
            OpenAI embeddings:{" "}
            {me?.hasOpenaiApiKey ? "configured" : "optional"}
          </span>
        </div>

        <label className="label">
          OpenRouter API key
          <input
            type="password"
            value={openRouterApiKey}
            onChange={(e) => setOpenRouterApiKey(e.target.value)}
            placeholder={
              me?.hasOpenRouterApiKey ? "•••••••• (leave blank to keep)" : "sk-or-…"
            }
            autoComplete="off"
          />
        </label>

        <label className="label">
          OpenAI API key (similarity / embeddings)
          <input
            type="password"
            value={openaiApiKey}
            onChange={(e) => setOpenaiApiKey(e.target.value)}
            placeholder={
              me?.hasOpenaiApiKey ? "•••••••• (leave blank to keep)" : "sk-…"
            }
            autoComplete="off"
          />
        </label>

        {error ? <div className="error">{error}</div> : null}
        {message ? <p className="muted">{message}</p> : null}

        <div className="row">
          <button type="submit" className="btn">
            Save keys
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              void clearAiKeys({ clearOpenRouter: true, clearOpenai: false })
                .then(() => setMessage("OpenRouter key cleared."))
                .catch((err: Error) => setError(err.message))
            }
          >
            Clear OpenRouter
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              void clearAiKeys({ clearOpenRouter: false, clearOpenai: true })
                .then(() => setMessage("OpenAI key cleared."))
                .catch((err: Error) => setError(err.message))
            }
          >
            Clear OpenAI
          </button>
        </div>
      </form>

      <div className="panel stack">
        <h2>What each key powers</h2>
        <ul>
          <li>
            <strong>OpenRouter</strong> — case authoring and failure assist
          </li>
          <li>
            <strong>OpenAI</strong> — embeddings for similar-case search
          </li>
        </ul>
      </div>
    </div>
  );
}
