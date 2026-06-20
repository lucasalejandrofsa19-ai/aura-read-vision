import { describe, it, expect } from "vitest";

/**
 * Mirror of the redactEmail helper used in supabase/functions/stripe-webhook.
 * Kept in sync intentionally — the function is trivial and copied here so
 * we can run it under Vitest (Node) without spinning up Deno.
 */
const redactEmail = (email?: string | null): string => {
  if (!email || typeof email !== "string") return "<none>";
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${local[0]}***@${domain}`;
};

describe("stripe-webhook PII redaction", () => {
  it("redacts the local part keeping only first char + domain", () => {
    expect(redactEmail("johndoe@example.com")).toBe("j***@example.com");
    expect(redactEmail("a@b.co")).toBe("a***@b.co");
  });

  it("never leaks the full email or full local part", () => {
    const samples = [
      "alice.smith@corp.io",
      "bob+tag@gmail.com",
      "lucasalejandrosfa19@gmail.com",
    ];
    for (const e of samples) {
      const out = redactEmail(e);
      expect(out).not.toContain(e);
      const local = e.split("@")[0];
      expect(out).not.toContain(local);
      expect(out).toContain("@");
    }
  });

  it("handles missing/invalid emails safely", () => {
    expect(redactEmail(undefined)).toBe("<none>");
    expect(redactEmail(null)).toBe("<none>");
    expect(redactEmail("")).toBe("<none>");
    expect(redactEmail("no-at-sign")).toBe("***");
    expect(redactEmail("@noLocal.com")).toBe("***");
  });

  it("simulated webhook log line contains no PII", () => {
    const captured: string[] = [];
    const origLog = console.log;
    console.log = (msg: unknown) => captured.push(String(msg));
    try {
      const email = "private.user@secret.co";
      // mimic logStep formatting
      console.log(
        `[STRIPE-WEBHOOK] Customer found - ${JSON.stringify({
          email_redacted: redactEmail(email),
        })}`,
      );
    } finally {
      console.log = origLog;
    }
    const joined = captured.join("\n");
    expect(joined).not.toContain("private.user");
    expect(joined).not.toContain("private.user@secret.co");
    expect(joined).toContain("p***@secret.co");
  });
});
