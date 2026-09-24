import { Component, EventEmitter, HostListener, Input, Output, forwardRef } from "@angular/core";
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from "@angular/forms";

/** Shared paper-desk field chrome (slid-aligned, Tailwind only). */
export const FIELD =
  "h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm normal-case text-[#121417] outline-none transition-colors focus:border-[#121417] focus:bg-white disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:bg-zinc-800 dark:[color-scheme:dark]";

export type DkOption = { value: string; label: string };

/** Styled select: appearance-none + chevron (no raw OS chrome). */
@Component({
  selector: "dk-select",
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DkSelect), multi: true }],
  template: `
    <div class="relative">
      <select
        class="h-10 w-full appearance-none rounded-md border border-[#e8e8e3] bg-[#f7f7f4] py-0 pl-3 pr-9 text-sm normal-case text-[#121417] outline-none transition-colors focus:border-[#121417] focus:bg-white disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:bg-zinc-800 dark:[color-scheme:dark]"
        [disabled]="isDisabled"
        [value]="value"
        (change)="set($any($event.target).value)"
        (blur)="onTouched()"
      >
        <ng-content />
      </select>
      <svg class="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-[#71717a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
  `,
})
export class DkSelect implements ControlValueAccessor {
  value = "";
  isDisabled = false;
  private changed: (v: string) => void = () => undefined;
  onTouched: () => void = () => undefined;
  set(v: string) {
    this.value = v;
    this.changed(v);
  }
  writeValue(v: string | null) {
    this.value = v ?? "";
  }
  registerOnChange(fn: (v: string) => void) {
    this.changed = fn;
  }
  registerOnTouched(fn: () => void) {
    this.onTouched = fn;
  }
  setDisabledState(d: boolean) {
    this.isDisabled = d;
  }
}

/** Slid-style choice radio (button + radio dot). */
@Component({
  selector: "dk-choice",
  standalone: true,
  template: `
    <button
      type="button"
      role="radio"
      class="flex w-full items-start gap-2.5 rounded-[10px] border px-3 py-2.5 text-left text-xs font-semibold transition-colors duration-150"
      [class.border-[#121417]]="selected"
      [class.bg-[#f7f7f4]]="selected"
      [class.text-[#121417]]="selected"
      [class.dark:bg-zinc-800]="selected"
      [class.dark:text-zinc-50]="selected"
      [class.border-[#e8e8e3]]="!selected"
      [class.bg-white]="!selected"
      [class.text-[#63676c]]="!selected"
      [class.dark:border-zinc-700]="!selected"
      [class.dark:bg-zinc-900]="!selected"
      [class.dark:text-zinc-400]="!selected"
      [attr.aria-checked]="selected"
      [attr.aria-pressed]="selected"
      (click)="pick.emit(value)"
    >
      <span
        class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors"
        [class.border-cta]="selected"
        [class.bg-cta]="selected"
        [class.border-[#c9c0ad]]="!selected"
        [class.bg-white]="!selected"
        aria-hidden="true"
      >
        <span class="size-1.5 rounded-full bg-white transition-transform" [class.scale-100]="selected" [class.scale-0]="!selected"></span>
      </span>
      <span class="min-w-0 flex-1 leading-snug"><ng-content /></span>
    </button>
  `,
})
export class DkChoice {
  @Input() value = "";
  @Input() selected = false;
  @Output() pick = new EventEmitter<string>();
}

/** Multi-select pill (keeps multi channel pick; not a radio). */
@Component({
  selector: "dk-pill",
  standalone: true,
  template: `
    <button
      type="button"
      class="inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors"
      [class.border-[#121417]]="on"
      [class.bg-[#121417]]="on"
      [class.text-white]="on"
      [class.dark:bg-zinc-100]="on"
      [class.dark:text-zinc-900]="on"
      [class.border-[#e8e8e3]]="!on"
      [class.bg-white]="!on"
      [class.text-[#52525b]]="!on"
      [class.dark:border-zinc-600]="!on"
      [class.dark:bg-zinc-900]="!on"
      [class.dark:text-zinc-300]="!on"
      [attr.aria-pressed]="on"
      (click)="toggle.emit()"
    >
      <ng-content />
    </button>
  `,
})
export class DkPill {
  @Input() on = false;
  @Output() toggle = new EventEmitter<void>();
}

