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

// Circle's official Solana Devnet USDC mint — see developers.circle.com
export const USDC_DEVNET_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

export const DEVNET_RPC = "https://api.devnet.solana.com";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

function memoInstruction(memo: string, signer: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf-8"),
  });
}

export interface WorkerPayment {
  name: string;
  address: string;
  amount: number;
}

// Max workers per batch, kept low so the single transaction stays well under
// Solana's ~1232 byte transaction size limit (each worker adds an ATA-create +
// a transferChecked instruction).
export const MAX_BATCH_SIZE = 8;

export async function buildBatchPaymentTx(
  connection: Connection,
  employer: PublicKey,
  payments: WorkerPayment[],
  mint: PublicKey = USDC_DEVNET_MINT
): Promise<Transaction> {
  if (payments.length === 0) throw new Error("No workers to pay");
  if (payments.length > MAX_BATCH_SIZE) {
    throw new Error(`Batch too large — max ${MAX_BATCH_SIZE} workers per transaction`);
  }

  const mintInfo = await getMint(connection, mint);
  const decimals = mintInfo.decimals;

  const employerAta = await getAssociatedTokenAddress(mint, employer);

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const tx = new Transaction();
  tx.add(
    memoInstruction(
      `SEA Payroll batch: ${payments.length} workers, ${totalAmount.toFixed(2)} USDC total`,
      employer
    )
  );

  for (const p of payments) {
    const workerPubkey = new PublicKey(p.address);
    const workerAta = await getAssociatedTokenAddress(mint, workerPubkey);

    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        employer,
        workerAta,
        workerPubkey,
        mint
      )
    );

    const rawAmount = BigInt(Math.round(p.amount * 10 ** decimals));
    tx.add(
      createTransferCheckedInstruction(
        employerAta,
        mint,
        workerAta,
        employer,
        rawAmount,
        decimals
      )
    );
  }

  return tx;
}

export async function getUsdcBalance(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey = USDC_DEVNET_MINT
): Promise<number> {
  try {
    const ata = await getAssociatedTokenAddress(mint, owner);
    const balance = await connection.getTokenAccountBalance(ata);
    return balance.value.uiAmount ?? 0;
  } catch {
    return 0;
  }
}

export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function explorerAddressUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}
