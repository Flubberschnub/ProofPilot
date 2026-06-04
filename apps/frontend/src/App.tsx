import { useMemo, useState, useEffect, useRef } from "react";
import { apiUrl } from "./config";
import ReactMarkdown from "react-markdown";

type WorkflowResult = {
  model: { provider: string; model: string; configured: boolean; mode: string };
  agentRuntime: { mode: string; description: string };
  agents: Array<{
    id: string;
    name: string;
    description: string;
    tools: string[];
    status: string;
    durationMs: number;
    inputSummary: string;
    outputSummary: string;
    error?: string;
  }>;
  chunksIndexed: number;
  docsSourceUrl?: string;
  docsCharacters?: number;
  capabilities: Array<{ name: string; description: string; endpoints: string[] }>;
  plan: {
    title: string;
    story: string;
    screens: string[];
    endpointsUsed: string[];
    businessValue: string[];
  };
  claimReport: {
    claims: Array<{ id: string; text: string; status: string; rewrite?: string; evidenceChunkIds?: string[] }>;
    summary: Record<string, number>;
  };
  files: Array<{ path: string; content: string }>;
  packageCheck: {
    status: string;
    checks: Array<{ name: string; status: string; message: string }>;
  };
  gitlab: {
    mode: string;
    url: string | null;
    message: string;
    filesCommitted: number;
    localPath?: string;
    artifact?: {
      mode: string;
      fileName: string;
      downloadUrl: string | null;
      message: string;
      sizeBytes?: number;
      localPath?: string;
      bucket?: string;
      objectName?: string;
    };
  };
};

type LogEntry = {
  text: string;
  stage: string;
};

const sampleDocs = `# Acme Document Extraction API

The Acme Document Extraction API lets applications upload business documents and extract structured fields from them.

## Authentication

All requests use Bearer token authentication.

## POST /documents/extract

Uploads a document for extraction. Supported file types include PDF, PNG, and JPG. Request uses multipart/form-data with a file field and optional document_type.

## GET /documents/{document_id}

Returns extraction status and extracted fields. Fields include a name, value, and confidence score.

## POST /documents/{document_id}/approve

Approves a reviewed extraction result.

## POST /exports

Exports approved structured data to a downstream system as JSON. The API does not directly integrate with Guidewire, Salesforce, or Epic; customers usually connect exports to their own integration layer.

## Marketing note

Customers often use Acme to reduce manual review effort, but exact time savings depend on document quality, workflow design, and human review policies.`;

