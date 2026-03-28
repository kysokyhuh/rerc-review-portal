import { useEffect, useMemo, useState } from "react";
import api from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import "@/styles/admin-users.css";

type UserStatus = "PENDING" | "APPROVED" | "REJECTED" | "DISABLED";
type AccountTab = UserStatus;
type AccountTabConfig = {
  key: AccountTab;
  label: string;
  description: string;
};

type UserRow = {
  id: number;
  fullName: string;
  email: string;
  status: UserStatus;
  isActive: boolean;
  forcePasswordChange: boolean;
  statusNote: string | null;
  roles: string[];
  approvedAt: string | null;
  rejectedAt?: string | null;
  createdAt: string;
};

type UserDraft = {
  fullName: string;
  selectedRole: string;
  statusNote: string;
};

const EDITABLE_ROLES = ["CHAIR", "RESEARCH_ASSOCIATE", "RESEARCH_ASSISTANT"];
const ACCOUNT_TABS: AccountTabConfig[] = [
  { key: "PENDING", label: "Pending", description: "Awaiting chair review and role assignment." },
  { key: "APPROVED", label: "Approved", description: "Active accounts with approved access and password controls." },
  { key: "REJECTED", label: "Rejected", description: "Requests that were declined and remain blocked from sign-in." },
  { key: "DISABLED", label: "Disabled", description: "Previously approved accounts with access suspended." },
];

const ROLE_LABELS: Record<string, string> = {
  CHAIR: "Chair",
  RESEARCH_ASSOCIATE: "Research Associate",
  RESEARCH_ASSISTANT: "Research Assistant",
};

const ROLE_SORT_ORDER: Record<string, number> = {
  CHAIR: 0,
  RESEARCH_ASSOCIATE: 1,
  RESEARCH_ASSISTANT: 2,
};

const firstEditableRole = (roles: string[]) =>
  roles.find((role) => EDITABLE_ROLES.includes(role)) || "";

const roleText = (role: string | null | undefined) =>
  role ? ROLE_LABELS[role] || role : "Unassigned";

const statusBadgeClass = (status: UserStatus) =>
  `admin-status-chip ${status.toLowerCase()}`;

const sortByRoleThenName = (a: UserRow, b: UserRow) => {
  const aRole = firstEditableRole(a.roles);
  const bRole = firstEditableRole(b.roles);
  const aRank = ROLE_SORT_ORDER[aRole] ?? 99;
  const bRank = ROLE_SORT_ORDER[bRole] ?? 99;

  if (aRank !== bRank) return aRank - bRank;
  return a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" });
};

const formatDateTimeParts = (value: string | null | undefined) => {
  if (!value) {
    return { date: "—", time: null as string | null };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: "—", time: null as string | null };
  }

  return {
    date: parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: parsed.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
};

const getStatusNoteContent = (entry: UserRow) => {
  if (entry.statusNote) {
    return <span className="admin-note-meta">{entry.statusNote}</span>;
  }
  if (entry.forcePasswordChange) {
    return <span className="admin-note-chip">Password reset pending</span>;
  }
  return <span className="admin-note-meta empty">No note</span>;
};

