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
