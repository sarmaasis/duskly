import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { MarketingFooter } from "../../layout/marketing-footer";
import { GrowthNavComponent } from "../growth.page";

@Component({
  standalone: true,
  selector: "dk-tools-shell",
  imports: [RouterOutlet, MarketingFooter, GrowthNavComponent],
  template: `
    <div class="min-h-dvh bg-[#fbfbfa] font-sans text-[#09090b] antialiased">
      <dk-growth-nav />
      <router-outlet />
      <dk-marketing-footer />
    </div>
  `,
})
export class ToolsShell {}
