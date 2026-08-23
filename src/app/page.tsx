"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  WalletModalButton,
  WalletDisconnectButton,
} from "@solana/wallet-adapter-react-ui";
import {
  MAX_BATCH_SIZE,
  buildBatchPaymentTx,
  confirmTx,
  explorerAddressUrl,
  explorerTxUrl,
  getUsdcBalance,
  isValidAddress,
  prepareTx,
} from "@/lib/solana";
import { errorMessage } from "@/lib/errors";
import { SOL_FAUCET_URL, USDC_FAUCET_URL } from "@/lib/site";
import {
  ADDRESS_LINK_CLASS,
  CARD_CLASS,
  INPUT_CLASS,
  Eyebrow,
  ExternalLink,
  NavLink,
  PANEL_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/components/ui";

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
      const prepared = await prepareTx(connection, tx, publicKey);

      setStatus("Waiting for wallet approval…");
      const signature = await sendTransaction(tx, connection);

      setStatus("Confirming on devnet…");
      await confirmTx(connection, signature, prepared);

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
      setStatus(`Failed: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-14 flex flex-col gap-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow className="mb-3">USDC Payroll · Southeast Asia</Eyebrow>
          <h1 className="font-[family-name:var(--font-editorial)] font-normal text-5xl sm:text-6xl leading-[1.05] text-[#123B63]">
            Tiba
          </h1>
          <p className="text-base text-[#16343A]/65 mt-3 max-w-sm leading-relaxed">
            Pay your Southeast Asian gig workers in USDC — one click, one
            Solana transaction. If any single transfer would fail, the whole
            batch reverts: no partial payroll run, a guarantee no bank API or
            database gives you across independently-owned accounts.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <NavLink href="/home" className="text-xs">
            ← Home
          </NavLink>
          <div className="[&_.wallet-adapter-button]:!rounded-full [&_.wallet-adapter-button]:!bg-[#123B63] [&_.wallet-adapter-button]:!text-white [&_.wallet-adapter-button]:!font-semibold [&_.wallet-adapter-button]:!text-sm">
            {connected ? <WalletDisconnectButton /> : <WalletModalButton />}
          </div>
          <Link
            href="/agent"
            className="rounded-full bg-[#E3A63B] text-[#16343A] px-5 py-2.5 text-sm font-semibold hover:bg-[#d3962b] transition-colors text-center whitespace-nowrap"
          >
            Agent demo →
          </Link>
        </div>
      </header>

      {connected && publicKey && (
        <section className={`${PANEL_CLASS} flex flex-col gap-3 text-sm`}>
          <div className="flex items-center justify-between">
            <span className="text-[#5A6B70]">Employer wallet</span>
            <ExternalLink
              href={explorerAddressUrl(publicKey.toBase58())}
              className={ADDRESS_LINK_CLASS}
            >
              {publicKey.toBase58()}
            </ExternalLink>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#5A6B70]">Devnet USDC balance</span>
            <span className="flex items-center gap-2">
              {usdcBalance !== null ? `${usdcBalance.toFixed(2)} USDC` : "—"}
              <button
                onClick={refreshBalance}
                className="text-xs underline text-[#5A6B70] hover:text-[#123B63]"
              >
                refresh
              </button>
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#5A6B70] pt-1 border-t border-[#123B63]/10 mt-1">
            <ExternalLink
              href={SOL_FAUCET_URL}
              className="underline hover:text-[#123B63]"
            >
              Get devnet SOL (gas)
            </ExternalLink>
            <ExternalLink
              href={USDC_FAUCET_URL}
              className="underline hover:text-[#123B63]"
            >
              Get devnet USDC
            </ExternalLink>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Eyebrow as="h2">Workers to pay</Eyebrow>
          <button
            onClick={addWorker}
            disabled={workers.length >= MAX_BATCH_SIZE}
            className="text-xs px-3.5 py-1.5 rounded-full border border-[#123B63]/20 hover:border-[#123B63] hover:text-[#123B63] transition-colors disabled:opacity-30 disabled:hover:border-[#123B63]/20 disabled:hover:text-inherit"
          >
            + Add worker
          </button>
        </div>

        <div className="flex flex-col gap-3 sm:gap-2">
          {workers.map((w) => (
            <div
              key={w.id}
              className="flex flex-col gap-2 rounded-lg border border-[#123B63]/12 bg-white p-3 sm:p-0 sm:border-0 sm:bg-transparent sm:grid sm:grid-cols-[1fr_1fr_100px_44px] sm:items-center"
            >
              <input
                value={w.name}
                onChange={(e) => updateWorker(w.id, "name", e.target.value)}
                placeholder="Worker name"
                className={`w-full ${INPUT_CLASS} border-[#123B63]/15 focus:border-[#123B63]/60`}
              />
              <input
                value={w.address}
                onChange={(e) => updateWorker(w.id, "address", e.target.value)}
                placeholder="Solana devnet address"
                className={`w-full font-mono ${INPUT_CLASS} ${
                  w.address && !isValidAddress(w.address)
                    ? "border-red-400/60"
                    : "border-[#123B63]/15 focus:border-[#123B63]/60"
                }`}
              />
              <div className="flex items-center gap-2 sm:contents">
                <input
                  value={w.amount}
                  onChange={(e) => updateWorker(w.id, "amount", e.target.value)}
                  placeholder="USDC"
                  inputMode="decimal"
                  className={`flex-1 sm:flex-none w-full text-right ${INPUT_CLASS} border-[#123B63]/15 focus:border-[#123B63]/60`}
                />
                <button
                  onClick={() => removeWorker(w.id)}
                  aria-label="Remove worker"
                  className="h-11 w-11 shrink-0 flex items-center justify-center rounded-lg text-[#5A6B70] hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[#123B63]/10">
          <span className="text-sm text-[#5A6B70]">
            {workers.length} worker{workers.length === 1 ? "" : "s"} · max{" "}
            {MAX_BATCH_SIZE} per batch
            <span className="hidden sm:inline">
              {" "}
              — Solana&apos;s 1,232-byte transaction limit
            </span>
          </span>
          <span className="font-semibold text-[#123B63]">
            {total.toFixed(2)} USDC total
          </span>
        </div>

        <button
          onClick={payAll}
          disabled={!canPay}
          className={`mt-2 py-3 text-sm ${PRIMARY_BUTTON_CLASS}`}
        >
          {busy ? "Processing…" : `Pay all ${workers.length} workers now`}
        </button>

        {status && <p className="text-sm text-[#5A6B70]">{status}</p>}
        {!connected && !status && (
          <p className="text-sm text-[#5A6B70]">
            Connect a wallet set to <span className="font-medium">Solana Devnet</span> to pay — free test USDC at faucet.circle.com.
          </p>
        )}
      </section>

      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <Eyebrow as="h2">Payment history (this session)</Eyebrow>
          <div className="flex flex-col gap-1.5 text-sm">
            {history.map((h) => (
              <div
                key={h.signature}
                className={`flex items-center justify-between px-3.5 py-2.5 ${CARD_CLASS}`}
              >
                <span>
                  {h.workerCount} workers · {h.total.toFixed(2)} USDC ·{" "}
                  {new Date(h.timestamp).toLocaleTimeString()}
                </span>
                <ExternalLink
                  href={explorerTxUrl(h.signature)}
                  className="underline text-xs font-mono text-[#123B63]"
                >
                  view on Explorer ↗
                </ExternalLink>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-auto pt-8 text-xs text-[#5A6B70]/70">
        Tiba — Solana devnet demo. Real USDC-Dev mint, real Solana
        transactions.
      </footer>
    </div>
  );
}
