import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { emailSendErrorFields, mailHtml, parseEmailSender, sendViaEmailBinding } from "../lib/email-sender";

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

describe("mailHtml", () => {
  it("escapes the title and keeps the code", () => {
    const html = mailHtml({ title: "Join <studio>", body: "Hello", code: "123456", href: "https://duskly.site/invite/1", label: "Accept invite" });
    expect(html).toContain("Join &lt;studio&gt;");
    expect(html).toContain("123456");
    expect(html).toContain("https://duskly.site/invite/1");
  });
});

describe("sendViaEmailBinding", () => {
  it("calls send on the binding so this stays the EMAIL object", async () => {
    const payload = {
      to: "user@example.com",
      from: { email: "noreply@duskly.site", name: "Duskly" },
      subject: "code",
      text: "123456",
    };
    let thisArg: unknown;
    const binding = {
      send(this: unknown, msg: typeof payload) {
        thisArg = this;
        expect(msg).toEqual(payload);
        return Promise.resolve({ messageId: "mid-1" });
      },
    };
    await expect(sendViaEmailBinding(binding, payload)).resolves.toEqual({ messageId: "mid-1" });
    expect(thisArg).toBe(binding);
  });
});

describe("auth EMAIL.send payload", () => {
  it("uses parsed { email, name } from and logs error name/message, not the Error object", () => {
    const src = readFileSync(join(here, "../auth.ts"), "utf8");
    expect(src).toContain("from: parseEmailSender(env.EMAIL_FROM)");
    expect(src).toContain("sendViaEmailBinding(mailer,");
    expect(src).not.toMatch(/const send = env\.EMAIL\?\.send/);
    expect(src).not.toMatch(/await send\(/);
    expect(src).toContain('console.error("[auth] EMAIL.send failed", name, message, code)');
    expect(src).not.toMatch(/console\.error\("\[auth\] EMAIL\.send failed", err\)/);
    expect(src).toContain("if (!localAuth) throw err");
    expect(src).toMatch(/console\.info\(`\[auth\] OTP for \$\{email\} \(\$\{type\}\): \$\{otp\}`\)/);
  });
});
