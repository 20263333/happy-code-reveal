/** Inputs must come from authenticated server queries, never browser claims. */
export function ownerRoleMatchesCompany(role: string | null, actualCompanyId: string | null, requestedCompanyId: string): boolean {
  return role === "owner" && actualCompanyId !== null && actualCompanyId === requestedCompanyId;
}