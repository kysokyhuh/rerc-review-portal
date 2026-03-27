import { useEffect, useMemo, useState } from "react";
import api from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import "@/styles/admin-users.css";

type UserStatus = "PENDING" | "APPROVED" | "REJECTED" | "DISABLED";
type AccountTab = UserStatus;

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
const ACCOUNT_TABS: Array<{ key: AccountTab; label: string }> = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "DISABLED", label: "Disabled" },
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

const statusTextClass = (status: UserStatus) => {
  if (status === "APPROVED") return "admin-status-text active";
  if (status === "PENDING") return "admin-status-text pending";
  return "admin-status-text inactive";
};

const sortByRoleThenName = (a: UserRow, b: UserRow) => {
  const aRole = firstEditableRole(a.roles);
  const bRole = firstEditableRole(b.roles);
  const aRank = ROLE_SORT_ORDER[aRole] ?? 99;
  const bRank = ROLE_SORT_ORDER[bRole] ?? 99;

  if (aRank !== bRank) return aRank - bRank;
  return a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" });
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

  const noteText = (entry: UserRow) => {
    if (entry.statusNote) return entry.statusNote;
    if (entry.forcePasswordChange) {
      return "Temporary password issued; password change required.";
    }
    return "-";
  };

  return (
    <div className="dashboard-content admin-page">
      <header className="queue-page-header admin-soft-header">
        <h1>Account Management</h1>
        <p>
          {isChair
            ? "Review pending signups, assign roles, reset passwords, and control access from one screen."
            : "Reset temporary passwords for approved accounts."}
        </p>
        <div className="admin-top-controls">
          <div className="panel-tabs admin-tabs" role="tablist" aria-label="Account status tabs">
            {availableTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`panel-tab ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span>{`${tab.label} (${tabCounts[tab.key]})`}</span>
              </button>
            ))}
          </div>
          <input
            className="admin-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email"
          />
        </div>
      </header>

      {error ? <div className="admin-error">{error}</div> : null}
      {!error && notice ? <div className="login-warning">{notice}</div> : null}

      <section className="panel admin-soft-panel">
        <div className="panel-body no-padding">
          {loading ? <div className="admin-empty">Loading accounts...</div> : null}
          {!loading && filteredUsers.length === 0 ? (
            <div className="admin-empty">No users in this tab.</div>
          ) : null}

          {!loading && filteredUsers.length > 0 ? (
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

                  return (
                    <tr key={entry.id}>
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
                          <div className="table-owner">{entry.fullName}</div>
                        )}
                      </td>
                      <td>{entry.email}</td>
                      <td>
                        <span className={statusTextClass(entry.status)}>
                          {entry.status}
                        </span>
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
                          <span>{roleText(currentRole)}</span>
                        )}
                      </td>
                      <td className="admin-date-cell">{formatDateTime(getDateValue(entry))}</td>
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
                          <span>{noteText(entry)}</span>
                        )}
                      </td>
                      <td className="table-actions">
                        <div className="admin-actions clean">
                          {activeTab === "PENDING" && isChair ? (
                            <>
                              <button
                                className="admin-btn save"
                                onClick={() => void handleApprove(entry)}
                                disabled={busy}
                              >
                                {busy ? "Saving..." : "Approve"}
                              </button>
                              <button
                                className="admin-btn reject"
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
                                className="admin-btn"
                                onClick={() => setEditingId(entry.id)}
                                disabled={busy}
                              >
                                Edit
                              </button>
                              <button
                                className="admin-btn reject"
                                onClick={() => void handleDisable(entry)}
                                disabled={busy}
                              >
                                Disable
                              </button>
                              <button
                                className="admin-btn save"
                                onClick={() => void handleResetPassword(entry)}
                                disabled={busy || !canResetPasswords}
                              >
                                Reset Password
                              </button>
                            </>
                          ) : null}

                          {activeTab === "APPROVED" && !isEditing && !isChair ? (
                            <button
                              className="admin-btn save"
                              onClick={() => void handleResetPassword(entry)}
                              disabled={busy || !canResetPasswords}
                            >
                              Reset Password
                            </button>
                          ) : null}

                          {activeTab === "APPROVED" && isEditing && isChair ? (
                            <>
                              <button
                                className="admin-btn save"
                                onClick={() => void saveApprovedUser(entry)}
                                disabled={busy}
                              >
                                {busy ? "Saving..." : "Save"}
                              </button>
                              <button
                                className="admin-btn"
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
                              className="admin-btn save"
                              onClick={() => void handleEnable(entry)}
                              disabled={busy}
                            >
                              {busy ? "Saving..." : "Enable"}
                            </button>
                          ) : null}

                          {(activeTab === "REJECTED" || (activeTab === "DISABLED" && !isChair)) ? (
                            <span className="login-footnote">No actions</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}
        </div>
      </section>
    </div>
  );
}
