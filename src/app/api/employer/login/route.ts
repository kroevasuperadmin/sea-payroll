import { NextRequest, NextResponse } from "next/server";

const WORKSPACE_CODE = process.env.TIBA_WORKSPACE_CODE;
const WORKSPACE_COOKIE = "tiba_session";
const WORKSPACE_VALUE = "design-partner";

export async function POST(req: NextRequest) {
  const { code } = (await req.json()) as { code?: string };

  if (!WORKSPACE_CODE || code !== WORKSPACE_CODE) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 401 });
  }

  const res = NextResponse.json({ workspace: WORKSPACE_VALUE });
  res.cookies.set(WORKSPACE_COOKIE, WORKSPACE_VALUE, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
