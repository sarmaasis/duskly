export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function lsGet(key: string): string | null {
  return isBrowser() ? localStorage.getItem(key) : null;
}

export function lsSet(key: string, value: string): void {
  if (isBrowser()) localStorage.setItem(key, value);
}

export function setDarkClass(on: boolean): void {
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", on);
  }
}
