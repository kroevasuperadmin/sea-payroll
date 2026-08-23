import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getMint,
} from "@solana/spl-token";
import { getAgentKeypair } from "@/lib/agentWallet";
import {
  DEVNET_RPC,
  USDC_DEVNET_MINT,
  assertTransactionConfirmed,
  explorerAddressUrl,
  getUsdcBalance,
} from "@/lib/solana";
import { AGENT_TASKS } from "@/lib/agentTasks";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

// Tracks which task ids have already been paid this server instance, keyed to
// the signature so a replay returns the original receipt instead of paying
// twice. Best-effort for the public demo (a fresh serverless instance won't
// remember it) — not a substitute for real persistence in production.
const paidTaskIds = new Map<string, string>();

function internalError(message: string, error: unknown) {
  console.error(message, error);
  return NextResponse.json({ error: message }, { status: 500 });
}

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
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      );
    }

    const rawTaskId =
      typeof body === "object" &&
      body !== null &&
      "taskId" in body &&
      typeof body.taskId === "string"
        ? body.taskId
        : null;
    const taskId = rawTaskId?.trim() || null;
    if (!taskId) {
      return NextResponse.json(
        { error: "taskId must be a non-empty string" },
        { status: 400 }
      );
    }

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
        explorerUrl: `https://explorer.solana.com/tx/${priorSignature}?cluster=devnet`,
        agentAddress: getAgentKeypair().publicKey.toBase58(),
        replayed: true,
      });
    }

    const { address: workerAddress, amount, reason } = task;

    const connection = new Connection(DEVNET_RPC, "confirmed");
    const agent = getAgentKeypair();
    const worker = new PublicKey(workerAddress);

    const agentBalance = await getUsdcBalance(connection, agent.publicKey);
    if (agentBalance < amount) {
      return NextResponse.json(
        {
          error: `Agent wallet holds ${agentBalance.toFixed(2)} devnet USDC, task needs ${amount.toFixed(2)} — refill pending`,
        },
        { status: 503 }
      );
    }

    const mintInfo = await getMint(connection, USDC_DEVNET_MINT);
    const decimals = mintInfo.decimals;

    const agentAta = await getAssociatedTokenAddress(
      USDC_DEVNET_MINT,
      agent.publicKey
    );
    const workerAta = await getAssociatedTokenAddress(USDC_DEVNET_MINT, worker);

    const tx = new Transaction();
    tx.add(
      new TransactionInstruction({
        keys: [{ pubkey: agent.publicKey, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(
          `Agent auto-pay: ${reason ?? "task completed"}`,
          "utf-8"
        ),
      })
    );
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        agent.publicKey,
        workerAta,
        worker,
        USDC_DEVNET_MINT
      )
    );
    const rawAmount = BigInt(Math.round(amount * 10 ** decimals));
    tx.add(
      createTransferCheckedInstruction(
        agentAta,
        USDC_DEVNET_MINT,
        workerAta,
        agent.publicKey,
        rawAmount,
        decimals
      )
    );

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = agent.publicKey;
    tx.sign(agent);

    const signature = await connection.sendRawTransaction(tx.serialize());
    const confirmation = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    assertTransactionConfirmed(signature, confirmation.value);
    paidTaskIds.set(taskId, signature);

    return NextResponse.json({
      signature,
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      agentAddress: agent.publicKey.toBase58(),
    });
  } catch (err) {
    return internalError("Agent payment could not be completed", err);
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
    return internalError("Agent wallet is unavailable", err);
  }
}
