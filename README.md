# LIW Worgs Inc. Web App V4

A no-build HTML, CSS, and vanilla JavaScript business platform using Bootstrap, SweetAlert2, Chart.js, Supabase, and Stripe-hosted Checkout.

## Public service journey

Every service now has a dedicated information page before intake:

- `real-estate.html`
- `property-management.html`
- `tax-preparation.html`
- `credit-solutions.html`
- `business-funding.html`
- `business-advertising.html`
- `web-design.html`
- `eyeglasses-repair.html`
- `digital-business-cards.html`

Each page includes service information, a professional visual, preparation checklist, process, service-specific disclaimer, and a CTA that opens the correct preselected intake.

## Client and staff features

- Smart service intake
- Customer and staff authentication
- Secure document uploads
- Appointment scheduling
- Client portal messaging
- Invoice creation with multiple line items
- Stripe-hosted invoice payment
- Payment history and invoice balance calculation
- Staff Command Center and client workspaces
- Terms of Use and Privacy Policy

## Stripe

Read `STRIPE_SETUP.md`. The Supabase functions are:

- `create-invoice-checkout`
- `stripe-invoice-webhook`

Stripe secrets stay in Supabase Edge Function secrets and are never stored in frontend files.

## GitHub Pages

Upload every file and folder to the root of `liwworgsinc/liw-app` and replace existing files. GitHub Pages should deploy from `main` and `/(root)`.

Live URL:

```text
https://liwworgsinc.github.io/liw-app/
```

After upload, use Ctrl + F5 to clear cached CSS and JavaScript.
