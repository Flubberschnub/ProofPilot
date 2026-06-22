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
    evidence?: Array<{ id: string; title: string; sourcePath?: string; domain?: string; text?: string }>;
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

function renderParsedText(text: string) {
  if (!text) return "";
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} style={{ fontWeight: 800 }}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function getClaimEvidenceSources(evidenceChunkIds: string[] | undefined, evidenceList: any[] | undefined) {
  if (!evidenceChunkIds || !evidenceList) return [];
  return evidenceList.filter((chunk: any) => evidenceChunkIds.includes(chunk.id));
}

export default function App() {
  // Primary intake inputs
  const [apiName, setApiName] = useState("Open Meteo");
  const [apiDocs, setApiDocs] = useState("https://open-meteo.com/en/docs");
  const [customerId, setCustomerId] = useState("aerocore-leasing");
  const [context, setContext] = useState("Demonstrate how the use of Open Meteo could be used as a part of the internal dispatch portal to inform the dispatch and scheduling coordinators in advance of weather events that could prevent normal flight options of Aerocore leasing. Generate a mock dashboard that shows the weather for the next week for a city that the user selects, highlighting weather where aircraft operations will be limited.");
  
  // Collapse toggle for advanced parameters
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced inference variables (client-side pre-filled defaults, editable)
  const [audience, setAudience] = useState("executive");
  const [industry, setIndustry] = useState("Aviation");
  const [customerPersona, setCustomerPersona] = useState("Flight Operations Dispatcher");
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

  // Tutorial walkthrough states
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const tutorialSteps = [
    {
      selector: ".main-intake-form",
      title: "1. Input API & Context Specs",
      text: "Fill in the API Name, paste the documentation (JSON/Markdown/URL), and write a Demo Brief. Note: Use a valid customer ID (like 'aerocore-leasing') corresponding to a folder in the GitHub sample-data repository."
    },
    {
      selector: ".left-rail",
      title: "2. Track Ingestion & Build Stages",
      text: "Monitor this progressive progress bar as specialized agents intake the spec, verify claims, validate code integrity, and generate the code package."
    },
    {
      selector: ".right-inspection-rail",
      title: "3. Inspect Claims & Outputs",
      text: "Once completed, open the Live Preview URL to interact with the generated demo app, check source-grounded claims, or download the Git repository package."
    },
    {
      selector: ".action-button",
      title: "4. Run Demo Route",
      text: "Click the prominent \"RUN DEMO ROUTE\" button to launch the autonomous agent verification pipeline, build the frontend, and deploy the Cloud Run instance."
    }
  ];

  function startTutorial() {
    setTutorialStep(0);
    setHasSeenTutorial(true);
  }

  function getTooltipStyle(step: number) {
    if (windowWidth < 1200) {
      return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
    }
    switch (step) {
      case 0: // Ingestion Form
        return { left: "300px", top: "250px" };
      case 1: // Left rail
        return { left: "300px", top: "250px" };
      case 2: // Right rail
        return { right: "380px", top: "250px" };
      case 3: // Run button
        return { left: "300px", top: "450px" };
      default:
        return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
    }
  }

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

  const progressPercent = loading
    ? (activeStationIdx / (stationsOrder.length - 1)) * 100
    : result
      ? 100
      : 0;

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
          <h1 className="header-title">PROOFPILOT</h1>
          <span className="header-subtitle">Autonomous validation and live preview generation for enterprise API integrations</span>
        </div>
        <div className="header-meta">
          <div className="tutorial-btn-wrapper">
            <button 
              className={`tutorial-trigger-btn ${!hasSeenTutorial ? "unseen-flash" : ""}`} 
              onClick={startTutorial}
            >
              TUTORIAL
            </button>
          </div>
          {result && (
            <>
              <span>MODEL: {result.model.provider.toUpperCase()} ({result.model.model})</span>
              <span>RUNTIME: {result.agentRuntime.mode.toUpperCase()}</span>
            </>
          )}
          <span>SYS_STATUS: {loading ? "INGESTING" : result ? "OPERATIONAL" : "READY"}</span>
        </div>
      </header>

      {/* 2. Left Rail: Process Stages */}
      <aside className={`brutalist-panel left-rail ${tutorialStep === 1 ? "tutorial-highlighted" : ""}`}>
        <div className="panel-header">
          <h2 className="panel-title">Process Stages</h2>
        </div>
        <div className="metro-line-container">
          <div className="metro-track-bg"></div>
          <div className="metro-track-fill" style={{ height: `${progressPercent}%` }}></div>
          
          <div className={`metro-station ${getStationStatus("IN")}`}>
            <div className="station-indicator"></div>
            <div className="station-details">
              <span className="station-code">IN-01</span>
              <span className="station-name">Intake Agent</span>
              <span className="station-status">{loading && activeStationIdx === 0 ? "Running..." : (result || (loading && activeStationIdx > 0)) ? "Brief Indexed" : "Awaiting..."}</span>
            </div>
          </div>

          <div className={`metro-station ${getStationStatus("DX")}`}>
            <div className="station-indicator"></div>
            <div className="station-details">
              <span className="station-code">DX-02</span>
              <span className="station-name">Docs Profiler</span>
              <span className="station-status">
                {loading && activeStationIdx === 1 ? "Running..." : result ? `${result.chunksIndexed} Chunks` : (loading && activeStationIdx > 1) ? "Chunks Indexed" : "Pending..."}
              </span>
            </div>
          </div>

          <div className={`metro-station ${getStationStatus("BD")}`}>
            <div className="station-indicator"></div>
            <div className="station-details">
              <span className="station-code">BD-03</span>
              <span className="station-name">Business Data</span>
              <span className="station-status">
                {loading && activeStationIdx === 2 ? "Running..." : result?.businessContext?.customerId ? result.businessContext.customerId : (loading && activeStationIdx > 2) ? "Context Loaded" : "Pending..."}
              </span>
            </div>
          </div>

          <div className={`metro-station ${getStationStatus("SG")}`}>
            <div className="station-indicator"></div>
            <div className="station-details">
              <span className="station-code">SG-04</span>
              <span className="station-name">Signals Extract</span>
              <span className="station-status">
                {loading && activeStationIdx === 3 ? "Running..." : result?.businessContext?.signals.length ? `${result.businessContext.signals.length} Signals` : (loading && activeStationIdx > 3) ? "Signals Extracted" : "Pending..."}
              </span>
            </div>
          </div>

          <div className={`metro-station ${getStationStatus("PL")}`}>
            <div className="station-indicator"></div>
            <div className="station-details">
              <span className="station-code">PL-05</span>
              <span className="station-name">Demo Planner</span>
              <span className="station-status">
                {loading && activeStationIdx === 4 ? "Running..." : (result || (loading && activeStationIdx > 4)) ? "Plan Generated" : "Pending..."}
              </span>
            </div>
          </div>

          <div className={`metro-station ${getStationStatus("CL")}`}>
            <div className="station-indicator"></div>
            <div className="station-details">
              <span className="station-code">CL-06</span>
              <span className="station-name">Claim Checker</span>
              <span className="station-status">
                {loading && activeStationIdx === 5 ? "Running..." : result?.claimReport ? `${result.claimReport.summary.supported}/${result.claimReport.claims.length} Valid` : (loading && activeStationIdx > 5) ? "Claims Checked" : "Pending..."}
              </span>
            </div>
          </div>

          <div className={`metro-station ${getStationStatus("VL")}`}>
            <div className="station-indicator"></div>
            <div className="station-details">
              <span className="station-code">VL-07</span>
              <span className="station-name">Validation Agent</span>
              <span className="station-status">
                {loading && activeStationIdx === 6 ? "Running..." : result ? (result.validationPassed ? "Passed" : "Failed") : (loading && activeStationIdx > 6) ? "Passed" : "Pending..."}
              </span>
            </div>
          </div>

          <div className={`metro-station ${getStationStatus("TS")}`}>
            <div className="station-indicator"></div>
            <div className="station-details">
              <span className="station-code">TS-08</span>
              <span className="station-name">Tester Agent</span>
              <span className="station-status">
                {loading && activeStationIdx === 7 ? "Running..." : result ? (result.validationPassed ? "Passed" : "Failed") : (loading && activeStationIdx > 7) ? "Passed" : "Pending..."}
              </span>
            </div>
          </div>

          <div className={`metro-station ${getStationStatus("PK")}`}>
            <div className="station-indicator"></div>
            <div className="station-details">
              <span className="station-code">PK-09</span>
              <span className="station-name">Cargo Manifest</span>
              <span className="station-status">
                {loading && activeStationIdx === 8 ? "Running..." : result ? `${result.files.length} Files Committed` : (loading && activeStationIdx > 8) ? "Files Committed" : "Pending..."}
              </span>
            </div>
          </div>
        </div>
        
        {/* Buttons below the Cargo Manifest */}
        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "16px 20px 20px 20px", borderTop: "1px dashed var(--track-gray)", marginTop: "16px" }}>
            {result.validationPassed && result.previewUrl && (
              <a className="download-btn" style={{ background: "var(--tozai-blue)", width: "100%", justifyContent: "center" }} href={apiUrl(result.previewUrl)} target="_blank" rel="noopener noreferrer">
                🌐 RUN LIVE DEMO ON GCP
              </a>
            )}
            {artifactDownloadUrl && (
              <a className="download-btn" style={{ width: "100%", justifyContent: "center" }} href={artifactDownloadUrl} download={artifact?.fileName}>
                📥 DOWNLOAD ZIP CARGO (.ZIP)
              </a>
            )}
          </div>
        )}
      </aside>

      {/* 3. Center Area: Intake Form and Plan Output */}
      <main className={`brutalist-panel main-intake-form ${tutorialStep === 0 ? "tutorial-highlighted" : ""}`}>
        <div className="panel-header">
          <h2 className="panel-title">API & context settings</h2>
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
              <div style={{ fontSize: "11px", color: "var(--track-gray)", marginTop: "4px", lineHeight: "1.4" }}>
                💡 Tip: Type a customer directory name. Sample data is available in the{" "}
                <a 
                  href="https://github.com/Flubberschnub/ProofPilot/tree/main/sample-data" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ color: "var(--tozai-blue)", textDecoration: "underline", fontWeight: "bold" }}
                >
                  GitHub sample-data folder
                </a>{" "}
                (e.g. <code>aerocore-leasing</code>).
              </div>
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
              rows={6}
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
                <select value={audience} onChange={(e) => setAudience(e.target.value)}>
                  <option value="executive">Executive</option>
                  <option value="sales">Sales</option>
                  <option value="developer">Developer</option>
                </select>
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

          <button className={`action-button ${tutorialStep === 3 ? "tutorial-highlighted" : ""}`} onClick={runWorkflow} disabled={loading}>
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
                      <div key={screen} className="screen-line" style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <span className="screen-badge" style={{ flexShrink: 0 }}>STATION 0{idx + 1}</span>
                        <span style={{ fontSize: "13px", fontWeight: "normal", lineHeight: "1.5" }}>
                          {renderParsedText(screen)}
                        </span>
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
                            {getClaimEvidenceSources(claim.evidenceChunkIds, result.businessContext?.evidence).length > 0 && (
                              <div style={{ fontSize: "11px", color: "var(--track-gray)", marginTop: "4px" }}>
                                <strong>Source Context:</strong>{" "}
                                {getClaimEvidenceSources(claim.evidenceChunkIds, result.businessContext?.evidence).map((src: any) => (
                                  <span key={src.id} className="screen-badge" style={{ background: "#eae8de", color: "#333", marginRight: "4px", fontSize: "10px", padding: "1px 4px", textTransform: "none" }}>
                                    📄 {src.sourcePath || src.title}
                                  </span>
                                ))}
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
      <aside className={`brutalist-panel right-inspection-rail ${tutorialStep === 2 ? "tutorial-highlighted" : ""}`}>
        <div className="panel-header">
          <h2 className="panel-title">Evidence Inspector / METRICS</h2>
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
                  {getClaimEvidenceSources(signal.evidenceChunkIds, result.businessContext?.evidence).length > 0 && (
                    <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {getClaimEvidenceSources(signal.evidenceChunkIds, result.businessContext?.evidence).map((src: any) => (
                        <span key={src.id} className="screen-badge" style={{ background: "#eae8de", color: "#444", fontSize: "9px", padding: "2px 4px", textTransform: "none" }}>
                          📄 {src.sourcePath || src.title}
                        </span>
                      ))}
                    </div>
                  )}
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
        <footer className="bottom-output-strip" style={{ display: "block" }}>
          <div className="package-meta">
            <h3 className="package-meta-title">DEMO CARGO READY / PACKAGE</h3>
            <p className="package-meta-details">
              MANIFEST: {result.files.length} FILES COMMITTED // PACKAGE_CHECK: {result.packageCheck.status.toUpperCase()} // GITLAB_URL: {result.gitlab.url || "N/A"}
            </p>
          </div>
        </footer>
      )}

      {/* Tutorial Overlay & Dialog */}
      {tutorialStep !== null && (
        <>
          <div className="tutorial-overlay-mask" onClick={() => setTutorialStep(null)}></div>
          <div className="tutorial-tooltip-dialog" style={getTooltipStyle(tutorialStep)}>
            <h3 style={{ fontSize: "14px", fontWeight: "900", marginBottom: "8px", fontFamily: "var(--font-jp)", textTransform: "uppercase" }}>
              {tutorialSteps[tutorialStep].title}
            </h3>
            <p style={{ fontSize: "12.5px", lineHeight: "1.5", color: "#333", marginBottom: "16px" }}>
              {tutorialSteps[tutorialStep].text}
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button 
                className="tutorial-nav-btn secondary"
                onClick={() => setTutorialStep(null)}
              >
                Skip Tour
              </button>
              <div style={{ display: "flex", gap: "8px" }}>
                {tutorialStep > 0 && (
                  <button 
                    className="tutorial-nav-btn"
                    onClick={() => setTutorialStep(prev => prev !== null ? prev - 1 : null)}
                  >
                    Back
                  </button>
                )}
                <button 
                  className="tutorial-nav-btn primary"
                  onClick={() => {
                    if (tutorialStep < tutorialSteps.length - 1) {
                      setTutorialStep(prev => prev !== null ? prev + 1 : null);
                    } else {
                      setTutorialStep(null);
                    }
                  }}
                >
                  {tutorialStep === tutorialSteps.length - 1 ? "Finish" : "Next Step"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
