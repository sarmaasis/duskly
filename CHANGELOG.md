# Changelog

## Unreleased

- Simplify everyday navigation to Posts, Accounts, and Analytics, with one New post action and secondary tools under More on every screen size.
- Open Posts as a readable list, keep Calendar/Week optional, and distinguish first-use guidance from empty filtered results.
- Reduce composing to Write → Accounts → Schedule; collapse optional media previews, per-account captions, repeat settings, and advanced tools. Saving preserves the draft and updates it on subsequent saves.
- Make company organization optional in Accounts and use clearer Media library, Replies, and Delivery updates labels.

- Group app navigation into Publishing and Workspace, share destinations across desktop/mobile, and split navigation, notification dialogs, and notices from workspace loading.
- Add keyboard-accessible mobile navigation, active-route semantics, company context, notification retry, and reliable sign-out failure feedback. Hide Billing navigation in self-host mode.
- Add portable deployment configuration, Worker packaging checks, and a shared release command. Remove unused Vectorize/Images bindings and use simulated email locally.
- Make GitHub deployment opt-in with `DEPLOY_ENABLED=true` and explicit instance origins/sender. Existing Cloud operators must set `DUSKLY_MODE=cloud` and migrate conflicting public configuration secrets to variables; see `docs/DEPLOY.md`.
- Require a supported Angular Node version; CI uses Node 24 and checks production builds.
- Add user, development, and troubleshooting guides and in-app getting-started/self-hosting pages.

## 0.1.0 — 2026-09-23

- Initial public scaffold.
