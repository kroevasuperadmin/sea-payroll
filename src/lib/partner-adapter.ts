import { randomUUID } from "node:crypto";
import {
  getDb,
  getPayoutRunById,
  getPayoutRowsForRun,
  updatePayoutRow,
  updatePayoutRunStatus,
  createAuditEvent,
  getRecipientById,
  type PayoutRow,
  type PayoutRun,
} from "./db";

export type PartnerStatus =
  | "accepted"
  | "processing"
  | "paid"
  | "failed"
  | "returned";

export type PartnerRail = "bank" | "ewallet";

export interface PartnerPayoutInstruction {
  workerRef: string;
  instructionId: string;
  partnerBatchId: string;
  rail: PartnerRail;
  amount: string;
  currency: string;
  destinationCountry: string;
  bankName?: string;
  accountNumber?: string;
  ewalletProvider?: string;
  ewalletIdentifier?: string;
}

export interface PartnerSubmissionResult {
  accepted: {
    workerRef: string;
    instructionId: string;
    partnerBatchId: string;
    status: PartnerStatus;
  }[];
  rejected: { workerRef: string; reason: string }[];
  partnerBatchId: string;
}

export interface PartnerStatusUpdate {
  instructionId: string;
  workerRef: string;
  partnerBatchId: string;
  status: PartnerStatus;
  reason?: string;
}

export interface PartnerAdapter {
  name: string;
  submitInstructions(
    batchId: string,
    instructions: Omit<
      PartnerPayoutInstruction,
      "partnerBatchId" | "status" | "instructionId"
    >[]
  ): Promise<PartnerSubmissionResult>;
  checkStatus(
    batchId: string,
    instructionIds: string[]
  ): Promise<PartnerStatusUpdate[]>;
}

