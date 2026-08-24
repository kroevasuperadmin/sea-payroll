import { getPayoutRunById, getPayoutRowsForRun } from "./db";

// STUB: Partner adapter for the licensed Indonesian payout provider.
// This is intentionally not implemented in this slice.
// A real adapter would:
//   1. Map recipient rail details to the partner's bank/e-wallet instruction schema.
//   2. POST the instructions to the partner's sandbox or live API.
//   3. Ingest async status callbacks / poll for state changes.
//   4. Translate partner statuses (accepted, processing, paid, failed, returned)
//      into Tiba RowStatus values.

export interface PartnerPayoutInstruction {
  workerRef: string;
  partnerInstructionId: string;
  rail: "bank" | "ewallet" | "usdc";
  amount: string;
  currency: string;
  destinationCountry: string;
}

export interface PartnerSubmissionResult {
  accepted: PartnerPayoutInstruction[];
  rejected: { workerRef: string; reason: string }[];
  partnerBatchId?: string;
}

export async function submitPayoutInstructions(
  _runId: string
): Promise<PartnerSubmissionResult> {
  // This is a no-op mock. The next slice should replace it with the real
  // partner adapter and KYC provider integration.
  const run = getPayoutRunById(_runId);
  if (!run) {
    throw new Error("Run not found");
  }
  const rows = getPayoutRowsForRun(_runId);
  const accepted: PartnerPayoutInstruction[] = rows
    .filter((r) => r.status === "approved")
    .map((r) => ({
      workerRef: r.workerRef,
      partnerInstructionId: `STUB-${run.id}-${r.id}`,
      rail: r.rail ?? "bank",
      amount: r.amount,
      currency: r.currency,
      destinationCountry: r.destinationCountry,
    }));

  return {
    accepted,
    rejected: [],
    partnerBatchId: `STUB-BATCH-${run.id}`,
  };
}
