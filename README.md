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
Postgres (Neon / Supabase / RDS) via Hyperdrive:

1. Create the database and note the connection string (`?sslmode=require`).
2. Register it with Hyperdrive:

   ```sh
   npx wrangler hyperdrive create echeckpay-db \
     --connection-string="postgres://user:pass@host/db?sslmode=require"
   ```

3. Uncomment the `hyperdrive` block in `wrangler.jsonc` using the returned ID.
4. Run the schema against the hosted DB (Drizzle Kit):

   ```sh
   npx drizzle-kit push
   ```

5. `npm run deploy` again.

`src/db/index.ts` automatically uses the `HYPERDRIVE` binding when running on
Workers and falls back to `DATABASE_URL` for local development.

## Security notes

- `.env` and `drizzle.config.json` (local credentials) are git-ignored — never
  commit them.
- Single-operator password sign-in with HMAC-signed session cookies. Bank data
  lives in your own database.
