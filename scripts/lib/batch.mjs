// Shared batch-payment plumbing for the devnet verification scripts. Mirrors
// buildPaymentTx in src/lib/solana.ts, but takes the mint decimals and the
// payer's token account directly so it also works with a throwaway test mint.
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";

export const USDC_DEVNET_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

export function memoIx(memo, signer) {
  return new TransactionInstruction({
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf-8"),
  });
}

export async function buildPaymentTx({
  payer,
  payerAta,
  payments,
  memo,
  mint,
  decimals,
}) {
  const tx = new Transaction();
  tx.add(memoIx(memo, payer));

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

export function explorerTxUrl(signature) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

// Signs, sends and confirms, logging the serialized size against Solana's
// legacy transaction limit — the thing both scripts exist to check.
export async function signSendAndConfirm(connection, tx, signer) {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = signer.publicKey;
  tx.sign(signer);

  console.log("instruction count:", tx.instructions.length);
  console.log("serialized tx size (bytes):", tx.serialize().length, "/ 1232 limit");

  const signature = await connection.sendRawTransaction(tx.serialize());
  console.log("sent:", signature);
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  console.log("CONFIRMED:", explorerTxUrl(signature));
  return signature;
}
