import { Component, inject } from "@angular/core";
import { COMPOSE } from "./compose-context";

@Component({
  selector: "dk-compose-nav",
  standalone: true,
  template: `
    <nav aria-label="Post steps">
      <div class="inline-flex max-w-full flex-wrap gap-0.5 rounded-full border border-[#e7e7e2] bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
        @for (item of steps; track item.id) {
          <button
            type="button"
            (click)="c.step.set(item.id)"
            class="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium hover:text-cta"
            [class.bg-cta]="(c.step() === item.id || (item.id === 'write' && c.step() === 'pictures'))"
            [class.text-white]="(c.step() === item.id || (item.id === 'write' && c.step() === 'pictures'))"
            [class.hover:text-white]="(c.step() === item.id || (item.id === 'write' && c.step() === 'pictures'))"
            [class.hover:bg-cta-hover]="(c.step() === item.id || (item.id === 'write' && c.step() === 'pictures'))"
            [class.text-[#3f3f46]]="!(c.step() === item.id || (item.id === 'write' && c.step() === 'pictures'))"
            [class.dark:text-zinc-300]="!(c.step() === item.id || (item.id === 'write' && c.step() === 'pictures'))"
            [attr.aria-pressed]="(c.step() === item.id || (item.id === 'write' && c.step() === 'pictures'))"
          >
            <span class="opacity-60">{{ $index + 1 }}</span> {{ item.name }}
            @if (count(item.id); as n) {
              <span class="rounded-full bg-cta px-1.5 text-[10px] font-bold leading-4 text-white">{{ n }}</span>
            }
          </button>
        }
      </div>
    </nav>
  `,
})
export class ComposeNav {
  readonly c = inject(COMPOSE);
  readonly steps = [
    { id: "write" as const, name: "Write" },
    { id: "channels" as const, name: "Accounts" },
    { id: "schedule" as const, name: "Schedule" },
  ];

  count(id: string) {
    if (id === "pictures") return this.c.attachments().length;
    if (id === "channels") return this.c.selected().length;
    return 0;
  }
}
