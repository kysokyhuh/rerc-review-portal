export const ROLE_LABELS: Record<string, string> = {
  CHAIR: "Chair",
  ADMIN: "Admin",
  RESEARCH_ASSOCIATE: "Research Associate",
  RESEARCH_ASSISTANT: "Research Assistant",
  REVIEWER: "Reviewer",
  MEMBER: "Member",
};

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  CHAIR:
    "Governance lead with account approval, classification, delete/restore, and full protocol oversight.",
  ADMIN:
    "System access administrator for approved accounts and password controls.",
  RESEARCH_ASSOCIATE:
    "Secretariat operator for protocol intake, review workflow, reviewer assignment, reports, and operational follow-through.",
  RESEARCH_ASSISTANT:
    "Assigned-only review support. Can see assigned protocols and submit assigned review decisions.",
  REVIEWER:
    "Assigned reviewer with access limited to assigned submissions.",
  MEMBER:
    "Portal member with limited access.",
};

const hasAnyRole = (roles: string[] = [], allowedRoles: string[]) =>
  roles.some((role) => allowedRoles.includes(role));

export const getRoleLabel = (role?: string | null) =>
  role ? ROLE_LABELS[role] ?? role.replace(/_/g, " ") : "User";

export const getPrimaryRoleLabel = (roles: string[] = []) =>
  getRoleLabel(roles[0]);

export const getRoleDescription = (role?: string | null) =>
  role ? ROLE_DESCRIPTIONS[role] ?? "Portal access is governed by assigned role." : "Portal access is governed by assigned role.";

export const getPrimaryRoleDescription = (roles: string[] = []) =>
  getRoleDescription(roles[0]);

export const getRoleCapabilities = (roles: string[] = []) => {
  const isChair = roles.includes("CHAIR");
  const isAdmin = roles.includes("ADMIN");
  const isResearchAssociate = roles.includes("RESEARCH_ASSOCIATE");
  const isResearchAssistant = roles.includes("RESEARCH_ASSISTANT");
  const isReviewer = roles.includes("REVIEWER");
  const canOperateProtocols = isChair || isResearchAssociate;
  const canAdministerAccounts = isChair || isAdmin;
  const hasAssignedOnlyAccess = isResearchAssistant || isReviewer;

  return {
    isChair,
    isAdmin,
    isResearchAssociate,
    isResearchAssistant,
    isReviewer,
    hasAssignedOnlyAccess,
    canOperateProtocols,
    canAdministerAccounts,
    canManageClassification: isChair,
    canManageCalendar: canOperateProtocols || isAdmin,
    canCreateProtocol: canOperateProtocols,
    canImportProjects: canOperateProtocols,
    canGenerateReports: canOperateProtocols,
    canViewArchives: canOperateProtocols || isAdmin,
    canViewRecentlyDeleted: canAdministerAccounts,
    canBulkAssignReviewers: canOperateProtocols,
    canBulkSendReminders: canOperateProtocols,
    canBulkChangeStatus: canOperateProtocols,
    canBulkDeleteRecords: canAdministerAccounts,
    canEditSubmissionOverview: canOperateProtocols,
    canEditProtocolProfile: canOperateProtocols,
    canSubmitAssignedReview: isResearchAssistant,
    canViewAssignedReviews: hasAssignedOnlyAccess,
    canResetPasswords: canAdministerAccounts,
    hasAnyRole: (allowedRoles: string[]) => hasAnyRole(roles, allowedRoles),
  };
};
