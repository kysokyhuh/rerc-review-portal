import React from "react";
import { SLAStatus } from "@/services/api";
import { formatDateDisplay } from "@/utils/dateUtils";

interface SLAStatusChipProps {
  status: SLAStatus;
  workingDaysRemaining: number;
  workingDaysElapsed: number;
  targetWorkingDays: number;
  dueDate: string;
  startedAt: string;
}

export const SLAStatusChip: React.FC<SLAStatusChipProps> = ({
  status,
  workingDaysRemaining,
  workingDaysElapsed,
  targetWorkingDays,
  dueDate,
  startedAt,
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

  const description = `Working days (weekends excluded). Start: ${formatDateDisplay(startedAt)} • Target: ${targetWorkingDays} wd • Elapsed: ${workingDaysElapsed} wd • Due: ${formatDateDisplay(dueDate)}`;

  return (
    <span className={`sla-chip ${statusClass}`} title={description}>
      <span>{statusLabel}</span>
      <span className="sla-meta">
        {workingDaysRemaining >= 0
          ? `${workingDaysRemaining} wd left`
          : `${Math.abs(workingDaysRemaining)} wd over`}
      </span>
    </span>
  );
};
