import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  createHoliday,
  deleteHoliday,
  fetchHolidays,
  updateHoliday,
  fetchAcademicTerms,
  createAcademicTerm,
  updateAcademicTerm,
  deleteAcademicTerm,
} from "@/services/api";
import type { AcademicTerm, HolidayItem } from "@/types";
import { getErrorMessage, getErrorStatus } from "@/utils";

// ─── Date Utilities ──────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toDateKey = (value: Date): string => {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const parseDateKey = (value: string): Date =>
  new Date(`${value}T00:00:00.000Z`);

const addDaysUtc = (value: Date, days: number): Date => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const compareDateKeys = (a: string, b: string) =>
  parseDateKey(a).getTime() - parseDateKey(b).getTime();

const toDateInput = (value: string) => value.slice(0, 10);

const formatDisplayDate = (dateStr: string) =>
  parseDateKey(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

const buildCalendarCells = (monthAnchor: Date) => {
  const year = monthAnchor.getUTCFullYear();
  const month = monthAnchor.getUTCMonth();
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const gridStart = addDaysUtc(firstOfMonth, -firstOfMonth.getUTCDay());
  const lastOfMonth = new Date(Date.UTC(year, month + 1, 0));
  const gridEnd = addDaysUtc(lastOfMonth, 6 - lastOfMonth.getUTCDay());
  const totalDays =
    Math.round((gridEnd.getTime() - gridStart.getTime()) / 86400000) + 1;
  const todayKey = toDateKey(new Date());

  return Array.from({ length: totalDays }, (_, i) => {
    const date = addDaysUtc(gridStart, i);
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

// ─── Holiday Event Groups ─────────────────────────────────────────────────────

type HolidayEventGroup = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  rows: HolidayItem[];
};

const buildEventGroups = (items: HolidayItem[]): HolidayEventGroup[] => {
  const sorted = [...items].sort(
    (a, b) =>
      parseDateKey(toDateInput(a.date)).getTime() -
      parseDateKey(toDateInput(b.date)).getTime()
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

    const nextDate = addDaysUtc(parseDateKey(current.endDate), 1);
    const isContiguous = toDateKey(nextDate) === dateKey;
    const sameName = current.name === item.name;

    if (sameName && isContiguous) {
      current.endDate = dateKey;
      current.rows.push(item);
      continue;
    }

    groups.push({
      ...current,
      id: `${current.name}|${current.startDate}|${current.endDate}|${current.rows.map((r) => r.id).join(",")}`,
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
      id: `${current.name}|${current.startDate}|${current.endDate}|${current.rows.map((r) => r.id).join(",")}`,
    });
  }

  return groups;
};

// ─── Academic Year helpers ────────────────────────────────────────────────────

const currentAcademicYear = (): string => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-indexed; academic year typically starts Aug/Sep
  const startYear = m >= 8 ? y : y - 1; // Sep onwards = new AY
  return `${startYear}-${startYear + 1}`;
};

const generateYearOptions = (terms: AcademicTerm[]): string[] => {
  const fromTerms = new Set(terms.map((t) => t.academicYear));
  const baseYear = new Date().getUTCFullYear();
  // Keep a wider manual entry window so older academic years can be added
  // even before any term rows exist for them in the database.
  for (let y = baseYear - 5; y <= baseYear + 3; y++) {
    fromTerms.add(`${y}-${y + 1}`);
  }
  return Array.from(fromTerms).sort((a, b) => b.localeCompare(a));
};

// ─── Component ───────────────────────────────────────────────────────────────

type FormMode = "holiday" | "term";

export default function CalendarPage() {
  // ── Data state ──
  const [items, setItems] = useState<HolidayItem[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Calendar navigation ──
  const todayUtc = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(todayUtc), [todayUtc]);
  const [calendarMonth, setCalendarMonth] = useState(
    new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), 1))
  );

  // ── Selection (drag-to-select for holidays) ──
  const [selectionStart, setSelectionStart] = useState<string>(todayKey);
  const [selectionEnd, setSelectionEnd] = useState<string>(todayKey);
  const [isDragging, setIsDragging] = useState(false);
  const [dragAnchor, setDragAnchor] = useState<string | null>(null);

  // ── Panel / form state ──
  const [panelOpen, setPanelOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("holiday");

  // Holiday form fields
  const [formHolName, setFormHolName] = useState("");
  const [editingHolGroup, setEditingHolGroup] = useState<HolidayEventGroup | null>(null);
  const [editingHolName, setEditingHolName] = useState("");

  // Term form fields
  const [formTermAY, setFormTermAY] = useState(currentAcademicYear);
  const [formTermNum, setFormTermNum] = useState<number>(1);
  const [formTermStart, setFormTermStart] = useState("");
  const [formTermEnd, setFormTermEnd] = useState("");
  const [editingTerm, setEditingTerm] = useState<AcademicTerm | null>(null);

  // ── Filters ──
  const [filterAY, setFilterAY] = useState<string>(currentAcademicYear);
  const [filterTerm, setFilterTerm] = useState<string>("ALL");

  // ─────────────────────────────────────────────────────────────────────────
  // Data loading
  // ─────────────────────────────────────────────────────────────────────────

  const load = async () => {
    try {
      setLoading(true);
      const [holData, termData] = await Promise.all([
        fetchHolidays(),
        fetchAcademicTerms(),
      ]);
      setItems(holData.items ?? []);
      setTerms(termData.items ?? []);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load calendar data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const stop = () => setIsDragging(false);
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, [isDragging]);

  // ─────────────────────────────────────────────────────────────────────────
  // Derived state
  // ─────────────────────────────────────────────────────────────────────────

  const yearOptions = useMemo(() => generateYearOptions(terms), [terms]);

  const existingDateKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of items) keys.add(toDateInput(item.date));
    return keys;
  }, [items]);

  const termStartMap = useMemo(() => {
    const map = new Map<string, AcademicTerm>();
    for (const t of terms) map.set(t.startDate, t);
    return map;
  }, [terms]);

  const termEndMap = useMemo(() => {
    const map = new Map<string, AcademicTerm>();
    for (const t of terms) map.set(t.endDate, t);
    return map;
  }, [terms]);

  const eventGroups = useMemo(() => buildEventGroups(items), [items]);

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
  const selectedExistingCount = selectedDateKeys.filter((k) =>
    existingDateKeys.has(k)
  ).length;

  const selectionRangeLabel =
    normalizedRange.start === normalizedRange.end
      ? formatDisplayDate(normalizedRange.start)
      : `${formatDisplayDate(normalizedRange.start)} — ${formatDisplayDate(normalizedRange.end)}`;

  const monthLabel = calendarMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const calendarCells = useMemo(
    () => buildCalendarCells(calendarMonth),
    [calendarMonth]
  );

  // Summary card values
  const currentTermRecord = useMemo(() => {
    return terms.find(
      (t) =>
        t.startDate <= todayKey &&
        t.endDate >= todayKey
    ) ?? null;
  }, [terms, todayKey]);

  const nextMarkedDate = useMemo(() => {
    const upcoming: { date: string; label: string }[] = [];
    for (const g of eventGroups) {
      if (compareDateKeys(g.startDate, todayKey) >= 0) {
        upcoming.push({ date: g.startDate, label: g.name });
      }
    }
    for (const t of terms) {
      if (compareDateKeys(t.startDate, todayKey) >= 0) {
        upcoming.push({ date: t.startDate, label: `Term ${t.term} Start` });
      }
      if (compareDateKeys(t.endDate, todayKey) >= 0) {
        upcoming.push({ date: t.endDate, label: `Term ${t.term} End` });
      }
    }
    return upcoming.sort((a, b) => compareDateKeys(a.date, b.date))[0] ?? null;
  }, [eventGroups, terms, todayKey]);

  const totalHolidayDays = items.length;
  const totalTerms = terms.length;

  // Filtered term markers for the entries table
  const filteredTerms = useMemo(() => {
    return terms.filter((t) => {
      if (filterAY && t.academicYear !== filterAY) return false;
      if (filterTerm !== "ALL" && t.term !== Number(filterTerm)) return false;
      return true;
    });
  }, [terms, filterAY, filterTerm]);

  // ─────────────────────────────────────────────────────────────────────────
  // Calendar interaction
  // ─────────────────────────────────────────────────────────────────────────

  const shiftMonth = (delta: number) => {
    setCalendarMonth(
      (prev) =>
        new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + delta, 1))
    );
  };

  const handleStartDrag = (dateKey: string) => {
    setIsDragging(true);
    setDragAnchor(dateKey);
    setSelectionStart(dateKey);
    setSelectionEnd(dateKey);
    if (!panelOpen) {
      setPanelOpen(true);
      setFormMode("holiday");
      setFormHolName("");
    }
  };

  const handleDragOver = (dateKey: string) => {
    if (!isDragging || !dragAnchor) return;
    setSelectionStart(dragAnchor);
    setSelectionEnd(dateKey);
  };

  // Sync calendar selection → form start date when in holiday mode
  useEffect(() => {
    // Only auto-sync when panel is open in holiday create mode (no edit active)
    if (panelOpen && formMode === "holiday" && editingHolGroup === null) {
      // Don't override the dates — the form start/end follows the selection directly
    }
  }, [normalizedRange, panelOpen, formMode, editingHolGroup]);

  // ─────────────────────────────────────────────────────────────────────────
  // Holiday CRUD
  // ─────────────────────────────────────────────────────────────────────────

  const handleCreateHoliday = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      let created = 0;
      let conflicts = 0;
      for (const date of selectedDateKeys) {
        try {
          await createHoliday({ date, name: formHolName });
          created++;
        } catch (err) {
          if (getErrorStatus(err) === 409) {
            conflicts++;
            continue;
          }
          throw err;
        }
      }

      if (created === 0 && conflicts > 0) {
        setNotice("No new holidays created — all selected dates already exist.");
      } else if (conflicts > 0) {
        setNotice(`Created ${created} day(s). Skipped ${conflicts} existing date(s).`);
      } else {
        setNotice(`Created ${created} day(s).`);
      }

      setFormHolName("");
      setPanelOpen(false);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create holiday"));
    } finally {
      setSaving(false);
    }
  };

  const startEditHoliday = (group: HolidayEventGroup) => {
    setEditingHolGroup(group);
    setEditingHolName(group.name);
    setFormMode("holiday");
    setPanelOpen(true);
  };

  const cancelEditHoliday = () => {
    setEditingHolGroup(null);
    setEditingHolName("");
  };

  const handleUpdateHolidayName = async (group: HolidayEventGroup) => {
    try {
      setSaving(true);
      setError(null);
      for (const row of group.rows) {
        await updateHoliday(row.id, { name: editingHolName });
      }
      cancelEditHoliday();
      setPanelOpen(false);
      setNotice(`Updated event name for ${group.rows.length} day(s).`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update holiday"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHoliday = async (group: HolidayEventGroup) => {
    const confirmed = window.confirm(
      `Delete "${group.name}" (${group.startDate}${group.startDate !== group.endDate ? ` → ${group.endDate}` : ""})?`
    );
    if (!confirmed) return;
    try {
      setSaving(true);
      setError(null);
      for (const row of group.rows) {
        await deleteHoliday(row.id);
      }
      setNotice(`Deleted ${group.rows.length} day(s).`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete holiday"));
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Academic Term CRUD
  // ─────────────────────────────────────────────────────────────────────────

  const resetTermForm = () => {
    setFormTermAY(currentAcademicYear());
    setFormTermNum(1);
    setFormTermStart("");
    setFormTermEnd("");
    setEditingTerm(null);
  };

  const handleCreateOrUpdateTerm = async (e: FormEvent) => {
    e.preventDefault();
    if (!formTermStart || !formTermEnd) {
      setError("Start date and end date are required for term dates.");
      return;
    }
    if (formTermEnd < formTermStart) {
      setError("End date cannot be before start date.");
      return;
    }
    try {
      setSaving(true);
      setError(null);

      if (editingTerm) {
        await updateAcademicTerm(editingTerm.id, {
          startDate: formTermStart,
          endDate: formTermEnd,
        });
        setNotice(`Updated Term ${editingTerm.term}, ${editingTerm.academicYear}.`);
      } else {
        await createAcademicTerm({
          academicYear: formTermAY,
          term: formTermNum,
          startDate: formTermStart,
          endDate: formTermEnd,
        });
        setNotice(
          `Saved Term ${formTermNum}, ${formTermAY}: ${formatDisplayDate(formTermStart)} – ${formatDisplayDate(formTermEnd)}.`
        );
      }

      resetTermForm();
      setPanelOpen(false);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save term dates"));
    } finally {
      setSaving(false);
    }
  };

  const startEditTerm = (term: AcademicTerm) => {
    setEditingTerm(term);
    setFormTermAY(term.academicYear);
    setFormTermNum(term.term);
    setFormTermStart(term.startDate);
    setFormTermEnd(term.endDate);
    setFormMode("term");
    setPanelOpen(true);
  };

  const handleDeleteTerm = async (term: AcademicTerm) => {
    const confirmed = window.confirm(
      `Delete Term ${term.term} (${term.academicYear})?`
    );
    if (!confirmed) return;
    try {
      setSaving(true);
      setError(null);
      await deleteAcademicTerm(term.id);
      setNotice(`Deleted Term ${term.term}, ${term.academicYear}.`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete academic term"));
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Panel helpers
  // ─────────────────────────────────────────────────────────────────────────

  const openNewHolidayPanel = () => {
    cancelEditHoliday();
    setFormHolName("");
    setFormMode("holiday");
    setPanelOpen(true);
  };

  const openNewTermPanel = () => {
    resetTermForm();
    setFormMode("term");
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    cancelEditHoliday();
    resetTermForm();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-content queue-page-content portal-page portal-page--dense cal-page">

      {/* ── Page Header ── */}
      <header className="cal-page-header">
        <div className="cal-header-copy">
          <span className="queue-page-eyebrow">Calendar administration</span>
          <h1>Calendar</h1>
          <p>
            Manage holidays, non-working days, and academic term dates used
            across SLA calculations.
          </p>
        </div>
        <div className="cal-header-controls">
          <select
            className="cal-control-select"
            value={filterAY}
            onChange={(e) => setFilterAY(e.target.value)}
            aria-label="Academic year"
          >
            <option value="">All years</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                AY {y}
              </option>
            ))}
          </select>
          <select
            className="cal-control-select"
            value={filterTerm}
            onChange={(e) => setFilterTerm(e.target.value)}
            aria-label="Term"
          >
            <option value="ALL">All terms</option>
            <option value="1">Term 1</option>
            <option value="2">Term 2</option>
            <option value="3">Term 3</option>
          </select>
          <div className="cal-header-add-group">
            <button
              type="button"
              className="primary-btn cal-add-btn"
              onClick={openNewHolidayPanel}
              disabled={saving}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add holiday
            </button>
            <button
              type="button"
              className="ghost-btn cal-add-btn"
              onClick={openNewTermPanel}
              disabled={saving}
            >
              Add term dates
            </button>
          </div>
        </div>
      </header>

      {/* ── Toasts ── */}
      {error && (
        <div className="hol-toast hol-toast-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <span>{error}</span>
          <button type="button" className="hol-toast-close" onClick={() => setError(null)} aria-label="Dismiss">&times;</button>
        </div>
      )}
      {notice && (
        <div className="hol-toast hol-toast-success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{notice}</span>
          <button type="button" className="hol-toast-close" onClick={() => setNotice(null)} aria-label="Dismiss">&times;</button>
        </div>
      )}

      {/* ── Summary Bar ── */}
      <div className="cal-summary-bar">
        <div className="cal-summary-card">
          <span className="cal-summary-label">Academic Year</span>
          <strong className="cal-summary-value">
            {currentTermRecord ? currentTermRecord.academicYear : filterAY || "—"}
          </strong>
          <span className="cal-summary-sub">
            {currentTermRecord ? "Current active year" : "No term in progress"}
          </span>
        </div>
        <div className="cal-summary-card">
          <span className="cal-summary-label">Current Term</span>
          <strong className="cal-summary-value">
            {currentTermRecord ? `Term ${currentTermRecord.term}` : "—"}
          </strong>
          <span className="cal-summary-sub">
            {currentTermRecord
              ? `${formatDisplayDate(currentTermRecord.startDate)} – ${formatDisplayDate(currentTermRecord.endDate)}`
              : "No active term today"}
          </span>
        </div>
        <div className="cal-summary-card">
          <span className="cal-summary-label">Next Marked Date</span>
          <strong className="cal-summary-value cal-summary-value--sm">
            {nextMarkedDate ? formatDisplayDate(nextMarkedDate.date) : "None"}
          </strong>
          <span className="cal-summary-sub">
            {nextMarkedDate ? nextMarkedDate.label : "No upcoming dates configured"}
          </span>
        </div>
        <div className="cal-summary-card">
          <span className="cal-summary-label">Configured Dates</span>
          <strong className="cal-summary-value">{totalHolidayDays + totalTerms * 2}</strong>
          <span className="cal-summary-sub">
            {totalHolidayDays} holiday day{totalHolidayDays !== 1 ? "s" : ""} · {totalTerms} term{totalTerms !== 1 ? "s" : ""} set
          </span>
        </div>
      </div>

      {/* ── Main Grid: Calendar + Panel ── */}
      <div className="cal-main-grid">

        {/* ── Large Calendar ── */}
        <section className="panel cal-calendar-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                {monthLabel}
              </h2>
              <p className="panel-subtitle">
                Click or drag to select dates, then add a calendar entry.
              </p>
            </div>
            <div className="cal-month-nav">
              <button
                type="button"
                className="hol-nav-btn"
                onClick={() => shiftMonth(-1)}
                disabled={saving}
                aria-label="Previous month"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                type="button"
                className="hol-nav-btn"
                onClick={() => shiftMonth(1)}
                disabled={saving}
                aria-label="Next month"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <polyline points="9 6 15 12 9 18" />
                </svg>
              </button>
            </div>
          </div>
          <div className="panel-body">
            {/* Calendar grid */}
            <div className="cal-grid" role="grid" aria-label="Calendar">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="cal-weekday">{label}</div>
              ))}
              {calendarCells.map((cell) => {
                const inSelection =
                  compareDateKeys(cell.key, normalizedRange.start) >= 0 &&
                  compareDateKeys(cell.key, normalizedRange.end) <= 0;
                const hasHoliday = existingDateKeys.has(cell.key);
                const isTermStart = termStartMap.has(cell.key);
                const isTermEnd = termEndMap.has(cell.key);
                const holidayName = hasHoliday
                  ? items.find((i) => toDateInput(i.date) === cell.key)?.name
                  : undefined;
                const termInfo =
                  isTermStart
                    ? termStartMap.get(cell.key)
                    : isTermEnd
                    ? termEndMap.get(cell.key)
                    : undefined;
                const titleParts: string[] = [];
                if (hasHoliday && holidayName) titleParts.push(holidayName);
                if (isTermStart && termInfo)
                  titleParts.push(`Term ${termInfo.term} Start`);
                if (isTermEnd && termInfo)
                  titleParts.push(`Term ${termInfo.term} End`);

                return (
                  <button
                    key={cell.key}
                    type="button"
                    className={[
                      "cal-day",
                      cell.isCurrentMonth ? "" : "cal-day-outside",
                      cell.isWeekend ? "cal-day-weekend" : "",
                      cell.isToday ? "cal-day-today" : "",
                      inSelection ? "cal-day-selected" : "",
                      hasHoliday ? "cal-day-holiday" : "",
                      isTermStart ? "cal-day-term-start" : "",
                      isTermEnd ? "cal-day-term-end" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleStartDrag(cell.key);
                    }}
                    onMouseEnter={() => handleDragOver(cell.key)}
                    onMouseUp={() => setIsDragging(false)}
                    disabled={saving}
                    aria-label={`${cell.key}${titleParts.length > 0 ? ` — ${titleParts.join(", ")}` : ""}`}
                    title={titleParts.length > 0 ? titleParts.join(" · ") : undefined}
                  >
                    <span className="cal-day-num">{cell.day}</span>
                    {hasHoliday && !isTermStart && !isTermEnd && (
                      <span className="cal-day-dot cal-dot-holiday" />
                    )}
                    {isTermStart && <span className="cal-day-dot cal-dot-term-start" />}
                    {isTermEnd && <span className="cal-day-dot cal-dot-term-end" />}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="cal-legend">
              <span className="cal-legend-item">
                <span className="cal-legend-swatch cal-legend-today" />
                Today
              </span>
              <span className="cal-legend-item">
                <span className="cal-legend-swatch cal-legend-selected" />
                Selected
              </span>
              <span className="cal-legend-item">
                <span className="cal-legend-swatch cal-legend-holiday" />
                Holiday
              </span>
              <span className="cal-legend-item">
                <span className="cal-legend-swatch cal-legend-term-start" />
                Start of term
              </span>
              <span className="cal-legend-item">
                <span className="cal-legend-swatch cal-legend-term-end" />
                End of term
              </span>
            </div>
          </div>
        </section>

        {/* ── Entry Panel ── */}
        <aside className="cal-entry-panel">
          {!panelOpen ? (
            /* Idle state */
            <div className="panel cal-panel-idle">
              <div className="panel-body">
                <div className="cal-idle-state">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  <p>Select dates on the calendar to add a holiday entry, or use the buttons below.</p>
                  <div className="cal-idle-actions">
                    <button type="button" className="primary-btn cal-idle-btn" onClick={openNewHolidayPanel}>
                      Add holiday
                    </button>
                    <button type="button" className="ghost-btn cal-idle-btn" onClick={openNewTermPanel}>
                      Add term dates
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Form state */
            <div className="panel cal-panel-form">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    {editingHolGroup
                      ? "Edit holiday"
                      : editingTerm
                      ? "Edit term dates"
                      : formMode === "holiday"
                      ? "Add holiday"
                      : "Add term dates"}
                  </h2>
                  <p className="panel-subtitle">
                    {formMode === "holiday"
                      ? "Set event name and confirm the date range."
                      : "Set start and end dates for the academic term."}
                  </p>
                </div>
                <button
                  type="button"
                  className="cal-panel-close"
                  onClick={closePanel}
                  aria-label="Close panel"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="panel-body">
                {/* Mode tabs (only when creating new, not editing) */}
                {!editingHolGroup && !editingTerm && (
                  <div className="cal-form-tabs">
                    <button
                      type="button"
                      className={`cal-form-tab ${formMode === "holiday" ? "active" : ""}`}
                      onClick={() => setFormMode("holiday")}
                    >
                      Holiday
                    </button>
                    <button
                      type="button"
                      className={`cal-form-tab ${formMode === "term" ? "active" : ""}`}
                      onClick={() => setFormMode("term")}
                    >
                      Term dates
                    </button>
                  </div>
                )}

                {/* ── Holiday form ── */}
                {formMode === "holiday" && (
                  <form
                    className="cal-form"
                    onSubmit={(e) => {
                      if (editingHolGroup) {
                        void handleUpdateHolidayName(editingHolGroup);
                        e.preventDefault();
                      } else {
                        void handleCreateHoliday(e);
                      }
                    }}
                  >
                    {/* Selection preview (only when creating) */}
                    {!editingHolGroup && (
                      <div className="cal-selection-card">
                        <span className="cal-selection-kicker">Selected range</span>
                        <strong>{selectionRangeLabel}</strong>
                        <p>
                          {selectedCount} day{selectedCount !== 1 ? "s" : ""}
                          {selectedExistingCount > 0 && (
                            <span className="cal-existing-warn">
                              {" "}· {selectedExistingCount} already exist
                            </span>
                          )}
                        </p>
                      </div>
                    )}

                    <div className="hol-form-group">
                      <label className="hol-label" htmlFor="cal-hol-name">
                        Event Name
                      </label>
                      <input
                        id="cal-hol-name"
                        type="text"
                        className="hol-input"
                        value={editingHolGroup ? editingHolName : formHolName}
                        onChange={(e) =>
                          editingHolGroup
                            ? setEditingHolName(e.target.value)
                            : setFormHolName(e.target.value)
                        }
                        placeholder="e.g. Christmas Day, Holy Week"
                        required
                        disabled={saving}
                        autoFocus
                      />
                    </div>

                    {!editingHolGroup && (
                      <div className="hol-form-dates">
                        <div className="hol-form-group">
                          <label className="hol-label" htmlFor="cal-hol-start">
                            Start Date
                          </label>
                          <input
                            id="cal-hol-start"
                            type="date"
                            className="hol-input"
                            value={normalizedRange.start}
                            onChange={(e) => setSelectionStart(e.target.value)}
                            required
                            disabled={saving}
                          />
                        </div>
                        <div className="hol-form-group">
                          <label className="hol-label" htmlFor="cal-hol-end">
                            End Date
                          </label>
                          <input
                            id="cal-hol-end"
                            type="date"
                            className="hol-input"
                            value={normalizedRange.end}
                            onChange={(e) => setSelectionEnd(e.target.value)}
                            required
                            disabled={saving}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="primary-btn hol-submit-btn"
                      disabled={
                        saving ||
                        !(editingHolGroup ? editingHolName : formHolName).trim() ||
                        (!editingHolGroup && selectedCount < 1)
                      }
                    >
                      {saving ? (
                        <>
                          <span className="hol-spinner" /> Saving...
                        </>
                      ) : editingHolGroup ? (
                        "Save changes"
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          Save holiday
                        </>
                      )}
                    </button>
                    {editingHolGroup && (
                      <button
                        type="button"
                        className="ghost-btn"
                        style={{ width: "100%", marginTop: 4 }}
                        onClick={cancelEditHoliday}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    )}
                  </form>
                )}

                {/* ── Term form ── */}
                {formMode === "term" && (
                  <form className="cal-form" onSubmit={(e) => { void handleCreateOrUpdateTerm(e); }}>
                    <div className="hol-form-group">
                      <label className="hol-label" htmlFor="cal-term-ay">
                        Academic Year
                      </label>
                      <select
                        id="cal-term-ay"
                        className="hol-input"
                        value={formTermAY}
                        onChange={(e) => setFormTermAY(e.target.value)}
                        disabled={saving || editingTerm !== null}
                        required
                      >
                        {yearOptions.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hol-form-group">
                      <label className="hol-label" htmlFor="cal-term-num">
                        Term
                      </label>
                      <select
                        id="cal-term-num"
                        className="hol-input"
                        value={formTermNum}
                        onChange={(e) => setFormTermNum(Number(e.target.value))}
                        disabled={saving || editingTerm !== null}
                        required
                      >
                        <option value={1}>Term 1</option>
                        <option value={2}>Term 2</option>
                        <option value={3}>Term 3</option>
                      </select>
                    </div>

                    <div className="hol-form-dates">
                      <div className="hol-form-group">
                        <label className="hol-label" htmlFor="cal-term-start">
                          Start Date
                        </label>
                        <input
                          id="cal-term-start"
                          type="date"
                          className="hol-input"
                          value={formTermStart}
                          onChange={(e) => setFormTermStart(e.target.value)}
                          required
                          disabled={saving}
                        />
                      </div>
                      <div className="hol-form-group">
                        <label className="hol-label" htmlFor="cal-term-end">
                          End Date
                        </label>
                        <input
                          id="cal-term-end"
                          type="date"
                          className="hol-input"
                          value={formTermEnd}
                          onChange={(e) => setFormTermEnd(e.target.value)}
                          required
                          disabled={saving}
                        />
                      </div>
                    </div>

                    {editingTerm && (
                      <div className="cal-editing-badge">
                        Editing Term {editingTerm.term}, {editingTerm.academicYear}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="primary-btn hol-submit-btn"
                      disabled={saving || !formTermStart || !formTermEnd}
                    >
                      {saving ? (
                        <>
                          <span className="hol-spinner" /> Saving...
                        </>
                      ) : editingTerm ? (
                        "Save changes"
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          Save term dates
                        </>
                      )}
                    </button>
                    {editingTerm && (
                      <button
                        type="button"
                        className="ghost-btn"
                        style={{ width: "100%", marginTop: 4 }}
                        onClick={() => { resetTermForm(); setPanelOpen(false); }}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    )}
                  </form>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ── Calendar Entries Table ── */}
      <section className="panel cal-entries-panel portal-content">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Calendar Entries</h2>
            <p className="panel-subtitle">
              {eventGroups.length} holiday event{eventGroups.length !== 1 ? "s" : ""} ·{" "}
              {terms.length} academic term{terms.length !== 1 ? "s" : ""} configured
            </p>
          </div>
        </div>

        {loading ? (
          <div className="hol-empty-state">Loading calendar data...</div>
        ) : eventGroups.length === 0 && terms.length === 0 ? (
          <div className="cal-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <p>No calendar entries yet.</p>
            <span>Add holidays or academic term dates to begin configuring the academic calendar.</span>
            <div className="cal-empty-actions">
              <button type="button" className="primary-btn cal-idle-btn" onClick={openNewHolidayPanel}>
                Add holiday
              </button>
              <button type="button" className="ghost-btn cal-idle-btn" onClick={openNewTermPanel}>
                Add term dates
              </button>
            </div>
          </div>
        ) : (
          <div className="panel-body no-padding">
            {/* ── Term Markers group ── */}
            {filteredTerms.length > 0 && (
              <div className="cal-entries-group">
                <div className="cal-entries-group-header">
                  <span className="cal-entries-group-dot cal-dot-term-start" />
                  Term Markers
                  <span className="cal-entries-group-count">{filteredTerms.length}</span>
                </div>
                <table className="data-table cal-entries-table">
                  <thead>
                    <tr>
                      <th>Academic Year</th>
                      <th>Term</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th style={{ width: 100 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTerms
                      .sort((a, b) =>
                        b.academicYear.localeCompare(a.academicYear) || a.term - b.term
                      )
                      .map((term) => (
                        <tr key={term.id}>
                          <td>
                            <span className="cal-ay-badge">{term.academicYear}</span>
                          </td>
                          <td className="cal-term-cell">Term {term.term}</td>
                          <td className="hol-date-cell">
                            <span className="cal-term-start-pill">
                              {formatDisplayDate(term.startDate)}
                            </span>
                          </td>
                          <td className="hol-date-cell">
                            <span className="cal-term-end-pill">
                              {formatDisplayDate(term.endDate)}
                            </span>
                          </td>
                          <td>
                            <div className="hol-row-actions">
                              <button
                                type="button"
                                className="ghost-btn"
                                disabled={saving}
                                onClick={() => startEditTerm(term)}
                                title="Edit dates"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                className="ghost-btn hol-delete-btn"
                                disabled={saving}
                                onClick={() => { void handleDeleteTerm(term); }}
                                title="Delete"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Holidays group ── */}
            {eventGroups.length > 0 && (
              <div className="cal-entries-group">
                <div className="cal-entries-group-header">
                  <span className="cal-entries-group-dot cal-dot-holiday" />
                  Holidays
                  <span className="cal-entries-group-count">{eventGroups.length}</span>
                </div>
                <table className="data-table cal-entries-table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Date Range</th>
                      <th>Duration</th>
                      <th style={{ width: 100 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {eventGroups.map((group) => (
                      <tr key={group.id}>
                        <td>
                          <div className="hol-event-name">
                            <span className="hol-event-dot" />
                            {group.name}
                          </div>
                        </td>
                        <td className="hol-date-cell">
                          {group.startDate === group.endDate
                            ? formatDisplayDate(group.startDate)
                            : `${formatDisplayDate(group.startDate)} — ${formatDisplayDate(group.endDate)}`}
                        </td>
                        <td>
                          <span className="hol-duration-badge">
                            {group.rows.length} day{group.rows.length !== 1 ? "s" : ""}
                          </span>
                        </td>
                        <td>
                          <div className="hol-row-actions">
                            <button
                              type="button"
                              className="ghost-btn"
                              disabled={saving}
                              onClick={() => startEditHoliday(group)}
                              title="Edit name"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="ghost-btn hol-delete-btn"
                              disabled={saving}
                              onClick={() => { void handleDeleteHoliday(group); }}
                              title="Delete"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
