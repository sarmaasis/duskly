import { mergeApplicationConfig, ApplicationConfig } from "@angular/core";
import { provideServerRendering } from "@angular/ssr";
import { appConfig } from "./app.config";
export const config = mergeApplicationConfig(appConfig, { providers: [provideServerRendering()] } satisfies ApplicationConfig);
