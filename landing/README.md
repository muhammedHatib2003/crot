# CROT — Landing Site

Standalone marketing / promotional site for the CROT restaurant SaaS. Lives in its
own folder, has its own `node_modules`, its own Vercel deploy. **Does not touch**
the main `api/`, `web/`, or `desktop/` packages.

- React 18 + Vite 6
- Tailwind CSS 3
- Fully static — no backend calls, no database, no auth, no payment integration
- Ready to deploy on Vercel as its own project

## Local development

```bash
cd landing
npm install
npm run dev      # http://localhost:5180
npm run build    # dist/
npm run preview  # serve the production build locally
```

## Demo link configuration (optional)

The site reads optional Vite env variables to drive the "Demo Links" section and
the Hero CTAs. If you don't set them, the site falls back to sensible placeholders
documented in `.env.example` so the static build always renders.

Copy `.env.example` to `.env` and fill in the URLs of your existing CROT
deployments (Vercel web app, owner panel, kitchen, etc.):

```bash
cp .env.example .env
```

Available variables:

- `VITE_APP_URL` — main web app (also used as the base for deep-links)
- `VITE_OWNER_URL` — owner panel (defaults to `${VITE_APP_URL}/owner`)
- `VITE_ADMIN_URL` — super admin panel (defaults to `${VITE_APP_URL}/admin`)
- `VITE_KITCHEN_URL` — kitchen panel (defaults to `${VITE_APP_URL}/kitchen`)
- `VITE_CASHIER_URL` — cashier panel (defaults to `${VITE_APP_URL}/cashier`)
- `VITE_ONLINE_ORDER_URL` — online ordering entry (defaults to `${VITE_APP_URL}/order`)
- `VITE_GITHUB_URL` / `VITE_DOCS_URL` — optional external links

## Deploy to Vercel

1. Push the `landing/` folder (alongside the rest of the repo) to your Git host.
2. Create a **new Vercel project** and point its **Root Directory** to `landing/`.
3. Framework preset: **Vite**. The included `vercel.json` already declares the
   build command, output directory, and SPA rewrites.
4. Set the optional `VITE_APP_URL` / `VITE_OWNER_URL` etc. env variables on the
   Vercel project (Production + Preview).
5. Deploy. Done — totally independent of the main CROT app.

## Why is this separate?

Keeping the marketing site as its own package means:

- Zero risk of breaking the production CROT app while iterating on visuals.
- Different deploy cadence (marketing copy changes don't need an API re-deploy).
- The landing build doesn't pull in CROT's React Router, Leaflet, i18n bundles,
  etc., so it stays tiny and fast.
