export const CAMPAIGN_TYPES = [
  "SOCIAL_MEDIA_ADS",
  "STREAMER_SPONSORSHIP",
  "NEW_PLAYER_CAMPAIGN",
  "COLLECTOR_CAMPAIGN",
  "TOURNAMENT_PROMOTION",
] as const;

export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const CAMPAIGN_DURATIONS = [3, 7, 14] as const;

export type CampaignDurationDays = (typeof CAMPAIGN_DURATIONS)[number];

export const ANNOUNCEMENT_TOPICS = [
  "EXPANSION",
  "BALANCE",
  "REPRINT",
  "TOURNAMENT",
  "DEVELOPMENT",
  "APOLOGY_RESPONSE",
] as const;

export type AnnouncementTopic = (typeof ANNOUNCEMENT_TOPICS)[number];
