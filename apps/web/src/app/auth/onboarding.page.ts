import { Component, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { api, isOnboarded, type Workspace } from "../lib/api";
import { DkChoice, FIELD } from "../ui/forms";

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, DkChoice],
  template: `
    <div class="flex min-h-dvh bg-[#fbfbfa] font-sans text-[#09090b] antialiased">
      <div class="flex flex-1 flex-col px-6 py-8 sm:px-10 lg:px-16">
        <a routerLink="/" class="font-display text-[17px] font-extrabold tracking-tight">Dus<span class="text-cta">kly</span></a>
        <div class="flex flex-1 items-center py-10">
          <div class="mx-auto w-full max-w-[400px]">
            <div class="mb-8 flex gap-1.5" aria-hidden="true">
              @for (s of steps; track s) {
                <span
                  class="h-1 flex-1 rounded-full"
                  [class.bg-cta]="step() === s || donePast(s)"
                  [class.bg-[#e8e8e3]]="step() !== s && !donePast(s)"
                ></span>
              }
            </div>

            @if (step() === 'name') {
              <h1 class="font-display text-[40px] font-extrabold leading-none tracking-[-0.03em]">Name the space</h1>
              <p class="mt-3 text-[15px] leading-6 text-[#52525b]">This is what the app shows in the sidebar. You can change it later.</p>
              <div class="mt-8 space-y-5">
                <label class="block text-[13px] font-medium" for="space-name">Space name
                  <input
                    id="space-name"
                    type="text"
                    name="spaceName"
                    autocomplete="organization"
                    placeholder="Acme Studio"
                    [(ngModel)]="name"
                    [class]="'mt-2 ' + field"
                  />
                </label>
                <button
                  type="button"
                  (click)="saveName()"
                  [disabled]="busy()"
                  class="inline-flex h-10 w-full items-center justify-center rounded-md bg-cta text-[14px] font-semibold text-white hover:bg-cta-hover disabled:opacity-60"
                >
                  Continue
                </button>
              </div>
            } @else if (step() === 'who') {
              <h1 class="font-display text-[40px] font-extrabold leading-none tracking-[-0.03em]">Who is this for?</h1>
              <p class="mt-3 text-[15px] leading-6 text-[#52525b]">Agencies use companies for each client. Solo accounts skip that split.</p>
              <div class="mt-8 space-y-5">
                <div class="grid gap-2" role="radiogroup" aria-label="Who this account is for">
                  <dk-choice value="solo" [selected]="kind === 'solo'" (pick)="kind = $any($event)">
                    Just me
                    <span class="mt-0.5 block text-[11px] font-medium text-[#63676c]">Scheduling your own channels.</span>
                  </dk-choice>
                  <dk-choice value="agency" [selected]="kind === 'agency'" (pick)="kind = $any($event)">
                    An agency
                    <span class="mt-0.5 block text-[11px] font-medium text-[#63676c]">Companies and clients live under this account.</span>
                  </dk-choice>
                </div>
                <button
                  type="button"
                  (click)="saveWho()"
                  [disabled]="busy()"
                  class="inline-flex h-10 w-full items-center justify-center rounded-md bg-cta text-[14px] font-semibold text-white hover:bg-cta-hover disabled:opacity-60"
                >
                  Continue
                </button>
              </div>
            } @else {
              <h1 class="font-display text-[40px] font-extrabold leading-none tracking-[-0.03em]">You're set</h1>
              <p class="mt-3 text-[15px] leading-6 text-[#52525b]">
                {{ name.trim() || 'Your account' }} is ready. Open the calendar to schedule a post.
              </p>
              <div class="mt-8">
                <button
                  type="button"
                  (click)="finish()"
                  [disabled]="busy()"
                  class="inline-flex h-10 w-full items-center justify-center rounded-md bg-cta text-[14px] font-semibold text-white hover:bg-cta-hover disabled:opacity-60"
                >
                  Open calendar
                </button>
              </div>
            }

            @if (error()) {
              <p class="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700" role="alert">{{ error() }}</p>
            }
          </div>
        </div>
      </div>
      <aside class="hidden flex-1 items-center justify-center border-l border-[#e8e8e3] bg-white px-12 lg:flex" aria-hidden="true">
        <div class="w-full max-w-sm">
          <p class="mb-8 font-mono text-[11px] font-semibold uppercase tracking-widest text-cta">Paper desk setup</p>
          <div class="mb-8">
            <div class="mb-1 h-px w-8 bg-cta"></div>
            <p class="text-[15px] font-semibold">A name, then who you are</p>
            <p class="mt-1 text-[13px] leading-5 text-[#52525b]">Connect channels from Accounts after you land in the calendar.</p>
          </div>
          <div class="mb-8">
            <div class="mb-1 h-px w-8 bg-cta"></div>
            <p class="text-[15px] font-semibold">Agency or just you</p>
            <p class="mt-1 text-[13px] leading-5 text-[#52525b]">Companies are how client channels stay grouped.</p>
          </div>
          <div class="mb-8">
            <div class="mb-1 h-px w-8 bg-cta"></div>
            <p class="text-[15px] font-semibold">No OAuth required here</p>
            <p class="mt-1 text-[13px] leading-5 text-[#52525b]">Social connects stay in the app, not this setup.</p>
          </div>
        </div>
      </aside>
    </div>
  `,
})
export class OnboardingPage implements OnInit {
  readonly field = FIELD;
  readonly steps = ["name", "who", "done"] as const;
  step = signal<(typeof this.steps)[number]>("name");
  name = "";
  kind = "";
  workspaceId = "";
  error = signal("");
  busy = signal(false);

