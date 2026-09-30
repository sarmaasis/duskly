import { Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DkDate, DkDateTime, DkSelect } from "../ui/forms";
import { COMPOSE } from "./compose-context";

@Component({
  selector: "dk-compose-schedule",
  standalone: true,
  imports: [FormsModule, DkSelect, DkDate, DkDateTime],
  template: `
    <section class="rounded-2xl border border-[#e8e8e3] bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <div class="border-b border-[#e8e8e3] px-5 py-4 dark:border-zinc-700">
        <h2 class="text-sm font-semibold text-[#121417] dark:text-zinc-100">Schedule post</h2>
        <p class="mt-0.5 text-xs text-zinc-500">Choose when this post goes live.</p>
      </div>
      <div class="space-y-5 p-5">
      <div class="grid grid-cols-2 gap-2 rounded-xl bg-[#f7f7f4] p-1 dark:bg-zinc-800">
        <button type="button" (click)="c.publishWhen = 'now'" class="rounded-lg px-3 py-2 text-sm font-medium" [class.bg-white]="c.publishWhen === 'now'" [class.shadow-sm]="c.publishWhen === 'now'" [class.text-zinc-500]="c.publishWhen !== 'now'" [class.dark:bg-zinc-900]="c.publishWhen === 'now'">Publish now</button>
        <button type="button" (click)="c.publishWhen = 'later'" class="rounded-lg px-3 py-2 text-sm font-medium" [class.bg-white]="c.publishWhen === 'later'" [class.shadow-sm]="c.publishWhen === 'later'" [class.text-zinc-500]="c.publishWhen !== 'later'" [class.dark:bg-zinc-900]="c.publishWhen === 'later'">Schedule for later</button>
      </div>
      @if (c.publishWhen === 'later') {
      <label class="block text-sm font-medium text-[#121417] dark:text-zinc-100">When should this go out?
        <div class="mt-1.5"><dk-datetime [ngModel]="c.when()" (ngModelChange)="c.when.set($event)" placeholder="Pick a date" /></div>
      </label>
      <button type="button" (click)="c.useNextSlot()" class="min-h-11 rounded-lg border border-[#e8e8e3] px-4 text-sm font-semibold text-[#121417] hover:border-cta hover:text-cta dark:border-zinc-700 dark:text-zinc-100">Use the next free time</button>
      } @else {
        <p class="rounded-xl border border-cta/20 bg-cta-soft p-4 text-sm text-[#121417] dark:bg-[#3a221c] dark:text-zinc-100">This post publishes as soon as you choose Publish post.</p>
      }
      <p class="text-sm text-zinc-500 dark:text-zinc-400">The time is in your own timezone. Leave it empty if you only want to save a draft.</p>
      <details class="border-t border-line pt-4 dark:border-zinc-700">
        <summary class="cursor-pointer text-sm font-medium">Repeat this post, or add a first comment <span class="text-xs font-normal text-muted">Optional</span></summary>
        <div class="mt-4 space-y-5">
      <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Post delay (seconds)
        <input type="number" [(ngModel)]="c.delaySeconds" min="0" [class]="c.fieldMt" />
      </label>
      <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Repeat
        <dk-select [(ngModel)]="c.repeatRule" name="repeatRule" class="mt-1.5 block">
          <option value="none">None</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="interval">Every few days</option>
        </dk-select>
      </label>
      @if (c.repeatRule === 'interval') {
        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Days between posts
          <input type="number" [(ngModel)]="c.repeatEveryDays" min="1" max="90" name="repeatEvery" [class]="c.fieldMt" />
        </label>
      }
      <div>
        <p class="text-xs font-medium text-zinc-600 dark:text-zinc-400">Repeat until</p>
        <div class="mt-1.5">
          <dk-date [(ngModel)]="c.repeatUntil" [disabled]="c.repeatRule==='none'" placeholder="End date" />
        </div>
      </div>
      <div class="border-t border-[#e8e8e3] pt-4 dark:border-zinc-700">
        <h2 class="text-sm font-semibold text-[#121417] dark:text-zinc-100">First comment</h2>
        <p class="mt-1 text-xs text-zinc-500">Optional reply under the post. Delay waits before sending.</p>
        <div class="mt-3 grid grid-cols-1 gap-4">
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 md:col-span-2">Comment body
            <input [(ngModel)]="c.commentBody" placeholder="Link in bio…" [class]="c.fieldMt" />
          </label>
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Delay (sec)
            <input type="number" [(ngModel)]="c.commentDelaySeconds" min="0" [disabled]="!c.commentBody" [class]="c.fieldMt" />
          </label>
        </div>
      </div>
        </div>
      </details>
      </div>
    </section>
  `,
})
export class ComposeSchedule {
  readonly c = inject(COMPOSE);
}
