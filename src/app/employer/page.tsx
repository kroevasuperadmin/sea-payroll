"use client";

import { useEffect, useState } from "react";

interface Recipient {
  id: string;
  workerRef: string;
  destinationCountry: string;
  kycStatus: string;
  railPreference: string;
  bankName: string | null;
  accountNumber: string | null;
  ewalletProvider: string | null;
  ewalletIdentifier: string | null;
  usdcAddress: string | null;
  onHold: boolean;
  consentAt: string | null;
}

interface PayoutRow {
  id: string;
  workerRef: string;
  name: string | null;
  destinationCountry: string;
  amount: string;
  currency: string;
  period: string;
  rail: string | null;
  status: string;
  reason: string;
  partnerInstructionId: string | null;
  partnerStatus: string | null;
}

interface RunSummary {
  id: string;
  filename: string;
  period: string;
  currency: string;
  status: string;
  totalAmount: string | null;
  counts: {
    ready: number;
    needs_action: number;
    blocked: number;
    other: number;
  };
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  ready: "bg-emerald-100 text-emerald-800",
  needs_action: "bg-amber-100 text-amber-800",
  blocked: "bg-rose-100 text-rose-800",
  approved: "bg-sky-100 text-sky-800",
  submitted: "bg-indigo-100 text-indigo-800",
  paid: "bg-emerald-100 text-emerald-800",
  failed: "bg-rose-100 text-rose-800",
  returned: "bg-rose-100 text-rose-800",
  demo_paid: "bg-slate-100 text-slate-700",
  demo_submitted: "bg-slate-100 text-slate-700",
};

