export type SiteRole = "user" | "admin" | "site-owner";

export type ProjectPermission =
  | "view"
  | "edit"
  | "publish"
  | "control-live"
  | "manage-assets"
  | "admin-repair";

export type AdminAccessReason = "support" | "maintenance" | "safety" | "security" | "repair";

export type AdminAccessRecord = {
  id: string;
  adminUserId: string;
  projectId: string;
  reason: AdminAccessReason;
  noticeTiming: "before" | "now" | "after-emergency";
  startedAt: string;
  endedAt?: string;
  changesMade?: boolean;
};

export type SupportTicketStatus = "submitted" | "admin-replied" | "investigating" | "resolved";
export type SupportTicketCategory = "problem" | "help" | "generated-content" | "other";

export type SupportTicket = {
  id: string;
  userId: string;
  projectId: string;
  category: SupportTicketCategory;
  message: string;
  status: SupportTicketStatus;
  adminAccessGranted: boolean;
  createdAt: string;
  updatedAt: string;
};

export function canAdminEnterProject(role: SiteRole) {
  return role === "site-owner" || role === "admin";
}

export function privateAssetBelongsTo(assetOwnerId: string | undefined, userId: string) {
  return Boolean(assetOwnerId && assetOwnerId === userId);
}
