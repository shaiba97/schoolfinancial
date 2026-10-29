import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "https://schoolbackend-7n8a.onrender.com/api";

export async function GET() {
  const store = await cookies();
  const token = store.get("fin_token")?.value;
  const tenant = store.get("fin_tenant")?.value;
  if (!token || !tenant) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL}/finance/dashboard/socket-ticket`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-Tenant-Id": tenant,
      },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ message: "Finance API is unavailable" }, { status: 502 });
  }
  if (!upstream.ok) {
    const data = await upstream.json().catch(() => undefined);
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message: unknown }).message)
        : "Could not issue a socket ticket";
    return NextResponse.json({ message }, { status: upstream.status });
  }
  return NextResponse.json(await upstream.json());
}
