import { describe, it, expect, vi, beforeEach } from "vitest";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";

vi.mock("@solana/spl-token", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solana/spl-token")>();
  return {
    ...actual,
    getMint: vi.fn(),
  };
});

const { getMint } = await import("@solana/spl-token");
const {
  buildBatchPaymentTx,
  getUsdcBalance,
  explorerTxUrl,
  explorerAddressUrl,
  MAX_BATCH_SIZE,
  USDC_DEVNET_MINT,
} = await import("./solana");

const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

const EMPLOYER = new PublicKey("VYmSFKPM6oxW26hhpVsZ55ST2SyJQWCidQvPo4xLdRJ");
const WORKER_A = new PublicKey("CGJ2DbQtFs4fas9r3BSKqKBZ3JeRXnboLZoBfde6v8Zz");
const WORKER_B = new PublicKey("7DLdKZEzZgpLEmGVaWFwE3mtAbxc8Uf1L7YHABzkoPqG");

function mockMint(decimals = 6) {
  vi.mocked(getMint).mockResolvedValue({ decimals } as Awaited<
    ReturnType<typeof getMint>
  >);
}

const connection = {} as Connection;

beforeEach(() => {
  vi.mocked(getMint).mockReset();
});

describe("buildBatchPaymentTx", () => {
  it("rejects an empty batch", async () => {
    mockMint();
    await expect(
      buildBatchPaymentTx(connection, EMPLOYER, [])
    ).rejects.toThrow("No workers to pay");
  });

  it("rejects a batch larger than MAX_BATCH_SIZE", async () => {
    mockMint();
    const payments = Array.from({ length: MAX_BATCH_SIZE + 1 }, (_, i) => ({
      name: `w${i}`,
      address: WORKER_A.toBase58(),
      amount: 1,
    }));
    await expect(
      buildBatchPaymentTx(connection, EMPLOYER, payments)
    ).rejects.toThrow(`max ${MAX_BATCH_SIZE} workers`);
  });

  it("accepts exactly MAX_BATCH_SIZE workers", async () => {
    mockMint();
    const payments = Array.from({ length: MAX_BATCH_SIZE }, (_, i) => ({
      name: `w${i}`,
      address: WORKER_A.toBase58(),
      amount: 1,
    }));
    const tx = await buildBatchPaymentTx(connection, EMPLOYER, payments);
    // 1 memo + (ATA create + transfer) per worker
    expect(tx.instructions).toHaveLength(1 + 2 * MAX_BATCH_SIZE);
  });

  it("puts a memo first that reports worker count and total", async () => {
    mockMint();
    const tx = await buildBatchPaymentTx(connection, EMPLOYER, [
      { name: "A", address: WORKER_A.toBase58(), amount: 1.5 },
      { name: "B", address: WORKER_B.toBase58(), amount: 2.25 },
    ]);

    const memo = tx.instructions[0];
    expect(memo.programId.toBase58()).toBe(MEMO_PROGRAM_ID);
    expect(memo.data.toString("utf-8")).toBe(
      "SEA Payroll batch: 2 workers, 3.75 USDC total"
    );
    expect(memo.keys).toEqual([
      { pubkey: EMPLOYER, isSigner: true, isWritable: false },
    ]);
  });

  it("emits an idempotent ATA-create and a transferChecked per worker", async () => {
    mockMint();
    const tx = await buildBatchPaymentTx(connection, EMPLOYER, [
      { name: "A", address: WORKER_A.toBase58(), amount: 1 },
      { name: "B", address: WORKER_B.toBase58(), amount: 2 },
    ]);

    expect(tx.instructions).toHaveLength(5);
    const employerAta = await getAssociatedTokenAddress(
      USDC_DEVNET_MINT,
      EMPLOYER
    );

    for (const [i, worker] of [WORKER_A, WORKER_B].entries()) {
      const create = tx.instructions[1 + i * 2];
      const transfer = tx.instructions[2 + i * 2];
      const workerAta = await getAssociatedTokenAddress(
        USDC_DEVNET_MINT,
        worker
      );

      expect(create.keys[1].pubkey.equals(workerAta)).toBe(true);
      expect(transfer.programId.equals(TOKEN_PROGRAM_ID)).toBe(true);
      expect(transfer.keys[0].pubkey.equals(employerAta)).toBe(true);
      expect(transfer.keys[2].pubkey.equals(workerAta)).toBe(true);
      expect(transfer.keys[3].pubkey.equals(EMPLOYER)).toBe(true);
    }
  });

  it("scales amounts by the mint's decimals", async () => {
    mockMint(6);
    const tx = await buildBatchPaymentTx(connection, EMPLOYER, [
      { name: "A", address: WORKER_A.toBase58(), amount: 1.23 },
    ]);
    // transferChecked layout: [instruction(1), amount(u64), decimals(1)]
    const data = tx.instructions[2].data;
    expect(data.readBigUInt64LE(1)).toBe(BigInt(1_230_000));
    expect(data[9]).toBe(6);
  });

  it("uses the decimals returned by the mint rather than assuming 6", async () => {
    mockMint(9);
    const tx = await buildBatchPaymentTx(connection, EMPLOYER, [
      { name: "A", address: WORKER_A.toBase58(), amount: 0.5 },
    ]);
    const data = tx.instructions[2].data;
    expect(data.readBigUInt64LE(1)).toBe(BigInt(500_000_000));
    expect(data[9]).toBe(9);
  });

  it("rounds fractional base units instead of truncating", async () => {
    mockMint(2);
    const tx = await buildBatchPaymentTx(connection, EMPLOYER, [
      { name: "A", address: WORKER_A.toBase58(), amount: 0.125 },
    ]);
    expect(tx.instructions[2].data.readBigUInt64LE(1)).toBe(BigInt(13));
  });

  it("propagates an invalid worker address", async () => {
    mockMint();
    await expect(
      buildBatchPaymentTx(connection, EMPLOYER, [
        { name: "A", address: "not-a-real-address", amount: 1 },
      ])
    ).rejects.toThrow();
  });

  it("honours a custom mint", async () => {
    mockMint();
    const customMint = new PublicKey(
      "So11111111111111111111111111111111111111112"
    );
    const tx = await buildBatchPaymentTx(
      connection,
      EMPLOYER,
      [{ name: "A", address: WORKER_A.toBase58(), amount: 1 }],
      customMint
    );

    expect(vi.mocked(getMint).mock.calls[0][1].equals(customMint)).toBe(true);
    expect(tx.instructions[2].keys[1].pubkey.equals(customMint)).toBe(true);
  });
});

