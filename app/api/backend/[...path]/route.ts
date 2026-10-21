import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000/api";

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const url = `${BACKEND_URL}/${path.join("/")}${req.nextUrl.search}`;

  const token = req.cookies.get("fin_token")?.value;
  const tenant = req.cookies.get("fin_tenant")?.value;
  if (!token || !tenant) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const headers = new Headers();
  headers.set("Accept", req.headers.get("accept") || "application/json");
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("X-Tenant-Id", tenant);
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const body = req.method !== "GET" && req.method !== "HEAD"
    ? await req.text()
    : undefined;

  let res: Response;
  try {
    res = await fetch(url, { method: req.method, headers, body, cache: "no-store" });
  } catch {
    return NextResponse.json({ message: "Finance API is unavailable" }, { status: 502 });
  }

  const buffer = await res.arrayBuffer();
  const outHeaders: Record<string, string> = {
    "Content-Type": res.headers.get("content-type") || "application/json",
  };
  const disposition = res.headers.get("content-disposition");
  if (disposition) outHeaders["Content-Disposition"] = disposition;
  return new NextResponse(buffer, { status: res.status, headers: outHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
