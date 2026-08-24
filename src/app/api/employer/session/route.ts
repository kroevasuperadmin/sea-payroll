import { NextRequest, NextResponse } from "next/server";

const WORKSPACE_COOKIE = "tiba_session";
const WORKSPACE_VALUE = "design-partner";

export function GET(req: NextRequest) {
  const session = req.cookies.get(WORKSPACE_COOKIE)?.value;
  if (session !== WORKSPACE_VALUE) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ workspace: WORKSPACE_VALUE });
}
