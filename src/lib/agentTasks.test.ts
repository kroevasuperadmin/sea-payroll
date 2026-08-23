import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { AGENT_TASKS } from "./agentTasks";
import { MAX_BATCH_SIZE } from "./solana";

// AGENT_TASKS is the authorization boundary for the public /api/agent-pay
// endpoint: anything wrong in this list is directly spendable.
describe("AGENT_TASKS", () => {
  it("is non-empty", () => {
    expect(AGENT_TASKS.length).toBeGreaterThan(0);
  });

  it("has unique task ids so replay protection can key on them", () => {
    const ids = AGENT_TASKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only contains valid, on-curve Solana addresses", () => {
    for (const task of AGENT_TASKS) {
      const key = new PublicKey(task.address);
      expect(PublicKey.isOnCurve(key.toBytes())).toBe(true);
    }
  });

  it("pays a positive, demo-sized amount per task", () => {
    for (const task of AGENT_TASKS) {
      expect(task.amount).toBeGreaterThan(0);
      expect(task.amount).toBeLessThanOrEqual(1);
    }
  });

  it("keeps amounts within USDC's 6 decimals", () => {
    for (const task of AGENT_TASKS) {
      const scaled = task.amount * 10 ** 6;
      expect(Number.isInteger(Math.round(scaled))).toBe(true);
      expect(Math.abs(scaled - Math.round(scaled))).toBeLessThan(1e-6);
    }
  });

  it("describes every task with a worker and a reason", () => {
    for (const task of AGENT_TASKS) {
      expect(task.worker.trim().length).toBeGreaterThan(0);
      expect(task.reason.trim().length).toBeGreaterThan(0);
    }
  });

  it("stays payable as a single batch", () => {
    expect(AGENT_TASKS.length).toBeLessThanOrEqual(MAX_BATCH_SIZE);
  });
});
