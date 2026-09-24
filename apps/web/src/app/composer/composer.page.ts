import { Component, ElementRef, OnInit, ViewChild, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { api, apiBase, type PlanSnapshot } from "../lib/api";
import { lsSet } from "../lib/browser";
import { PICTURE_EDITOR_FRAME_MAX, pictureEditorFrameRects } from "../lib/picture-editor";
import { DkChoice, DkDate, DkDateTime, DkPill, DkSelect } from "../ui/forms";

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, DkSelect, DkChoice, DkDate, DkDateTime, DkPill],
  template: `
    <div class="mx-auto w-full max-w-7xl">
      <div class="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 class="font-display text-2xl font-bold tracking-tight text-[#121417] dark:text-zinc-50">Compose</h1>
          <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Draft once, cross-post, attach media, and schedule.</p>
        </div>
        <button type="button" (click)="schedule()" class="hidden rounded-xl bg-cta px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-cta-hover lg:inline-flex">
          Schedule post
        </button>
      </div>

      @if (msg()) {
        <p class="mb-6 rounded-2xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px] shadow-xs dark:border-zinc-700 dark:bg-zinc-900" [class.text-red-600]="err()" [class.text-[#365314]]="!err()">{{ msg() }}</p>
      }

      <div class="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
        <div class="space-y-6 lg:col-span-2">
          <section class="rounded-2xl border border-[#e8e8e3] bg-white p-5 shadow-xs dark:border-zinc-700 dark:bg-zinc-900">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#e8e8e3] pb-3 dark:border-zinc-700">
              <p class="text-xs font-semibold uppercase tracking-wider text-zinc-400">Draft</p>
              <div class="flex flex-wrap items-center gap-2">
                <button type="button" (click)="copilot()" [disabled]="!!aiBusy()" class="inline-flex items-center gap-1.5 rounded-lg border border-[#e8e8e3] bg-[#f7f7f4] px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
                  <span class="size-1.5 rounded-full bg-cta"></span>
                  {{ aiBusy() === 'copilot' ? 'Generating…' : 'Write caption' }}
                </button>
                <button type="button" (click)="aiImage()" [disabled]="!!aiBusy() || (usage()?.limits.aiImages||0)===0" class="rounded-lg border border-[#e8e8e3] bg-[#f7f7f4] px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">{{ aiBusy() === 'image' ? 'Generating…' : 'Generate image' }}</button>
                <button type="button" (click)="aiVideo()" [disabled]="!!aiBusy()" class="rounded-lg border border-[#e8e8e3] bg-[#f7f7f4] px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">{{ aiBusy() === 'video' ? 'Generating…' : 'Generate AI video' }}</button>
              </div>
            </div>
            <textarea
              [(ngModel)]="body"
              rows="6"
              placeholder="What are you posting?"
              class="w-full resize-y border-0 bg-transparent p-0 font-sans text-sm text-[#121417] outline-none placeholder:text-zinc-400 focus:ring-0 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            ></textarea>
            @if (aiBusy() === 'video' || attachments().length) {
              <div class="mt-3 space-y-3 border-t border-[#e8e8e3] pt-3 dark:border-zinc-700">
                @if (aiBusy() === 'video') {
                  <div class="flex aspect-video min-h-[240px] w-full items-center justify-center rounded-xl border border-dashed border-[#e8e8e3] bg-[#f7f7f4] dark:border-zinc-700 dark:bg-zinc-800">
                    <p class="text-sm font-medium text-zinc-600 dark:text-zinc-300">Generating AI video…</p>
                  </div>
                }
                @for (m of attachments(); track m.id) {
                  @if (m.kind === 'video') {
                    <div class="relative">
                      <video [src]="m.url" controls playsinline class="aspect-video min-h-[240px] w-full rounded-xl border border-[#e8e8e3] bg-black object-contain dark:border-zinc-700"></video>
                      <button type="button" (click)="removeAttachment(m.id)" class="absolute right-2 top-2 rounded-lg bg-black/70 px-2 py-1 text-[11px] font-medium text-white">Remove</button>
                    </div>
                  }
                }
                @if (imageAttachments().length) {
                  <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    @for (m of imageAttachments(); track m.id) {
                      <div class="relative overflow-hidden rounded-xl border border-[#e8e8e3] dark:border-zinc-700">
                        <img [src]="m.url" alt="Attached image" class="h-28 w-full object-cover" />
                        <button type="button" (click)="removeAttachment(m.id)" class="absolute right-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">Remove</button>
                      </div>
                    }
                  </div>
                }
              </div>
            }
            <div class="mt-3 flex flex-wrap items-center gap-2 border-t border-[#e8e8e3] pt-3 dark:border-zinc-700">
              <label class="relative inline-flex cursor-pointer items-center rounded-lg border border-[#e8e8e3] bg-[#f7f7f4] px-2.5 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
                Add photos or videos
                <input type="file" accept="image/*,video/*" multiple (change)="onAttachFiles($event)" class="absolute inset-0 cursor-pointer opacity-0" />
              </label>
              @if (attachments().length) {
                <span class="text-[11px] text-zinc-400">{{ attachments().length }} attached</span>
              }
            </div>
          </section>

          <section class="space-y-5 rounded-2xl border border-[#e8e8e3] bg-white p-6 shadow-xs dark:border-zinc-700 dark:bg-zinc-900">
            <div>
              <h2 class="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">Publish Options</h2>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">When it goes out, and how it repeats.</p>
            </div>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 md:col-span-2">Schedule
                <div class="mt-1.5"><dk-datetime [(ngModel)]="when" placeholder="Pick date & time" /></div>
              </label>
              <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Post delay (seconds)
                <input type="number" [(ngModel)]="delaySeconds" min="0" [class]="fieldMt" />
              </label>
            </div>
            <div>
              <p class="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">Repeat</p>
              <div class="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Repeat">
                <dk-choice value="none" [selected]="repeatRule==='none'" (pick)="repeatRule=$event">None</dk-choice>
                <dk-choice value="daily" [selected]="repeatRule==='daily'" (pick)="repeatRule=$event">Daily</dk-choice>
                <dk-choice value="weekly" [selected]="repeatRule==='weekly'" (pick)="repeatRule=$event">Weekly</dk-choice>
              </div>
            </div>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Repeat until
                <div class="mt-1.5" [class.pointer-events-none]="repeatRule==='none'" [class.opacity-40]="repeatRule==='none'">
                  <dk-date [(ngModel)]="repeatUntil" placeholder="End date" />
                </div>
              </label>
              <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Signature
                <div class="mt-1.5">
                  <dk-select [(ngModel)]="signatureId">
                    <option value="">Account default</option>
                    @for (s of signatures(); track s.id) {
                      <option [value]="s.id">{{ s.name }}{{ s.isDefault ? ' (default)' : '' }}</option>
                    }
                  </dk-select>
                </div>
              </label>
            </div>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Posting set
                <div class="mt-1.5">
                  <dk-select [(ngModel)]="postingSetId" (ngModelChange)="applySet($event)">
                    <option value="">Manual channels</option>
                    @for (s of sets(); track s.id) {
                      <option [value]="s.id">{{ s.name }}</option>
                    }
                  </dk-select>
                </div>
              </label>
              <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Target group
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

          <section class="space-y-4 rounded-2xl border border-[#e8e8e3] bg-white p-6 shadow-xs dark:border-zinc-700 dark:bg-zinc-900">
            <div>
              <h2 class="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">First Comment</h2>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">Optional reply under the post. Delay waits before sending.</p>
            </div>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 md:col-span-2">Comment body
                <input [(ngModel)]="commentBody" placeholder="Link in bio…" [class]="fieldMt" />
              </label>
              <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Delay (sec)
                <input type="number" [(ngModel)]="commentDelaySeconds" min="0" [disabled]="!commentBody" [class]="fieldMt" />
              </label>
            </div>
          </section>

          <section class="space-y-6 rounded-2xl border border-[#e8e8e3] bg-white p-6 shadow-xs dark:border-zinc-700 dark:bg-zinc-900">
            <div>
              <h2 class="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">Picture Editor</h2>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">Upload, adjust, overlay text, export into the media library.</p>
            </div>
            <label class="relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#e8e8e3] bg-[#fcfcf9] p-8 text-center transition-colors hover:bg-[#f7f7f4] dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-800/80">
              <span class="text-sm font-medium text-[#121417] dark:text-zinc-100">Choose an image</span>
              <span class="mt-1 text-xs text-zinc-400 dark:text-zinc-400">PNG or JPEG</span>
              <input type="file" accept="image/*" (change)="onFile($event)" class="absolute inset-0 cursor-pointer opacity-0" />
            </label>
            <div class="flex h-64 items-center justify-center rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] p-2 dark:border-zinc-700 dark:bg-zinc-800">
              <canvas #canvas width="640" height="480" class="max-h-full max-w-full h-auto w-auto rounded-md"></canvas>
            </div>
            <div>
              <p class="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">Aspect</p>
              <div class="grid grid-cols-2 gap-3 md:grid-cols-4" role="radiogroup" aria-label="Aspect">
                <dk-choice value="original" [selected]="aspectPreset==='original'" (pick)="setAspect($event)">Original</dk-choice>
                <dk-choice value="1:1" [selected]="aspectPreset==='1:1'" (pick)="setAspect($event)">1:1</dk-choice>
                <dk-choice value="4:5" [selected]="aspectPreset==='4:5'" (pick)="setAspect($event)">4:5</dk-choice>
                <dk-choice value="16:9" [selected]="aspectPreset==='16:9'" (pick)="setAspect($event)">16:9</dk-choice>
              </div>
            </div>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p class="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">Format</p>
                <div class="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Format">
                  <dk-choice value="image/png" [selected]="exportFormat==='image/png'" (pick)="exportFormat=$any($event)">PNG</dk-choice>
                  <dk-choice value="image/jpeg" [selected]="exportFormat==='image/jpeg'" (pick)="exportFormat=$any($event)">JPEG</dk-choice>
                </div>
              </div>
              <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Overlay text
                <input [(ngModel)]="overlay" (ngModelChange)="redraw()" [class]="fieldMt" />
              </label>
            </div>
            <div class="space-y-4 pt-2">
              <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Brightness {{ brightness }}
                <input type="range" min="50" max="150" [(ngModel)]="brightness" (ngModelChange)="redraw()" class="mt-1.5 h-2 w-full cursor-pointer rounded-lg bg-zinc-200 accent-cta" />
              </label>
              <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Contrast {{ contrast }}
                <input type="range" min="50" max="150" [(ngModel)]="contrast" (ngModelChange)="redraw()" class="mt-1.5 h-2 w-full cursor-pointer rounded-lg bg-zinc-200 accent-cta" />
              </label>
              <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Inset crop %
                <input type="range" min="0" max="30" [(ngModel)]="cropPct" (ngModelChange)="redraw()" class="mt-1.5 h-2 w-full cursor-pointer rounded-lg bg-zinc-200 accent-cta" />
              </label>
            </div>
            <div>
              <button type="button" (click)="exportEdited()" class="rounded-xl bg-[#121417] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white">Export to media library</button>
            </div>
          </section>

          <div class="pb-2 lg:hidden">
            <button type="button" (click)="schedule()" class="w-full rounded-xl bg-cta px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-cta-hover">Schedule post</button>
          </div>
        </div>

        <aside class="space-y-6 lg:sticky lg:top-6">
          <section class="space-y-3 rounded-2xl border border-[#e8e8e3] bg-white p-5 shadow-xs dark:border-zinc-700 dark:bg-zinc-900">
            <div>
              <h2 class="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">Channels</h2>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">Cross-post destinations</p>
            </div>
            <div class="space-y-3">
              @for (g of channelGroups; track g.id) {
                @if (accountsIn(g.id).length) {
                  <div>
                    <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{{ g.label }}</p>
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
                <p class="rounded-xl border border-[#e8e8e3] bg-[#fcfcf9] p-4 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  Connect channels in <a routerLink="/app/accounts" class="font-medium text-cta underline">Accounts</a>.
                </p>
              }
            </div>
          </section>

          <section class="space-y-4 rounded-2xl border border-[#e8e8e3] bg-white p-5 shadow-xs dark:border-zinc-700 dark:bg-zinc-900">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-400">Plan Quotas</h2>
            <dl class="space-y-2.5 text-xs">
              <div class="flex items-center justify-between border-b border-[#e8e8e3]/60 pb-2 dark:border-zinc-700">
                <dt class="text-zinc-600 dark:text-zinc-400">AI images</dt>
                <dd class="font-mono font-semibold text-[#121417] dark:text-zinc-100">{{ usage()?.used?.['aiImages'] || 0 }}/{{ usage()?.limits?.aiImages ?? 0 }}</dd>
              </div>
              <div class="flex items-center justify-between border-b border-[#e8e8e3]/60 pb-2 dark:border-zinc-700">
                <dt class="text-zinc-600 dark:text-zinc-400">AI videos</dt>
                <dd class="font-mono font-semibold text-[#121417] dark:text-zinc-100">{{ usage()?.used?.['aiVideos'] || 0 }}/{{ usage()?.limits?.aiVideos ?? 0 }}</dd>
              </div>
              <div class="flex items-center justify-between">
                <dt class="text-zinc-600 dark:text-zinc-400">Copilot</dt>
                <dd class="font-mono font-semibold text-[#121417] dark:text-zinc-100">{{ usage()?.used?.['aiCopilot'] || 0 }}/{{ usage()?.limits?.aiCopilot ?? 0 }}</dd>
              </div>
            </dl>
          </section>

          <section class="hidden rounded-2xl border border-[#e8e8e3] bg-white p-5 shadow-xs lg:block dark:border-zinc-700 dark:bg-zinc-900">
            <button type="button" (click)="schedule()" class="w-full rounded-xl bg-cta px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-all hover:bg-cta-hover">
              Schedule post
            </button>
          </section>
        </aside>
      </div>
    </div>
  `,
})
export class ComposerPage implements OnInit {
  @ViewChild("canvas") canvasRef?: ElementRef<HTMLCanvasElement>;
  readonly fieldMt =
    "mt-1.5 h-11 w-full rounded-xl border border-[#e8e8e3] bg-[#fcfcf9] px-3.5 text-sm text-[#121417] outline-none transition-colors focus:border-cta focus:ring-1 focus:ring-cta disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100";
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
  attachments = signal<{ id: string; url: string; kind: "image" | "video" }[]>([]);
  aiBusy = signal<null | "copilot" | "image" | "video">(null);
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

