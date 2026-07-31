/**
 * Shared helpers for matching a logged-in technician against a service's
 * technician field, which is a comma-separated list of assigned names.
 */

const norm = (v: string) => v.trim().toLowerCase();

export const technicianNames = (value?: string | null): string[] =>
  (value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** True when `name` (full name or username) appears in the service's technician list. */
export const isAssignedTo = (
  technicianField: string | null | undefined,
  ...identities: (string | null | undefined)[]
): boolean => {
  const list = technicianNames(technicianField).map(norm);
  if (list.length === 0) return false;
  return identities
    .filter((i): i is string => !!i && i.trim().length > 0)
    .some((i) => list.includes(norm(i)));
};

/** Filters a service list down to the ones assigned to the given identities. */
export const filterAssigned = <T extends { technician?: string | null }>(
  services: T[],
  ...identities: (string | null | undefined)[]
): T[] => services.filter((s) => isAssignedTo(s.technician, ...identities));
