"use client";

import Link from "next/link";
import { useState } from "react";
import { explorerTxUrl } from "@/lib/solana";
import { AGENT_TASKS } from "@/lib/agentTasks";

interface TaskResult {
  taskId: string;
  status: "pending" | "running" | "paid" | "failed";
  signature?: string;
  error?: string;
}

interface AgentApiResponse {
  agentAddress?: string;
  signature?: string;
  error?: string;
}

async function readAgentResponse(res: Response): Promise<AgentApiResponse> {
  let body: unknown;
  try {
    body = await res.json();
  } catch (error) {
    throw new Error("Agent API returned an invalid response", { cause: error });
  }

  if (typeof body !== "object" || body === null) {
    throw new Error("Agent API returned an invalid response");
  }

  const data: AgentApiResponse = {
    agentAddress:
      "agentAddress" in body && typeof body.agentAddress === "string"
        ? body.agentAddress
        : undefined,
    signature:
      "signature" in body && typeof body.signature === "string"
        ? body.signature
        : undefined,
    error:
      "error" in body && typeof body.error === "string"
        ? body.error
        : undefined,
  };

  if (!res.ok) {
    throw new Error(data.error || `Agent API request failed (${res.status})`);
  }

  return data;
}

export default function AgentDemo() {
  const [results, setResults] = useState<Record<string, TaskResult>>({});
  const [running, setRunning] = useState(false);
  const [agentAddress, setAgentAddress] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);

  const loadAgentAddress = async (): Promise<string | null> => {
    setAgentError(null);
    try {
      const res = await fetch("/api/agent-pay");
      const data = await readAgentResponse(res);
      if (!data.agentAddress) {
        throw new Error("Agent API response did not include a wallet address");
      }

      setAgentAddress(data.agentAddress);
      return data.agentAddress;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAgentError(message);
      return null;
    }
  };

  const runAgentCycle = async () => {
    setRunning(true);
    setAgentError(null);

    try {
      if (!agentAddress && !(await loadAgentAddress())) return;

      for (const task of AGENT_TASKS) {
        setResults((r) => ({
          ...r,
          [task.id]: { taskId: task.id, status: "running" },
        }));
        try {
          const res = await fetch("/api/agent-pay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId: task.id }),
          });
          const data = await readAgentResponse(res);
          if (!data.signature) {
            throw new Error(
              "Agent API response did not include a transaction signature"
            );
          }
          setResults((r) => ({
            ...r,
            [task.id]: {
              taskId: task.id,
              status: "paid",
              signature: data.signature,
            },
          }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          setResults((r) => ({
            ...r,
            [task.id]: { taskId: task.id, status: "failed", error: message },
          }));
        }
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-14 flex flex-col gap-10">
      <header>
        <Link
          href="/"
          className="text-xs text-[#5A6B70] hover:text-[#123B63] transition-colors"
        >
          ← back to Tiba
        </Link>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[#5A6B70] mt-4 mb-3">
          Autonomous Payments
        </p>
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

      <section className="rounded-2xl border border-[#123B63]/12 bg-[#123B63]/[0.04] p-5 text-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <span className="text-[#5A6B70]">Agent wallet</span>
          {agentAddress ? (
            <a
              href={`https://explorer.solana.com/address/${agentAddress}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs underline decoration-dotted decoration-[#5A6B70] hover:text-[#123B63] break-all"
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
        {agentError && (
          <p className="mt-3 text-xs text-red-500" role="alert">
            {agentError}
          </p>
        )}
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
                className="rounded-lg border border-[#123B63]/12 bg-white px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
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
