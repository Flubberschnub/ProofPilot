# ProofPilot Elastic Agent Builder + Google ADK on GCP Plan

This document describes how to move ProofPilot from the current TypeScript workflow with direct Elasticsearch retrieval into a proper Elastic Agent Builder + Google Agent Development Kit (ADK) architecture running on GCP.

## Current State

ProofPilot currently has:

- A Vite React frontend for creating a demo brief.
- An Express backend that runs a named agent workflow.
- Direct Elasticsearch support through the Node Elasticsearch client.
- Two source-grounding index families:
  - `proofpilot-doc-chunks` for API documentation.
  - `proofpilot-business-chunks` for proprietary customer context, such as the AeroCore sample data.
- A mock/in-memory retrieval mode for local development.
- Vertex/Gemini model provider support.
- An `adk-compatible` runtime label, but not a real Google ADK `LlmAgent` implementation yet.

The current implementation is useful and demoable, but it is not yet using Elastic Agent Builder tools over MCP, and it is not yet deployed as a true Google ADK agent.

## Target Architecture

```text
ProofPilot UI
  -> ProofPilot Backend
    -> Google ADK ProofPilot Agent
      -> Elastic Agent Builder MCP tools
        -> proofpilot-doc-chunks
        -> proofpilot-business-chunks
        -> proofpilot-demo-memory
    -> ProofPilot package/export generator
```

The target shape keeps ProofPilot's existing frontend, demo package generator, and export logic, but moves the reasoning/retrieval workflow into a real ADK agent that consumes Elastic Agent Builder tools.

## Desired User Flow

1. User enters:
   - API name
   - API docs or docs URL
   - Customer data set or customer data connector
   - Free-form business context
2. ProofPilot indexes or refreshes API docs and customer context in Elastic.
3. A Google ADK agent calls Elastic Agent Builder tools over MCP.
4. Elastic returns grounded API capabilities, business signals, operational pain points, integration constraints, and prior demo memory.
5. ADK produces:
   - ranked demo opportunities
   - selected demo plan
   - evidence-linked claims
   - claim validation report
6. Existing ProofPilot backend generates the demo package and exports/downloads it.
7. Generated idea summaries and claim outcomes are written back into Elastic as reusable memory.

## Elastic Setup

### 1. Create or confirm Elastic Cloud project

Use Elastic Cloud Serverless or an Elastic Cloud deployment. Prefer the Google Cloud region closest to the ProofPilot Cloud Run deployment.

Record:

```bash
ELASTIC_URL=
ELASTIC_API_KEY=
KIBANA_URL=
```

### 2. Enable Elastic Agent Builder

In Kibana:

1. Open the Elasticsearch project.
2. Go to Agent Builder.
3. Enable Agent Builder if needed.
4. Confirm you can access Tools.
5. Copy the MCP server URL from the Tools UI.

Expected endpoint:

```text
{KIBANA_URL}/api/agent_builder/mcp
```

If using a custom Kibana Space:

```text
{KIBANA_URL}/s/{SPACE_NAME}/api/agent_builder/mcp
```

### 3. Create indices

ProofPilot should use these index names:

```bash
ELASTIC_INDEX=proofpilot-doc-chunks
ELASTIC_BUSINESS_INDEX=proofpilot-business-chunks
ELASTIC_MEMORY_INDEX=proofpilot-demo-memory
```

`proofpilot-doc-chunks` stores product/API docs.

`proofpilot-business-chunks` stores customer business data, including documents, support tickets, workflows, schemas, payloads, invoices, pilot records, maintenance logs, and integration specs.

`proofpilot-demo-memory` stores generated ideas, selected plans, scoring outcomes, claim reports, and useful summaries for future retrieval.

### 4. Add index metadata

Elastic Agent Builder works better when index metadata tells the agent what each index is for. Add concise `_meta.description` entries.

Example:

```json
{
  "_meta": {
    "description": "ProofPilot API documentation chunks. Use for questions about API endpoints, authentication, rate limits, supported workflows, integration limitations, and claim validation against product docs. Do not use for customer-specific operational data."
  }
}
```

For `proofpilot-business-chunks`:

