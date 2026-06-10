import { useMemo, useState } from "react";
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
  const [apiName, setApiName] = useState("Acme Document Extraction API");
  const [docsUrl, setDocsUrl] = useState("");
  const [docsText, setDocsText] = useState(sampleDocs);
  const [goal, setGoal] = useState("Show how AeroCore could reduce billing and dispatch reconciliation work by extracting fields from invoices, repair logs, pilot records, and lease documents, then exporting reviewed data to its integration layer.");
  const [industry, setIndustry] = useState("Industrial equipment leasing");
  const [audience, setAudience] = useState("executive");
  const [customerId, setCustomerId] = useState("aerocore-leasing");
  const [customerPersona, setCustomerPersona] = useState("Sarah Jenkins, Billing & Finance Administrator");
  const [targetSystem, setTargetSystem] = useState("Salesforce Lease_Agreement__c custom object");
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runWorkflow() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl("/api/workflow/run"), {
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
          liveApiAllowed: false,
          customerId: customerId.trim() || undefined,
          customerPersona: customerPersona.trim() || undefined,
          targetSystem: targetSystem.trim() || undefined
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

  const filePreview = useMemo(() => result?.files?.slice(0, 6) ?? [], [result]);
  const artifact = result?.gitlab.artifact;
  const artifactDownloadUrl = artifact?.downloadUrl?.startsWith("/api/")
    ? apiUrl(artifact.downloadUrl)
    : artifact?.downloadUrl?.startsWith("http")
      ? artifact.downloadUrl
      : undefined;

  return (
    <main className="page">
          <section className="hero">
        <p className="eyebrow">Google Rapid Agent Hackathon scaffold</p>
        <h1>ProofPilot</h1>
        <p>Generate source-grounded API demos from product docs, docs URLs, and a customer scenario.</p>
      </section>

      <section className="grid">
        <div className="card">
          <h2>1. Demo brief</h2>
          <label>API name</label>
          <input value={apiName} onChange={(e) => setApiName(e.target.value)} />

          <label>Industry</label>
          <input value={industry} onChange={(e) => setIndustry(e.target.value)} />

          <label>Audience</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="executive">Executive</option>
            <option value="technical">Technical</option>
            <option value="sales">Sales</option>
            <option value="developer">Developer</option>
          </select>

          <label>Goal</label>
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={5} />

          <label>Customer data set</label>
          <input
            placeholder="sample-data folder name, e.g. aerocore-leasing"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          />

          <label>Customer persona</label>
          <input value={customerPersona} onChange={(e) => setCustomerPersona(e.target.value)} />

          <label>Target system</label>
          <input value={targetSystem} onChange={(e) => setTargetSystem(e.target.value)} />

          <label>Docs URL</label>
          <input
            placeholder="https://example.com/docs or OpenAPI URL"
            value={docsUrl}
            onChange={(e) => setDocsUrl(e.target.value)}
          />

          <label>API docs fallback</label>
          <textarea value={docsText} onChange={(e) => setDocsText(e.target.value)} rows={11} />

          <button onClick={runWorkflow} disabled={loading}>{loading ? "Generating..." : "Generate grounded demo"}</button>
          {error && <p className="error">{error}</p>}
        </div>

        <div className="stack">
          <section className="card">
            <h2>2. Generated plan</h2>
            {!result ? <p className="muted">Run the workflow to generate a plan.</p> : <>
              <p className="muted">Runtime: {result.agentRuntime.mode}. Model: {result.model.provider} / {result.model.model}</p>
              <p className="muted">Docs: {result.docsSourceUrl ?? "pasted text"}{result.docsCharacters ? ` (${result.docsCharacters.toLocaleString()} chars)` : ""}</p>
              {result.businessContext?.customerId && <p className="muted">Customer data: {result.businessContext.customerId} ({result.customerChunksIndexed?.toLocaleString() ?? 0} chunks, {result.businessContext.signals.length} signals)</p>}
              <h3>{result.plan.title}</h3>
              <p>{result.plan.story}</p>
              <div className="chips">{result.plan.screens.map((s) => <span key={s}>{s}</span>)}</div>
            </>}
          </section>

          <section className="card">
            <h2>Business context</h2>
            {!result?.businessContext?.signals.length ? <p className="muted">Customer-specific evidence will appear here when a sample data set is provided.</p> : <div className="agent-list">
              {result.businessContext.signals.map((signal) => (
                <article key={signal.id} className="agent-row">
                  <div>
                    <strong>{signal.title}</strong>
                    <p>{signal.summary}</p>
                    <small>{[signal.department, signal.metric].filter(Boolean).join(" / ")}</small>
                  </div>
                </article>
              ))}
            </div>}
          </section>

          <section className="card">
            <h2>Agent pipeline</h2>
            {!result ? <p className="muted">Each README MVP step will appear here as a completed agent run.</p> : <div className="agent-list">
              {result.agents.map((agent) => (
                <article key={agent.id} className="agent-row">
                  <div>
                    <strong>{agent.name}</strong>
                    <p>{agent.outputSummary || agent.error}</p>
                    <small>{agent.tools.join(", ")}</small>
                  </div>
                  <span className={`badge ${agent.status}`}>{agent.durationMs}ms</span>
                </article>
              ))}
            </div>}
          </section>

          <section className="card">
            <h2>3. Elastic-powered claim report</h2>
            {!result ? <p className="muted">Claims will be checked against retrieved doc evidence.</p> : <table>
              <thead><tr><th>Claim</th><th>Status</th></tr></thead>
              <tbody>{result.claimReport.claims.map((c) => <tr key={c.id}><td>{c.rewrite ?? c.text}</td><td><span className={`badge ${c.status}`}>{c.status}</span></td></tr>)}</tbody>
            </table>}
          </section>

          <section className="card">
            <h2>4. Generated package</h2>
            {!result ? <p className="muted">Generated files and GitLab export appear here.</p> : <>
              <p><strong>{result.files.length}</strong> files generated. Package check: <strong>{result.packageCheck.status}</strong>. GitLab mode: <strong>{result.gitlab.mode}</strong></p>
              {artifactDownloadUrl && <p><a className="download-link" href={artifactDownloadUrl} download={artifact?.fileName}>Download demo zip</a></p>}
              {artifact && <p className="muted">Artifact: {artifact.mode} / {artifact.fileName}{artifact.sizeBytes ? ` (${Math.round(artifact.sizeBytes / 1024)} KB)` : ""}</p>}
              {artifact?.message && <p className="muted">{artifact.message}</p>}
              {artifact?.objectName && <p className="muted">Object: <code>{artifact.objectName}</code></p>}
              {result.gitlab.url && <a href={result.gitlab.url}>{result.gitlab.url}</a>}
              {result.gitlab.localPath && <p className="muted">Local export: <code>{result.gitlab.localPath}</code></p>}
              <ul>{filePreview.map((f) => <li key={f.path}><code>{f.path}</code></li>)}</ul>
            </>}
          </section>
        </div>
      </section>
    </main>
  );
}
