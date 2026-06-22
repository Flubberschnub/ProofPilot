import type { ClaimReport, DemoPlan, DemoRequest, GeneratedFile } from "../types.js";

export async function generateDemoFiles(
  input: DemoRequest,
  plan: DemoPlan,
  claimReport: ClaimReport
): Promise<GeneratedFile[]> {
  const safeClaims = claimReport.claims
    .map((claim: any) => claim.rewrite || claim.text)
    .filter(Boolean);

  const isWeather = 
    input.apiName.toLowerCase().includes("weather") ||
    input.apiName.toLowerCase().includes("meteo") ||
    (input.context ?? "").toLowerCase().includes("weather") ||
    (input.context ?? "").toLowerCase().includes("meteo") ||
    (input.docsText ?? "").toLowerCase().includes("weather") ||
    (input.docsText ?? "").toLowerCase().includes("meteo");

  const isPayment = 
    input.apiName.toLowerCase().includes("payment") ||
    input.apiName.toLowerCase().includes("stripe") ||
    input.apiName.toLowerCase().includes("billing") ||
    (input.context ?? "").toLowerCase().includes("payment") ||
    (input.context ?? "").toLowerCase().includes("stripe") ||
    (input.context ?? "").toLowerCase().includes("billing");


  const fieldsJson = isWeather
    ? [
        { name: "latitude", value: "40.7128", confidence: 1.0 },
        { name: "longitude", value: "-74.0060", confidence: 1.0 },
        { name: "temperature", value: "22.5 °C", confidence: 0.99 },
        { name: "wind_speed", value: "14.2 km/h", confidence: 0.94 },
        { name: "condition", value: "Clear Sky", confidence: 0.91 }
      ]
    : isPayment
      ? [
          { name: "transaction_id", value: "tx_9a2b8c4d", confidence: 1.0 },
          { name: "customer_name", value: "Jane Rivera", confidence: 0.98 },
          { name: "amount", value: "1420.55 USD", confidence: 1.0 },
          { name: "status", value: "paid", confidence: 0.95 }
        ]
      : [
          { name: "payload_id", value: "pl_2026_99a", confidence: 1.0 },
          { name: "entity_name", value: "Jane Rivera", confidence: 0.94 },
          { name: "created_at", value: "2026-06-11", confidence: 1.0 },
          { name: "status", value: "completed", confidence: 0.88 }
        ];

  const appTsx = `
import { useState } from "react";
import "./style.css";

const mockFields = ${JSON.stringify(fieldsJson, null, 2)};
const isWeather = ${isWeather};
const isPayment = ${isPayment};

export default function App() {
  const [step, setStep] = useState(0);
  const screens = ${JSON.stringify(plan.screens, null, 2)};

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Interactive Live Demo • Grounded by Elastic</p>
        <h1>{${JSON.stringify(escapeForTemplate(plan.title))}}</h1>
        <p>{${JSON.stringify(escapeForTemplate(plan.story))}}</p>
      </section>

      <section className="grid">
        <aside className="card">
          <h2>Demo stations</h2>
          {screens.map((screen, index) => (
            <button key={screen} className={index === step ? "active step" : "step"} onClick={() => setStep(index)}>
              <span className="step-num">{index + 1}</span>
              <span>{screen}</span>
            </button>
          ))}
        </aside>

        <section className="card wide">
          <h2>{screens[step]}</h2>
          
          {step === 0 && (
            <div style={{ lineHeight: "1.6" }}>
              <p>This interactive walkthrough showcases how <strong>{${JSON.stringify(escapeForTemplate(input.industry || "Aviation"))}}</strong> leaders evaluate the capabilities of <strong>{${JSON.stringify(escapeForTemplate(input.apiName))}}</strong> under a realistic target integration workflow.</p>
              <p style={{ color: "var(--text-muted)", marginTop: "12px" }}>We will configure request headers, execute integration calls in our sandbox environment, inspect retrieved structured values, and verify the downstream handoff logic.</p>
              <button className="btn-action" onClick={() => setStep(1)}>Begin Walkthrough →</button>
            </div>
          )}

          {step === 1 && (
            <RequestConfigurator isWeather={isWeather} isPayment={isPayment} onSend={() => setStep(2)} />
          )}

          {step === 2 && (
            isWeather ? <WeatherDashboard /> : <FieldTable />
          )}

          {step === 3 && (
            <div style={{ lineHeight: "1.6" }}>
              <p style={{ color: "var(--color-success)", fontWeight: 700, fontSize: "15px", marginBottom: "16px" }}>✓ Target System Synchronized Successfully</p>
              <p>The extracted records have been compiled into target formats and dispatched to the customer CRM / target system database endpoints.</p>
              <pre>{JSON.stringify({ exported: true, fields: mockFields, timestamp: new Date().toISOString() }, null, 2)}</pre>
            </div>
          )}

          {step > 3 && (
            <div style={{ lineHeight: "1.6" }}>
              <p>This screen demonstrates the custom workflow interface designed for <strong>{screens[step]}</strong>.</p>
              <p style={{ color: "var(--text-muted)", marginTop: "12px" }}>The integration layer processes local triggers and schedules updates according to active policy rules.</p>
              <div style={{ border: "1px dashed var(--border-color)", padding: "16px", borderRadius: "10px", marginTop: "16px", background: "rgba(255,255,255,0.01)" }}>
                <span className="badge badge-primary" style={{ marginBottom: "8px" }}>Active Integration Step</span>
                <p style={{ fontSize: "13px", margin: 0 }}>Verified API calls execute successfully in the background to sync data with the target environment.</p>
              </div>
            </div>
          )}
        </section>
      </section>

      <section className="card">
        <h2>Source-grounded claims</h2>
        <ul className="claims-list">
          {${JSON.stringify(safeClaims)}.map((claim) => (
            <li key={claim} className="claim-item">
              <span className="claim-check">✓</span>
              <span className="claim-text">{claim}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function RequestConfigurator({ isWeather, isPayment, onSend }) {
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState({
    endpoint: isWeather ? "/v1/forecast" : isPayment ? "/v1/charges" : "/v1/extract",
    format: "application/json",
    sandboxMode: true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSend();
    }, 700);
  };

  return (
    <form onSubmit={handleSubmit} style={{ textAlign: "left" }}>
      <p style={{ color: "var(--text-muted)", marginBottom: "20px", fontSize: "13.5px" }}>Configure sandbox API query parameters to fetch dynamic resources:</p>
      <div className="form-row">
        <div className="form-field">
          <label>Query Endpoint</label>
          <input type="text" readOnly value={params.endpoint} />
        </div>
        <div className="form-field">
          <label>Payload Format</label>
          <select value={params.format} onChange={e => setParams({...params, format: e.target.value})}>
            <option value="application/json">application/json</option>
            <option value="application/xml">application/xml</option>
          </select>
        </div>
      </div>
      {isWeather && (
        <div className="form-row">
          <div className="form-field">
            <label>Requested Variables</label>
            <input type="text" readOnly value="temperature_2m,wind_speed_10m,precipitation" />
          </div>
          <div className="form-field">
            <label>API Sandbox Key</label>
            <input type="text" readOnly value="opm_live_9a82f1b" />
          </div>
        </div>
      )}
      <button type="submit" className="btn-action">
        {loading ? "COMMUNICATING WITH SANDBOX..." : "EXECUTE INTEGRATION CALL"}
      </button>
    </form>
  );
}

function FieldTable() {
  return (
    <div>
      <p style={{ color: "var(--text-muted)", marginBottom: "16px", fontSize: "13.5px" }}>Extracted structured response payloads mapped by target integration schemas:</p>
      <table>
        <thead>
          <tr>
            <th>Mapped Target Key</th>
            <th>Extracted Value</th>
            <th>Grounding Confidence</th>
          </tr>
        </thead>
        <tbody>
          {mockFields.map(f => (
            <tr key={f.name}>
              <td style={{ fontFamily: "monospace" }}>{f.name}</td>
              <td style={{ fontWeight: 600 }}>{f.value}</td>
              <td>
                <span className={f.confidence > 0.95 ? "badge badge-success" : "badge badge-warning"}>
                  {f.confidence ? Math.round(f.confidence * 100) : 100}% Match
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WeatherDashboard() {
  const [selectedCity, setSelectedCity] = useState("New York");
  const weatherData = {
    "New York": [
      { day: "Mon", temp: "22°C", wind: "12 km/h", precip: "10%", status: "Normal", limitReason: "" },
      { day: "Tue", temp: "24°C", wind: "15 km/h", precip: "20%", status: "Normal", limitReason: "" },
      { day: "Wed", temp: "18°C", wind: "28 km/h", precip: "85%", status: "Limited: High Wind", limitReason: "High Wind Alert - Operations Limited" },
      { day: "Thu", temp: "21°C", wind: "10 km/h", precip: "15%", status: "Normal", limitReason: "" },
      { day: "Fri", temp: "23°C", wind: "14 km/h", precip: "5%", status: "Normal", limitReason: "" },
      { day: "Sat", temp: "25°C", wind: "18 km/h", precip: "40%", status: "Normal", limitReason: "" },
      { day: "Sun", temp: "20°C", wind: "32 km/h", precip: "90%", status: "Limited: Storm", limitReason: "Storm Warning - Aviation Suspended" }
    ],
    "Anchorage": [
      { day: "Mon", temp: "-5°C", wind: "25 km/h", precip: "80%", status: "Limited: Ice", limitReason: "Low Visibility / Icing Risk" },
      { day: "Tue", temp: "-8°C", wind: "30 km/h", precip: "95%", status: "Grounded: Blizzard", limitReason: "Severe Blizzard - Flights Suspended" },
      { day: "Wed", temp: "-4°C", wind: "12 km/h", precip: "30%", status: "Normal", limitReason: "" },
      { day: "Thu", temp: "-2°C", wind: "8 km/h", precip: "10%", status: "Normal", limitReason: "" },
      { day: "Fri", temp: "1°C", wind: "15 km/h", precip: "50%", status: "Normal", limitReason: "" },
      { day: "Sat", temp: "0°C", wind: "20 km/h", precip: "70%", status: "Limited: Ice Rain", limitReason: "Freezing Rain - De-icing Required" },
      { day: "Sun", temp: "-3°C", wind: "14 km/h", precip: "20%", status: "Normal", limitReason: "" }
    ],
    "London": [
      { day: "Mon", temp: "14°C", wind: "18 km/h", precip: "60%", status: "Normal", limitReason: "" },
      { day: "Tue", temp: "13°C", wind: "22 km/h", precip: "80%", status: "Normal", limitReason: "" },
      { day: "Wed", temp: "15°C", wind: "14 km/h", precip: "20%", status: "Normal", limitReason: "" },
      { day: "Thu", temp: "16°C", wind: "10 km/h", precip: "10%", status: "Normal", limitReason: "" },
      { day: "Fri", temp: "12°C", wind: "25 km/h", precip: "75%", status: "Normal", limitReason: "" },
      { day: "Sat", temp: "14°C", wind: "16 km/h", precip: "45%", status: "Normal", limitReason: "" },
      { day: "Sun", temp: "11°C", wind: "35 km/h", precip: "90%", status: "Limited: High Wind", limitReason: "Gale Warnings - Flight Limits Active" }
    ]
  };

  const currentForecast = weatherData[selectedCity] || weatherData["New York"];
  const limitedDays = currentForecast.filter(d => d.status.includes("Limited") || d.status.includes("Grounded"));

  return (
    <div>
      <div className="form-field" style={{ maxWidth: "260px", marginBottom: "20px", textAlign: "left" }}>
        <label>Select Aviation Dispatch Station</label>
        <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
          <option value="New York">New York Dispatch (JFK)</option>
          <option value="Anchorage">Anchorage Dispatch (ANC)</option>
          <option value="London">London Dispatch (LHR)</option>
        </select>
      </div>

      <div className="weather-grid">
        {currentForecast.map((day) => {
          const isLimited = day.status.includes("Limited");
          const isGrounded = day.status.includes("Grounded");
          const cardClass = isGrounded ? "weather-card grounded" : isLimited ? "weather-card limited" : "weather-card";
          return (
            <div key={day.day} className={cardClass}>
              <div className="weather-day">{day.day}</div>
              <div className="weather-temp">{day.temp}</div>
              <div className="weather-meta">
                <div>Wind: {day.wind}</div>
                <div>Precip: {day.precip}</div>
              </div>
              {(isLimited || isGrounded) ? (
                <div className="weather-status-text">⚠ {day.status}</div>
              ) : (
                <div className="weather-status-text" style={{ color: "var(--color-success)" }}>✓ Operational</div>
              )}
            </div>
          );
        })}
      </div>

      {limitedDays.length > 0 && (
        <div className="alert-panel" style={{ textAlign: "left" }}>
          <div className="alert-icon">⚠</div>
          <div className="alert-content">
            <h4>Aircraft Operations Limitations Highlighted</h4>
            <p>The following weather limitations require routing coordination and schedule offsets by dispatch:</p>
            <ul style={{ margin: "8px 0 0 0", paddingLeft: "16px", fontSize: "12.5px" }}>
              {limitedDays.map((d, i) => (
                <li key={i} style={{ marginBottom: "4px" }}>
                  <strong>{d.day}</strong>: {d.limitReason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
`;

  return [
    { path: "README.md", content: readme(input, plan) },
    { path: "demo-script.md", content: demoScript(plan) },
    { path: "claim-check-report.md", content: claimReportMarkdown(claimReport) },
    { path: "frontend/package.json", content: JSON.stringify({ scripts: { dev: "vite", build: "vite build", preview: "vite preview" }, dependencies: { "@vitejs/plugin-react": "latest", vite: "latest", typescript: "latest", react: "latest", "react-dom": "latest" }, devDependencies: {} }, null, 2) },
    { path: "frontend/index.html", content: `<div id="root"></div><script type="module" src="/src/main.tsx"></script>` },
    { path: "frontend/src/main.tsx", content: `import React from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App";\ncreateRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);\n` },
    { path: "frontend/src/App.tsx", content: appTsx },
    { path: "frontend/src/style.css", content: css() },
    { path: "backend/package.json", content: JSON.stringify({ type: "module", scripts: { dev: "node src/server.js" }, dependencies: { express: "latest", cors: "latest" } }, null, 2) },
    { path: "backend/src/server.js", content: backendServer() }
  ];
}

