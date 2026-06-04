import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveWorkflowDocs } from "./docs.js";

describe("resolveWorkflowDocs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches docs from a URL even when fallback docs text is present", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`
      <html>
        <body>
          <h1>Example Payments API</h1>
          <p>POST /payments creates a payment for an invoice.</p>
          <p>GET /payments/{payment_id} returns payment status and settlement details.</p>
        </body>
      </html>
    `, {
      headers: { "content-type": "text/html" }
    })));

    const resolved = await resolveWorkflowDocs({
      apiName: "Example Payments API",
      docsUrl: "https://example.com/docs",
      docsText: "This pasted fallback should not be used even though it is long enough to pass validation.",
      industry: "Finance",
      audience: "technical",
      goal: "Show how finance teams can collect and reconcile invoice payments.",
      liveApiAllowed: false
    });

    expect(resolved.docsSourceUrl).toBe("https://example.com/docs");
    expect(resolved.docsText).toContain("POST /payments");
    expect(resolved.docsText).not.toContain("pasted fallback");
  });
});
