export type TenantLockNotice = {
  code: "TENANT_LOCKED";
  message: string;
  schoolName: string;
  lockedAt: string | null;
  reason: string | null;
};

/** Event the API client dispatches when the backend refuses a locked school. */
export const TENANT_LOCK_EVENT = "school:locked";

let current: TenantLockNotice | null = null;

/**
 * Reads a locked-school refusal out of a response body. The backend sends a
 * flat body (code TENANT_LOCKED) precisely so this can be read without
 * special-casing NestJS' wrapped error shape.
 */
export function tenantLockFromBody(body: unknown): TenantLockNotice | null {
  if (!body || typeof body !== "object") return null;
  const candidate = body as Record<string, unknown>;
  if (candidate.code !== "TENANT_LOCKED") return null;

  return {
    code: "TENANT_LOCKED",
    message:
      typeof candidate.message === "string"
        ? candidate.message
        : "Access Suspended: this school's license has expired.",
    schoolName:
      typeof candidate.schoolName === "string" ? candidate.schoolName : "This school",
    lockedAt: typeof candidate.lockedAt === "string" ? candidate.lockedAt : null,
    reason: typeof candidate.reason === "string" ? candidate.reason : null,
  };
}

/**
 * Records a lock and tells the portal about it. Called from the API client
 * the moment a request comes back with the lock, so the notice appears
 * wherever the user happens to be.
 */
export function notifyTenantLock(body: unknown): TenantLockNotice | null {
  const notice = tenantLockFromBody(body);
  if (!notice) return null;

  current = notice;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TENANT_LOCK_EVENT, { detail: notice }));
  }
  return notice;
}

/** The lock seen so far, if any. */
export function currentTenantLock(): TenantLockNotice | null {
  return current;
}