export default function AdminAccountManagementPage() {
  const { user } = useAuth();
  const isChair = user?.roles.includes("CHAIR") ?? false;
  const canResetPasswords =
    isChair || (user?.roles.includes("ADMIN") ?? false);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, UserDraft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<AccountTab>("PENDING");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const hydrateDrafts = (items: UserRow[]) => {
    const next: Record<number, UserDraft> = {};
    for (const item of items) {
      next[item.id] = {
        fullName: item.fullName,
        selectedRole: firstEditableRole(item.roles),
        statusNote: item.statusNote || "",
      };
    }
    setDrafts(next);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/admin/users");
      const items = (res.data.users || []) as UserRow[];
      setUsers(items);
      hydrateDrafts(items);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!isChair && activeTab !== "APPROVED") {
      setActiveTab("APPROVED");
    }
  }, [activeTab, isChair]);

  const tabCounts = useMemo(() => {
    return {
      PENDING: users.filter((entry) => entry.status === "PENDING").length,
      APPROVED: users.filter((entry) => entry.status === "APPROVED").length,
      REJECTED: users.filter((entry) => entry.status === "REJECTED").length,
      DISABLED: users.filter((entry) => entry.status === "DISABLED").length,
    };
  }, [users]);

  const availableTabs = useMemo(
    () => (isChair ? ACCOUNT_TABS : ACCOUNT_TABS.filter((tab) => tab.key === "APPROVED")),
    [isChair]
  );

  const activeTabConfig = useMemo(
    () => availableTabs.find((tab) => tab.key === activeTab) || availableTabs[0],
    [activeTab, availableTabs]
  );

  const filteredUsers = useMemo(() => {
    const filtered = users.filter((entry) => {
      if (entry.status !== activeTab) return false;
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return `${entry.fullName} ${entry.email}`.toLowerCase().includes(query);
    });

    if (activeTab === "APPROVED") {
      return [...filtered].sort(sortByRoleThenName);
    }

    return [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [activeTab, search, users]);

  const tableSummary = useMemo(() => {
    if (activeTab === "PENDING") {
      return "Pending requests stay blocked from sign-in until a chair approves and assigns a role.";
    }
    if (activeTab === "APPROVED") {
      return "Approved accounts can be edited, reset, and disabled without leaving this table.";
    }
    if (activeTab === "REJECTED") {
      return "Rejected requests remain archived here for audit visibility and future review.";
    }
    return "Disabled accounts stay visible so chairs can restore access with a documented note.";
  }, [activeTab]);

  const emptyState = useMemo(() => {
    if (search.trim()) {
      return {
        title: `No ${activeTabConfig.label.toLowerCase()} accounts match this search.`,
        body: "Try a different name or email, or clear the search to return to the full result set.",
        canResetSearch: true,
      };
    }

    if (activeTab === "PENDING") {
      return {
        title: "No pending approvals right now.",
        body: "New signups will appear here for chair review, role assignment, and final access approval.",
        canResetSearch: false,
      };
    }

    if (activeTab === "APPROVED") {
      return {
        title: "No approved accounts are visible.",
        body: "Approved users will appear here for password resets, role updates, and access control changes.",
        canResetSearch: false,
      };
    }

    if (activeTab === "REJECTED") {
      return {
        title: "No rejected accounts are on file.",
        body: "Declined requests stay visible here for audit context when they exist.",
        canResetSearch: false,
      };
    }

    return {
      title: "No disabled accounts right now.",
      body: "Disabled records will appear here whenever access has been suspended and can later be restored.",
      canResetSearch: false,
    };
  }, [activeTab, activeTabConfig.label, search]);

  const headerMetrics = useMemo(() => {
    if (!isChair) {
      return [
        { label: "Approved accounts", value: tabCounts.APPROVED, tone: "approved" },
        { label: "Password resets", value: canResetPasswords ? "Enabled" : "Restricted", tone: "neutral" },
      ];
    }

    return [
      { label: "Pending approvals", value: tabCounts.PENDING, tone: "pending" },
      { label: "Approved accounts", value: tabCounts.APPROVED, tone: "approved" },
      { label: "Disabled accounts", value: tabCounts.DISABLED, tone: "disabled" },
    ];
  }, [canResetPasswords, isChair, tabCounts]);

  const updateDraft = (userId: number, changes: Partial<UserDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {
          fullName: "",
          selectedRole: "",
          statusNote: "",
        }),
        ...changes,
      },
    }));
  };

  const clearMessages = () => {
    setError(null);
    setNotice(null);
  };

  const handleApprove = async (entry: UserRow) => {
    const role = drafts[entry.id]?.selectedRole || "";
    if (!role) {
      setError("Select a role before approving the account.");
      return;
    }

    setSavingId(entry.id);
    clearMessages();
    try {
      await api.post(`/admin/users/${entry.id}/approve`, { role });
      setNotice("Account approved.");
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to approve account.");
    } finally {
      setSavingId(null);
    }
  };

  const handleReject = async (entry: UserRow) => {
    const defaultNote = drafts[entry.id]?.statusNote || "";
    const note = window.prompt("Optional rejection note", defaultNote);
    if (note === null) return;

    setSavingId(entry.id);
    clearMessages();
    try {
      await api.post(`/admin/users/${entry.id}/reject`, note.trim() ? { note: note.trim() } : {});
      setNotice("Account rejected.");
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to reject account.");
    } finally {
      setSavingId(null);
    }
  };

  const handleDisable = async (entry: UserRow) => {
    const defaultNote = drafts[entry.id]?.statusNote || "Account disabled";
    const note = window.prompt("Optional disable note", defaultNote);
    if (note === null) return;
    if (!window.confirm(`Disable ${entry.email}?`)) return;

    setSavingId(entry.id);
    clearMessages();
    try {
      await api.post(`/admin/users/${entry.id}/disable`, note.trim() ? { note: note.trim() } : {});
      setEditingId(null);
      setNotice("Account disabled.");
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to disable account.");
    } finally {
      setSavingId(null);
    }
  };

  const handleEnable = async (entry: UserRow) => {
    const defaultNote = drafts[entry.id]?.statusNote || "";
    const note = window.prompt("Optional enable note", defaultNote);
    if (note === null) return;
    if (!window.confirm(`Enable ${entry.email}?`)) return;

    setSavingId(entry.id);
    clearMessages();
    try {
      await api.post(`/admin/users/${entry.id}/enable`, note.trim() ? { note: note.trim() } : {});
      setNotice("Account enabled.");
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to enable account.");
    } finally {
      setSavingId(null);
    }
  };

  const handleResetPassword = async (entry: UserRow) => {
    const temporaryPassword = window.prompt(
      `Enter a temporary password for ${entry.email}`
    );
    if (temporaryPassword === null) return;
    if (!temporaryPassword.trim()) {
      setError("Temporary password is required.");
      return;
    }

    setSavingId(entry.id);
    clearMessages();
    try {
      await api.post(`/admin/users/${entry.id}/reset-password`, {
        temporaryPassword: temporaryPassword.trim(),
      });
      setNotice("Temporary password saved. The user must change it at next sign-in.");
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to reset password.");
    } finally {
      setSavingId(null);
    }
  };

  const saveApprovedUser = async (entry: UserRow) => {
    const draft = drafts[entry.id];
    if (!draft) return;

    const payload: Record<string, unknown> = {};
    const currentRole = firstEditableRole(entry.roles);

    if (draft.fullName.trim() && draft.fullName.trim() !== entry.fullName) {
      payload.fullName = draft.fullName.trim();
    }

    if (draft.selectedRole && draft.selectedRole !== currentRole) {
      payload.role = draft.selectedRole;
    }

    if ((draft.statusNote || "").trim() !== (entry.statusNote || "")) {
      payload.statusNote = draft.statusNote.trim() || null;
    }

    if (Object.keys(payload).length === 0) {
      setEditingId(null);
      return;
    }

    setSavingId(entry.id);
    clearMessages();
    try {
      await api.patch(`/admin/users/${entry.id}`, payload);
      setEditingId(null);
      setNotice("Account updated.");
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to save account changes.");
    } finally {
      setSavingId(null);
    }
  };

  const getDateLabel = () => {
    if (activeTab === "PENDING") return "Signed up";
    if (activeTab === "APPROVED") return "Approved";
    if (activeTab === "REJECTED") return "Rejected";
    return "Updated";
  };

  const getDateValue = (entry: UserRow) => {
    if (activeTab === "APPROVED") return entry.approvedAt || entry.createdAt;
    if (activeTab === "REJECTED") return entry.rejectedAt || entry.createdAt;
    return entry.createdAt;
  };

  return (
    <div className="dashboard-content admin-page">
      <header className="admin-soft-header admin-header">
        <div className="admin-header-copy">
          <span className="admin-page-kicker">Access Governance</span>
          <h1>Account Management</h1>
          <p>
            {isChair
              ? "Review signups, assign final roles, reset passwords, and control access from one operational workspace."
              : "Reset temporary passwords for approved accounts and keep access controls visible in one queue."}
          </p>
        </div>

        <div
          className={`admin-header-metrics admin-header-metrics-${headerMetrics.length}`}
          aria-label="Account summary"
        >
          {headerMetrics.map((metric) => (
            <div key={metric.label} className={`admin-metric-card ${metric.tone}`}>
              <span className="admin-metric-label">{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>

        <div className="admin-toolbar">
          <div className="admin-segmented" role="tablist" aria-label="Account status tabs">
            {availableTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`admin-segment ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
                role="tab"
                aria-selected={activeTab === tab.key}
              >
                <span className="admin-segment-label">{tab.label}</span>
                <span className="admin-segment-count" aria-label={`${tabCounts[tab.key]} accounts`}>
                  {tabCounts[tab.key]}
                </span>
              </button>
            ))}
          </div>

          <label className="admin-search-shell">
            <svg
              className="admin-search-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              className="admin-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search accounts by name or email"
              type="search"
            />
          </label>
        </div>

        <div className="admin-toolbar-meta">
          <p className="admin-toolbar-description">{activeTabConfig.description}</p>
          <div className="admin-toolbar-actions">
            {search.trim() ? (
              <button className="admin-toolbar-clear" type="button" onClick={() => setSearch("")}>
                Clear search
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {error ? <div className="admin-notice error">{error}</div> : null}
      {!error && notice ? <div className="admin-notice success">{notice}</div> : null}

      <section className="panel admin-soft-panel admin-data-panel">
        <div className="panel-header admin-table-header">
          <div>
            <h2 className="panel-title">{activeTabConfig.label} Accounts</h2>
            <p className="panel-subtitle">{tableSummary}</p>
          </div>
          <div className="admin-results-cluster" aria-label="Table result summary">
            <span className="admin-results-pill">{filteredUsers.length} shown</span>
            <span className="admin-results-caption">
              {tabCounts[activeTab]} total in {activeTabConfig.label.toLowerCase()}
            </span>
          </div>
        </div>
        <div className="panel-body no-padding">
          {loading ? (
            <div className="admin-empty">
              <div className="admin-empty-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h10" />
                </svg>
              </div>
              <h3>Loading accounts</h3>
              <p>Fetching the latest access records, approval states, and role assignments.</p>
            </div>
          ) : null}
          {!loading && filteredUsers.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h10" />
                </svg>
              </div>
              <h3>{emptyState.title}</h3>
              <p>{emptyState.body}</p>
              {emptyState.canResetSearch ? (
                <button className="admin-btn ghost" type="button" onClick={() => setSearch("")}>
                  Clear search
                </button>
              ) : null}
            </div>
          ) : null}

          {!loading && filteredUsers.length > 0 ? (
            <div className="admin-table-scroll">
              <table className="data-table admin-management-table admin-clean-table has-notes">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Role</th>
                    <th>{getDateLabel()}</th>
                    <th>Notes</th>
                    <th className="table-actions-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((entry) => {
                    const draft = drafts[entry.id];
                    const busy = savingId === entry.id;
                    const isEditing = editingId === entry.id;
                    const currentRole = firstEditableRole(entry.roles);
                    const dateParts = formatDateTimeParts(getDateValue(entry));
                    const actionClassName = [
                      "admin-actions clean",
                      activeTab === "PENDING" && isChair ? "pending" : "",
                      activeTab === "APPROVED" && !isEditing && isChair ? "approved" : "",
                      activeTab === "APPROVED" && isEditing && isChair ? "edit" : "",
                      (activeTab === "APPROVED" && !isEditing && !isChair) ||
                      (activeTab === "DISABLED" && isChair)
                        ? "single"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <tr key={entry.id} className={isEditing ? "admin-row-editing" : undefined}>
                        <td>
                          {activeTab === "APPROVED" && isEditing && isChair ? (
                            <input
                              className="admin-inline-input"
                              value={draft?.fullName ?? entry.fullName}
                              onChange={(event) =>
                                updateDraft(entry.id, { fullName: event.target.value })
                              }
                              disabled={busy}
                            />
                          ) : (
                            <div className="admin-name-cell">
                              <div className="table-owner">{entry.fullName}</div>
                              <div className="admin-row-meta">
                                {entry.forcePasswordChange
                                  ? "Temporary password outstanding"
                                  : "Managed account"}
                              </div>
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="admin-email-cell">{entry.email}</div>
                        </td>
                        <td>
                          <span className={statusBadgeClass(entry.status)}>{entry.status}</span>
                        </td>
                        <td>
                          {activeTab === "PENDING" && isChair ? (
                            <select
                              className="admin-select clean"
                              value={draft?.selectedRole ?? ""}
                              onChange={(event) =>
                                updateDraft(entry.id, { selectedRole: event.target.value })
                              }
                              disabled={busy}
                            >
                              <option value="">Select role</option>
                              {EDITABLE_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {roleText(role)}
                                </option>
                              ))}
                            </select>
                          ) : activeTab === "APPROVED" && isEditing && isChair ? (
                            <select
                              className="admin-select clean"
                              value={draft?.selectedRole ?? ""}
                              onChange={(event) =>
                                updateDraft(entry.id, { selectedRole: event.target.value })
                              }
                              disabled={busy}
                            >
                              <option value="">Select role</option>
                              {EDITABLE_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {roleText(role)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span
                              className={`admin-role-pill ${currentRole ? "" : "unassigned"}`.trim()}
                            >
                              {roleText(currentRole)}
                            </span>
                          )}
                        </td>
                        <td className="admin-date-cell">
                          <div className="admin-date-stack">
                            <span className="admin-date-primary">{dateParts.date}</span>
                            {dateParts.time ? (
                              <span className="admin-date-secondary">{dateParts.time}</span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          {activeTab === "APPROVED" && isEditing && isChair ? (
                            <input
                              className="admin-note-inline"
                              placeholder="Optional note"
                              value={draft?.statusNote ?? ""}
                              onChange={(event) =>
                                updateDraft(entry.id, { statusNote: event.target.value })
                              }
                              disabled={busy}
                            />
                          ) : (
                            getStatusNoteContent(entry)
                          )}
                        </td>
                        <td className="table-actions">
                          <div className={actionClassName}>
                            {activeTab === "PENDING" && isChair ? (
                              <>
                                <button
                                  className="admin-btn primary"
                                  onClick={() => void handleApprove(entry)}
                                  disabled={busy}
                                >
                                  {busy ? "Saving..." : "Approve"}
                                </button>
                                <button
                                  className="admin-btn danger"
                                  onClick={() => void handleReject(entry)}
                                  disabled={busy}
                                >
                                  Reject
                                </button>
                              </>
                            ) : null}

                            {activeTab === "APPROVED" && !isEditing && isChair ? (
                              <>
                                <button
                                  className="admin-btn secondary"
                                  onClick={() => setEditingId(entry.id)}
                                  disabled={busy}
                                >
                                  Edit
                                </button>
                                <button
                                  className="admin-btn ghost"
                                  onClick={() => void handleResetPassword(entry)}
                                  disabled={busy || !canResetPasswords}
                                >
                                  Reset Password
                                </button>
                                <button
                                  className="admin-btn danger"
                                  type="button"
                                  aria-label={`Disable ${entry.email}`}
                                  data-span="full"
                                  onClick={() => void handleDisable(entry)}
                                  disabled={busy}
                                >
                                  Disable
                                </button>
                              </>
                            ) : null}

                            {activeTab === "APPROVED" && !isEditing && !isChair ? (
                              <button
                                className="admin-btn primary"
                                onClick={() => void handleResetPassword(entry)}
                                disabled={busy || !canResetPasswords}
                              >
                                Reset Password
                              </button>
                            ) : null}

                            {activeTab === "APPROVED" && isEditing && isChair ? (
                              <>
                                <button
                                  className="admin-btn primary"
                                  onClick={() => void saveApprovedUser(entry)}
                                  disabled={busy}
                                >
                                  {busy ? "Saving..." : "Save"}
                                </button>
                                <button
                                  className="admin-btn ghost"
                                  onClick={() => {
                                    setEditingId(null);
                                    hydrateDrafts(users);
                                  }}
                                  disabled={busy}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : null}

                            {activeTab === "DISABLED" && isChair ? (
                              <button
                                className="admin-btn primary"
                                onClick={() => void handleEnable(entry)}
                                disabled={busy}
                              >
                                {busy ? "Saving..." : "Enable"}
                              </button>
                            ) : null}

                            {(activeTab === "REJECTED" || (activeTab === "DISABLED" && !isChair)) ? (
                              <span className="admin-empty-action">No actions available</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
        {!loading && filteredUsers.length > 0 ? (
          <div className="admin-table-footer">
            <div>
              <span className="admin-footer-count">{filteredUsers.length}</span>{" "}
              {filteredUsers.length === 1 ? "account" : "accounts"} visible in this view
            </div>
            <div className="admin-footer-summary">{activeTabConfig.description}</div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