/** Slid-style segment control. */
@Component({
  selector: "dk-seg",
  standalone: true,
  template: `
    <div class="inline-flex rounded-full border border-[#e4e4e7] bg-white p-1 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-900" role="group">
      @for (o of options; track o.value) {
        <button
          type="button"
          class="rounded-full px-3 py-1.5 transition-colors"
          [class.bg-[#09090b]]="value === o.value"
          [class.text-white]="value === o.value"
          [class.dark:bg-zinc-100]="value === o.value"
          [class.dark:text-zinc-900]="value === o.value"
          [class.text-[#52525b]]="value !== o.value"
          [attr.aria-pressed]="value === o.value"
          (click)="pick.emit(o.value)"
        >
          {{ o.label }}
        </button>
      }
    </div>
  `,
})
export class DkSeg {
  @Input() options: DkOption[] = [];
  @Input() value = "";
  @Output() pick = new EventEmitter<string>();
}

/** Custom date dropdown (YYYY-MM-DD) — paper calendar panel, not browser date chrome. */
@Component({
  selector: "dk-date",
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DkDate), multi: true }],
  template: `
    <div class="relative" [class.z-40]="open" #wrap>
      <button
        type="button"
        class="flex h-10 w-full items-center justify-between rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-left text-sm normal-case outline-none transition-colors focus:border-[#121417] disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        [disabled]="isDisabled"
        (click)="toggle()"
      >
        <span [class.text-[#a1a1aa]]="!value">{{ value || placeholder }}</span>
        <svg class="size-4 shrink-0 text-[#71717a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" stroke-linecap="round" />
        </svg>
      </button>
      @if (open) {
        <div class="absolute left-0 z-30 mt-1 w-72 rounded-xl border border-[#e8e8e3] bg-white p-3 shadow-[0_12px_32px_-16px_rgba(15,18,24,0.45)] dark:border-zinc-700 dark:bg-zinc-900">
          <div class="mb-2 flex items-center justify-between">
            <button type="button" class="rounded-md px-2 py-1 text-xs font-semibold text-[#52525b] hover:bg-[#f7f7f4] dark:hover:bg-zinc-800" (click)="shift(-1)">‹</button>
            <p class="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">{{ monthLabel }}</p>
            <button type="button" class="rounded-md px-2 py-1 text-xs font-semibold text-[#52525b] hover:bg-[#f7f7f4] dark:hover:bg-zinc-800" (click)="shift(1)">›</button>
          </div>
          <div class="mb-1 grid grid-cols-7 gap-0.5 text-center font-mono text-[9px] font-semibold uppercase text-[#a1a1aa]">
            @for (d of dow; track d) {
              <span>{{ d }}</span>
            }
          </div>
          <div class="grid grid-cols-7 gap-0.5">
            @for (cell of cells; track $index) {
              <button
                type="button"
                class="flex h-8 items-center justify-center rounded-md text-[12px] font-semibold"
                [class.text-transparent]="!cell"
                [disabled]="!cell"
                [class.bg-cta]="cell === value"
                [class.text-white]="cell === value"
                [class.text-[#121417]]="!!cell && cell !== value"
                [class.hover:bg-[#f7f7f4]]="!!cell && cell !== value"
                [class.dark:text-zinc-100]="!!cell && cell !== value"
                [class.dark:hover:bg-zinc-800]="!!cell && cell !== value"
                (click)="cell && choose(cell)"
              >
                {{ cell ? +cell.slice(8) : "" }}
              </button>
            }
          </div>
          <div class="mt-2 flex justify-between border-t border-[#e8e8e3] pt-2 dark:border-zinc-700">
            <button type="button" class="text-[11px] font-semibold text-[#63676c]" (click)="clear()">Clear</button>
            <button type="button" class="text-[11px] font-semibold text-cta" (click)="choose(today())">Today</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class DkDate implements ControlValueAccessor {
  @Input() placeholder = "Pick a date";
  value = "";
  open = false;
  isDisabled = false;
  view = new Date();
  dow = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  private changed: (v: string) => void = () => undefined;
  private touched: () => void = () => undefined;

  get monthLabel() {
    return this.view.toLocaleString("en", { month: "long", year: "numeric" });
  }

  get cells(): (string | null)[] {
    const y = this.view.getFullYear();
    const m = this.view.getMonth();
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const out: (string | null)[] = Array.from({ length: first }, () => null);
    for (let d = 1; d <= days; d++) {
      out.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    while (out.length % 7) out.push(null);
    return out;
  }

  shift(delta: number) {
    this.view = new Date(this.view.getFullYear(), this.view.getMonth() + delta, 1);
  }

  today() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  }

  toggle() {
    if (this.isDisabled) return;
    this.open = !this.open;
  }

  choose(iso: string) {
    this.value = iso;
    this.changed(iso);
    this.touched();
    this.open = false;
    if (iso) {
      const [y, m] = iso.split("-").map(Number);
      this.view = new Date(y, m - 1, 1);
    }
  }

  clear() {
    this.choose("");
  }

  @HostListener("document:click", ["$event"])
  onDoc(ev: MouseEvent) {
    if (!(ev.target as HTMLElement)?.closest("dk-date")) this.open = false;
  }

  writeValue(v: string | null) {
    this.value = v ?? "";
    if (this.value) {
      const [y, m] = this.value.split("-").map(Number);
      if (y && m) this.view = new Date(y, m - 1, 1);
    }
  }
  registerOnChange(fn: (v: string) => void) {
    this.changed = fn;
  }
  registerOnTouched(fn: () => void) {
    this.touched = fn;
  }
  setDisabledState(d: boolean) {
    this.isDisabled = d;
    if (d) this.open = false;
  }
}

/** Clock dropdown (HH:mm). Same paper panel as the date picker, not the browser time chrome. */
@Component({
  selector: "dk-time",
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DkTime), multi: true }],
  template: `
    <div class="relative" [class.z-40]="open">
      <button
        type="button"
        class="flex h-10 w-full items-center justify-between rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-left text-sm normal-case outline-none transition-colors focus:border-[#121417] disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        [disabled]="isDisabled"
        (click)="toggle()"
        aria-label="Time"
      >
        <span>{{ label }}</span>
        <svg class="size-4 shrink-0 text-[#71717a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v6l4 2" stroke-linecap="round" />
        </svg>
      </button>
      @if (open) {
        <div class="absolute right-0 z-30 mt-1 flex gap-1 rounded-xl border border-[#e8e8e3] bg-white p-2 shadow-[0_12px_32px_-16px_rgba(15,18,24,0.45)] dark:border-zinc-700 dark:bg-zinc-900">
          <div class="max-h-48 w-12 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            @for (h of hours; track h) {
              <button type="button" class="flex h-8 w-full items-center justify-center rounded-md text-[12px] font-semibold" [class.bg-cta]="h === hour12" [class.text-white]="h === hour12" [class.text-[#121417]]="h !== hour12" [class.hover:bg-[#f7f7f4]]="h !== hour12" [class.dark:text-zinc-100]="h !== hour12" [class.dark:hover:bg-zinc-800]="h !== hour12" [attr.data-time-on]="h === hour12 ? 'hour' : null" (click)="setHour(h)">{{ h }}</button>
            }
          </div>
          <div class="max-h-48 w-12 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            @for (m of minutes; track m) {
              <button type="button" class="flex h-8 w-full items-center justify-center rounded-md text-[12px] font-semibold" [class.bg-cta]="m === minute" [class.text-white]="m === minute" [class.text-[#121417]]="m !== minute" [class.hover:bg-[#f7f7f4]]="m !== minute" [class.dark:text-zinc-100]="m !== minute" [class.dark:hover:bg-zinc-800]="m !== minute" [attr.data-time-on]="m === minute ? 'minute' : null" (click)="setMinute(m)">{{ pad(m) }}</button>
            }
          </div>
          <div class="flex w-12 flex-col gap-1">
            <button type="button" class="h-8 rounded-md text-[11px] font-semibold" [class.bg-cta]="period === 'AM'" [class.text-white]="period === 'AM'" [class.text-[#121417]]="period !== 'AM'" [class.hover:bg-[#f7f7f4]]="period !== 'AM'" [class.dark:text-zinc-100]="period !== 'AM'" [class.dark:hover:bg-zinc-800]="period !== 'AM'" (click)="setPeriod('AM')">AM</button>
            <button type="button" class="h-8 rounded-md text-[11px] font-semibold" [class.bg-cta]="period === 'PM'" [class.text-white]="period === 'PM'" [class.text-[#121417]]="period !== 'PM'" [class.hover:bg-[#f7f7f4]]="period !== 'PM'" [class.dark:text-zinc-100]="period !== 'PM'" [class.dark:hover:bg-zinc-800]="period !== 'PM'" (click)="setPeriod('PM')">PM</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class DkTime implements ControlValueAccessor {
  value = "09:00";
  open = false;
  isDisabled = false;
  hour12 = 9;
  minute = 0;
  period: "AM" | "PM" = "AM";
  readonly hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  readonly minutes = Array.from({ length: 60 }, (_, i) => i);
  private changed: (v: string) => void = () => undefined;
  private touched: () => void = () => undefined;

  get label() {
    return `${this.hour12}:${this.pad(this.minute)} ${this.period}`;
  }

  pad(n: number) {
    return String(n).padStart(2, "0");
  }

  toggle() {
    this.open = !this.open;
    if (!this.open) return;
    setTimeout(() => {
      document.querySelectorAll("[data-time-on]").forEach((el) => {
        const parent = el.parentElement;
        if (!parent || !(el instanceof HTMLElement)) return;
        parent.scrollTop = el.offsetTop - parent.clientHeight / 2 + el.offsetHeight / 2;
      });
    });
  }

  setHour(h: number) {
    this.hour12 = h;
    this.emit();
  }

  setMinute(m: number) {
    this.minute = m;
    this.emit();
  }

  setPeriod(p: "AM" | "PM") {
    this.period = p;
    this.emit();
  }

  private emit() {
    const h24 = this.period === "PM" ? (this.hour12 % 12) + 12 : this.hour12 % 12;
    this.value = `${this.pad(h24)}:${this.pad(this.minute)}`;
    this.changed(this.value);
    this.touched();
  }

  @HostListener("document:click", ["$event"])
  onDoc(ev: MouseEvent) {
    if (!(ev.target as HTMLElement)?.closest("dk-time")) this.open = false;
  }

  writeValue(v: string | null) {
    const [hs, ms] = (v || "09:00").split(":");
    const hour = Number(hs);
    const minute = Number(ms);
    const h = Number.isFinite(hour) ? hour : 9;
    this.minute = Number.isFinite(minute) ? minute : 0;
    this.period = h >= 12 ? "PM" : "AM";
    this.hour12 = h % 12 || 12;
    this.value = `${this.pad(h)}:${this.pad(this.minute)}`;
  }
  registerOnChange(fn: (v: string) => void) {
    this.changed = fn;
  }
  registerOnTouched(fn: () => void) {
    this.touched = fn;
  }
  setDisabledState(d: boolean) {
    this.isDisabled = d;
  }
}

/** Date + time (stores datetime-local string YYYY-MM-DDTHH:mm). */
@Component({
  selector: "dk-datetime",
  standalone: true,
  imports: [FormsModule, DkDate, DkTime],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DkDateTime), multi: true }],
  template: `
    <div class="grid gap-2 sm:grid-cols-[1fr_8.5rem]">
      <dk-date [(ngModel)]="datePart" (ngModelChange)="sync()" [placeholder]="placeholder" />
      <dk-time [(ngModel)]="timePart" (ngModelChange)="sync()" />
    </div>
  `,
})
export class DkDateTime implements ControlValueAccessor {
  @Input() placeholder = "Schedule date";
  datePart = "";
  timePart = "09:00";
  private changed: (v: string) => void = () => undefined;
  private touched: () => void = () => undefined;

  sync() {
    const v = this.datePart ? `${this.datePart}T${this.timePart || "00:00"}` : "";
    this.changed(v);
    this.touched();
  }

  writeValue(v: string | null) {
    if (!v) {
      this.datePart = "";
      this.timePart = "09:00";
      return;
    }
    const [d, t] = v.split("T");
    this.datePart = d || "";
    this.timePart = (t || "09:00").slice(0, 5);
  }
  registerOnChange(fn: (v: string) => void) {
    this.changed = fn;
  }
  registerOnTouched(fn: () => void) {
    this.touched = fn;
  }
}
