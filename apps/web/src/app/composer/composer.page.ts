import { Component, ElementRef, OnInit, ViewChild, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { api, apiBase, type PlanSnapshot } from "../lib/api";
import { lsSet } from "../lib/browser";
import { DkChoice, DkDate, DkDateTime, DkPill, DkSelect, FIELD } from "../ui/forms";

@Component({
  standalone: true,
  imports: [FormsModule, DkSelect, DkChoice, DkDate, DkDateTime, DkPill],
  template: `
    <div class="mx-auto max-w-6xl">
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Schedule</p>
          <h1 class="mt-1 font-display text-3xl font-bold tracking-tight dark:text-zinc-50">Compose</h1>
          <p class="mt-1 max-w-xl text-sm text-[#63676c] dark:text-zinc-400">Draft once, cross-post, attach media, and schedule.</p>
        </div>
        <button type="button" (click)="schedule()" class="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-cta px-5 text-sm font-semibold text-white shadow-[0_1px_3px_rgba(15,18,24,0.12)] hover:bg-cta-hover">
          Schedule post
        </button>
      </div>

      @if (msg()) {
        <p class="mb-4 rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px] shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900" [class.text-red-600]="err()" [class.text-[#365314]]="!err()">{{ msg() }}</p>
      }

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div class="space-y-5">
          <section class="overflow-hidden rounded-xl border border-[#e8e8e3] bg-white shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8e8e3] px-4 py-3 dark:border-zinc-700">
              <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#92969b] dark:text-zinc-500">Draft</p>
              <div class="flex flex-wrap gap-1.5">
                <button type="button" (click)="copilot()" class="inline-flex h-8 items-center rounded-full border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-[11px] font-semibold text-[#121417] hover:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700">AI copilot</button>
                <button type="button" (click)="aiImage()" [disabled]="(usage()?.limits.aiImages||0)===0" class="inline-flex h-8 items-center rounded-full border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-[11px] font-semibold text-[#121417] hover:bg-white disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700">AI image</button>
                <button type="button" (click)="aiVideo()" class="inline-flex h-8 items-center rounded-full border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-[11px] font-semibold text-[#121417] hover:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700">AI clip</button>
              </div>
            </div>
            <textarea
              [(ngModel)]="body"
              rows="10"
              placeholder="What are you posting?"
              class="w-full resize-y border-0 bg-transparent px-4 py-4 font-sans text-[15px] leading-relaxed text-[#121417] outline-none placeholder:text-[#a1a1aa] dark:text-zinc-100 dark:placeholder:text-zinc-500"
            ></textarea>
            @if (videoPreview()) {
              <div class="border-t border-[#e8e8e3] px-4 py-3 dark:border-zinc-700">
                <video [src]="videoPreview()!" controls class="max-h-56 w-full rounded-lg border border-[#e8e8e3] dark:border-zinc-700"></video>
              </div>
            }
            @if (mediaPreview() && !videoPreview()) {
              <div class="border-t border-[#e8e8e3] px-4 py-3 dark:border-zinc-700">
                <img [src]="mediaPreview()!" alt="Edited media" class="max-h-48 rounded-lg border border-[#e8e8e3] dark:border-zinc-700" />
              </div>
            }
          </section>

          <section class="rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
            <div class="mb-4 flex items-baseline justify-between gap-2">
              <div>
                <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#92969b] dark:text-zinc-500">Publish options</p>
                <p class="mt-0.5 text-[12px] text-[#63676c] dark:text-zinc-400">When it goes out, and how it repeats.</p>
              </div>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="block text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Schedule
                <div class="mt-1.5"><dk-datetime [(ngModel)]="when" placeholder="Pick date & time" /></div>
              </label>
              <label class="block text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Post delay (seconds)
                <input type="number" [(ngModel)]="delaySeconds" min="0" [class]="fieldMt" />
              </label>
              <div class="sm:col-span-2">
                <p class="mb-2 text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Repeat</p>
                <div class="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Repeat">
                  <dk-choice value="none" [selected]="repeatRule==='none'" (pick)="repeatRule=$event">None</dk-choice>
                  <dk-choice value="daily" [selected]="repeatRule==='daily'" (pick)="repeatRule=$event">Daily</dk-choice>
                  <dk-choice value="weekly" [selected]="repeatRule==='weekly'" (pick)="repeatRule=$event">Weekly</dk-choice>
                </div>
              </div>
              <label class="block text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Repeat until
                <div class="mt-1.5" [class.pointer-events-none]="repeatRule==='none'" [class.opacity-40]="repeatRule==='none'">
                  <dk-date [(ngModel)]="repeatUntil" placeholder="End date" />
                </div>
              </label>
              <label class="block text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Signature
                <div class="mt-1.5">
                  <dk-select [(ngModel)]="signatureId">
                    <option value="">Workspace default</option>
                    @for (s of signatures(); track s.id) {
                      <option [value]="s.id">{{ s.name }}{{ s.isDefault ? ' (default)' : '' }}</option>
                    }
                  </dk-select>
                </div>
              </label>
              <label class="block text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Posting set
                <div class="mt-1.5">
                  <dk-select [(ngModel)]="postingSetId" (ngModelChange)="applySet($event)">
                    <option value="">Manual channels</option>
                    @for (s of sets(); track s.id) {
                      <option [value]="s.id">{{ s.name }}</option>
                    }
                  </dk-select>
                </div>
              </label>
              <label class="block text-[11px] font-semibold text-[#71717a] sm:col-span-2 dark:text-zinc-400">Target group
                <div class="mt-1.5">
                  <dk-select [(ngModel)]="groupId" (ngModelChange)="applyGroup($event)">
                    <option value="">Manual channels</option>
                    @for (g of groups(); track g.id) {
                      <option [value]="g.id">{{ g.name }} ({{ g.accountIds.length }})</option>
                    }
                  </dk-select>
                </div>
              </label>
            </div>
          </section>

          <section class="rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
            <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#92969b] dark:text-zinc-500">First comment</p>
            <p class="mt-0.5 text-[12px] text-[#63676c] dark:text-zinc-400">Optional reply under the post. Delay waits before sending.</p>
            <div class="mt-3 grid gap-3 sm:grid-cols-[1fr_10rem]">
              <label class="block text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Comment body
                <input [(ngModel)]="commentBody" placeholder="Link in bio…" [class]="fieldMt" />
              </label>
              <label class="block text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Delay (sec)
                <input type="number" [(ngModel)]="commentDelaySeconds" min="0" [disabled]="!commentBody" [class]="fieldMt" />
              </label>
            </div>
          </section>

          <section class="rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
            <div class="mb-4">
              <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#92969b] dark:text-zinc-500">Picture editor</p>
              <p class="mt-0.5 text-[12px] text-[#63676c] dark:text-zinc-400">Upload, adjust, overlay text, export into the media library.</p>
            </div>
            <label class="relative mb-3 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#e8e8e3] bg-[#f7f7f4] px-4 py-5 text-center transition-colors hover:border-[#c4c4c0] hover:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-800/80">
              <span class="text-[12px] font-semibold text-[#121417] dark:text-zinc-100">Choose an image</span>
              <span class="mt-0.5 text-[11px] text-[#63676c] dark:text-zinc-400">PNG or JPEG</span>
              <input type="file" accept="image/*" (change)="onFile($event)" class="absolute inset-0 cursor-pointer opacity-0" />
            </label>
            <div class="mb-3 flex justify-center rounded-lg border border-[#e8e8e3] bg-[#f7f7f4] p-2 dark:border-zinc-700 dark:bg-zinc-800">
              <canvas #canvas width="640" height="480" class="max-h-56 max-w-full h-auto w-auto rounded-md"></canvas>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="sm:col-span-2">
                <p class="mb-2 text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Aspect</p>
                <div class="grid gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Aspect">
                  <dk-choice value="original" [selected]="aspectPreset==='original'" (pick)="setAspect($event)">Original</dk-choice>
                  <dk-choice value="1:1" [selected]="aspectPreset==='1:1'" (pick)="setAspect($event)">1:1</dk-choice>
                  <dk-choice value="4:5" [selected]="aspectPreset==='4:5'" (pick)="setAspect($event)">4:5</dk-choice>
                  <dk-choice value="16:9" [selected]="aspectPreset==='16:9'" (pick)="setAspect($event)">16:9</dk-choice>
                </div>
              </div>
              <div>
                <p class="mb-2 text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Format</p>
                <div class="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Format">
                  <dk-choice value="image/png" [selected]="exportFormat==='image/png'" (pick)="exportFormat=$any($event)">PNG</dk-choice>
                  <dk-choice value="image/jpeg" [selected]="exportFormat==='image/jpeg'" (pick)="exportFormat=$any($event)">JPEG</dk-choice>
                </div>
              </div>
              <label class="block text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Overlay text
                <input [(ngModel)]="overlay" (ngModelChange)="redraw()" [class]="fieldMt" />
              </label>
              <label class="block text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Brightness {{ brightness }}
                <input type="range" min="50" max="150" [(ngModel)]="brightness" (ngModelChange)="redraw()" class="mt-2 w-full accent-cta" />
              </label>
              <label class="block text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Contrast {{ contrast }}
                <input type="range" min="50" max="150" [(ngModel)]="contrast" (ngModelChange)="redraw()" class="mt-2 w-full accent-cta" />
              </label>
              <label class="block text-[11px] font-semibold text-[#71717a] sm:col-span-2 dark:text-zinc-400">Inset crop %
                <input type="range" min="0" max="30" [(ngModel)]="cropPct" (ngModelChange)="redraw()" class="mt-2 w-full accent-cta" />
              </label>
            </div>
            <button type="button" (click)="exportEdited()" class="mt-4 inline-flex h-9 items-center rounded-full bg-[#121417] px-4 text-xs font-semibold text-white hover:bg-[#27272a] dark:bg-zinc-100 dark:text-zinc-900">Export to media library</button>
          </section>

          <div class="flex justify-end pb-2 lg:hidden">
            <button type="button" (click)="schedule()" class="inline-flex h-10 items-center rounded-full bg-cta px-5 text-sm font-semibold text-white hover:bg-cta-hover">Schedule post</button>
          </div>
        </div>

        <aside class="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section class="rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
            <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#92969b] dark:text-zinc-500">Channels</p>
            <p class="mt-0.5 text-[12px] text-[#63676c] dark:text-zinc-400">Cross-post destinations</p>
            <div class="mt-3 max-h-72 space-y-3 overflow-y-auto">
              @for (g of channelGroups; track g.id) {
                @if (accountsIn(g.id).length) {
                  <div>
                    <p class="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#92969b]">{{ g.label }}</p>
                    <div class="flex flex-wrap gap-1.5">
                      @for (a of accountsIn(g.id); track a.id) {
                        <dk-pill [on]="selected().includes(a.id)" (toggle)="toggle(a.id)">
                          <span class="inline-flex items-center gap-1.5">
                            <img [src]="'/assets/logos/' + a.network + '.svg'" [alt]="networkLabel(a.network)" width="14" height="14" class="size-3.5 shrink-0 object-contain" />
                            {{ networkLabel(a.network) }} · {{ a.handle }}
                          </span>
                        </dk-pill>
                      }
                    </div>
                  </div>
                }
              }
              @if (!accounts().length) {
                <p class="rounded-lg bg-[#f7f7f4] px-3 py-3 text-[12px] text-[#63676c] dark:bg-zinc-800 dark:text-zinc-400">Connect accounts in Workspace → Accounts.</p>
              }
            </div>
          </section>

          <section class="rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
            <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#92969b] dark:text-zinc-500">Plan quotas</p>
            <dl class="mt-3 space-y-2 text-[12px]">
              <div class="flex justify-between gap-2"><dt class="text-[#63676c] dark:text-zinc-400">AI images</dt><dd class="font-mono font-semibold dark:text-zinc-100">{{ usage()?.used?.['aiImages'] || 0 }}/{{ usage()?.limits?.aiImages ?? 0 }}</dd></div>
              <div class="flex justify-between gap-2"><dt class="text-[#63676c] dark:text-zinc-400">AI videos</dt><dd class="font-mono font-semibold dark:text-zinc-100">{{ usage()?.used?.['aiVideos'] || 0 }}/{{ usage()?.limits?.aiVideos ?? 0 }}</dd></div>
              <div class="flex justify-between gap-2"><dt class="text-[#63676c] dark:text-zinc-400">Clip min</dt><dd class="font-mono font-semibold dark:text-zinc-100">{{ usage()?.used?.['aiClipMinutes'] || 0 }}/{{ usage()?.limits?.aiClipMinutes ?? 0 }}</dd></div>
              <div class="flex justify-between gap-2"><dt class="text-[#63676c] dark:text-zinc-400">Copilot</dt><dd class="font-mono font-semibold dark:text-zinc-100">{{ usage()?.used?.['aiCopilot'] || 0 }}/{{ usage()?.limits?.aiCopilot ?? 0 }}</dd></div>
            </dl>
          </section>

          <button type="button" (click)="schedule()" class="hidden w-full items-center justify-center rounded-full bg-cta px-5 py-2.5 text-sm font-semibold text-white hover:bg-cta-hover lg:inline-flex">
            Schedule post
          </button>
        </aside>
      </div>
    </div>
  `,
})
export class ComposerPage implements OnInit {
  @ViewChild("canvas") canvasRef?: ElementRef<HTMLCanvasElement>;
  readonly fieldMt = `mt-1.5 ${FIELD}`;
  readonly channelGroups = [
    { id: "social" as const, label: "Social" },
    { id: "blogs" as const, label: "Blogs" },
    { id: "chat" as const, label: "Chat" },
  ];
  private static readonly NET_META: Record<string, { label: string; group: "social" | "blogs" | "chat" }> = {
    linkedin: { label: "LinkedIn", group: "social" },
    x: { label: "X", group: "social" },
    instagram: { label: "Instagram", group: "social" },
    threads: { label: "Threads", group: "social" },
    facebook: { label: "Facebook", group: "social" },
    youtube: { label: "YouTube", group: "social" },
    reddit: { label: "Reddit", group: "social" },
    bluesky: { label: "Bluesky", group: "social" },
    mastodon: { label: "Mastodon", group: "social" },
    hashnode: { label: "Hashnode", group: "blogs" },
    medium: { label: "Medium", group: "blogs" },
    devto: { label: "dev.to", group: "blogs" },
    telegram: { label: "Telegram", group: "chat" },
    discord: { label: "Discord", group: "chat" },
    slack: { label: "Slack", group: "chat" },
  };

  body = "";
  when = "";
  delaySeconds = 0;
  repeatRule = "none";
  repeatUntil = "";
  commentBody = "";
  commentDelaySeconds = 0;
  overlay = "";
  signatureId = "";
  postingSetId = "";
  groupId = "";
  exportFormat: "image/png" | "image/jpeg" = "image/png";
  aspectPreset: "original" | "1:1" | "4:5" | "16:9" = "original";
  brightness = 100;
  contrast = 100;
  cropPct = 0;
  sourceMediaId = "";
  private sourceImg: HTMLImageElement | null = null;
  private static readonly FRAME_MAX = 640;
  mediaPreview = signal<string | null>(null);
  videoPreview = signal<string | null>(null);
  accounts = signal<{ id: string; network: string; handle: string }[]>([]);
  signatures = signal<{ id: string; name: string; body: string; isDefault: boolean }[]>([]);
  sets = signal<{ id: string; name: string; channelIds: string; templateBody: string | null }[]>([]);
  groups = signal<{ id: string; name: string; accountIds: string[] }[]>([]);
  selected = signal<string[]>([]);
  usage = signal<PlanSnapshot | null>(null);
  msg = signal("");
  err = signal(false);
  workspaceId = "";

  networkLabel(n: string) {
    return ComposerPage.NET_META[n]?.label || n;
  }

  accountsIn(group: "social" | "blogs" | "chat") {
    return this.accounts().filter((a) => (ComposerPage.NET_META[a.network]?.group || "social") === group);
  }

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string }; usage: PlanSnapshot }>("/v1/workspaces/me");
      this.workspaceId = me.workspace.id;
      lsSet("dk-ws", me.workspace.id);
      this.usage.set(me.usage);
      const [ac, sigs, sets, groups] = await Promise.all([
        api<{ accounts: { id: string; network: string; handle: string }[] }>(`/v1/accounts?workspaceId=${me.workspace.id}`),
        api<{ signatures: { id: string; name: string; body: string; isDefault: boolean }[] }>(
          `/v1/org/signatures?workspaceId=${me.workspace.id}`,
        ),
        api<{ sets: { id: string; name: string; channelIds: string; templateBody: string | null }[] }>(
          `/v1/org/sets?workspaceId=${me.workspace.id}`,
        ),
        api<{ groups: { id: string; name: string; accountIds: string[] }[] }>(`/v1/org/groups?workspaceId=${me.workspace.id}`),
      ]);
      this.accounts.set(ac.accounts);
      this.signatures.set(sigs.signatures);
      this.sets.set(sets.sets);
      this.groups.set(groups.groups);
      const def = sigs.signatures.find((s) => s.isDefault);
      if (def) this.signatureId = def.id;
      if (ac.accounts[0]) this.selected.set([ac.accounts[0].id]);
    } catch {
      this.fail(new Error("Sign in to compose posts."));
    }
  }

  setAspect(v: string) {
    this.aspectPreset = v as typeof this.aspectPreset;
    this.redraw();
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

  applyGroup(id: string) {
    if (!id) return;
    const g = this.groups().find((x) => x.id === id);
    if (g?.accountIds?.length) this.selected.set([...g.accountIds]);
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
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      input.value = "";
      return this.fail({ message: "Choose a PNG or JPEG image" });
    }

    // Paint the editor immediately from the local file so choosing an image is never a no-op.
    const localUrl = URL.createObjectURL(file);
    this.videoPreview.set(null);
    this.mediaPreview.set(localUrl);
    try {
      await this.loadImageToCanvas(localUrl);
    } catch (e: unknown) {
      URL.revokeObjectURL(localUrl);
      this.mediaPreview.set(null);
      return this.fail(e instanceof Error ? e : { message: "Could not read image" });
    }

    if (!this.workspaceId) {
      return this.fail({ message: "Sign in to upload to the media library" });
    }

    try {
      const fd = new FormData();
      fd.set("workspaceId", this.workspaceId);
      fd.set("file", file);
      const res = await fetch(`${apiBase()}/v1/media/upload`, { method: "POST", body: fd, credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        url?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        return this.fail({ message: data.message || data.error || "Upload failed" });
      }
      this.sourceMediaId = data.id || "";
      if (data.url) {
        // Keep the blob on the canvas (avoids CORS-tainted draws); use server URL for the draft preview.
        this.mediaPreview.set(`${apiBase()}${data.url}`);
      }
      this.flash("Image uploaded to media library");
    } catch (e: unknown) {
      this.fail(e instanceof Error ? e : { message: "Upload failed" });
    }
  }

  private async loadImageToCanvas(url: string) {
    const img = new Image();
    // blob: URLs must not set crossOrigin; remote media URLs need it for canvas export.
    if (!url.startsWith("blob:") && !url.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image load failed"));
      img.src = url;
    });
    this.sourceImg = img;
    this.aspectPreset = "original";
    this.redraw();
  }

  /** Source cover-rect + dest frame (same aspect → no stretch). */
  private frameRects(img: HTMLImageElement): {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    dw: number;
    dh: number;
  } {
    const inset = this.cropPct / 100;
    const baseX = img.width * inset;
    const baseY = img.height * inset;
    const baseW = img.width * (1 - 2 * inset);
    const baseH = img.height * (1 - 2 * inset);
    const targetAspect =
      this.aspectPreset === "1:1"
        ? 1
        : this.aspectPreset === "4:5"
          ? 4 / 5
          : this.aspectPreset === "16:9"
            ? 16 / 9
            : baseW / Math.max(baseH, 1);

    // Center-cover: largest sub-rect of targetAspect inside the inset box.
    let sw: number;
    let sh: number;
    let sx: number;
    let sy: number;
    if (baseW / baseH > targetAspect) {
      sh = baseH;
      sw = baseH * targetAspect;
      sx = baseX + (baseW - sw) / 2;
      sy = baseY;
    } else {
      sw = baseW;
      sh = baseW / targetAspect;
      sx = baseX;
      sy = baseY + (baseH - sh) / 2;
    }

    // Contain frame in MAX×MAX without changing aspect.
    const max = ComposerPage.FRAME_MAX;
    let dw: number;
    let dh: number;
    if (targetAspect >= 1) {
      dw = max;
      dh = Math.max(1, Math.round(max / targetAspect));
    } else {
      dh = max;
      dw = Math.max(1, Math.round(max * targetAspect));
    }
    return { sx, sy, sw, sh, dw, dh };
  }

  redraw() {
    const canvas = this.canvasRef?.nativeElement;
    const img = this.sourceImg;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { sx, sy, sw, sh, dw, dh } = this.frameRects(img);
    canvas.width = dw;
    canvas.height = dh;
    ctx.clearRect(0, 0, dw, dh);
    ctx.filter = `brightness(${this.brightness}%) contrast(${this.contrast}%)`;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    ctx.filter = "none";
    if (this.overlay.trim()) {
      const bar = Math.max(36, Math.round(dh * 0.1));
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, dh - bar, dw, bar);
      ctx.fillStyle = "#ffffff";
      ctx.font = `600 ${Math.max(14, Math.round(bar * 0.42))}px 'Plus Jakarta Sans', sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(this.overlay.trim().slice(0, 80), dw / 2, dh - Math.round(bar * 0.35));
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
          commentDelaySeconds: this.commentBody ? this.commentDelaySeconds : 0,
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
    const body = e as { message?: string; error?: string; body?: { message?: string; error?: string } };
    this.msg.set(
      body?.body?.message || body?.body?.error || body?.message || body?.error || "Request failed",
    );
  }
}
