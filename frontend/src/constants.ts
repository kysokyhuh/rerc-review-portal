/**
 * Application-wide constants for the URERD Review Portal
 */

import type { QueueType } from "@/types";

/**
 * SLA target working days for each queue type
 */
export const SLA_TARGETS: Record<QueueType, number> = {
  classification: 5,
  review: 12,
  revision: 7,
} as const;

/**
 * Number of working days remaining to trigger "due soon" status
 */
export const DUE_SOON_THRESHOLD = 3;

/**
 * Number of working days a classification can wait before flagging
 */
export const CLASSIFICATION_WAIT_THRESHOLD = 3;

/**
 * Auto-refresh interval in milliseconds (90 seconds)
 */
export const AUTO_REFRESH_INTERVAL_MS = 90000;

/**
 * Freshness threshold for data staleness indicator (90 seconds)
 */
export const DATA_FRESHNESS_THRESHOLD_MS = 90 * 1000;
