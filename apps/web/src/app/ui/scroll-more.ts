import { afterNextRender, Directive, ElementRef, OnDestroy, effect, inject, input, output } from "@angular/core";

/** Emits when this element nears the viewport and another page can be appended. */
@Directive({ selector: "[dkScrollMore]", standalone: true })
export class ScrollMore implements OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly dkScrollEnabled = input(false);
  readonly dkScrollBusy = input(false);
  readonly dkScrollMoreFire = output<void>();
  private seen = false;
  private observer?: IntersectionObserver;

  constructor() {
    effect(() => {
      this.dkScrollEnabled();
      this.dkScrollBusy();
      this.kick();
    });
    afterNextRender(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          this.seen = entries.some((entry) => entry.isIntersecting);
          this.kick();
        },
        { rootMargin: "240px" },
      );
      this.observer.observe(this.host.nativeElement);
    });
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  private kick() {
    if (!this.seen || !this.dkScrollEnabled() || this.dkScrollBusy()) return;
    this.dkScrollMoreFire.emit();
  }
}
