import React, { type RefObject } from "react";
import { formatTimeAgo } from "./utils";
import type { ProjectSearchResult } from "@/types";

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
  onNavigate,
}: DashboardTopBarProps) {
  return (
    <div className="dashboard-topbar">
      <div className="topbar-left">
        <div className="topbar-greeting">
          <h2>{greeting}, Research Associate</h2>
          <p>
            {lastUpdated
              ? `Last synced ${formatTimeAgo(lastUpdated)}`
              : "Syncing data..."}
          </p>
        </div>
      </div>
      <div className="topbar-right">
        <div className="topbar-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search submissions (\u2318/Ctrl + K)"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            ref={searchInputRef}
            aria-label="Search submissions"
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
                    <span className="search-code">{result.projectCode}</span>
                    <span className="search-title">{result.title}</span>
                    <span className="search-pi">{result.piName}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <button className="topbar-btn" title="Notifications" aria-label="Notifications">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
          </svg>
        </button>
      </div>
    </div>
  );
}
