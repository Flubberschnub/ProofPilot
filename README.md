# ProofPilot — Agentic API Demo Generator

ProofPilot turns API documentation plus a target business scenario into a source-grounded, reviewable API demo package.

This scaffold includes:

- `apps/backend` — Express backend with agent workflow routes, Elastic retrieval adapter, GitLab export adapter, and template-based demo generation.
- `apps/frontend` — Vite React UI for creating a demo brief, reviewing a plan, checking claims, and exporting artifacts.
- `packages/demo-template` — generated demo app template files.
- `sample-data` — sample Document Extraction API docs and scenario.

## Intended hackathon story

Elastic is the source-grounded retrieval layer. It indexes API docs, retrieves relevant capabilities and evidence snippets, and powers claim validation.

GitLab is the packaging layer. It stores generated demo repos/MRs for review by sales engineers, solution architects, or technical buyers.

## Quick start

Run backend:

```bash
cd apps/backend
npm install
cp .env.example .env
npm run dev
```

Run frontend:

```bash
cd apps/frontend
npm install
npm run dev
```

Open the frontend URL printed by Vite. The backend defaults to mock mode and does not require real Elastic, Gemini, or GitLab credentials.

## Environment

Backend `.env`:

```bash
PORT=8080
MOCK_MODE=true
PROOFPILOT_AGENT_RUNTIME=bespoke
PROOFPILOT_LOCAL_EXPORT_DIR=../../.generated/demos
PROOFPILOT_MODEL_PROVIDER=mock
PROOFPILOT_MODEL=gemini-2.0-flash
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
VERTEX_PROJECT_ID=
VERTEX_LOCATION=us-central1
VERTEX_ACCESS_TOKEN=
VERTEX_MODEL=gemini-2.0-flash
PROOFPILOT_ELASTIC_PROVIDER=memory
ELASTIC_URL=http://localhost:9200
ELASTIC_API_KEY=
ELASTIC_INDEX=proofpilot-doc-chunks
GITLAB_TOKEN=
GITLAB_BASE_URL=https://gitlab.com
GITLAB_NAMESPACE_ID=
GITLAB_BRANCH=main
GITLAB_VISIBILITY=private
```

## Agent runtime

The MVP workflow is implemented as six named agents that match the flow below. `GET /api/agents` returns the current agent catalog, and every workflow run returns an `agents` trace with inputs, outputs, tools, status, and timing.

The default runtime is:

```bash
PROOFPILOT_AGENT_RUNTIME=bespoke
```

This uses ProofPilot's TypeScript agent runner plus the configured model client (`mock`, `gemini`, or `vertex`). You can also set:

```bash
PROOFPILOT_AGENT_RUNTIME=adk
```

That mode keeps the same step-agent shape and labels the run as ADK-compatible. The code is structured so the agents can be moved to the Google Agent Development Kit TypeScript `LlmAgent` model later without changing the workflow contract.

## Model providers

The backend uses `apps/backend/src/models` as a provider-neutral model interface. The workflow calls the selected `ModelClient` for:

- API capability extraction
- demo plan generation
- claim validation against retrieved evidence

Supported providers:

- `mock`: deterministic local heuristics, good for offline development.
- `gemini`: calls the Gemini API with `GEMINI_API_KEY`.
- `vertex`: calls Vertex AI Gemini models with `VERTEX_PROJECT_ID`, `VERTEX_LOCATION`, and `VERTEX_ACCESS_TOKEN`.

Run in mock mode:

```bash
MOCK_MODE=true
PROOFPILOT_MODEL_PROVIDER=mock
```

Run with the Gemini API:

```bash
MOCK_MODE=false
PROOFPILOT_MODEL_PROVIDER=gemini
GEMINI_API_KEY=your-api-key
GEMINI_MODEL=gemini-2.0-flash
```

Run with Vertex AI:

```bash
MOCK_MODE=false
PROOFPILOT_MODEL_PROVIDER=vertex
VERTEX_PROJECT_ID=your-gcp-project
VERTEX_LOCATION=us-central1
VERTEX_ACCESS_TOKEN="$(gcloud auth print-access-token)"
VERTEX_MODEL=gemini-2.0-flash
```

The current provider is visible at `GET /api/models/current` and is included in every workflow result under `model`.

## Retrieval and export adapters

By default, retrieval uses the in-memory adapter so local runs require no services:

```bash
PROOFPILOT_ELASTIC_PROVIDER=memory
```

To use Elasticsearch:

```bash
PROOFPILOT_ELASTIC_PROVIDER=elastic
ELASTIC_URL=http://localhost:9200
ELASTIC_API_KEY=your-api-key
ELASTIC_INDEX=proofpilot-doc-chunks
```

Mock GitLab export writes the generated demo package to `.generated/demos/<repo-name>` and returns that local path in the workflow result. To create a real GitLab project and commit the generated files:

```bash
MOCK_MODE=false
GITLAB_TOKEN=your-token
GITLAB_BASE_URL=https://gitlab.com
GITLAB_NAMESPACE_ID=optional-group-or-user-id
```

## MVP flow

1. User enters API docs and target scenario.
2. Backend indexes/extracts capabilities.
3. Agent generates a tailored demo plan.
4. Claim checker validates claims against retrieved evidence.
5. Generator creates a React + Node demo package.
6. GitLab exporter returns either a real MR/repo link or a mock export result.

Implemented agent mapping:

1. `Intake Agent`
2. `Source Capability Agent`
3. `Demo Planner Agent`
4. `Claim Checker Agent`
5. `Package Generator Agent`
6. `Export Agent`

## Next implementation steps

1. Add long-lived Vertex auth through Google ADC or a service-account token flow.
2. Replace the ADK-compatible runner with real Google ADK `LlmAgent` instances when the Node/npm runtime is ready for `@google/adk`.
3. Add hybrid vector retrieval and capability metadata fields to the Elasticsearch adapter.
4. Add a live build/test sandbox for generated demo apps.
5. Deploy main ProofPilot app to Cloud Run.
