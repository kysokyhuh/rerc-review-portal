/**
 * SLA calculation and queue decoration utilities
 */

import type {
  DecoratedQueueItem,
  LetterTemplateReadiness,
  QueueItem,
  QueueType,
  SLAStatus,
} from "@/types";
import { addWorkingDays, workingDaysBetween } from "./dateUtils";
import { DUE_SOON_THRESHOLD, SLA_TARGETS } from "@/constants";
import { classifyOverdue } from "./overdueClassifier";

/**
 * Derives the letter template code based on submission type
 */
export function deriveTemplateCode(submissionType?: string): string {
  if (!submissionType) return "6B";
  const normalized = submissionType.toUpperCase();
  if (normalized.includes("AMEND")) return "8B";
  if (normalized.includes("REVISION")) return "9B";
  if (normalized.includes("CONT") || normalized.includes("PROGRESS"))
    return "20B";
  return "6B";
}

/**
 * Finds missing required fields for letter generation
 */
export function findMissingFields(item: QueueItem): string[] {
  const missing: string[] = [];
  if (!item.projectCode) missing.push("project_code");
  if (!item.projectTitle) missing.push("project_title");
  if (!item.piName) missing.push("pi_name");
  if (!item.piAffiliation) missing.push("pi_affiliation");
  if (!item.submissionType) missing.push("submission_type");
  return missing;
}

/**
 * Decorates a queue item with SLA calculations and metadata
 */
export function decorateQueueItem(
  item: QueueItem,
  queue: QueueType,
  now: Date
): DecoratedQueueItem {
  const startDate = new Date(item.receivedDate);
  const targetWorkingDays = SLA_TARGETS[queue];
  const elapsedWorkingDays = workingDaysBetween(startDate, now);
  const workingDaysRemaining = targetWorkingDays - elapsedWorkingDays;
  const dueDate = addWorkingDays(startDate, targetWorkingDays);

  let slaStatus: SLAStatus = "ON_TRACK";
  if (workingDaysRemaining <= DUE_SOON_THRESHOLD) {
    slaStatus = "DUE_SOON";
  }
  if (workingDaysRemaining < 0) {
    slaStatus = "OVERDUE";
  }

  const missingFields = findMissingFields(item);

  // Classify overdue/due-soon owner
  const overdueClassification =
    slaStatus === "OVERDUE" || slaStatus === "DUE_SOON"
      ? classifyOverdue(item.status, {
          hasActionableAssignee: Boolean(item.staffInChargeName),
          hasRoutingMetadata: Boolean(item.projectId),
          hasChairGate:
            item.status === "UNDER_CLASSIFICATION" ||
            item.status === "CLASSIFIED",
        })
      : undefined;

  return {
    ...item,
    queue,
    targetWorkingDays,
    workingDaysElapsed: elapsedWorkingDays,
    workingDaysRemaining,
    slaDueDate: dueDate.toISOString(),
    startedAt: startDate.toISOString(),
    slaStatus,
    missingFields,
    templateCode: deriveTemplateCode(item.submissionType),
    lastAction: item.status,
    overdueOwner: overdueClassification?.overdueOwner,
    overdueReason: overdueClassification?.overdueReason,
    overdueOwnerRole: overdueClassification?.overdueOwnerRole,
    overdueOwnerLabel: overdueClassification?.overdueOwnerLabel,
    overdueOwnerIcon: overdueClassification?.overdueOwnerIcon,
    overdueOwnerReason: overdueClassification?.overdueOwnerReason,
    nextAction:
      queue === "classification"
        ? "Classify"
        : queue === "review"
          ? "Assign reviewers"
          : "Follow up for revisions",
    notes:
      queue === "revision"
        ? "Remind PI of revision deadline"
        : "Ensure letter fields are complete",
  };
}

/**
 * Builds letter readiness summary grouped by template code
 */
export function buildLetterReadiness(
  items: DecoratedQueueItem[]
): LetterTemplateReadiness[] {
  const grouped = new Map<
    string,
    { ready: number; missingFields: number; samples: LetterTemplateReadiness["samples"] }
  >();

  items.forEach((item) => {
    const templateCode = item.templateCode;
    if (!grouped.has(templateCode)) {
      grouped.set(templateCode, { ready: 0, missingFields: 0, samples: [] });
    }
    const entry = grouped.get(templateCode)!;
    if (item.missingFields.length > 0) {
      entry.missingFields += 1;
      if (entry.samples.length < 3) {
        entry.samples.push({
          submissionId: item.id,
          projectCode: item.projectCode,
          projectTitle: item.projectTitle,
          fields: item.missingFields,
        });
      }
    } else {
      entry.ready += 1;
    }
  });

  return Array.from(grouped.entries()).map(([templateCode, value]) => ({
    templateCode,
    ready: value.ready,
    missingFields: value.missingFields,
    samples: value.samples,
  }));
}
