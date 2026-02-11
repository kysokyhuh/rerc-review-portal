import React from "react";

type QueueFiltersProps = {
  search: string;
  sla: "all" | "on-track" | "due-soon" | "overdue" | "blocked";
  onSearchChange: (value: string) => void;
  onSlaChange: (value: "all" | "on-track" | "due-soon" | "overdue" | "blocked") => void;
};

export const QueueFilters: React.FC<QueueFiltersProps> = ({
  search,
  sla,
  onSearchChange,
  onSlaChange,
}) => {
  return (
    <section className="queue-filters" aria-label="Queue filters">
      <label>
        Search Queue
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Project code, title, PI"
        />
      </label>
      <label>
        SLA Status
        <select
          value={sla}
          onChange={(event) =>
            onSlaChange(
              event.target.value as "all" | "on-track" | "due-soon" | "overdue" | "blocked"
            )
          }
        >
          <option value="all">All</option>
          <option value="on-track">On Track</option>
          <option value="due-soon">Due Soon</option>
          <option value="overdue">Overdue</option>
          <option value="blocked">Blocked</option>
        </select>
      </label>
    </section>
  );
};
