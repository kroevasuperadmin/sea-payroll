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
import { DEVNET_RPC, USDC_DEVNET_MINT, explorerAddressUrl } from "@/lib/solana";
import { AGENT_TASKS } from "@/lib/agentTasks";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

// Tracks which task ids have already been paid this server instance. This is
// a best-effort guard for the public demo (a fresh serverless instance won't
// remember it) — not a substitute for real persistence in production, but it
// stops naive repeat-clicking or scripted replay against a warm instance.
const paidTaskIds = new Set<string>();

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
    if (paidTaskIds.has(taskId)) {
      return NextResponse.json(
        { error: "Task already paid on this instance" },
        { status: 409 }
      );
    }

    const { address: workerAddress, amount, reason } = task;

    const connection = new Connection(DEVNET_RPC, "confirmed");
    const agent = getAgentKeypair();
    const worker = new PublicKey(workerAddress);

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
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    paidTaskIds.add(taskId);

    return NextResponse.json({
      signature,
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      agentAddress: agent.publicKey.toBase58(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
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
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
