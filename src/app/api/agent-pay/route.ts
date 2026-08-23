import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { getAgentKeypair } from "@/lib/agentWallet";
import { errorMessage } from "@/lib/errors";
import {
  DEVNET_RPC,
  buildPaymentTx,
  explorerAddressUrl,
  explorerTxUrl,
  getUsdcBalance,
  signSendAndConfirmTx,
} from "@/lib/solana";
import { AGENT_TASKS } from "@/lib/agentTasks";

// Tracks which task ids have already been paid this server instance, keyed to
// the signature so a replay returns the original receipt instead of paying
// twice. Best-effort for the public demo (a fresh serverless instance won't
// remember it) — not a substitute for real persistence in production.
const paidTaskIds = new Map<string, string>();

// Autonomous, server-signed payment — no human wallet-approval step. An
// automated caller hits this endpoint when it has determined a unit of work
// is complete, and payment fires immediately: real machine-to-machine,
// pay-per-task settlement.
//
// The caller selects a task by id only — it cannot supply its own
// address/amount. AGENT_TASKS (imported, shared with the UI) is the sole
// authorization boundary: this endpoint will only ever pay one of those
// pre-approved (worker, amount) pairs, never an arbitrary one, and only once
// per task id per warm instance.
export async function POST(req: NextRequest) {
  try {
    const { taskId } = await req.json();

    const task = AGENT_TASKS.find((t) => t.id === taskId);
    if (!task) {
      return NextResponse.json(
        { error: "Unknown taskId — not in the approved task list" },
        { status: 400 }
      );
    }
    const priorSignature = paidTaskIds.get(taskId);
    if (priorSignature) {
      return NextResponse.json({
        signature: priorSignature,
        explorerUrl: explorerTxUrl(priorSignature),
        agentAddress: getAgentKeypair().publicKey.toBase58(),
        replayed: true,
      });
    }

    const { worker, address, amount, reason } = task;

    const connection = new Connection(DEVNET_RPC, "confirmed");
    const agent = getAgentKeypair();

    const agentBalance = await getUsdcBalance(connection, agent.publicKey);
    if (agentBalance < amount) {
      return NextResponse.json(
        {
          error: `Agent wallet holds ${agentBalance.toFixed(2)} devnet USDC, task needs ${amount.toFixed(2)} — refill pending`,
        },
        { status: 503 }
      );
    }

    const tx = await buildPaymentTx(
      connection,
      agent.publicKey,
      [{ name: worker, address, amount }],
      `Agent auto-pay: ${reason ?? "task completed"}`
    );
    const signature = await signSendAndConfirmTx(connection, tx, agent);
    paidTaskIds.set(taskId, signature);

    return NextResponse.json({
      signature,
      explorerUrl: explorerTxUrl(signature),
      agentAddress: agent.publicKey.toBase58(),
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const agent = getAgentKeypair();
    return NextResponse.json({
      agentAddress: agent.publicKey.toBase58(),
      explorerUrl: explorerAddressUrl(agent.publicKey.toBase58()),
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
