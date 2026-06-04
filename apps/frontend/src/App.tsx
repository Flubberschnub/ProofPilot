import { useState, useEffect, useRef } from "react";
import { apiUrl } from "./config";
import ReactMarkdown from "react-markdown";

type LogEntry = {
  text: string;
  stage: string;
};

export default function App() {
  // State for Custom Agentic API Demo generator
  const [demoPrompt, setDemoPrompt] = useState("");
  const [demoStatus, setDemoStatus] = useState<"idle" | "generating" | "completed" | "error">("idle");
  const [demoLogs, setDemoLogs] = useState<LogEntry[]>([]);
  const [demoIntake, setDemoIntake] = useState<any>(null);
  const [demoCapabilities, setDemoCapabilities] = useState<any>(null);
  const [demoPlan, setDemoPlan] = useState<any>(null);
  const [demoFiles, setDemoFiles] = useState<Array<{ path: string; content: string }>>([]);
  const [demoRepoUrl, setDemoRepoUrl] = useState("");
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoActiveTab, setDemoActiveTab] = useState<"plan" | "code" | "capabilities" | "readme">("plan");
  const [selectedDemoFileIndex, setSelectedDemoFileIndex] = useState(0);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal log to bottom
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [demoLogs]);

  // Custom demo generator run (SSE)
  function handleGenerateDemo(e: React.FormEvent) {
    e.preventDefault();
    if (!demoPrompt.trim()) return;

    setDemoStatus("generating");
    setDemoLogs([{ text: "🚀 Connecting to agent orchestrator...", stage: "system" }]);
    setDemoIntake(null);
    setDemoCapabilities(null);
    setDemoPlan(null);
    setDemoFiles([]);
    setDemoRepoUrl("");
    setSelectedDemoFileIndex(0);

    let targetUrl = apiUrl(`/api/generate-demo?prompt=${encodeURIComponent(demoPrompt)}`);
    if (!targetUrl.startsWith("http") && window.location.hostname === "localhost") {
      targetUrl = `http://localhost:8080${targetUrl}`;
    }

    const eventSource = new EventSource(targetUrl);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { stage, status: messageText, data } = payload;

        setDemoLogs((prev) => [...prev, { text: messageText, stage }]);

        if (stage === "intake_complete") {
          setDemoIntake(data);
          if (data.requiredApiKeys && data.requiredApiKeys.length > 0) {
            setShowDemoModal(true);
          }
        } else if (stage === "capability_complete") {
          setDemoCapabilities(data);
        } else if (stage === "claim_complete") {
          setDemoPlan(data.validatedPlan);
        } else if (stage === "generator_complete") {
          if (data && data.files) {
            setDemoFiles(data.files);
            setDemoActiveTab("readme"); // Switch automatically to the Setup Guide tab
          }
        } else if (stage === "github_complete") {
          setDemoRepoUrl(data.repoUrl);
        } else if (stage === "complete") {
          setDemoLogs((prev) => [...prev, { text: "🎉 Pipeline completed successfully!", stage: "complete" }]);
          setDemoStatus("completed");
          eventSource.close();
        } else if (stage === "error") {
          setDemoStatus("error");
          eventSource.close();
        }
      } catch (err: any) {
        console.error("Failed to parse SSE data:", err);
        setDemoLogs((prev) => [...prev, { text: `System parse error: ${err.message}`, stage: "error" }]);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Connection Error:", err);
      setDemoLogs((prev) => [...prev, { text: "Connection closed or endpoint error.", stage: "error" }]);
      setDemoStatus("error");
      eventSource.close();
    };
  }

  const getLogClass = (stage: string) => {
    if (stage.endsWith("_complete")) return "success";
    if (stage === "error") return "error";
    if (stage === "system") return "system";
    return "info";
  };

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Google Rapid Agent Hackathon</p>
        <h1>ProofPilot V2</h1>
        <p>Generate source-grounded API demos and custom client workflows using orchestrating AI agents.</p>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* Custom Demo Generation Brief Form */}
        <form onSubmit={handleGenerateDemo} className="card" style={{ textAlign: "left" }}>
          <h2>Create Custom API Demo</h2>
          <p className="muted" style={{ marginBottom: "14px" }}>
            Enter a custom prompt explaining what third-party API and scenario you want to showcase. The agent fleet will draft a plan, audit for hallucinations, compile working code, and export to GitHub.
          </p>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label>User Request Prompt</label>
              <input
                type="text"
                placeholder="e.g. Scaffold a SendGrid contact list signup flow with a backend webhook receiver"
                value={demoPrompt}
                onChange={(e) => setDemoPrompt(e.target.value)}
                disabled={demoStatus === "generating"}
              />
            </div>
            <button
              type="submit"
              style={{ width: "auto", minWidth: "160px", height: "45px", marginTop: 0 }}
              disabled={demoStatus === "generating" || !demoPrompt.trim()}
            >
              {demoStatus === "generating" ? "Generating..." : "Generate Demo"}
            </button>
          </div>
        </form>

        {/* Generator Workspace Grid */}
        <div className="grid">
          
          {/* Left Console: Real-time SSE Agent Status */}
          <div className="card terminal" style={{ margin: 0, padding: 0 }}>
            <div className="terminal-header">
              <span className="terminal-dot dot-red"></span>
              <span className="terminal-dot dot-yellow"></span>
              <span className="terminal-dot dot-green"></span>
              <span className="terminal-title">agent_orchestration.sh</span>
              {demoStatus === "generating" && <span className="terminal-caret"></span>}
            </div>
            <div className="terminal-body">
              {demoLogs.length === 0 ? (
                <div className="terminal-line system">&gt; Standing by. Trigger workflow to start...</div>
              ) : (
                demoLogs.map((log, index) => (
                  <div key={index} className={`terminal-line ${getLogClass(log.stage)}`}>
                    &gt; {log.text}
                  </div>
                ))
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>

          {/* Right Dashboard: Interactive Visualizer Panels */}
          <div className="card" style={{ margin: 0, minHeight: "360px" }}>
            <div className="tabs-container">
              <button
                onClick={() => setDemoActiveTab("plan")}
                className={`tab-btn ${demoActiveTab === "plan" ? "active" : ""}`}
                disabled={!demoPlan}
              >
                Technical Plan
              </button>
              <button
                onClick={() => setDemoActiveTab("code")}
                className={`tab-btn ${demoActiveTab === "code" ? "active" : ""}`}
                disabled={demoFiles.length === 0}
              >
                Generated Files
              </button>
              <button
                onClick={() => setDemoActiveTab("capabilities")}
                className={`tab-btn ${demoActiveTab === "capabilities" ? "active" : ""}`}
                disabled={!demoCapabilities}
              >
                API Docs Profile
              </button>
              <button
                onClick={() => setDemoActiveTab("readme")}
                className={`tab-btn ${demoActiveTab === "readme" ? "active" : ""}`}
                disabled={demoFiles.length === 0}
              >
                Setup Guide
              </button>
            </div>

            <div className="tab-content" style={{ minHeight: "260px" }}>
              {!demoPlan && !demoCapabilities && demoFiles.length === 0 && (
                <div className="muted" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "260px" }}>
                  Awaiting agent pipeline execution...
                </div>
              )}

              {/* TAB: PLAN */}
              {demoActiveTab === "plan" && demoPlan && (
                <div style={{ textAlign: "left" }}>
                  <h3 style={{ color: "#4f46e5", margin: "0 0 8px 0" }}>{demoPlan.demoName}</h3>
                  <p style={{ color: "#71717a", fontSize: "14px", margin: "0 0 16px 0" }}>
                    {demoPlan.architectureOverview}
                  </p>

                  <h4 style={{ margin: "14px 0 6px 0" }}>Backend Endpoints</h4>
                  <ul style={{ paddingLeft: "20px", color: "#18181b" }}>
                    {demoPlan.backendRoutes.map((route: any, i: number) => (
                      <li key={i} style={{ marginBottom: "6px" }}>
                        <code style={{ background: "#eef2ff", color: "#4f46e5" }}>{route.method} {route.path}</code>
                        <div style={{ fontSize: "12px", color: "#71717a" }}>{route.purpose} (Upstream: {route.upstreamEndpoint})</div>
                      </li>
                    ))}
                  </ul>

                  <h4 style={{ margin: "18px 0 6px 0" }}>React Frontend Components</h4>
                  <ul style={{ paddingLeft: "20px", color: "#18181b" }}>
                    {demoPlan.frontendComponents.map((comp: any, i: number) => (
                      <li key={i} style={{ marginBottom: "6px" }}>
                        <strong>&lt;{comp.name} /&gt;</strong>
                        <div style={{ fontSize: "12px", color: "#71717a" }}>{comp.uiDescription}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* TAB: CODE */}
              {demoActiveTab === "code" && demoFiles.length > 0 && (
                <div>
                  <div style={{ display: "flex", gap: "6px", marginBottom: "12px", overflowX: "auto", paddingBottom: "4px" }}>
                    {demoFiles.map((file, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedDemoFileIndex(idx)}
                        className={`tab-btn ${selectedDemoFileIndex === idx ? "active" : ""}`}
                        style={{ fontSize: "12px", padding: "4px 8px" }}
                      >
                        {file.path.split("/").pop()}
                      </button>
                    ))}
                  </div>
                  
                  <div style={{ fontSize: "13px", color: "#71717a", marginBottom: "6px", textAlign: "left" }}>
                    File Path: <code>{demoFiles[selectedDemoFileIndex]?.path}</code>
                  </div>
                  <pre className="code-block">
                    {demoFiles[selectedDemoFileIndex]?.content}
                  </pre>
                </div>
              )}

              {/* TAB: CAPABILITIES */}
              {demoActiveTab === "capabilities" && demoCapabilities && (
                <div style={{ textAlign: "left" }}>
                  <h3 style={{ color: "#0d9488", margin: "0 0 8px 0" }}>{demoCapabilities.apiName} Docs</h3>
                  <p style={{ color: "#71717a", fontSize: "13px", margin: "0 0 12px 0" }}>
                    Base URL: <code>{demoCapabilities.baseUrl}</code>
                  </p>
                  
                  <h4 style={{ margin: "14px 0 6px 0" }}>Endpoint References</h4>
                  {demoCapabilities.endpoints.map((ep: any, i: number) => (
                    <div key={i} style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", marginBottom: "8px", border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ color: "#0f766e" }}>{ep.method} {ep.path}</strong>
                        <span style={{ fontSize: "12px", color: "#7c3aed" }}>{ep.name}</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "#71717a", margin: "4px 0" }}>{ep.description}</div>
                      {ep.requiredParams && ep.requiredParams.length > 0 && (
                        <div style={{ fontSize: "11px", color: "#18181b", marginTop: "4px" }}>
                          <strong>Required parameters:</strong> {ep.requiredParams.map((p: any) => p.name).join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* TAB: README */}
              {demoActiveTab === "readme" && (
                <div style={{ textAlign: "left" }}>
                  <ReactMarkdown
                    components={{
                      a: ({ node, ...props }) => (
                        <a {...props} target="_blank" rel="noopener noreferrer" />
                      )
                    }}
                  >
                    {demoFiles.find(f => f.path.toLowerCase() === 'readme.md')?.content || "No setup guide generated."}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* GitHub Link display */}
            {demoRepoUrl && (
              <div style={{ borderTop: "1px solid #e4e4e7", marginTop: "14px", paddingTop: "14px" }}>
                <div style={{ color: "#166534", fontWeight: 700 }}>Demo generated and exported successfully!</div>
                <a href={demoRepoUrl} target="_blank" rel="noopener noreferrer" className="gh-repo-link">
                  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" style={{ marginRight: "6px" }}>
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.197 22 16.44 22 12.017 22 6.484 17.522 2 12 2z"/>
                  </svg>
                  View Generated Git Repository
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Dynamic API Setup Instructions Modal */}
      {showDemoModal && demoIntake && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close-btn" onClick={() => setShowDemoModal(false)}>&times;</button>
            <h2 style={{ color: "#06b6d4", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px", marginTop: 0 }}>
              Required API Setup Instructions
            </h2>
            <p className="muted" style={{ fontSize: "14px", marginBottom: "16px" }}>
              The Intake Agent identified that you will need the following environmental keys to execute the demo.
            </p>

            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
              {demoIntake.requiredApiKeys.map((key: any, i: number) => (
                <div key={i} className="key-instruction-card">
                  <h3>🔑 {key.name}</h3>
                  <p><strong>Purpose:</strong> {key.purpose}</p>
                  <div style={{ color: "#374151", fontSize: "13px", background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <ReactMarkdown
                      components={{
                        a: ({ node, ...props }) => (
                          <a {...props} target="_blank" rel="noopener noreferrer" />
                        )
                      }}
                    >
                      {key.instruction}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "18px", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowDemoModal(false)}
                className="submit-btn"
                style={{ padding: "8px 16px", minWidth: "auto", width: "auto", marginTop: 0 }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
