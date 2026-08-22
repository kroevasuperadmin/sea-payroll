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

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

// Autonomous, server-signed payment — no human wallet-approval step. An AI
// agent (or any automated caller) hits this endpoint when it has determined
// a unit of work is complete, and payment fires immediately: real
// machine-to-machine, pay-per-task settlement.
export async function POST(req: NextRequest) {
  try {
    const { workerAddress, amount, reason } = await req.json();

    if (!workerAddress || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "workerAddress and a positive numeric amount are required" },
        { status: 400 }
      );
    }

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
