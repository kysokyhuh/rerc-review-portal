import React from "react";
import type { SLADayMode, SLAStatus } from "@/types";
import { formatDateDisplay } from "@/utils/dateUtils";

interface SLAStatusChipProps {
  status: SLAStatus;
  workingDaysRemaining: number | null;
  workingDaysElapsed: number | null;
  targetWorkingDays: number | null;
  dueDate: string | null;
  startedAt: string | null;
  dayMode?: SLADayMode | null;
}

export const SLAStatusChip: React.FC<SLAStatusChipProps> = ({
  status,
  workingDaysRemaining,
  workingDaysElapsed,
  targetWorkingDays,
  dueDate,
  startedAt,
  dayMode,
}) => {
  const statusLabel =
    status === "OVERDUE"
      ? "Overdue"
      : status === "DUE_SOON"
        ? "Due soon"
        : "On track";
  const statusClass =
    status === "OVERDUE"
      ? "overdue"
      : status === "DUE_SOON"
        ? "due-soon"
        : "on-track";

  if (targetWorkingDays == null || workingDaysRemaining == null || dueDate == null || startedAt == null) {
    return (
      <span className={`sla-chip ${statusClass}`} title="SLA will start once the current workflow deadline is set.">
        <span>{statusLabel}</span>
        <span className="sla-meta">SLA pending</span>
      </span>
    );
  }

  const unitLong = dayMode === "CALENDAR" ? "calendar days" : "working days";
  const unitShort = dayMode === "CALENDAR" ? "d" : "wd";
  const description = `${unitLong}. Start: ${formatDateDisplay(startedAt)} • Target: ${targetWorkingDays} ${unitShort} • Elapsed: ${workingDaysElapsed ?? 0} ${unitShort} • Due: ${formatDateDisplay(dueDate)}`;

  return (
    <span className={`sla-chip ${statusClass}`} title={description}>
      <span>{statusLabel}</span>
      <span className="sla-meta">
        {workingDaysRemaining >= 0
          ? `${workingDaysRemaining} ${unitShort} left`
          : `${Math.abs(workingDaysRemaining)} ${unitShort} over`}
      </span>
    </span>
  );
};
