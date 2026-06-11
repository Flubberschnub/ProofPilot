---
name: claim-validation
description: Skill for validating generated demo claims against product documentation and customer logs.
compatibility: "*"
metadata:
  adk_additional_tools:
    - search_api_docs
    - search_customer_context
---
# Claim Validation Skill

This skill outlines how to cross-validate claims to avoid hallucinations.

## Instructions
1. Invoke the `search_api_docs` and `search_customer_context` tools to find evidence matching each claim.
2. Label each claim status:
   - `supported`: directly supported by text evidence.
   - `inferred`: reasonable but indirect support.
   - `unsupported`: contradicts or lacks proof in documentation. Write a safer alternative in `rewrite`.
   - `marketing`: qualified impact/value statements. Write a qualified version in `rewrite`.
