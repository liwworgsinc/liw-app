# LIW Worgs Inc. Client Platform — Premium Static Edition V2

A front-end application built with plain HTML, CSS, vanilla JavaScript, Bootstrap, Bootstrap Icons, SweetAlert2, Chart.js, and Supabase.

## What is included

- Premium public LIW website with expanded business messaging
- Secure account registration, email confirmation, login, and password reset
- Three-step smart service intake with service cards and request review
- Customer portal for requests, documents, appointments, invoices, and profile information
- Staff-only LIW Command Center
- Terms of Use and Privacy Policy
- Mobile-responsive design
- Supabase authentication, database, storage, and Row Level Security integration

## Deployment

Upload the contents of this folder to the root of the `liwworgsinc/liw-app` repository. GitHub Pages should use the `main` branch and `/(root)` folder.

Live URL:

`https://liwworgsinc.github.io/liw-app/`

## Supabase URL configuration

Site URL:

`https://liwworgsinc.github.io/liw-app/`

Recommended redirect URLs:

- `https://liwworgsinc.github.io/liw-app/portal.html`
- `https://liwworgsinc.github.io/liw-app/reset-password.html`
- `https://liwworgsinc.github.io/liw-app/login.html`
- `https://liwworgsinc.github.io/liw-app/**`

## Important

Only the Supabase publishable key belongs in `js/config.js`. Never place a Supabase secret/service-role key, Stripe secret key, SMTP password, or other private credential in this repository.

## Command Center V3 operations

The admin client workspace now supports:

- Private document review and signed file access
- Appointment scheduling and status management
- Multi-line invoice creation and client portal delivery
- Secure staff-to-client messaging and client replies
- Case notes and client-visible updates

The live Supabase project already has the `command_center_operations` migration applied. The migration file is included for source control and future environments.
