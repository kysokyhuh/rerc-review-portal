import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import ExemptedTable from "@/components/exempted/ExemptedTable";
import { BRAND } from "@/config/branding";
import { fetchColleges, fetchExemptedQueue, issueExemption } from "@/services/api";
import type { ExemptedQueueItem } from "@/types";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const isoDateToday = () => new Date().toISOString().slice(0, 10);

export default function ExemptedPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<ExemptedQueueItem | null>(null);
  const [resultsNotifiedDate, setResultsNotifiedDate] = useState<string>(isoDateToday());
  const [notifyError, setNotifyError] = useState<string | null>(null);

  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSizeRaw = parsePositiveInt(searchParams.get("pageSize"), 20);
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeRaw as any) ? pageSizeRaw : 20;
  const q = searchParams.get("q") ?? "";
  const college = searchParams.get("college") ?? "";
  const committee = searchParams.get("committee") ?? BRAND.defaultCommitteeCode;

  useEffect(() => {
    document.title = "URERB Portal — Exempted Protocols";
  }, []);

  const collegesQuery = useQuery({
    queryKey: ["dashboardColleges", committee],
    queryFn: () => fetchColleges(committee),
  });

  const exemptedQuery = useQuery({
    queryKey: ["exemptedQueue", page, pageSize, q, college, committee],
    queryFn: () =>
      fetchExemptedQueue({
        page,
        pageSize,
        q: q || undefined,
        college: college || undefined,
        committee,
    }),
  });

  const data = exemptedQuery.data;
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== safePage) {
      const next = new URLSearchParams(searchParams);
      next.set("page", String(safePage));
      setSearchParams(next, { replace: true });
    }
  }, [page, safePage, searchParams, setSearchParams]);

  const setParam = (key: string, value: string | null, resetPage = false) => {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, value);
    if (resetPage) next.set("page", "1");
    setSearchParams(next, { replace: true });
  };

  const handleNotifyAndClose = (item: ExemptedQueueItem) => {
    setSelectedItem(item);
    setResultsNotifiedDate(isoDateToday());
    setNotifyError(null);
  };

  const handleConfirmNotify = async () => {
    if (!selectedItem) return;
    const normalized = resultsNotifiedDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      setNotifyError("Please enter a valid date in YYYY-MM-DD format.");
      return;
    }

    const parsed = new Date(`${normalized}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      setNotifyError("Invalid date value.");
      return;
    }

    setNotifyError(null);
    try {
      setBusyId(selectedItem.id);
      await issueExemption(selectedItem.id, { resultsNotifiedAt: parsed.toISOString() });
      await queryClient.invalidateQueries({ queryKey: ["exemptedQueue"] });
      setSelectedItem(null);
    } catch (error: any) {
      setNotifyError(error?.response?.data?.message || error?.message || "Failed to close submission");
    } finally {
      setBusyId(null);
    }
  };

  const pageInfo = useMemo(() => {
    if (!totalCount) return "No records";
    const start = (safePage - 1) * pageSize + 1;
    const end = Math.min(safePage * pageSize, totalCount);
    return `Showing ${start}-${end} of ${totalCount}`;
  }, [pageSize, safePage, totalCount]);

  const queueErrorMessage = useMemo(() => {
    if (!exemptedQuery.error) return null;
    const err = exemptedQuery.error as any;
    return err?.response?.data?.message || err?.message || "Unable to fetch queue";
  }, [exemptedQuery.error]);

  return (
    <div className="dashboard-content queue-page-content">
      <header className="queue-page-header">
        <h1>Exempted Protocols</h1>
        <p>Protocols classified as Exempt awaiting issuance/notification.</p>
      </header>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Awaiting Closeout</h2>
            <p className="panel-subtitle">{totalCount} total exempted protocols awaiting close.</p>
          </div>
        </div>
      </section>

      <section className="panel queue-focused-table">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Exempted Queue</h2>
            <p className="panel-subtitle">Search and close exempted submissions after notification.</p>
          </div>
        </div>

        <div className="panel-body">
          <div className="filter-row exempted-filter-row" style={{ marginBottom: 12 }}>
            <div className="filter-inline-search exempted-filter-search">
              <svg className="filter-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                className="filter-search-input"
                value={q}
                onChange={(e) => setParam("q", e.target.value || null, true)}
                placeholder="Search by code, title, or proponent"
              />
            </div>

            <label className="filter-label">
              College
            </label>
            <select
              className="filter-select"
              value={college}
              onChange={(e) => setParam("college", e.target.value || null, true)}
            >
              <option value="">All colleges</option>
              {(collegesQuery.data ?? []).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <label className="filter-label">
              Rows
            </label>
            <select
              className="filter-select"
              value={pageSize}
              onChange={(e) => setParam("pageSize", e.target.value, true)}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <ExemptedTable
            items={data?.items ?? []}
            loading={exemptedQuery.isLoading}
            error={queueErrorMessage}
            busyId={busyId}
            onNotifyAndClose={handleNotifyAndClose}
          />

          <div className="table-pagination" style={{ marginTop: 12 }}>
            <div className="pagination-info">{pageInfo}</div>
            <div className="pagination-controls">
              <button
                type="button"
                className="pagination-btn"
                disabled={safePage <= 1}
                onClick={() => setParam("page", String(safePage - 1))}
              >
                Previous
              </button>
              <span className="pagination-current">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                className="pagination-btn"
                disabled={safePage >= totalPages}
                onClick={() => setParam("page", String(safePage + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>

      {selectedItem ? (
        <div
          className="quick-view-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (busyId) return;
            setSelectedItem(null);
          }}
        >
          <div className="quick-view-modal exempted-notify-modal" onClick={(e) => e.stopPropagation()}>
            <div className="quick-view-header">
              <div className="quick-view-header-left">
                <span className="quick-view-code">{selectedItem.projectCode}</span>
                <h3>Notify and Close Exempted Protocol</h3>
                <div className="quick-view-header-meta">{selectedItem.title}</div>
              </div>
            </div>
            <div className="quick-view-body">
              <div className="exempted-notify-grid">
                <div>
                  <div className="qv-detail-label">Leader</div>
                  <div className="qv-detail-value">{selectedItem.proponentOrLeader}</div>
                </div>
                <div>
                  <div className="qv-detail-label">College</div>
                  <div className="qv-detail-value">{selectedItem.college}</div>
                </div>
              </div>

              <label className="exempted-notify-label" htmlFor="results-notified-date">
                Results Notified Date
              </label>
              <input
                id="results-notified-date"
                type="date"
                className="exempted-notify-input"
                value={resultsNotifiedDate}
                onChange={(e) => setResultsNotifiedDate(e.target.value)}
                disabled={Boolean(busyId)}
              />
              {notifyError ? <p className="exempted-notify-error">{notifyError}</p> : null}
            </div>
            <div className="quick-view-footer">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setSelectedItem(null)}
                disabled={Boolean(busyId)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  void handleConfirmNotify();
                }}
                disabled={Boolean(busyId)}
              >
                {busyId ? "Closing..." : "Notify & Close"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
