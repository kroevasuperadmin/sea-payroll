import fs from "node:fs";

function loadDotenv(path = ".env") {
  const env = {};
  if (!fs.existsSync(path)) return env;
  const text = fs.readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([^#][^=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let value = m[2].trim();
    value = value.replace(/^["']|["']$/g, "");
    env[key] = value;
  }
  return env;
}

const env = loadDotenv();
const code = env.TIBA_WORKSPACE_CODE || process.env.TIBA_WORKSPACE_CODE;

if (!code) {
  console.error("TIBA_WORKSPACE_CODE is not set. Add it to .env or pass as an env var.");
  process.exit(1);
}

const res = await fetch("http://localhost:3000/api/seed", {
  method: "POST",
  headers: { "x-tiba-workspace-code": code },
});

const body = await res.json().catch(() => ({}));

if (!res.ok) {
  console.error(`Seed failed (${res.status}):`, body.error || body);
  process.exit(1);
}

console.log(`Seeded ${body.created?.length ?? 0} recipient(s)`);
for (const r of body.created || []) {
  console.log(`  ${r.workerRef} — ${r.railPreference} — ${r.kycStatus} ${r.onHold ? "(on hold)" : ""}`);
}
