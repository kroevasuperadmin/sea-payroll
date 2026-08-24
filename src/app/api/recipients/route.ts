import { NextRequest, NextResponse } from "next/server";
import {
  createRecipient,
  listRecipients,
  type CreateRecipientInput,
} from "@/lib/db";

const WORKSPACE_COOKIE = "tiba_session";
const WORKSPACE_VALUE = "design-partner";

function requireSession(req: NextRequest) {
  const session = req.cookies.get(WORKSPACE_COOKIE)?.value;
  if (session !== WORKSPACE_VALUE) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return null;
}

export function GET(req: NextRequest) {
  const denied = requireSession(req);
  if (denied) return denied;
  return NextResponse.json({ recipients: listRecipients() });
}

const VALID_KYC: CreateRecipientInput["kycStatus"][] = [
  "unverified",
  "pending",
  "verified",
  "failed",
];
const VALID_RAILS: CreateRecipientInput["railPreference"][] = [
  "bank",
  "ewallet",
  "usdc",
];

export async function POST(req: NextRequest) {
  const denied = requireSession(req);
  if (denied) return denied;

  const body = (await req.json()) as Partial<CreateRecipientInput>;

  if (!body.workerRef || !body.railPreference || !body.kycStatus) {
    return NextResponse.json(
      { error: "workerRef, kycStatus and railPreference are required" },
      { status: 400 }
    );
  }

  if (!VALID_KYC.includes(body.kycStatus)) {
    return NextResponse.json(
      { error: `Invalid kycStatus: ${body.kycStatus}` },
      { status: 400 }
    );
  }
  if (!VALID_RAILS.includes(body.railPreference)) {
    return NextResponse.json(
      { error: `Invalid railPreference: ${body.railPreference}` },
      { status: 400 }
    );
  }

  const input: CreateRecipientInput = {
    workerRef: body.workerRef.trim(),
    destinationCountry: (body.destinationCountry ?? "ID").trim().toUpperCase(),
    kycStatus: body.kycStatus,
    kycNotes: body.kycNotes ?? null,
    railPreference: body.railPreference,
    bankName: body.bankName?.trim() ?? null,
    accountNumber: body.accountNumber?.trim() ?? null,
    ewalletProvider: body.ewalletProvider?.trim() ?? null,
    ewalletIdentifier: body.ewalletIdentifier?.trim() ?? null,
    usdcAddress: body.usdcAddress?.trim() ?? null,
    onHold: body.onHold ?? false,
    holdReason: body.holdReason ?? null,
    consentAt: body.consentAt ?? null,
  };

  const recipient = createRecipient(input);
  return NextResponse.json({ recipient }, { status: 201 });
}
