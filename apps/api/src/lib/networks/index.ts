export type Network = "x" | "bluesky" | "linkedin" | "mastodon";
export interface PublishInput { body: string; mediaKeys: string[]; token: string }
export interface NetworkAdapter {
  network: Network;
  publish(input: PublishInput): Promise<{ remoteId: string }>;
}
export const adapters: Partial<Record<Network, NetworkAdapter>> = {};
