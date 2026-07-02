import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  addPanelMember,
  createPanel,
  deletePanel,
  deletePanelMember,
  fetchPanelAssignableUsers,
  fetchPanelManagementPanels,
  updatePanelMember,
} from "@/services/api";
import type {
  PanelAssignableUser,
  PanelManagementMember,
  PanelManagementPanel,
  PanelMemberRole,
} from "@/types";
import { getErrorMessage } from "@/utils";
import "@/styles/admin-users.css";
import "@/styles/panel-management.css";

type PanelMemberDraft = {
  panelId: string;
  userId: string;
  role: PanelMemberRole;
};

const PANEL_MEMBER_ROLES: Array<{ value: PanelMemberRole; label: string }> = [
  { value: "CHAIR", label: "Panel Chair" },
  { value: "MEMBER", label: "Member" },
  { value: "SECRETARIAT", label: "Secretariat" },
];

const initialDraft: PanelMemberDraft = {
  panelId: "",
  userId: "",
  role: "MEMBER",
};

const roleLabel = (role: PanelMemberRole) =>
  PANEL_MEMBER_ROLES.find((entry) => entry.value === role)?.label ?? role;

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function PanelManagementPage() {
  const [panels, setPanels] = useState<PanelManagementPanel[]>([]);
  const [userOptions, setUserOptions] = useState<PanelAssignableUser[]>([]);
  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(null);
  const [draft, setDraft] = useState<PanelMemberDraft>(initialDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRole, setEditingRole] = useState<PanelMemberRole>("MEMBER");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadManagementData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [panelData, userData] = await Promise.all([
        fetchPanelManagementPanels(),
        fetchPanelAssignableUsers(),
      ]);
      setPanels(panelData.panels);
      setUserOptions(userData.users);
      const fallbackPanelId = panelData.panels[0]?.id ?? null;
      setSelectedPanelId((current) =>
        current && panelData.panels.some((panel) => panel.id === current)
          ? current
          : fallbackPanelId
      );
      setDraft((current) => ({
        ...current,
        panelId:
          current.panelId &&
          panelData.panels.some((panel) => String(panel.id) === current.panelId)
            ? current.panelId
            : String(fallbackPanelId ?? ""),
        userId: "",
      }));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load panel members."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Panel Management";
    void loadManagementData();
  }, [loadManagementData]);

  const selectedPanel = useMemo(
    () => panels.find((panel) => panel.id === selectedPanelId) ?? panels[0] ?? null,
    [panels, selectedPanelId]
  );

  const totalAssignedProtocols = useMemo(
    () => panels.reduce((sum, panel) => sum + panel.assignedProtocolCount, 0),
    [panels]
  );

  const activeMembers = useMemo(
    () =>
      panels.reduce(
        (sum, panel) =>
          sum + panel.members.filter((member) => member.isActive && member.user.isActive).length,
        0
      ),
    [panels]
  );

  const assignedUserIds = useMemo(
    () => new Set(selectedPanel?.members.map((member) => member.user.id) ?? []),
    [selectedPanel]
  );

  const assignableUsers = useMemo(
    () => userOptions.filter((user) => !assignedUserIds.has(user.id)),
    [assignedUserIds, userOptions]
  );

  const handleCreatePanel = async () => {
    const committeeId = selectedPanel?.committee.id ?? panels[0]?.committee.id;
    if (!committeeId) {
      setError("Load a committee before adding another panel.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await createPanel({ committeeId });
      setNotice(`${result.panel.name} added.`);
      await loadManagementData();
      setSelectedPanelId(result.panel.id);
      setDraft((current) => ({
        ...current,
        panelId: String(result.panel.id),
        userId: "",
      }));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add panel."));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePanel = async () => {
    if (!selectedPanel) {
      setError("Select a panel to delete.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedPanel.name}? This removes its panel membership records. Panels assigned to protocol classifications cannot be deleted.`
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await deletePanel(selectedPanel.id);
      const remainingPanels = panels.filter((panel) => panel.id !== selectedPanel.id);
      const nextPanelId = remainingPanels[0]?.id ?? null;
      setSelectedPanelId(nextPanelId);
      setDraft((current) => ({
        ...current,
        panelId: String(nextPanelId ?? ""),
        userId: "",
      }));
      setNotice(`${selectedPanel.name} deleted.`);
      await loadManagementData();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete panel."));
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const panelId = Number(draft.panelId || selectedPanel?.id);
    const userId = Number(draft.userId);
    if (!panelId || !userId) {
      setError("Select a panel and approved user.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await addPanelMember(panelId, { userId, role: draft.role });
      setNotice("Panel member added.");
      setDraft({ panelId: String(panelId), userId: "", role: "MEMBER" });
      await loadManagementData();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add panel member."));
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (member: PanelManagementMember) => {
    setEditingId(member.id);
    setEditingRole(member.role);
    setError(null);
    setNotice(null);
  };

  const saveEdit = async (memberId: number) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updatePanelMember(memberId, { role: editingRole });
      setNotice("Panel member updated.");
      setEditingId(null);
      await loadManagementData();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update panel member."));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (member: PanelManagementMember) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updatePanelMember(member.id, { isActive: !member.isActive });
      setNotice(member.isActive ? "Panel member deactivated." : "Panel member reactivated.");
      await loadManagementData();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update member status."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (member: PanelManagementMember) => {
    const confirmed = window.confirm(
      `Delete ${member.user.fullName} from this panel? This cannot be undone.`
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await deletePanelMember(member.id);
      setNotice("Panel member deleted.");
      await loadManagementData();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete panel member."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page panel-management-page">
      <header className="admin-header admin-soft-header">
        <div className="admin-header-copy">
          <span className="admin-page-kicker">Chair workspace</span>
          <h1>Panel Management</h1>
          <p>Maintain panel membership using approved portal accounts.</p>
        </div>
        <div className="admin-header-metrics admin-header-metrics-3">
          <div className="admin-metric-card neutral">
            <span className="admin-metric-label">Panels</span>
            <strong>{panels.length}</strong>
          </div>
          <div className="admin-metric-card approved">
            <span className="admin-metric-label">Active members</span>
            <strong>{activeMembers}</strong>
          </div>
          <div className="admin-metric-card">
            <span className="admin-metric-label">Assigned protocols</span>
            <strong>{totalAssignedProtocols}</strong>
          </div>
        </div>
      </header>

      {notice ? <div className="admin-notice success">{notice}</div> : null}
      {error ? <div className="admin-notice error">{error}</div> : null}

      <section className="admin-soft-panel panel-member-form-panel">
        <form className="panel-member-form" onSubmit={handleAddMember}>
          <label className="panel-form-field">
            <span>Panel</span>
            <select
              className="admin-select clean"
              value={draft.panelId || String(selectedPanel?.id ?? "")}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  panelId: event.target.value,
                  userId: "",
                }));
                setSelectedPanelId(Number(event.target.value));
              }}
              disabled={saving || loading}
            >
              {panels.map((panel) => (
                <option key={panel.id} value={panel.id}>
                  {panel.name} · {panel.committee.code}
                </option>
              ))}
            </select>
          </label>
          <label className="panel-form-field">
            <span>Approved user</span>
            <select
              className="admin-select clean"
              value={draft.userId}
              onChange={(event) =>
                setDraft((current) => ({ ...current, userId: event.target.value }))
              }
              disabled={saving || loading}
            >
              <option value="">
                {assignableUsers.length > 0
                  ? "Select an approved account"
                  : "No approved accounts available"}
              </option>
              {assignableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName} · {user.email}
                </option>
              ))}
            </select>
          </label>
          <label className="panel-form-field">
            <span>Position</span>
            <select
              className="admin-select clean"
              value={draft.role}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  role: event.target.value as PanelMemberRole,
                }))
              }
              disabled={saving || loading}
            >
              {PANEL_MEMBER_ROLES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="admin-btn primary panel-add-btn"
            type="submit"
            disabled={saving || loading || assignableUsers.length === 0}
          >
            Add member
          </button>
        </form>
      </section>

      <section className="admin-soft-panel admin-data-panel">
        <div className="admin-table-header">
          <div>
            <h2 className="panel-title">Current panel members</h2>
            <p className="panel-subtitle">
              {selectedPanel
                ? `${selectedPanel.name} · ${selectedPanel.committee.name} · ${selectedPanel.members.length} member records · ${selectedPanel.assignedProtocolCount} assigned protocols`
                : "No panel selected"}
            </p>
          </div>
          <div className="panel-header-actions">
            <div className="panel-tabs panel-management-tabs" role="tablist" aria-label="Panels">
              {panels.map((panel) => (
                <button
                  key={panel.id}
                  type="button"
                  className={`panel-tab ${panel.id === selectedPanel?.id ? "active" : ""}`}
                  onClick={() => {
                    setSelectedPanelId(panel.id);
                    setDraft((current) => ({
                      ...current,
                      panelId: String(panel.id),
                      userId: "",
                    }));
                  }}
                  title={`${panel.assignedProtocolCount} assigned protocols`}
                >
                  {panel.name}
                </button>
              ))}
            </div>
            <button
              className="admin-btn secondary panel-create-btn"
              type="button"
              onClick={() => void handleCreatePanel()}
              disabled={saving || loading || panels.length === 0}
            >
              Add additional panel
            </button>
            <button
              className="admin-btn danger panel-delete-btn"
              type="button"
              onClick={() => void handleDeletePanel()}
              disabled={saving || loading || !selectedPanel || panels.length <= 1}
            >
              Delete panel
            </button>
          </div>
        </div>

        <div className="panel-body no-padding">
          {loading ? (
            <div className="admin-empty">
              <h3>Loading panel members...</h3>
            </div>
          ) : selectedPanel && selectedPanel.members.length > 0 ? (
            <div className="admin-table-scroll">
              <table className="admin-clean-table panel-members-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Position</th>
                    <th>Status</th>
                    <th>Date added</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPanel.members.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <div className="admin-name-cell">
                          <strong>{member.user.fullName}</strong>
                          <span className="admin-row-meta">
                            {member.user.roles.map((role) => role.replace(/_/g, " ")).join(", ") || "No role"}
                          </span>
                        </div>
                      </td>
                      <td className="admin-email-cell">{member.user.email}</td>
                      <td>
                        {editingId === member.id ? (
                          <select
                            className="admin-select clean"
                            value={editingRole}
                            onChange={(event) => setEditingRole(event.target.value as PanelMemberRole)}
                            disabled={saving}
                          >
                            {PANEL_MEMBER_ROLES.map((entry) => (
                              <option key={entry.value} value={entry.value}>
                                {entry.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="admin-role-text">{roleLabel(member.role)}</span>
                        )}
                      </td>
                      <td>
                        <span className={`admin-status-chip ${member.isActive ? "approved" : "disabled"}`}>
                          {member.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="admin-date-cell">{formatDate(member.createdAt)}</td>
                      <td>
                        <div className="admin-actions clean">
                          {editingId === member.id ? (
                            <>
                              <button
                                className="admin-btn primary"
                                type="button"
                                onClick={() => void saveEdit(member.id)}
                                disabled={saving}
                              >
                                Save
                              </button>
                              <button
                                className="admin-btn ghost"
                                type="button"
                                onClick={() => setEditingId(null)}
                                disabled={saving}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="admin-btn secondary"
                                type="button"
                                onClick={() => beginEdit(member)}
                                disabled={saving}
                              >
                                Edit
                              </button>
                              <button
                                className="admin-btn ghost"
                                type="button"
                                onClick={() => void toggleStatus(member)}
                                disabled={saving}
                              >
                                {member.isActive ? "Deactivate" : "Reactivate"}
                              </button>
                              <button
                                className="admin-btn danger"
                                type="button"
                                onClick={() => void handleDelete(member)}
                                disabled={saving}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty">
              <h3>No panel members yet</h3>
              <p>Add an approved account to start building this panel.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
