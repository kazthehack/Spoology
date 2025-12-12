
# SPOOLOGY (React + TypeScript)

React single-page app built with Vite.

Nuances:

- Each spool JSON now supports `refillable: boolean`.
- If `refillable` is `true`, the calculator shows a checkbox
  **"Include refill spool core"** and includes the core weight in
  the empty spool weight when checked.
- If `refillable` is `false` or missing, the checkbox is hidden and the
  core weight is never added.

Two sample spools are provided:

- `esun-plastic-53_2mm.json` – standard non-refillable spool (`refillable: false`).
- `bambu-petg-hf-white-perforated.json` – refillable style core (`refillable: true`).

## Commands

```bash
cd App
npm install
npm run dev      # local dev, http://localhost:5173
npm run build    # production build into dist/
npm run preview  # preview production build
```

Optionally, a future Scan feature can call `{VITE_API_BASE or http://localhost:8000}/analyze/spool-image`.
