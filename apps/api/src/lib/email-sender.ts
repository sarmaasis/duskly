/** Cloudflare Email Sending `from` / `to` address object (Workers binding). */
export type EmailAddress = { email: string; name?: string };

const BARE_EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/**
 * Parse EMAIL_FROM for `env.EMAIL.send`.
 * The Workers binding accepts a bare address or `{ email, name }` — not RFC 5322
 * `Name <addr@domain>` as a single string (that form is SMTP-only).
 */
export function parseEmailSender(raw: string | undefined): EmailAddress {
  const value = (raw ?? "").trim();
  if (!value) {
    throw new Error("EMAIL_FROM is not set");
  }
  const angled = value.match(/^(.*?)\s*<([^>]+)>$/);
  if (angled) {
    const name = angled[1].replace(/^["']|["']$/g, "").trim();
    const email = angled[2].trim();
    if (!BARE_EMAIL.test(email)) {
      throw new Error("EMAIL_FROM is not a valid address");
    }
    return name ? { email, name } : { email };
  }
  if (!BARE_EMAIL.test(value)) {
    throw new Error("EMAIL_FROM is not a valid address");
  }
  return { email: value };
}

export function emailSendErrorFields(err: unknown): { name: string; message: string; code: string } {
  const e = err as { name?: unknown; message?: unknown; code?: unknown };
  return {
    name: typeof e?.name === "string" && e.name ? e.name : "Error",
    message: typeof e?.message === "string" && e.message ? e.message : String(err),
    code: e?.code == null ? "" : String(e.code),
  };
}
