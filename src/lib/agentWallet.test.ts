import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Keypair } from "@solana/web3.js";
import { getAgentKeypair } from "./agentWallet";

const original = process.env.AGENT_WALLET_SECRET_KEY;

beforeEach(() => {
  delete process.env.AGENT_WALLET_SECRET_KEY;
});

afterEach(() => {
  if (original === undefined) delete process.env.AGENT_WALLET_SECRET_KEY;
  else process.env.AGENT_WALLET_SECRET_KEY = original;
});

describe("getAgentKeypair", () => {
  it("throws a configuration error when the secret key is unset", () => {
    expect(() => getAgentKeypair()).toThrow(
      /AGENT_WALLET_SECRET_KEY not set/
    );
  });

  it("throws when the secret key is an empty string", () => {
    process.env.AGENT_WALLET_SECRET_KEY = "";
    expect(() => getAgentKeypair()).toThrow(
      /AGENT_WALLET_SECRET_KEY not set/
    );
  });

  it("loads a keypair from a JSON byte array", () => {
    const expected = Keypair.generate();
    process.env.AGENT_WALLET_SECRET_KEY = JSON.stringify(
      Array.from(expected.secretKey)
    );

    const loaded = getAgentKeypair();
    expect(loaded.publicKey.toBase58()).toBe(expected.publicKey.toBase58());
    expect(Array.from(loaded.secretKey)).toEqual(Array.from(expected.secretKey));
  });

  it("throws on a malformed (non-JSON) secret key", () => {
    process.env.AGENT_WALLET_SECRET_KEY = "not json";
    expect(() => getAgentKeypair()).toThrow();
  });

  it("throws when the secret key is JSON but not an array", () => {
    process.env.AGENT_WALLET_SECRET_KEY = '{"key":1}';
    expect(() => getAgentKeypair()).toThrow(/must be a JSON array/);
  });

  it("throws on a JSON array of the wrong length", () => {
    process.env.AGENT_WALLET_SECRET_KEY = JSON.stringify([1, 2, 3]);
    expect(() => getAgentKeypair()).toThrow();
  });

  it("never leaks the secret key material in its error message", () => {
    process.env.AGENT_WALLET_SECRET_KEY = "not json";
    try {
      getAgentKeypair();
      expect.unreachable("expected getAgentKeypair to throw");
    } catch (err) {
      expect((err as Error).message).not.toContain("not json");
    }
  });
});
