import {
  classifyOverdue,
  type OverdueOwner,
} from "../../src/utils/overdueClassifier";

describe("overdueClassifier", () => {
  it("classifies AWAITING_REVISIONS as RESEARCHER", () => {
    const result = classifyOverdue("AWAITING_REVISIONS");
    expect(result.overdueOwner).toBe("RESEARCHER");
    expect(result.overdueOwnerRole).toBe("PROJECT_LEADER_RESEARCHER_PROPONENT");
    expect(result.overdueOwnerLabel).toBe("Researcher");
    expect(result.overdueReason).toContain("Researcher");
  });

  it("classifies REVISION_SUBMITTED as reviewer-group ownership", () => {
    const result = classifyOverdue("REVISION_SUBMITTED");
    expect(result.overdueOwner).toBe("RESEARCHER");
    expect(result.overdueOwnerRole).toBe("REVIEWER_GROUP");
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

  it("classifies reviewer tasks as reviewer group", () => {
    const result = classifyOverdue("UNDER_REVIEW", {
      isReviewerTask: true,
      hasActionableAssignee: true,
      hasRoutingMetadata: true,
    });
    expect(result.overdueOwnerRole).toBe("REVIEWER_GROUP");
  });

  it("classifies endorsement tasks as reviewer group", () => {
    const result = classifyOverdue("UNDER_REVIEW", {
      isEndorsementTask: true,
      hasActionableAssignee: true,
      hasRoutingMetadata: true,
    });
    expect(result.overdueOwnerRole).toBe("REVIEWER_GROUP");
  });

  it("classifies pre-review statuses as staff ownership", () => {
    const result = classifyOverdue("RECEIVED");
    expect(result.overdueOwnerRole).toBe("RESEARCH_ASSOCIATE_PROCESSING_STAFF");
    expect(result.overdueOwnerLabel).toBe("Staff");
  });

  it("classifies chair-gate status as chairperson ownership", () => {
    const result = classifyOverdue("UNDER_CLASSIFICATION", {
      hasChairGate: true,
    });
    expect(result.overdueOwnerRole).toBe("COMMITTEE_CHAIRPERSON_DESIGNATE");
    expect(result.overdueOwnerLabel).toBe("Chairperson");
  });

  it("classifies missing assignee/routing metadata as unassigned process gap", () => {
    const result = classifyOverdue("UNDER_REVIEW", {
      hasActionableAssignee: false,
      hasRoutingMetadata: false,
    });
    expect(result.overdueOwnerRole).toBe("UNASSIGNED_PROCESS_GAP");
    expect(result.overdueOwnerLabel).toBe("Unassigned");
  });

  it("handles unknown status gracefully", () => {
    const result = classifyOverdue("UNKNOWN_STATUS");
    expect(result.overdueOwner).toBe("PANEL");
    expect(result.overdueReason).toBe("Status: UNKNOWN_STATUS");
    expect(result.overdueOwnerRole).toBe("RESEARCH_ASSOCIATE_PROCESSING_STAFF");
  });
});
