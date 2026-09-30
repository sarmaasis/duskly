import { InjectionToken } from "@angular/core";
import type { ComposerPage } from "./composer.page";

export type ComposeStep = "write" | "pictures" | "channels" | "schedule" | "more";

export const COMPOSE = new InjectionToken<ComposerPage>("COMPOSE");
