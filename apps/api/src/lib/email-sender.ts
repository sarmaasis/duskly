/** Cloudflare Email Sending `from` / `to` address object (Workers binding). */
export type EmailAddress = { email: string; name?: string };

export type EmailSendPayload = {
  to: string | EmailAddress;
  from: string | EmailAddress;
  subject: string;
  html?: string;
  text?: string;
};

/** Workers `EMAIL` binding — pass the object, never a detached `send`. */
export type EmailBinding = {
  send(msg: EmailSendPayload): Promise<{ messageId: string }>;
};

/**
 * Call `email.send` with the binding as `this`.
 * Extracting `const { send } = email` causes TypeError: Illegal invocation on Workers.
 */
export function sendViaEmailBinding(email: EmailBinding, payload: EmailSendPayload) {
  return email.send(payload);
}

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

function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function mailHtml(opts: { title: string; body: string; code?: string; href?: string; label?: string; note?: string }) {
  const code = opts.code
    ? `<p style="margin:24px 0;font-family:ui-monospace,monospace;font-size:32px;letter-spacing:0.18em;font-weight:700;color:#121417">${esc(opts.code)}</p>`
    : "";
  const button = opts.href
    ? `<p style="margin:28px 0"><a href="${esc(opts.href)}" style="display:inline-block;background:#ff5c33;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:999px">${esc(opts.label || "Open")}</a></p>`
    : "";
  const note = opts.note ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#63676c">${opts.note}</p>` : "";
  return `<div style="background:#fbfbfa;padding:32px 16px;font-family:Georgia,'Iowan Old Style',serif;color:#121417"><div style="max-width:460px;margin:0 auto;background:#fff;border:1px solid #e8e8e3;border-radius:16px;padding:32px"><p style="margin:0;font-family:ui-sans-serif,system-ui,sans-serif;font-size:18px;font-weight:800">Dus<span style="color:#ff5c33">kly</span></p><h1 style="margin:24px 0 0;font-size:28px;line-height:1.15">${esc(opts.title)}</h1><p style="margin:12px 0 0;font-family:ui-sans-serif,system-ui,sans-serif;font-size:15px;line-height:1.5;color:#3f3f46">${opts.body}</p>${code}${button}${note}</div></div>`;
}

export function emailSendErrorFields(err: unknown): { name: string; message: string; code: string } {
  const e = err as { name?: unknown; message?: unknown; code?: unknown };
  return {
    name: typeof e?.name === "string" && e.name ? e.name : "Error",
    message: typeof e?.message === "string" && e.message ? e.message : String(err),
    code: e?.code == null ? "" : String(e.code),
  };
}
