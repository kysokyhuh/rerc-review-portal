import {
  classifyOverdue,
  type OverdueOwner,
} from "../../src/utils/overdueClassifier";

describe("overdueClassifier", () => {
  it("classifies AWAITING_REVISIONS as RESEARCHER", () => {
    const result = classifyOverdue("AWAITING_REVISIONS");
    expect(result.overdueOwner).toBe("RESEARCHER");
    expect(result.overdueReason).toContain("Researcher");
  });

  it("classifies REVISION_SUBMITTED as RESEARCHER", () => {
    const result = classifyOverdue("REVISION_SUBMITTED");
    expect(result.overdueOwner).toBe("RESEARCHER");
  });

  const panelStatuses = [
    "RECEIVED",
    "UNDER_COMPLETENESS_CHECK",
    "AWAITING_CLASSIFICATION",
    "UNDER_CLASSIFICATION",
    "CLASSIFIED",
    "UNDER_REVIEW",
    "CLOSED",
    "WITHDRAWN",
  ];

  it.each(panelStatuses)("classifies %s as PANEL", (status) => {
    const result = classifyOverdue(status);
    expect(result.overdueOwner).toBe("PANEL" as OverdueOwner);
    expect(result.overdueReason).toBeTruthy();
  });

  it("handles unknown status gracefully", () => {
    const result = classifyOverdue("UNKNOWN_STATUS");
    expect(result.overdueOwner).toBe("PANEL");
    expect(result.overdueReason).toBe("Status: UNKNOWN_STATUS");
  });
});
