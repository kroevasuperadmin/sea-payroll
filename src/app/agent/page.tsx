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
    <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-10 flex flex-col gap-8">
      <header>
        <a href="/" className="text-xs text-neutral-500 underline">
          ← back to SEA Payroll
        </a>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">
          AI Agent — Autonomous Pay-Per-Task
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          No human approves each payment. An automated agent (a webhook, a
          verification job, a completion check) confirms a unit of work is
          done and the payment fires immediately, signed by its own Solana
          wallet — real machine-to-machine, usage-metered settlement.
        </p>
      </header>

      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-neutral-500">Agent wallet</span>
          {agentAddress ? (
            <a
              href={`https://explorer.solana.com/address/${agentAddress}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs underline decoration-dotted"
            >
              {agentAddress}
            </a>
          ) : (
            <button onClick={loadAgentAddress} className="text-xs underline">
              load address
            </button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Pending agent-verified tasks</h2>
          <button
            onClick={runAgentCycle}
            disabled={running}
            className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-40"
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
                className="rounded-md border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-sm flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-medium">{task.worker}</div>
                  <div className="text-neutral-500 text-xs">{task.reason}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-xs">{task.amount.toFixed(2)} USDC</span>
                  {!result && <span className="text-xs text-neutral-400">queued</span>}
                  {result?.status === "running" && (
                    <span className="text-xs text-amber-500">paying…</span>
                  )}
                  {result?.status === "paid" && result.signature && (
                    <a
                      href={explorerTxUrl(result.signature)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline text-green-600"
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

      <footer className="mt-auto pt-8 text-xs text-neutral-400">
        Same on-chain engine as SEA Payroll — here triggered autonomously by
        code instead of a human clicking "pay." Devnet demo.
      </footer>
    </div>
  );
}
