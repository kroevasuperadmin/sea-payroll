import { Keypair } from "@solana/web3.js";

export function getAgentKeypair(): Keypair {
  const raw = process.env.AGENT_WALLET_SECRET_KEY;
  if (!raw) {
    throw new Error(
      "AGENT_WALLET_SECRET_KEY not set — the autonomous agent wallet isn't configured."
    );
  }
  // Parse failures must not echo the raw value — callers surface these
  // messages in HTTP responses.
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "AGENT_WALLET_SECRET_KEY is not valid JSON — expected an array of bytes."
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error(
      "AGENT_WALLET_SECRET_KEY must be a JSON array of secret key bytes."
    );
  }
  return Keypair.fromSecretKey(Uint8Array.from(parsed));
}
