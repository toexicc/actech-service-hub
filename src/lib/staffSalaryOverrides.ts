const STORAGE_KEY = "actech_staff_salary_overrides";

type SalaryOverrideMap = Record<string, string>;

const cleanSalary = (value?: string | number) => {
  const amount = parseFloat(String(value ?? "").replace(/[^0-9.\-]/g, ""));
  return amount > 0 ? String(amount) : "";
};

const storageAvailable = () => typeof window !== "undefined" && !!window.localStorage;

const readOverrides = (): SalaryOverrideMap => {
  if (!storageAvailable()) return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as SalaryOverrideMap;
  } catch {
    return {};
  }
};

const writeOverrides = (overrides: SalaryOverrideMap) => {
  if (!storageAvailable()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
};

const keysForStaff = (staff: { staffId?: string; username?: string }) =>
  [staff.staffId, staff.username].filter(Boolean) as string[];

export const getStaffSalaryOverride = (staff: { staffId?: string; username?: string }) => {
  const overrides = readOverrides();
  return keysForStaff(staff).map((key) => overrides[key]).find(Boolean) || "";
};

export const rememberStaffSalary = (staff: { staffId?: string; username?: string }, salary?: string | number) => {
  const cleaned = cleanSalary(salary);
  const overrides = readOverrides();
  for (const key of keysForStaff(staff)) {
    if (cleaned) overrides[key] = cleaned;
    else delete overrides[key];
  }
  writeOverrides(overrides);
};

export const applyStaffSalaryOverride = <T extends { staffId?: string; username?: string; salary?: string }>(staff: T): T => {
  const sheetSalary = cleanSalary(staff.salary);
  if (sheetSalary) {
    rememberStaffSalary(staff, sheetSalary);
    return { ...staff, salary: sheetSalary };
  }
  const overrideSalary = getStaffSalaryOverride(staff);
  return overrideSalary ? { ...staff, salary: overrideSalary } : { ...staff, salary: "" };
};