```json
{
  "_meta": {
    "description": "ProofPilot proprietary customer business evidence. Use for customer workflows, operational pain, personas, systems, support issues, billing records, maintenance records, compliance artifacts, and integration constraints. Do not use as API product documentation."
  }
}
```

For `proofpilot-demo-memory`:

```json
{
  "_meta": {
    "description": "ProofPilot generated demo memory. Use for prior demo ideas, ranked opportunities, claim validation outcomes, generated plan summaries, and reusable implementation insights."
  }
}
```

## Elastic Agent Builder Tools

Create focused tools rather than one broad search tool.

### Index search tools

Create these Elastic Agent Builder index search tools:

| Tool | Index pattern | Purpose |
| --- | --- | --- |
| `search_api_docs` | `proofpilot-doc-chunks` | Retrieve API docs, endpoints, limitations, authentication, sample payloads, rate limits. |
| `search_customer_context` | `proofpilot-business-chunks` | Retrieve customer-specific business evidence, pain points, workflows, records, and integration constraints. |
| `search_demo_memory` | `proofpilot-demo-memory` | Retrieve prior generated ideas, claim outcomes, and successful demo patterns. |

Tool descriptions should be explicit. Example:

```text
Search API documentation chunks indexed by ProofPilot. Use this when validating what an API can actually do, finding endpoints, checking authentication, or grounding claims in product docs. Do not use for customer business pain or operational context.
```

### ES|QL tools

Create parameterized ES|QL tools for repeatable business retrieval:

#### `find_operational_pain`

Inputs:

- `customer_id`: keyword/string
- `domain`: keyword/string, optional

Purpose:

Return operational pain points, measured metrics, affected departments, and evidence source paths.

Sketch:

```esql
FROM proofpilot-business-chunks
| WHERE metadata.customerId == ?customer_id
| WHERE ?domain == "any" OR metadata.domain == ?domain
| WHERE MATCH(text, "manual OR bottleneck OR delay OR error OR reconciliation OR overdue OR RMA OR support")
| KEEP title, text, metadata.domain, metadata.sourcePath
| LIMIT 10
```

#### `find_integration_constraints`

Inputs:

- `customer_id`
- `target_system`

Purpose:

Find constraints around Salesforce, CargoWise, billing systems, export limitations, middleware, or approval steps.

Sketch:

```esql
FROM proofpilot-business-chunks
| WHERE metadata.customerId == ?customer_id
| WHERE MATCH(text, ?target_system)
| KEEP title, text, metadata.domain, metadata.sourcePath
| LIMIT 10
```

#### `list_supported_api_endpoints`

Inputs:

- `api_name`
- `query`

Purpose:

Find relevant supported endpoints and docs evidence.

Sketch:

```esql
FROM proofpilot-doc-chunks
| WHERE metadata.apiName == ?api_name
| WHERE MATCH(text, ?query)
| KEEP title, text
| LIMIT 10
```

#### `rank_demo_opportunities`

Inputs:

- `customer_id`
- `api_name`

Purpose:

Return candidate opportunities from indexed signals and prior memory. This can initially be a retrieval tool, then become a materialized score in `proofpilot-demo-memory`.

Sketch:

```esql
FROM proofpilot-demo-memory
| WHERE customerId == ?customer_id AND apiName == ?api_name
| SORT score DESC
| KEEP title, summary, score, evidenceChunkIds, createdAt
| LIMIT 5
```

## Elastic MCP Access

Elastic Agent Builder exposes tools over MCP.

Use:

```text
{KIBANA_URL}/api/agent_builder/mcp
```

The Elastic API key used by the MCP client should have:

- `read`
- `view_index_metadata`
- access only to ProofPilot indices
- Kibana Agent Builder read privileges
- expiration date

For development, a wider key may be acceptable briefly. For production, restrict access to:

```text
proofpilot-doc-chunks
proofpilot-business-chunks
proofpilot-demo-memory
```

## Google ADK Agent

### 1. Add an ADK app

Create:

```text
apps/adk-proofpilot-agent/
```

Recommended initial stack:

- Python ADK
- `google-adk`
- MCP support
- Vertex/Gemini model

Suggested files:

