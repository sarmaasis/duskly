import { Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { COMPOSE } from "./compose-context";

@Component({
  selector: "dk-compose-write",
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="rounded-2xl border border-[#e8e8e3] bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <div class="border-b border-[#e8e8e3] px-5 py-4 dark:border-zinc-700">
        <h2 class="text-sm font-semibold text-[#121417] dark:text-zinc-100">Main caption</h2>
        <p class="mt-0.5 text-xs text-zinc-500">This is the caption every selected account uses, unless you edit one below.</p>
      </div>
      <div class="p-5">
        <textarea
          [ngModel]="c.body()" (ngModelChange)="c.body.set($event)"
          rows="8"
          aria-label="Post text"
          placeholder="What are you posting?"
          class="min-h-44 w-full resize-y rounded-xl border border-[#e8e8e3] bg-[#fcfcf9] p-4 text-sm text-[#121417] outline-none focus:border-cta dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
        ></textarea>
        <div class="mt-3 flex items-center justify-between gap-2">
          <button type="button" (click)="c.copilot()" [disabled]="!!c.aiBusy()" class="inline-flex items-center gap-1.5 rounded-full bg-cta-soft px-2.5 py-1 text-xs font-semibold text-cta disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#3a221c]">
            {{ c.aiBusy() === 'copilot' ? 'Generating…' : 'Write caption' }}
          </button>
          <span class="text-xs text-zinc-400">{{ c.body().length }} characters</span>
        </div>
      </div>
    </section>
  `,
})
export class ComposeWrite {
  readonly c = inject(COMPOSE);
}
