# LIW Worgs Inc. Static Web App

A no-build web application using plain HTML, CSS, JavaScript, Bootstrap, SweetAlert2, Chart.js, and Supabase.

## Included pages

- `index.html` — public website and service catalog
- `login.html` — customer/staff login
- `register.html` — customer registration
- `reset-password.html` — secure password reset
- `intake.html` — dynamic service intake
- `portal.html` — customer portal, requests, documents, appointments, invoices, and profile
- `admin.html` — LIW staff CRM and request pipeline

## Deploy by FTP

Upload every file and folder in this package to the website document root. Keep the folder structure intact.

## Deploy with GitHub Pages

1. Upload these files to the root of the `liw-app` repository.
2. In GitHub, open **Settings → Pages**.
3. Set **Source** to **Deploy from a branch**.
4. Select **main** and **/(root)**, then save.
5. Wait for the green deployment check.

No npm install, build command, or React setup is required.

## Supabase settings

The publishable key and project URL are in `js/config.js`. The publishable key is intended for browser use. Access is protected by Supabase Auth and Row Level Security.

For registration email links, add the final website address in Supabase:

**Authentication → URL Configuration → Site URL / Redirect URLs**

Example GitHub Pages redirect:

`https://liwworgsinc.github.io/liw-app/**`

## First owner account

Register using `liwworgsinc@gmail.com`. The database trigger assigns that email the `owner` role.

## Legal pages

- `terms.html` — Terms of Use
- `privacy.html` — Privacy Policy

Business phone: 929-234-2881
