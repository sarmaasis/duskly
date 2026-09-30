import { Component, inject } from "@angular/core";
import { Notices } from "../lib/notices";

@Component({
  selector: "dk-shell-notices",
  standalone: true,
  template: `
      <div class="pointer-events-none fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex flex-col gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:w-80" aria-live="polite">
        @for (note of notices.items(); track note.id) {
          <div class="pointer-events-auto flex items-start gap-3 rounded-xl border px-3 py-2.5 text-[13px] shadow-[0_8px_24px_rgba(15,18,24,0.12)]" [class.border-red-200]="note.tone === 'error'" [class.bg-red-50]="note.tone === 'error'" [class.text-red-900]="note.tone === 'error'" [class.dark:border-red-900]="note.tone === 'error'" [class.dark:bg-red-950]="note.tone === 'error'" [class.dark:text-red-100]="note.tone === 'error'" [class.border-[#e8e8e3]]="note.tone !== 'error'" [class.bg-white]="note.tone !== 'error'" [class.dark:border-zinc-700]="note.tone !== 'error'" [class.dark:bg-zinc-900]="note.tone !== 'error'" role="status">
            <div class="min-w-0 flex-1">
              <p class="text-[11px] font-semibold text-[#09090b] dark:text-zinc-100">{{ note.tone === 'error' ? 'Could not finish' : 'Saved' }}</p>
              <p class="mt-0.5">{{ note.text }}</p>
            </div>
            <button type="button" (click)="notices.dismiss(note.id)" class="shrink-0 text-[12px] font-semibold text-[#52525b]" aria-label="Dismiss">Dismiss</button>
          </div>
        }
      </div>
  `,
})
export class ShellNotices {
  readonly notices = inject(Notices);
}
