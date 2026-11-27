/** Read-only parts lookup is available to every staff role that works with parts. */
export const PARTS_LOOKUP_ROLES = ["admin", "management", "technician"];

/** UI capability only; database functions independently validate the signed-in user's roles. */
export function canManageInventory(roles: readonly string[]): boolean {
  return roles.includes("management") || roles.includes("inventory");
}