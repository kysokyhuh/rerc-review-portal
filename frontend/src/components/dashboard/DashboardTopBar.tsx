import React, { type RefObject } from "react";
import { formatTimeAgo } from "./utils";
import type { ProjectSearchResult } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { getPrimaryRoleLabel } from "@/utils/roleUtils";

interface DashboardTopBarProps {
  greeting: string;
  lastUpdated: Date | null;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  searchResults: ProjectSearchResult[];
  searchOpen: boolean;
  searchLoading: boolean;
  searchError: string | null;
  searchInputRef: RefObject<HTMLInputElement>;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  onRefresh: () => void;
  onNavigate: (path: string) => void;
}

export function DashboardTopBar({
  greeting,
  lastUpdated,
  searchTerm,
  onSearchTermChange,
  searchResults,
  searchOpen,
  searchLoading,
  searchError,
  searchInputRef,
  onSearchFocus,
  onSearchBlur,
  onRefresh,
  onNavigate,
}: DashboardTopBarProps) {
  const { user } = useAuth();
  const firstName = user?.fullName?.trim().split(/\s+/)[0] || "User";
  const roleLabel = getPrimaryRoleLabel(user?.roles ?? []);

  return (
    <div className="dashboard-topbar">
      <div className="topbar-left">
        <div className="topbar-greeting">
          <h2>
            {greeting}, {firstName}{" "}
            <span className="topbar-role-muted">({roleLabel})</span>
          </h2>
          <p>
            {lastUpdated
              ? `Last synced ${formatTimeAgo(lastUpdated)}`
              : "Syncing data..."}
          </p>
        </div>
      </div>
      <div className="topbar-right">
        <div className="system-status" role="status" aria-live="polite">
          <span className="system-dot" aria-hidden="true"></span>
          System online
        </div>
        <div className="topbar-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search projects or submissions (⌘/Ctrl + K)"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            ref={searchInputRef}
            aria-label="Search projects or submissions"
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
          />
          {searchOpen && (
            <div className="search-dropdown">
              {searchLoading ? (
                <div className="search-item muted">Searching...</div>
              ) : searchError ? (
                <div className="search-item muted">{searchError}</div>
              ) : searchResults.length === 0 ? (
                <div className="search-item muted">No matches</div>
              ) : (
                searchResults.map((result) => (
                  <button
                    key={result.id}
                    className="search-item"
                    type="button"
                    onClick={() => onNavigate(`/projects/${result.id}`)}
                  >
                    <div className="search-row">
                      <span className="search-code">{result.projectCode}</span>
                    </div>
                    <span className="search-title">{result.title}</span>
                    <span className="search-pi">{result.piName}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <button className="topbar-btn" onClick={onRefresh} title="Refresh" aria-label="Refresh dashboard">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        </button>
        <button className="topbar-btn" title="Notifications" aria-label="Notifications">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
          </svg>
        </button>
        <button className="topbar-btn" title="Logout" aria-label="Log out" onClick={() => onNavigate("/login")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
