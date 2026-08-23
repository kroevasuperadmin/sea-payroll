import { timingSafeEqual } from "node:crypto";
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

const RATE_LIMIT_MAX_REQUESTS = 12;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_ENTRIES = 10_000;
const GLOBAL_PAYOUT_CAP_USDC = 5;
const GLOBAL_PAYOUT_WINDOW_MS = 60 * 60 * 1_000;
const rateLimitRequests = new Map<string, number[]>();
const payoutReservations: { at: number; amount: number }[] = [];

// These in-memory controls are per-instance and best-effort; they are not persistence.
function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  return (
    forwardedFor?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function getRequestOrigin(req: NextRequest) {
  const forwardedHost = req.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const forwardedProto = req.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .replace(/:$/, "");
  if (forwardedHost && forwardedProto) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  const host = req.headers.get("host")?.trim();
  return host ? `${req.nextUrl.protocol}//${host}` : req.nextUrl.origin;
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const recentRequests = (rateLimitRequests.get(ip) ?? []).filter(
    (timestamp) => timestamp > cutoff
  );
  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitRequests.set(ip, recentRequests);
    return true;
  }
  recentRequests.push(now);
  rateLimitRequests.set(ip, recentRequests);
  if (rateLimitRequests.size > RATE_LIMIT_MAX_ENTRIES) {
    for (const [knownIp, timestamps] of rateLimitRequests) {
      if (timestamps.every((timestamp) => timestamp <= cutoff)) {
        rateLimitRequests.delete(knownIp);
      }
      if (rateLimitRequests.size <= RATE_LIMIT_MAX_ENTRIES) {
        break;
      }
    }
    while (rateLimitRequests.size > RATE_LIMIT_MAX_ENTRIES) {
      const oldestIp = rateLimitRequests.keys().next().value;
      if (oldestIp === undefined) {
        break;
      }
      rateLimitRequests.delete(oldestIp);
    }
  }
  return false;
}

function reservePayout(amount: number) {
  const now = Date.now();
  const cutoff = now - GLOBAL_PAYOUT_WINDOW_MS;
  while (payoutReservations[0]?.at <= cutoff) {
    payoutReservations.shift();
  }
  const paidOut = payoutReservations.reduce(
    (total, reservation) => total + reservation.amount,
    0
  );
  if (paidOut + amount > GLOBAL_PAYOUT_CAP_USDC) {
    return null;
  }
  const reservation = { at: now, amount };
  payoutReservations.push(reservation);
  return reservation;
}

function releasePayout(reservation: { at: number; amount: number }) {
  const index = payoutReservations.indexOf(reservation);
  if (index !== -1) {
    payoutReservations.splice(index, 1);
  }
}

function hasMatchingSecret(provided: string, expected: string) {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

function getAuthorizationState(req: NextRequest) {
  const configuredSecret = process.env.AGENT_API_SECRET;
  const authorization = req.headers.get("authorization");
  if (!configuredSecret || !authorization) {
    return "browser";
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const providedSecret = match?.[1].trim();
  return providedSecret && hasMatchingSecret(providedSecret, configuredSecret)
    ? "trusted"
    : "unauthorized";
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
  const authorizationState = getAuthorizationState(req);
  if (authorizationState === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isTrustedCaller = authorizationState === "trusted";
  const origin = req.headers.get("origin");
  const isSameOriginFetch =
    req.headers.get("sec-fetch-site")?.toLowerCase() === "same-origin";
  const originMatches = origin === getRequestOrigin(req);
  if (!isTrustedCaller && !isSameOriginFetch && !originMatches) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isTrustedCaller && isRateLimited(getClientIp(req))) {
    return NextResponse.json(
      { error: "Too many requests — try again later" },
      { status: 429 }
    );
  }

  let payoutReservation: { at: number; amount: number } | undefined;
  let transactionSubmitted = false;
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
    if (
      typeof body !== "object" ||
      body === null ||
      !("taskId" in body) ||
      typeof body.taskId !== "string" ||
      body.taskId.trim() === ""
    ) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
    const taskId = body.taskId;

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
    payoutReservation = reservePayout(amount) ?? undefined;
    if (!payoutReservation) {
      return NextResponse.json(
        { error: "Payment limit exceeded — try again later" },
        { status: 429 }
      );
    }

    const connection = new Connection(DEVNET_RPC, "confirmed");
    const agent = getAgentKeypair();
    const worker = new PublicKey(workerAddress);

    const agentBalance = await getUsdcBalance(connection, agent.publicKey);
    if (agentBalance < amount) {
      releasePayout(payoutReservation);
      payoutReservation = undefined;
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
    transactionSubmitted = true;
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    paidTaskIds.set(taskId, signature);

    return NextResponse.json({
      signature,
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      agentAddress: agent.publicKey.toBase58(),
    });
  } catch (err) {
    if (payoutReservation && !transactionSubmitted) {
      releasePayout(payoutReservation);
    }
    console.error("Agent payment failed", err);
    return NextResponse.json(
      { error: "Agent payment failed" },
      { status: 500 }
    );
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
    console.error("Agent wallet status failed", err);
    return NextResponse.json(
      { error: "Agent wallet unavailable" },
      { status: 500 }
    );
  }
}
