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
VITE_API_BASE_URL=http://localhost:8080 npm run dev
```

Open the frontend URL printed by Vite. The backend defaults to mock mode and does not require real Elastic, Gemini, or GitLab credentials.

For production frontend hosting, set `API_BASE_URL` to the deployed backend URL. The frontend writes that value to `/config.js` at container startup, so the same built image can move between projects or backend services.

## Environment

Backend `.env`:

```bash
PORT=8080
MOCK_MODE=true
PROOFPILOT_AGENT_RUNTIME=bespoke
PROOFPILOT_LOCAL_EXPORT_DIR=../../.generated/demos
PROOFPILOT_EXPORT_BUCKET=
PROOFPILOT_MODEL_PROVIDER=mock
PROOFPILOT_MODEL=gemini-3.5-flash
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
VERTEX_PROJECT_ID=
VERTEX_LOCATION=global
VERTEX_ACCESS_TOKEN=
VERTEX_USE_METADATA_TOKEN=true
VERTEX_MODEL=gemini-3.5-flash
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
GEMINI_MODEL=gemini-3.5-flash
```

Run with Vertex AI:

```bash
MOCK_MODE=false
PROOFPILOT_MODEL_PROVIDER=vertex
VERTEX_PROJECT_ID=your-gcp-project
VERTEX_LOCATION=global
VERTEX_ACCESS_TOKEN="$(gcloud auth print-access-token)" # local only; Cloud Run uses metadata tokens
VERTEX_MODEL=gemini-3.5-flash
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

Set `PROOFPILOT_EXPORT_BUCKET` to upload every generated demo as a zip file to Cloud Storage. Workflow responses include `gitlab.artifact.downloadUrl`, which the frontend renders as a "Download demo zip" link. On Cloud Run this link is served through the private backend at `/api/exports/:id/download`, so the bucket does not need to be public.

## Deploy frontend

The most portable GCP path is two Cloud Run services:

1. Deploy `proofpilot-backend`.
2. Capture its service URL.
3. Deploy `proofpilot-frontend` with `BACKEND_URL` set to the backend URL.

```bash
BACKEND_URL="$(gcloud run services describe proofpilot-backend --region us-central1 --format='value(status.url)')"

gcloud run deploy proofpilot-frontend \
  --source apps/frontend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "BACKEND_URL=$BACKEND_URL"
```

When deployed this way, browser requests go to the frontend service at `/api/*`. The frontend server proxies those requests to the backend. On Cloud Run it obtains an identity token from the metadata server, so the backend can stay private and grant `roles/run.invoker` only to the frontend service account.

For a purely static option, build the frontend with `VITE_API_BASE_URL` set and deploy `apps/frontend/dist` to Firebase Hosting:

```bash
cd apps/frontend
VITE_API_BASE_URL="$BACKEND_URL" npm run build
firebase init hosting
firebase deploy --only hosting
```

## CI/CD with GitHub Actions

The workflow at `.github/workflows/deploy-cloud-run.yml` tests, builds Docker images, pushes them to Artifact Registry, deploys a private backend Cloud Run service, grants backend invoke access to the frontend service account, and deploys a public frontend Cloud Run service.

One-time GCP setup:

```bash
export PROJECT_ID="project-a3a314b8-7fdb-487f-98c"
export REGION="us-central1"
export GITHUB_REPO="Flubberschnub/ProofPilot"
export EXPORT_BUCKET="$PROJECT_ID-proofpilot-exports"
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

gcloud config set project "$PROJECT_ID"

gcloud services enable \
  aiplatform.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  run.googleapis.com \
  storage.googleapis.com \
  sts.googleapis.com

gcloud artifacts repositories create proofpilot \
  --repository-format=docker \
  --location="$REGION" \
  --description="ProofPilot container images"

gcloud storage buckets create "gs://$EXPORT_BUCKET" \
  --location="$REGION" \
  --uniform-bucket-level-access

gcloud iam service-accounts create proofpilot-deployer
gcloud iam service-accounts create proofpilot-backend
gcloud iam service-accounts create proofpilot-frontend
```

Grant runtime permissions:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:proofpilot-backend@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

gcloud storage buckets add-iam-policy-binding "gs://$EXPORT_BUCKET" \
  --member="serviceAccount:proofpilot-backend@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

Grant deployer permissions:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:proofpilot-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:proofpilot-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud iam service-accounts add-iam-policy-binding "proofpilot-backend@$PROJECT_ID.iam.gserviceaccount.com" \
  --member="serviceAccount:proofpilot-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud iam service-accounts add-iam-policy-binding "proofpilot-frontend@$PROJECT_ID.iam.gserviceaccount.com" \
  --member="serviceAccount:proofpilot-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

Configure GitHub Workload Identity Federation:

```bash
gcloud iam workload-identity-pools create github \
  --location="global" \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github \
  --location="global" \
  --workload-identity-pool="github" \
  --display-name="GitHub Actions" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="attribute.repository=='$GITHUB_REPO'"

gcloud iam service-accounts add-iam-policy-binding "proofpilot-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$GITHUB_REPO"
```

Set these GitHub repository variables:

```text
GCP_PROJECT_ID=project-a3a314b8-7fdb-487f-98c
GCP_REGION=us-central1
EXPORT_BUCKET=project-a3a314b8-7fdb-487f-98c-proofpilot-exports
VERTEX_LOCATION=global
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github
GCP_DEPLOYER_SERVICE_ACCOUNT=proofpilot-deployer@PROJECT_ID.iam.gserviceaccount.com
ARTIFACT_REPOSITORY=proofpilot
BACKEND_SERVICE=proofpilot-backend
FRONTEND_SERVICE=proofpilot-frontend
BACKEND_RUNTIME_SERVICE_ACCOUNT=proofpilot-backend@PROJECT_ID.iam.gserviceaccount.com
FRONTEND_RUNTIME_SERVICE_ACCOUNT=proofpilot-frontend@PROJECT_ID.iam.gserviceaccount.com
VERTEX_MODEL=gemini-3.5-flash
```

With the `gh` CLI:

```bash
gh variable set GCP_PROJECT_ID --body "$PROJECT_ID"
gh variable set GCP_REGION --body "$REGION"
gh variable set EXPORT_BUCKET --body "$EXPORT_BUCKET"
gh variable set VERTEX_LOCATION --body "global"
gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --body "projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github"
gh variable set GCP_DEPLOYER_SERVICE_ACCOUNT --body "proofpilot-deployer@$PROJECT_ID.iam.gserviceaccount.com"
gh variable set ARTIFACT_REPOSITORY --body "proofpilot"
gh variable set BACKEND_SERVICE --body "proofpilot-backend"
gh variable set FRONTEND_SERVICE --body "proofpilot-frontend"
gh variable set BACKEND_RUNTIME_SERVICE_ACCOUNT --body "proofpilot-backend@$PROJECT_ID.iam.gserviceaccount.com"
gh variable set FRONTEND_RUNTIME_SERVICE_ACCOUNT --body "proofpilot-frontend@$PROJECT_ID.iam.gserviceaccount.com"
gh variable set VERTEX_MODEL --body "gemini-3.5-flash"
```

After that, every push to `main` or `codex-model-interface-layer` runs the pipeline and deploys both services.

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
