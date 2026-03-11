import { useEffect, useMemo, useState } from "react";
import api from "@/services/api";
import "@/styles/admin-users.css";

type UserStatus = "PENDING" | "ACTIVE" | "REJECTED";
type AccountTab = "ACTIVE" | "INACTIVE" | "PENDING";

type UserRow = {
  id: number;
  fullName: string;
  email: string;
  status: UserStatus;
  statusNote: string | null;
  roles: string[];
  isActive: boolean;
  createdAt: string;
};

type UserDraft = {
  fullName: string;
  status: "ACTIVE" | "INACTIVE";
  selectedRole: string;
  statusNote: string;
};

const EDITABLE_ROLES = ["CHAIR", "RESEARCH_ASSOCIATE", "RESEARCH_ASSISTANT"];
const ACCOUNT_TABS: Array<{ key: AccountTab; label: string }> = [
  { key: "ACTIVE", label: "Active" },
  { key: "INACTIVE", label: "Inactive" },
  { key: "PENDING", label: "For Approval" },
];

const ROLE_LABELS: Record<string, string> = {
  CHAIR: "Chair",
  RESEARCH_ASSOCIATE: "Research Associate",
  RESEARCH_ASSISTANT: "Research Assistant",
};

const statusTextClass = (status: string) => {
  const normalized = status.toUpperCase();
  if (normalized === "ACTIVE") return "admin-status-text active";
  if (normalized === "REJECTED") return "admin-status-text inactive";
  return "admin-status-text pending";
};

const isInactiveRecord = (user: UserRow) =>
  user.status === "REJECTED" || (!user.isActive && user.status !== "PENDING");

const firstEditableRole = (roles: string[]) =>
  roles.find((role) => EDITABLE_ROLES.includes(role)) || "";

const roleText = (role: string | null | undefined) =>
  role ? ROLE_LABELS[role] || role : "Unassigned";

const ROLE_SORT_ORDER: Record<string, number> = {
  CHAIR: 0,
  RESEARCH_ASSOCIATE: 1,
  RESEARCH_ASSISTANT: 2,
};

const sortByRoleThenName = (a: UserRow, b: UserRow) => {
  const aRole = firstEditableRole(a.roles);
  const bRole = firstEditableRole(b.roles);
  const aRank = ROLE_SORT_ORDER[aRole] ?? 99;
  const bRank = ROLE_SORT_ORDER[bRole] ?? 99;

  if (aRank !== bRank) return aRank - bRank;
  return a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" });
};

