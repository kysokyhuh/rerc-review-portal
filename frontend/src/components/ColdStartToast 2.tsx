import { useEffect, useState } from "react";

/**
 * Shows a "Waking up server..." banner when the backend (Render free tier)
 * is cold-starting. Listens for a custom event dispatched by the Axios
 * interceptor when a cold-start retry is in progress.
 */
export function ColdStartToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleShow = () => setVisible(true);
    const handleHide = () => setVisible(false);

    window.addEventListener("rerc:cold-start", handleShow);
    window.addEventListener("rerc:cold-start-resolved", handleHide);

    return () => {
      window.removeEventListener("rerc:cold-start", handleShow);
      window.removeEventListener("rerc:cold-start-resolved", handleHide);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
        background: "var(--color-warning-bg, #fef3c7)",
        borderBottom: "2px solid var(--color-warning, #f59e0b)",
        padding: "0.75rem 1rem", textAlign: "center",
        fontFamily: "var(--font-family, system-ui, sans-serif)",
        fontSize: "0.875rem", color: "var(--text-primary, #1f2937)",
        animation: "slideDown 0.3s ease-out",
      }}
    >
      <span style={{ marginRight: "0.5rem" }}>&#9889;</span>
      Waking up server... This may take up to 30 seconds on first load.
    </div>
  );
}