export default function EmployerConsole() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"runs" | "recipients">("runs");

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<{ run: RunSummary; rows: PayoutRow[] } | null>(null);
  interface AuditEvent {
  id: string;
  eventType: string;
  actor: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

const [uploading, setUploading] = useState(false);
const [syncing, setSyncing] = useState(false);
const [audit, setAudit] = useState<AuditEvent[]>([]);
const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    fetch("/api/employer/session", { credentials: "include" })
      .then((res) => (res.ok ? setAuthenticated(true) : setAuthenticated(false)))
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    loadRecipients();
    loadRuns();
  }, [authenticated]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/employer/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      credentials: "include",
    });
    if (res.ok) {
      setAuthenticated(true);
      setError("");
    } else {
      setError("Invalid invite code");
    }
  }

  async function logout() {
    await fetch("/api/employer/logout", {
      method: "POST",
      credentials: "include",
    });
    setAuthenticated(false);
  }

  async function loadRecipients() {
    const res = await fetch("/api/recipients", { credentials: "include" });
    const data = await res.json();
    setRecipients(data.recipients ?? []);
  }

  async function loadRuns() {
    const res = await fetch("/api/payouts", { credentials: "include" });
    const data = await res.json();
    setRuns(data.runs ?? []);
  }

  async function openRun(id: string) {
    setSelectedRun(id);
    const res = await fetch(`/api/payouts/${id}`, { credentials: "include" });
    const data = await res.json();
    if (res.ok) {
      setRunDetail({
        run: summarizeRun(data.run, data.rows),
        rows: data.rows,
      });
    }
  }

  function summarizeRun(
    run: Record<string, unknown>,
    rows: PayoutRow[]
  ): RunSummary {
    const counts = { ready: 0, needs_action: 0, blocked: 0, other: 0 };
    for (const r of rows) {
      if (r.status === "ready") counts.ready++;
      else if (r.status === "needs_action") counts.needs_action++;
      else if (r.status === "blocked") counts.blocked++;
      else counts.other++;
    }
    return {
      id: run.id as string,
      filename: run.filename as string,
      period: run.period as string,
      currency: run.currency as string,
      status: run.status as string,
      totalAmount: (run.totalAmount as string | null) ?? null,
      counts,
      createdAt: run.createdAt as string,
    };
  }

  async function uploadFile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.querySelector('input[type="file"]') as HTMLInputElement;
    if (!input.files?.[0]) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", input.files[0]);
    const res = await fetch("/api/payouts", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    const data = await res.json();
    setUploading(false);
    if (res.ok) {
      input.value = "";
      setRunDetail({
        run: data.run as RunSummary,
        rows: data.rows as PayoutRow[],
      });
      setSelectedRun(data.run.id as string);
      setRuns((r) => [data.run, ...r]);
    } else {
      setError(data.error ?? "Upload failed");
    }
  }

  async function approveRun(id: string) {
    const res = await fetch(`/api/payouts/${id}/approve`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json();
    if (res.ok) {
      setRunDetail({
        run: summarizeRun(data.run, data.rows),
        rows: data.rows,
      });
      setRuns((r) =>
        r.map((run) =>
          run.id === id ? { ...run, status: "approved" as const } : run
        )
      );
    } else {
      setError(data.error ?? "Approval failed");
    }
  }

  async function syncRun(id: string) {
    setSyncing(true);
    const res = await fetch(`/api/payouts/${id}/sync`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json();
    setSyncing(false);
    if (res.ok) {
      setRunDetail({
        run: summarizeRun(data.run, data.rows),
        rows: data.rows,
      });
    } else {
      setError(data.error ?? "Sync failed");
    }
  }

  async function loadAudit(id: string) {
    const res = await fetch(`/api/payouts/${id}/audit`, { credentials: "include" });
    const data = await res.json();
    if (res.ok) {
      setAudit(data.audit ?? []);
      setShowAudit(true);
    }
  }

  const [recipientForm, setRecipientForm] = useState({
    workerRef: "",
    destinationCountry: "ID",
    kycStatus: "unverified",
    kycNotes: "",
    railPreference: "bank",
    bankName: "",
    accountNumber: "",
    ewalletProvider: "",
    ewalletIdentifier: "",
    usdcAddress: "",
    consentAt: "",
    onHold: false,
  });

  async function saveRecipient(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      ...recipientForm,
      bankName: recipientForm.railPreference === "bank" ? recipientForm.bankName : null,
      accountNumber:
        recipientForm.railPreference === "bank" ? recipientForm.accountNumber : null,
      ewalletProvider:
        recipientForm.railPreference === "ewallet" ? recipientForm.ewalletProvider : null,
      ewalletIdentifier:
        recipientForm.railPreference === "ewallet" ? recipientForm.ewalletIdentifier : null,
      usdcAddress:
        recipientForm.railPreference === "usdc" ? recipientForm.usdcAddress : null,
      consentAt: recipientForm.consentAt ? new Date(recipientForm.consentAt).toISOString() : null,
    };
    const res = await fetch("/api/recipients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (res.ok) {
      setRecipientForm({
        workerRef: "",
        destinationCountry: "ID",
        kycStatus: "unverified",
        kycNotes: "",
        railPreference: "bank",
        bankName: "",
        accountNumber: "",
        ewalletProvider: "",
        ewalletIdentifier: "",
        usdcAddress: "",
        consentAt: "",
        onHold: false,
      });
      loadRecipients();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save recipient");
    }
  }

  useEffect(() => {
    if (!runDetail?.run) return;
    if (
      runDetail.run.status !== "submitted" &&
      runDetail.run.status !== "approved"
    ) {
      return;
    }
    const id = runDetail.run.id;
    const timer = setInterval(() => {
      syncRun(id);
    }, 5000);
    return () => clearInterval(timer);
  }, [runDetail?.run?.status, runDetail?.run?.id]);

  if (authenticated === null) {
    return <div className="p-10 text-sm text-[#5A6B70]">Loading…</div>;
  }

  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto px-6 py-20">
        <h1 className="font-[family-name:var(--font-editorial)] text-4xl text-[#123B63] mb-4">
          Employer console
        </h1>
        <p className="text-sm text-[#5A6B70] mb-6">
          Enter the design-partner invite code to continue.
        </p>
        <form onSubmit={login} className="flex flex-col gap-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Invite code"
            className="w-full rounded-lg border border-[#123B63]/15 bg-white px-4 py-3 text-base outline-none focus:border-[#123B63]/60"
          />
          <button
            type="submit"
            className="rounded-full bg-[#E3A63B] text-[#16343A] py-3 font-semibold text-sm"
          >
            Enter workspace
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.2em] uppercase text-[#5A6B70] mb-2">
            Employer workspace
          </p>
          <h1 className="font-[family-name:var(--font-editorial)] text-4xl text-[#123B63]">
            Tiba — Singapore → Indonesia
          </h1>
        </div>
        <button
          onClick={logout}
          className="text-sm text-[#5A6B70] hover:text-[#123B63] underline"
        >
          Log out
        </button>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex gap-4 border-b border-[#123B63]/10">
        <button
          onClick={() => setTab("runs")}
          className={`pb-2 text-sm font-medium ${
            tab === "runs" ? "text-[#123B63] border-b-2 border-[#123B63]" : "text-[#5A6B70]"
          }`}
        >
          Payout runs
        </button>
        <button
          onClick={() => setTab("recipients")}
          className={`pb-2 text-sm font-medium ${
            tab === "recipients"
              ? "text-[#123B63] border-b-2 border-[#123B63]"
              : "text-[#5A6B70]"
          }`}
        >
          Recipients
        </button>
      </div>

      {tab === "runs" && (
        <section className="flex flex-col gap-6">
          <form
            onSubmit={uploadFile}
            className="rounded-2xl border border-[#123B63]/12 bg-white p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-end"
          >
            <div className="flex-1 w-full">
              <label className="block text-xs font-medium text-[#5A6B70] mb-1.5">
                Upload approved CSV payout file
              </label>
              <input
                type="file"
                accept=".csv"
                required
                className="block w-full text-sm text-[#16343A] file:mr-4 file:rounded-full file:border-0 file:bg-[#123B63] file:px-4 file:py-2 file:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={uploading}
              className="rounded-full bg-[#E3A63B] text-[#16343A] px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Validate & import"}
            </button>
          </form>

          {runDetail && (
            <div className="rounded-2xl border border-[#123B63]/12 bg-white p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#123B63]">
                    {runDetail.run.filename}
                  </h2>
                  <p className="text-sm text-[#5A6B70]">
                    {runDetail.run.period} · {runDetail.run.currency} ·{" "}
                    {runDetail.run.totalAmount} total · status{" "}
                    <span className="font-medium">{runDetail.run.status}</span>
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {runDetail.run.status === "draft" && (
                    <button
                      onClick={() => approveRun(runDetail.run.id)}
                      className="rounded-full bg-[#123B63] text-white px-5 py-2 text-sm font-semibold hover:bg-[#0f2d4d] transition-colors"
                    >
                      Approve ready subset
                    </button>
                  )}
                  {(runDetail.run.status === "submitted" ||
                    runDetail.run.status === "approved") && (
                    <button
                      onClick={() => syncRun(runDetail.run.id)}
                      disabled={syncing}
                      className="rounded-full bg-[#E3A63B] text-[#16343A] px-5 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      {syncing ? "Syncing…" : "Sync partner statuses"}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (showAudit) {
                        setShowAudit(false);
                      } else {
                        loadAudit(runDetail.run.id);
                      }
                    }}
                    className="rounded-full border border-[#123B63]/30 text-[#123B63] px-5 py-2 text-sm font-semibold hover:bg-[#123B63]/[0.04]"
                  >
                    {showAudit ? "Hide audit trail" : "View audit trail"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div className="rounded-lg bg-emerald-50 px-3 py-2">
                  <div className="font-semibold text-emerald-800">
                    {runDetail.run.counts.ready}
                  </div>
                  <div className="text-emerald-700/70">Ready</div>
                </div>
                <div className="rounded-lg bg-amber-50 px-3 py-2">
                  <div className="font-semibold text-amber-800">
                    {runDetail.run.counts.needs_action}
                  </div>
                  <div className="text-amber-700/70">Needs action</div>
                </div>
                <div className="rounded-lg bg-rose-50 px-3 py-2">
                  <div className="font-semibold text-rose-800">
                    {runDetail.run.counts.blocked}
                  </div>
                  <div className="text-rose-700/70">Blocked</div>
                </div>
              </div>

              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-[#123B63]/10 text-[#5A6B70]">
                    <th className="py-2 font-medium">Worker</th>
                    <th className="py-2 font-medium">Amount</th>
                    <th className="py-2 font-medium">Rail</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Partner status</th>
                    <th className="py-2 font-medium">Partner ID</th>
                    <th className="py-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {runDetail.rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[#123B63]/5 last:border-0"
                    >
                      <td className="py-2.5">
                        <div className="font-medium text-[#16343A]">
                          {row.name || row.workerRef}
                        </div>
                        <div className="text-xs text-[#5A6B70]">
                          {row.workerRef}
                        </div>
                      </td>
                      <td className="py-2.5">
                        {row.amount} {row.currency}
                      </td>
                      <td className="py-2.5">{row.rail ?? "—"}</td>
                      <td className="py-2.5">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            STATUS_COLORS[row.status] ??
                            "bg-[#123B63]/10 text-[#123B63]"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            STATUS_COLORS[row.partnerStatus ?? ""] ??
                            "bg-[#123B63]/10 text-[#123B63]"
                          }`}
                        >
                          {row.partnerStatus ?? "—"}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <code className="text-[10px] text-[#5A6B70] break-all">
                          {row.partnerInstructionId
                            ? `${row.partnerInstructionId.slice(0, 12)}…`
                            : "—"}
                        </code>
                      </td>
                      <td className="py-2.5 text-[#5A6B70] max-w-xs">
                        {row.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {showAudit && (
                <div className="rounded-lg border border-[#123B63]/10 bg-[#F8F9FA] p-4 flex flex-col gap-2">
                  <h3 className="text-xs font-semibold text-[#123B63]">
                    Audit trail
                  </h3>
                  {audit.length === 0 ? (
                    <p className="text-sm text-[#5A6B70]">No audit events yet.</p>
                  ) : (
                    <ul className="flex flex-col gap-2 max-h-80 overflow-auto">
                      {audit.map((e) => (
                        <li
                          key={e.id}
                          className="text-xs border-b border-[#123B63]/5 pb-2 last:border-0"
                        >
                          <div className="flex gap-2 flex-wrap">
                            <span className="font-medium text-[#16343A]">
                              {e.eventType}
                            </span>
                            <span className="text-[#5A6B70]">
                              · {e.actor} · {new Date(e.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <pre className="text-[10px] text-[#5A6B70] mt-1 whitespace-pre-wrap">
                            {JSON.stringify(e.payload, null, 2)}
                          </pre>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h2 className="text-[11px] tracking-[0.2em] uppercase text-[#5A6B70]">
              Recent payout runs
            </h2>
            {runs.length === 0 ? (
              <p className="text-sm text-[#5A6B70]">No payout runs yet.</p>
            ) : (
              runs.map((run) => (
                <button
                  key={run.id}
                  onClick={() => openRun(run.id)}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    selectedRun === run.id
                      ? "border-[#123B63] bg-[#123B63]/[0.04]"
                      : "border-[#123B63]/12 bg-white hover:border-[#123B63]/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#16343A]">
                      {run.filename}
                    </span>
                    <span className="text-xs text-[#5A6B70]">{run.status}</span>
                  </div>
                  <div className="text-sm text-[#5A6B70] mt-1">
                    {run.period} · {run.currency} {run.totalAmount} ·{" "}
                    {run.counts.ready} ready / {run.counts.needs_action} needs action /{" "}
                    {run.counts.blocked} blocked
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      )}

      {tab === "recipients" && (
        <section className="flex flex-col gap-6">
          <form
            onSubmit={saveRecipient}
            className="rounded-2xl border border-[#123B63]/12 bg-white p-5 grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <h3 className="sm:col-span-2 text-sm font-semibold text-[#123B63]">
              Add recipient profile
            </h3>
            <input
              value={recipientForm.workerRef}
              onChange={(e) =>
                setRecipientForm((s) => ({ ...s, workerRef: e.target.value }))
              }
              placeholder="Worker reference"
              required
              className="rounded-lg border border-[#123B63]/15 px-3 py-2.5 text-sm outline-none focus:border-[#123B63]/60"
            />
            <select
              value={recipientForm.railPreference}
              onChange={(e) =>
                setRecipientForm((s) => ({
                  ...s,
                  railPreference: e.target.value,
                }))
              }
              className="rounded-lg border border-[#123B63]/15 px-3 py-2.5 text-sm outline-none focus:border-[#123B63]/60"
            >
              <option value="bank">Local bank</option>
              <option value="ewallet">E-wallet</option>
              <option value="usdc">USDC wallet</option>
            </select>
            <select
              value={recipientForm.kycStatus}
              onChange={(e) =>
                setRecipientForm((s) => ({ ...s, kycStatus: e.target.value }))
              }
              className="rounded-lg border border-[#123B63]/15 px-3 py-2.5 text-sm outline-none focus:border-[#123B63]/60"
            >
              <option value="unverified">Unverified</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="failed">Failed</option>
            </select>
            {recipientForm.railPreference === "bank" && (
              <>
                <input
                  value={recipientForm.bankName}
                  onChange={(e) =>
                    setRecipientForm((s) => ({ ...s, bankName: e.target.value }))
                  }
                  placeholder="Bank name"
                  className="rounded-lg border border-[#123B63]/15 px-3 py-2.5 text-sm outline-none focus:border-[#123B63]/60"
                />
                <input
                  value={recipientForm.accountNumber}
                  onChange={(e) =>
                    setRecipientForm((s) => ({
                      ...s,
                      accountNumber: e.target.value,
                    }))
                  }
                  placeholder="Account number"
                  className="rounded-lg border border-[#123B63]/15 px-3 py-2.5 text-sm outline-none focus:border-[#123B63]/60"
                />
              </>
            )}
            {recipientForm.railPreference === "ewallet" && (
              <>
                <input
                  value={recipientForm.ewalletProvider}
                  onChange={(e) =>
                    setRecipientForm((s) => ({
                      ...s,
                      ewalletProvider: e.target.value,
                    }))
                  }
                  placeholder="E-wallet provider"
                  className="rounded-lg border border-[#123B63]/15 px-3 py-2.5 text-sm outline-none focus:border-[#123B63]/60"
                />
                <input
                  value={recipientForm.ewalletIdentifier}
                  onChange={(e) =>
                    setRecipientForm((s) => ({
                      ...s,
                      ewalletIdentifier: e.target.value,
                    }))
                  }
                  placeholder="E-wallet identifier (e.g. phone)"
                  className="rounded-lg border border-[#123B63]/15 px-3 py-2.5 text-sm outline-none focus:border-[#123B63]/60"
                />
              </>
            )}
            {recipientForm.railPreference === "usdc" && (
              <input
                value={recipientForm.usdcAddress}
                onChange={(e) =>
                  setRecipientForm((s) => ({
                    ...s,
                    usdcAddress: e.target.value,
                  }))
                }
                placeholder="USDC wallet address"
                className="sm:col-span-2 rounded-lg border border-[#123B63]/15 px-3 py-2.5 text-sm outline-none focus:border-[#123B63]/60"
              />
            )}
            <input
              type="datetime-local"
              value={recipientForm.consentAt}
              onChange={(e) =>
                setRecipientForm((s) => ({ ...s, consentAt: e.target.value }))
              }
              className="rounded-lg border border-[#123B63]/15 px-3 py-2.5 text-sm outline-none focus:border-[#123B63]/60"
            />
            <button
              type="submit"
              className="sm:col-span-2 rounded-full bg-[#123B63] text-white px-5 py-2.5 text-sm font-semibold"
            >
              Save recipient
            </button>
          </form>

          <div className="flex flex-col gap-2">
            {recipients.length === 0 ? (
              <p className="text-sm text-[#5A6B70]">No recipient profiles yet.</p>
            ) : (
              recipients.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-[#123B63]/12 bg-white p-4 text-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-[#16343A]">
                        {r.workerRef}
                      </div>
                      <div className="text-[#5A6B70]">
                        {r.railPreference} · KYC: {r.kycStatus} ·{" "}
                        {r.onHold ? "On hold" : "Active"}
                      </div>
                    </div>
                    <div className="text-right text-[#5A6B70]">
                      {r.destinationCountry}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
