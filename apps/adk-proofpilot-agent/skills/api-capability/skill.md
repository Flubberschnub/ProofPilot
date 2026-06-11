---
name: api-capability
description: Skill for extracting evidence-grounded API capabilities from product documentation.
compatibility: "*"
metadata:
  adk_additional_tools:
    - search_api_docs
    - list_supported_api_endpoints
---
# API Capability Extraction Skill

This skill outlines how to process API documentation and extract capabilities.

## Instructions
1. Invoke the `search_api_docs` or `list_supported_api_endpoints` tool to find endpoints, authentication rules, rate limits, and supported parameters.
2. Group the findings into high-level logical capabilities.
3. For each capability, identify:
   - A descriptive name and plain-language description.
   - The associated endpoints (formatted as `METHOD /path`).
   - Downstream business use cases (e.g. "claim intake", "invoice processing").
   - The matching source chunks (`evidenceChunkIds`) that directly verify the capability exists.
