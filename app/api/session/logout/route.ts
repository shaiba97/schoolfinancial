import { NextResponse } from "next/server";
import { clearSession } from "@/lib/api/session";

export async function POST() {
  await clearSession();
  return NextResponse.json({ success: true });
}
