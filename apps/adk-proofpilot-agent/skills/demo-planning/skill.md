---
name: demo-planning
description: Skill for synthesizing customized, screen-by-screen API demo plans and storylines.
compatibility: "*"
metadata:
  adk_additional_tools:
    - search_demo_memory
    - rank_demo_opportunities
---
# Demo Planning Skill

This skill outlines how to build a tailored demo plan based on API capabilities and customer business pain.

## Instructions
1. Invoke the `search_demo_memory` or `rank_demo_opportunities` tools to find prior successful demo patterns or relevant opportunities.
2. Structure a screen-by-screen demo plan, aligning each screen with the customer's personas (e.g. Sarah Jenkins, Billing Administrator) and target workflows.
3. Formulate a list of testable claims about what the API can accomplish to solve the customer's bottlenecks.

### Critical Constraints on Memory Results
- Prior demo memory results retrieved from `search_demo_memory` or `rank_demo_opportunities` are strictly for structural reference, ideas, and API endpoint alignment.
- **NEVER** copy the customer name (e.g. "GridPulse Renewables"), industry, specific scenarios (e.g. "Solar Yield & Wind Safety"), or storylines of prior demos retrieved from memory.
- You **MUST** strictly preserve and utilize the current request's target customer name (`customerId`, e.g. "Aerocore Leasing" or "aerocore-leasing"), customer business context, target persona, target system, goals, and industry (e.g. "Aviation") in the generated demo plan title, story, and screens.
