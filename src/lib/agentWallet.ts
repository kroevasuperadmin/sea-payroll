import { Keypair } from "@solana/web3.js";

export function getAgentKeypair(): Keypair {
  const raw = process.env.AGENT_WALLET_SECRET_KEY;
  if (!raw) {
    throw new Error(
      "AGENT_WALLET_SECRET_KEY not set — the autonomous agent wallet isn't configured."
    );
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        (value) =>
          Number.isInteger(value) && value >= 0 && value <= 255
      )
    ) {
      throw new Error("expected a JSON array of byte values");
    }

    return Keypair.fromSecretKey(Uint8Array.from(parsed));
  } catch (error) {
    throw new Error("AGENT_WALLET_SECRET_KEY is invalid.", { cause: error });
  }
}
