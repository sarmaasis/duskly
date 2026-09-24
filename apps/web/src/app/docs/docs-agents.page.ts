import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="mx-auto grid max-w-5xl gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
      <article class="min-w-0">
        <p class="font-mono text-[11px] font-semibold uppercase tracking-widest text-cta">Agents</p>
        <h1 class="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Smart agent &amp; external agents</h1>
        <p class="mt-4 text-[15px] leading-relaxed text-[#52525b]">
          Use the in-app smart agent to turn a short brief into a scheduled post, or drive the same account from your own agent with the HTTP API (or <a routerLink="/docs/mcp" class="font-semibold text-cta underline decoration-cta/40 underline-offset-2">MCP</a>).
        </p>

        <h2 class="mt-10 scroll-mt-24 font-display text-xl font-bold">In-app smart agent</h2>
        <p class="mt-3 text-[14px] leading-relaxed text-[#52525b]">
          Open <span class="font-semibold text-[#09090b]">App → Agent</span>. Describe what you want to post.
          The agent drafts copy, picks a time (default about an hour out), and schedules onto a connected channel—subject to your Cloud plan limits.
        </p>
        <ul class="mt-4 list-disc space-y-2 pl-5 text-[14px] text-[#52525b]">
          <li><code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">GET /v1/ai/agent?workspaceId=…</code> — recent runs. Copy <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">workspaceId</code> from <a routerLink="/app/settings" class="font-semibold text-[#09090b] underline decoration-cta decoration-2 underline-offset-4">Settings</a>.</li>
          <li><code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">POST /v1/ai/agent</code> — run with workspaceId, prompt, optional scheduleInMinutes</li>
        </ul>

        <h2 class="mt-10 scroll-mt-24 font-display text-xl font-bold">External agents via API</h2>
        <p class="mt-3 text-[14px] leading-relaxed text-[#52525b]">
          Mint a <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">dk_</code> token, then have your agent:
        </p>
        <ol class="mt-4 list-decimal space-y-2 pl-5 text-[14px] text-[#52525b]">
          <li>List channels with <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">GET /v1/accounts?workspaceId=…</code></li>
          <li>Create a scheduled post with <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">POST /v1/posts</code> (body includes workspaceId)</li>
          <li>Confirm with <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">GET /v1/posts?workspaceId=…</code></li>
        </ol>
        <p class="mt-3 text-[14px] leading-relaxed text-[#52525b]">
          Or skip the id on MCP: those tools inherit the token’s workspace and do not take a workspace id.
        </p>
        <p class="mt-3 text-[14px] leading-relaxed text-[#52525b]">
          Plan limits match the UI: channel caps and AI quotas apply on Duskly Cloud the same way they do for a signed-in user.
        </p>
      </article>

      <aside class="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#71717a]">Agent run</p>
        <div class="overflow-hidden rounded-lg border border-[#e4e4e7] bg-[#18181b]">
          <div class="border-b border-zinc-800 px-3 py-2 font-mono text-[10px] text-zinc-400">POST /v1/ai/agent</div>
          <pre class="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-zinc-300">{{ agentCurl }}</pre>
        </div>
      </aside>
    </div>
  `,
})
export class DocsAgentsPage {
  readonly agentCurl = `# workspaceId: copy from Settings
curl -X POST https://api.duskly.site/v1/ai/agent \\
  -H "Authorization: Bearer dk_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "workspaceId": "YOUR_WORKSPACE_ID",
    "prompt": "Announce Friday drop",
    "scheduleInMinutes": 60
  }'`;
}
