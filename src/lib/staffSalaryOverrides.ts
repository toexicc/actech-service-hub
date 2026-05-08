const STORAGE_KEY = "actech_staff_salary_overrides";
const TYPE_STORAGE_KEY = "actech_staff_salary_type_overrides";

type StringMap = Record<string, string>;

const cleanSalary = (value?: string | number) => {
  const amount = parseFloat(String(value ?? "").replace(/[^0-9.\-]/g, ""));
  return amount > 0 ? String(amount) : "";
};

const storageAvailable = () => typeof window !== "undefined" && !!window.localStorage;

const readMap = (key: string): StringMap => {
  if (!storageAvailable()) return {};
  try {
    return JSON.parse(window.localStorage.getItem(key) || "{}") as StringMap;
  } catch {
    return {};
  }
};

const writeMap = (key: string, map: StringMap) => {
  if (!storageAvailable()) return;
  window.localStorage.setItem(key, JSON.stringify(map));
};

const keysForStaff = (staff: { staffId?: string; username?: string }) =>
  [staff.staffId, staff.username].filter(Boolean) as string[];

export const getStaffSalaryOverride = (staff: { staffId?: string; username?: string }) => {
  const overrides = readMap(STORAGE_KEY);
  return keysForStaff(staff).map((key) => overrides[key]).find(Boolean) || "";
};

export const getStaffSalaryTypeOverride = (staff: { staffId?: string; username?: string }) => {
  const overrides = readMap(TYPE_STORAGE_KEY);
  return keysForStaff(staff).map((key) => overrides[key]).find(Boolean) || "";
};

export const rememberStaffSalary = (
  staff: { staffId?: string; username?: string },
  salary?: string | number,
  salaryType?: string,
) => {
  const cleaned = cleanSalary(salary);
  const overrides = readMap(STORAGE_KEY);
  const typeOverrides = readMap(TYPE_STORAGE_KEY);
  for (const key of keysForStaff(staff)) {
    if (cleaned) overrides[key] = cleaned;
    else delete overrides[key];
    if (salaryType) typeOverrides[key] = salaryType;
    else if (salaryType === "") delete typeOverrides[key];
  }
  writeMap(STORAGE_KEY, overrides);
  writeMap(TYPE_STORAGE_KEY, typeOverrides);
};

export const applyStaffSalaryOverride = <T extends { staffId?: string; username?: string; salary?: string; salaryType?: string }>(staff: T): T => {
  const sheetType = (staff.salaryType || "").toString().trim().toLowerCase();
  const sheetSalary = cleanSalary(staff.salary);

  // If sheet has authoritative salary type, trust it
  if (sheetType === "fixed" || sheetType === "service-based" || sheetType === "service based") {
    const normalizedType = sheetType === "fixed" ? "fixed" : "service-based";
    rememberStaffSalary(staff, sheetSalary, normalizedType);
    return { ...staff, salary: normalizedType === "fixed" ? sheetSalary : "", salaryType: normalizedType };
  }

  // Fallback to local override
  const overrideType = getStaffSalaryTypeOverride(staff);
  const overrideSalary = getStaffSalaryOverride(staff);

  if (overrideType === "fixed") {
    return { ...staff, salary: overrideSalary || sheetSalary || "", salaryType: "fixed" };
  }
  if (overrideType === "service-based") {
    return { ...staff, salary: "", salaryType: "service-based" };
  }

  // Last resort: infer from salary value
  if (sheetSalary) {
    return { ...staff, salary: sheetSalary, salaryType: "fixed" };
  }
  return { ...staff, salary: "", salaryType: "service-based" };
};
