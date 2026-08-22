"use client";

import { useCallback, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import {
  MAX_BATCH_SIZE,
  buildBatchPaymentTx,
  explorerAddressUrl,
  explorerTxUrl,
  getUsdcBalance,
} from "@/lib/solana";

interface WorkerRow {
  id: string;
  name: string;
  address: string;
  amount: string;
}

interface HistoryEntry {
  signature: string;
  workerCount: number;
  total: number;
  timestamp: number;
}

const STARTER_WORKERS: WorkerRow[] = [
  {
    id: "w1",
    name: "Maria — Manila (delivery rider)",
    address: "VYmSFKPM6oxW26hhpVsZ55ST2SyJQWCidQvPo4xLdRJ",
    amount: "25",
  },
  {
    id: "w2",
    name: "Budi — Jakarta (freelance designer)",
    address: "CGJ2DbQtFs4fas9r3BSKqKBZ3JeRXnboLZoBfde6v8Zz",
    amount: "40",
  },
  {
    id: "w3",
    name: "Linh — Ho Chi Minh City (virtual assistant)",
    address: "7DLdKZEzZgpLEmGVaWFwE3mtAbxc8Uf1L7YHABzkoPqG",
    amount: "18.5",
  },
];

function isValidAddress(addr: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new PublicKey(addr);
    return true;
  } catch {
    return false;
  }
}

