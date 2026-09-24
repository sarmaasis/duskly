import { sqliteTable, text, integer, index, primaryKey } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

export const workspace = sqliteTable("workspace", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull().references(() => user.id),
  plan: text("plan").notNull().default("standard"),
  signature: text("signature"),
  theme: text("theme").notNull().default("light"),
  accountKind: text("account_kind"),
  onboardingCompleted: integer("onboarding_completed", { mode: "boolean" }).notNull().default(false),
  extrasJson: text("extras_json"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const workspaceMember = sqliteTable(
  "workspace_member",
  {
    workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] }), index("workspace_member_user").on(t.userId)],
);

export const customerGroup = sqliteTable("customer_group", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const socialAccount = sqliteTable(
  "social_account",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
    network: text("network").notNull(),
    handle: text("handle").notNull(),
    externalId: text("external_id").notNull(),
    tokenCipher: text("token_cipher").notNull(),
    credentialsJson: text("credentials_json"),
    groupId: text("group_id"),
    queueSlots: text("queue_slots"),
    status: text("status").notNull().default("active"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("social_account_ws").on(t.workspaceId)],
);

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull().references(() => user.id),
    body: text("body").notNull(),
    status: text("status").notNull(),
    scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    mediaIds: text("media_ids"),
    signatureId: text("signature_id"),
    delaySeconds: integer("delay_seconds").notNull().default(0),
    repeatRule: text("repeat_rule"),
    repeatUntil: integer("repeat_until", { mode: "timestamp_ms" }),
    parentPostId: text("parent_post_id"),
    postingSetId: text("posting_set_id"),
    commentBody: text("comment_body"),
    commentDelaySeconds: integer("comment_delay_seconds").notNull().default(0),
    variantsJson: text("variants_json"),
    extrasJson: text("extras_json"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("posts_due").on(t.status, t.scheduledAt), index("posts_ws").on(t.workspaceId)],
);

export const postDestination = sqliteTable(
  "post_destination",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    socialAccountId: text("social_account_id").notNull().references(() => socialAccount.id),
    status: text("status").notNull().default("pending"),
    remoteId: text("remote_id"),
    error: text("error"),
  },
  (t) => [index("post_destination_post").on(t.postId), index("post_destination_account").on(t.socialAccountId)],
);

export const media = sqliteTable("media", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  r2Key: text("r2_key").notNull(),
  contentType: text("content_type").notNull(),
  bytes: integer("bytes").notNull(),
  kind: text("kind").notNull().default("image"),
  metaJson: text("meta_json"),
});

export const postingSet = sqliteTable("posting_set", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  channelIds: text("channel_ids").notNull(),
  templateBody: text("template_body"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const signature = sqliteTable("signature", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  body: text("body").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const usageCounter = sqliteTable(
  "usage_counter",
  {
    workspaceId: text("workspace_id").notNull(),
    period: text("period").notNull(),
    kind: text("kind").notNull(),
    used: integer("used").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.period, t.kind] })],
);

export const apiToken = sqliteTable("api_token", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull(),
  tokenPrefix: text("token_prefix").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
});

export const outboundWebhook = sqliteTable("outbound_webhook", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: text("events").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const plug = sqliteTable(
  "plug",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id"),
    scope: text("scope").notNull(),
    name: text("name").notNull(),
    triggerType: text("trigger_type").notNull(),
    actionJson: text("action_json").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("plug_ws").on(t.workspaceId)],
);

export const rssFeed = sqliteTable(
  "rss_feed",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    channelIds: text("channel_ids").notNull(),
    groupId: text("group_id"),
    lastGuid: text("last_guid"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("rss_feed_ws").on(t.workspaceId)],
);

export const agentRun = sqliteTable("agent_run", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  resultJson: text("result_json").notNull(),
  postId: text("post_id"),
  status: text("status").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const workspaceInvite = sqliteTable(
  "workspace_invite",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"),
    status: text("status").notNull().default("pending"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("workspace_invite_email").on(t.email, t.status)],
);

export const schema = {
  user,
  session,
  account,
  verification,
  workspace,
  workspaceMember,
  customerGroup,
  socialAccount,
  posts,
  postDestination,
  media,
  postingSet,
  signature,
  usageCounter,
  apiToken,
  outboundWebhook,
  plug,
  rssFeed,
  agentRun,
  workspaceInvite,
};
