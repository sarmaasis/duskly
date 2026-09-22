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
};