export default function App() {
  // State for Brief Form
  const [apiName, setApiName] = useState("Acme Document Extraction API");
  const [docsUrl, setDocsUrl] = useState("");
  const [docsText, setDocsText] = useState(sampleDocs);
  const [goal, setGoal] = useState("Show how a regional insurance company could reduce manual claim intake work by uploading claim PDFs, extracting fields, reviewing uncertain values, and exporting approved data.");
  const [industry, setIndustry] = useState("Insurance");
  const [audience, setAudience] = useState("executive");

  // State for execution status
  const [status, setStatus] = useState<"idle" | "generating" | "completed" | "error">("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // State for result display
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [activeTab, setActiveTab] = useState<"plan" | "code" | "claims" | "readme">("plan");
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal log to bottom
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Form submission / run workflow
  async function handleRunWorkflow(e: React.FormEvent) {
    e.preventDefault();
    if (!apiName.trim() || !industry.trim() || !goal.trim()) return;

    setStatus("generating");
    setError(null);
    setResult(null);
    setLogs([
      { text: "🚀 Connecting to agent orchestrator...", stage: "system" },
      { text: "📡 Initializing agent workspace context...", stage: "system" },
      { text: `🔍 Analyzing docs: ${apiName}`, stage: "info" }
    ]);

    // Simulated progress logging since the backend runs synchronously
    let currentStep = 0;
    const simulatedSteps = [
      { text: "🔄 Running Source Capability Agent... Indexing documentation", stage: "info" },
      { text: "🛠️ Running Demo Planner Agent... Designing screens and backend mock flows", stage: "info" },
      { text: "🔍 Running Claim Checker Agent... Verifying marketing claims & audits", stage: "info" },
      { text: "📦 Running Package Generator Agent... Compiling files for output pipeline", stage: "info" },
      { text: "🚀 Running Export Agent... Exporting generated codebase to GitLab repository", stage: "info" },
      { text: "⏳ Finalizing package output and GCS bucket artifacts...", stage: "system" }
    ];

    const timer = setInterval(() => {
      if (currentStep < simulatedSteps.length) {
        setLogs((prev) => [...prev, simulatedSteps[currentStep]]);
        currentStep++;
      }
    }, 3000);

    try {
      let targetUrl = apiUrl("/api/workflow/run");
      if (!targetUrl.startsWith("http") && window.location.hostname === "localhost") {
        targetUrl = `http://localhost:8080${targetUrl}`;
      }

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiName,
          docsUrl: docsUrl.trim() || undefined,
          docsText: docsText.trim() || undefined,
          industry,
          audience,
          goal,
          preferredStack: "React + Node",
          liveApiAllowed: false
        })
      });

      clearInterval(timer);

      if (!response.ok) throw new Error(await response.text());
      const data: WorkflowResult = await response.json();

      setResult(data);
      setStatus("completed");
      setActiveTab("readme"); // Switch to setup tab when completed

      // Print actual agent trace from backend
      setLogs((prev) => [
        ...prev,
        { text: "🎉 Pipeline completed successfully!", stage: "complete" },
        ...data.agents.map((agent) => ({
          text: `🤖 [${agent.name}] ${agent.status} in ${agent.durationMs}ms\n   └─ ${agent.outputSummary || agent.error || ""}`,
          stage: agent.status === "passed" ? "success" : "error"
        }))
      ]);
    } catch (err: any) {
      clearInterval(timer);
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      setError(errMsg);
      setStatus("error");
      setLogs((prev) => [
        ...prev,
        { text: `❌ Pipeline execution failed: ${errMsg}`, stage: "error" }
      ]);
    }
  }

  const getLogClass = (stage: string) => {
    if (stage.endsWith("_complete") || stage === "complete") return "success";
    if (stage === "error") return "error";
    if (stage === "system") return "system";
    return "info";
  };

  const filePreview = useMemo(() => result?.files?.slice(0, 6) ?? [], [result]);
  const artifact = result?.gitlab?.artifact;
  let artifactDownloadUrl = artifact?.downloadUrl?.startsWith("/api/")
    ? apiUrl(artifact.downloadUrl)
    : artifact?.downloadUrl?.startsWith("http")
      ? artifact.downloadUrl
      : undefined;

  if (artifactDownloadUrl && !artifactDownloadUrl.startsWith("http") && window.location.hostname === "localhost") {
    artifactDownloadUrl = `http://localhost:8080${artifactDownloadUrl}`;
  }

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Google Rapid Agent Hackathon</p>
        <h1>ProofPilot V2</h1>
        <p>Generate source-grounded API demos and customer scenarios using orchestrating AI agents.</p>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
        
        {/* Left Side: Brief Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <form onSubmit={handleRunWorkflow} className="card" style={{ textAlign: "left", margin: 0 }}>
            <h2>1. Demo brief</h2>
            
            <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
              <div style={{ flex: 1 }}>
                <label>API name</label>
                <input value={apiName} onChange={(e) => setApiName(e.target.value)} disabled={status === "generating"} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Industry</label>
                <input value={industry} onChange={(e) => setIndustry(e.target.value)} disabled={status === "generating"} />
              </div>
            </div>

            <label>Audience</label>
            <select value={audience} onChange={(e) => setAudience(e.target.value)} disabled={status === "generating"} style={{ marginBottom: "12px" }}>
              <option value="executive">Executive</option>
              <option value="technical">Technical</option>
              <option value="sales">Sales</option>
              <option value="developer">Developer</option>
            </select>

            <label>Goal</label>
            <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={4} disabled={status === "generating"} style={{ marginBottom: "12px" }} />

            <label>Docs URL</label>
            <input
              placeholder="https://example.com/docs or OpenAPI URL"
              value={docsUrl}
              onChange={(e) => setDocsUrl(e.target.value)}
              disabled={status === "generating"}
              style={{ marginBottom: "12px" }}
            />

            <label>API docs fallback</label>
            <textarea value={docsText} onChange={(e) => setDocsText(e.target.value)} rows={8} disabled={status === "generating"} />

            <button type="submit" disabled={status === "generating" || !apiName.trim() || !industry.trim() || !goal.trim()}>
              {status === "generating" ? "Generating..." : "Generate grounded demo"}
            </button>
            {error && <p className="error">{error}</p>}
          </form>
        </div>

        {/* Right Side: Terminal Log & Interactive Visualizer Dashboard */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Terminal Console */}
          <div className="card terminal" style={{ margin: 0, padding: 0 }}>
            <div className="terminal-header">
              <span className="terminal-dot dot-red"></span>
              <span className="terminal-dot dot-yellow"></span>
              <span className="terminal-dot dot-green"></span>
              <span className="terminal-title">agent_orchestration.sh</span>
              {status === "generating" && <span className="terminal-caret"></span>}
            </div>
            <div className="terminal-body" style={{ height: "260px" }}>
              {logs.length === 0 ? (
                <div className="terminal-line system">&gt; Standing by. Trigger workflow to start...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className={`terminal-line ${getLogClass(log.stage)}`} style={{ whiteSpace: "pre-wrap" }}>
                    &gt; {log.text}
                  </div>
                ))
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>

          {/* Interactive Visualizer Dashboard */}
          <div className="card" style={{ margin: 0, minHeight: "400px", display: "flex", flexDirection: "column" }}>
            {!result ? (
              <div className="muted" style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "10px", padding: "40px", minHeight: "320px" }}>
                <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ color: "#a1a1aa", marginBottom: "8px" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.808 13.064l.707.707M12 21v-1m6.364-1.636l.707.707M16.243 4.757l-.707-.707" />
                </svg>
                <strong>Awaiting agent pipeline execution...</strong>
                <span style={{ fontSize: "13px", color: "#a1a1aa", textAlign: "center", maxWidth: "280px" }}>
                  Fill out the Demo brief form and click \"Generate grounded demo\" to run the AI fleet.
                </span>
              </div>
            ) : (
              <>
                {/* Tab Selector */}
                <div className="tabs-container">
                  <button
                    onClick={() => setActiveTab("plan")}
                    className={`tab-btn ${activeTab === "plan" ? "active" : ""}`}
                  >
                    Technical Plan
                  </button>
                  <button
                    onClick={() => setActiveTab("code")}
                    className={`tab-btn ${activeTab === "code" ? "active" : ""}`}
                    disabled={!result.files || result.files.length === 0}
                  >
                    Generated Files
                  </button>
                  <button
                    onClick={() => setActiveTab("claims")}
                    className={`tab-btn ${activeTab === "claims" ? "active" : ""}`}
                    disabled={!result.claimReport}
                  >
                    Claim Audit
                  </button>
                  <button
                    onClick={() => setActiveTab("readme")}
                    className={`tab-btn ${activeTab === "readme" ? "active" : ""}`}
                  >
                    Setup & Export
                  </button>
                </div>

                {/* Tab Contents */}
                <div style={{ flex: 1, overflowY: "auto", paddingBottom: "10px" }}>
                  
                  {/* TAB: PLAN */}
                  {activeTab === "plan" && (
                    <div style={{ textAlign: "left" }}>
                      <h3 style={{ color: "#4f46e5", margin: "0 0 8px 0" }}>{result.plan.title}</h3>
                      <p style={{ color: "#71717a", fontSize: "14px", margin: "0 0 16px 0", lineHeight: 1.5 }}>
                        {result.plan.story}
                      </p>

                      <h4 style={{ margin: "16px 0 6px 0", color: "#1f2937" }}>Mocks & Screens</h4>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
                        {result.plan.screens.map((screen, i) => (
                          <span key={i} style={{ background: "#f1f5f9", color: "#475569", padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600 }}>
                            {screen}
                          </span>
                        ))}
                      </div>

                      <h4 style={{ margin: "16px 0 6px 0", color: "#1f2937" }}>Endpoints Handled</h4>
                      <ul style={{ paddingLeft: "20px", color: "#334155", margin: "0 0 16px 0" }}>
                        {result.plan.endpointsUsed.map((ep, i) => (
                          <li key={i} style={{ marginBottom: "6px" }}>
                            <code style={{ background: "#f0fdf4", color: "#166534", padding: "2px 6px", borderRadius: "4px", fontSize: "12px", fontFamily: "monospace" }}>
                              {ep}
                            </code>
                          </li>
                        ))}
                      </ul>

                      {result.plan.businessValue && result.plan.businessValue.length > 0 && (
                        <>
                          <h4 style={{ margin: "16px 0 6px 0", color: "#1f2937" }}>Business Case & Value</h4>
                          <ul style={{ paddingLeft: "20px", color: "#334155", margin: 0 }}>
                            {result.plan.businessValue.map((val, i) => (
                              <li key={i} style={{ marginBottom: "6px", fontSize: "13px", lineHeight: 1.4 }}>
                                {val}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}

                  {/* TAB: CODE */}
                  {activeTab === "code" && result.files && result.files.length > 0 && (
                    <div>
                      <div style={{ display: "flex", gap: "6px", marginBottom: "12px", overflowX: "auto", paddingBottom: "4px" }}>
                        {result.files.map((file, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedFileIndex(idx)}
                            className={`tab-btn ${selectedFileIndex === idx ? "active" : ""}`}
                            style={{ fontSize: "12px", padding: "4px 8px" }}
                          >
                            {file.path.split("/").pop()}
                          </button>
                        ))}
                      </div>
                      
                      <div style={{ fontSize: "13px", color: "#71717a", marginBottom: "6px", textAlign: "left" }}>
                        File Path: <code>{result.files[selectedFileIndex]?.path}</code>
                      </div>
                      <pre className="code-block" style={{ margin: 0 }}>
                        {result.files[selectedFileIndex]?.content}
                      </pre>
                    </div>
                  )}

                  {/* TAB: CLAIMS */}
                  {activeTab === "claims" && result.claimReport && (
                    <div style={{ textAlign: "left" }}>
                      <h3 style={{ color: "#0d9488", margin: "0 0 12px 0" }}>Elastic-Powered Claim Verification</h3>
                      
                      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
                        <span style={{ background: "#dcfce7", color: "#166534", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 600 }}>
                          Supported: {result.claimReport.summary?.supported ?? 0}
                        </span>
                        <span style={{ background: "#fef9c3", color: "#854d0e", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 600 }}>
                          Inferred: {result.claimReport.summary?.inferred ?? 0}
                        </span>
                        <span style={{ background: "#fee2e2", color: "#991b1b", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 600 }}>
                          Unsupported: {result.claimReport.summary?.unsupported ?? 0}
                        </span>
                        <span style={{ background: "#f3e8ff", color: "#6b21a8", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 600 }}>
                          Marketing: {result.claimReport.summary?.marketing ?? 0}
                        </span>
                      </div>

                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                          <thead>
                            <tr style={{ borderBottom: "2px solid #e4e4e7" }}>
                              <th style={{ padding: "10px 8px", textAlign: "left" }}>Claim Statement</th>
                              <th style={{ padding: "10px 8px", textAlign: "center", width: "120px" }}>Verification</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.claimReport.claims.map((c) => (
                              <tr key={c.id} style={{ borderBottom: "1px solid #e4e4e7" }}>
                                <td style={{ padding: "10px 8px", color: "#374151" }}>{c.rewrite ?? c.text}</td>
                                <td style={{ padding: "10px 8px", textAlign: "center" }}>
                                  <span style={{
                                    padding: "2px 8px",
                                    borderRadius: "4px",
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    textTransform: "capitalize",
                                    background: c.status === "supported" ? "#dcfce7" : c.status === "inferred" ? "#fef9c3" : c.status === "unsupported" ? "#fee2e2" : "#f3f4f6",
                                    color: c.status === "supported" ? "#15803d" : c.status === "inferred" ? "#a16207" : c.status === "unsupported" ? "#b91c1c" : "#4b5563"
                                  }}>
                                    {c.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB: README / SETUP */}
                  {activeTab === "readme" && (
                    <div style={{ textAlign: "left" }}>
                      <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "20px" }}>
                        <h4 style={{ margin: "0 0 8px 0", color: "#1e293b" }}>📦 Delivery Package</h4>
                        <p style={{ margin: "0 0 10px 0", fontSize: "13px" }}>
                          Files generated: <strong>{result.files?.length ?? 0}</strong> | Package status: <strong style={{ color: result.packageCheck.status === "passed" ? "#166534" : "#b91c1c" }}>{result.packageCheck.status}</strong>
                        </p>
                        
                        {artifactDownloadUrl && (
                          <p style={{ margin: "0 0 8px 0", fontSize: "13px" }}>
                            📥 <a href={artifactDownloadUrl} download={artifact?.fileName} style={{ color: "#4f46e5", fontWeight: 600, textDecoration: "underline" }}>
                              Download demo zip
                            </a>
                            {artifact?.sizeBytes && <span style={{ fontSize: "11px", color: "#71717a", marginLeft: "6px" }}>({Math.round(artifact.sizeBytes / 1024)} KB)</span>}
                          </p>
                        )}

                        {result.gitlab.url && (
                          <p style={{ margin: "0 0 8px 0", fontSize: "13px" }}>
                            🦊 <a href={result.gitlab.url} target="_blank" rel="noopener noreferrer" style={{ color: "#4f46e5", fontWeight: 600, textDecoration: "underline" }}>
                              View GitLab Repository
                            </a>
                          </p>
                        )}

                        {result.gitlab.localPath && (
                          <p style={{ margin: 0, fontSize: "12px", color: "#475569" }}>
                            📁 Local export: <code>{result.gitlab.localPath}</code>
                          </p>
                        )}
                      </div>

                      <ReactMarkdown
                        components={{
                          a: ({ node, ...props }) => (
                            <a {...props} target="_blank" rel="noopener noreferrer" />
                          )
                        }}
                      >
                        {result.files.find(f => f.path.toLowerCase() === 'readme.md')?.content || "# Setup Guide\n\nNo README.md file generated in this package."}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
