import { NextRequest, NextResponse } from "next/server";
import { approvePayoutRun, getPayoutRunById, getPayoutRowsForRun } from "@/lib/db";

const WORKSPACE_COOKIE = "tiba_session";
const WORKSPACE_VALUE = "design-partner";

function requireSession(req: NextRequest) {
  const session = req.cookies.get(WORKSPACE_COOKIE)?.value;
  if (session !== WORKSPACE_VALUE) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return null;
}

export async function POST(
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
  if (run.status !== "draft") {
    return NextResponse.json(
      { error: `Run already ${run.status}` },
      { status: 400 }
    );
  }

  const approved = approvePayoutRun(id);
  const rows = getPayoutRowsForRun(id);
  const readyCount = rows.filter((r) => r.status === "approved").length;
  const heldCount = rows.length - readyCount;

  return NextResponse.json({
    run: approved,
    rows,
    summary: {
      approved: readyCount,
      held: heldCount,
    },
  });
}
