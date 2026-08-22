export interface AgentTask {
  id: string;
  worker: string;
  address: string;
  reason: string;
  amount: number;
}

// Simulated stream of verified, completed units of work — each one is a
// trigger an autonomous agent (a webhook, a verification job, a monitoring
// job) would fire the moment it confirms the work is done. No human reviews
// or approves each payment. This is the ONLY set of payments the API route
// will execute — a request can select a task by id, but cannot supply its
// own address/amount, so this list is the authorization boundary for the
// public demo endpoint.
export const AGENT_TASKS: AgentTask[] = [
  {
    id: "t1",
    worker: "Maria — Manila",
    address: "VYmSFKPM6oxW26hhpVsZ55ST2SyJQWCidQvPo4xLdRJ",
    reason: "Delivery #482 confirmed complete via GPS webhook",
    amount: 0.25,
  },
  {
    id: "t2",
    worker: "Budi — Jakarta",
    address: "CGJ2DbQtFs4fas9r3BSKqKBZ3JeRXnboLZoBfde6v8Zz",
    reason: "Design API call #1187 returned — usage-metered task",
    amount: 0.2,
  },
  {
    id: "t3",
    worker: "Linh — Ho Chi Minh City",
    address: "7DLdKZEzZgpLEmGVaWFwE3mtAbxc8Uf1L7YHABzkoPqG",
    reason: "Support queue batch: 40 tickets resolved",
    amount: 0.35,
  },
  {
    id: "t4",
    worker: "Maria — Manila",
    address: "VYmSFKPM6oxW26hhpVsZ55ST2SyJQWCidQvPo4xLdRJ",
    reason: "Delivery #483 confirmed complete via GPS webhook",
    amount: 0.25,
  },
];
