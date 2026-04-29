import { useEffect, useState } from "react";

export function ColdStartToast() {
  const [visible, setVisible] = useState(
    typeof window !== "undefined" ? Boolean(window.__rercColdStartActive) : false
  );

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
    <div className="cold-start-toast" role="status" aria-live="polite">
      <span className="cold-start-toast__spinner" aria-hidden="true" />
      <div className="cold-start-toast__copy">
        <strong>Waking up server</strong>
        <span>This may take up to 60 seconds on first load.</span>
      </div>
    </div>
  );
}
