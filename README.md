# LIW Worgs Inc. Platform

Version 1 of the LIW Command Center: a React, TypeScript, Vite, and Supabase customer portal and smart intake system.

## Included

- Public LIW Worgs service landing page
- Customer account creation and sign-in
- Dynamic service intake forms backed by Supabase
- Customer request dashboard
- Profile management
- Staff/owner role detection
- Secure Postgres schema with Row Level Security
- Private Supabase Storage bucket for future document uploads
- Mobile-friendly layout

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set these values in `.env.local`:

```env
VITE_SUPABASE_URL=https://svoiyvwwvrmixnqtltlu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

## Supabase

The migration in `supabase/migrations/20260724010000_initial_liw_platform.sql` documents the project schema. The production migration was applied directly to the connected Supabase project.

The email `liwworgsinc@gmail.com` is automatically assigned the `owner` role when that account signs up.

## Production reminders

- Configure the Supabase Auth Site URL and redirect URLs for the deployed domain.
- Keep all secret and service-role keys out of frontend code.
- Add Stripe through a Supabase Edge Function and webhook, not directly in the browser.
- Add document upload screens only through the private `liw-documents` bucket.

## Shared-hosting / FTP deployment

This ZIP contains source code. Do not upload the source folder as the public website.

1. Run `npm install`.
2. Create `.env.local` from `.env.example` and add your Supabase publishable key.
3. Run `npm run build`.
4. Upload the **contents of the generated `dist` folder** to your website's public folder.

For Netlify, Vercel, or Cloudflare Pages, connect the project and use `npm run build` with `dist` as the output directory.
