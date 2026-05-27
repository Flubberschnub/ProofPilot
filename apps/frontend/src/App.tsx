import { useMemo, useState } from "react";

type WorkflowResult = {
  chunksIndexed: number;
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
  gitlab: { mode: string; url: string; message: string; filesCommitted: number };
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
  const [docsText, setDocsText] = useState(sampleDocs);
  const [goal, setGoal] = useState("Show how a regional insurance company could reduce manual claim intake work by uploading claim PDFs, extracting fields, reviewing uncertain values, and exporting approved data.");
  const [industry, setIndustry] = useState("Insurance");
  const [audience, setAudience] = useState("executive");
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runWorkflow() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:8080/api/workflow/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiName: "Acme Document Extraction API",
          docsText,
          industry,
          audience,
          goal,
          preferredStack: "React + Node",
          liveApiAllowed: false
        })
      });
      if (!response.ok) throw new Error(await response.text());
      setResult(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const filePreview = useMemo(() => result?.files?.slice(0, 6) ?? [], [result]);

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Google Rapid Agent Hackathon scaffold</p>
        <h1>ProofPilot</h1>
        <p>Generate source-grounded API demos from product docs and a customer scenario.</p>
      </section>

      <section className="grid">
        <div className="card">
          <h2>1. Demo brief</h2>
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

          <label>API docs</label>
          <textarea value={docsText} onChange={(e) => setDocsText(e.target.value)} rows={13} />

          <button onClick={runWorkflow} disabled={loading}>{loading ? "Generating..." : "Generate grounded demo"}</button>
          {error && <p className="error">{error}</p>}
        </div>

        <div className="stack">
          <section className="card">
            <h2>2. Generated plan</h2>
            {!result ? <p className="muted">Run the workflow to generate a plan.</p> : <>
              <h3>{result.plan.title}</h3>
              <p>{result.plan.story}</p>
              <div className="chips">{result.plan.screens.map((s) => <span key={s}>{s}</span>)}</div>
            </>}
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
              <p><strong>{result.files.length}</strong> files generated. GitLab mode: <strong>{result.gitlab.mode}</strong></p>
              <a href={result.gitlab.url}>{result.gitlab.url}</a>
              <ul>{filePreview.map((f) => <li key={f.path}><code>{f.path}</code></li>)}</ul>
            </>}
          </section>
        </div>
      </section>
    </main>
  );
}
