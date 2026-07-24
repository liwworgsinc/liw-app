# LIW Worgs Inc. SEO Launch Checklist

## Included in Version 5

- Unique page titles and meta descriptions for the homepage and all nine service pages
- Canonical URLs using the current GitHub Pages address
- Open Graph and Twitter sharing metadata
- LocalBusiness, Organization, WebSite, Service, and Breadcrumb structured data
- `sitemap.xml`
- `robots.txt`
- Search-engine `noindex` instructions on login, registration, intake, portal, admin, reset, and error pages
- Static crawlable service cards instead of loading public service links from JavaScript
- Responsive hero and social-sharing images
- Favicon, Apple touch icon, and web-app manifest
- Lightweight public pages without the Supabase library, SweetAlert, Bootstrap JavaScript, or Google Fonts

## GitHub Pages robots.txt note

This app is currently a GitHub Pages **project site** under `/liw-app/`. Search engines only recognize `robots.txt` at the host root, such as `https://liwworgsinc.github.io/robots.txt`, not inside `/liw-app/`. The included `robots.txt` becomes fully useful when the app is published on its own custom domain. Until then, the page-level `noindex` tags still protect private/auth pages, and the sitemap should be submitted directly in Search Console.

## Google Search Console

1. Add the current property: `https://liwworgsinc.github.io/liw-app/`
2. Submit: `https://liwworgsinc.github.io/liw-app/sitemap.xml`
3. Inspect the homepage and each service page after deployment.
4. Request indexing after confirming the live page is correct.

## Google Business Profile

Keep the business name, address, phone number, service descriptions, and website URL consistent with the website:

- LIW Worgs Inc.
- 873 Liberty Avenue, Brooklyn, NY 11208
- 929-234-2881
- liwworgsinc@gmail.com

## Custom domain warning

The canonical URLs currently use the live GitHub Pages address. When the app is moved to `liwworgs.com` or another custom domain, update:

- Every canonical URL
- Open Graph page URLs and image URLs
- JSON-LD URLs
- `sitemap.xml`
- `robots.txt`
- `site.webmanifest`
- Supabase authentication redirect URLs
- Stripe success and cancellation URLs

Do not leave both domains publicly indexable with conflicting canonical tags.
