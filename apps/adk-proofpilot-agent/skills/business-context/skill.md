---
name: business-context
description: Skill for extracting evidence-linked customer business signals, operational friction, and integration constraints.
compatibility: "*"
metadata:
  adk_additional_tools:
    - search_customer_context
    - find_operational_pain
    - find_integration_constraints
---
# Business Context Extraction Skill

This skill outlines how to process customer-specific business evidence.

## Instructions
1. Invoke the `search_customer_context`, `find_operational_pain`, or `find_integration_constraints` tools to search customer support tickets, database schemas, and workflows.
2. Locate operational friction points (e.g. manual entry bottlenecks, long turnarounds) and system constraints (e.g. Salesforce or CargoWise integration requirements).
3. Extract business signals featuring:
   - Measurable metrics (e.g. "15% error rate", "5 days processing").
   - Impacted business departments.
   - Grounded `evidenceChunkIds` from customer documentation.
