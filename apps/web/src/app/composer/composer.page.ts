import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AppShell } from "../layout/app-shell";
@Component({
  standalone: true,
  imports: [AppShell, FormsModule],
  template: `<sd-shell>
    <h1>Compose</h1>
    <div class="card" style="max-width:640px">
      <div class="field"><label for="body">Post</label><textarea id="body" rows="6" [(ngModel)]="body"></textarea></div>
      <div class="field"><label for="when">Schedule</label><input id="when" type="datetime-local" [(ngModel)]="when" /></div>
      <button class="btn btn-primary" type="button">Schedule post</button>
    </div>
  </sd-shell>`,
})
export class ComposerPage { body = ""; when = ""; }
