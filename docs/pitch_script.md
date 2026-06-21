# ProofPilot: 90-Second Demo Pitch Script

**Duration:** ~90 seconds (Word count: ~230 words)  
**Tone:** Energetic, technical, and value-focused

---

### [0:00 - 0:15] Hook & Problem Statement
"Sales engineers waste hours building custom API integrations for sales pitches. Yet, raw API demos feel generic and lack customer context, while unsupported claims lead to integration surprises. 
Meet **ProofPilot**: an agentic platform that automatically turns public API documentation and a target customer scenario into an interactive, source-grounded preview demo."

### [0:15 - 0:40] The Grounding Layer: Elastic
"At the core of ProofPilot is **Elastic**, acting as our source-grounded retrieval layer. 
Elastic indexes both the API documentation and the customer’s business data. When a demo brief is submitted, our agents query Elastic to fetch the exact capabilities, operational friction points, and technical constraints. This is also what powers our **Claims Auditor**—automatically checking every generated capability claim against indexed documentation to label them as *supported*, *inferred*, or *unsupported*."

### [0:40 - 1:10] The Orchestration Layer: Google ADK
"To orchestrate this workflow, we leverage the **Google Agent Development Kit (ADK)**. 
Using ADK’s modular `LlmAgent` and `SkillToolset` interfaces, we built a dynamic skills architecture. Instead of bloating our prompt context with dozens of tools at once, the agent dynamically calls `load_skill` to register capability, planning, or validation tools on-demand. This keeps the token footprint compact and ensures high-accuracy reasoning."

### [1:10 - 1:30] Delivery & Downstream Output
"Finally, ProofPilot generates a high-fidelity, interactive React dashboard, package manifest, and detailed execution trace. With Google ADK orchestrating the reasoning and Elastic grounding the claims, ProofPilot proves your API's value—backed by data."
