"use client";

import { useState } from "react";
import { explorerTxUrl } from "@/lib/solana";

interface AgentTask {
  id: string;
  worker: string;
  address: string;
  reason: string;
  amount: number;
}

interface TaskResult {
  taskId: string;
  status: "pending" | "running" | "paid" | "failed";
  signature?: string;
  error?: string;
}

// Simulated stream of verified, completed units of work — each one is a
// trigger an AI agent (or any automated system: a webhook, a verification
// model, a monitoring job) would fire the moment it confirms the work is
// done. No human reviews or approves each payment.
const AGENT_TASKS: AgentTask[] = [
  {
    id: "t1",
    worker: "Maria — Manila",
    address: "VYmSFKPM6oxW26hhpVsZ55ST2SyJQWCidQvPo4xLdRJ",
    reason: "Delivery #482 confirmed complete via GPS webhook",
    amount: 3.5,
  },
  {
    id: "t2",
    worker: "Budi — Jakarta",
    address: "CGJ2DbQtFs4fas9r3BSKqKBZ3JeRXnboLZoBfde6v8Zz",
    reason: "Design API call #1187 returned — usage-metered task",
    amount: 1.2,
  },
  {
    id: "t3",
    worker: "Linh — Ho Chi Minh City",
    address: "7DLdKZEzZgpLEmGVaWFwE3mtAbxc8Uf1L7YHABzkoPqG",
    reason: "Support queue batch: 40 tickets resolved",
    amount: 6.0,
  },
  {
    id: "t4",
    worker: "Maria — Manila",
    address: "VYmSFKPM6oxW26hhpVsZ55ST2SyJQWCidQvPo4xLdRJ",
    reason: "Delivery #483 confirmed complete via GPS webhook",
    amount: 3.5,
  },
];

export default function AgentDemo() {
  const [results, setResults] = useState<Record<string, TaskResult>>({});
  const [running, setRunning] = useState(false);
  const [agentAddress, setAgentAddress] = useState<string | null>(null);

  const loadAgentAddress = async () => {
    const res = await fetch("/api/agent-pay");
    const data = await res.json();
    if (data.agentAddress) setAgentAddress(data.agentAddress);
  };

  const runAgentCycle = async () => {
    setRunning(true);
    if (!agentAddress) await loadAgentAddress();

    for (const task of AGENT_TASKS) {
      setResults((r) => ({ ...r, [task.id]: { taskId: task.id, status: "running" } }));
      try {
        const res = await fetch("/api/agent-pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workerAddress: task.address,
            amount: task.amount,
            reason: task.reason,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Payment failed");
        setResults((r) => ({
          ...r,
          [task.id]: { taskId: task.id, status: "paid", signature: data.signature },
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setResults((r) => ({
          ...r,
          [task.id]: { taskId: task.id, status: "failed", error: message },
        }));
      }
    }
    setRunning(false);
  };

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-14 flex flex-col gap-10">
      <header>
        <a
          href="/app"
          className="text-xs text-[#5A6B70] hover:text-[#123B63] transition-colors"
        >
          ← back to Tiba
        </a>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[#5A6B70] mt-4 mb-3">
          AI + Agentic Commerce
        </p>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.05] text-[#123B63]">
          Autonomous <span className="text-[#E3A63B]">Pay-Per-Task</span>
        </h1>
        <p className="text-sm text-[#5A6B70] mt-3 max-w-md">
          No human approves each payment. An automated agent (a webhook, a
          verification job, a completion check) confirms a unit of work is
          done and the payment fires immediately, signed by its own Solana
          wallet — real machine-to-machine, usage-metered settlement.
        </p>
      </header>

      <section className="rounded-2xl border border-[#123B63]/12 bg-[#123B63]/[0.04] p-5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-[#5A6B70]">Agent wallet</span>
          {agentAddress ? (
            <a
              href={`https://explorer.solana.com/address/${agentAddress}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs underline decoration-dotted decoration-[#5A6B70] hover:text-[#123B63]"
            >
              {agentAddress}
            </a>
          ) : (
            <button
              onClick={loadAgentAddress}
              className="text-xs underline text-[#5A6B70] hover:text-[#123B63]"
            >
              load address
            </button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] tracking-[0.2em] uppercase text-[#5A6B70]">
            Pending agent-verified tasks
          </h2>
          <button
            onClick={runAgentCycle}
            disabled={running}
            className="rounded-full bg-[#E3A63B] text-[#16343A] px-5 py-2 text-sm font-semibold disabled:opacity-30 disabled:bg-[#123B63]/10 disabled:text-[#5A6B70] transition-colors"
          >
            {running ? "Agent running…" : "▶ Run agent cycle"}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {AGENT_TASKS.map((task) => {
            const result = results[task.id];
            return (
              <div
                key={task.id}
                className="rounded-lg border border-[#123B63]/12 bg-white px-4 py-3 text-sm flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-medium">{task.worker}</div>
                  <div className="text-[#5A6B70] text-xs mt-0.5">{task.reason}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-xs text-[#5A6B70]">
                    {task.amount.toFixed(2)} USDC
                  </span>
                  {!result && (
                    <span className="text-xs text-[#5A6B70]/60">queued</span>
                  )}
                  {result?.status === "running" && (
                    <span className="text-xs text-[#E3A63B]">paying…</span>
                  )}
                  {result?.status === "paid" && result.signature && (
                    <a
                      href={explorerTxUrl(result.signature)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline text-[#123B63]"
                    >
                      paid ↗
                    </a>
                  )}
                  {result?.status === "failed" && (
                    <span className="text-xs text-red-500" title={result.error}>
                      failed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="mt-auto pt-8 text-xs text-[#5A6B70]/70">
        Same on-chain engine as Tiba — here triggered autonomously by code
        instead of a human clicking &quot;pay.&quot; Devnet demo.
      </footer>
    </div>
  );
}
