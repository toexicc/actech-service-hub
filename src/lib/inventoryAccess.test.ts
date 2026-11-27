import { describe, expect, it } from "vitest";
import { canManageInventory, PARTS_LOOKUP_ROLES } from "./inventoryAccess";

describe("inventory access", () => {
  it("gives Management inventory capabilities without an extra inventory role", () => {
    expect(canManageInventory(["management"])).toBe(true);
    expect(canManageInventory(["management"])).toBe(canManageInventory(["admin", "inventory"]));
  });

  it("includes Management in the parts lookup access list", () => {
    expect(PARTS_LOOKUP_ROLES).toContain("management");
  });

  it("does not grant inventory modifications to ordinary admins, technicians, or delivery staff", () => {
    for (const role of ["admin", "technician", "delivery"]) {
      expect(canManageInventory([role])).toBe(false);
    }
  });
});