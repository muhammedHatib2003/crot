# Restaurant POS Desktop (Electron)

An Electron shell around the existing `web/` React app. Same UI, same backend, but
packaged as a Windows / macOS / Linux desktop application. Designed to live next to
the existing web frontend without touching the Vercel or Render deployment paths.

## How it works

- **Development**: `npm run dev` starts the Vite dev server in `../web` and launches
  Electron pointing at `http://localhost:5173`.
- **Production build**: `npm run dist` rebuilds the web app with `--base=./` (so
  relative asset URLs work), then packages it into `web-dist/` inside the installer.
  At runtime, Electron spawns a tiny in-process HTTP server on
  `http://localhost:5174` to serve those built assets. Loading via HTTP (instead of
  `file://`) keeps a stable, CORS-friendly Origin so the existing Render API
  whitelist still works.
- **Router**: `web/src/main.jsx` automatically swaps `BrowserRouter` for
  `HashRouter` when running inside Electron (UA-based check), so refresh / deep
  links inside the desktop app work without any web-side regressions.

## Quick start

```bash
# 1. Install desktop deps (one time)
cd desktop
npm install

# 2. Run in development (uses ../web Vite dev server)
npm run dev

# 3. Build a Windows installer
npm run dist:win
```

Output installers land in `desktop/dist/`.

## Pointing the desktop build at your backend

The web UI reads `VITE_API_URL` at **build time**, so you set it before building
the desktop installer:

### Windows (PowerShell)

```powershell
cd web
$env:VITE_API_URL = "https://your-api.onrender.com"
cd ..\desktop
npm run dist:win
```

### macOS / Linux

```bash
cd web && VITE_API_URL=https://your-api.onrender.com npm run build -- --base=./
cd ../desktop && npx electron-builder
```

Or use the all-in-one script (it forwards env vars through):

```powershell
$env:VITE_API_URL = "https://your-api.onrender.com"
npm run dist:win
```

## Backend CORS allowlist

The renderer talks to the API from origin `http://localhost:5174` (configurable
via `ELECTRON_LOCAL_PORT`). In production add this to the Render API service:

```
CLIENT_ORIGINS=https://your-vercel-app.vercel.app,http://localhost:5174
```

Local dev (where the Vite dev server is at `localhost:5173`) is already allowed by
the API's default dev origins, no extra config needed.

## Windows build troubleshooting

If `npm run build` fails with:

- `Unable to commit changes` from `rcedit-x64.exe` — fixed in `electron-builder.yml`
  via `signAndEditExecutable: false`.
- `app.asar` / `.exe` is used by another process — close any running
  **Restaurant POS Desktop** / **RestaurantPOS** window, then rebuild. The `prebuild`
  script tries to stop stale Electron processes automatically.

```powershell
taskkill /F /IM RestaurantPOS.exe /T
taskkill /F /IM electron.exe /T
npm run build
```

If the old folder is still locked, the build script automatically uses a fresh folder such as
`desktop/dist/pkg-<timestamp>/win-unpacked/`. The console prints the exact `.exe` path when
the build succeeds.

Default path when nothing is locked: `desktop/dist/win-unpacked/RestaurantPOS.exe`

## Notes

- **No web/package.json changes that pull in Electron**: Electron + electron-builder
  live only here, so Vercel installs stay unchanged in size and speed.
- **Security**: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.
  The only thing exposed via the preload is a small `window.desktop` marker object.
- **Printing**: The existing `window.print()` flow (kitchen ticket + customer
  receipt) works identically inside Electron — Chromium's print dialog opens just
  like in a normal browser.
- **External links**: `target="_blank"` / `window.open` calls open in the user's
  system browser instead of inside the Electron window.
