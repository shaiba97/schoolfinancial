import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "https://schoolbackend-7n8a.onrender.com/api";

type Membership = {
  tenantId: string;
  status: string;
  tenant: { id: string; name: string };
  roles: Array<{ slug: string }>;
};

type LoginResponse = {
  accessToken: string;
  memberships: Membership[];
};

const FINANCE_ROLES = [
  "ACCOUNTANT",
];

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

function sessionCookies(token: string, tenantId: string) {
  const secure = process.env.NODE_ENV === "production";
  const base = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}${secure ? "; Secure" : ""}`;
  return [
    `fin_token=${encodeURIComponent(token)}; ${base}`,
    `fin_tenant=${encodeURIComponent(tenantId)}; ${base}`,
  ];
}

export async function POST(request: Request) {
  let body: { staffNumber?: string; password?: string; tenantId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
  const staffNumber = body.staffNumber?.trim() ?? "";
  const password = body.password ?? "";
  if (!staffNumber || !password) {
    return NextResponse.json({ message: "Staff ID and password are required" }, { status: 400 });
  }

  const payload: Record<string, string> = { staffNumber, password };
  if (body.tenantId) payload.tenantId = body.tenantId;

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
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
        : "Sign in failed";
    return NextResponse.json({ message }, { status: upstream.status });
  }

  const data = (await upstream.json()) as LoginResponse;
  const financeMemberships = (data.memberships ?? []).filter(
    (m) => m.status === "ACTIVE" && m.roles.some((r) => FINANCE_ROLES.includes(r.slug)),
  );
  if (financeMemberships.length === 0) {
    return NextResponse.json(
      { message: "This account has no financial access" },
      { status: 403 },
    );
  }
  if (financeMemberships.length > 1 && !body.tenantId) {
    return NextResponse.json(
      {
        message: "Select your school",
        tenants: financeMemberships.map((m) => ({ id: m.tenantId, name: m.tenant.name })),
      },
      { status: 409 },
    );
  }
  const membership =
    financeMemberships.find((m) => m.tenantId === body.tenantId) ?? financeMemberships[0];

  const response = NextResponse.json({
    ok: true,
    tenant: { id: membership.tenantId, name: membership.tenant.name },
    roles: membership.roles.map((r) => r.slug),
  });
  for (const cookie of sessionCookies(data.accessToken, membership.tenantId)) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
}
