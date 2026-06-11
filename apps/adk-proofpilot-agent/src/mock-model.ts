import { BaseLlm } from "@google/adk";

export class MockLlm extends BaseLlm {
  constructor() {
    super({ model: "mock-gemini-flash" });
  }

  async connect(llmRequest: any): Promise<any> {
    return {
      send: async () => {},
      close: async () => {},
      on: () => {}
    };
  }

  async *generateContentAsync(llmRequest: any, stream = false, abortSignal?: AbortSignal) {
    const sysInst = llmRequest?.config?.systemInstruction || llmRequest?.systemInstruction || "";
    const sysText = typeof sysInst === "string" ? sysInst : JSON.stringify(sysInst);
    const contents = llmRequest.contents || [];
    const lastContent = contents[contents.length - 1];
    const text = lastContent?.parts?.map((p: any) => p.text || "").join("") || "";

    let responseText = "";
    const isWeather = text.toLowerCase().includes("meteo") || text.toLowerCase().includes("weather") || sysText.toLowerCase().includes("weather") || sysText.toLowerCase().includes("meteo");
    const isPayment = text.toLowerCase().includes("payment") || text.toLowerCase().includes("stripe") || text.toLowerCase().includes("billing") || sysText.toLowerCase().includes("payment") || sysText.toLowerCase().includes("stripe") || sysText.toLowerCase().includes("billing");

    if (text.includes("Extract API capabilities") || text.includes("CapabilityExtraction")) {
      if (isWeather) {
        responseText = JSON.stringify({
          capabilities: [
            {
              name: "Retrieve real-time weather forecasts",
              description: "Fetches hourly and daily temperature, wind speed, and precipitation forecasts for any coordinates.",
              endpoints: ["GET /v1/forecast"],
              businessUseCases: ["flight dispatch scheduling", "risk warning automation"],
              evidenceChunkIds: ["chunk_1"]
            },
            {
              name: "Access historical weather archives",
              description: "Retrieves historical climate and weather data to analyze past delays.",
              endpoints: ["GET /v1/archive"],
              businessUseCases: ["historical delay audit"],
              evidenceChunkIds: ["chunk_2"]
            }
          ]
        }, null, 2);
      } else if (isPayment) {
        responseText = JSON.stringify({
          capabilities: [
            {
              name: "Process customer payment",
              description: "Accepts credit card or alternative payment details to authorize charges.",
              endpoints: ["POST /v1/charges"],
              businessUseCases: ["billing reconciliation", "lease payments"],
              evidenceChunkIds: ["chunk_1"]
            },
            {
              name: "Refund or manage transactions",
              description: "Refunds a transaction or retrieves status.",
              endpoints: ["GET /v1/transactions/:id"],
              businessUseCases: ["transaction management", "customer support refunds"],
              evidenceChunkIds: ["chunk_2"]
            }
          ]
        }, null, 2);
      } else {
        responseText = JSON.stringify({
          capabilities: [
            {
              name: "Upload and process documents",
              description: "Accepts files and extracts structured text fields using AI models.",
              endpoints: ["POST /api/v1/documents"],
              businessUseCases: ["billing reconciliation", "repair log extraction"],
              evidenceChunkIds: ["chunk_1"]
            },
            {
              name: "Retrieve extraction results",
              description: "Returns extracted structured fields and confidence values for review.",
              endpoints: ["GET /api/v1/documents/:id"],
              businessUseCases: ["human review", "operations dashboard"],
              evidenceChunkIds: ["chunk_2"]
            },
            {
              name: "Export approved data",
              description: "Exports reviewed structured data to a downstream system or integration layer.",
              endpoints: ["POST /api/v1/exports"],
              businessUseCases: ["system integration", "records handoff"],
              evidenceChunkIds: ["chunk_3"]
            }
          ]
        }, null, 2);
      }
    } else if (text.includes("Extract business signals") || text.includes("BusinessSignalExtraction")) {
      if (isWeather) {
        responseText = JSON.stringify({
          signals: [
            {
              id: "signal_1",
              title: "Weather-related flight delays",
              summary: "Unexpected wind, rain, and ice storms ground aircraft, leading to massive scheduling delays for AeroCore.",
              department: "dispatch",
              metric: "24h latency",
              evidenceChunkIds: ["chunk_customer_1"]
            },
            {
              id: "signal_2",
              title: "Manual weather monitoring bottlenecks",
              summary: "Dispatchers must manually check external weather forecasts, delaying proactive flight rerouting.",
              department: "operations",
              metric: "30+ mins per flight",
              evidenceChunkIds: ["chunk_customer_2"]
            }
          ]
        }, null, 2);
      } else if (isPayment) {
        responseText = JSON.stringify({
          signals: [
            {
              id: "signal_1",
              title: "Manual billing reconciliation bottlenecks",
              summary: "Finance team manually reconciles billing invoices, leading to significant delays and 15% error rates.",
              department: "finance",
              metric: "15% error rate",
              evidenceChunkIds: ["chunk_customer_1"]
            },
            {
              id: "signal_2",
              title: "Customer payment latency",
              summary: "Delays in capturing payments impact billing cycles and lease agreements compliance.",
              department: "operations",
              metric: "5-day payment delay",
              evidenceChunkIds: ["chunk_customer_2"]
            }
          ]
        }, null, 2);
      } else {
        responseText = JSON.stringify({
          signals: [
            {
              id: "signal_1",
              title: "Manual billing reconciliation bottlenecks",
              summary: "Finance team manually reconciles billing invoices, leading to significant delays and 15% error rates.",
              department: "finance",
              metric: "15% error rate",
              evidenceChunkIds: ["chunk_customer_1"]
            },
            {
              id: "signal_2",
              title: "Salesforce CRM integration constraints",
              summary: "Bespoke workflows require direct integration and data handoff to Salesforce Lease_Agreement__c.",
              department: "operations",
              metric: "Salesforce handoff",
              evidenceChunkIds: ["chunk_customer_2"]
            }
          ]
        }, null, 2);
      }
    } else if (text.includes("Create a concise source-grounded demo plan") || text.includes("DemoPlan")) {
      if (isWeather) {
        responseText = JSON.stringify({
          id: "plan_adk_bespoke",
          title: "AeroCore Open-Meteo Weather Dispatch Automation Demo (ADK planned)",
          story: "Demonstrates how Open-Meteo weather forecasts integrate directly with AeroCore's internal scheduling portal to automatically alert dispatch coordinators of flight-limiting weather conditions, reducing dispatch bottlenecks.",
          screens: [
            "Operational Weather Alert Dashboard",
            "Weather Forecast Parameter Query Panel",
            "Aircraft Operations Limitations Review",
            "Salesforce Handoff Status Page"
          ],
          endpointsUsed: ["GET /v1/forecast"],
          sampleDataNeeded: ["weather_forecast_response.json", "flight_limits_config.yaml"],
          implementationSteps: [
            "Initialize React weather dashboard",
            "Add coordinates query selector",
            "Implement flight limitation thresholds check",
            "Export status update notification to Salesforce"
          ],
          businessValue: [
            "Reduces dispatch delays by predicting flight-limiting weather",
            "Automates notifications to pilots in advance of weather events",
            "Keeps demo claims grounded in Open-Meteo API documentation"
          ],
          claims: [
            { id: "claim_1", text: "Open-Meteo provides hourly weather forecast variables." },
            { id: "claim_2", text: "AeroCore can automate dispatch scheduling using real-time weather thresholds." },
            { id: "claim_3", text: "AeroCore dispatch portal can alert coordinators in advance of flight-limiting weather events." },
            { id: "claim_4", text: "Open-Meteo forecasts can be used to inform scheduling decisions for AeroCore leasing." }
          ]
        }, null, 2);
      } else if (isPayment) {
        responseText = JSON.stringify({
          id: "plan_adk_bespoke",
          title: "AeroCore Stripe Payments Integration Demo (ADK planned)",
          story: "Demonstrates Stripe integration to streamline AeroCore lease payments and capture, reducing manual billing reconciliation latency.",
          screens: [
            "Bespoke Billing & Payment Dashboard",
            "Payment Transaction Request Panel",
            "Stripe API Response & Transaction Review",
            "ERP Integration & Reconciliation Handoff"
          ],
          endpointsUsed: ["POST /v1/charges", "GET /v1/transactions/:id"],
          sampleDataNeeded: ["mock_stripe_payload.json", "billing_invoice_match.csv"],
          implementationSteps: [
            "Create React payment billing dashboard",
            "Add transaction payload query selector",
            "Verify charge status indicators",
            "Design reconciliation handoff panel"
          ],
          businessValue: [
            "Eliminates 15% error rate from manual invoice entries",
            "Reduces billing reconciliation latency from days to seconds",
            "Aligns customer billing profiles with Stripe compliance standards"
          ],
          claims: [
            { id: "claim_1", text: "Stripe supports secure transaction processing and capture." },
            { id: "claim_2", text: "Stripe returns detailed transaction status and customer records." },
            { id: "claim_3", text: "Stripe can sync transaction history with downstream financial systems." }
          ]
        }, null, 2);
      } else {
        responseText = JSON.stringify({
          id: "plan_adk_bespoke",
          title: "AeroCore Field-Ops Document Intelligence Demo (ADK planned)",
          story: "Demonstrates an automated pipeline for AeroCore field documents. The demo showcases file upload, data extraction, validation, and automated Salesforce CRM handoff, eliminating manual billing reconciliation bottlenecks.",
          screens: [
            "Bespoke Customer Briefing & Evidence Dashboard",
            "Invoice & Repair Log Upload Portal",
            "API Extraction Results & Validation Panel",
            "Salesforce Lease_Agreement__c Payload Preview",
            "Integration Handoff Success Dashboard"
          ],
          endpointsUsed: ["POST /api/v1/documents", "GET /api/v1/documents/:id", "POST /api/v1/exports"],
          sampleDataNeeded: [
            "aerocore_billing_invoice.pdf",
            "faa_waiver_draft.txt",
            "mock_salesforce_payload.json"
          ],
          implementationSteps: [
            "Initialize React dashboard with AeroCore custom styles",
            "Implement Node API proxy to mock document extraction endpoints",
            "Design verification panel matching FAA waiver compliance standards",
            "Build Salesforce Lease_Agreement__c export payload visualizer"
          ],
          businessValue: [
            "Eliminates 15% error rate from manual invoice entries",
            "Reduces invoice reconciliation time from days to seconds",
            "Ensures compliance using evidence-grounded claim checks"
          ],
          claims: [
            { id: "claim_1", text: "ProofPilot supports uploading documents or records for processing." },
            { id: "claim_2", text: "ProofPilot returns structured fields that can be reviewed by a human operator." },
            { id: "claim_3", text: "ProofPilot can export approved data to a downstream integration layer." },
            { id: "claim_4", text: "ProofPilot can reduce manual review effort, though exact savings depend on workflow design." }
          ]
        }, null, 2);
      }
    } else if (text.includes("Validate the claim against the evidence") || text.includes("ClaimValidation")) {
      let status = "supported";
      let rewrite = "";
      if (text.includes("directly integrates") || text.includes("guarantees")) {
        status = "unsupported";
        rewrite = "can export data for connection through the customer's integration layer";
      } else if (text.includes("reduce manual") || text.includes("savings")) {
        status = "marketing";
        rewrite = "Exact impact depends on workflow design and document quality.";
      }
      responseText = JSON.stringify({ status, rewrite }, null, 2);
    } else if (text.includes("bespoke API demo design") || text.includes("proofpilot_adk_planner") || sysText.includes("proofpilot_adk_planner")) {
      const isWeather = text.toLowerCase().includes("meteo") || text.toLowerCase().includes("weather");
      if (isWeather) {
        responseText = JSON.stringify({
          capabilities: [
            {
              name: "Retrieve real-time weather forecasts",
              description: "Fetches hourly and daily temperature, wind speed, and precipitation forecasts for any coordinates.",
              endpoints: ["GET /v1/forecast"],
              businessUseCases: ["flight dispatch scheduling", "risk warning automation"],
              evidenceChunkIds: ["chunk_1"]
            },
            {
              name: "Access historical weather archives",
              description: "Retrieves historical climate and weather data to analyze past delays.",
              endpoints: ["GET /v1/archive"],
              businessUseCases: ["historical delay audit"],
              evidenceChunkIds: ["chunk_2"]
            }
          ],
          businessContext: {
            customerId: "aerocore-leasing",
            signals: [
              {
                id: "signal_1",
                title: "Weather-related flight delays",
                summary: "Unexpected wind and ice storms ground aircraft, leading to massive scheduling delays for Aerocore.",
                department: "dispatch",
                metric: "24h latency",
                evidenceChunkIds: ["chunk_customer_1"]
              }
            ]
          },
          plan: {
            title: "AeroCore Open-Meteo Weather Dispatch Automation Demo (ADK planned)",
            story: "Demonstrates how Open-Meteo weather forecasts integrate directly with AeroCore's internal scheduling portal to automatically alert dispatch coordinators of flight-limiting weather conditions, reducing dispatch bottlenecks.",
            screens: [
              "Operational Weather Alert Dashboard",
              "Weather Forecast Parameter Query Panel",
              "Aircraft Operations Limitations Review",
              "Salesforce Handoff Status Page"
            ],
            endpointsUsed: ["GET /v1/forecast"],
            sampleDataNeeded: ["weather_forecast_response.json", "flight_limits_config.yaml"],
            implementationSteps: [
              "Create react dispatch panel",
              "Add coordinates query selector",
              "Implement flight limitation thresholds check"
            ],
            businessValue: [
              "Reduces dispatch delays by predicting flight-limiting weather",
              "Automates notifications to pilots in advance of weather events"
            ],
            claims: [
              { id: "claim_1", text: "Open-Meteo provides hourly weather forecast variables." },
              { id: "claim_2", text: "AeroCore can automate dispatch scheduling using real-time weather thresholds." }
            ]
          },
          claimReport: {
            claims: [
              {
                id: "claim_1",
                text: "Open-Meteo provides hourly weather forecast variables.",
                status: "supported",
                evidenceChunkIds: ["chunk_1"]
              },
              {
                id: "claim_2",
                text: "AeroCore can automate dispatch scheduling using real-time weather thresholds.",
                status: "supported",
                evidenceChunkIds: ["chunk_2"]
              }
            ],
            summary: {
              supported: 2,
              inferred: 0,
              unsupported: 0,
              marketing: 0,
              unknown: 0
            }
          }
        }, null, 2);
      } else {
        responseText = JSON.stringify({
          capabilities: [
            {
              name: "Upload and process documents",
              description: "Accepts files and extracts structured text fields using AI models.",
              endpoints: ["POST /api/v1/documents"],
              businessUseCases: ["billing reconciliation", "repair log extraction"],
              evidenceChunkIds: ["chunk_1"]
            },
            {
              name: "Retrieve extraction results",
              description: "Returns extracted structured fields and confidence values for review.",
              endpoints: ["GET /api/v1/documents/:id"],
              businessUseCases: ["human review", "operations dashboard"],
              evidenceChunkIds: ["chunk_2"]
            },
            {
              name: "Export approved data",
              description: "Exports reviewed structured data to a downstream system or integration layer.",
              endpoints: ["POST /api/v1/exports"],
              businessUseCases: ["system integration", "records handoff"],
              evidenceChunkIds: ["chunk_3"]
            }
          ],
          businessContext: {
            customerId: "aerocore-leasing",
            signals: [
              {
                id: "signal_1",
                title: "Manual billing reconciliation bottlenecks",
                summary: "Finance team manually reconciles billing invoices, leading to significant delays and 15% error rates.",
                department: "finance",
                metric: "15% error rate",
                evidenceChunkIds: ["chunk_customer_1"]
              },
              {
                id: "signal_2",
                title: "Salesforce CRM integration constraints",
                summary: "Bespoke workflows require direct integration and data handoff to Salesforce Lease_Agreement__c.",
                department: "operations",
                metric: "Salesforce handoff",
                evidenceChunkIds: ["chunk_customer_2"]
              }
            ]
          },
          plan: {
            title: "AeroCore Field-Ops Document Intelligence Demo (ADK planned)",
            story: "Demonstrates an automated pipeline for AeroCore field documents. The demo showcases file upload, data extraction, validation, and automated Salesforce CRM handoff, eliminating manual billing reconciliation bottlenecks.",
            screens: [
              "Bespoke Customer Briefing & Evidence Dashboard",
              "Invoice & Repair Log Upload Portal",
              "API Extraction Results & Validation Panel",
              "Salesforce Lease_Agreement__c Payload Preview",
              "Integration Handoff Success Dashboard"
            ],
            endpointsUsed: ["POST /api/v1/documents", "GET /api/v1/documents/:id", "POST /api/v1/exports"],
            sampleDataNeeded: [
              "aerocore_billing_invoice.pdf",
              "faa_waiver_draft.txt",
              "mock_salesforce_payload.json"
            ],
            implementationSteps: [
              "Initialize React dashboard with AeroCore custom styles",
              "Implement Node API proxy to mock document extraction endpoints",
              "Design verification panel matching FAA waiver compliance standards",
              "Build Salesforce Lease_Agreement__c export payload visualizer"
            ],
            businessValue: [
              "Eliminates 15% error rate from manual invoice entries",
              "Reduces invoice reconciliation time from days to seconds",
              "Ensures compliance using evidence-grounded claim checks"
            ],
            claims: [
              { id: "claim_1", text: "ProofPilot supports uploading documents or records for processing." },
              { id: "claim_2", text: "ProofPilot returns structured fields that can be reviewed by a human operator." },
              { id: "claim_3", text: "ProofPilot can export approved data to a downstream integration layer." },
              { id: "claim_4", text: "ProofPilot can reduce manual review effort, though exact savings depend on workflow design." }
            ]
          },
          claimReport: {
            claims: [
              {
                id: "claim_1",
                text: "ProofPilot supports uploading documents or records for processing.",
                status: "supported",
                evidenceChunkIds: ["chunk_1"]
              },
              {
                id: "claim_2",
                text: "ProofPilot returns structured fields that can be reviewed by a human operator.",
                status: "supported",
                evidenceChunkIds: ["chunk_2"]
              },
              {
                id: "claim_3",
                text: "ProofPilot can export approved data to a downstream integration layer.",
                status: "supported",
                evidenceChunkIds: ["chunk_3"]
              },
              {
                id: "claim_4",
                text: "ProofPilot can reduce manual review effort, though exact savings depend on workflow design.",
                status: "marketing",
                evidenceChunkIds: [],
                rewrite: "Exact impact depends on workflow design and document quality."
              }
            ],
            summary: {
              supported: 3,
              inferred: 0,
              unsupported: 0,
              marketing: 1,
              unknown: 0
            }
          }
        }, null, 2);
      }
    } else {
      responseText = JSON.stringify({
        message: "Offline ADK agent mock response",
        promptText: text.substring(0, 100) + "..."
      });
    }

    yield {
      content: {
        role: "model",
        parts: [{ text: responseText }]
      }
    };
  }
}
