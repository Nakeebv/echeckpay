const fs = require("fs");
const { createHmac } = require("crypto");
const env = fs.readFileSync(".dev.vars", "utf8");
const secret = /AUTH_SECRET=(.*)/.exec(env)[1].trim();
function token(userId) {
  const exp = Date.now() + 86400000;
  const payload = `${userId}|${exp}|sec`;
  return "echeckpay_session=" + payload + "|" + createHmac("sha256", secret).update(payload).digest("base64url");
}
const B = "http://127.0.0.1:8799";
const { Pool } = require("pg");

async function main() {
  const results = {};
  const pool = new Pool({ connectionString: "postgresql://postgres.iwqjeptjvoxgobvmrlih:REDACTED-CREDENTIAL%23@aws-0-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=disable", ssl: { rejectUnauthorized: false } });
  await pool.query("insert into users (email, password_hash) values ('secuser@test.local', 'pbkdf2$60000$AAAA$BBBB') on conflict (email) do nothing");
  const u2 = await pool.query("select id from users where email='secuser@test.local'");
  const USER2_ID = u2.rows[0].id;
  const ADMIN = token(1), USER2 = token(USER2_ID), NONE = "echeckpay_session=none";

  const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108", "hex");
  const fakePdf = Buffer.from("<script>alert(1)</script>");
  const big = Buffer.concat([png, Buffer.alloc(2_100_000, 7)]);

  const upload = async (cookie, body) => {
    const f = new FormData();
    f.append("category", "logo_bank");
    f.append("file", new File([body], "t.png"));
    return fetch(B + "/api/files", { method: "POST", headers: { cookie }, body: f });
  };

  results["1 unauth upload = 401"] = (await upload(NONE, png)).status;
  const ok = await upload(ADMIN, png);
  results["2 auth upload = 503 (R2 pending) or 201"] = ok.status;
  const okData = await ok.json();
  let fileId = okData.file ? okData.file.id : null;
  results["3 oversized = 415"] = (await upload(ADMIN, big)).status;
  results["4 invalid type = 415"] = (await upload(ADMIN, fakePdf)).status;

  if (fileId) {
    results["5 owner GET = 200"] = (await fetch(B + "/api/files/" + fileId, { headers: { cookie: ADMIN } })).status;
    results["6 cross-user GET = 403"] = (await fetch(B + "/api/files/" + fileId, { headers: { cookie: USER2 } })).status;
    results["7 unauth GET = 401"] = (await fetch(B + "/api/files/" + fileId, { headers: { cookie: NONE } })).status;
    results["8 cross-user DELETE = 404"] = (await fetch(B + "/api/files/" + fileId, { method: "DELETE", headers: { cookie: USER2 } })).status;
    results["9 owner DELETE = 200"] = (await fetch(B + "/api/files/" + fileId, { method: "DELETE", headers: { cookie: ADMIN } })).status;
    results["10 GET after delete = 404"] = (await fetch(B + "/api/files/" + fileId, { headers: { cookie: ADMIN } })).status;
  }

  results["11 unauth deposit = 401"] = (await fetch(B + "/api/wallet/deposits", { method: "POST", headers: { cookie: NONE }, body: "{}" })).status;
  results["12 min deposit = 400"] = (await fetch(B + "/api/wallet/deposits", { method: "POST", headers: { cookie: ADMIN, "content-type": "application/json" }, body: JSON.stringify({ amountCents: 100 }) })).status;
  results["13 user2 admin api = 403"] = (await fetch(B + "/api/admin/users", { headers: { cookie: USER2 } })).status;
  results["14 cross-user charge = 404"] = (await fetch(B + "/api/print/charge", { method: "POST", headers: { cookie: USER2, "content-type": "application/json" }, body: JSON.stringify({ checkId: 5, chargeKey: "user2-charge-key-0001" }) })).status;

  await pool.end();
  console.log(JSON.stringify(results, null, 1));
}
main().catch(e => console.error("ERR", e));
