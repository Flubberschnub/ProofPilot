# ProofPilot

ProofPilot generates a custom, source-grounded API demo from product documentation and a buyer scenario.

It is built for sales engineers, solution architects, and technical teams who need to turn "here are our API docs" into "here is a believable demo for this customer" without inventing unsupported claims. A user pastes docs or provides a docs URL, adds customer context, and ProofPilot produces a demo plan, evidence-checked claims, and a downloadable React + Node demo package.

## What it does

ProofPilot takes:

- API documentation as Markdown, OpenAPI-style text, JSON, YAML, pasted docs, or a public docs URL.
- A target customer or business scenario.
- Optional proprietary customer context from `sample-data/<customerId>`.

Then it returns:

- A tailored demo story and screen flow.
- API capabilities extracted from the source docs.
- Customer-specific business signals grounded in sample customer files.
- A claim report showing which claims are supported, inferred, marketing-oriented, or unsupported.
- A generated demo package with frontend, backend, README, and demo script files.
- A local export or optional GitLab project export.

The default local mode is fully offline and deterministic. You do not need Elastic, Gemini, Vertex AI, GitLab, or Google Cloud credentials to run the hackathon demo.

## Why it matters

API demos often drift away from the docs, especially when they are customized for a specific prospect. ProofPilot keeps the customization but adds a review loop:

1. It retrieves evidence from source docs and customer context.
2. It asks agents to create a demo plan from that evidence.
3. It checks generated claims against the retrieved material.
4. It packages the demo so another person can review, run, or hand it off.

That makes the output more useful for a real buyer conversation and easier for a team to trust.

## How the workflow works

ProofPilot runs a seven-step agent pipeline:

1. **Intake Agent** normalizes the request and fetches docs when a URL is provided.
2. **Source Capability Agent** chunks and indexes API docs, then extracts API capabilities.
3. **Business Context Agent** indexes customer sample data and extracts business signals.
4. **Demo Planner Agent** creates a customer-specific demo plan.
5. **Claim Checker Agent** validates generated claims against retrieved evidence.
6. **Package Generator Agent** creates the React + Node demo package.
7. **Export Agent** writes the package locally or exports it to GitLab.

Every workflow response includes an agent trace with status, timing, tools used, input summaries, and output summaries.

## Architecture

```text
React frontend
  -> Express API
      -> agent workflow runner
          -> docs/customer chunking
          -> retrieval adapter: in-memory by default, Elasticsearch optional
          -> model adapter: mock by default, Gemini or Vertex optional
          -> claim checker
          -> template-based demo generator
          -> local, GitLab, and optional GCS artifact export
```

Repository layout:

```text
apps/backend          Express API, agent workflow, adapters, generator
apps/frontend         Vite React user interface
packages/demo-template Generated demo template support
sample-data           Example API docs and AeroCore customer data
docs                  Design and deployment notes
.generated/demos      Local generated demo exports, created at runtime
```

## Quick start

Prerequisites:

- Node.js 20 or newer is recommended.
- npm.

Start the backend:

```bash
cd apps/backend
npm install
cp .env.example .env
npm run dev
```

Start the frontend in a second terminal:

```bash
cd apps/frontend
npm install
VITE_API_BASE_URL=http://localhost:8080 npm run dev
```

On Windows PowerShell, use:

```powershell
cd apps/frontend
npm install
$env:VITE_API_BASE_URL="http://localhost:8080"
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`.

## Run the included demo

The frontend starts with a ready-to-run example:

- API: `Acme Document Extraction API`
- Customer data folder: `aerocore-leasing`
- Scenario: AeroCore wants to reduce manual billing reconciliation, extract invoice and repair-log fields, review lease data, and hand approved records to a Salesforce `Lease_Agreement__c` object.

Click **Generate grounded demo**.

You should see:

- A generated plan with a title, story, screen flow, and API endpoints used.
- Business context signals pulled from `sample-data/aerocore-leasing`.
- An agent pipeline trace showing each step that ran.
- A claim report that rewrites or labels claims based on evidence.
- A generated package summary with the exported files and local path.

