import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const DB_PATH = process.env.TIBA_DB_PATH ?? "dev.db";

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipients (
      id TEXT PRIMARY KEY,
      worker_ref TEXT UNIQUE NOT NULL,
      destination_country TEXT NOT NULL DEFAULT 'ID',
      kyc_status TEXT NOT NULL DEFAULT 'unverified',
      kyc_notes TEXT,
      rail_preference TEXT NOT NULL,
      bank_name TEXT,
      account_number TEXT,
      ewallet_provider TEXT,
      ewallet_identifier TEXT,
      usdc_address TEXT,
      on_hold INTEGER NOT NULL DEFAULT 0,
      hold_reason TEXT,
      consent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payout_runs (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      period TEXT NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      total_amount TEXT,
      approved_at TEXT,
      submitted_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payout_rows (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      worker_ref TEXT NOT NULL,
      recipient_id TEXT,
      name TEXT,
      destination_country TEXT NOT NULL,
      amount TEXT NOT NULL,
      currency TEXT NOT NULL,
      period TEXT NOT NULL,
      rail TEXT,
      status TEXT NOT NULL,
      reason TEXT NOT NULL,
      partner_instruction_id TEXT,
      partner_status TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (run_id) REFERENCES payout_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_id) REFERENCES recipients(id)
    );

    CREATE INDEX IF NOT EXISTS idx_payout_rows_run ON payout_rows(run_id);
    CREATE INDEX IF NOT EXISTS idx_payout_rows_worker ON payout_rows(worker_ref);
  `);
}

function booleanFlag(n: unknown): boolean {
  return n === 1 || n === true;
}

export type KycStatus = "unverified" | "pending" | "verified" | "failed";
export type Rail = "bank" | "ewallet" | "usdc";
export type PayoutStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "submitted"
  | "completed"
  | "cancelled";
export type RowStatus =
  | "ready"
  | "needs_action"
  | "blocked"
  | "approved"
  | "submitted"
  | "paid"
  | "failed"
  | "returned";

export interface Recipient {
  id: string;
  workerRef: string;
  destinationCountry: string;
  kycStatus: KycStatus;
  kycNotes: string | null;
  railPreference: Rail;
  bankName: string | null;
  accountNumber: string | null;
  ewalletProvider: string | null;
  ewalletIdentifier: string | null;
  usdcAddress: string | null;
  onHold: boolean;
  holdReason: string | null;
  consentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutRun {
  id: string;
  filename: string;
  period: string;
  currency: string;
  status: PayoutStatus;
  totalAmount: string | null;
  approvedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutRow {
  id: string;
  runId: string;
  workerRef: string;
  recipientId: string | null;
  name: string | null;
  destinationCountry: string;
  amount: string;
  currency: string;
  period: string;
  rail: Rail | null;
  status: RowStatus;
  reason: string;
  partnerInstructionId: string | null;
  partnerStatus: string | null;
  createdAt: string;
}

function toRecipient(r: Record<string, unknown>): Recipient {
  return {
    id: r.id as string,
    workerRef: r.worker_ref as string,
    destinationCountry: (r.destination_country as string) ?? "ID",
    kycStatus: (r.kyc_status as KycStatus) ?? "unverified",
    kycNotes: (r.kyc_notes as string | null) ?? null,
    railPreference: (r.rail_preference as Rail) ?? "bank",
    bankName: (r.bank_name as string | null) ?? null,
    accountNumber: (r.account_number as string | null) ?? null,
    ewalletProvider: (r.ewallet_provider as string | null) ?? null,
    ewalletIdentifier: (r.ewallet_identifier as string | null) ?? null,
    usdcAddress: (r.usdc_address as string | null) ?? null,
    onHold: booleanFlag(r.on_hold),
    holdReason: (r.hold_reason as string | null) ?? null,
    consentAt: (r.consent_at as string | null) ?? null,
    createdAt: (r.created_at as string) ?? "",
    updatedAt: (r.updated_at as string) ?? "",
  };
}

function toPayoutRun(r: Record<string, unknown>): PayoutRun {
  return {
    id: r.id as string,
    filename: r.filename as string,
    period: r.period as string,
    currency: r.currency as string,
    status: (r.status as PayoutStatus) ?? "draft",
    totalAmount: (r.total_amount as string | null) ?? null,
    approvedAt: (r.approved_at as string | null) ?? null,
    submittedAt: (r.submitted_at as string | null) ?? null,
    completedAt: (r.completed_at as string | null) ?? null,
    createdAt: (r.created_at as string) ?? "",
    updatedAt: (r.updated_at as string) ?? "",
  };
}

function toPayoutRow(r: Record<string, unknown>): PayoutRow {
  return {
    id: r.id as string,
    runId: r.run_id as string,
    workerRef: r.worker_ref as string,
    recipientId: (r.recipient_id as string | null) ?? null,
    name: (r.name as string | null) ?? null,
    destinationCountry: (r.destination_country as string) ?? "ID",
    amount: (r.amount as string) ?? "0",
    currency: (r.currency as string) ?? "",
    period: (r.period as string) ?? "",
    rail: (r.rail as Rail | null) ?? null,
    status: (r.status as RowStatus) ?? "blocked",
    reason: (r.reason as string) ?? "",
    partnerInstructionId: (r.partner_instruction_id as string | null) ?? null,
    partnerStatus: (r.partner_status as string | null) ?? null,
    createdAt: (r.created_at as string) ?? "",
  };
}

export function listRecipients(): Recipient[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM recipients ORDER BY created_at DESC")
    .all() as Record<string, unknown>[];
  return rows.map(toRecipient);
}

export function getRecipientByWorkerRef(workerRef: string): Recipient | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM recipients WHERE worker_ref = ?")
    .get(workerRef) as Record<string, unknown> | undefined;
  return row ? toRecipient(row) : null;
}

export function getRecipientById(id: string): Recipient | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM recipients WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? toRecipient(row) : null;
}

export interface CreateRecipientInput {
  workerRef: string;
  destinationCountry: string;
  kycStatus: KycStatus;
  kycNotes?: string | null;
  railPreference: Rail;
  bankName?: string | null;
  accountNumber?: string | null;
  ewalletProvider?: string | null;
  ewalletIdentifier?: string | null;
  usdcAddress?: string | null;
  onHold?: boolean;
  holdReason?: string | null;
  consentAt?: string | null;
}

export function createRecipient(input: CreateRecipientInput): Recipient {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO recipients (
      id, worker_ref, destination_country, kyc_status, kyc_notes,
      rail_preference, bank_name, account_number, ewallet_provider, ewallet_identifier,
      usdc_address, on_hold, hold_reason, consent_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.workerRef,
    input.destinationCountry || "ID",
    input.kycStatus,
    input.kycNotes ?? null,
    input.railPreference,
    input.bankName ?? null,
    input.accountNumber ?? null,
    input.ewalletProvider ?? null,
    input.ewalletIdentifier ?? null,
    input.usdcAddress ?? null,
    input.onHold ? 1 : 0,
    input.holdReason ?? null,
    input.consentAt ?? null
  );
  const created = getRecipientById(id);
  if (!created) throw new Error("Recipient was not created");
  return created;
}

export function updateRecipient(
  id: string,
  input: Partial<CreateRecipientInput>
): Recipient {
  const db = getDb();
  const current = getRecipientById(id);
  if (!current) throw new Error("Recipient not found");

  db.prepare(
    `UPDATE recipients SET
      worker_ref = ?,
      destination_country = ?,
      kyc_status = ?,
      kyc_notes = ?,
      rail_preference = ?,
      bank_name = ?,
      account_number = ?,
      ewallet_provider = ?,
      ewallet_identifier = ?,
      usdc_address = ?,
      on_hold = ?,
      hold_reason = ?,
      consent_at = ?,
      updated_at = datetime('now')
    WHERE id = ?`
  ).run(
    input.workerRef ?? current.workerRef,
    input.destinationCountry ?? current.destinationCountry,
    input.kycStatus ?? current.kycStatus,
    input.kycNotes ?? current.kycNotes,
    input.railPreference ?? current.railPreference,
    input.bankName ?? current.bankName,
    input.accountNumber ?? current.accountNumber,
    input.ewalletProvider ?? current.ewalletProvider,
    input.ewalletIdentifier ?? current.ewalletIdentifier,
    input.usdcAddress ?? current.usdcAddress,
    (input.onHold ?? current.onHold) ? 1 : 0,
    input.holdReason ?? current.holdReason,
    input.consentAt ?? current.consentAt,
    id
  );

  const updated = getRecipientById(id);
  if (!updated) throw new Error("Recipient not found after update");
  return updated;
}

export interface CreatePayoutRunInput {
  filename: string;
  period: string;
  currency: string;
  totalAmount: string;
}

export function createPayoutRun(input: CreatePayoutRunInput): PayoutRun {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO payout_runs (id, filename, period, currency, status, total_amount)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.filename, input.period, input.currency, "draft", input.totalAmount);
  const run = getPayoutRunById(id);
  if (!run) throw new Error("Payout run not created");
  return run;
}

export function getPayoutRunById(id: string): PayoutRun | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM payout_runs WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? toPayoutRun(row) : null;
}

export function listPayoutRuns(): PayoutRun[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM payout_runs ORDER BY created_at DESC")
    .all() as Record<string, unknown>[];
  return rows.map(toPayoutRun);
}

export function getPayoutRowsForRun(runId: string): PayoutRow[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM payout_rows WHERE run_id = ? ORDER BY created_at")
    .all(runId) as Record<string, unknown>[];
  return rows.map(toPayoutRow);
}

export interface CreatePayoutRowInput {
  runId: string;
  workerRef: string;
  recipientId?: string | null;
  name?: string | null;
  destinationCountry: string;
  amount: string;
  currency: string;
  period: string;
  rail?: Rail | null;
  status: RowStatus;
  reason: string;
  partnerInstructionId?: string | null;
  partnerStatus?: string | null;
}

export function createPayoutRow(input: CreatePayoutRowInput): PayoutRow {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO payout_rows (
      id, run_id, worker_ref, recipient_id, name, destination_country,
      amount, currency, period, rail, status, reason,
      partner_instruction_id, partner_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.runId,
    input.workerRef,
    input.recipientId ?? null,
    input.name ?? null,
    input.destinationCountry,
    input.amount,
    input.currency,
    input.period,
    input.rail ?? null,
    input.status,
    input.reason,
    input.partnerInstructionId ?? null,
    input.partnerStatus ?? null
  );
  return toPayoutRow(
    db.prepare("SELECT * FROM payout_rows WHERE id = ?").get(id) as Record<string, unknown>
  );
}

export function updatePayoutRow(
  id: string,
  input: Partial<CreatePayoutRowInput>
): PayoutRow {
  const db = getDb();
  const current = db
    .prepare("SELECT * FROM payout_rows WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  if (!current) throw new Error("Payout row not found");

  db.prepare(
    `UPDATE payout_rows SET
      worker_ref = ?,
      recipient_id = ?,
      name = ?,
      destination_country = ?,
      amount = ?,
      currency = ?,
      period = ?,
      rail = ?,
      status = ?,
      reason = ?,
      partner_instruction_id = ?,
      partner_status = ?
    WHERE id = ?`
  ).run(
    (input.workerRef ?? current.worker_ref) as string,
    (input.recipientId ?? current.recipient_id) as string | null,
    (input.name ?? current.name) as string | null,
    (input.destinationCountry ?? current.destination_country) as string,
    (input.amount ?? current.amount) as string,
    (input.currency ?? current.currency) as string,
    (input.period ?? current.period) as string,
    (input.rail ?? current.rail) as string | null,
    (input.status ?? current.status) as string,
    (input.reason ?? current.reason) as string,
    (input.partnerInstructionId ?? current.partner_instruction_id) as string | null,
    (input.partnerStatus ?? current.partner_status) as string | null,
    id
  );

  return toPayoutRow(
    db.prepare("SELECT * FROM payout_rows WHERE id = ?").get(id) as Record<string, unknown>
  );
}

export function getPayoutRowsByWorkerRef(workerRef: string): PayoutRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM payout_rows WHERE worker_ref = ? ORDER BY created_at DESC`
    )
    .all(workerRef) as Record<string, unknown>[];
  return rows.map(toPayoutRow);
}

