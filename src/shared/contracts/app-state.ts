/**
 * Persistent application state.
 *
 * Config (app.config.toml) = user intent — preferences, doc roots, dev toggles.
 * State  (state.json)      = runtime data — triage results, timestamps.
 *
 * Kept separate because config is human-editable and changes rarely,
 * while state is machine-written and changes every triage run.
 */

export type TriageBucket = "now" | "next" | "waiting";

export type TriagedIssue = {
  key: string;
  summary: string;
  status: string;
  issueType: string;
  project: string;
  bucket: TriageBucket;
};

export type TriageState = {
  issues: TriagedIssue[];
  lastTriagedAt: number | null;
};

export type AppPersistedState = {
  version: 1;
  triage: TriageState;
};

export const EMPTY_TRIAGE_STATE: TriageState = {
  issues: [],
  lastTriagedAt: null,
};

export const EMPTY_APP_STATE: AppPersistedState = {
  version: 1,
  triage: EMPTY_TRIAGE_STATE,
};

/**
 * Categorize a Jira status string into a triage bucket.
 *
 * NOW:     actively being worked on
 * NEXT:    upcoming, ready to start
 * WAITING: blocked or on hold
 */
export const statusToBucket = (status: string): TriageBucket => {
  const lower = status.toLowerCase();
  if (
    lower.includes("progress") ||
    lower.includes("in review") ||
    lower.includes("in development") ||
    lower.includes("doing")
  ) {
    return "now";
  }
  if (
    lower.includes("block") ||
    lower.includes("hold") ||
    lower.includes("wait") ||
    lower.includes("impediment")
  ) {
    return "waiting";
  }
  return "next";
};