```text
apps/adk-proofpilot-agent/
  agent.py
  __init__.py
  requirements.txt
  README.md
```

### 2. Define the ADK root agent

The root agent should be a real ADK `LlmAgent`.

Responsibilities:

- Read compact ProofPilot request.
- Use Elastic MCP tools to retrieve API docs and business context.
- Generate ranked demo opportunities.
- Select or synthesize a final demo plan.
- Validate claims using evidence returned from Elastic.
- Return a JSON result compatible with the existing ProofPilot backend contract.

### 3. Connect ADK to Elastic MCP

There are two viable patterns.

#### Pattern A: Stdio MCP via `mcp-remote`

Use this first if it works cleanly.

Container needs Node/npm installed because `mcp-remote` runs through `npx`.

Concept:

```python
McpToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command="npx",
            args=[
                "-y",
                "mcp-remote",
                os.environ["ELASTIC_MCP_URL"],
                "--header",
                f"Authorization:ApiKey {os.environ['ELASTIC_MCP_API_KEY']}",
            ],
        ),
    ),
    tool_filter=[
        "search_api_docs",
        "search_customer_context",
        "search_demo_memory",
        "find_operational_pain",
        "find_integration_constraints",
        "list_supported_api_endpoints",
        "rank_demo_opportunities",
    ],
)
```

#### Pattern B: Remote MCP / Streamable HTTP

Use this for production if ADK can connect directly to Elastic's MCP endpoint with the supported remote transport.

Concept:

```python
McpToolset(
    connection_params=StreamableHTTPConnectionParams(
        url=os.environ["ELASTIC_MCP_URL"],
        headers={
            "Authorization": f"ApiKey {os.environ['ELASTIC_MCP_API_KEY']}"
        },
    ),
)
```

If Elastic MCP and ADK transport expectations do not line up, deploy a small Cloud Run MCP proxy that adapts between ADK's expected transport and Elastic's MCP endpoint.

## ProofPilot Backend Changes

### 1. Add an ADK provider

Current runtime modes:

```bash
PROOFPILOT_AGENT_RUNTIME=bespoke
PROOFPILOT_AGENT_RUNTIME=adk
```

Today, `adk` only labels the TypeScript runner as ADK-compatible. Replace that behavior with a real remote ADK call.

Add:

```bash
PROOFPILOT_AGENT_RUNTIME=adk
PROOFPILOT_ADK_AGENT_URL=
PROOFPILOT_ADK_AUTH_TOKEN=
```

### 2. Split workflow responsibilities

Keep in TypeScript:

- HTTP API
- frontend-facing response shape
- generated package creation
- zip/export/GitLab/GCS behavior
- local mock mode

Move to ADK:

- capability retrieval
- business-context retrieval
- business-signal extraction
- opportunity ranking
- demo plan generation
- claim validation
- memory write-back

### 3. Preserve the workflow trace

The frontend expects agent traces. The ADK agent should return structured step events:

```json
{
  "agents": [
    {
      "id": "adk-01-intake",
      "name": "Intake Agent",
      "tools": [],
      "inputSummary": "...",
      "outputSummary": "...",
      "status": "passed",
      "durationMs": 123
    }
  ]
}
```

If ADK does not expose the exact shape automatically, wrap ADK calls in ProofPilot-friendly trace events.

## GCP Deployment

### 1. Services

Recommended services:

- `proofpilot-frontend` on Cloud Run
- `proofpilot-backend` on Cloud Run
- `proofpilot-adk-agent` on Agent Runtime or Cloud Run

### 2. Secrets

Store in Secret Manager:

```text
ELASTIC_URL
ELASTIC_API_KEY
ELASTIC_MCP_URL
ELASTIC_MCP_API_KEY
VERTEX_PROJECT_ID
VERTEX_LOCATION
GITLAB_TOKEN
PROOFPILOT_ADK_AUTH_TOKEN
```

### 3. Service accounts

Use separate service accounts:

- frontend invoker account
- backend runtime account
- ADK agent runtime account

Backend account needs:

- invoke ADK service or Agent Runtime
- read needed secrets
- write GCS artifact bucket if enabled

ADK account needs:

- call Vertex/Gemini
- read Elastic MCP secret
- write logs/traces

