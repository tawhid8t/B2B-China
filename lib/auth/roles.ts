import type { UserRole } from "@/lib/domain/types";

export const dashboardPathByRole: Record<UserRole, string> = {
  client: "/client",
  staff_receiver: "/staff/receiving",
  staff_packer: "/staff/packing",
  admin: "/admin",
  super_admin: "/admin"
};

export const CLIENT_OPERATION_ROLES = ["client", "admin", "super_admin"] as const satisfies readonly UserRole[];
export const RECEIVING_ROLES = ["staff_receiver", "admin", "super_admin"] as const satisfies readonly UserRole[];
export const PACKING_ROLES = ["staff_packer", "admin", "super_admin"] as const satisfies readonly UserRole[];
export const WAREHOUSE_ROLES = ["staff_receiver", "staff_packer", "admin", "super_admin"] as const satisfies readonly UserRole[];
export const ADMIN_ROLES = ["admin", "super_admin"] as const satisfies readonly UserRole[];
export const OWNER_ROLES = ["super_admin"] as const satisfies readonly UserRole[];

const userRoles: readonly UserRole[] = ["client", "staff_receiver", "staff_packer", "admin", "super_admin"];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && userRoles.includes(value as UserRole);
}

export function isRoleAllowed(role: UserRole, allowedRoles: readonly UserRole[]) {
  return allowedRoles.includes(role);
}

export function allowedRolesForPath(pathname: string): readonly UserRole[] | undefined {
  if (pathname === "/client" || pathname.startsWith("/client/")) return ["client"] as const;
  if (pathname === "/staff/receiving" || pathname.startsWith("/staff/receiving/")) return RECEIVING_ROLES;
  if (pathname === "/staff/packing" || pathname.startsWith("/staff/packing/")) return PACKING_ROLES;
  if (pathname === "/staff") return WAREHOUSE_ROLES;
  if (pathname === "/admin/system" || pathname.startsWith("/admin/system/")) return OWNER_ROLES;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return ADMIN_ROLES;
  if (pathname === "/extension" || pathname.startsWith("/extension/")) return ADMIN_ROLES;
  return undefined;
}

export function roleCanAccessPath(role: UserRole, pathname: string) {
  const allowedRoles = allowedRolesForPath(pathname);
  return allowedRoles ? isRoleAllowed(role, allowedRoles) : false;
}
