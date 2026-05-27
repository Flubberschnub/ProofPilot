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
GEMINI_API_KEY=
ELASTIC_URL=http://localhost:9200
ELASTIC_API_KEY=
GITLAB_TOKEN=
GITLAB_BASE_URL=https://gitlab.com
```

## MVP flow

1. User enters API docs and target scenario.
2. Backend indexes/extracts capabilities.
3. Agent generates a tailored demo plan.
4. Claim checker validates claims against retrieved evidence.
5. Generator creates a React + Node demo package.
6. GitLab exporter returns either a real MR/repo link or a mock export result.

## Next implementation steps

1. Replace mock Gemini calls in `apps/backend/src/services/agent.ts` with Vertex AI / Gemini.
2. Replace mock Elastic store in `apps/backend/src/services/elastic.ts` with Elasticsearch indexing and hybrid search.
3. Replace mock GitLab export in `apps/backend/src/services/gitlab.ts` with GitLab MCP/API calls.
4. Add a build/test loop for generated demo apps.
5. Deploy main ProofPilot app to Cloud Run.