  constructor(private readonly router: Router) {}

  donePast(s: (typeof this.steps)[number]) {
    return this.steps.indexOf(this.step()) > this.steps.indexOf(s);
  }

  async ngOnInit() {
    try {
      const me = await api<{ workspace: Workspace }>("/v1/workspaces/me");
      if (me.workspace.role === "member" || me.workspace.role === "admin" || isOnboarded(me.workspace)) {
        await this.router.navigateByUrl("/app");
        return;
      }
      this.workspaceId = me.workspace.id;
    } catch {
      await this.router.navigateByUrl("/signin");
    }
  }

  async saveName() {
    this.error.set("");
    const name = this.name.trim();
    if (!name) {
      this.error.set("Name the space to continue.");
      return;
    }
    if (!this.workspaceId) {
      this.error.set("Sign in again to finish setup.");
      return;
    }
    this.busy.set(true);
    try {
      await api(`/v1/workspaces/${this.workspaceId}`, { method: "PATCH", json: { name } });
      this.name = name;
      this.step.set("who");
    } catch {
      this.error.set("Could not save the name.");
    } finally {
      this.busy.set(false);
    }
  }

  async saveWho() {
    this.error.set("");
    if (this.kind !== "solo" && this.kind !== "agency") {
      this.error.set("Pick one to continue.");
      return;
    }
    this.busy.set(true);
    try {
      await api(`/v1/workspaces/${this.workspaceId}`, { method: "PATCH", json: { accountKind: this.kind } });
      this.step.set("done");
    } catch {
      this.error.set("Could not save that choice.");
    } finally {
      this.busy.set(false);
    }
  }

  async finish() {
    this.error.set("");
    this.busy.set(true);
    try {
      await api(`/v1/workspaces/${this.workspaceId}`, {
        method: "PATCH",
        json: {
          name: this.name.trim(),
          accountKind: this.kind,
          onboardingCompleted: true,
        },
      });
      await this.router.navigateByUrl("/app");
    } catch {
      this.error.set("Could not finish setup.");
    } finally {
      this.busy.set(false);
    }
  }
}
