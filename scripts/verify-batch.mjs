// Verifies the real batch-payment code path (used by the main SEA Payroll UI)
// against the actual funded agent wallet + real devnet USDC mint, paying
// multiple workers atomically in one transaction.
import { Connection, Keypair } from "@solana/web3.js";
import { getAssociatedTokenAddress, getMint } from "@solana/spl-token";
import {
  USDC_DEVNET_MINT,
  buildPaymentTx,
  signSendAndConfirm,
} from "./lib/batch.mjs";

const AGENT_SECRET = JSON.parse(process.env.AGENT_WALLET_SECRET_KEY);
const agent = Keypair.fromSecretKey(Uint8Array.from(AGENT_SECRET));

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const workers = [
  { name: "Maria", address: "VYmSFKPM6oxW26hhpVsZ55ST2SyJQWCidQvPo4xLdRJ", amount: 1.5 },
  { name: "Budi", address: "CGJ2DbQtFs4fas9r3BSKqKBZ3JeRXnboLZoBfde6v8Zz", amount: 2 },
  { name: "Linh", address: "7DLdKZEzZgpLEmGVaWFwE3mtAbxc8Uf1L7YHABzkoPqG", amount: 1 },
];

const { decimals } = await getMint(connection, USDC_DEVNET_MINT);
const total = workers.reduce((sum, w) => sum + w.amount, 0);

const tx = await buildPaymentTx({
  payer: agent.publicKey,
  payerAta: await getAssociatedTokenAddress(USDC_DEVNET_MINT, agent.publicKey),
  payments: workers,
  memo: `SEA Payroll batch: ${workers.length} workers, ${total.toFixed(2)} USDC total`,
  mint: USDC_DEVNET_MINT,
  decimals,
});

await signSendAndConfirm(connection, tx, agent);