function hashToPercentile(id: string): number {
  // Simple deterministic 0-100 value from a string, used for consistent
  // sandbox failures on repeat status checks.
  return [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 101;
}

class SandboxPartnerAdapter implements PartnerAdapter {
  name = "sandbox-indonesian-payout";

  async submitInstructions(
    batchId: string,
    instructions: Omit<
      PartnerPayoutInstruction,
      "partnerBatchId" | "status" | "instructionId"
    >[]
  ): Promise<PartnerSubmissionResult> {
    const db = getDb();
    const accepted: PartnerSubmissionResult["accepted"] = [];
    const rejected: PartnerSubmissionResult["rejected"] = [];
    const submittedAt = new Date().toISOString();

    for (const inst of instructions) {
      if (inst.rail === "bank" && !inst.accountNumber) {
        rejected.push({
          workerRef: inst.workerRef,
          reason: "Partner rejected: bank account number required.",
        });
        continue;
      }
      if (inst.rail === "ewallet" && !inst.ewalletIdentifier) {
        rejected.push({
          workerRef: inst.workerRef,
          reason: "Partner rejected: e-wallet identifier required.",
        });
        continue;
      }

      const instructionId = `sandbox-${randomUUID()}`;
      db.prepare(
        `INSERT INTO partner_submissions
         (instruction_id, batch_id, worker_ref, status, submitted_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(instructionId, batchId, inst.workerRef, "accepted", submittedAt, submittedAt);

      accepted.push({
        workerRef: inst.workerRef,
        instructionId,
        partnerBatchId: batchId,
        status: "accepted",
      });
    }

    return { accepted, rejected, partnerBatchId: batchId };
  }

  async checkStatus(
    _batchId: string,
    instructionIds: string[]
  ): Promise<PartnerStatusUpdate[]> {
    const db = getDb();
    const results: PartnerStatusUpdate[] = [];

    for (const id of instructionIds) {
      const row = db
        .prepare("SELECT * FROM partner_submissions WHERE instruction_id = ?")
        .get(id) as Record<string, unknown> | undefined;

      if (!row) {
        results.push({
          instructionId: id,
          workerRef: "",
          partnerBatchId: "",
          status: "failed",
          reason: "Instruction not found at partner.",
        });
        continue;
      }

      const submittedAt = new Date(row.submitted_at as string).getTime();
      const elapsed = (Date.now() - submittedAt) / 1000;
      const instructionId = row.instruction_id as string;
      const workerRef = row.worker_ref as string;
      const batchId = row.batch_id as string;
      let status: PartnerStatus = row.status as PartnerStatus;

      if (status === "accepted" && elapsed > 4) {
        status = "processing";
      } else if (status === "processing" && elapsed > 10) {
        // ~15% of instructions fail after processing; the rest pay.
        status = hashToPercentile(instructionId) < 15 ? "failed" : "paid";
      }

      if (status !== row.status) {
        db.prepare(
          "UPDATE partner_submissions SET status = ?, updated_at = datetime('now') WHERE instruction_id = ?"
        ).run(status, instructionId);
      }

      const reason =
        status === "failed"
          ? "Simulated partner failure: beneficiary account could not be credited."
          : status === "paid"
          ? "Partner confirmed successful payout."
          : undefined;

      results.push({
        instructionId,
        workerRef,
        partnerBatchId: batchId,
        status,
        reason,
      });
    }

    return results;
  }
}

export const sandboxAdapter: PartnerAdapter = new SandboxPartnerAdapter();

export function batchIdForRun(runId: string): string {
  return `tiba-${runId}`;
}

export async function submitPayoutInstructions(
  runId: string
): Promise<PartnerSubmissionResult> {
  const run = getPayoutRunById(runId);
  if (!run) throw new Error("Run not found");

  const rows = getPayoutRowsForRun(runId).filter(
    (r) => r.status === "approved" && (r.rail === "bank" || r.rail === "ewallet")
  );

  const instructions: Omit<
    PartnerPayoutInstruction,
    "partnerBatchId" | "status" | "instructionId"
  >[] = [];

  for (const row of rows) {
    const recipient = row.recipientId ? getRecipientById(row.recipientId) : null;
    if (!recipient) {
      // Should not happen after classification, but guard anyway.
      continue;
    }
    instructions.push({
      workerRef: row.workerRef,
      rail: row.rail as PartnerRail,
      amount: row.amount,
      currency: row.currency,
      destinationCountry: row.destinationCountry,
      bankName: recipient.bankName ?? undefined,
      accountNumber: recipient.accountNumber ?? undefined,
      ewalletProvider: recipient.ewalletProvider ?? undefined,
      ewalletIdentifier: recipient.ewalletIdentifier ?? undefined,
    });
  }

  const batchId = batchIdForRun(runId);
  const result = await sandboxAdapter.submitInstructions(batchId, instructions);

  for (const accepted of result.accepted) {
    const row = rows.find((r) => r.workerRef === accepted.workerRef);
    if (!row) continue;
    updatePayoutRow(row.id, {
      partnerInstructionId: accepted.instructionId,
      partnerStatus: accepted.status,
      status: "submitted",
    });
    createAuditEvent({
      runId: run.id,
      rowId: row.id,
      eventType: "partner_submitted",
      actor: "tiba-sandbox-adapter",
      payload: {
        partnerInstructionId: accepted.instructionId,
        partnerBatchId: accepted.partnerBatchId,
        rail: row.rail,
        amount: row.amount,
        currency: row.currency,
      },
    });
  }

  for (const rejected of result.rejected) {
    const row = rows.find((r) => r.workerRef === rejected.workerRef);
    if (!row) continue;
    const previousStatus = row.status;
    updatePayoutRow(row.id, {
      status: "failed",
      reason: rejected.reason,
      partnerStatus: "rejected",
    });
    createAuditEvent({
      runId: run.id,
      rowId: row.id,
      eventType: "row_status_changed",
      actor: "tiba-sandbox-adapter",
      payload: {
        from: previousStatus,
        to: "failed",
        reason: rejected.reason,
      },
    });
  }

  if (result.accepted.length > 0) {
    updatePayoutRunStatus(runId, "submitted", {
      submittedAt: new Date().toISOString(),
    });
    createAuditEvent({
      runId: run.id,
      eventType: "run_submitted",
      actor: "tiba-sandbox-adapter",
      payload: {
        partnerBatchId: result.partnerBatchId,
        acceptedCount: result.accepted.length,
        rejectedCount: result.rejected.length,
      },
    });
  }

  return result;
}

export async function pollPartnerStatus(runId: string): Promise<{
  run: PayoutRun;
  updates: PartnerStatusUpdate[];
}> {
  const run = getPayoutRunById(runId);
  if (!run) throw new Error("Run not found");

  const rows = getPayoutRowsForRun(runId).filter(
    (r) => r.partnerInstructionId && (r.rail === "bank" || r.rail === "ewallet")
  );

  const instructionIds = rows.map((r) => r.partnerInstructionId!);
  const updates = await sandboxAdapter.checkStatus(
    batchIdForRun(runId),
    instructionIds
  );

  let changed = false;
  for (const update of updates) {
    const row = rows.find((r) => r.partnerInstructionId === update.instructionId);
    if (!row) continue;

    if (update.status !== (row.partnerStatus as PartnerStatus | null)) {
      changed = true;
      const previousPartnerStatus = row.partnerStatus ?? "unknown";
      const newRowStatus: PayoutRow["status"] =
        update.status === "paid"
          ? "paid"
          : update.status === "failed" || update.status === "returned"
          ? "failed"
          : update.status === "processing"
          ? "submitted"
          : "submitted";

      if (newRowStatus !== row.status) {
        updatePayoutRow(row.id, {
          status: newRowStatus,
          partnerStatus: update.status,
          reason:
            update.reason ??
            `Partner status changed from ${previousPartnerStatus} to ${update.status}.`,
        });
        createAuditEvent({
          runId: run.id,
          rowId: row.id,
          eventType: "row_status_changed",
          actor: "tiba-sandbox-adapter",
          payload: {
            from: row.status,
            to: newRowStatus,
            partnerStatus: update.status,
            reason: update.reason,
          },
        });
      } else {
        updatePayoutRow(row.id, {
          partnerStatus: update.status,
          reason:
            update.reason ??
            `Partner status changed from ${previousPartnerStatus} to ${update.status}.`,
        });
      }
    }
  }

  // Complete the run once every partner row has reached a terminal state.
  const allRows = getPayoutRowsForRun(runId);
  const unfinished = allRows.filter(
    (r) =>
      r.rail !== "usdc" &&
      r.partnerInstructionId &&
      r.partnerStatus !== "paid" &&
      r.partnerStatus !== "failed" &&
      r.partnerStatus !== "returned"
  );

  if (
    changed &&
    run.status === "submitted" &&
    unfinished.length === 0
  ) {
    updatePayoutRunStatus(runId, "completed", {
      completedAt: new Date().toISOString(),
    });
    createAuditEvent({
      runId: run.id,
      eventType: "run_completed",
      actor: "tiba-sandbox-adapter",
      payload: {
        completedAt: new Date().toISOString(),
      },
    });
  }

  createAuditEvent({
    runId: run.id,
    eventType: "partner_status_polled",
    actor: "tiba-sandbox-adapter",
    payload: { instructionCount: instructionIds.length, changed },
  });

  return { run: getPayoutRunById(runId)!, updates };
}
