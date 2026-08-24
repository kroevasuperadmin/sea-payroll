import { NextRequest, NextResponse } from "next/server";
import { createRecipient, type CreateRecipientInput } from "@/lib/db";

const WORKSPACE_CODE = process.env.TIBA_WORKSPACE_CODE;

export async function POST(req: NextRequest) {
  const code = req.headers.get("x-tiba-workspace-code");
  if (WORKSPACE_CODE && code !== WORKSPACE_CODE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();

  const seed: CreateRecipientInput[] = [
    {
      workerRef: "ID-001",
      destinationCountry: "ID",
      kycStatus: "verified",
      kycNotes: "KYC verified by design partner",
      railPreference: "bank",
      bankName: "Bank Central Asia",
      accountNumber: "1234567890",
      consentAt: now,
    },
    {
      workerRef: "ID-002",
      destinationCountry: "ID",
      kycStatus: "pending",
      kycNotes: "KYC documentation incomplete; payroll held pending action",
      railPreference: "bank",
      bankName: "Bank Mandiri",
      accountNumber: "9876543210",
      consentAt: now,
    },
    {
      workerRef: "ID-003",
      destinationCountry: "ID",
      kycStatus: "verified",
      kycNotes: "Recipient on manual hold for duplicate-profile review",
      railPreference: "ewallet",
      ewalletProvider: "GoPay",
      ewalletIdentifier: "+62-812-0000-0001",
      onHold: true,
      holdReason: "Duplicate profile under review",
      consentAt: now,
    },
    {
      workerRef: "ID-004",
      destinationCountry: "ID",
      kycStatus: "verified",
      railPreference: "ewallet",
      ewalletProvider: "DANA",
      ewalletIdentifier: "+62-813-0000-0002",
      consentAt: now,
    },
    {
      workerRef: "ID-005",
      destinationCountry: "ID",
      kycStatus: "verified",
      railPreference: "usdc",
      usdcAddress: "VYmSFKPM6oxW26hhpVsZ55ST2SyJQWCidQvPo4xLdRJ",
      consentAt: now,
    },
  ];

  const created = [];
  for (const input of seed) {
    created.push(createRecipient(input));
  }

  return NextResponse.json({ created }, { status: 201 });
}
