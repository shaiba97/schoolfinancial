import { notifyTenantLock } from "@/lib/tenant-lock";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const message =
      typeof body === "object" && body && "message" in body
        ? String((body as { message: unknown }).message)
        : `Request failed: ${res.status}`;
    notifyTenantLock(body);    throw new ApiError(message, res.status);
  }
  return body as T;
}

export async function financialApiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  if (typeof window === "undefined") {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const token = store.get("fin_token")?.value;
    const tenant = store.get("fin_tenant")?.value;
    if (!token || !tenant) throw new ApiError("Not authenticated", 401);
    const res = await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init?.headers,
        Authorization: `Bearer ${token}`,
        "X-Tenant-Id": tenant,
      },
      cache: "no-store",
    });
    return parseResponse<T>(res);
  }

  const res = await fetch(`/api/backend${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
    credentials: "include",
    cache: "no-store",
  });
  if (res.status === 401 && window.location.pathname !== "/login") {
    window.location.assign("/login");
    throw new ApiError("Session expired — please sign in again", 401);
  }
  return parseResponse<T>(res);
}
