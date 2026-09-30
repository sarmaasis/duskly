import { Component, ChangeDetectorRef, DestroyRef, OnInit, effect, forwardRef, inject, signal, untracked } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { api, apiAll, apiBase, type PlanSnapshot } from "../lib/api";
import { CAPTION_LIMITS, countCaptionChars } from "../lib/caption-limits";
import { channelIssues } from "../lib/channel-checks";
import { nextSlotMs, occupiedSlotMs } from "../lib/slots";
import { Notices } from "../lib/notices";
import { isBrowser, lsSet } from "../lib/browser";
import { CompanyDesk } from "../lib/company-desk";
import { COMPOSE, type ComposeStep } from "./compose-context";
import { ComposeWrite } from "./compose-write";
import { ComposePictures } from "./compose-pictures";
import { ComposeChannels } from "./compose-channels";
import { ComposeSchedule } from "./compose-schedule";
import { ComposeMore } from "./compose-more";
import { Spinner } from "../ui/spinner";

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, ComposeWrite, ComposePictures, ComposeChannels, ComposeSchedule, ComposeMore, Spinner],
  providers: [{ provide: COMPOSE, useExisting: forwardRef(() => ComposerPage) }],
  template: `
    <div class="mx-auto w-full max-w-6xl">
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-cta">Compose</p>
          <h1 class="mt-1 font-display text-3xl font-bold tracking-tight text-ink dark:text-zinc-50">{{ editingId ? 'Edit post' : 'Create a new post' }}</h1>
          <p class="mt-1 max-w-xl text-sm text-muted dark:text-zinc-400">Write once, choose the accounts, and schedule it when you are ready.</p>
        </div>
        <button type="button" (click)="schedule(!editingId)" [disabled]="saving()" [attr.aria-busy]="saving()" class="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#e8e8e3] bg-white px-3 text-sm font-medium text-[#121417] disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
          @if (saving()) { <dk-spinner class="text-cta" /> }
          {{ editingId ? 'Save changes' : 'Save draft' }}
        </button>
      </div>

      @if (msg()) {
        <p class="mb-4 rounded-2xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px] dark:border-zinc-700 dark:bg-zinc-900" [class.text-red-600]="err()" [class.text-[#365314]]="!err()">{{ msg() }} @if (!err()) { <a routerLink="/app" class="ml-2 font-semibold underline">View posts</a> }</p>
      }

      @if (!composerOpen()) {
        <div class="grid gap-3 sm:grid-cols-3">
          @for (kind of postKinds; track kind.id) {
            <button type="button" (click)="chooseKind(kind.id)" [attr.aria-label]="kind.label" class="flex min-h-40 flex-col rounded-2xl border border-[#e8e8e3] bg-white p-5 text-left hover:border-cta dark:border-zinc-700 dark:bg-zinc-900">
              <span class="text-sm font-semibold text-[#121417] dark:text-zinc-100">{{ kind.label }}</span>
              <span class="mt-1 text-xs font-normal leading-5 text-zinc-500">{{ kind.detail }}</span>
              <span class="mt-auto flex items-end pt-5" aria-hidden="true">
                @switch (kind.id) {
                  @case ('text') {
                    <span class="flex w-full flex-col gap-1.5">
                      <span class="h-1.5 w-4/5 rounded-full bg-[#e8e8e3] dark:bg-zinc-700"></span>
                      <span class="h-1.5 w-3/5 rounded-full bg-[#e8e8e3] dark:bg-zinc-700"></span>
                      <span class="h-1.5 w-2/5 rounded-full bg-cta"></span>
                    </span>
                  }
                  @case ('image') {
                    <span class="flex h-14 w-20 items-center justify-center rounded-lg bg-[#f3f3f0] dark:bg-zinc-800">
                      <span class="size-5 rounded-full bg-cta"></span>
                    </span>
                  }
                  @case ('video') {
                    <span class="flex h-14 w-24 items-center justify-center rounded-lg bg-[#121417]">
                      <span class="ml-0.5 size-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-cta"></span>
                    </span>
                  }
                }
              </span>
            </button>
          }
        </div>
      } @else {
      <div class="mb-4 flex items-center justify-between gap-3">
        <p class="text-sm font-semibold text-[#121417] dark:text-zinc-100">{{ kindLabel() }}</p>
        <button type="button" (click)="composerOpen.set(false)" class="text-xs font-semibold text-cta">Change post type</button>
      </div>
      <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div class="flex min-w-0 flex-col gap-5">
          <dk-compose-channels />
          @if (postKind() === 'image' || postKind() === 'video') {
            <dk-compose-pictures [kind]="postKind()" />
          }
          <dk-compose-write />
          @if (previews().length) {
            <section class="rounded-2xl border border-[#e8e8e3] bg-white dark:border-zinc-700 dark:bg-zinc-900">
              <div class="border-b border-[#e8e8e3] px-5 py-4 dark:border-zinc-700">
                <h2 class="text-sm font-semibold text-[#121417] dark:text-zinc-100">Platform captions</h2>
                <p class="mt-0.5 text-xs text-zinc-500">Leave a network on the main caption, or write one just for it.</p>
              </div>
              <ul class="divide-y divide-[#e8e8e3] dark:divide-zinc-800">
                @for (card of previews(); track card.id) {
                  <li class="px-5 py-3">
                    <div class="flex items-center justify-between gap-3">
                      <div class="flex min-w-0 items-center gap-2">
                        <img [src]="'/assets/logos/' + card.network + '.svg'" alt="" width="16" height="16" class="size-4 shrink-0 object-contain" />
                        <span class="truncate text-sm font-semibold text-[#121417] dark:text-zinc-100">{{ networkLabel(card.network) }}</span>
                        <span class="text-xs text-zinc-500">{{ variants[card.id]?.trim() ? 'Edited caption' : 'Using main caption' }}</span>
                      </div>
                      <div class="flex shrink-0 items-center gap-3">
                        <span class="font-mono text-[11px]" [class.text-red-600]="card.over" [class.text-zinc-400]="!card.over">{{ card.used }}/{{ card.limit }}</span>
                        @if (variantOpen === card.id) {
                          <button type="button" (click)="clearVariant(card.id)" class="text-xs font-semibold text-[#121417] dark:text-zinc-100">Clear</button>
                        } @else {
                          <button type="button" (click)="variantOpen = card.id" class="text-xs font-semibold text-cta">Edit</button>
                        }
                      </div>
                    </div>
                    @if (variantOpen === card.id) {
                      <textarea [ngModel]="variants[card.id] || ''" (ngModelChange)="setVariant(card.id, $event)" rows="3" [name]="'variant-' + card.id" placeholder="Same as the main caption" class="mt-2 w-full rounded-xl border border-[#e8e8e3] bg-[#fcfcf9] px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"></textarea>
                    }
                  </li>
                }
              </ul>
            </section>
          }
          @if (selected().length) {
            <section class="rounded-2xl border border-[#e8e8e3] bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900" aria-label="Channel checks">
              <h2 class="text-sm font-semibold text-[#121417] dark:text-zinc-100">Channel check</h2>
              <ul class="mt-3 space-y-3">
                @for (row of channelFindings(); track row.id) {
                  <li>
                    <p class="text-sm font-semibold text-[#121417] dark:text-zinc-100">{{ row.label }} <span class="font-normal text-zinc-500 dark:text-zinc-400">{{ row.handle }}</span></p>
                    @if (row.issues.length) {
                      @for (issue of row.issues; track issue) {
                        <p class="mt-1 text-[13px] text-red-700 dark:text-red-300">{{ issue }}</p>
                      }
                    } @else {
                      <p class="mt-1 text-[13px] text-[#3f6212] dark:text-lime-200">Ready to post</p>
                    }
                  </li>
                }
              </ul>
            </section>
          }
          <section class="rounded-2xl border border-[#e8e8e3] bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
            <h2 class="text-sm font-semibold text-[#121417] dark:text-zinc-100">Live preview</h2>
            @if (previews()[0]; as card) {
              <div class="mt-4 rounded-xl border border-[#e8e8e3] bg-[#fcfcf9] p-4 dark:border-zinc-700 dark:bg-zinc-950">
                <div class="mb-3 flex items-center gap-3">
                  <span class="relative size-9 shrink-0">
                    <span class="flex size-full items-center justify-center overflow-hidden rounded-full bg-white text-sm font-bold text-cta">
                      @if (card.avatarUrl) { <img [src]="card.avatarUrl" alt="" class="size-full object-cover" /> } @else { <img [src]="'/assets/logos/' + card.network + '.svg'" alt="" width="18" height="18" class="dk-net-badge size-5 object-contain" /> }
                    </span>
                    @if (card.avatarUrl) {
                      <span class="absolute -right-1 -top-1 z-10 flex size-4 items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-white dark:ring-zinc-950">
                        <img [src]="'/assets/logos/' + card.network + '.svg'" alt="" width="12" height="12" class="dk-net-badge size-3 object-contain" />
                      </span>
                    }
                  </span>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-semibold text-[#121417] dark:text-zinc-100">{{ card.handle }}</p>
                    <p class="text-xs text-zinc-500">{{ networkLabel(card.network) }}</p>
                  </div>
                </div>
                @if (postKind() === 'video' && coverPreview(); as cover) {
                  <img [src]="cover" alt="" class="mb-3 aspect-video w-full rounded-lg object-cover" />
                } @else if (imageAttachments()[0]; as img) {
                  <img [src]="img.url" [alt]="alts[img.id] || ''" class="mb-3 aspect-video w-full rounded-lg object-cover" />
                }
                <p class="min-h-16 whitespace-pre-wrap text-sm leading-6" [class.text-zinc-400]="!card.text" [class.text-[#121417]]="!!card.text" [class.dark:text-zinc-100]="!!card.text">{{ card.text || 'Your post preview will appear here as you write.' }}</p>
              </div>
            } @else {
              <p class="mt-4 text-sm text-zinc-500">Choose an account to preview this post.</p>
            }
          </section>
          @if (usage(); as month) {
            <section class="rounded-2xl border border-[#e8e8e3] bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900" aria-label="Usage this month">
              <h2 class="text-sm font-semibold text-[#121417] dark:text-zinc-100">Usage this month</h2>
              <dl class="mt-3 grid gap-3">
                <div class="flex items-center justify-between text-sm"><dt class="text-zinc-500">AI images</dt><dd class="font-semibold text-[#121417] dark:text-zinc-100">{{ month.used['aiImages'] || 0 }} of {{ month.limits.aiImages }}</dd></div>
                <div class="flex items-center justify-between text-sm"><dt class="text-zinc-500">AI videos</dt><dd class="font-semibold text-[#121417] dark:text-zinc-100">{{ month.used['aiVideos'] || 0 }} of {{ month.limits.aiVideos }}</dd></div>
                <div class="flex items-center justify-between text-sm"><dt class="text-zinc-500">Captions</dt><dd class="font-semibold text-[#121417] dark:text-zinc-100">{{ month.used['aiCopilot'] || 0 }} of {{ month.limits.aiCopilot }}</dd></div>
              </dl>
            </section>
          }
          <details class="rounded-2xl border border-[#e8e8e3] bg-white px-5 py-4 dark:border-zinc-700 dark:bg-zinc-900">
            <summary class="cursor-pointer text-sm font-semibold text-[#121417] dark:text-zinc-100">Signatures, tags, and imports <span class="font-normal text-zinc-500">Optional</span></summary>
            <div class="mt-4"><dk-compose-more /></div>
          </details>
        </div>

        <aside class="sticky top-4 flex flex-col gap-4">
          <dk-compose-schedule />
          <button type="button" (click)="schedule()" [disabled]="(publishWhen === 'later' && !when()) || saving() || channelBlocked()" [attr.aria-busy]="saving()" class="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cta px-4 text-sm font-semibold text-white hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-50">
            @if (saving()) { <dk-spinner /> }
            {{ publishWhen === 'now' ? 'Publish post' : 'Schedule post' }}
          </button>
        </aside>
      </div>
      }
    </div>
  `,

})
export class ComposerPage implements OnInit {
  private readonly notices = inject(Notices);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly desk = inject(CompanyDesk);
  editingId = "";
  variants: Record<string, string> = {};
  feedUrl = "";
  feeds = signal<{ id: string; url: string }[]>([]);
  plugs = signal<{ id: string; name: string }[]>([]);
  step = signal<ComposeStep>("write");
  readonly fieldMt =
    "mt-1.5 h-11 w-full rounded-xl border border-[#e8e8e3] bg-[#fcfcf9] px-3.5 text-sm text-[#121417] outline-none transition-colors focus:border-cta focus:ring-1 focus:ring-cta disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100";
  readonly channelGroups = [
    { id: "social" as const, label: "Social" },
    { id: "blogs" as const, label: "Blogs" },
    { id: "chat" as const, label: "Chat" },
  ];
  private static readonly NET_META: Record<string, { label: string; group: "social" | "blogs" | "chat" }> = {
    linkedin: { label: "LinkedIn", group: "social" },
    "linkedin-page": { label: "LinkedIn Page", group: "social" },
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

  body = signal("");
  when = signal("");
  delaySeconds = 0;
  repeatRule = "none";
  repeatEveryDays = 30;
  repeatUntil = "";
  commentBody = "";
  commentDelaySeconds = 0;
  signatureId = "";
  postingSetId = "";
  groupId = "";
  attachments = signal<{ id: string; url: string; kind: "image" | "video"; contentType?: string; bytes?: number; width?: number; height?: number; durationSec?: number }[]>([]);
  aiBusy = signal<null | "copilot" | "image" | "video">(null);
  askKind = signal<null | "image" | "video">(null);
  askText = "";
  accounts = signal<{ id: string; network: string; handle: string; queueSlots?: string | null; avatarUrl?: string | null; slackChannelId?: string | null; slackChannelName?: string | null; needsSlackChannel?: boolean }[]>([]);
  slackChannels = signal<Record<string, { id: string; name: string; isPrivate: boolean }[]>>({});
  publishWhen: "later" | "now" = "later";
  postKind = signal<"text" | "image" | "video">("text");
  composerOpen = signal(false);
  variantOpen = "";
  readonly postKinds = [
    { id: "text" as const, label: "Text post", detail: "A caption, with no picture or video." },
    { id: "image" as const, label: "Image post", detail: "Pictures, with a caption underneath." },
    { id: "video" as const, label: "Video post", detail: "A video for any connected account." },
  ];
  alts: Record<string, string> = {};
  pollQuestion = "";
  pollOptionsText = "";
  threadText = "";
  postType = "post";
  collaborators = "";
  trialReel = false;
  reelAudio = "";
  replySettings = "everyone";
  communityId = "";
  linkedinCarousel = false;
  madeForKids = false;
  shortLink = false;
  coverId = "";
  coverPreview = signal("");
  coverBusy = signal(false);
  private readonly localVideoFiles = new Map<string, File>();
  tagsText = "";
  csvText = "";
  mentionQ = "";
  mentions = signal<{ handle: string; network: string }[]>([]);
  hashtags = signal<{ id: string; name: string; tags: string }[]>([]);
  signatures = signal<{ id: string; name: string; body: string; isDefault: boolean }[]>([]);
  sets = signal<{ id: string; name: string; channelIds: string; templateBody: string | null }[]>([]);
  groups = signal<{ id: string; name: string; accountIds: string[] }[]>([]);
  selected = signal<string[]>([]);
  usage = signal<PlanSnapshot | null>(null);
  saving = signal(false);
  msg = signal("");
  err = signal(false);
  workspaceId = "";

  networkLabel(n: string) {
    return ComposerPage.NET_META[n]?.label || n;
  }

  private pinnedCompany: string | null = null;

  constructor() {
    effect(() => {
      const companyId = this.desk.selectedId();
      const companies = this.desk.companies();
      untracked(() => {
        if (this.pinnedCompany === null) {
          if (companies.length || companyId) this.pinnedCompany = companyId;
        } else if (this.pinnedCompany !== companyId) {
          this.pinnedCompany = companyId;
          this.attachments.set([]);
        }
        const company = this.desk.current();
        if (!company) return;
        const allowed = new Set(company.accountIds);
        const current = this.selected().filter((id) => allowed.has(id));
        if (current.length) this.selected.set(current);
        else if (allowed.size > 0 && allowed.size <= 8) this.selected.set([...allowed]);
        else this.selected.set([]);
        this.groupId = company.id;
      });
    });
    effect(() => {
      const ids = this.selectedAccounts()
        .filter((account) => account.network === "slack" && !account.slackChannelId)
        .map((account) => account.id);
      untracked(() => {
        for (const id of ids) void this.loadSlackChannels(id);
      });
    });
  }

  private mediaGroupId() {
    return this.desk.current()?.id || this.groupId || "";
  }

  accountsForCompany() {
    return this.accounts().filter((account) => this.desk.allowsAccount(account.id));
  }

  accountsIn(group: "social" | "blogs" | "chat") {
    return this.accountsForCompany().filter((a) => (ComposerPage.NET_META[a.network]?.group || "social") === group);
  }

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string; extrasJson?: string | null }; usage: PlanSnapshot }>("/v1/workspaces/me");
      this.workspaceId = me.workspace.id;
      try {
        const extras = JSON.parse(me.workspace.extrasJson || "{}") as { hashtags?: { id: string; name: string; tags: string }[] };
        this.hashtags.set(extras.hashtags || []);
      } catch {
        this.hashtags.set([]);
      }
      lsSet("dk-ws", me.workspace.id);
      this.usage.set(me.usage);
      const [ac, sigs, sets, groups, feeds, plugs] = await Promise.all([
        apiAll<{ id: string; network: string; handle: string; queueSlots?: string | null; avatarUrl?: string | null; slackChannelId?: string | null; slackChannelName?: string | null; needsSlackChannel?: boolean }>(`/v1/accounts?workspaceId=${me.workspace.id}`, "accounts"),
        api<{ signatures: { id: string; name: string; body: string; isDefault: boolean }[] }>(
          `/v1/org/signatures?workspaceId=${me.workspace.id}`,
        ),
        api<{ sets: { id: string; name: string; channelIds: string; templateBody: string | null }[] }>(
          `/v1/org/sets?workspaceId=${me.workspace.id}`,
        ),
        api<{ groups: { id: string; name: string; accountIds: string[] }[] }>(`/v1/org/groups?workspaceId=${me.workspace.id}`),
        api<{ feeds: { id: string; url: string }[] }>(`/v1/org/rss?workspaceId=${me.workspace.id}`),
        api<{ plugs: { id: string; name: string }[] }>(`/v1/org/plugs?workspaceId=${me.workspace.id}`),
      ]);
      this.accounts.set(ac);
      this.signatures.set(sigs.signatures);
      this.sets.set(sets.sets);
      this.groups.set(groups.groups);
      this.feeds.set(feeds.feeds || []);
      this.plugs.set(plugs.plugs || []);
      const def = sigs.signatures.find((s) => s.isDefault);
      if (def) this.signatureId = def.id;
      const editing = this.route.snapshot.queryParamMap.get("post");
      if (!editing && ac[0]) this.selected.set([ac[0].id]);
      await this.loadEditing(editing);
      this.changeDetector.detectChanges();
      this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        const id = params.get("post");
        if ((id || "") === this.editingId) return;
        void this.loadEditing(id).then(() => this.changeDetector.detectChanges());
      });
      const mediaId = this.route.snapshot.queryParamMap.get("media");
      if (mediaId) {
        this.postKind.set("image");
        this.composerOpen.set(true);
        this.pushAttachment({ id: mediaId, url: `${apiBase()}/v1/media/${mediaId}/file?workspaceId=${this.workspaceId}`, kind: "image" });
      }
    } catch {
      this.fail(new Error("Sign in to compose posts."));
    }
  }

  chooseKind(kind: "text" | "image" | "video") {
    this.postKind.set(kind);
    this.composerOpen.set(true);
  }

  kindLabel() {
    return this.postKinds.find((kind) => kind.id === this.postKind())?.label || "Text post";
  }

  selectedAccounts() {
    return this.accounts().filter((a) => this.selected().includes(a.id));
  }

  setVariant(id: string, value: string) {
    this.variants = { ...this.variants, [id]: value };
  }

  clearVariant(id: string) {
    const next = { ...this.variants };
    delete next[id];
    this.variants = next;
    if (this.variantOpen === id) this.variantOpen = "";
  }

  setAlt(id: string, value: string) {
    this.alts = { ...this.alts, [id]: value };
  }

  hasNetwork(network: string) {
    return this.selectedAccounts().some((account) => account.network === network);
  }

  needsPoll() {
    return this.hasNetwork("x") || this.hasNetwork("linkedin");
  }

  needsThread() {
    return this.hasNetwork("x") || this.hasNetwork("threads");
  }

  needsType() {
    return this.hasNetwork("instagram") || this.hasNetwork("youtube") || this.hasNetwork("facebook") || this.hasNetwork("x") || this.hasNetwork("linkedin") || this.hasNetwork("linkedin-page");
  }

  pollOptions() {
    return this.pollOptionsText.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 4);
  }

  extrasPayload() {
    const tags = this.tagsText.split(",").map((tag) => tag.trim()).filter(Boolean);
    const thread = this.threadText.split("\n").map((line) => line.trim()).filter(Boolean);
    const options = this.pollOptions();
    const alts = Object.fromEntries(Object.entries(this.alts).filter(([, text]) => text.trim()));
    return {
      collaborators: this.collaborators.split(",").map((name) => name.trim().replace(/^@/, "")).filter(Boolean).slice(0, 3),
      trialReel: this.trialReel || undefined,
      reelAudio: this.reelAudio.trim() || undefined,
      replySettings: this.replySettings === "everyone" ? undefined : this.replySettings,
      communityId: this.communityId.trim() || undefined,
      linkedinCarousel: this.linkedinCarousel || undefined,
      madeForKids: this.madeForKids || undefined,
      shortLink: this.shortLink || undefined,
      postType: this.postType === "post" ? undefined : this.postType,
      coverId: this.coverId || undefined,
      tags: tags.length ? tags : undefined,
      thread: thread.length ? thread : undefined,
      poll: this.pollQuestion.trim() && options.length >= 2 ? { question: this.pollQuestion.trim(), options } : undefined,
      alts: Object.keys(alts).length ? alts : undefined,
    };
  }

  applyHashtags(tags: string) {
    if (!tags) return;
    this.body.set(`${this.body().trim()}\n\n${tags}`.trim());
  }

  async useNextSlot() {
    const slots = this.selectedAccounts().flatMap((account) => (account.queueSlots || "09:00,13:00,18:00").split(","));
    let taken: number[] = [];
    try {
      const posts = await apiAll<{ scheduledAt?: string | number | null; channels?: { accountId?: string }[] }>(
        `/v1/posts?${this.desk.scopeQuery(this.workspaceId)}`,
        "posts",
      );
      taken = occupiedSlotMs(
        posts.map((post) => ({
          scheduledAt: post.scheduledAt,
          accountIds: (post.channels || []).map((channel) => channel.accountId).filter((id): id is string => !!id),
        })),
        this.selected(),
      );
    } catch {
      taken = [];
    }
    const ms = nextSlotMs(slots, Date.now(), taken);
    if (!ms) return;
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, "0");
    this.when.set(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    this.changeDetector.markForCheck();
  }

  async findMentions() {
    const q = this.mentionQ.trim();
    if (q.length < 2 || !this.workspaceId) {
      this.mentions.set([]);
      return;
    }
    const network = this.selectedAccounts()[0]?.network || "";
    const data = await api<{ handles: { handle: string; network: string }[] }>(
      `/v1/accounts/mentions?workspaceId=${this.workspaceId}&q=${encodeURIComponent(q)}&network=${network}`,
    );
    this.mentions.set(data.handles || []);
  }

  insertMention(handle: string) {
    this.body.set(`${this.body().trim()} @${handle}`.trim());
    this.mentionQ = "";
    this.mentions.set([]);
  }

  async importCsv() {
    if (!this.csvText.trim() || !this.selected().length) return this.fail({ message: "Add rows and pick a channel" });
    try {
      const data = await api<{ ids: string[] }>("/v1/posts/import", {
        method: "POST",
        json: { workspaceId: this.workspaceId, csv: this.csvText, destinations: this.selected() },
      });
      this.csvText = "";
      this.flash(`Imported ${data.ids.length} posts`);
    } catch (e: unknown) {
      this.fail(e);
    }
  }

  previewKind(network: string) {
    if (network === "instagram" || network === "youtube" || network === "linkedin" || network === "facebook" || network === "reddit") return network;
    if (network === "slack" || network === "discord" || network === "telegram") return "chat";
    if (network === "hashnode" || network === "devto") return "blog";
    return "feed";
  }

  previews() {
    return this.selectedAccounts().map((account) => {
      const text = this.variants[account.id]?.trim() || this.body();
      const cap = CAPTION_LIMITS.find((n) => n.id === account.network);
      const used = countCaptionChars(text);
      return { ...account, text, used, limit: cap?.limit ?? 0, over: !!cap && used > cap.limit, kind: this.previewKind(account.network) };
    });
  }

  async addFeed() {
    const url = this.feedUrl.trim();
    const channelId = this.selected()[0];
    if (!url || !channelId) return;
    await api("/v1/org/rss", { method: "POST", json: { workspaceId: this.workspaceId, url, channelIds: [channelId], groupId: this.groupId || null } });
    this.feedUrl = "";
    const feeds = await api<{ feeds: { id: string; url: string }[] }>(`/v1/org/rss?workspaceId=${this.workspaceId}`);
    this.feeds.set(feeds.feeds || []);
  }

  async runPlug(id: string) {
    await api(`/v1/org/plugs/${id}/run?workspaceId=${this.workspaceId}`, { method: "POST" });
    this.flash("Plug ran");
  }

  private async loadEditing(id: string | null) {
    if (!id || !this.workspaceId) return;
    type Editable = {
      id: string;
      body: string;
      status: string;
      scheduledAt: string | number | null;
      mediaIds: string | null;
      variantsJson: string | null;
      extrasJson?: string | null;
      preview?: { kind?: string } | null;
      channels?: { accountId?: string }[];
    };
    const read = (query: string) => api<{ posts: Editable[] }>(`/v1/posts?${query}&id=${encodeURIComponent(id)}`);
    let data = await read(this.desk.scopeQuery(this.workspaceId));
    if (!data.posts[0]) data = await read(`workspaceId=${this.workspaceId}`);
    const post = data.posts[0];
    if (!post) {
      this.fail({ message: "Could not open that post." });
      this.changeDetector.detectChanges();
      return;
    }
    this.attachments.set([]);
    this.clearCover();
    this.postKind.set("text");
    this.composerOpen.set(true);
    this.editingId = post.id;
    this.body.set(post.body);
    this.selected.set((post.channels || []).map((c) => c.accountId).filter((x): x is string => !!x));
    if (post.scheduledAt) {
      const d = new Date(post.scheduledAt);
      const pad = (n: number) => String(n).padStart(2, "0");
      this.when.set(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    }
    try {
      const parsed = post.variantsJson ? JSON.parse(post.variantsJson) : {};
      if (parsed && typeof parsed === "object") this.variants = parsed;
    } catch {
      this.variants = {};
    }
    try {
      const extras = JSON.parse(post.extrasJson || "{}") as {
        poll?: { question?: string; options?: string[] };
        thread?: string[];
        postType?: string;
        coverId?: string;
        tags?: string[];
        alts?: Record<string, string>;
        collaborators?: string[];
        trialReel?: boolean;
        reelAudio?: string;
        replySettings?: string;
        communityId?: string;
        linkedinCarousel?: boolean;
        madeForKids?: boolean;
        shortLink?: boolean;
      };
      this.pollQuestion = extras.poll?.question || "";
      this.pollOptionsText = (extras.poll?.options || []).join("\n");
      this.threadText = (extras.thread || []).join("\n");
      this.postType = extras.postType || "post";
      this.coverId = extras.coverId || "";
      this.coverPreview.set(
        this.coverId ? `${apiBase()}/v1/media/${this.coverId}/file?workspaceId=${this.workspaceId}` : "",
      );
      this.tagsText = (extras.tags || []).join(", ");
      this.alts = extras.alts || {};
      this.collaborators = (extras.collaborators || []).join(", ");
      this.trialReel = !!extras.trialReel;
      this.reelAudio = extras.reelAudio || "";
      this.replySettings = extras.replySettings || "everyone";
      this.communityId = extras.communityId || "";
      this.linkedinCarousel = !!extras.linkedinCarousel;
      this.madeForKids = !!extras.madeForKids;
      this.shortLink = !!extras.shortLink;
    } catch {
      /* extras are optional */
    }
    try {
      const ids: string[] = post.mediaIds ? JSON.parse(post.mediaIds) : [];
      const video = post.preview?.kind === "video";
      if (ids.length) this.postKind.set(video ? "video" : "image");
      for (const mediaId of ids) {
        this.pushAttachment({
          id: mediaId,
          url: `${apiBase()}/v1/media/${mediaId}/file?workspaceId=${this.workspaceId}`,
          kind: video ? "video" : "image",
        });
      }
    } catch {
      /* media ids are optional */
    }
    this.changeDetector.detectChanges();
  }

  toggle(id: string) {
    const s = new Set(this.selected());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.selected.set([...s]);
    const account = this.accounts().find((item) => item.id === id);
    if (account?.network === "slack" && !account.slackChannelId && s.has(id)) void this.loadSlackChannels(id);
  }

  async loadSlackChannels(accountId: string) {
    if (!this.workspaceId || accountId in this.slackChannels()) return;
    try {
      const data = await api<{ channels: { id: string; name: string; isPrivate: boolean }[] }>(
        `/v1/accounts/${accountId}/slack/channels?workspaceId=${this.workspaceId}`,
      );
      this.slackChannels.update((current) => ({ ...current, [accountId]: data.channels || [] }));
    } catch (e: unknown) {
      this.fail(e);
    }
  }

  async pickSlackChannel(accountId: string, channelId: string) {
    if (!channelId) return;
    const channel = (this.slackChannels()[accountId] || []).find((item) => item.id === channelId);
    try {
      const saved = await api<{ retried?: number }>(`/v1/accounts/${accountId}`, {
        method: "PATCH",
        json: { workspaceId: this.workspaceId, slackChannelId: channelId, slackChannelName: channel?.name },
      });
      this.accounts.update((rows) =>
        rows.map((row) =>
          row.id === accountId
            ? { ...row, slackChannelId: channelId, slackChannelName: channel?.name || null, needsSlackChannel: false }
            : row,
        ),
      );
      const where = channel ? `#${channel.name}` : "that channel";
      this.flash(saved.retried ? `Slack posts will go to ${where}. Sending the one that was waiting.` : `Slack posts will go to ${where}`);
    } catch (e: unknown) {
      this.fail(e);
    }
  }

  useAccounts(ids: string[]) {
    const s = new Set(this.selected());
    for (const id of ids) s.add(id);
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
    if (set.templateBody && !this.body().trim()) this.body.set(set.templateBody);
  }

  applyGroup(id: string) {
    if (!id) return;
    const g = this.groups().find((x) => x.id === id);
    if (g?.accountIds?.length) this.selected.set([...g.accountIds]);
  }

  mark(handle: string) {
    const name = handle.replace(/^[@#]/, "").trim();
    return (name[0] || "?").toUpperCase();
  }

  imageAttachments() {
    return this.attachments().filter((m) => m.kind === "image");
  }

  channelFindings() {
    const media = this.attachments().map((item) => ({
      kind: item.kind,
      contentType: item.contentType,
      bytes: item.bytes,
      width: item.width,
      height: item.height,
      durationSec: item.durationSec,
    }));
    const hasPoll = !!this.pollQuestion.trim() && this.pollOptions().length >= 2;
    return this.selectedAccounts().map((account) => ({
      id: account.id,
      label: ComposerPage.NET_META[account.network]?.label || account.network,
      handle: account.handle,
      issues: channelIssues({
        network: account.network,
        body: this.variants[account.id]?.trim() || this.body(),
        postType: this.postType,
        hasPoll,
        media,
      }),
    }));
  }

  channelBlocked() {
    return this.channelFindings().some((row) => row.issues.length > 0);
  }

  private instagramSelected() {
    return this.accounts().some((a) => a.network === "instagram" && this.selected().includes(a.id));
  }

  pushAttachment(item: { id: string; url: string; kind: "image" | "video"; contentType?: string; bytes?: number; width?: number; height?: number; durationSec?: number }) {
    if (!item.id) return;
    this.attachments.update((list) => (list.some((a) => a.id === item.id) ? list : [...list, item]));
    if (isBrowser() && (!item.width || !item.contentType)) void this.measureAttachment(item.id, item.url);
  }

  private async readLocalMedia(file: Blob, kind: "image" | "video") {
    const contentType = file.type || undefined;
    const bytes = file.size;
    try {
      if (kind === "video") {
        const local = URL.createObjectURL(file);
        const element = document.createElement("video");
        element.preload = "metadata";
        const size = await new Promise<{ width: number; height: number; durationSec: number }>((resolve, reject) => {
          element.onloadedmetadata = () => resolve({ width: element.videoWidth, height: element.videoHeight, durationSec: element.duration });
          element.onerror = () => reject(new Error("video"));
          element.src = local;
        }).finally(() => URL.revokeObjectURL(local));
        return { kind, contentType, bytes, width: size.width, height: size.height, durationSec: size.durationSec };
      }
      const bitmap = await createImageBitmap(file);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return { kind, contentType, bytes, ...size };
    } catch {
      return { kind, contentType, bytes };
    }
  }

  private async measureAttachment(id: string, url: string) {
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return;
      const blob = await res.blob();
      const contentType = blob.type || undefined;
      const bytes = blob.size;
      const video = contentType?.startsWith("video/");
      if (video) {
        const local = URL.createObjectURL(blob);
        const element = document.createElement("video");
        element.preload = "metadata";
        const size = await new Promise<{ width: number; height: number; durationSec: number }>((resolve, reject) => {
          element.onloadedmetadata = () => resolve({ width: element.videoWidth, height: element.videoHeight, durationSec: element.duration });
          element.onerror = () => reject(new Error("video"));
          element.src = local;
        }).finally(() => URL.revokeObjectURL(local));
        this.patchAttachment(id, { kind: "video", contentType, bytes, width: size.width, height: size.height, durationSec: size.durationSec });
        return;
      }
      const bitmap = await createImageBitmap(blob);
      this.patchAttachment(id, { kind: "image", contentType, bytes, width: bitmap.width, height: bitmap.height });
      bitmap.close();
    } catch {
      /* The API checks the stored file again before it is queued. */
    }
  }

  private patchAttachment(id: string, patch: Partial<{ kind: "image" | "video"; contentType: string; bytes: number; width: number; height: number; durationSec: number }>) {
    this.attachments.update((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  removeAttachment(id: string) {
    this.localVideoFiles.delete(id);
    this.attachments.update((list) => list.filter((a) => a.id !== id));
    if (!this.attachments().some((item) => item.kind === "video")) this.clearCover();
  }

  onCoverFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (file) void this.setCoverFile(file);
  }

  clearCover() {
    this.coverId = "";
    this.coverPreview.set("");
  }

  async useVideoFrame(video: HTMLVideoElement) {
    const time = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const local = this.localVideoFiles.get(video.dataset.id || "");
    try {
      const blob = local ? await this.frameFromFile(local, time) : await this.frameFromElement(video);
      if (!blob) {
        this.fail({ message: "Could not grab that frame. Upload a thumbnail image instead." });
        return;
      }
      await this.setCoverFile(new File([blob], "thumbnail.jpg", { type: "image/jpeg" }));
    } catch {
      this.fail({ message: "Could not grab that frame. Upload a thumbnail image instead." });
    }
  }

  private async frameFromFile(file: File, time: number) {
    const url = URL.createObjectURL(file);
    try {
      const element = document.createElement("video");
      element.preload = "auto";
      element.muted = true;
      element.src = url;
      await new Promise<void>((resolve, reject) => {
        element.onloadeddata = () => resolve();
        element.onerror = () => reject(new Error("frame"));
      });
      const at = Math.min(Math.max(time, 0), Math.max((element.duration || 0) - 0.05, 0));
      if (at > 0) {
        await new Promise<void>((resolve, reject) => {
          element.onseeked = () => resolve();
          element.onerror = () => reject(new Error("frame"));
          element.currentTime = at;
        });
      }
      return this.drawFrame(element);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private async frameFromElement(video: HTMLVideoElement) {
    const direct = await this.drawFrame(video);
    if (direct) return direct;
    const src = video.currentSrc || video.src;
    if (!src) return null;
    const res = await fetch(src, { credentials: "include" });
    if (!res.ok) return null;
    return this.frameFromFile(new File([await res.blob()], "video", { type: res.headers.get("content-type") || "video/mp4" }), video.currentTime || 0);
  }

  private drawFrame(video: HTMLVideoElement) {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx || !video.videoWidth || !video.videoHeight) return Promise.resolve(null);
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } catch {
      return Promise.resolve(null);
    }
    return new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
      } catch {
        resolve(null);
      }
    });
  }

  async setCoverFile(file: File) {
    if (this.coverBusy()) return;
    if (!file.type.startsWith("image/")) {
      this.fail({ message: "Choose an image for the thumbnail." });
      return;
    }
    if (!this.workspaceId) return this.fail({ message: "Sign in to upload to the media library" });
    this.coverBusy.set(true);
    try {
      const fd = new FormData();
      fd.set("workspaceId", this.workspaceId);
      fd.set("file", file);
      const groupId = this.mediaGroupId();
      if (groupId) fd.set("groupId", groupId);
      const res = await fetch(`${apiBase()}/v1/media/upload`, { method: "POST", body: fd, credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { id?: string; url?: string; message?: string; error?: string };
      if (!res.ok || !data.id || !data.url) {
        this.fail({ message: data.message || data.error || "Thumbnail upload failed" });
        return;
      }
      this.coverId = data.id;
      this.coverPreview.set(`${apiBase()}${data.url}`);
      this.flash("Thumbnail saved");
    } catch (e: unknown) {
      this.fail(e instanceof Error ? e : { message: "Thumbnail upload failed" });
    } finally {
      this.coverBusy.set(false);
    }
  }

  async copilot() {
    if (this.aiBusy()) return;
    this.aiBusy.set("copilot");
    try {
      const r = await api<{ draft: string }>("/v1/ai/copilot", {
        method: "POST",
        json: { workspaceId: this.workspaceId, prompt: this.body() || "Write a friendly update" },
      });
      this.body.set(r.draft);
      this.flash("Copilot draft applied");
      await this.refreshUsage();
    } catch (e: unknown) {
      this.fail(e);
    } finally {
      this.aiBusy.set(null);
    }
  }

  askImage() {
    if (this.aiBusy()) return;
    this.askText = "";
    this.askKind.set("image");
  }

  askVideo() {
    if (this.aiBusy()) return;
    this.askText = "";
    this.askKind.set("video");
  }

  async runAsk() {
    const prompt = this.askText.trim();
    const kind = this.askKind();
    if (!prompt || !kind || this.aiBusy()) return;
    if (kind === "image") await this.aiImage(prompt);
    else await this.aiVideo(prompt);
  }

  async aiImage(prompt: string) {
    if (this.aiBusy()) return;
    this.aiBusy.set("image");
    try {
      const r = await api<{ id: string; url: string }>("/v1/ai/image", {
        method: "POST",
        json: { workspaceId: this.workspaceId, prompt, groupId: this.mediaGroupId() || undefined },
      });
      const url = `${apiBase()}${r.url}`;
      this.postKind.set("image");
      this.pushAttachment({ id: r.id, url, kind: "image" });
      this.askKind.set(null);
      this.askText = "";
      this.flash("AI image stored");
      await this.refreshUsage();
    } catch (e: unknown) {
      this.fail(e);
    } finally {
      this.aiBusy.set(null);
    }
  }

  async aiVideo(prompt: string) {
    if (this.aiBusy()) return;
    this.aiBusy.set("video");
    try {
      const r = await api<{ id: string; url: string; contentType?: string }>("/v1/ai/video", {
        method: "POST",
        json: { workspaceId: this.workspaceId, prompt, durationSec: 8, groupId: this.mediaGroupId() || undefined },
      });
      const url = `${apiBase()}${r.url}`;
      this.pushAttachment({ id: r.id, url, kind: "video" });
      this.askKind.set(null);
      this.askText = "";
      this.flash("AI video ready");
      await this.refreshUsage();
    } catch (e: unknown) {
      this.fail(e);
    } finally {
      this.aiBusy.set(null);
    }
  }

  onAttachFiles(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const files = [...(input.files || [])];
    input.value = "";
    void this.attachFiles(files);
  }

  async attachFiles(files: File[]) {
    if (!files.length) return;
    if (!this.workspaceId) return this.fail({ message: "Sign in to upload to the media library" });

    let added = 0;
    for (const file of files) {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (this.postKind() === "video" && !isVideo) {
        this.fail({ message: "This is a video post. Choose a video file." });
        continue;
      }
      if (this.postKind() === "image" && !isImage) {
        this.fail({ message: "This is an image post. Choose an image file." });
        continue;
      }
      if (!isVideo && !isImage) {
        this.fail({ message: "Choose images or videos" });
        continue;
      }
      try {
        const fd = new FormData();
        fd.set("workspaceId", this.workspaceId);
        fd.set("file", file);
        const groupId = this.mediaGroupId();
        if (groupId) fd.set("groupId", groupId);
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
          const measured = await this.readLocalMedia(file, isVideo ? "video" : "image");
          if (isVideo) this.localVideoFiles.set(data.id, file);
          this.pushAttachment({
            id: data.id,
            url: `${apiBase()}${data.url}`,
            ...measured,
          });
          added += 1;
        }
      } catch (e: unknown) {
        this.fail(e instanceof Error ? e : { message: "Upload failed" });
      }
    }
    if (added) this.flash(added === 1 ? "Media attached" : `${added} files attached`);
  }

  async schedule(asDraft = false) {
    if (this.saving()) return;
    if (!this.selected().length && !this.postingSetId) {
      this.step.set("channels");
      return this.fail({ message: "Select at least one account to save this post." });
    }
    const slack = this.selectedAccounts().find((account) => account.network === "slack" && !account.slackChannelId);
    if (!asDraft && slack) {
      this.step.set("channels");
      return this.fail({ message: `Pick a Slack channel for ${slack.handle} before this post can go out.` });
    }
    if (this.instagramSelected() && !this.imageAttachments().length && this.postType !== "reel" && this.postType !== "story") {
      this.step.set("pictures");
      return this.fail({ message: "Instagram feed posts need an attached image." });
    }
    if (!asDraft && this.channelBlocked()) {
      const issue = this.channelFindings().flatMap((row) => row.issues)[0];
      return this.fail({ message: issue || "This post does not fit a selected channel." });
    }
    if (!asDraft && this.repeatRule !== "none" && !this.repeatUntil) {
      this.step.set("schedule");
      return this.fail({ message: "Set an end date (repeat until) for repeated posts" });
    }
    this.saving.set(true);
    try {
      const payload = {
        workspaceId: this.workspaceId,
        body: this.body(),
        destinations: this.selected(),
        status: !asDraft && (this.when() || this.publishWhen === "now") ? "scheduled" as const : "draft" as const,
        scheduledAt: !asDraft && this.publishWhen === "now" ? Date.now() : !asDraft && this.when() ? new Date(this.when()).getTime() : (this.editingId ? null : undefined),
        delaySeconds: this.delaySeconds,
        repeatRule: this.repeatRule,
        repeatEveryDays: this.repeatRule === "interval" ? this.repeatEveryDays : undefined,
        repeatUntil: this.repeatUntil ? new Date(this.repeatUntil + "T23:59:59").getTime() : null,
        signatureId: this.signatureId || null,
        postingSetId: this.postingSetId || null,
        commentBody: this.commentBody || null,
        commentDelaySeconds: this.commentBody ? this.commentDelaySeconds : 0,
        mediaIds: this.attachments().map((a) => a.id),
        variants: Object.fromEntries(Object.entries(this.variants).filter(([, text]) => text.trim())),
        extras: this.extrasPayload(),
      };
      if (this.editingId) {
        await api(`/v1/posts/${this.editingId}`, { method: "PATCH", json: payload });
      } else {
        const created = await api<{ id: string }>("/v1/posts", { method: "POST", json: payload });
        this.editingId = created.id;
      }
      if (asDraft) this.when.set("");
      this.flash(payload.status === "scheduled" ? "Post scheduled" : "Draft saved");
    } catch (e: unknown) {
      this.fail(e);
    } finally {
      this.saving.set(false);
    }
  }

  async refreshUsage() {
    const u = await api<PlanSnapshot>(`/v1/workspaces/${this.workspaceId}/usage`);
    this.usage.set(u);
  }

  flash(m: string) {
    this.err.set(false);
    this.msg.set(m);
    this.notices.push("ok", m);
  }
  fail(e: unknown) {
    this.err.set(true);
    const body = e as { message?: string; error?: string; body?: { message?: string; error?: string } };
    const text = body?.body?.message || body?.body?.error || body?.message || body?.error || "Request failed";
    this.msg.set(text);
    this.notices.push("error", text);
  }
}
