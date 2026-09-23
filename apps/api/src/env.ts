export type Env = {
  DB: D1Database;
  KV: KVNamespace;
  MEDIA: R2Bucket;
  EMAIL: {
    send(msg: {
      to: string;
      from: string;
      subject: string;
      html?: string;
      text?: string;
    }): Promise<{ messageId: string }>;
  };
  PUBLISH: Queue;
  SCHEDULER_LOCK: DurableObjectNamespace;
  METRICS: AnalyticsEngineDataset;
  SEARCH: VectorizeIndex;
  AI: Ai;
  IMAGES: {
    input(data: ArrayBuffer | string): {
      transform(opts: Record<string, unknown>): {
        output(opts: Record<string, unknown>): Promise<Response>;
      };
    };
  };
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  WEB_ORIGIN: string;
  EMAIL_FROM: string;
  TOKEN_ENCRYPTION_KEY: string;
  APP_NAME: string;
  DUSKLY_MODE: "selfhost" | "cloud";
  DODO_PAYMENTS_API_KEY: string;
  DODO_PAYMENTS_WEBHOOK_KEY: string;
  DODO_PAYMENTS_ENVIRONMENT: "test_mode" | "live_mode";
  DODO_PRO_MONTHLY_PRODUCT_ID: string;
  DODO_PRO_YEARLY_PRODUCT_ID: string;
  DODO_STANDARD_MONTHLY_PRODUCT_ID: string;
  DODO_STANDARD_YEARLY_PRODUCT_ID: string;
  DODO_TEAM_MONTHLY_PRODUCT_ID: string;
  DODO_TEAM_YEARLY_PRODUCT_ID: string;
  DODO_ULTIMATE_MONTHLY_PRODUCT_ID: string;
  DODO_ULTIMATE_YEARLY_PRODUCT_ID: string;
  X_CLIENT_ID?: string;
  X_CLIENT_SECRET?: string;
  LINKEDIN_CLIENT_ID?: string;
  LINKEDIN_CLIENT_SECRET?: string;
  MASTODON_CLIENT_ID?: string;
  MASTODON_CLIENT_SECRET?: string;
  MASTODON_INSTANCE?: string;
  META_APP_ID?: string;
  META_APP_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  REDDIT_CLIENT_ID?: string;
  REDDIT_CLIENT_SECRET?: string;
  SLACK_CLIENT_ID?: string;
  SLACK_CLIENT_SECRET?: string;
  /** Workers AI model ids — empty/unset uses built-in defaults */
  AI_COPILOT_MODEL?: string;
  AI_IMAGE_MODEL?: string;
  AI_VIDEO_MODEL?: string;
};
