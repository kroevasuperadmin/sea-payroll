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
  { id: "w1", name: "Maria — Manila (delivery rider)", address: "", amount: "25" },
  { id: "w2", name: "Budi — Jakarta (freelance designer)", address: "", amount: "40" },
  { id: "w3", name: "Linh — Ho Chi Minh City (virtual assistant)", address: "", amount: "18.5" },
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
    <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-10 flex flex-col gap-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">SEA Payroll</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Pay your Southeast Asian gig workers in USDC — one click, one
            atomic Solana transaction, instantly verifiable.
          </p>
        </div>
        <WalletMultiButton />
      </header>

      {connected && publicKey && (
        <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Employer wallet</span>
            <a
              href={explorerAddressUrl(publicKey.toBase58())}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs underline decoration-dotted"
            >
              {publicKey.toBase58()}
            </a>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Devnet USDC balance</span>
            <span className="flex items-center gap-2">
              {usdcBalance !== null ? `${usdcBalance.toFixed(2)} USDC` : "—"}
              <button
                onClick={refreshBalance}
                className="text-xs underline text-neutral-500"
              >
                refresh
              </button>
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-neutral-500 pt-1">
            <a
              className="underline"
              target="_blank"
              rel="noreferrer"
              href="https://faucet.solana.com"
            >
              Get devnet SOL (gas)
            </a>
            <a
              className="underline"
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
          <h2 className="font-medium">Workers to pay</h2>
          <button
            onClick={addWorker}
            disabled={workers.length >= MAX_BATCH_SIZE}
            className="text-sm px-3 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 disabled:opacity-40"
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
                className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
              />
              <input
                value={w.address}
                onChange={(e) => updateWorker(w.id, "address", e.target.value)}
                placeholder="Solana devnet address"
                className={`rounded-md border bg-transparent px-2 py-1.5 text-sm font-mono ${
                  w.address && !isValidAddress(w.address)
                    ? "border-red-400"
                    : "border-neutral-300 dark:border-neutral-700"
                }`}
              />
              <input
                value={w.amount}
                onChange={(e) => updateWorker(w.id, "amount", e.target.value)}
                placeholder="USDC"
                inputMode="decimal"
                className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm text-right"
              />
              <button
                onClick={() => removeWorker(w.id)}
                aria-label="Remove worker"
                className="text-neutral-400 hover:text-red-500 text-sm"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <span className="text-sm text-neutral-500">
            {workers.length} worker{workers.length === 1 ? "" : "s"} · max{" "}
            {MAX_BATCH_SIZE} per batch
          </span>
          <span className="font-medium">{total.toFixed(2)} USDC total</span>
        </div>

        <button
          onClick={payAll}
          disabled={!canPay}
          className="mt-2 rounded-md bg-black text-white dark:bg-white dark:text-black py-2.5 font-medium disabled:opacity-40"
        >
          {busy ? "Processing…" : `Pay all ${workers.length} workers now`}
        </button>

        {status && <p className="text-sm text-neutral-500">{status}</p>}
      </section>

      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Payment history (this session)</h2>
          <div className="flex flex-col gap-1.5 text-sm">
            {history.map((h) => (
              <div
                key={h.signature}
                className="flex items-center justify-between rounded-md border border-neutral-200 dark:border-neutral-800 px-3 py-2"
              >
                <span>
                  {h.workerCount} workers · {h.total.toFixed(2)} USDC ·{" "}
                  {new Date(h.timestamp).toLocaleTimeString()}
                </span>
                <a
                  href={explorerTxUrl(h.signature)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-xs font-mono"
                >
                  view on Explorer ↗
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-auto pt-8 text-xs text-neutral-400">
        Built for Superteam Malaysia · Solana Lab for DevLeague 2026 · Devnet
        demo — real USDC-Dev mint, real Solana transactions.
      </footer>
    </div>
  );
}
