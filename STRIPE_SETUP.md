# LIW Stripe Invoice Payments

The frontend and both Supabase Edge Functions are already included in this release.

## Connected Stripe account

This project is intended for the connected **LIW WORGS INC sandbox** Stripe account while testing.

## 1. Add Supabase Edge Function secrets

In Supabase, open:

**Project Settings → Edge Functions → Secrets**

Add:

```text
STRIPE_SECRET_KEY=your Stripe sandbox secret key
STRIPE_WEBHOOK_SECRET=your Stripe webhook signing secret
```

Optional when the public site moves away from GitHub Pages:

```text
LIW_SITE_URL=https://your-final-domain.example/
```

Never place a Stripe secret key in `js/config.js`, HTML, GitHub, or browser code.

## 2. Create the Stripe webhook endpoint

In Stripe sandbox mode, open:

**Developers → Webhooks → Add endpoint**

Endpoint URL:

```text
https://svoiyvwwvrmixnqtltlu.supabase.co/functions/v1/stripe-invoice-webhook
```

Subscribe to:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
```

Copy the endpoint signing secret beginning with `whsec_` into the Supabase secret named `STRIPE_WEBHOOK_SECRET`.

## 3. Add the Stripe secret key

In Stripe sandbox mode, open **Developers → API keys** and reveal the sandbox secret key beginning with `sk_test_`.

Save it only as the Supabase secret named `STRIPE_SECRET_KEY`.

## 4. Test the payment flow

1. Sign in as the LIW owner.
2. Open Command Center → client workspace → Invoices.
3. Create and send an invoice.
4. Sign in as that client and open Portal → Invoices.
5. Click **Pay securely**.
6. Complete Stripe Checkout using a Stripe sandbox test payment method.
7. Return to the portal and verify the invoice becomes **Paid**, the payment appears in the invoice history, and the client receives a payment-received portal message.

## Functions

- `create-invoice-checkout` requires a signed-in Supabase user and only loads invoices visible to that client.
- `stripe-invoice-webhook` does not use Supabase JWT verification because Stripe calls it externally; it verifies Stripe's signature inside the function.
- The webhook records the payment idempotently and updates the Supabase invoice status.
