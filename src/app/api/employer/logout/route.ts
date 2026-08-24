import { NextResponse } from "next/server";

const WORKSPACE_COOKIE = "tiba_session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(WORKSPACE_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
