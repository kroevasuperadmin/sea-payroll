import { NextRequest, NextResponse } from "next/server";
import {
  approvePayoutRun,
  createAuditEvent,
  getPayoutRunById,
  getPayoutRowsForRun,
  getRecipientById,
  updatePayoutRow,
  updatePayoutRunStatus,
} from "@/lib/db";
import { submitPayoutInstructions } from "@/lib/partner-adapter";
import { submitUsdcPayout } from "@/lib/usdc-adapter";

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
  createAuditEvent({
    runId: id,
    eventType: "run_approved",
    actor: "employer-console",
    payload: {
      approvedAt: approved.approvedAt,
      approvedBy: "design-partner",
      filename: approved.filename,
      totalAmount: approved.totalAmount,
    },
  });

  // Submit bank/e-wallet instructions to the sandbox licensed-partner adapter.
  await submitPayoutInstructions(id);

  // USDC rows stay on the Tiba side and use the existing Solana module as a
  // clearly marked demo/proof-of-concept settlement path.
  const rows = getPayoutRowsForRun(id);
  const usdcRows = rows.filter(
    (r) => r.status === "approved" && r.rail === "usdc"
  );

  if (usdcRows.length > 0) {
    const usdcInstructions = [];
    for (const row of usdcRows) {
      const recipient = row.recipientId
        ? getRecipientById(row.recipientId)
        : null;
      if (recipient?.usdcAddress) {
        usdcInstructions.push({
          workerRef: row.workerRef,
          amount: row.amount,
          usdcAddress: recipient.usdcAddress,
        });
      }
    }

    if (usdcInstructions.length > 0) {
      const usdcResult = await submitUsdcPayout(usdcInstructions, id);
      for (const inst of usdcInstructions) {
        const row = usdcRows.find((r) => r.workerRef === inst.workerRef);
        if (!row) continue;
        const previousStatus = row.status;

        if (usdcResult.status === "paid" || usdcResult.status === "demo_paid") {
          updatePayoutRow(row.id, {
            status: "paid",
            partnerInstructionId: `USDC:${usdcResult.signature}`,
            partnerStatus: usdcResult.demo ? "demo_paid" : "paid",
            reason: usdcResult.demo
              ? `USDC demo settlement: ${usdcResult.signature}`
              : `USDC settled: ${usdcResult.signature}`,
          });
          createAuditEvent({
            runId: id,
            rowId: row.id,
            eventType: "row_status_changed",
            actor: "tiba-usdc-adapter",
            payload: {
              from: previousStatus,
              to: "paid",
              demo: usdcResult.demo,
              signature: usdcResult.signature,
            },
          });
        } else {
          updatePayoutRow(row.id, {
            status: "failed",
            reason: `USDC settlement failed: ${usdcResult.error ?? "unknown"}`,
          });
          createAuditEvent({
            runId: id,
            rowId: row.id,
            eventType: "row_status_changed",
            actor: "tiba-usdc-adapter",
            payload: { from: previousStatus, to: "failed", error: usdcResult.error },
          });
        }
      }
    }
  }

  // Close the run if nothing is still pending or approved.
  const finalRows = getPayoutRowsForRun(id);
  const stillActive = finalRows.some(
    (r) =>
      r.status === "approved" ||
      r.status === "submitted" ||
      r.status === "ready"
  );

  if (!stillActive) {
    updatePayoutRunStatus(id, "completed", {
      completedAt: new Date().toISOString(),
    });
    createAuditEvent({
      runId: id,
      eventType: "run_completed",
      actor: "tiba-orchestrator",
      payload: { completedAt: new Date().toISOString() },
    });
  }

  const finalRun = getPayoutRunById(id);
  const updatedRows = getPayoutRowsForRun(id);
  const readyCount = updatedRows.filter(
    (r) => r.status === "paid" || r.status === "submitted"
  ).length;
  const heldCount = updatedRows.length - readyCount;

  return NextResponse.json({
    run: finalRun,
    rows: updatedRows,
    summary: {
      approved: readyCount,
      held: heldCount,
    },
  });
}
