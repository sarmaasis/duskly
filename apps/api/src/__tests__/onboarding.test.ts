import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { workspace } from "../db/schema";
import { isOnboarded, spaceName } from "../../../web/src/app/lib/api";

const here = dirname(fileURLToPath(import.meta.url));

describe("onboarding schema", () => {
  it("stores name, account_kind, and completed flag", () => {
    expect(workspace.name.name).toBe("name");
    expect(workspace.accountKind.name).toBe("account_kind");
    expect(workspace.onboardingCompleted.name).toBe("onboarding_completed");
    expect(workspace.onboardingCompleted.notNull).toBe(true);
    expect(workspace.onboardingCompleted.hasDefault).toBe(true);
  });

  it("does not default workspace.name to My workspace", () => {
    expect(workspace.name.hasDefault).toBe(false);
    const src = readFileSync(join(here, "../lib/workspace.ts"), "utf8");
    expect(src).toMatch(/name = ""/);
    expect(src).not.toMatch(/My workspace/);
    const insert = src.slice(src.indexOf("insert(workspace)"));
    expect(insert).toContain("onboardingCompleted: false");
    expect(insert).toContain("accountKind: null");
    expect(insert).toMatch(/name,/);
  });
});

describe("onboarding helpers (web)", () => {
  it("treats empty name + incomplete flag as not onboarded", () => {
    expect(isOnboarded({ name: "", onboardingCompleted: false })).toBe(false);
    expect(isOnboarded({ name: "Acme", onboardingCompleted: false })).toBe(false);
    expect(isOnboarded({ name: "Acme", onboardingCompleted: true })).toBe(true);
  });

  it("does not treat the old My workspace placeholder as a real name", () => {
    expect(isOnboarded({ name: "My workspace" })).toBe(false);
    expect(spaceName({ name: "My workspace" })).toBe("Account");
    expect(spaceName({ name: "" })).toBe("Account");
    expect(spaceName({ name: "Acme Studio" })).toBe("Acme Studio");
  });
});
