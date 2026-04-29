import { useEffect, useState } from "react";

declare global {
  interface Window {
    __rercColdStartActive?: boolean;
  }
}

const isColdStartActive = () =>
  typeof window !== "undefined" ? Boolean(window.__rercColdStartActive) : false;

export function useColdStartStatus() {
  const [isColdStart, setIsColdStart] = useState(isColdStartActive);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleShow = () => setIsColdStart(true);
    const handleHide = () => setIsColdStart(false);

    window.addEventListener("rerc:cold-start", handleShow);
    window.addEventListener("rerc:cold-start-resolved", handleHide);

    return () => {
      window.removeEventListener("rerc:cold-start", handleShow);
      window.removeEventListener("rerc:cold-start-resolved", handleHide);
    };
  }, []);

  return isColdStart;
}
