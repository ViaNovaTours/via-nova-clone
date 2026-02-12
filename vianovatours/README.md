# Via Nova Tours - Vercel + Supabase migration

This repository has been refactored so the frontend can run on **Vercel** and the backend can run on **Supabase**.

## What changed

- Removed runtime dependency on Base44 SDK/plugin for frontend builds.
- Added a Supabase-backed compatibility layer that preserves existing calls:
  - `base44.auth.me()`
  - `base44.entities.*`
  - `base44.functions.invoke(...)`
  - `base44.integrations.Core.UploadFile(...)`
- Replaced Base44 virtual imports with real source files:
  - `src/entities/*`
  - `src/functions/*`
  - `src/integrations/Core.js`
- Added Supabase starter backend assets:
  - SQL migration: `supabase/migrations/20260212000100_initial_schema.sql`
  - Edge functions in `supabase/functions/*`
- Added Vercel SPA config: `vercel.json`
- Added environment template: `.env.example`

## 1) Supabase setup

### Create project

Create a Supabase project and copy:

- Project URL
- Anon key
- Service role key (for edge functions only, not frontend)

### Run database migration

From this repo root:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

This applies the schema from `supabase/migrations/*`.

### Storage buckets

Create storage buckets:

- `uploads` (used by frontend `UploadFile`)
- `tickets` (used by `upload-to-google-drive` edge function)

Set buckets to public if you want direct public URLs.

### Edge functions

Deploy the included functions:

```bash
supabase functions deploy get-stripe-publishable-key
supabase functions deploy process-landing-page-booking
supabase functions deploy send-email-via-sendgrid
supabase functions deploy generate-tour-content
supabase functions deploy invoke-llm
supabase functions deploy upload-to-google-drive
supabase functions deploy send-ticket-email
supabase functions deploy send-reserved-email
supabase functions deploy fetch-woocommerce-orders
supabase functions deploy migrate-woocommerce-credentials
supabase functions deploy update-specific-order-status
supabase functions deploy fetch-gmail-threads
supabase functions deploy calculate-profits-for-all-orders
supabase functions deploy fix-complete-status
```

Then set edge function secrets:

```bash
supabase secrets set STRIPE_PUBLISHABLE_KEY=...
supabase secrets set STRIPE_SECRET_KEY=...
supabase secrets set SENDGRID_API_KEY=...
supabase secrets set SENDGRID_FROM_EMAIL=info@vianovatours.com
supabase secrets set SENDGRID_FROM_NAME="Via Nova Tours"
supabase secrets set OPENAI_API_KEY=...
```

## 2) Frontend setup (local)

Copy env template:

```bash
cp .env.example .env.local
```

Fill at minimum:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Install and run:

```bash
npm install
npm run dev
```

## 3) Deploy frontend to Vercel

In Vercel project settings, set the same frontend env vars from `.env.example`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- any optional routing/table/function mapping vars you use

Vercel will use:

- `npm run build`
- output directory `dist`
- SPA rewrite from `vercel.json`

## Notes on remaining integration work

- Some operational automations (WooCommerce/Gmail sync logic) are project-specific and were added as safe starter stubs in Supabase functions.
- You can migrate business logic from legacy `functions/*.ts` (Base44 implementation) into `supabase/functions/*` progressively.
- The frontend now fails gracefully when a backend function is not yet implemented.