export default function Home() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [workers, setWorkers] = useState<WorkerRow[]>(STARTER_WORKERS);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);

  const total = useMemo(
    () => workers.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0),
    [workers]
  );

  const refreshBalance = useCallback(async () => {
    if (!publicKey) return;
    const bal = await getUsdcBalance(connection, publicKey);
    setUsdcBalance(bal);
  }, [connection, publicKey]);

  const updateWorker = (id: string, field: keyof WorkerRow, value: string) => {
    setWorkers((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const addWorker = () => {
    if (workers.length >= MAX_BATCH_SIZE) return;
    setWorkers((rows) => [
      ...rows,
      { id: `w${Date.now()}`, name: "", address: "", amount: "" },
    ]);
  };

  const removeWorker = (id: string) => {
    setWorkers((rows) => rows.filter((r) => r.id !== id));
  };

  const canPay =
    connected &&
    !busy &&
    workers.length > 0 &&
    workers.every(
      (w) => isValidAddress(w.address) && (parseFloat(w.amount) || 0) > 0
    );

  const payAll = async () => {
    if (!publicKey) return;
    setBusy(true);
    setStatus("Building transaction…");
    try {
      const payments = workers.map((w) => ({
        name: w.name,
        address: w.address,
        amount: parseFloat(w.amount),
      }));
      const tx = await buildBatchPaymentTx(connection, publicKey, payments);
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      setStatus("Waiting for wallet approval…");
      const signature = await sendTransaction(tx, connection);

      setStatus("Confirming on devnet…");
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      setStatus(`Paid ${workers.length} workers — confirmed.`);
      setHistory((h) => [
        {
          signature,
          workerCount: workers.length,
          total,
          timestamp: Date.now(),
        },
        ...h,
      ]);
      await refreshBalance();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Failed: ${message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-14 flex flex-col gap-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.2em] uppercase text-[#9B9A94] mb-3">
            Solana Lab · DevLeague 2026
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.05]">
            SEA <span className="text-[#1EDBFF]">Payroll</span>
          </h1>
          <p className="text-sm text-[#9B9A94] mt-3 max-w-sm">
            Pay your Southeast Asian gig workers in USDC — one click, one
            atomic Solana transaction, instantly verifiable.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="[&_.wallet-adapter-button]:!rounded-full [&_.wallet-adapter-button]:!bg-[#1EDBFF] [&_.wallet-adapter-button]:!text-black [&_.wallet-adapter-button]:!font-semibold [&_.wallet-adapter-button]:!text-sm">
            <WalletMultiButton />
          </div>
          <a
            href="/agent"
            className="text-xs text-[#9B9A94] hover:text-[#F4F4F2] transition-colors"
          >
            🤖 AI Agent autonomous-pay demo →
          </a>
        </div>
      </header>

      {connected && publicKey && (
        <section className="rounded-2xl border border-white/12 bg-white/[0.04] p-5 flex flex-col gap-3 text-sm backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[#9B9A94]">Employer wallet</span>
            <a
              href={explorerAddressUrl(publicKey.toBase58())}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs underline decoration-dotted decoration-[#9B9A94] hover:text-[#1EDBFF]"
            >
              {publicKey.toBase58()}
            </a>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#9B9A94]">Devnet USDC balance</span>
            <span className="flex items-center gap-2">
              {usdcBalance !== null ? `${usdcBalance.toFixed(2)} USDC` : "—"}
              <button
                onClick={refreshBalance}
                className="text-xs underline text-[#9B9A94] hover:text-[#1EDBFF]"
              >
                refresh
              </button>
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#9B9A94] pt-1 border-t border-white/10 mt-1">
            <a
              className="underline hover:text-[#1EDBFF]"
              target="_blank"
              rel="noreferrer"
              href="https://faucet.solana.com"
            >
              Get devnet SOL (gas)
            </a>
            <a
              className="underline hover:text-[#1EDBFF]"
              target="_blank"
              rel="noreferrer"
              href="https://faucet.circle.com"
            >
              Get devnet USDC
            </a>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] tracking-[0.2em] uppercase text-[#9B9A94]">
            Workers to pay
          </h2>
          <button
            onClick={addWorker}
            disabled={workers.length >= MAX_BATCH_SIZE}
            className="text-xs px-3.5 py-1.5 rounded-full border border-white/15 hover:border-[#1EDBFF] hover:text-[#1EDBFF] transition-colors disabled:opacity-30 disabled:hover:border-white/15 disabled:hover:text-inherit"
          >
            + Add worker
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {workers.map((w) => (
            <div
              key={w.id}
              className="grid grid-cols-[1fr_1fr_100px_28px] gap-2 items-center"
            >
              <input
                value={w.name}
                onChange={(e) => updateWorker(w.id, "name", e.target.value)}
                placeholder="Worker name"
                className="rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-sm outline-none focus:border-[#1EDBFF]/60 transition-colors"
              />
              <input
                value={w.address}
                onChange={(e) => updateWorker(w.id, "address", e.target.value)}
                placeholder="Solana devnet address"
                className={`rounded-lg border bg-white/[0.03] px-3 py-2 text-sm font-mono outline-none transition-colors ${
                  w.address && !isValidAddress(w.address)
                    ? "border-red-400/60"
                    : "border-white/12 focus:border-[#1EDBFF]/60"
                }`}
              />
              <input
                value={w.amount}
                onChange={(e) => updateWorker(w.id, "amount", e.target.value)}
                placeholder="USDC"
                inputMode="decimal"
                className="rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-sm text-right outline-none focus:border-[#1EDBFF]/60 transition-colors"
              />
              <button
                onClick={() => removeWorker(w.id)}
                aria-label="Remove worker"
                className="text-[#9B9A94] hover:text-red-400 text-sm transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-white/10">
          <span className="text-sm text-[#9B9A94]">
            {workers.length} worker{workers.length === 1 ? "" : "s"} · max{" "}
            {MAX_BATCH_SIZE} per batch
          </span>
          <span className="font-semibold">{total.toFixed(2)} USDC total</span>
        </div>

        <button
          onClick={payAll}
          disabled={!canPay}
          className="mt-2 rounded-full bg-[#1EDBFF] text-black py-3 font-semibold text-sm disabled:opacity-25 disabled:bg-white/15 disabled:text-[#9B9A94] transition-colors"
        >
          {busy ? "Processing…" : `Pay all ${workers.length} workers now`}
        </button>

        {status && <p className="text-sm text-[#9B9A94]">{status}</p>}
      </section>

      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[11px] tracking-[0.2em] uppercase text-[#9B9A94]">
            Payment history (this session)
          </h2>
          <div className="flex flex-col gap-1.5 text-sm">
            {history.map((h) => (
              <div
                key={h.signature}
                className="flex items-center justify-between rounded-lg border border-white/12 bg-white/[0.03] px-3.5 py-2.5"
              >
                <span>
                  {h.workerCount} workers · {h.total.toFixed(2)} USDC ·{" "}
                  {new Date(h.timestamp).toLocaleTimeString()}
                </span>
                <a
                  href={explorerTxUrl(h.signature)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-xs font-mono text-[#1EDBFF]"
                >
                  view on Explorer ↗
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-auto pt-8 text-xs text-[#9B9A94]/70">
        Built for Superteam Malaysia · Solana Lab for DevLeague 2026 · Devnet
        demo — real USDC-Dev mint, real Solana transactions.
      </footer>
    </div>
  );
}
