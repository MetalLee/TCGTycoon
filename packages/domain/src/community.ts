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

export const ANNOUNCEMENT_ACTION_TYPES = [
  "EXPANSION_RELEASE",
  "BALANCE_CHANGE",
  "REPRINT_PLAN",
  "TOURNAMENT_PROMOTION",
  "DEVELOPMENT_UPDATE",
  "ISSUE_RESPONSE",
] as const;
export type AnnouncementActionType = (typeof ANNOUNCEMENT_ACTION_TYPES)[number];

export const COMMITMENT_TYPES = [
  "RELEASE_PRODUCT",
  "COMPLETE_REPRINT",
  "ENACT_POLICY",
  "RUN_TOURNAMENT",
  "FINALIZE_EXPANSION",
] as const;
export type CommitmentType = (typeof COMMITMENT_TYPES)[number];
export type CommitmentStatus = "PENDING" | "FULFILLED" | "BREACHED";

export type AnnouncementBoundAction = {
  type: AnnouncementActionType;
  subjectId: string;
};

export type Commitment = {
  id: string;
  type: CommitmentType;
  subjectId: string;
  dueDay: number;
  status: CommitmentStatus;
};

export type OfficialAnnouncement = {
  id: string;
  day: number;
  topic: AnnouncementTopic;
  text: string;
  boundAction: AnnouncementBoundAction;
  attention: number;
  commitment?: Commitment;
};

export type AnnouncementState = {
  announcements: OfficialAnnouncement[];
};