### 4. Networking

Start with public egress to Elastic Cloud. Later, evaluate:

- Private Service Connect where available.
- Egress restrictions.
- Agent Gateway if the team adopts Gemini Enterprise Agent Platform governance.

## Implementation Milestones

### Milestone 1: Elastic tools are real

Deliverables:

- Elastic Agent Builder enabled.
- Index search tools created.
- ES|QL tools created.
- API key with limited index scope.
- Manual tool test in Kibana Agent Builder playground.

Acceptance:

- `search_customer_context` finds AeroCore billing reconciliation evidence.
- `search_api_docs` finds Acme upload/export limitations.
- `find_integration_constraints` finds Salesforce/CargoWise notes.

### Milestone 2: ADK proof of concept

Deliverables:

- `apps/adk-proofpilot-agent`.
- ADK `LlmAgent` connected to Elastic MCP.
- One command to run locally.

Acceptance:

- Prompt: "Generate AeroCore demo opportunities for Acme Document Extraction API."
- Agent calls Elastic MCP tools.
- Agent returns 3-5 evidence-linked demo ideas.

### Milestone 3: Backend calls ADK

Deliverables:

- `PROOFPILOT_AGENT_RUNTIME=adk` calls the real ADK service.
- Existing frontend still works.
- Existing package generator still works.

Acceptance:

- The frontend compact form generates an AeroCore demo through ADK.
- Claim report cites both API docs and customer evidence.
- Mock/bespoke mode still works locally without GCP.

### Milestone 4: GCP deployment

Deliverables:

- ADK agent deployed to Agent Runtime or Cloud Run.
- Backend deployed with ADK env vars.
- Secrets in Secret Manager.
- CI/CD updated if needed.

Acceptance:

- Public frontend can generate a demo via backend + ADK + Elastic.
- No local-only sample-data dependency required for live mode.
- Logs show ADK tool calls and Elastic MCP retrieval.

### Milestone 5: Demo memory

Deliverables:

- `proofpilot-demo-memory` index.
- Memory write-back tool/workflow.
- Planner retrieves prior ideas.

Acceptance:

- A second run can reuse or improve a prior generated idea.
- Claim outcomes are stored and retrievable.

## Testing Strategy

### Unit tests

- Compact request normalization.
- Customer data indexing metadata.
- ADK response adapter.
- Claim report normalization.

### Integration tests

- Elastic live test behind an opt-in env flag.
- ADK local test using a test Elastic MCP key.
- Backend-to-ADK contract test.

### End-to-end test

Use AeroCore and Acme docs:

```json
{
  "apiName": "Acme Document Extraction API",
  "customerId": "aerocore-leasing",
  "context": "Focus on billing reconciliation, repair logs, lease records, and Salesforce handoff."
}
```

Expected:

- Customer chunks retrieved.
- API docs retrieved.
- Demo plan references AeroCore.
- Claims avoid unsupported direct Salesforce integration language unless evidence supports it.
- Generated package passes package check.

## Open Decisions

1. Use ADK Python first or wait for TypeScript ADK maturity?
   - Recommendation: Python first for MCP maturity and deployment examples.

2. Deploy ADK agent to Agent Runtime or Cloud Run?
   - Recommendation: Cloud Run first if speed matters; Agent Runtime when team wants managed agent sessions, tracing, and platform features.

3. Should ProofPilot ingest customer data directly or only through Elastic connectors?
   - Recommendation: keep direct sample-data ingestion for demos, add Elastic connectors for real enterprise data.

4. Should generated package creation become an ADK tool?
   - Recommendation: not yet. Keep package generation in the backend until ADK planning is stable.

## Useful References

- Elastic Agent Builder MCP server: https://www.elastic.co/docs/explore-analyze/ai-features/agent-builder/mcp-server
- Elastic Agent Builder ES|QL tools: https://www.elastic.co/docs/explore-analyze/ai-features/agent-builder/tools/esql-tools
- Elastic Agent Builder index search tools: https://www.elastic.co/docs/explore-analyze/ai-features/agent-builder/tools/index-search-tools
- Google ADK MCP tools: https://adk.dev/tools-custom/mcp-tools/

