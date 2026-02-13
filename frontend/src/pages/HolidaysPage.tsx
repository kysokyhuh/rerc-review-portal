import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  createHoliday,
  deleteHoliday,
  fetchHolidays,
  updateHoliday,
} from "@/services/api";
import type { HolidayItem } from "@/types";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toDateInput = (value: string) => value.slice(0, 10);

const toDateKey = (value: Date): string => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateKey = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

const addDaysUtc = (value: Date, days: number): Date => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const compareDateKeys = (a: string, b: string) =>
  parseDateKey(a).getTime() - parseDateKey(b).getTime();

const formatDisplayDate = (dateStr: string) => {
  const d = parseDateKey(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

const buildCalendarCells = (monthAnchor: Date) => {
  const year = monthAnchor.getUTCFullYear();
  const month = monthAnchor.getUTCMonth();
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const gridStart = addDaysUtc(firstOfMonth, -firstOfMonth.getUTCDay());
  const lastOfMonth = new Date(Date.UTC(year, month + 1, 0)); // last day of month
  const gridEndDay = addDaysUtc(lastOfMonth, 6 - lastOfMonth.getUTCDay()); // end of that week row
  const totalDays =
    Math.round((gridEndDay.getTime() - gridStart.getTime()) / 86400000) + 1;
  const todayKey = toDateKey(new Date());
  return Array.from({ length: totalDays }, (_, index) => {
    const date = addDaysUtc(gridStart, index);
    const key = toDateKey(date);
    return {
      key,
      day: date.getUTCDate(),
      isCurrentMonth: date.getUTCMonth() === month,
      isWeekend: date.getUTCDay() === 0 || date.getUTCDay() === 6,
      isToday: key === todayKey,
    };
  });
};

type HolidayEventGroup = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  rows: HolidayItem[];
};

const buildEventGroups = (items: HolidayItem[]): HolidayEventGroup[] => {
  const sorted = [...items].sort((a, b) =>
    parseDateKey(toDateInput(a.date)).getTime() - parseDateKey(toDateInput(b.date)).getTime()
  );

  const groups: HolidayEventGroup[] = [];
  let current: HolidayEventGroup | null = null;

  for (const item of sorted) {
    const dateKey = toDateInput(item.date);
    if (!current) {
      current = {
        id: `${item.name}|${dateKey}`,
        name: item.name,
        startDate: dateKey,
        endDate: dateKey,
        createdAt: item.createdAt,
        rows: [item],
      };
      continue;
    }

    const previousDate = parseDateKey(current.endDate);
    const nextDate = addDaysUtc(previousDate, 1);
    const isContiguous = toDateKey(nextDate) === dateKey;
    const sameName = current.name === item.name;

    if (sameName && isContiguous) {
      current.endDate = dateKey;
      current.rows.push(item);
      continue;
    }

    groups.push({
      ...current,
      id: `${current.name}|${current.startDate}|${current.endDate}|${current.rows
        .map((row) => row.id)
        .join(",")}`,
    });
    current = {
      id: `${item.name}|${dateKey}`,
      name: item.name,
      startDate: dateKey,
      endDate: dateKey,
      createdAt: item.createdAt,
      rows: [item],
    };
  }

  if (current) {
    groups.push({
      ...current,
      id: `${current.name}|${current.startDate}|${current.endDate}|${current.rows
        .map((row) => row.id)
        .join(",")}`,
    });
  }

  return groups;
};

export default function HolidaysPage() {
  const [items, setItems] = useState<HolidayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newName, setNewName] = useState("");
  const todayUtc = new Date();
  const [selectionStart, setSelectionStart] = useState<string>(toDateKey(todayUtc));
  const [selectionEnd, setSelectionEnd] = useState<string>(toDateKey(todayUtc));

  const [calendarMonth, setCalendarMonth] = useState(
    new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), 1))
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragAnchor, setDragAnchor] = useState<string | null>(null);

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetchHolidays();
      setItems(data.items ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load holidays");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const stopDrag = () => setIsDragging(false);
    window.addEventListener("mouseup", stopDrag);
    return () => window.removeEventListener("mouseup", stopDrag);
  }, [isDragging]);

  const totalByYear = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const year = new Date(item.date).getUTCFullYear().toString();
      map.set(year, (map.get(year) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [items]);

  const existingDateKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of items) {
      keys.add(toDateInput(item.date));
    }
    return keys;
  }, [items]);

  const eventGroups = useMemo(() => buildEventGroups(items), [items]);

  const nextHoliday = useMemo(() => {
    const today = toDateKey(new Date());
    return eventGroups
      .filter((g) => compareDateKeys(g.endDate, today) >= 0)
      .sort((a, b) => compareDateKeys(a.startDate, b.startDate))[0] ?? null;
  }, [eventGroups]);

  const normalizedRange = useMemo(() => {
    if (compareDateKeys(selectionStart, selectionEnd) <= 0) {
      return { start: selectionStart, end: selectionEnd };
    }
    return { start: selectionEnd, end: selectionStart };
  }, [selectionStart, selectionEnd]);

  const selectedDateKeys = useMemo(() => {
    const keys: string[] = [];
    let cursor = parseDateKey(normalizedRange.start);
    const end = parseDateKey(normalizedRange.end).getTime();
    while (cursor.getTime() <= end) {
      keys.push(toDateKey(cursor));
      cursor = addDaysUtc(cursor, 1);
    }
    return keys;
  }, [normalizedRange]);

  const selectedCount = selectedDateKeys.length;
  const selectedExistingCount = selectedDateKeys.filter((key) =>
    existingDateKeys.has(key)
  ).length;

  const monthLabel = calendarMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const calendarCells = useMemo(() => buildCalendarCells(calendarMonth), [calendarMonth]);

  const shiftMonth = (delta: number) => {
    setCalendarMonth(
      (prev) => new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + delta, 1))
    );
  };

  const handleStartDrag = (dateKey: string) => {
    setIsDragging(true);
    setDragAnchor(dateKey);
    setSelectionStart(dateKey);
    setSelectionEnd(dateKey);
  };

  const handleDragOver = (dateKey: string) => {
    if (!isDragging || !dragAnchor) return;
    setSelectionStart(dragAnchor);
    setSelectionEnd(dateKey);
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      let created = 0;
      let conflicts = 0;
      for (const date of selectedDateKeys) {
        try {
          await createHoliday({ date, name: newName });
          created += 1;
        } catch (err: any) {
          const status = err?.response?.status;
          if (status === 409) {
            conflicts += 1;
            continue;
          }
          throw err;
        }
      }

      if (created === 0 && conflicts > 0) {
        setNotice("No new holidays created. All selected dates already exist.");
      } else if (conflicts > 0) {
        setNotice(`Created ${created} day(s). Skipped ${conflicts} existing date(s).`);
      } else {
        setNotice(`Created ${created} day(s).`);
      }

      setNewName("");
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to create holiday");
    } finally {
      setSaving(false);
    }
  };

  const startEditEvent = (group: HolidayEventGroup) => {
    setEditingEventId(group.id);
    setEditingName(group.name);
  };

  const cancelEditEvent = () => {
    setEditingEventId(null);
    setEditingName("");
  };

  const handleUpdateEventName = async (group: HolidayEventGroup) => {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      for (const row of group.rows) {
        await updateHoliday(row.id, { name: editingName });
      }
      cancelEditEvent();
      await load();
      setNotice(`Updated event name for ${group.rows.length} day(s).`);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to update event");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (group: HolidayEventGroup) => {
    const confirmed = window.confirm(
      `Delete this event from ${group.startDate} to ${group.endDate}?`
    );
    if (!confirmed) return;

    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      for (const row of group.rows) {
        await deleteHoliday(row.id);
      }
      await load();
      setNotice(`Deleted ${group.rows.length} day(s).`);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to delete event");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard-content queue-page-content">
      <header className="queue-page-header">
        <h1>Holiday Calendar</h1>
        <p>Manage non-working days that affect SLA calculations. Drag on the calendar to select a date range.</p>
      </header>

      {/* Notices */}
      {error && (
        <div className="hol-toast hol-toast-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          <span>{error}</span>
          <button type="button" className="hol-toast-close" onClick={() => setError(null)} aria-label="Dismiss">&times;</button>
        </div>
      )}
      {notice && (
        <div className="hol-toast hol-toast-success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>
          <span>{notice}</span>
          <button type="button" className="hol-toast-close" onClick={() => setNotice(null)} aria-label="Dismiss">&times;</button>
        </div>
      )}

      {/* Calendar + Form side by side */}
      <div className="hol-layout">
        {/* Calendar Panel */}
        <section className="panel hol-calendar-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Select Dates</h2>
              <p className="panel-subtitle">Click a date or drag across multiple days</p>
            </div>
          </div>
          <div className="panel-body">
            <div className="hol-cal-nav">
              <button type="button" className="hol-nav-btn" onClick={() => shiftMonth(-1)} disabled={saving} aria-label="Previous month">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="hol-cal-month">{monthLabel}</span>
              <button type="button" className="hol-nav-btn" onClick={() => shiftMonth(1)} disabled={saving} aria-label="Next month">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="9 6 15 12 9 18"/></svg>
              </button>
            </div>

            <div className="hol-cal-grid" role="grid" aria-label="Holiday calendar">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="hol-cal-weekday">{label}</div>
              ))}
              {calendarCells.map((cell) => {
                const inSelection =
                  compareDateKeys(cell.key, normalizedRange.start) >= 0 &&
                  compareDateKeys(cell.key, normalizedRange.end) <= 0;
                const hasHoliday = existingDateKeys.has(cell.key);
                const holidayName = hasHoliday
                  ? items.find((i) => toDateInput(i.date) === cell.key)?.name
                  : undefined;
                return (
                  <button
                    key={cell.key}
                    type="button"
                    className={[
                      "hol-day",
                      cell.isCurrentMonth ? "" : "hol-day-outside",
                      cell.isWeekend ? "hol-day-weekend" : "",
                      cell.isToday ? "hol-day-today" : "",
                      inSelection ? "hol-day-selected" : "",
                      hasHoliday ? "hol-day-holiday" : "",
                    ].filter(Boolean).join(" ")}
                    onMouseDown={(e) => { e.preventDefault(); handleStartDrag(cell.key); }}
                    onMouseEnter={() => handleDragOver(cell.key)}
                    onMouseUp={() => setIsDragging(false)}
                    disabled={saving}
                    aria-label={`${cell.key}${hasHoliday ? ` — ${holidayName}` : ""}`}
                    title={hasHoliday ? holidayName : undefined}
                  >
                    <span className="hol-day-num">{cell.day}</span>
                    {hasHoliday && <span className="hol-day-dot" />}
                  </button>
                );
              })}
            </div>

            <div className="hol-cal-legend">
              <span className="hol-legend-item"><span className="hol-legend-dot hol-legend-selected" /> Selected</span>
              <span className="hol-legend-item"><span className="hol-legend-dot hol-legend-holiday" /> Holiday</span>
              <span className="hol-legend-item"><span className="hol-legend-dot hol-legend-today" /> Today</span>
            </div>
          </div>
        </section>

        {/* Create Event Form */}
        <section className="panel hol-form-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Create Event</h2>
              <p className="panel-subtitle">Define a holiday or non-working period</p>
            </div>
          </div>
          <div className="panel-body">
            <form className="hol-form" onSubmit={(e) => { void handleCreate(e); }}>
              <div className="hol-form-group">
                <label className="hol-label" htmlFor="hol-name">Event Name</label>
                <input
                  id="hol-name"
                  type="text"
                  className="hol-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Christmas Day, Holy Week"
                  required
                  disabled={saving}
                />
              </div>
              <div className="hol-form-dates">
                <div className="hol-form-group">
                  <label className="hol-label" htmlFor="hol-start">Start Date</label>
                  <input
                    id="hol-start"
                    type="date"
                    className="hol-input"
                    value={normalizedRange.start}
                    onChange={(e) => setSelectionStart(e.target.value)}
                    required
                    disabled={saving}
                  />
                </div>
                <div className="hol-form-group">
                  <label className="hol-label" htmlFor="hol-end">End Date</label>
                  <input
                    id="hol-end"
                    type="date"
                    className="hol-input"
                    value={normalizedRange.end}
                    onChange={(e) => setSelectionEnd(e.target.value)}
                    required
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="hol-selection-summary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span>
                  {selectedCount} day{selectedCount !== 1 ? "s" : ""} selected
                  {selectedExistingCount > 0 && (
                    <span className="hol-existing-warn"> ({selectedExistingCount} already exist)</span>
                  )}
                </span>
              </div>

              <button
                type="submit"
                className="primary-btn hol-submit-btn"
                disabled={saving || !newName.trim() || selectedCount < 1}
              >
                {saving ? (
                  <>
                    <span className="hol-spinner" />
                    Saving...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Create Holiday
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </div>

      {/* Next Holiday Banner */}
      {nextHoliday && (
        <div className="hol-next-holiday">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <div className="hol-next-holiday-info">
            <span className="hol-next-holiday-label">Next Holiday</span>
            <span className="hol-next-holiday-name">{nextHoliday.name}</span>
            <span className="hol-next-holiday-date">
              {nextHoliday.startDate === nextHoliday.endDate
                ? formatDisplayDate(nextHoliday.startDate)
                : `${formatDisplayDate(nextHoliday.startDate)} — ${formatDisplayDate(nextHoliday.endDate)}`}
              {" · "}{nextHoliday.rows.length} day{nextHoliday.rows.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

      {/* Event List */}
      <section className="panel hol-events-panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Holidays</h2>
            <p className="panel-subtitle">{eventGroups.length} event{eventGroups.length !== 1 ? "s" : ""} across {totalByYear.length} year{totalByYear.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="hol-year-chips">
            {totalByYear.map(([year, count]) => (
              <span className="hol-year-chip" key={year}>{year} <strong>{count}</strong></span>
            ))}
          </div>
        </div>
        <div className="panel-body no-padding">
          {loading ? (
            <div className="hol-empty-state">Loading holidays...</div>
          ) : eventGroups.length === 0 ? (
            <div className="hol-empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <p>No holidays configured yet</p>
              <span>Use the calendar above to select dates and create events</span>
            </div>
          ) : (
            <table className="data-table hol-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Date Range</th>
                  <th>Duration</th>
                  <th style={{ width: 120 }}></th>
                </tr>
              </thead>
              <tbody>
                {eventGroups.map((group) => {
                  const isEditing = editingEventId === group.id;
                  const dayCount = group.rows.length;
                  const isSingleDay = group.startDate === group.endDate;
                  return (
                    <tr key={group.id} className={isEditing ? "hol-row-editing" : ""}>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            className="hol-inline-input"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            disabled={saving}
                            autoFocus
                          />
                        ) : (
                          <div className="hol-event-name">
                            <span className="hol-event-dot" />
                            {group.name}
                          </div>
                        )}
                      </td>
                      <td className="hol-date-cell">
                        {isSingleDay
                          ? formatDisplayDate(group.startDate)
                          : `${formatDisplayDate(group.startDate)} — ${formatDisplayDate(group.endDate)}`}
                      </td>
                      <td>
                        <span className="hol-duration-badge">
                          {dayCount} day{dayCount !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td>
                        <div className="hol-row-actions">
                          {isEditing ? (
                            <>
                              <button type="button" className="ghost-btn" disabled={saving || !editingName.trim()} onClick={() => { void handleUpdateEventName(group); }}>Save</button>
                              <button type="button" className="ghost-btn" disabled={saving} onClick={cancelEditEvent}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button type="button" className="ghost-btn" disabled={saving} onClick={() => startEditEvent(group)} title="Edit name">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button type="button" className="ghost-btn hol-delete-btn" disabled={saving} onClick={() => { void handleDeleteEvent(group); }} title="Delete">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
