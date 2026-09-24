const STATUS: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  scheduled: "Scheduled",
  queued: "Queued",
  published: "Published",
  failed: "Failed",
  pending: "Waiting",
  active: "Active",
  needs_page: "Needs a page",
  needs_credentials: "Needs a token",
  expired: "Expired",
  manual: "Manual",
  on_publish: "On publish",
  schedule: "Schedule",
  internal: "Internal",
  global: "Global",
  running: "Running",
  done: "Done",
  error: "Error",
  member: "Member",
  admin: "Admin",
  owner: "Owner",
};

const NETWORKS: Record<string, string> = {
  linkedin: "LinkedIn",
  "linkedin-page": "LinkedIn Page",
  x: "X",
  instagram: "Instagram",
  threads: "Threads",
  facebook: "Facebook",
  youtube: "YouTube",
  reddit: "Reddit",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  hashnode: "Hashnode",
  devto: "dev.to",
  telegram: "Telegram",
  discord: "Discord",
  slack: "Slack",
};

function words(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function labelStatus(status: string) {
  return STATUS[status] || (status ? words(status) : "");
}

export function labelNetwork(network: string) {
  return NETWORKS[network] || (network ? words(network) : "");
}
