import { Component, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AppShell } from "../layout/app-shell";
import { api, type PlanSnapshot } from "../lib/api";
import { lsSet } from "../lib/browser";

@Component({
  standalone: true,
  imports: [AppShell, FormsModule],
  template: `
    <dk-shell>
      <div class="mb-5">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">Schedule</p>
        <p class="mt-1 text-[13px] text-[#63676c]">Write, edit media, cross-post, and schedule.</p>
      </div>

      @if (msg()) {
        <p class="mb-4 rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px]" [class.text-red-600]="err()" [class.text-[#365314]]="!err()">{{ msg() }}</p>
      }

      <div class="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div class="space-y-4">
          <section class="space-y-3 rounded-xl border border-[#e8e8e3] bg-white p-4">
            <p class="font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Post</p>
            <textarea [(ngModel)]="body" rows="6" class="w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 py-2 text-sm outline-none focus:border-[#121417] focus:bg-white"></textarea>
            <div class="flex flex-wrap gap-2">
              <button type="button" (click)="copilot()" class="rounded-md border border-[#e8e8e3] px-3 py-1.5 text-xs font-semibold hover:bg-[#f7f7f4]">AI copilot</button>
              <button type="button" (click)="aiImage()" [disabled]="(usage()?.limits.aiImages||0)===0" class="rounded-md border border-[#e8e8e3] px-3 py-1.5 text-xs font-semibold hover:bg-[#f7f7f4] disabled:opacity-40">AI image</button>
              <button type="button" (click)="aiVideo()" class="rounded-md border border-[#e8e8e3] px-3 py-1.5 text-xs font-semibold hover:bg-[#f7f7f4]">AI clip</button>
            </div>
          </section>

          <section class="space-y-3 rounded-xl border border-[#e8e8e3] bg-white p-4">
            <p class="font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Picture editor</p>
            <input type="file" accept="image/*,.svg" (change)="onFile($event)" class="block w-full text-xs text-[#63676c]" />
            <input [(ngModel)]="overlay" placeholder="Overlay text" class="h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none focus:border-[#121417] focus:bg-white" />
            <button type="button" (click)="editPicture()" class="h-9 rounded-md bg-[#121417] px-3 text-xs font-semibold text-white hover:bg-[#27272a]">Save edited image</button>
            @if (mediaPreview()) {
              <img [src]="mediaPreview()!" alt="Edited media" class="mt-2 max-h-48 rounded-lg border border-[#e8e8e3]" />
            }
          </section>

          <section class="grid gap-3 rounded-xl border border-[#e8e8e3] bg-white p-4 sm:grid-cols-2">
            <label class="text-[11px] font-semibold text-[#71717a]">Schedule
              <input type="datetime-local" [(ngModel)]="when" class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal text-[#121417] outline-none focus:border-[#121417] focus:bg-white" />
            </label>
            <label class="text-[11px] font-semibold text-[#71717a]">Delay (seconds)
              <input type="number" [(ngModel)]="delaySeconds" min="0" class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal outline-none focus:border-[#121417] focus:bg-white" />
            </label>
            <label class="text-[11px] font-semibold text-[#71717a]">Repeat
              <select [(ngModel)]="repeatRule" class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal outline-none focus:border-[#121417] focus:bg-white">
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
            <label class="text-[11px] font-semibold text-[#71717a]">First comment
              <input [(ngModel)]="commentBody" class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal outline-none focus:border-[#121417] focus:bg-white" />
            </label>
          </section>

          <button type="button" (click)="schedule()" class="inline-flex h-10 items-center rounded-md bg-cta px-4 text-sm font-semibold text-white hover:bg-cta-hover">Schedule post</button>
        </div>

        <aside class="space-y-4">
          <section class="rounded-xl border border-[#e8e8e3] bg-white p-4">
            <p class="mb-2 font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Cross-post channels</p>
            @for (a of accounts(); track a.id) {
              <label class="flex items-center gap-2 py-1.5 text-[13px]">
                <input type="checkbox" [checked]="selected().includes(a.id)" (change)="toggle(a.id)" class="accent-cta" />
                <span>{{ a.network }} · {{ a.handle }}</span>
              </label>
            } @empty {
              <p class="text-[12px] text-[#63676c]">Connect accounts first.</p>
            }
          </section>
          <section class="space-y-1 rounded-xl border border-[#e8e8e3] bg-white p-4 text-[12px] text-[#63676c]">
            <p class="font-semibold text-[#121417]">Plan quotas</p>
            <p>AI images {{ usage()?.used?.['aiImages'] || 0 }}/{{ usage()?.limits?.aiImages ?? 0 }}</p>
            <p>AI videos {{ usage()?.used?.['aiVideos'] || 0 }}/{{ usage()?.limits?.aiVideos ?? 0 }}</p>
            <p>Clip min {{ usage()?.used?.['aiClipMinutes'] || 0 }}/{{ usage()?.limits?.aiClipMinutes ?? 0 }}</p>
            <p>Copilot {{ usage()?.used?.['aiCopilot'] || 0 }}/{{ usage()?.limits?.aiCopilot ?? 0 }}</p>
          </section>
        </aside>
      </div>
    </dk-shell>
  `,
})
export class ComposerPage implements OnInit {
  body = "";
  when = "";
  delaySeconds = 0;
  repeatRule = "none";
  commentBody = "";
  overlay = "";
  sourceMediaId = "";
  mediaPreview = signal<string | null>(null);
  accounts = signal<{ id: string; network: string; handle: string }[]>([]);
  selected = signal<string[]>([]);
  usage = signal<PlanSnapshot | null>(null);
  msg = signal("");
  err = signal(false);
  workspaceId = "";

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string }; usage: PlanSnapshot }>("/v1/workspaces/me");
      this.workspaceId = me.workspace.id;
      lsSet("dk-ws", me.workspace.id);
      this.usage.set(me.usage);
      const ac = await api<{ accounts: { id: string; network: string; handle: string }[] }>(
        `/v1/accounts?workspaceId=${me.workspace.id}`,
      );
      this.accounts.set(ac.accounts);
      if (ac.accounts[0]) this.selected.set([ac.accounts[0].id]);
    } catch {
      this.fail(new Error("Sign in to compose posts."));
    }
  }

  toggle(id: string) {
    const s = new Set(this.selected());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.selected.set([...s]);
  }

  async copilot() {
    try {
      const r = await api<{ draft: string }>("/v1/ai/copilot", {
        method: "POST",
        json: { workspaceId: this.workspaceId, prompt: this.body || "Write a friendly update" },
      });
      this.body = r.draft;
      this.flash("Copilot draft applied");
      await this.refreshUsage();
    } catch (e: unknown) {
      this.fail(e);
    }
  }

  async aiImage() {
    try {
      const r = await api<{ id: string; url: string }>("/v1/ai/image", {
        method: "POST",
        json: { workspaceId: this.workspaceId, prompt: this.body || "Abstract paper desk poster" },
      });
      this.sourceMediaId = r.id;
      this.mediaPreview.set(`http://localhost:8787${r.url}`);
      this.flash("AI image stored");
      await this.refreshUsage();
    } catch (e: unknown) {
      this.fail(e);
    }
  }

  async aiVideo() {
    try {
      const r = await api<{ id: string; url: string }>("/v1/ai/video", {
        method: "POST",
        json: { workspaceId: this.workspaceId, prompt: this.body || "Sunset clip", minutes: 1 },
      });
      this.sourceMediaId = r.id;
      this.mediaPreview.set(`http://localhost:8787${r.url}`);
      this.flash("AI clip stored (animated SVG)");
      await this.refreshUsage();
    } catch (e: unknown) {
      this.fail(e);
    }
  }

  async onFile(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("workspaceId", this.workspaceId);
    fd.set("file", file);
    const res = await fetch("http://localhost:8787/v1/media/upload", { method: "POST", body: fd, credentials: "include" });
    const data = await res.json();
    if (!res.ok) return this.fail(data);
    this.sourceMediaId = data.id;
    this.mediaPreview.set(`http://localhost:8787${data.url}`);
  }

  async editPicture() {
    try {
      const r = await api<{ id: string; url: string }>("/v1/media/edit", {
        method: "POST",
        json: {
          workspaceId: this.workspaceId,
          sourceMediaId: this.sourceMediaId || undefined,
          prompt: this.body || "Edited",
          overlayText: this.overlay,
          crop: { x: 0, y: 0, w: 1080, h: 1080 },
        },
      });
      this.sourceMediaId = r.id;
      this.mediaPreview.set(`http://localhost:8787${r.url}`);
      this.flash("Edited image saved to media library");
    } catch (e: unknown) {
      this.fail(e);
    }
  }

  async schedule() {
    if (!this.selected().length) return this.fail({ message: "Pick at least one channel" });
    try {
      await api("/v1/posts", {
        method: "POST",
        json: {
          workspaceId: this.workspaceId,
          body: this.body,
          destinations: this.selected(),
          status: this.when ? "scheduled" : "draft",
          scheduledAt: this.when ? new Date(this.when).getTime() : undefined,
          delaySeconds: this.delaySeconds,
          repeatRule: this.repeatRule,
          commentBody: this.commentBody || null,
          mediaIds: this.sourceMediaId ? [this.sourceMediaId] : [],
        },
      });
      this.flash("Post saved");
      this.body = "";
    } catch (e: unknown) {
      this.fail(e);
    }
  }

  async refreshUsage() {
    const u = await api<PlanSnapshot>(`/v1/workspaces/${this.workspaceId}/usage`);
    this.usage.set(u);
  }

  flash(m: string) {
    this.err.set(false);
    this.msg.set(m);
  }
  fail(e: unknown) {
    this.err.set(true);
    const body = e as { message?: string; body?: { message?: string } };
    this.msg.set(body?.body?.message || body?.message || "Request failed");
  }
}
