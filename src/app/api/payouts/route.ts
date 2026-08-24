import { NextRequest, NextResponse } from "next/server";
import {
  createAuditEvent,
  createPayoutRow,
  createPayoutRun,
  getPayoutRunById,
  getPayoutRowsForRun,
  listPayoutRuns,
  type CreatePayoutRowInput,
  type PayoutRow,
  type PayoutRun,
} from "@/lib/db";
import { parseCsvPayouts } from "@/lib/csv";
import { classifyRow } from "@/lib/rules";

const WORKSPACE_COOKIE = "tiba_session";
const WORKSPACE_VALUE = "design-partner";

function requireSession(req: NextRequest) {
  const session = req.cookies.get(WORKSPACE_COOKIE)?.value;
  if (session !== WORKSPACE_VALUE) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return null;
}

function summarizeRun(run: {
  id: string;
  status: string;
  totalAmount: string | null;
  period: string;
  currency: string;
  filename: string;
  createdAt: string;
  rows?: PayoutRow[];
}) {
  const counts = { ready: 0, needs_action: 0, blocked: 0, other: 0 };
  for (const row of run.rows ?? []) {
    if (row.status === "ready") counts.ready++;
    else if (row.status === "needs_action") counts.needs_action++;
    else if (row.status === "blocked") counts.blocked++;
    else counts.other++;
  }
  return {
    id: run.id,
    filename: run.filename,
    period: run.period,
    currency: run.currency,
    status: run.status,
    totalAmount: run.totalAmount,
    counts,
    createdAt: run.createdAt,
  };
}

export function GET(req: NextRequest) {
  const denied = requireSession(req);
  if (denied) return denied;

  const runs = listPayoutRuns().map((run) =>
    summarizeRun({ ...run, rows: getPayoutRowsForRun(run.id) })
  );
  return NextResponse.json({ runs });
}

export async function POST(req: NextRequest) {
  const denied = requireSession(req);
  if (denied) return denied;

  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const filename = file.name;
  const csvText = await file.text();

  let parsedRows: ReturnType<typeof parseCsvPayouts>;
  try {
    parsedRows = parseCsvPayouts(csvText);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `CSV parse error: ${message}` },
      { status: 400 }
    );
  }

  if (parsedRows.length === 0) {
    return NextResponse.json(
      { error: "CSV contained no rows" },
      { status: 400 }
    );
  }

  const currency = (parsedRows[0]?.currency ?? "USD").toUpperCase();
  const period = parsedRows[0]?.payout_period ?? "unknown";
  const totalAmount = parsedRows
    .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
    .toFixed(2);

  const db = (await import("@/lib/db")).getDb();
  db.prepare("BEGIN").run();

  let run: PayoutRun;
  try {
    run = createPayoutRun({
      filename,
      period,
      currency,
      totalAmount,
    });

    createAuditEvent({
      runId: run.id,
      eventType: "file_uploaded",
      actor: "employer-console",
      payload: {
        filename,
        period,
        currency,
        totalAmount,
        rowCount: parsedRows.length,
      },
    });

    const classified: CreatePayoutRowInput[] = await Promise.all(
      parsedRows.map((row) => classifyRow(row, parsedRows, run.id))
    );

    for (const rowInput of classified) {
      const row = createPayoutRow(rowInput);
      createAuditEvent({
        runId: run.id,
        rowId: row.id,
        eventType: "row_classified",
        actor: "tiba-rules-engine",
        payload: {
          workerRef: row.workerRef,
          status: row.status,
          reason: row.reason,
          rail: row.rail,
          amount: row.amount,
          currency: row.currency,
        },
      });
    }

    db.prepare("COMMIT").run();
  } catch (err) {
    db.prepare("ROLLBACK").run();
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to create payout run: ${message}` },
      { status: 500 }
    );
  }

  const rows = getPayoutRowsForRun(run.id);
  return NextResponse.json(
    { run: summarizeRun({ ...run, rows }), rows },
    { status: 201 }
  );
}
