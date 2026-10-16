# echeckpay

Bank-accepted check printing for the web — write, print and track checks with
true E-13B MICR, built-in security features, a live bank-acceptance compliance
engine and one-click Positive Pay export.

## Stack

- Next.js (App Router) + React + Tailwind CSS
- Drizzle ORM + PostgreSQL
- Deployed on Cloudflare Workers via `@opennextjs/cloudflare`

## Local development

1. `npm install`
2. Create `.env`:

   ```
   DATABASE_URL=postgresql://…          # local Postgres
   AUTH_PASSWORD=…                      # operator password
   AUTH_SECRET=change-me-to-a-long-random-string-in-production
   ```

3. `npm run dev` — http://localhost:3000
4. `npm run typecheck && npm run lint`

## Deploy to Cloudflare

```sh
npm run deploy        # builds with OpenNext and deploys to Workers
```

Live at: https://echeckpay.nakeebv.workers.dev

### Secrets

```sh
npx wrangler secret put AUTH_PASSWORD
npx wrangler secret put AUTH_SECRET   # long random string
```

### Database (production)

The edge cannot reach a localhost Postgres. Point the Worker at a hosted
Postgres (Neon / Supabase / RDS) via the `DATABASE_URL` secret:

```sh
npx wrangler secret put DATABASE_URL
# e.g. Supabase session pooler:
# postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Run the schema against the hosted DB (Drizzle Kit):

```sh
npx drizzle-kit push
```

Then `npm run deploy` again.

> **Security note:** the current Worker→Postgres connection runs unencrypted
> (`sslmode=disable`) because Workers' outbound TLS upgrade cannot complete
> against poolers. To encrypt, create a **Hyperdrive** config in the Cloudflare
> dashboard (Storage & Databases → Hyperdrive → uses the same connection
> string, handles TLS itself), then uncomment the `hyperdrive` block in
> `wrangler.jsonc` with the returned ID and redeploy. `src/db/index.ts` picks
> the `HYPERDRIVE` binding up automatically.

Because workerd recycles sockets between requests, `src/db` opens a
short-lived connection per query chain and closes it when the chain settles —
see `src/db/index.ts` for the details.

## Security notes

- `.env` and `drizzle.config.json` (local credentials) are git-ignored — never
  commit them.
- Single-operator password sign-in with HMAC-signed session cookies. Bank data
  lives in your own database.

## Multi-user, wallet & payments (NOWPayments)

- Registration: email → verification link → password setup (min 10 chars,
  letters + numbers + symbol, "I saved it" confirmation). Login is email +
  password; recovery by email only.
- Wallet: crypto deposits via NOWPayments invoices, $50 minimum. Every printed
  check (reprints included) costs $10, charged atomically from the wallet
  ledger. The clean print view is unlocked by a one-time token issued after a
  successful charge; previews render with a VOID overlay.
- Admin console (`/admin`, admin role only): user directory, block/delete,
  manual password-reset links, wallet adjustments (audited), deposit order
  reconciliation, support threads, platform audit trail.

### Required Worker secrets

```sh
npx wrangler secret put DATABASE_URL          # existing
npx wrangler secret put AUTH_SECRET           # existing
npx wrangler secret put AUTH_PASSWORD         # legacy bootstrap password
npx wrangler secret put NOWPAYMENTS_API_KEY
npx wrangler secret put NOWPAYMENTS_IPN_SECRET
npx wrangler secret put RESEND_API_KEY        # enables email sending
npx wrangler secret put APP_BASE_URL          # e.g. https://echeckpay.nakeebv.workers.dev
```

### Payment setup checklist

1. Create a NOWPayments account → API keys: copy API key + IPN secret key.
2. `wrangler secret put NOWPAYMENTS_API_KEY` / `...NOWPAYMENTS_IPN_SECRET`.
3. In the NOWPayments dashboard set the IPN callback URL to:
   `https://echeckpay.nakeebv.workers.dev/api/nowpayments/ipn`
4. Money credits only through the verified webhook → server-side status
   reconciliation → idempotent ledger credit. Browser redirects never mark an
   order paid. Until keys are set, the wallet shows "deposits unavailable".

### Email setup

Resend (free tier): create API key → `wrangler secret put RESEND_API_KEY`.
Without it, registration/dev flows display verification links on-screen and
password recovery falls back to admin-issued reset links.

## File storage (Cloudflare R2)

Uploads (bank logo, company logo, signature, MICR font, check PDFs) are stored
in R2 with a metadata row in the `files` table. Private by default; downloads
flow through `/api/files/[id]` after an ownership check. Object keys are
server-generated UUIDs — client filenames are metadata only.

Setup (free tier):
1. Cloudflare dashboard → R2 → create a bucket (e.g. `echeckpay-files`).
2. R2 → Manage R2 API tokens → create an "Object Read & Write" token scoped to
   the bucket → note Access Key ID, Secret Access Key and Account ID.
3. Set as Worker secrets:

   ```sh
   npx wrangler secret put R2_ACCOUNT_ID
   npx wrangler secret put R2_ACCESS_KEY_ID
   npx wrangler secret put R2_SECRET_ACCESS_KEY
   npx wrangler secret put R2_BUCKET
   ```

Until configured, uploads fall back to inline database storage (400 KB images
/ 2 MB fonts) — feature-complete but not the long-term home for files.
Admin cleanup sweep: `POST /api/admin/files/cleanup` (replaced + orphaned
objects are deleted).
