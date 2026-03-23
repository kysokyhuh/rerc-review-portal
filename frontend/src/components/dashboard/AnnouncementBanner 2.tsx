import React from "react";

export interface Announcement {
  id: string;
  tone: string;
  title: string;
  message: string;
}

interface AnnouncementBannerProps {
  announcements: Announcement[];
  onDismiss: (id: string) => void;
}

export function AnnouncementBanner({ announcements, onDismiss }: AnnouncementBannerProps) {
  if (announcements.length === 0) return null;

  return (
    <div className="announcement-stack">
      {announcements.map((a) => (
        <div key={a.id} className={`announcement-banner ${a.tone}`} role="status">
          <div className="announcement-content">
            <strong>{a.title}</strong>
            <span>{a.message}</span>
          </div>
          <button
            className="announcement-dismiss"
            type="button"
            onClick={() => onDismiss(a.id)}
            aria-label="Dismiss announcement"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
