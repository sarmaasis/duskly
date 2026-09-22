import { Component, ElementRef, OnInit, ViewChild, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { api, apiBase, type PlanSnapshot } from "../lib/api";
import { lsSet } from "../lib/browser";

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="mx-auto max-w-5xl">
      <div class="mb-6">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Schedule</p>
        <h1 class="mt-1 font-display text-3xl font-bold tracking-tight dark:text-zinc-50">Compose</h1>
        <p class="mt-1 max-w-xl text-sm text-[#63676c] dark:text-zinc-400">Write, edit media, cross-post, and schedule.</p>
      </div>

      @if (msg()) {
        <p class="mb-4 rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px] shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900" [class.text-red-600]="err()" [class.text-[#365314]]="!err()">{{ msg() }}</p>
      }

      <div class="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div class="space-y-4">
          <section class="space-y-3 rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
            <p class="font-mono text-[10px] uppercase tracking-wider text-[#92969b] dark:text-zinc-500">Post</p>
            <textarea [(ngModel)]="body" rows="6" class="w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 py-2 text-sm outline-none focus:border-[#121417] focus:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:bg-zinc-800"></textarea>
            <div class="flex flex-wrap gap-2">
              <button type="button" (click)="copilot()" class="rounded-md border border-[#e8e8e3] px-3 py-1.5 text-xs font-semibold hover:bg-[#f7f7f4] dark:border-zinc-600 dark:hover:bg-zinc-800">AI copilot</button>
              <button type="button" (click)="aiImage()" [disabled]="(usage()?.limits.aiImages||0)===0" class="rounded-md border border-[#e8e8e3] px-3 py-1.5 text-xs font-semibold hover:bg-[#f7f7f4] disabled:opacity-40 dark:border-zinc-600 dark:hover:bg-zinc-800">AI image</button>
              <button type="button" (click)="aiVideo()" class="rounded-md border border-[#e8e8e3] px-3 py-1.5 text-xs font-semibold hover:bg-[#f7f7f4] dark:border-zinc-600 dark:hover:bg-zinc-800">AI clip</button>
            </div>
            @if (videoPreview()) {
              <video [src]="videoPreview()!" controls class="mt-2 max-h-48 w-full rounded-lg border border-[#e8e8e3] dark:border-zinc-700"></video>
            }
          </section>

          <section class="space-y-3 rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
            <p class="font-mono text-[10px] uppercase tracking-wider text-[#92969b] dark:text-zinc-500">Picture editor</p>
            <input type="file" accept="image/*" (change)="onFile($event)" class="block w-full text-xs text-[#63676c] dark:text-zinc-400" />
            <canvas #canvas width="640" height="480" class="max-h-56 w-full rounded-lg border border-[#e8e8e3] bg-[#f7f7f4] dark:border-zinc-700 dark:bg-zinc-800"></canvas>
            <div class="grid gap-2 sm:grid-cols-2">
              <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Overlay text
                <input [(ngModel)]="overlay" (ngModelChange)="redraw()" class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal outline-none focus:border-[#121417] focus:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
              </label>
              <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Format
                <select [(ngModel)]="exportFormat" class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
                  <option value="image/png">PNG</option>
                  <option value="image/jpeg">JPEG</option>
                </select>
              </label>
              <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Brightness {{ brightness }}
                <input type="range" min="50" max="150" [(ngModel)]="brightness" (ngModelChange)="redraw()" class="mt-2 w-full accent-cta" />
              </label>
              <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Contrast {{ contrast }}
                <input type="range" min="50" max="150" [(ngModel)]="contrast" (ngModelChange)="redraw()" class="mt-2 w-full accent-cta" />
              </label>
              <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Crop % from edges
                <input type="range" min="0" max="30" [(ngModel)]="cropPct" (ngModelChange)="redraw()" class="mt-2 w-full accent-cta" />
              </label>
            </div>
            <button type="button" (click)="exportEdited()" class="h-9 rounded-md bg-[#121417] px-3 text-xs font-semibold text-white hover:bg-[#27272a] dark:bg-zinc-100 dark:text-zinc-900">Export to media library</button>
            @if (mediaPreview() && !videoPreview()) {
              <img [src]="mediaPreview()!" alt="Edited media" class="mt-2 max-h-48 rounded-lg border border-[#e8e8e3] dark:border-zinc-700" />
            }
          </section>

          <section class="grid gap-3 rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] sm:grid-cols-2 dark:border-zinc-700 dark:bg-zinc-900">
            <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Schedule
              <input type="datetime-local" [(ngModel)]="when" class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal text-[#121417] outline-none focus:border-[#121417] focus:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
            </label>
            <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Delay (seconds)
              <input type="number" [(ngModel)]="delaySeconds" min="0" class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal outline-none focus:border-[#121417] focus:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
            </label>
            <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Repeat
              <select [(ngModel)]="repeatRule" class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal outline-none focus:border-[#121417] focus:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
            <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Repeat until
              <input type="date" [(ngModel)]="repeatUntil" [disabled]="repeatRule==='none'" class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal outline-none focus:border-[#121417] focus:bg-white disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
            </label>
            <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Signature
              <select [(ngModel)]="signatureId" class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
                <option value="">Workspace default</option>
                @for (s of signatures(); track s.id) {
                  <option [value]="s.id">{{ s.name }}{{ s.isDefault ? ' (default)' : '' }}</option>
                }
              </select>
            </label>
            <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Posting set
              <select [(ngModel)]="postingSetId" (ngModelChange)="applySet($event)" class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
                <option value="">Manual channels</option>
                @for (s of sets(); track s.id) {
                  <option [value]="s.id">{{ s.name }}</option>
                }
              </select>
            </label>
            <label class="text-[11px] font-semibold text-[#71717a] sm:col-span-2 dark:text-zinc-400">First comment
              <input [(ngModel)]="commentBody" class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal outline-none focus:border-[#121417] focus:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
            </label>
          </section>

          <button type="button" (click)="schedule()" class="inline-flex h-10 items-center rounded-full bg-cta px-5 text-sm font-semibold text-white hover:bg-cta-hover">Schedule post</button>
        </div>

        <aside class="space-y-4">
          <section class="rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
            <p class="mb-2 font-mono text-[10px] uppercase tracking-wider text-[#92969b] dark:text-zinc-500">Cross-post channels</p>
            @for (a of accounts(); track a.id) {
              <label class="flex items-center gap-2 py-1.5 text-[13px] dark:text-zinc-200">
                <input type="checkbox" [checked]="selected().includes(a.id)" (change)="toggle(a.id)" class="accent-cta" />
                <span>{{ a.network }} · {{ a.handle }}</span>
              </label>
            } @empty {
              <p class="text-[12px] text-[#63676c] dark:text-zinc-400">Connect accounts first.</p>
            }
          </section>
          <section class="space-y-1 rounded-xl border border-[#e8e8e3] bg-white p-4 text-[12px] text-[#63676c] shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            <p class="font-semibold text-[#121417] dark:text-zinc-100">Plan quotas</p>
            <p>AI images {{ usage()?.used?.['aiImages'] || 0 }}/{{ usage()?.limits?.aiImages ?? 0 }}</p>
            <p>AI videos {{ usage()?.used?.['aiVideos'] || 0 }}/{{ usage()?.limits?.aiVideos ?? 0 }}</p>
            <p>Clip min {{ usage()?.used?.['aiClipMinutes'] || 0 }}/{{ usage()?.limits?.aiClipMinutes ?? 0 }}</p>
            <p>Copilot {{ usage()?.used?.['aiCopilot'] || 0 }}/{{ usage()?.limits?.aiCopilot ?? 0 }}</p>
          </section>
        </aside>
      </div>
    </div>
  `,
})
export class ComposerPage implements OnInit {
  @ViewChild("canvas") canvasRef?: ElementRef<HTMLCanvasElement>;

  body = "";
  when = "";
  delaySeconds = 0;
  repeatRule = "none";
  repeatUntil = "";
  commentBody = "";
  overlay = "";
  signatureId = "";
  postingSetId = "";
  exportFormat: "image/png" | "image/jpeg" = "image/png";
  brightness = 100;
  contrast = 100;
  cropPct = 0;
  sourceMediaId = "";
  private sourceImg: HTMLImageElement | null = null;
  mediaPreview = signal<string | null>(null);
  videoPreview = signal<string | null>(null);
  accounts = signal<{ id: string; network: string; handle: string }[]>([]);
  signatures = signal<{ id: string; name: string; body: string; isDefault: boolean }[]>([]);
  sets = signal<{ id: string; name: string; channelIds: string; templateBody: string | null }[]>([]);
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
      const [ac, sigs, sets] = await Promise.all([
        api<{ accounts: { id: string; network: string; handle: string }[] }>(`/v1/accounts?workspaceId=${me.workspace.id}`),
        api<{ signatures: { id: string; name: string; body: string; isDefault: boolean }[] }>(
          `/v1/org/signatures?workspaceId=${me.workspace.id}`,
        ),
        api<{ sets: { id: string; name: string; channelIds: string; templateBody: string | null }[] }>(
          `/v1/org/sets?workspaceId=${me.workspace.id}`,
        ),
      ]);
      this.accounts.set(ac.accounts);
      this.signatures.set(sigs.signatures);
      this.sets.set(sets.sets);
      const def = sigs.signatures.find((s) => s.isDefault);
      if (def) this.signatureId = def.id;
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

  applySet(id: string) {
    if (!id) return;
    const set = this.sets().find((s) => s.id === id);
    if (!set) return;
    try {
      this.selected.set(JSON.parse(set.channelIds) as string[]);
    } catch {
      /* ignore */
    }
    if (set.templateBody && !this.body.trim()) this.body = set.templateBody;
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
      const url = `${apiBase()}${r.url}`;
      this.mediaPreview.set(url);
      this.videoPreview.set(null);
      await this.loadImageToCanvas(url);
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
      const url = `${apiBase()}${r.url}`;
      this.videoPreview.set(url);
      this.mediaPreview.set(null);
      this.flash("AI clip stored as WebM");
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
    const res = await fetch(`${apiBase()}/v1/media/upload`, { method: "POST", body: fd, credentials: "include" });
    const data = await res.json();
    if (!res.ok) return this.fail(data);
    this.sourceMediaId = data.id;
    const url = `${apiBase()}${data.url}`;
    this.mediaPreview.set(url);
    this.videoPreview.set(null);
    await this.loadImageToCanvas(url);
  }

  private async loadImageToCanvas(url: string) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image load failed"));
      img.src = url;
    });
    this.sourceImg = img;
    this.redraw();
  }

  redraw() {
    const canvas = this.canvasRef?.nativeElement;
    const img = this.sourceImg;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pct = this.cropPct / 100;
    const sx = img.width * pct;
    const sy = img.height * pct;
    const sw = img.width * (1 - 2 * pct);
    const sh = img.height * (1 - 2 * pct);
    canvas.width = 640;
    canvas.height = Math.round(640 * (sh / sw));
    ctx.filter = `brightness(${this.brightness}%) contrast(${this.contrast}%)`;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    ctx.filter = "none";
    if (this.overlay.trim()) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, canvas.height - 48, canvas.width, 48);
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 20px 'Plus Jakarta Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(this.overlay.trim().slice(0, 80), canvas.width / 2, canvas.height - 18);
    }
  }

  async exportEdited() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.sourceImg) return this.fail({ message: "Load an image first" });
    this.redraw();
    const dataUrl = canvas.toDataURL(this.exportFormat, 0.92);
    try {
      const r = await api<{ id: string; url: string }>("/v1/media/edit", {
        method: "POST",
        json: {
          workspaceId: this.workspaceId,
          sourceMediaId: this.sourceMediaId || undefined,
          overlayText: this.overlay,
          imageBase64: dataUrl,
          contentType: this.exportFormat,
          brightness: this.brightness / 100,
          contrast: this.contrast / 100,
          crop: { x: this.cropPct, y: this.cropPct, w: 100 - 2 * this.cropPct, h: 100 - 2 * this.cropPct },
        },
      });
      this.sourceMediaId = r.id;
      this.mediaPreview.set(`${apiBase()}${r.url}`);
      this.flash("Edited PNG/JPEG saved to media library");
    } catch (e: unknown) {
      this.fail(e);
    }
  }

  async schedule() {
    if (!this.selected().length && !this.postingSetId) return this.fail({ message: "Pick at least one channel or a posting set" });
    if (this.repeatRule !== "none" && !this.repeatUntil) {
      return this.fail({ message: "Set an end date (repeat until) for repeated posts" });
    }
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
          repeatUntil: this.repeatUntil ? new Date(this.repeatUntil + "T23:59:59").getTime() : null,
          signatureId: this.signatureId || null,
          postingSetId: this.postingSetId || null,
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
