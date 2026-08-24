import { Connection, Keypair, sendAndConfirmTransaction } from "@solana/web3.js";
import { buildBatchPaymentTx, DEVNET_RPC, USDC_DEVNET_MINT } from "./solana";

export interface UsdcPayoutInstruction {
  workerRef: string;
  amount: string;
  usdcAddress: string;
}

export interface UsdcPayoutResult {
  signature: string | null;
  status: "demo_paid" | "paid" | "failed";
  demo: boolean;
  error?: string;
}

// Demo USDC rail — wraps the existing Solana batch-payment code and either
// simulates a settlement (default) or, only when TIBA_USDC_SEND=1 and a funded
// AGENT_WALLET_SECRET_KEY is provided, attempts a real Devnet transaction.
// This is not production settlement and does not touch a licensed local rail.
export async function submitUsdcPayout(
  instructions: UsdcPayoutInstruction[],
  runId: string
): Promise<UsdcPayoutResult> {
  if (instructions.length === 0) {
    return { signature: null, status: "demo_paid", demo: true };
  }

  const sendForReal = process.env.TIBA_USDC_SEND === "1";
  const payments = instructions
    .map((i) => ({
      name: i.workerRef,
      address: i.usdcAddress,
      amount: parseFloat(i.amount),
    }))
    .filter((p) => !Number.isNaN(p.amount) && p.amount > 0);

  if (payments.length === 0) {
    return {
      signature: null,
      status: "failed",
      demo: true,
      error: "No valid USDC amounts",
    };
  }

  const connection = new Connection(DEVNET_RPC, "confirmed");
  let payer: Keypair;

  if (sendForReal) {
    const { getAgentKeypair } = await import("./agentWallet");
    payer = getAgentKeypair();
  } else {
    // Demo only: a throwaway keypair is enough to build the transaction.
    payer = Keypair.generate();
  }

  try {
    const tx = await buildBatchPaymentTx(
      connection,
      payer.publicKey,
      payments,
      USDC_DEVNET_MINT
    );
    tx.feePayer = payer.publicKey;

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;

    if (!sendForReal) {
      const signature = `DEMO-${runId}-${Date.now()}`;
      // eslint-disable-next-line no-console
      console.log(
        `[USDC demo] built batch tx for ${payments.length} recipient(s); not sent.`
      );
      return { signature, status: "demo_paid", demo: true };
    }

    const signature = await sendAndConfirmTransaction(connection, tx, [payer], {
      commitment: "confirmed",
    });
    return { signature, status: "paid", demo: false };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("[USDC rail] build/send failed:", error);
    if (!sendForReal) {
      const signature = `DEMO-${runId}-${Date.now()}`;
      return {
        signature,
        status: "demo_paid",
        demo: true,
        error,
      };
    }
    return { signature: null, status: "failed", demo: false, error };
  }
}