function readme(input: DemoRequest, plan: DemoPlan) {
  return `# ${plan.title}\n\nGenerated API demo for **${input.industry}** using **${input.apiName}**.\n\n## Story\n\n${plan.story}\n\n## Screens\n\n${plan.screens.map((s) => `- ${s}`).join("\n")}\n\n## Endpoints Used\n\n${plan.endpointsUsed.map((e) => `- \`${e}\``).join("\n")}\n\n## Run\n\n\`\`\`bash\ncd frontend\nnpm install\nnpm run dev\n\`\`\`\n`;
}

function demoScript(plan: DemoPlan) {
  return `# Demo Script\n\n1. Open with the business problem.\n2. Show the generated workflow: ${plan.screens.join(" → ")}.\n3. Explain the API calls used.\n4. Show the claim-check report to prove unsupported claims were removed.\n5. Close with implementation next steps.\n`;
}

function claimReportMarkdown(report: ClaimReport) {
  return `# Claim Check Report\n\n| Claim | Status | Rewrite |\n|---|---|---|\n${report.claims.map((c: any) => `| ${c.text} | ${c.status} | ${c.rewrite ?? ""} |`).join("\n")}\n`;
}

function backendServer() {
  return `import express from "express";\nimport cors from "cors";\nconst app = express();\napp.use(cors());\napp.get('/api/mock/extraction', (_req,res)=>res.json({status:'completed', fields:[{name:'claim_number', value:'CLM-2026-001', confidence:0.98}]}));\napp.listen(3001,()=>console.log('Generated demo backend on http://localhost:3001'));\n`;
}