const formatSignupDate = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function AdminAccountManagementPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, UserDraft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<AccountTab>("ACTIVE");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const hydrateDrafts = (items: UserRow[]) => {
    const next: Record<number, UserDraft> = {};
    for (const user of items) {
      next[user.id] = {
        fullName: user.fullName,
        status: user.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
        selectedRole: firstEditableRole(user.roles),
        statusNote: user.statusNote || "",
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

  const tabCounts = useMemo(() => {
    const active = users.filter((user) => user.status === "ACTIVE" && user.isActive).length;
    const inactive = users.filter((user) => isInactiveRecord(user)).length;
    const pending = users.filter((user) => user.status === "PENDING").length;
    return { ACTIVE: active, INACTIVE: inactive, PENDING: pending };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const filtered = users.filter((user) => {
      if (activeTab === "ACTIVE" && !(user.status === "ACTIVE" && user.isActive)) return false;
      if (activeTab === "INACTIVE" && !isInactiveRecord(user)) return false;
      if (activeTab === "PENDING" && user.status !== "PENDING") return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;
      return `${user.fullName} ${user.email}`.toLowerCase().includes(q);
    });

    if (activeTab === "ACTIVE" || activeTab === "INACTIVE") {
      return [...filtered].sort(sortByRoleThenName);
    }

    return filtered;
  }, [users, search, activeTab]);

  const updateDraft = (userId: number, changes: Partial<UserDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {
          fullName: "",
          status: "INACTIVE",
          selectedRole: "",
          statusNote: "",
        }),
        ...changes,
      },
    }));
  };

  const saveRole = async (user: UserRow) => {
    const draft = drafts[user.id];
    if (!draft) return;
    if (draft.status === "ACTIVE" && !draft.selectedRole) {
      setError("Role is required for active accounts.");
      return;
    }

    const payload: Record<string, unknown> = {};
    const currentRole = firstEditableRole(user.roles);

    if (draft.fullName.trim() && draft.fullName.trim() !== user.fullName) {
      payload.fullName = draft.fullName.trim();
    }

    const currentStatus = user.status === "ACTIVE" ? "ACTIVE" : "INACTIVE";
    if (draft.status !== currentStatus) {
      payload.status = draft.status;
    }

    if (draft.selectedRole !== currentRole) {
      payload.roles = draft.selectedRole ? [draft.selectedRole] : [];
    }

    if (activeTab === "INACTIVE" && draft.statusNote.trim() !== (user.statusNote || "")) {
      payload.statusNote = draft.statusNote.trim() || null;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    setSavingId(user.id);
    setError(null);
    try {
      await api.patch(`/admin/users/${user.id}`, payload);
      setEditingId(null);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to save role.");
    } finally {
      setSavingId(null);
    }
  };

  const deleteUser = async (user: UserRow) => {
    if (!window.confirm(`Deactivate ${user.email}?`)) return;

    setDeletingId(user.id);
    setError(null);
    try {
      await api.delete(`/admin/users/${user.id}`);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to deactivate user.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="dashboard-content admin-page">
      <header className="queue-page-header admin-soft-header">
        <h1>Account Management</h1>
        <p>Review role and status carefully before saving changes.</p>
        <div className="admin-top-controls">
          <div className="panel-tabs admin-tabs" role="tablist" aria-label="Account status tabs">
            {ACCOUNT_TABS.map((tab) => (
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

      <section className="panel admin-soft-panel">
        <div className="panel-body no-padding">
          {loading ? <div className="admin-empty">Loading accounts...</div> : null}
          {!loading && filteredUsers.length === 0 ? (
            <div className="admin-empty">No users in this tab.</div>
          ) : null}

          {!loading && filteredUsers.length > 0 ? (
            <table
              className={`data-table admin-management-table admin-clean-table ${
                activeTab === "INACTIVE" ? "has-notes" : ""
              } ${activeTab === "PENDING" ? "has-signup-date" : ""}`}
            >
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Role</th>
                  {activeTab === "PENDING" ? <th>Date Signed Up</th> : null}
                  {activeTab === "INACTIVE" ? <th>Notes</th> : null}
                  <th className="table-actions-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const draft = drafts[user.id];
                  const busy = savingId === user.id || deletingId === user.id;
                  const isEditing = editingId === user.id;
                  const currentRole = firstEditableRole(user.roles);

                  return (
                    <tr key={user.id}>
                      <td>
                        {isEditing ? (
                          <input
                            className="admin-inline-input"
                            value={draft?.fullName ?? user.fullName}
                            onChange={(event) =>
                              updateDraft(user.id, { fullName: event.target.value })
                            }
                            disabled={busy}
                          />
                        ) : (
                          <div className="table-owner">{user.fullName}</div>
                        )}
                      </td>
                      <td>{user.email}</td>
                      <td>
                        {isEditing ? (
                          <select
                            className="admin-select clean"
                            value={draft?.status ?? "INACTIVE"}
                            onChange={(event) =>
                              updateDraft(user.id, {
                                status: event.target.value as "ACTIVE" | "INACTIVE",
                              })
                            }
                            disabled={busy}
                          >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="INACTIVE">INACTIVE</option>
                          </select>
                        ) : (
                          <span className={statusTextClass(user.status)}>{user.status}</span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            className="admin-select clean"
                            value={draft?.selectedRole ?? ""}
                            onChange={(event) =>
                              updateDraft(user.id, { selectedRole: event.target.value })
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
                      {activeTab === "PENDING" ? (
                        <td className="admin-date-cell">{formatSignupDate(user.createdAt)}</td>
                      ) : null}
                      {activeTab === "INACTIVE" ? (
                        <td>
                          {isEditing ? (
                            <input
                              className="admin-note-inline"
                              placeholder="application rejected, account inactive, etc."
                              value={draft?.statusNote ?? ""}
                              onChange={(event) =>
                                updateDraft(user.id, { statusNote: event.target.value })
                              }
                              disabled={busy}
                            />
                          ) : (
                            <span>{user.statusNote || "-"}</span>
                          )}
                        </td>
                      ) : null}
                      <td className="table-actions">
                        <div className="admin-actions clean">
                          {!isEditing ? (
                            <button
                              className="admin-btn"
                              onClick={() => setEditingId(user.id)}
                              disabled={busy}
                            >
                              Edit
                            </button>
                          ) : (
                            <>
                              <button
                                className="admin-btn save"
                                onClick={() => void saveRole(user)}
                                disabled={busy}
                              >
                                {savingId === user.id ? "Saving..." : "Save"}
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
                          )}
                          {!isEditing ? (
                            <button
                              className="admin-btn reject"
                              onClick={() => void deleteUser(user)}
                              disabled={busy}
                            >
                              {deletingId === user.id ? "Deleting..." : "Delete"}
                            </button>
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
