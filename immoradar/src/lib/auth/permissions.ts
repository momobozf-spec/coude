import type { Role } from "@/generated/prisma/enums";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

/**
 * Tenant context: everything the data layer needs to scope a query.
 * A PLATFORM_ADMIN may act on any agency but must choose one explicitly.
 */
export interface TenantContext {
  userId: string;
  role: Role;
  agencyId: string;
}

export interface ActorLike {
  id: string;
  role: Role;
  agencyId: string | null;
}

export type Permission =
  | "opportunity:read"
  | "opportunity:write"
  | "opportunity:assign"
  | "crm:read"
  | "crm:import"
  | "crm:delete"
  | "territory:read"
  | "territory:write"
  | "analytics:read"
  | "settings:read"
  | "settings:write"
  | "users:manage"
  | "platform:admin";

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  PLATFORM_ADMIN: new Set<Permission>([
    "opportunity:read",
    "opportunity:write",
    "opportunity:assign",
    "crm:read",
    "crm:import",
    "crm:delete",
    "territory:read",
    "territory:write",
    "analytics:read",
    "settings:read",
    "settings:write",
    "users:manage",
    "platform:admin",
  ]),
  AGENCY_ADMIN: new Set<Permission>([
    "opportunity:read",
    "opportunity:write",
    "opportunity:assign",
    "crm:read",
    "crm:import",
    "crm:delete",
    "territory:read",
    "territory:write",
    "analytics:read",
    "settings:read",
    "settings:write",
    "users:manage",
  ]),
  AGENT: new Set<Permission>([
    "opportunity:read",
    "opportunity:write",
    "crm:read",
    "territory:read",
    "analytics:read",
    "settings:read",
  ]),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function assertPermission(actor: ActorLike | null, permission: Permission): asserts actor is ActorLike {
  if (!actor) throw new UnauthorizedError();
  if (!hasPermission(actor.role, permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
}

/**
 * Build a tenant context for an actor. Agency users are always bound to their
 * own agency (any requested agencyId is ignored, never trusted). Platform
 * admins may specify the agency they act on.
 */
export function tenantContextFor(actor: ActorLike | null, requestedAgencyId?: string | null): TenantContext {
  if (!actor) throw new UnauthorizedError();
  if (actor.role === "PLATFORM_ADMIN") {
    const agencyId = requestedAgencyId ?? actor.agencyId;
    if (!agencyId) throw new ForbiddenError("Platform admin must select an agency context");
    return { userId: actor.id, role: actor.role, agencyId };
  }
  if (!actor.agencyId) throw new ForbiddenError("User is not attached to an agency");
  return { userId: actor.id, role: actor.role, agencyId: actor.agencyId };
}

/** Throws unless the entity's agencyId equals the tenant's agencyId. */
export function assertSameTenant(ctx: TenantContext, entity: { agencyId: string | null | undefined } | null): void {
  if (!entity || entity.agencyId !== ctx.agencyId) {
    // Deliberately a NotFound-like 403 to avoid leaking existence across tenants.
    throw new ForbiddenError("Resource does not belong to your agency");
  }
}
