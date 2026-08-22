import { Keypair } from "@solana/web3.js";

export function getAgentKeypair(): Keypair {
  const raw = process.env.AGENT_WALLET_SECRET_KEY;
  if (!raw) {
    throw new Error(
      "AGENT_WALLET_SECRET_KEY not set — the autonomous agent wallet isn't configured."
    );
  }
  const secretKey = Uint8Array.from(JSON.parse(raw));
  return Keypair.fromSecretKey(secretKey);
}
