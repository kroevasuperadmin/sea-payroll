import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { AGENT_TASKS } from "@/lib/agentTasks";
import { USDC_DEVNET_MINT } from "@/lib/solana";

const AGENT = Keypair.generate();

const connectionStub = {
  getTokenAccountBalance: vi.fn(),
  getLatestBlockhash: vi.fn(),
  sendRawTransaction: vi.fn(),
  confirmTransaction: vi.fn(),
};

vi.mock("@solana/web3.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solana/web3.js")>();
  return {
    ...actual,
    Connection: vi.fn(() => connectionStub),
  };
});

vi.mock("@solana/spl-token", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solana/spl-token")>();
  return { ...actual, getMint: vi.fn() };
});

vi.mock("@/lib/agentWallet", () => ({
  getAgentKeypair: vi.fn(),
}));

const { getMint } = await import("@solana/spl-token");
const { getAgentKeypair } = await import("@/lib/agentWallet");

const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const BLOCKHASH = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const TASK = AGENT_TASKS[0];

// The route keeps per-instance replay state, so each test gets a fresh module.
async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

function postRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAgentKeypair).mockReturnValue(AGENT);
  vi.mocked(getMint).mockResolvedValue({ decimals: 6 } as Awaited<
    ReturnType<typeof getMint>
  >);
  connectionStub.getTokenAccountBalance.mockResolvedValue({
    value: { uiAmount: 100 },
  });
  connectionStub.getLatestBlockhash.mockResolvedValue({
    blockhash: BLOCKHASH,
    lastValidBlockHeight: 1234,
  });
  connectionStub.sendRawTransaction.mockResolvedValue("sig-abc");
  connectionStub.confirmTransaction.mockResolvedValue({ value: { err: null } });
});

