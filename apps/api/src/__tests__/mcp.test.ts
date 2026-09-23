import { describe, expect, it } from "vitest";
import { MCP_TOOLS, mcpRoutes } from "../routes/mcp";

describe("MCP", () => {
  it("returns 401 when no token is sent", async () => {
    const get = await mcpRoutes.request("/");
    expect(get.status).toBe(401);
    expect(await get.json()).toMatchObject({ error: "unauthorized" });

    const post = await mcpRoutes.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(post.status).toBe(401);
  });

  it("returns 401 for a Bearer token that is not a dk_ API key", async () => {
    const res = await mcpRoutes.request("/", { headers: { authorization: "Bearer session-cookie" } });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/dk_/);
  });

  it("exposes the three tools agents are documented to call", () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(names).toEqual(["list_channels", "schedule_post", "list_posts"]);
    const schedule = MCP_TOOLS.find((t) => t.name === "schedule_post");
    expect(schedule?.inputSchema.required).toEqual(["body", "channelIds", "scheduledAt"]);
  });
});
