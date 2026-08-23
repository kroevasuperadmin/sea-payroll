import {
  Connection,
  Keypair,
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

export function isValidAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

// Builds the one transaction that settles every payment atomically: a memo
// recording the audit note, then an idempotent ATA-create plus a
// transferChecked per recipient. Shared by the employer-signed payroll batch
// and the agent's autonomous single-task payment.
export async function buildPaymentTx(
  connection: Connection,
  payer: PublicKey,
  payments: WorkerPayment[],
  memo: string,
  mint: PublicKey = USDC_DEVNET_MINT
): Promise<Transaction> {
  const { decimals } = await getMint(connection, mint);
  const payerAta = await getAssociatedTokenAddress(mint, payer);

  const tx = new Transaction();
  tx.add(memoInstruction(memo, payer));

  for (const payment of payments) {
    const recipient = new PublicKey(payment.address);
    const recipientAta = await getAssociatedTokenAddress(mint, recipient);

    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        payer,
        recipientAta,
        recipient,
        mint
      )
    );

    const rawAmount = BigInt(Math.round(payment.amount * 10 ** decimals));
    tx.add(
      createTransferCheckedInstruction(
        payerAta,
        mint,
        recipientAta,
        payer,
        rawAmount,
        decimals
      )
    );
  }

  return tx;
}

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

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  return buildPaymentTx(
    connection,
    employer,
    payments,
    `SEA Payroll batch: ${payments.length} workers, ${totalAmount.toFixed(2)} USDC total`,
    mint
  );
}

export interface PreparedTx {
  blockhash: string;
  lastValidBlockHeight: number;
}

// Stamps a fresh blockhash and fee payer on the transaction, returning the
// values needed to confirm it afterwards.
export async function prepareTx(
  connection: Connection,
  tx: Transaction,
  feePayer: PublicKey
): Promise<PreparedTx> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = feePayer;
  return { blockhash, lastValidBlockHeight };
}

export async function confirmTx(
  connection: Connection,
  signature: string,
  prepared: PreparedTx
): Promise<void> {
  await connection.confirmTransaction({ signature, ...prepared }, "confirmed");
}

// Server-side send: the signer is a keypair we hold, so we can sign, send and
// confirm without any wallet-approval step.
export async function signSendAndConfirmTx(
  connection: Connection,
  tx: Transaction,
  signer: Keypair
): Promise<string> {
  const prepared = await prepareTx(connection, tx, signer.publicKey);
  tx.sign(signer);
  const signature = await connection.sendRawTransaction(tx.serialize());
  await confirmTx(connection, signature, prepared);
  return signature;
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
