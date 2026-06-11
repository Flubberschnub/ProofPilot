import { useMemo, useState, useEffect } from "react";
import { apiUrl } from "./config";

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
  customerChunksIndexed?: number;
  docsSourceUrl?: string;
  docsCharacters?: number;
  businessContext?: {
    customerId?: string;
    chunks: Array<{ id: string; title: string }>;
    signals: Array<{ id: string; title: string; summary: string; department?: string; metric?: string; evidenceChunkIds: string[] }>;
  };
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
  validationPassed: boolean;
  previewUrl: string | null;
};

const sampleDocs = `# Acme Document Extraction API
All requests use Bearer token auth.

## POST /documents/extract
Uploads document (PDF, PNG, JPG) using multipart/form-data.

## GET /documents/{document_id}
Returns extraction status and fields (name, value, confidence).

## POST /documents/{document_id}/approve
Approves extraction.

## POST /exports
Exports approved data as JSON to external integration layers. Does not integrate directly with CRMs/ERPs.`;

export default function App() {
  // Primary intake inputs
  const [apiName, setApiName] = useState("Acme Document Extraction API");
  const [apiDocs, setApiDocs] = useState(sampleDocs);
  const [customerId, setCustomerId] = useState("aerocore-leasing");
  const [context, setContext] = useState("Focus on manual billing/repair-log extraction and Salesforce Lease_Agreement__c sync for Sarah Jenkins at AeroCore.");
  
  // Collapse toggle for advanced parameters
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced inference variables (client-side pre-filled defaults, editable)
  const [audience, setAudience] = useState("executive");
  const [industry, setIndustry] = useState("Leasing & Aviation");
  const [customerPersona, setCustomerPersona] = useState("Sarah Jenkins, Billing & Finance Administrator");
  const [targetSystem, setTargetSystem] = useState("Salesforce");
  const [preferredStack, setPreferredStack] = useState("React + Node");
  const [liveApiAllowed, setLiveApiAllowed] = useState(false);

  // App UI state
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"plan" | "claims" | "files">("plan");

  // Simulated live progress step timer
  const [activeStationIdx, setActiveStationIdx] = useState(0);

  useEffect(() => {
    let intervalId: any;
    if (loading) {
      setActiveStationIdx(0);
      intervalId = setInterval(() => {
        setActiveStationIdx(prev => (prev < 8 ? prev + 1 : prev));
      }, 1800);
    } else {
      setActiveStationIdx(0);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [loading]);

  async function runWorkflow() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const trimmedDocs = apiDocs.trim();
      const docsIsUrl = /^https?:\/\//i.test(trimmedDocs);
      const response = await fetch(apiUrl("/api/workflow/run"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiName,
          docsUrl: docsIsUrl ? trimmedDocs : undefined,
          docsText: docsIsUrl ? undefined : trimmedDocs || undefined,
          context: context.trim() || undefined,
          audience,
          industry,
          customerPersona,
          targetSystem,
          preferredStack,
          liveApiAllowed,
          customerId: customerId.trim() || undefined
        })
      });
      const responseText = await response.text();
      if (!response.ok) throw new Error(responseText || `Workflow failed with status ${response.status}`);
      if (!responseText.trim()) throw new Error("Workflow returned an empty response.");
      try {
        setResult(JSON.parse(responseText));
      } catch {
        throw new Error(`Workflow returned a non-JSON response: ${responseText.slice(0, 500)}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const filePreview = useMemo(() => result?.files ?? [], [result]);
  const artifact = result?.gitlab.artifact;
  const artifactDownloadUrl = artifact?.downloadUrl?.startsWith("/api/")
    ? apiUrl(artifact.downloadUrl)
    : artifact?.downloadUrl?.startsWith("http")
      ? artifact.downloadUrl
      : undefined;

  // Metro station status helper
  const stationsOrder = ["IN", "DX", "BD", "SG", "PL", "CL", "VL", "TS", "PK"];

  function getStationStatus(stationId: string) {
    if (loading) {
      const idx = stationsOrder.indexOf(stationId);
      if (idx === activeStationIdx) return "active";
      if (idx < activeStationIdx) return "passed";
      return "pending";
    }
    if (!result) return "pending";

    // Map agents inside the output
    const agentMap: Record<string, string> = {
      IN: "mvp-01-intake",
      DX: "mvp-02-source-capability",
      BD: "mvp-03-business-context",
      SG: "mvp-04-demo-planner",
      PL: "mvp-04-demo-planner",
      CL: "mvp-05-claim-checker",
      VL: "mvp-08-validation",
      TS: "mvp-09-tester",
      PK: "mvp-06-package-generator"
    };

    const targetAgentId = agentMap[stationId];
    const matchingAgent = result.agents.find(a => a.id === targetAgentId || a.name.toLowerCase().includes(stationId.toLowerCase()));
    
    if (matchingAgent) {
      return matchingAgent.status === "passed" ? "passed" : "failed";
    }
    return "passed";
  }

  return (
    <div className="app-container">
      {/* 1. Header Strip */}
      <header className="header-strip">
        <div className="header-title-group">
          <h1 className="header-title">PROOFPILOT // OPERATIONS ROUTE</h1>
          <span className="header-subtitle">URBAN DEMO GENERATOR</span>
        </div>
        <div className="header-meta">
          {result && (
            <>
              <span>MODEL: {result.model.provider.toUpperCase()} ({result.model.model})</span>
              <span>RUNTIME: {result.agentRuntime.mode.toUpperCase()}</span>
            </>
          )}
          <span>SYS_STATUS: {loading ? "INGESTING" : result ? "OPERATIONAL" : "READY"}</span>
        </div>
      </header>

      {/* 2. Left Rail: Transit Route Map */}
      <aside className="brutalist-panel left-rail">
        <div className="panel-header">
          <h2 className="panel-title">Route Map / SYSTEM LINES</h2>
          <span className="panel-station-code">T-LINE</span>
        </div>
        <div className="metro-line-container">
          <div className={`metro-track ${loading ? "active" : ""}`}></div>
          
          <div className={`metro-station ${getStationStatus("IN")}`}>
            <div className="station-indicator"></div>
            <div className="station-details">
              <span className="station-code">IN-01</span>
              <span className="station-name">Intake Agent</span>
              <span className="station-status">{loading && activeStationIdx === 0 ? "Running..." : result ? "Brief Indexed" : "Awaiting..."}</span>
            </div>
          </div>

          <div className={`metro-station ${getStationStatus("DX")}`}>
            <div className="station-indicator"></div>
            <div className="station-details">
              <span className="station-code">DX-02</span>
              <span className="station-name">Docs Profiler</span>
              <span className="station-status">
                {loading && activeStationIdx === 1 ? "Running..." : result ? `${result.chunksIndexed} Chunks` : "Pending..."}
              </span>
            </div>
          </div>

          <div className={`metro-station ${getStationStatus("BD")}`}>
            <div className="station-indicator"></div>
            <div className="station-details">
              <span className="station-code">BD-03</span>
              <span className="station-name">Business Data</span>
              <span className="station-status">
                {loading && activeStationIdx === 2 ? "Running..." : result?.businessContext?.customerId ? result.businessContext.customerId : "Pending..."}
              </span>
            </div>
          </div>

          <div className={`metro-station ${getStationStatus("SG")}`}>
            <div className="station-indicator"></div>
            <div className="station-details">
              <span className="station-code">SG-04</span>
              <span className="station-name">Signals Extract</span>
              <span className="station-status">
                {loading && activeStationIdx === 3 ? "Running..." : result?.businessContext?.signals.length ? `${result.businessContext.signals.length} Signals` : "Pending..."}
              </span>
            </div>
          </div>

          <div className={`metro-station ${getStationStatus("PL")}`}>
            <div className="station-indicator"></div>
            <div className="station-details">
              <span className="station-code">PL-05</span>
              <span className="station-name">Demo Planner</span>
              <span className="station-status">
                {loading && activeStationIdx === 4 ? "Running..." : result ? "Plan Generated" : "Pending..."}
              </span>
            </div>
          </div>

          <div className={`metro-station ${getStationStatus("CL")}`}>
            <div className="station-indicator"></div>
            <div className="station-details">
              <span className="station-code">CL-06</span>
              <span className="station-name">Claim Checker</span>
              <span className="station-status">
                {loading && activeStationIdx === 5 ? "Running..." : result?.claimReport ? `${result.claimReport.summary.supported}/${result.claimReport.claims.length} Valid` : "Pending..."}
              </span>
            </div>
          </div>

          <div className={`metro-station ${getStationStatus("VL")}`}>
            <div className="station-indicator"></div>
            <div className="station-details">
              <span className="station-code">VL-07</span>
              <span className="station-name">Validation Agent</span>
              <span className="station-status">
                {loading && activeStationIdx === 6 ? "Running..." : result?.validationPassed ? "Passed" : result ? "Failed" : "Pending..."}
              </span>
            </div>
          </div>

          <div className={`metro-station ${getStationStatus("TS")}`}>
            <div className="station-indicator"></div>
            <div className="station-details">
              <span className="station-code">TS-08</span>
              <span className="station-name">Tester Agent</span>
              <span className="station-status">
                {loading && activeStationIdx === 7 ? "Running..." : result?.validationPassed ? "Passed" : result ? "Failed" : "Pending..."}
              </span>
            </div>
          </div>

          <div className={`metro-station ${getStationStatus("PK")}`}>
            <div className="station-indicator"></div>
            <div className="station-details">
              <span className="station-code">PK-09</span>
              <span className="station-name">Cargo Manifest</span>
              <span className="station-status">
                {loading && activeStationIdx === 8 ? "Running..." : result ? `${result.files.length} Files Committed` : "Pending..."}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* 3. Center Area: Intake Form and Plan Output */}
      <main className="brutalist-panel">
        <div className="panel-header">
          <h2 className="panel-title">Console Ingestion / INPUT FORM</h2>
          <span className="panel-station-code">MAIN-FORM</span>
        </div>
        
        <div className="main-intake-form">
          <div className="form-row">
            <div className="form-group">
              <label>API Name</label>
              <input value={apiName} onChange={(e) => setApiName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Customer ID (Business Data)</label>
              <input
                placeholder="sample-data folder name, e.g. aerocore-leasing"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>API Documentation (Markdown, JSON or HTTPS URL)</label>
            <textarea
              placeholder="Paste docs details, Swagger/OpenAPI or a web documentation URL"
              value={apiDocs}
              onChange={(e) => setApiDocs(e.target.value)}
              rows={4}
            />
          </div>

          <div className="form-group">
            <label>Demo Brief & Customer Context</label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={2}
            />
          </div>

          {/* Advanced toggle */}
          <div className="advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
            <span>{showAdvanced ? "▼ Collapse Advanced Parameters" : "▶ Expand Advanced Parameters (Inferred Defaults)"}</span>
          </div>

          {showAdvanced && (
            <div className="advanced-fields">
              <div className="form-group">
                <label>Target Audience</label>
                <input value={audience} onChange={(e) => setAudience(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Industry</label>
                <input value={industry} onChange={(e) => setIndustry(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Target Persona</label>
                <input value={customerPersona} onChange={(e) => setCustomerPersona(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Target System</label>
                <input value={targetSystem} onChange={(e) => setTargetSystem(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Preferred Stack</label>
                <input value={preferredStack} onChange={(e) => setPreferredStack(e.target.value)} />
              </div>
              <div className="form-group" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "8px", marginTop: "18px" }}>
                <input
                  type="checkbox"
                  id="liveApiAllowed"
                  checked={liveApiAllowed}
                  onChange={(e) => setLiveApiAllowed(e.target.checked)}
                />
                <label htmlFor="liveApiAllowed" style={{ marginBottom: 0, cursor: "pointer" }}>Allow Live API Calls</label>
              </div>
            </div>
          )}

          <button className="action-button" onClick={runWorkflow} disabled={loading}>
            {loading ? "ROUTE GENERATING..." : "RUN DEMO ROUTE"}
          </button>

          {error && <div className="error-box">ERROR: {error}</div>}
        </div>

        {/* Plan Output tabs */}
        {result && (
          <div className="plan-overview-card">
            <div className="tab-row">
              <div className={`tab-item ${activeTab === "plan" ? "active" : ""}`} onClick={() => setActiveTab("plan")}>
                01. Demo Route Plan
              </div>
              <div className={`tab-item ${activeTab === "claims" ? "active" : ""}`} onClick={() => setActiveTab("claims")}>
                02. Claim Ticket Gates
              </div>
              <div className={`tab-item ${activeTab === "files" ? "active" : ""}`} onClick={() => setActiveTab("files")}>
                03. Manifest Cargo Files
              </div>
            </div>

            <div className="tab-contents">
              {activeTab === "plan" && (
                <div>
                  <h3 className="plan-title">{result.plan.title}</h3>
                  <p className="plan-story">{result.plan.story}</p>
                  <div style={{ marginTop: "12px" }}>
                    <h4 style={{ fontSize: "12px", textTransform: "uppercase", marginBottom: "8px", fontFamily: "var(--font-mono)" }}>
                      DEMO FLOW STATIONS (SCREENS)
                    </h4>
                    {result.plan.screens.map((screen, idx) => (
                      <div key={screen} className="screen-line">
                        <span className="screen-badge">STATION 0{idx + 1}</span>
                        <span style={{ fontSize: "13px", fontWeight: "700" }}>{screen}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "claims" && (
                <div>
                  <table className="claims-table">
                    <thead>
                      <tr>
                        <th>CLAIM VALIDATION</th>
                        <th style={{ width: "100px" }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.claimReport.claims.map((claim) => (
                        <tr key={claim.id}>
                          <td>
                            <div style={{ fontWeight: "700" }}>{claim.text}</div>
                            {claim.rewrite && (
                              <div style={{ fontSize: "11px", color: "var(--track-gray)", marginTop: "4px", borderLeft: "2px solid var(--ginza-orange)", paddingLeft: "6px" }}>
                                <strong>Rewrite: </strong> {claim.rewrite}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={`gate-badge ${claim.status}`}>{claim.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "files" && (
                <div>
                  <ul className="file-list">
                    {filePreview.map((file) => (
                      <li key={file.path}>
                        <span>📁 {file.path}</span>
                        <span style={{ color: "var(--track-gray)" }}>{file.content.length.toLocaleString()} bytes</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 4. Right Inspection Rail: Evidence and business signals */}
      <aside className="brutalist-panel right-inspection-rail">
        <div className="panel-header">
          <h2 className="panel-title">Evidence Inspector / METRICS</h2>
          <span className="panel-station-code">EVID-01</span>
        </div>
        
        {!result ? (
          <p style={{ fontSize: "12px", color: "var(--track-gray)", fontStyle: "italic" }}>
            Awaiting active Demo Route generation to parse grounding evidence logs...
          </p>
        ) : (
          <div className="inspection-list">
            <h3 style={{ fontSize: "11px", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--ink-black)" }}>
              DEMO WORKFLOW METADATA
            </h3>
            <div className="inspection-item" style={{ background: "var(--paper-white)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11px" }}>
                <div><strong>DOCS CHARS:</strong> {result.docsCharacters?.toLocaleString()}</div>
                <div><strong>CHUNKS IDXD:</strong> {result.chunksIndexed}</div>
                <div><strong>BIZ CHUNKS:</strong> {result.customerChunksIndexed || 0}</div>
                <div><strong>GIT LAB MODE:</strong> {result.gitlab.mode}</div>
              </div>
            </div>

            <h3 style={{ fontSize: "11px", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--hanzomon-purple)", marginTop: "10px" }}>
              EXTRACTED CUSTOMER SIGNALS ({result.businessContext?.signals.length || 0})
            </h3>
            {result.businessContext?.signals.map((signal) => (
              <div key={signal.id} className="inspection-item" style={{ borderLeft: "4px solid var(--hanzomon-purple)" }}>
                <div className="inspection-item-title">
                  <span>{signal.title}</span>
                  <span style={{ color: "var(--hanzomon-purple)" }}>{signal.id.toUpperCase()}</span>
                </div>
                <div className="inspection-item-body">
                  <p>{signal.summary}</p>
                  <div style={{ marginTop: "4px", fontSize: "10px", color: "var(--track-gray)" }}>
                    DEPT: {signal.department || "N/A"} / METRIC: {signal.metric || "N/A"}
                  </div>
                </div>
              </div>
            ))}

            <h3 style={{ fontSize: "11px", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--track-gray)", marginTop: "10px" }}>
              AGENT CONSOLE LOGS
            </h3>
            {result.agents.map((agent) => (
              <div key={agent.id} className="inspection-item" style={{ padding: "8px", fontSize: "11px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                  <span>🤖 {agent.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}>{agent.durationMs}ms</span>
                </div>
                <div style={{ color: "#555", marginTop: "2px" }}>{agent.outputSummary || agent.error}</div>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* 5. Bottom Output Strip: GitLab & Zip manifest */}
      {result && (
        <footer className="bottom-output-strip">
          <div className="package-meta">
            <h3 className="package-meta-title">DEMO CARGO READY / PACKAGE</h3>
            <p className="package-meta-details">
              MANIFEST: {result.files.length} FILES COMMITTED // PACKAGE_CHECK: {result.packageCheck.status.toUpperCase()} // GITLAB_URL: {result.gitlab.url || "N/A"}
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            {result.validationPassed && result.previewUrl && (
              <a className="download-btn" style={{ background: "var(--tozai-blue)" }} href={apiUrl(result.previewUrl)} target="_blank" rel="noopener noreferrer">
                🌐 RUN LIVE DEMO ON GCP
              </a>
            )}
            {artifactDownloadUrl && (
              <a className="download-btn" href={artifactDownloadUrl} download={artifact?.fileName}>
                📥 DOWNLOAD ZIP CARGO (.ZIP)
              </a>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
