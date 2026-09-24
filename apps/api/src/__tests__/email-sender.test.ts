import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { emailSendErrorFields, parseEmailSender } from "../lib/email-sender";

const here = dirname(fileURLToPath(import.meta.url));

describe("parseEmailSender", () => {
  it("accepts a bare address", () => {
    expect(parseEmailSender("noreply@duskly.site")).toEqual({ email: "noreply@duskly.site" });
  });

  it("parses RFC 5322 display-name into { email, name }", () => {
    expect(parseEmailSender("Duskly <noreply@duskly.site>")).toEqual({
      email: "noreply@duskly.site",
      name: "Duskly",
    });
    expect(parseEmailSender('"Duskly" <noreply@duskly.site>')).toEqual({
      email: "noreply@duskly.site",
      name: "Duskly",
    });
  });

  it("rejects empty or malformed values", () => {
    expect(() => parseEmailSender("")).toThrow("EMAIL_FROM is not set");
    expect(() => parseEmailSender("Duskly")).toThrow("EMAIL_FROM is not a valid address");
    expect(() => parseEmailSender("Duskly <not-an-email>")).toThrow("EMAIL_FROM is not a valid address");
  });
});

describe("emailSendErrorFields", () => {
  it("reads name, message, and Cloudflare code without the stack object", () => {
    const err = Object.assign(new Error("could not find domain config of sending domain"), {
      code: "E_SENDER_DOMAIN_NOT_AVAILABLE",
    });
    expect(emailSendErrorFields(err)).toEqual({
      name: "Error",
      message: "could not find domain config of sending domain",
      code: "E_SENDER_DOMAIN_NOT_AVAILABLE",
    });
  });
});

describe("auth EMAIL.send payload", () => {
  it("uses parsed { email, name } from and logs error name/message, not the Error object", () => {
    const src = readFileSync(join(here, "../auth.ts"), "utf8");
    expect(src).toContain("from: parseEmailSender(env.EMAIL_FROM)");
    expect(src).toContain('console.error("[auth] EMAIL.send failed", name, message, code)');
    expect(src).not.toMatch(/console\.error\("\[auth\] EMAIL\.send failed", err\)/);
    expect(src).toContain("if (!localAuth) throw err");
    expect(src).toMatch(/console\.info\(`\[auth\] OTP for \$\{email\} \(\$\{type\}\): \$\{otp\}`\)/);
  });
});
