import { useStore } from "../../store/useStore";
import AlphabetEditor from "./AlphabetEditor";
import StringSimulator from "./StringSimulator";
import ActionsPanel from "./ActionsPanel";
import ErrorBanner from "./ErrorBanner";
import GeminiPanel from "./GeminiPanel";

interface SidebarProps {
  projectId?: string;
}

export default function Sidebar({ projectId }: SidebarProps) {
  const { activeProject } = useStore();

  return (
    <aside className="sidebar">
      {activeProject && (
        <div className="sidebar-section" style={{ borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              {activeProject.name}
            </span>
            <span className={`badge ${activeProject.type === "DFA" ? "badge-dfa" : "badge-nfa"}`}>
              {activeProject.type}
            </span>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            {activeProject.states.length} states · {activeProject.transitions.length} transitions
          </p>
        </div>
      )}

      <ErrorBanner />
      <AlphabetEditor />
      <StringSimulator />
      <GeminiPanel />
      <ActionsPanel projectId={projectId} />
    </aside>
  );
}
