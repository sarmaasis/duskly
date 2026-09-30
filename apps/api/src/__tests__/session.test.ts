import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import worker from "../index";
import type { Env } from "../env";

const here = dirname(fileURLToPath(import.meta.url));

describe("session / sign-out", () => {
  it("API mounts Better Auth on /api/auth/* including sign-out", () => {
    const src = readFileSync(join(here, "../index.ts"), "utf8");
    expect(src).toMatch(/app\.on\(\["POST", "GET"\], "\/api\/auth\/\*"/);
  });

  it("web sign-out posts to /api/auth/sign-out and session GET uses get-session", () => {
    const src = readFileSync(join(here, "../../../web/src/app/lib/session.ts"), "utf8");
    expect(src).toContain("/api/auth/sign-out");
    expect(src).toContain("/api/auth/get-session");
    expect(src).toContain('method: "POST"');
  });

  it("healthz is reachable without wrangler", async () => {
    const res = await worker.fetch(
      new Request("https://api.duskly.test/healthz"),
      { WEB_ORIGIN: "http://localhost:4200" } as Env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: "duskly-api" });
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("POST /api/auth/sign-out is a mounted route (not 404)", async () => {
    let status = 0;
    try {
      const res = await worker.fetch(
        new Request("https://api.duskly.test/api/auth/sign-out", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        }),
        { WEB_ORIGIN: "http://localhost:4200" } as Env,
        {} as ExecutionContext,
      );
      status = res.status;
    } catch {
      status = 500;
    }
    expect(status).not.toBe(404);
    expect(status).toBeGreaterThan(0);
  });
});