export function getPayoutRowsByWorkerRefAndPeriod(
  workerRef: string,
  period: string,
  excludeRunId: string
): PayoutRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT pr.* FROM payout_rows pr
       JOIN payout_runs p ON p.id = pr.run_id
       WHERE pr.worker_ref = ? AND pr.period = ? AND pr.run_id != ?
       AND p.status != 'cancelled'
       ORDER BY pr.created_at DESC`
    )
    .all(workerRef, period, excludeRunId) as Record<string, unknown>[];
  return rows.map(toPayoutRow);
}

export function approvePayoutRun(runId: string): PayoutRun {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE payout_runs SET status = ?, approved_at = ?, updated_at = datetime('now') WHERE id = ?`
  ).run("approved", now, runId);
  db.prepare(
    `UPDATE payout_rows SET
      status = 'approved',
      reason = 'Approved by employer; queued for partner submission.'
     WHERE run_id = ? AND status = 'ready'`
  ).run(runId);
  const run = getPayoutRunById(runId);
  if (!run) throw new Error("Payout run not found");
  return run;
}

export function updatePayoutRunStatus(
  runId: string,
  status: PayoutStatus,
  timestamps?: { submittedAt?: string; completedAt?: string }
): PayoutRun {
  const db = getDb();
  const setParts: string[] = ["status = ?", "updated_at = datetime('now')"];
  const values: (string | null)[] = [status];
  if (timestamps?.submittedAt !== undefined) {
    setParts.push("submitted_at = ?");
    values.push(timestamps.submittedAt ?? null);
  }
  if (timestamps?.completedAt !== undefined) {
    setParts.push("completed_at = ?");
    values.push(timestamps.completedAt ?? null);
  }
  values.push(runId);
  db.prepare(
    `UPDATE payout_runs SET ${setParts.join(", ")} WHERE id = ?`
  ).run(...values);
  const run = getPayoutRunById(runId);
  if (!run) throw new Error("Payout run not found");
  return run;
}
