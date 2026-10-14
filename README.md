# Victor Magoto — Personal Profile

A responsive, single-page professional profile focused on forensic accounting, ERP implementation, internal controls and data analytics.

## Deploy to Vercel

Import this repository in Vercel. The included `vercel.json` serves the profile from `dist/` and deploys the payment and admin API routes as Vercel Functions.

Before enabling PayMe, add the variables shown in `.env.example` to every required Vercel environment. Use a long, unique admin password and generate `SESSION_SECRET` with at least 32 random bytes. Paynow credentials must never be prefixed with `VITE_`, `NEXT_PUBLIC_`, or included in browser files.

Configure the Paynow integration with both mobile-money and Visa/Mastercard payment methods. Keep `PAYNOW_MODE=test` until a successful Paynow test transaction has been completed and Paynow approves the integration for live use.

Transaction history, settlements and refunds are managed in Paynow's merchant portal. The website does not maintain a separate payment database.

For local preview:

```powershell
python -m http.server 4173 --directory dist
```

Run the security and integration unit tests with:

```powershell
npm.cmd test
```
