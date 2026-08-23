// One-off sanity check (per council must-fix): prove a single Solana transaction
// carrying multiple SPL transfer instructions actually confirms on devnet before
// any UI is built. Uses a throwaway test mint (same code path as real USDC-Dev,
// just decoupled from the Circle faucet for this test).
import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import { buildPaymentTx, signSendAndConfirm } from "./lib/batch.mjs";

const DECIMALS = 6;

async function airdropWithRetry(connection, pubkey, sol, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const sig = await connection.requestAirdrop(pubkey, sol * 1e9);
      await connection.confirmTransaction(sig, "confirmed");
      return;
    } catch (e) {
      console.log(`airdrop attempt ${i + 1} failed: ${e.message}, retrying...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error("airdrop failed after retries");
}

async function main() {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  const employer = Keypair.generate();
  console.log("employer:", employer.publicKey.toBase58());
  await airdropWithRetry(connection, employer.publicKey, 1);
  console.log("airdrop confirmed");

  const mint = await createMint(
    connection,
    employer,
    employer.publicKey,
    null,
    DECIMALS
  );
  console.log("test mint:", mint.toBase58());

  const employerAta = await getOrCreateAssociatedTokenAccount(
    connection,
    employer,
    mint,
    employer.publicKey
  );
  await mintTo(
    connection,
    employer,
    mint,
    employerAta.address,
    employer,
    1_000 * 10 ** DECIMALS
  );
  console.log("minted 1000 test-USDC to employer");

  const amounts = [10.5, 22, 7.25, 15, 40];
  const workers = amounts.map((amount) => ({
    keypair: Keypair.generate(),
    amount,
  }));

  const tx = await buildPaymentTx({
    payer: employer.publicKey,
    payerAta: employerAta.address,
    payments: workers.map((w) => ({
      address: w.keypair.publicKey.toBase58(),
      amount: w.amount,
    })),
    memo: `SEA Payroll sanity test: ${workers.length} workers`,
    mint,
    decimals: DECIMALS,
  });

  await signSendAndConfirm(connection, tx, employer);

  for (const [i, worker] of workers.entries()) {
    const ata = await getAssociatedTokenAddress(mint, worker.keypair.publicKey);
    const acct = await getAccount(connection, ata);
    console.log(`worker ${i} balance:`, Number(acct.amount) / 10 ** DECIMALS);
  }
}

main().catch((e) => {
  console.error("SANITY TEST FAILED:", e);
  process.exit(1);
});
