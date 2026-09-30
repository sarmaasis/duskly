import { describe, expect, it } from "vitest";
import { cloudSignInAllowed, testerEmails } from "../lib/testers";

describe("cloud tester allowlist", () => {
  it("splits comma-separated emails and ignores blanks", () => {
    expect([...testerEmails(" A@B.co, ,c@d.co ")]).toEqual(["a@b.co", "c@d.co"]);
  });

  it("lets every email sign in on self-host", () => {
    expect(cloudSignInAllowed({ DUSKLY_MODE: "selfhost" }, "anyone@example.com")).toBe(true);
    expect(cloudSignInAllowed({ DUSKLY_MODE: "selfhost", CLOUD_TESTER_EMAILS: "" }, "anyone@example.com")).toBe(true);
  });

  it("allows only listed emails on cloud", () => {
    const env = { DUSKLY_MODE: "cloud", CLOUD_TESTER_EMAILS: "tester@duskly.site, other@duskly.site" };
    expect(cloudSignInAllowed(env, "Tester@duskly.site")).toBe(true);
    expect(cloudSignInAllowed(env, "stranger@example.com")).toBe(false);
    expect(cloudSignInAllowed(env, "")).toBe(false);
  });

  it("closes cloud sign-in when the list is empty", () => {
    expect(cloudSignInAllowed({ DUSKLY_MODE: "cloud", CLOUD_TESTER_EMAILS: "" }, "tester@duskly.site")).toBe(false);
    expect(cloudSignInAllowed({ DUSKLY_MODE: "cloud" }, "tester@duskly.site")).toBe(false);
  });
});
