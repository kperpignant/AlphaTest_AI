import { useEffect } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useUser,
} from "@clerk/clerk-react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { useState } from "react";
import type { View } from "./lib/types";
import { ProjectList } from "./components/ProjectList";
import { ProjectView } from "./components/ProjectView";
import { SuiteView } from "./components/SuiteView";
import { CaseEditor } from "./components/CaseEditor";
import { CaseDetail } from "./components/CaseDetail";
import { RunView } from "./components/RunView";
import { SettingsPanel } from "./components/SettingsPanel";

export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user } = useUser();
  const ensureCurrent = useMutation(api.users.ensureCurrent);
  const me = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const [view, setView] = useState<View>({ kind: "projects" });
  const [ensured, setEnsured] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || ensured) return;
    void ensureCurrent()
      .then(() => setEnsured(true))
      .catch(console.error);
  }, [isAuthenticated, ensureCurrent, ensured]);

  return (
    <>
      <SignedOut>
        <div className="sign-in">
          <div className="panel stack">
            <div className="brand" style={{ justifyContent: "center" }}>
              <span className="brand-mark">A</span>
              <span className="brand-name">AlphaTest</span>
            </div>
            <p className="muted" style={{ textAlign: "center", margin: 0 }}>
              Web SQA test case management with shared projects, suites, runs,
              and optional AI assists.
            </p>
            <SignInButton mode="modal">
              <button type="button" className="btn">
                Sign in
              </button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="app-shell">
          <header className="topbar">
            <button
              type="button"
              className="brand"
              onClick={() => setView({ kind: "projects" })}
            >
              <span className="brand-mark">A</span>
              <span className="brand-name">AlphaTest</span>
            </button>
            <div className="row">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setView({ kind: "settings" })}
              >
                Settings
                {me && !me.hasOpenRouterApiKey ? (
                  <span className="badge warn" style={{ marginLeft: 8 }}>
                    AI key
                  </span>
                ) : null}
              </button>
              <span className="muted small">
                {user?.fullName ?? user?.primaryEmailAddress?.emailAddress}
              </span>
              <UserButton afterSignOutUrl="/" />
            </div>
          </header>

          {isLoading || (isAuthenticated && me?.pendingProfile && !ensured) ? (
            <div className="panel muted">Loading workspace…</div>
          ) : (
            <MainView view={view} setView={setView} />
          )}
        </div>
      </SignedIn>
    </>
  );
}

function MainView({
  view,
  setView,
}: {
  view: View;
  setView: (view: View) => void;
}) {
  switch (view.kind) {
    case "projects":
      return (
        <ProjectList
          onOpen={(projectId) => setView({ kind: "project", projectId })}
        />
      );
    case "project":
      return (
        <ProjectView
          projectId={view.projectId}
          onBack={() => setView({ kind: "projects" })}
          onOpenSuite={(suiteId) =>
            setView({
              kind: "suite",
              projectId: view.projectId,
              suiteId,
            })
          }
          onOpenRun={(testRunId) =>
            setView({
              kind: "run",
              projectId: view.projectId,
              testRunId,
            })
          }
        />
      );
    case "suite":
      return (
        <SuiteView
          projectId={view.projectId}
          suiteId={view.suiteId}
          onBack={() =>
            setView({ kind: "project", projectId: view.projectId })
          }
          onOpenCase={(testCaseId) =>
            setView({
              kind: "case",
              projectId: view.projectId,
              suiteId: view.suiteId,
              testCaseId,
            })
          }
          onNewCase={() =>
            setView({
              kind: "caseNew",
              projectId: view.projectId,
              suiteId: view.suiteId,
            })
          }
        />
      );
    case "caseNew":
      return (
        <CaseEditor
          projectId={view.projectId}
          suiteId={view.suiteId}
          onCancel={() =>
            setView({
              kind: "suite",
              projectId: view.projectId,
              suiteId: view.suiteId,
            })
          }
          onSaved={(testCaseId: Id<"testCases">) =>
            setView({
              kind: "case",
              projectId: view.projectId,
              suiteId: view.suiteId,
              testCaseId,
            })
          }
        />
      );
    case "case":
      return (
        <CaseDetail
          projectId={view.projectId}
          suiteId={view.suiteId}
          testCaseId={view.testCaseId}
          onBack={() =>
            setView({
              kind: "suite",
              projectId: view.projectId,
              suiteId: view.suiteId,
            })
          }
        />
      );
    case "run":
      return (
        <RunView
          projectId={view.projectId}
          testRunId={view.testRunId}
          onBack={() =>
            setView({ kind: "project", projectId: view.projectId })
          }
        />
      );
    case "settings":
      return <SettingsPanel onBack={() => setView({ kind: "projects" })} />;
  }
}
