# ProteCheck

> Compliance tracking desktop app for volunteer emergency services.

Built with **Tauri v2** (Rust) and **Vanilla JS** (Vite). Runs natively on macOS, Windows, and Linux.

## What it does

ProteCheck ingests a folder of Excel reports exported from a volunteer management system and computes compliance status for each volunteer across three axes:

- **80-hour rule** — must accumulate ≥ 80 valid Civil Protection hours in the selected time window
- **90-day rule** — last valid service must be within the last 90 days
- **RCP/AIT certification** — must hold a current (≤ 3 years) resuscitation and first-aid certificate

Each volunteer is classified as **APTO** (fully compliant), **ALERTA** (partial failure), or **PELIGRO** (non-compliant on all axes). Results can be exported to XLSX, CSV, or PDF.

## Key features

- Native folder picker + drag-and-drop for individual XLS files
- Time-window filters: current year, 12-month exact, 12-month calendar, 3-month
- Hours mode toggle: signed vs. scheduled hours
- Per-service manual overrides: add/remove PC hours, flag psychosocial, mark management staff
- Sortable volunteer table with color-coded status rows
- In-app user manual and first-run onboarding
- Dark / light / system theme

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 (Rust) |
| Frontend | Vanilla JS (ES modules, Vite 6) |
| Styling | Plain CSS with custom properties (dark/light/system theme) |
| Excel parsing | SheetJS (`xlsx`) |
| PDF export | jsPDF + jsPDF-AutoTable |
| Date logic | date-fns |

## Running locally

```bash
# Prerequisites: Node 18+, Rust stable, Tauri CLI v2
npm install
npm run tauri dev
```

## Building for distribution

```bash
npm run tauri build
```

Produces platform installers: `.dmg` on macOS, `.msi`/`.exe` on Windows, `.deb`/`.AppImage` on Linux.

---

[github.com/miguelrzazo/ProteCheck](https://github.com/miguelrzazo/ProteCheck)