  imageAttachments() {
    return this.attachments().filter((m) => m.kind === "image");
  }

  private instagramSelected() {
    return this.accounts().some((a) => a.network === "instagram" && this.selected().includes(a.id));
  }

  pushAttachment(item: { id: string; url: string; kind: "image" | "video" }) {
    if (!item.id) return;
    this.attachments.update((list) => (list.some((a) => a.id === item.id) ? list : [...list, item]));
  }

  removeAttachment(id: string) {
    this.attachments.update((list) => list.filter((a) => a.id !== id));
    if (this.sourceMediaId === id) this.sourceMediaId = "";
  }

  async copilot() {
    if (this.aiBusy()) return;
    this.aiBusy.set("copilot");
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
    } finally {
      this.aiBusy.set(null);
    }
  }

  async aiImage() {
    if (this.aiBusy()) return;
    this.aiBusy.set("image");
    try {
      const r = await api<{ id: string; url: string }>("/v1/ai/image", {
        method: "POST",
        json: { workspaceId: this.workspaceId, prompt: this.body || "Abstract paper desk poster" },
      });
      this.sourceMediaId = r.id;
      const url = `${apiBase()}${r.url}`;
      this.pushAttachment({ id: r.id, url, kind: "image" });
      await this.loadImageToCanvas(url);
      this.flash("AI image stored");
      await this.refreshUsage();
    } catch (e: unknown) {
      this.fail(e);
    } finally {
      this.aiBusy.set(null);
    }
  }

  async aiVideo() {
    if (this.aiBusy()) return;
    this.aiBusy.set("video");
    try {
      const r = await api<{ id: string; url: string; contentType?: string }>("/v1/ai/video", {
        method: "POST",
        json: {
          workspaceId: this.workspaceId,
          prompt: this.body || "Sunset over a quiet Main Street",
          durationSec: 8,
        },
      });
      const url = `${apiBase()}${r.url}`;
      this.pushAttachment({ id: r.id, url, kind: "video" });
      this.flash("AI video ready");
      await this.refreshUsage();
    } catch (e: unknown) {
      this.fail(e);
    } finally {
      this.aiBusy.set(null);
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
    try {
      await this.loadImageToCanvas(localUrl);
    } catch (e: unknown) {
      URL.revokeObjectURL(localUrl);
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
      if (data.id && data.url) {
        this.pushAttachment({ id: data.id, url: `${apiBase()}${data.url}`, kind: "image" });
      }
      this.flash("Image uploaded to media library");
    } catch (e: unknown) {
      this.fail(e instanceof Error ? e : { message: "Upload failed" });
    }
  }

  async onAttachFiles(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const files = [...(input.files || [])];
    input.value = "";
    if (!files.length) return;
    if (!this.workspaceId) return this.fail({ message: "Sign in to upload to the media library" });

    let added = 0;
    for (const file of files) {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) {
        this.fail({ message: "Choose images or videos" });
        continue;
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
          this.fail({ message: data.message || data.error || "Upload failed" });
          continue;
        }
        if (data.id && data.url) {
          this.pushAttachment({
            id: data.id,
            url: `${apiBase()}${data.url}`,
            kind: isVideo ? "video" : "image",
          });
          added += 1;
        }
      } catch (e: unknown) {
        this.fail(e instanceof Error ? e : { message: "Upload failed" });
      }
    }
    if (added) this.flash(added === 1 ? "Media attached" : `${added} files attached`);
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
  private frameRects(img: HTMLImageElement) {
    return pictureEditorFrameRects(img, this.aspectPreset, this.cropPct, PICTURE_EDITOR_FRAME_MAX);
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
      this.pushAttachment({ id: r.id, url: `${apiBase()}${r.url}`, kind: "image" });
      this.flash("Edited PNG/JPEG saved to media library");
    } catch (e: unknown) {
      this.fail(e);
    }
  }

  async schedule() {
    if (!this.selected().length && !this.postingSetId) return this.fail({ message: "Pick at least one channel or a posting set" });
    if (this.instagramSelected() && !this.imageAttachments().length) {
      return this.fail({ message: "Instagram feed posts need an attached image." });
    }
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
          mediaIds: this.attachments().map((a) => a.id),
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
