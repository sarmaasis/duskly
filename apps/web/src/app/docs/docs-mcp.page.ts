import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="mx-auto grid max-w-5xl gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
      <article class="min-w-0">
        <p class="font-mono text-[11px] font-semibold uppercase tracking-widest text-cta">MCP</p>
        <h1 class="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Model Context Protocol</h1>
        <p class="mt-4 text-[15px] leading-relaxed text-[#52525b]">
          Connect Cursor, Claude, or any MCP client to Duskly over HTTP. Auth is the same workspace API token
          (<code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">dk_</code> from
          <a routerLink="/app/settings" class="font-semibold text-[#09090b] underline decoration-cta decoration-2 underline-offset-4">Settings → API tokens</a>).
          Tools call the same workspace data as the REST API. No second data model.
        </p>

        <h2 class="mt-10 scroll-mt-24 font-display text-xl font-bold">Endpoint</h2>
        <p class="mt-3 text-[14px] leading-relaxed text-[#52525b]">
          <code class="rounded bg-[#f4f4f1] px-1.5 py-0.5 font-mono text-[13px]">https://api.duskly.site/mcp</code>
          (self-host: your API origin + <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">/mcp</code>).
        </p>
        <p class="mt-3 text-[14px] leading-relaxed text-[#52525b]">
          Transport: JSON-RPC over HTTP (Streamable HTTP–compatible). Send
          <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">Authorization: Bearer dk_…</code>.
          Requests without a valid token return <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">401</code>.
          The token is already workspace-scoped — MCP tools do not take a workspace id.
          If you also call REST routes that require one, copy Workspace ID from
          <a routerLink="/app/settings" class="font-semibold text-[#09090b] underline decoration-cta decoration-2 underline-offset-4">Settings</a>.
        </p>

        <h2 class="mt-10 scroll-mt-24 font-display text-xl font-bold">Tools</h2>
        <ul class="mt-4 space-y-4 text-[14px] leading-relaxed text-[#52525b]">
          <li>
            <p class="font-mono text-[12px] font-semibold text-[#09090b]">list_channels</p>
            <p class="mt-1">List connected social accounts for this token.</p>
          </li>
          <li>
            <p class="font-mono text-[12px] font-semibold text-[#09090b]">schedule_post</p>
            <p class="mt-1">Create a scheduled post. Args: body, channelIds, scheduledAt (ISO-8601 or unix ms).</p>
          </li>
          <li>
            <p class="font-mono text-[12px] font-semibold text-[#09090b]">list_posts</p>
            <p class="mt-1">List recent posts (optional limit, default 20, max 50).</p>
          </li>
          <li>
            <p class="font-mono text-[12px] font-semibold text-[#09090b]">channel_rules</p>
            <p class="mt-1">Posting rules for Instagram, Facebook Stories, X, LinkedIn, YouTube, repeat series, and short links.</p>
          </li>
          <li>
            <p class="font-mono text-[12px] font-semibold text-[#09090b]">generate_image</p>
            <p class="mt-1">Make a picture from a prompt and save it in the media library. Arg: prompt.</p>
          </li>
          <li>
            <p class="font-mono text-[12px] font-semibold text-[#09090b]">generate_video</p>
            <p class="mt-1">Make a short clip from a prompt and save it in the media library. Args: prompt, optional durationSec (6 or 8).</p>
          </li>
        </ul>

        <h2 class="mt-10 scroll-mt-24 font-display text-xl font-bold">Cursor config</h2>
        <p class="mt-3 text-[14px] leading-relaxed text-[#52525b]">
          Add a remote MCP server that posts JSON-RPC to the URL above with your Bearer token.
          After connect, call tools/list then tools/call.
        </p>
      </article>

      <aside class="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#71717a]">Client config</p>
        <div class="overflow-hidden rounded-lg border border-[#e4e4e7] bg-[#18181b]">
          <div class="border-b border-zinc-800 px-3 py-2 font-mono text-[10px] text-zinc-400">mcp.json (Cursor)</div>
          <pre class="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-zinc-300">{{ mcpJson }}</pre>
        </div>
        <div class="overflow-hidden rounded-lg border border-[#e4e4e7] bg-[#18181b]">
          <div class="border-b border-zinc-800 px-3 py-2 font-mono text-[10px] text-zinc-400">tools/call</div>
          <pre class="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-zinc-300">{{ toolsCall }}</pre>
        </div>
      </aside>
    </div>
  `,
})
export class DocsMcpPage {
  readonly mcpJson = `{
  "mcpServers": {
    "duskly": {
      "url": "https://api.duskly.site/mcp",
      "headers": {
        "Authorization": "Bearer dk_YOUR_TOKEN"
      }
    }
  }
}`;

  readonly toolsCall = `curl -X POST https://api.duskly.site/mcp \\
  -H "Authorization: Bearer dk_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "list_channels",
      "arguments": {}
    }
  }'`;
}