In mock mode, generated demo files are written under:

```text
.generated/demos/
```

## Backend API

The main endpoint is:

```http
POST /api/workflow/run
```

Example request:

```json
{
  "apiName": "Acme Document Extraction API",
  "docsText": "# Acme Document Extraction API\n\n## POST /documents/extract\nUploads a PDF, PNG, or JPG for extraction.",
  "customerId": "aerocore-leasing",
  "context": "Focus on manual billing reconciliation, reviewed lease data, and Salesforce handoff.",
  "preferredStack": "React + Node",
  "liveApiAllowed": false
}
```

Useful supporting endpoints:

```http
GET /health
GET /api/agents
GET /api/models/current
GET /api/exports/:objectId/download
```

## Configuration

The backend is controlled through `apps/backend/.env`.

Local hackathon mode:

```bash
PORT=8080
MOCK_MODE=true
PROOFPILOT_AGENT_RUNTIME=bespoke
PROOFPILOT_MODEL_PROVIDER=mock
PROOFPILOT_ELASTIC_PROVIDER=memory
PROOFPILOT_LOCAL_EXPORT_DIR=../../.generated/demos
```

Optional live model providers:

```bash
# Gemini API
MOCK_MODE=false
PROOFPILOT_MODEL_PROVIDER=gemini
GEMINI_API_KEY=your-api-key
GEMINI_MODEL=gemini-3.5-flash

# Vertex AI
MOCK_MODE=false
PROOFPILOT_MODEL_PROVIDER=vertex
VERTEX_PROJECT_ID=your-gcp-project
VERTEX_LOCATION=global
VERTEX_MODEL=gemini-3.5-flash
```

Optional Elasticsearch retrieval:

```bash
PROOFPILOT_ELASTIC_PROVIDER=elastic
ELASTIC_URL=http://localhost:9200
ELASTIC_API_KEY=your-api-key
ELASTIC_INDEX=proofpilot-doc-chunks
ELASTIC_BUSINESS_INDEX=proofpilot-business-chunks
```

Optional GitLab export:

```bash
MOCK_MODE=false
GITLAB_TOKEN=your-token
GITLAB_BASE_URL=https://gitlab.com
GITLAB_NAMESPACE_ID=optional-group-or-user-id
GITLAB_BRANCH=main
GITLAB_VISIBILITY=private
```

Optional Cloud Storage artifact export:

```bash
PROOFPILOT_EXPORT_BUCKET=your-gcs-bucket
```

When `PROOFPILOT_EXPORT_BUCKET` is set, generated demo packages are uploaded as zip files and served through the backend download endpoint.

## What is generated

Each generated demo package includes:

- A demo README.
- A demo script.
- A React frontend.
- A small Node backend.
- Package metadata.
- A claim report connected to the source evidence.

The package is intended as a reviewable starting point, not a production application. It gives a sales or solution team a concrete demo scaffold they can inspect, refine, and present.

## Testing and builds

Backend:

```bash
cd apps/backend
npm test
npm run build
```

Frontend:

```bash
cd apps/frontend
npm run build
```

## Deployment notes

The project includes Dockerfiles for both apps and a GitHub Actions workflow at:

```text
.github/workflows/deploy-cloud-run.yml
```

The intended cloud shape is two Cloud Run services:

- `proofpilot-backend`: private API service.
- `proofpilot-frontend`: public frontend service that proxies `/api/*` requests to the backend.

For implementation details and next-step architecture notes, see:

- `docs/elastic-adk-gcp-plan.md`
- `docs/ui-design-direction.md`

## Hackathon judging guide

Good things to inspect:

- The app runs locally without external services.
- The generated plan changes when docs or customer context change.
- Customer signals come from `sample-data/aerocore-leasing`.
- The claim checker distinguishes supported claims from softer marketing language.
- The agent trace exposes how the result was produced.
- The generated package can be reviewed as files instead of only as chat output.

The core idea is not just "generate a demo." It is "generate a demo that can explain where its claims came from."
