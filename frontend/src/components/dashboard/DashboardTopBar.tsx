import React, { type RefObject } from "react";
import { formatTimeAgo } from "./utils";
import type { ProjectSearchResult } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { getPrimaryRoleDescription, getPrimaryRoleLabel } from "@/utils/roleUtils";

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
  const { user } = useAuth();
  const firstName = user?.fullName?.trim().split(/\s+/)[0] || "User";
  const roleLabel = getPrimaryRoleLabel(user?.roles ?? []);
  const roleDescription = getPrimaryRoleDescription(user?.roles ?? []);

  return (
    <div className="dashboard-topbar">
      <div className="topbar-left">
        <div className="topbar-greeting">
          <h2>
            {greeting}, {firstName}{" "}
            <span className="topbar-role-muted" title={roleDescription}>({roleLabel})</span>
          </h2>
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
      </div>
    </div>
  );
}