describe("getUsdcBalance", () => {
  it("returns the uiAmount of the owner's associated token account", async () => {
    const conn = {
      getTokenAccountBalance: vi
        .fn()
        .mockResolvedValue({ value: { uiAmount: 12.5 } }),
    } as unknown as Connection;

    await expect(getUsdcBalance(conn, EMPLOYER)).resolves.toBe(12.5);

    const expectedAta = await getAssociatedTokenAddress(
      USDC_DEVNET_MINT,
      EMPLOYER
    );
    const calledWith = vi.mocked(conn.getTokenAccountBalance).mock.calls[0][0];
    expect(calledWith.equals(expectedAta)).toBe(true);
  });

  it("returns 0 when the account has a null uiAmount", async () => {
    const conn = {
      getTokenAccountBalance: vi
        .fn()
        .mockResolvedValue({ value: { uiAmount: null } }),
    } as unknown as Connection;
    await expect(getUsdcBalance(conn, EMPLOYER)).resolves.toBe(0);
  });

  it("returns 0 when the token account does not exist", async () => {
    const conn = {
      getTokenAccountBalance: vi
        .fn()
        .mockRejectedValue(new Error("could not find account")),
    } as unknown as Connection;
    await expect(getUsdcBalance(conn, EMPLOYER)).resolves.toBe(0);
  });
});

describe("explorer urls", () => {
  it("builds a devnet transaction url", () => {
    expect(explorerTxUrl("sig123")).toBe(
      "https://explorer.solana.com/tx/sig123?cluster=devnet"
    );
  });

  it("builds a devnet address url", () => {
    expect(explorerAddressUrl("addr123")).toBe(
      "https://explorer.solana.com/address/addr123?cluster=devnet"
    );
  });
});

describe("constants", () => {
  it("uses Circle's official devnet USDC mint", () => {
    expect(USDC_DEVNET_MINT.toBase58()).toBe(
      "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
    );
  });

  it("keeps the batch small enough for one transaction", () => {
    expect(MAX_BATCH_SIZE).toBeLessThanOrEqual(8);
  });
});
