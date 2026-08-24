import {
  getPayoutRowsByWorkerRef,
  getPayoutRowsByWorkerRefAndPeriod,
  getRecipientByWorkerRef,
  type CreatePayoutRowInput,
  type Recipient,
} from "./db";

const ORIGIN_COUNTRY = process.env.TIBA_ORIGIN_COUNTRY ?? "SG";
const SUPPORTED_CORRIDORS = new Set(["ID"]);
const ALLOWED_CURRENCIES = new Set(["USD", "IDR"]);

export interface ParsedPayoutRow {
  worker_ref: string;
  destination_country: string;
  amount: string;
  currency: string;
  payout_period: string;
  name?: string;
}

function normalizeField(raw: unknown): string {
  if (typeof raw !== "string") return String(raw ?? "").trim();
  return raw.trim();
}

export function parsePayoutRow(record: Record<string, string>): ParsedPayoutRow {
  return {
    worker_ref: normalizeField(record.worker_ref ?? record["worker ref"] ?? record.workerRef ?? record.workerRef),
    destination_country: normalizeField(
      record.destination_country ?? record["destination country"] ?? record.destinationCountry ?? ""
    ),
    amount: normalizeField(record.amount ?? ""),
    currency: normalizeField(record.currency ?? "").toUpperCase(),
    payout_period: normalizeField(record.payout_period ?? record["payout period"] ?? record.payoutPeriod ?? ""),
    name: normalizeField(record.name ?? ""),
  };
}

function isPositiveAmount(value: string): boolean {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return false;
  return parseFloat(value) > 0;
}

function amountToFixed(value: string): string | null {
  const num = parseFloat(value);
  if (Number.isNaN(num) || num <= 0) return null;
  return num.toFixed(2);
}

interface Reason {
  severity: "blocked" | "needs_action";
  text: string;
}

function checkProfile(recipient: Recipient | null, reasons: Reason[]) {
  if (!recipient) {
    reasons.push({
      severity: "needs_action",
      text: "Recipient profile not found. Add or import worker profile.",
    });
    return;
  }

  if (recipient.onHold) {
    reasons.push({
      severity: "blocked",
      text: `Recipient on hold: ${recipient.holdReason ?? "manual review required"}.`,
    });
    return;
  }

  if (recipient.kycStatus !== "verified") {
    reasons.push({
      severity: "needs_action",
      text: `KYC status is "${recipient.kycStatus}"; complete KYC or mark verified before payout.`,
    });
  }

  if (recipient.railPreference === "bank") {
    if (!recipient.bankName || !recipient.accountNumber) {
      reasons.push({
        severity: "needs_action",
        text: "Bank rail selected but bank name or account number is missing.",
      });
    }
  } else if (recipient.railPreference === "ewallet") {
    if (!recipient.ewalletProvider || !recipient.ewalletIdentifier) {
      reasons.push({
        severity: "needs_action",
        text: "E-wallet rail selected but provider or identifier is missing.",
      });
    }
  } else if (recipient.railPreference === "usdc") {
    if (!recipient.usdcAddress) {
      reasons.push({
        severity: "needs_action",
        text: "USDC rail selected but wallet address is missing.",
      });
    }
  }
}

async function checkHistory(
  workerRef: string,
  period: string,
  runId: string,
  reasons: Reason[]
) {
  const priorPeriod = getPayoutRowsByWorkerRefAndPeriod(workerRef, period, runId);
  if (priorPeriod.length > 0) {
    reasons.push({
      severity: "needs_action",
      text: "A payout for this worker and period already exists in a non-cancelled run.",
    });
  }

  const priorRows = getPayoutRowsByWorkerRef(workerRef);
  const hasFailure = priorRows.some(
    (r) => r.status === "failed" || r.status === "returned"
  );
  if (hasFailure) {
    reasons.push({
      severity: "blocked",
      text: "Prior payout for this worker failed or was returned; resolve before retry.",
    });
  }
}

export async function classifyRow(
  row: ParsedPayoutRow,
  allRows: ParsedPayoutRow[],
  runId: string
): Promise<CreatePayoutRowInput> {
  const reasons: Reason[] = [];

  // 1. Required fields and format
  const missing: string[] = [];
  if (!row.worker_ref) missing.push("worker_ref");
  if (!row.destination_country) missing.push("destination_country");
  if (!row.amount) missing.push("amount");
  if (!row.currency) missing.push("currency");
  if (!row.payout_period) missing.push("payout_period");
  if (missing.length > 0) {
    reasons.push({
      severity: "blocked",
      text: `Missing required fields: ${missing.join(", ")}.`,
    });
  }

  if (row.destination_country && !SUPPORTED_CORRIDORS.has(row.destination_country.toUpperCase())) {
    reasons.push({
      severity: "blocked",
      text: `Corridor ${ORIGIN_COUNTRY}→${row.destination_country.toUpperCase()} is not supported.`,
    });
  }

  if (row.amount && !isPositiveAmount(row.amount)) {
    reasons.push({
      severity: "blocked",
      text: `Invalid amount "${row.amount}". Use a positive number with up to 2 decimals.`,
    });
  }

  if (row.currency && !ALLOWED_CURRENCIES.has(row.currency)) {
    reasons.push({
      severity: "blocked",
      text: `Currency "${row.currency}" is not supported in this corridor.`,
    });
  }

  // 2. Duplicate worker_ref within this file
  const duplicates = allRows.filter((r) => r.worker_ref === row.worker_ref).length;
  if (row.worker_ref && duplicates > 1) {
    reasons.push({
      severity: "needs_action",
      text: `Duplicate worker_ref "${row.worker_ref}" appears ${duplicates} times in this file.`,
    });
  }

  // 3. Recipient profile, KYC, rail availability
  const recipient = row.worker_ref ? getRecipientByWorkerRef(row.worker_ref) : null;
  checkProfile(recipient, reasons);

  // 4. Cross-run history: duplicate period + prior failures
  if (row.worker_ref && row.payout_period) {
    await checkHistory(row.worker_ref, row.payout_period, runId, reasons);
  }

  let status: CreatePayoutRowInput["status"];
  let reason: string;
  const blocked = reasons.find((r) => r.severity === "blocked");
  const needsAction = reasons.find((r) => r.severity === "needs_action");

  if (blocked) {
    status = "blocked";
    reason = blocked.text;
  } else if (needsAction) {
    status = "needs_action";
    reason = needsAction.text;
  } else {
    status = "ready";
    reason = `Corridor ${ORIGIN_COUNTRY}→${row.destination_country.toUpperCase()} | ${
      recipient?.railPreference ?? "unknown"
    } rail | KYC verified | no unresolved exceptions.`;
  }

  const rail = recipient?.railPreference ?? null;

  return {
    runId,
    workerRef: row.worker_ref,
    recipientId: recipient?.id ?? null,
    name: row.name || null,
    destinationCountry: (row.destination_country || "ID").toUpperCase(),
    amount: amountToFixed(row.amount) ?? "0.00",
    currency: row.currency || "USD",
    period: row.payout_period,
    rail,
    status,
    reason,
    partnerInstructionId: null,
    partnerStatus: null,
  };
}
