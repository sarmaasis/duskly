export function testerEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Self-host is open. Cloud sign-in is limited to CLOUD_TESTER_EMAILS. */
export function cloudSignInAllowed(env: { DUSKLY_MODE?: string; CLOUD_TESTER_EMAILS?: string }, email: string | undefined): boolean {
  if (env.DUSKLY_MODE !== "cloud") return true;
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return false;
  return testerEmails(env.CLOUD_TESTER_EMAILS).has(normalized);
}
