import React from "react";
import type { ProtocolMilestone } from "@/types";

interface MilestoneTableProps {
  milestones: ProtocolMilestone[];
  setMilestones: React.Dispatch<React.SetStateAction<ProtocolMilestone[]>>;
  newMilestoneLabel: string;
  setNewMilestoneLabel: (label: string) => void;
  onAddMilestone: () => void;
  onLoadStandardTimeline: () => void;
  onSaveMilestone: (row: ProtocolMilestone) => void;
  onDeleteMilestone: (row: ProtocolMilestone) => void;
  canEdit?: boolean;
}

export function MilestoneTable({
  milestones, setMilestones, newMilestoneLabel, setNewMilestoneLabel,
  onAddMilestone, onLoadStandardTimeline, onSaveMilestone, onDeleteMilestone,
  canEdit = true,
}: MilestoneTableProps) {
  const updateField = <K extends keyof ProtocolMilestone>(
    id: number,
    field: K,
    value: ProtocolMilestone[K]
  ) =>
    setMilestones((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );

  return (
    <div style={{ marginTop: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <h3 className="pp-group-name" style={{ margin: 0 }}>Milestones / # days</h3>
        {canEdit ? (
          <button className="btn btn-ghost btn-sm" type="button" onClick={onLoadStandardTimeline}>
            Load Standard Timeline
          </button>
        ) : null}
      </div>
      {canEdit ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            className="pp-field-input" type="text" value={newMilestoneLabel}
            onChange={(e) => setNewMilestoneLabel(e.target.value)}
            placeholder="Add milestone label (e.g. Full Review Meeting)" style={{ flex: 1 }}
          />
          <button className="btn btn-secondary btn-sm" type="button" onClick={onAddMilestone}>Add</button>
        </div>
      ) : null}
      <table className="preview-table" style={{ marginTop: "0.5rem" }}>
        <thead>
          <tr><th></th><th>Label</th><th># days</th><th>Date</th><th>Owner</th><th>Notes</th>{canEdit ? <th>Actions</th> : null}</tr>
        </thead>
        <tbody>
          {milestones.map((m) => {
            const isDone = !!m.dateOccurred;
            return (
              <tr key={m.id} style={{ opacity: isDone ? 1 : 0.75 }}>
                <td style={{ textAlign: "center" }}>
                  {isDone ? (
                    <span title="Completed" style={{ color: "var(--color-positive, #22c55e)", fontSize: 16 }}>✓</span>
                  ) : (
                    <span title="Pending" style={{ color: "var(--color-neutral, #94a3b8)", fontSize: 16 }}>○</span>
                  )}
                </td>
                <td>
                  {canEdit ? <input type="text" value={m.label} onChange={(e) => updateField(m.id, "label", e.target.value)} /> : m.label}
                </td>
                <td>
                  {canEdit ? <input type="number" value={m.days ?? ""} onChange={(e) => updateField(m.id, "days", e.target.value ? Number(e.target.value) : null)} /> : (m.days ?? "—")}
                </td>
                <td>
                  {canEdit ? <input type="date" value={m.dateOccurred ? m.dateOccurred.slice(0, 10) : ""} onChange={(e) => updateField(m.id, "dateOccurred", e.target.value || null)} /> : (m.dateOccurred ? m.dateOccurred.slice(0, 10) : "—")}
                </td>
                <td>
                  {canEdit ? <input type="text" value={m.ownerRole ?? ""} onChange={(e) => updateField(m.id, "ownerRole", e.target.value || null)} /> : (m.ownerRole ?? "—")}
                </td>
                <td>
                  {canEdit ? <input type="text" value={m.notes ?? ""} onChange={(e) => updateField(m.id, "notes", e.target.value || null)} /> : (m.notes ?? "—")}
                </td>
                {canEdit ? (
                  <td>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => onSaveMilestone(m)}>Save</button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => onDeleteMilestone(m)}>Delete</button>
                  </td>
                ) : null}
              </tr>
            );
          })}
          {milestones.length === 0 && <tr><td colSpan={canEdit ? 7 : 6}>No milestones yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