describe("POST /api/agent-pay", () => {
  it("rejects a taskId that is not in the approved list", async () => {
    const { POST } = await loadRoute();
    const res = await POST(postRequest({ taskId: "nope" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Unknown taskId — not in the approved task list",
    });
    expect(connectionStub.sendRawTransaction).not.toHaveBeenCalled();
  });

  it("rejects a caller-supplied address/amount without a known taskId", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      postRequest({
        address: Keypair.generate().publicKey.toBase58(),
        amount: 999,
      })
    );

    expect(res.status).toBe(400);
    expect(connectionStub.sendRawTransaction).not.toHaveBeenCalled();
  });

  it("returns 503 without paying when the agent wallet is underfunded", async () => {
    connectionStub.getTokenAccountBalance.mockResolvedValue({
      value: { uiAmount: 0 },
    });
    const { POST } = await loadRoute();
    const res = await POST(postRequest({ taskId: TASK.id }));

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain("refill pending");
    expect(connectionStub.sendRawTransaction).not.toHaveBeenCalled();
  });

  it("pays the approved amount to the approved worker and returns a receipt", async () => {
    const { POST } = await loadRoute();
    const res = await POST(postRequest({ taskId: TASK.id }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      signature: "sig-abc",
      explorerUrl:
        "https://explorer.solana.com/tx/sig-abc?cluster=devnet",
      agentAddress: AGENT.publicKey.toBase58(),
    });

    const raw = connectionStub.sendRawTransaction.mock.calls[0][0];
    const tx = Transaction.from(raw);
    expect(tx.recentBlockhash).toBe(BLOCKHASH);
    expect(tx.feePayer?.equals(AGENT.publicKey)).toBe(true);
    expect(tx.verifySignatures()).toBe(true);
    expect(tx.instructions).toHaveLength(3);

    const [memo, , transfer] = tx.instructions;
    expect(memo.programId.toBase58()).toBe(MEMO_PROGRAM_ID);
    expect(memo.data.toString("utf-8")).toBe(`Agent auto-pay: ${TASK.reason}`);

    const workerAta = await getAssociatedTokenAddress(
      USDC_DEVNET_MINT,
      new PublicKey(TASK.address)
    );
    expect(transfer.keys[2].pubkey.equals(workerAta)).toBe(true);
    expect(transfer.data.readBigUInt64LE(1)).toBe(
      BigInt(Math.round(TASK.amount * 1e6))
    );
    expect(transfer.data[9]).toBe(6);

    expect(connectionStub.confirmTransaction).toHaveBeenCalledWith(
      {
        signature: "sig-abc",
        blockhash: BLOCKHASH,
        lastValidBlockHeight: 1234,
      },
      "confirmed"
    );
  });

  it("scales the amount using the mint's decimals", async () => {
    vi.mocked(getMint).mockResolvedValue({ decimals: 9 } as Awaited<
      ReturnType<typeof getMint>
    >);
    const { POST } = await loadRoute();
    await POST(postRequest({ taskId: TASK.id }));

    const tx = Transaction.from(
      connectionStub.sendRawTransaction.mock.calls[0][0]
    );
    expect(tx.instructions[2].data.readBigUInt64LE(1)).toBe(
      BigInt(Math.round(TASK.amount * 1e9))
    );
  });

  it("replays the original receipt instead of paying a task twice", async () => {
    const { POST } = await loadRoute();
    await POST(postRequest({ taskId: TASK.id }));
    const res = await POST(postRequest({ taskId: TASK.id }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      signature: "sig-abc",
      explorerUrl: "https://explorer.solana.com/tx/sig-abc?cluster=devnet",
      agentAddress: AGENT.publicKey.toBase58(),
      replayed: true,
    });
    expect(connectionStub.sendRawTransaction).toHaveBeenCalledTimes(1);
  });

  it("still pays a different task after one has been paid", async () => {
    const other = AGENT_TASKS[1];
    connectionStub.sendRawTransaction
      .mockResolvedValueOnce("sig-1")
      .mockResolvedValueOnce("sig-2");

    const { POST } = await loadRoute();
    await POST(postRequest({ taskId: TASK.id }));
    const res = await POST(postRequest({ taskId: other.id }));

    expect((await res.json()).signature).toBe("sig-2");
    expect(connectionStub.sendRawTransaction).toHaveBeenCalledTimes(2);
  });

  it("does not record a payment when sending fails, so it can be retried", async () => {
    connectionStub.sendRawTransaction
      .mockRejectedValueOnce(new Error("blockhash not found"))
      .mockResolvedValueOnce("sig-retry");

    const { POST } = await loadRoute();
    const failed = await POST(postRequest({ taskId: TASK.id }));
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({
      error: "blockhash not found",
    });

    const retried = await POST(postRequest({ taskId: TASK.id }));
    expect((await retried.json()).signature).toBe("sig-retry");
  });

  it("returns 500 when the agent wallet is not configured", async () => {
    vi.mocked(getAgentKeypair).mockImplementation(() => {
      throw new Error("AGENT_WALLET_SECRET_KEY not set");
    });
    const { POST } = await loadRoute();
    const res = await POST(postRequest({ taskId: TASK.id }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "AGENT_WALLET_SECRET_KEY not set",
    });
  });

  it("returns 500 on a malformed request body", async () => {
    const { POST } = await loadRoute();
    const res = await POST({
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    } as unknown as NextRequest);

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Unexpected end of JSON input");
  });

  it("stringifies non-Error failures", async () => {
    connectionStub.getLatestBlockhash.mockRejectedValue("rpc exploded");
    const { POST } = await loadRoute();
    const res = await POST(postRequest({ taskId: TASK.id }));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("rpc exploded");
  });
});

describe("GET /api/agent-pay", () => {
  it("reports the agent's address and explorer link", async () => {
    const { GET } = await loadRoute();
    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      agentAddress: AGENT.publicKey.toBase58(),
      explorerUrl: `https://explorer.solana.com/address/${AGENT.publicKey.toBase58()}?cluster=devnet`,
    });
  });

  it("returns 500 when the agent wallet is not configured", async () => {
    vi.mocked(getAgentKeypair).mockImplementation(() => {
      throw new Error("AGENT_WALLET_SECRET_KEY not set");
    });
    const { GET } = await loadRoute();
    const res = await GET();

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "AGENT_WALLET_SECRET_KEY not set",
    });
  });
});
