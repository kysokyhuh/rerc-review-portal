const ROLE_LABELS: Record<string, string> = {
  CHAIR: "Chair",
  ADMIN: "Admin",
  RESEARCH_ASSOCIATE: "Research Associate",
  RESEARCH_ASSISTANT: "Research Assistant",
  REVIEWER: "Reviewer",
  MEMBER: "Member",
};

const hasAnyRole = (roles: string[] = [], allowedRoles: string[]) =>
  roles.some((role) => allowedRoles.includes(role));

export const getRoleLabel = (role?: string | null) =>
  role ? ROLE_LABELS[role] ?? role.replace(/_/g, " ") : "User";

export const getPrimaryRoleLabel = (roles: string[] = []) =>
  getRoleLabel(roles[0]);

export const getRoleCapabilities = (roles: string[] = []) => {
  const isChair = roles.includes("CHAIR");
  const isAdmin = roles.includes("ADMIN");
  const isResearchAssociate = roles.includes("RESEARCH_ASSOCIATE");
  const canOperateProtocols = isChair || isResearchAssociate;
  const canAdministerAccounts = isChair || isAdmin;

  return {
    isChair,
    isAdmin,
    isResearchAssociate,
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
    canResetPasswords: canAdministerAccounts,
    hasAnyRole: (allowedRoles: string[]) => hasAnyRole(roles, allowedRoles),
  };
};
