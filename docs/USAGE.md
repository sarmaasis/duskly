# Using Duskly

[Documentation index](../README.md#documentation)

## Your first post

1. **Sign in** with an email code and complete workspace onboarding.
2. Open **Accounts** and connect a network. OAuth requires credentials configured by the instance operator; token-based connections ask for the relevant token or app password.
3. Select **New post**, write your caption, and choose the destination accounts.
4. Attach media if needed. Check each network's requirements before scheduling; some destinations require an image or video.
5. Follow **Write → Accounts → Schedule**. Use **Save draft** to keep working later, or choose a date and time and select **Schedule post**. To publish an existing draft immediately, open its **Post actions → Send now** on Posts.
6. Check **Posts** for the post and **Delivery updates** for publishing issues. Scheduling a post is not confirmation that the network accepted it.

## Find your way around

| Area | What belongs here |
| --- | --- |
| Posts | Drafts, schedules, and published posts in one list; Calendar and Week are optional views |
| Accounts | Connect and manage where you publish |
| Analytics | Publishing results |
| More → Media library | Reuse photos and videos |
| More → Replies | Conversations and responses |
| More → AI assistant | Assisted publishing tasks |
| More → Settings | Workspace preferences, reusable content, API tokens, and integrations |
| More → Team | Members and invites |
| More → Billing | Cloud subscription; hidden for self-hosted instances |

Desktop and mobile share the same top navigation. **New post** is the single creation action and disappears while you are already writing. **More** contains secondary tools, theme, sign-out, and help. Escape closes More or Delivery updates and returns focus to its trigger.

A new workspace starts with instructions to connect an account. Once connected, the empty Posts screen explains how to write the first post. Filtering an existing list to zero results shows a filter reset, not a setup prompt.

The composer has three steps: **Write**, **Accounts**, and **Schedule**. Photos/video and preview are optional in Write. Per-account captions, repeating schedules, first comments, and advanced options are collapsed until needed. Save draft keeps the text and updates that same draft on subsequent saves.

## Companies and accounts

The **Company filter** appears only after companies exist. It filters the workspace to a company or **All companies**. It does not switch your signed-in user or create a separate workspace. Use **Accounts → Organize by company** to create optional client or brand groups. A filter with no matching accounts can make views appear empty; switch back to All companies when checking missing content.

## Delivery issues

Delivery updates show failed posts and posts still queued, including channel errors when available. Open the affected post to review its destinations, credentials, permissions, and media. Replies is a separate destination for conversations; its navigation does not use the publishing-alert count.

Avoid repeatedly publishing while checking a failure. Verify the destination network first, especially if it may have accepted a post before a connection failed. See [Troubleshooting](TROUBLESHOOTING.md).

## Automation

Create an API token in **Settings → API tokens**. REST calls requiring a workspace ID use the ID shown in Settings. The in-app `/docs/api` and `/docs/mcp` pages describe authentication and supported endpoints/tools. Treat tokens like passwords and use only the access you need. Self-hosted API calls must use your own API origin.
