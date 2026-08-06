export const CONDITION_LABELS: { key: string; label: string }[] = [
  { key: "dents", label: "Dents" },
  { key: "scratches", label: "Scratches" },
  { key: "missingParts", label: "Missing Parts" },
  { key: "physicalDamage", label: "Physical Damage" },
  { key: "importantFiles", label: "Important Files" },
  { key: "noPower", label: "No Power" },
  { key: "repairHistory", label: "Repair History" },
];

const isYes = (value: any) => {
  if (value === true || value === 1) return true;
  const v = typeof value === "string" ? value.trim().toLowerCase() : value;
  return v === "yes" || v === "true" || v === "y" || v === "✓" || v === "checked" || v === "1";
};

/**
 * Build the readable device-conditions list from a service record. Supports both
 * the `conditions` JSON object and legacy flat keys.
 */
export const describeDeviceConditions = (serviceData: any): string => {
  const conditions = (serviceData?.conditions && typeof serviceData.conditions === "object")
    ? serviceData.conditions
    : {};
  const active = CONDITION_LABELS.filter(
    ({ key }) => isYes(conditions[key]) || isYes(serviceData?.[key]),
  ).map(({ label }) => label);
  return active.length > 0 ? active.join(", ") : "N/A";
};
