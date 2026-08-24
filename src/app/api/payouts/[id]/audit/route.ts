import { NextRequest, NextResponse } from "next/server";
import { getPayoutRunById, listAuditEventsForRun } from "@/lib/db";

const WORKSPACE_COOKIE = "tiba_session";
const WORKSPACE_VALUE = "design-partner";

function requireSession(req: NextRequest) {
  const session = req.cookies.get(WORKSPACE_COOKIE)?.value;
  if (session !== WORKSPACE_VALUE) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireSession(req);
  if (denied) return denied;

  const { id } = await params;
  const run = getPayoutRunById(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const audit = listAuditEventsForRun(id);
  return NextResponse.json({ run: id, audit });
}
