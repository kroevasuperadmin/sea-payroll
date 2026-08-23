"use client";

import { useState } from "react";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/solana";
import { errorMessage } from "@/lib/errors";
import { AGENT_TASKS } from "@/lib/agentTasks";
import {
  ADDRESS_LINK_CLASS,
  CARD_CLASS,
  Eyebrow,
  ExternalLink,
  NavLink,
  PANEL_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/components/ui";

interface TaskResult {
  taskId: string;
  status: "pending" | "running" | "paid" | "failed";
  signature?: string;
  error?: string;
}

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
          body: JSON.stringify({ taskId: task.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Payment failed");
        setResults((r) => ({
          ...r,
          [task.id]: { taskId: task.id, status: "paid", signature: data.signature },
        }));
      } catch (err) {
        setResults((r) => ({
          ...r,
          [task.id]: {
            taskId: task.id,
            status: "failed",
            error: errorMessage(err),
          },
        }));
      }
    }
    setRunning(false);
  };

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-14 flex flex-col gap-10">
      <header>
        <NavLink href="/" className="text-xs">
          ← back to Tiba
        </NavLink>
        <Eyebrow className="mt-4 mb-3">Autonomous Payments</Eyebrow>
        <h1 className="font-[family-name:var(--font-editorial)] font-normal text-5xl sm:text-6xl leading-[1.05] text-[#123B63]">
          Autonomous <span className="text-[#E3A63B]">Pay-Per-Task</span>
        </h1>
        <p className="text-base text-[#16343A]/65 mt-3 max-w-md leading-relaxed">
          No human approves each payment. An automated agent (a webhook, a
          verification job, a completion check) confirms a unit of work is
          done and the payment fires immediately, signed by its own Solana
          wallet — real machine-to-machine, usage-metered settlement.
        </p>
        <p className="text-xs text-[#5A6B70] mt-3 max-w-md">
          In this demo, task verification is a pre-set list (below) rather
          than a live webhook — the payment itself is 100% real. In
          production, the trigger source (GPS webhook, API completion event,
          a model call) is swappable; what stays constant is a machine
          holding its own signing key and settling value with no human step.
        </p>
      </header>

      <section className={`${PANEL_CLASS} text-sm`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <span className="text-[#5A6B70]">Agent wallet</span>
          {agentAddress ? (
            <ExternalLink
              href={explorerAddressUrl(agentAddress)}
              className={`${ADDRESS_LINK_CLASS} break-all`}
            >
              {agentAddress}
            </ExternalLink>
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
          <Eyebrow as="h2">Pending agent-verified tasks</Eyebrow>
          <button
            onClick={runAgentCycle}
            disabled={running}
            className={`px-5 py-2 text-sm ${PRIMARY_BUTTON_CLASS}`}
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
                className={`${CARD_CLASS} px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2`}
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
                    <ExternalLink
                      href={explorerTxUrl(result.signature)}
                      className="text-xs underline text-[#123B63]"
                    >
                      paid ↗
                    </ExternalLink>
                  )}
                  {result?.status === "failed" && (
                    <span
                      className="text-xs text-red-500 max-w-[260px] text-right"
                      title={result.error}
                    >
                      {result.error?.includes("refill pending")
                        ? "agent wallet low on devnet USDC"
                        : "failed"}
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
