import React from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  actions?: Array<{ label: string; onClick: () => void }>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actions = [],
}) => {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {actions.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "center" }}>
          {actions.map((action) => (
            <button
              key={action.label}
              className="btn btn-secondary btn-sm"
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
