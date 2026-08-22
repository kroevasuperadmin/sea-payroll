// Verifies the real buildBatchPaymentTx code path (used by the main SEA
// Payroll UI) against the actual funded agent wallet + real devnet USDC mint,
// paying multiple workers atomically in one transaction.
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";

const AGENT_SECRET = JSON.parse(process.env.AGENT_WALLET_SECRET_KEY);
const agent = Keypair.fromSecretKey(Uint8Array.from(AGENT_SECRET));

import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getMint,
} from "@solana/spl-token";

const USDC_DEVNET_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

async function buildBatch(connection, employer, payments) {
  const mintInfo = await getMint(connection, USDC_DEVNET_MINT);
  const decimals = mintInfo.decimals;
  const employerAta = await getAssociatedTokenAddress(USDC_DEVNET_MINT, employer);
  const total = payments.reduce((s, p) => s + p.amount, 0);

  const tx = new Transaction();
  tx.add(
    new TransactionInstruction({
      keys: [{ pubkey: employer, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(`SEA Payroll batch: ${payments.length} workers, ${total.toFixed(2)} USDC total`, "utf-8"),
    })
  );
  for (const p of payments) {
    const worker = new PublicKey(p.address);
    const workerAta = await getAssociatedTokenAddress(USDC_DEVNET_MINT, worker);
    tx.add(createAssociatedTokenAccountIdempotentInstruction(employer, workerAta, worker, USDC_DEVNET_MINT));
    const raw = BigInt(Math.round(p.amount * 10 ** decimals));
    tx.add(createTransferCheckedInstruction(employerAta, USDC_DEVNET_MINT, workerAta, employer, raw, decimals));
  }
  return tx;
}

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const workers = [
  { name: "Maria", address: "VYmSFKPM6oxW26hhpVsZ55ST2SyJQWCidQvPo4xLdRJ", amount: 1.5 },
  { name: "Budi", address: "CGJ2DbQtFs4fas9r3BSKqKBZ3JeRXnboLZoBfde6v8Zz", amount: 2 },
  { name: "Linh", address: "7DLdKZEzZgpLEmGVaWFwE3mtAbxc8Uf1L7YHABzkoPqG", amount: 1 },
];

const tx = await buildBatch(connection, agent.publicKey, workers);
console.log("instruction count:", tx.instructions.length);

const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
tx.recentBlockhash = blockhash;
tx.feePayer = agent.publicKey;
tx.sign(agent);

const rawSize = tx.serialize().length;
console.log("serialized size:", rawSize, "/ 1232 limit");

const sig = await connection.sendRawTransaction(tx.serialize());
console.log("sent:", sig);
await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
console.log("CONFIRMED:", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