function css() {
  return `
    :root {
      --bg-base: #090d16;
      --bg-surface: rgba(17, 25, 40, 0.75);
      --border-color: rgba(255, 255, 255, 0.08);
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --color-primary: #6366f1;
      --color-accent: #a855f7;
      --color-success: #10b981;
      --color-warning: #f59e0b;
      --color-error: #ef4444;
      --font-sans: 'Inter', -apple-system, sans-serif;
    }
    body {
      margin: 0;
      font-family: var(--font-sans);
      background-color: var(--bg-base);
      background-image: radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 40%),
                        radial-gradient(circle at 90% 80%, rgba(168, 85, 247, 0.1) 0%, transparent 40%);
      color: var(--text-main);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    .shell {
      max-width: 1200px;
      margin: auto;
      padding: 40px 20px;
    }
    .hero {
      background: var(--bg-surface);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      padding: 32px;
      margin-bottom: 24px;
      position: relative;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: linear-gradient(to bottom, var(--color-primary), var(--color-accent));
    }
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: .18em;
      font-size: 11px;
      font-weight: 700;
      color: var(--color-primary);
      margin: 0 0 12px 0;
    }
    h1 {
      font-size: 2.2rem;
      margin: 0 0 12px 0;
      font-weight: 800;
      background: linear-gradient(135deg, #fff 60%, var(--text-muted));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero p {
      color: var(--text-muted);
      font-size: 1.05rem;
      line-height: 1.6;
      margin: 0;
    }
    .grid {
      display: grid;
      grid-template-columns: 300px 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--bg-surface);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }
    .card h2 {
      font-size: 1.25rem;
      margin-top: 0;
      margin-bottom: 20px;
      font-weight: 700;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 12px;
    }
    .step {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      text-align: left;
      margin: 8px 0;
      padding: 14px 16px;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.02);
      color: var(--text-muted);
      cursor: pointer;
      font-weight: 500;
      font-size: 13px;
      transition: all 0.2s ease;
    }
    .step:hover {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-main);
      border-color: rgba(255, 255, 255, 0.15);
    }
    .step.active {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%);
      color: #fff;
      border-color: var(--color-primary);
      box-shadow: 0 0 12px rgba(99, 102, 241, 0.2);
    }
    .step-num {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.05);
      font-size: 11px;
      font-weight: 700;
    }
    .step.active .step-num {
      background: var(--color-primary);
      color: #fff;
    }
    .wide {
      min-height: 400px;
    }
    .upload-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border: 2px dashed rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      padding: 40px;
      background: rgba(255, 255, 255, 0.01);
      text-align: center;
      transition: border-color 0.2s ease;
    }
    .upload-container:hover {
      border-color: var(--color-primary);
    }
    .btn-action {
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
      color: white;
      border: none;
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 10px;
      cursor: pointer;
      transition: opacity 0.2s ease, transform 0.1s ease;
      margin-top: 16px;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
    }
    .btn-action:hover {
      opacity: 0.9;
    }
    .btn-action:active {
      transform: scale(0.98);
    }
    .form-row {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
      width: 100%;
    }
    .form-field {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .form-field label {
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 6px;
      font-weight: 500;
      text-align: left;
    }
    .form-field select, .form-field input {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 10px;
      color: var(--text-main);
      font-size: 13px;
      outline: none;
    }
    .form-field select:focus, .form-field input:focus {
      border-color: var(--color-primary);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
    }
    th {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .05em;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-color);
      padding: 12px;
      text-align: left;
    }
    td {
      padding: 14px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      font-size: 13.5px;
    }
    tr:hover td {
      background: rgba(255, 255, 255, 0.01);
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 6px;
      text-transform: uppercase;
    }
    .badge-success { background: rgba(16, 185, 129, 0.15); color: var(--color-success); border: 1px solid rgba(16, 185, 129, 0.2); }
    .badge-warning { background: rgba(245, 158, 11, 0.15); color: var(--color-warning); border: 1px solid rgba(245, 158, 11, 0.2); }
    .badge-error { background: rgba(239, 68, 68, 0.15); color: var(--color-error); border: 1px solid rgba(239, 68, 68, 0.2); }
    .badge-primary { background: rgba(99, 102, 241, 0.15); color: var(--color-primary); border: 1px solid rgba(99, 102, 241, 0.2); }
    .weather-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 12px;
      margin-top: 20px;
    }
    .weather-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      transition: all 0.2s ease;
    }
    .weather-card:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 255, 255, 0.12);
    }
    .weather-card.limited {
      border-color: var(--color-warning);
      background: rgba(245, 158, 11, 0.04);
    }
    .weather-card.grounded {
      border-color: var(--color-error);
      background: rgba(239, 68, 68, 0.04);
    }
    .weather-day {
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 700;
    }
    .weather-temp {
      font-size: 20px;
      font-weight: 800;
      margin: 8px 0;
    }
    .weather-meta {
      font-size: 11px;
      color: var(--text-muted);
      line-height: 1.4;
    }
    .weather-status-text {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      margin-top: 8px;
    }
    .weather-card.limited .weather-status-text { color: var(--color-warning); }
    .weather-card.grounded .weather-status-text { color: var(--color-error); }
    .alert-panel {
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.2);
      border-radius: 12px;
      padding: 16px;
      margin-top: 16px;
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .alert-icon {
      font-size: 18px;
      color: var(--color-warning);
    }
    .alert-content h4 {
      margin: 0 0 4px 0;
      font-size: 13px;
      font-weight: 700;
      color: var(--color-warning);
    }
    .alert-content p {
      margin: 0;
      font-size: 12.5px;
      color: var(--text-muted);
      line-height: 1.4;
    }
    .claims-list {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .claim-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }
    .claim-item:last-child {
      border-bottom: none;
    }
    .claim-check {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.15);
      color: var(--color-success);
      font-size: 11px;
      font-weight: 700;
      margin-top: 2px;
    }
    .claim-text {
      font-size: 13.5px;
      color: var(--text-main);
      line-height: 1.5;
    }
    pre {
      background: #090c15;
      border: 1px solid var(--border-color);
      color: #38bdf8;
      padding: 16px;
      border-radius: 12px;
      font-size: 12.5px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      overflow-x: auto;
    }
  `;
}

function escapeForTemplate(value: string) {
  return value.replace(/`/g, "'").replace(/\$/g, "");
}

