import { Component, input } from "@angular/core";

@Component({
  selector: "dk-spinner",
  standalone: true,
  template: `
    <span class="inline-flex items-center justify-center" [class.gap-3]="!!label()" [class.py-16]="block()" [attr.role]="label() ? 'status' : null" [attr.aria-hidden]="label() ? null : true">
      <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="animate-spin">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      </svg>
      @if (label()) {
        <span class="text-sm text-muted">{{ label() }}</span>
      }
    </span>
  `,
})
export class Spinner {
  readonly size = input(16);
  readonly label = input("");
  readonly block = input(false);
}
