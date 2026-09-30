/** True on the hosted Cloud site, where public sign-in stays closed except for invited testers. */
export function cloudSignInClosed(): boolean {
  return (globalThis as { __DUSKLY_MODE__?: string }).__DUSKLY_MODE__ === "cloud";
}
