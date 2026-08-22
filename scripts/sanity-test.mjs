// One-off sanity check (per council must-fix): prove a single Solana transaction
// carrying multiple SPL transfer instructions actually confirms on devnet before
// any UI is built. Uses a throwaway test mint (same code path as real USDC-Dev,
// just decoupled from the Circle faucet for this test).
import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAccount,
} from "@solana/spl-token";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
function memoIx(memo, signer) {
  return new TransactionInstruction({
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf-8"),
  });
}

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

  const mint = await createMint(connection, employer, employer.publicKey, null, 6);
  console.log("test mint:", mint.toBase58());

  const employerAta = await getOrCreateAssociatedTokenAccount(
    connection,
    employer,
    mint,
    employer.publicKey
  );
  await mintTo(connection, employer, mint, employerAta.address, employer, 1_000 * 10 ** 6);
  console.log("minted 1000 test-USDC to employer");

  const workers = Array.from({ length: 5 }, () => Keypair.generate());
  const amounts = [10.5, 22, 7.25, 15, 40];

  const tx = new Transaction();
  tx.add(memoIx(`SEA Payroll sanity test: ${workers.length} workers`, employer.publicKey));

  for (let i = 0; i < workers.length; i++) {
    const workerPubkey = workers[i].publicKey;
    const workerAta = await getAssociatedTokenAddress(mint, workerPubkey);
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        employer.publicKey,
        workerAta,
        workerPubkey,
        mint
      )
    );
    const raw = BigInt(Math.round(amounts[i] * 10 ** 6));
    tx.add(
      createTransferCheckedInstruction(
        employerAta.address,
        mint,
        workerAta,
        employer.publicKey,
        raw,
        6
      )
    );
  }

  console.log("instruction count:", tx.instructions.length);
  const serializedSizeCheck = tx.compileMessage
    ? null
    : null;

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = employer.publicKey;
  tx.sign(employer);

  const rawSize = tx.serialize().length;
  console.log("serialized tx size (bytes):", rawSize, "/ 1232 limit");

  const sig = await connection.sendRawTransaction(tx.serialize());
  console.log("sent:", sig);
  await connection.confirmTransaction(sig, "confirmed");
  console.log("CONFIRMED:", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);

  for (let i = 0; i < workers.length; i++) {
    const ata = await getAssociatedTokenAddress(mint, workers[i].publicKey);
    const acct = await getAccount(connection, ata);
    console.log(`worker ${i} balance:`, Number(acct.amount) / 10 ** 6);
  }
}

main().catch((e) => {
  console.error("SANITY TEST FAILED:", e);
  process.exit(1);
});
