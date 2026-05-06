# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ProteCheck** is a Tauri desktop application for validating volunteer compliance with service requirements. It analyzes Excel reports from a volunteer management system and generates compliance status reports.

The app is a two-tier system:
- **Frontend**: Vanilla JS (Vite) with modules for parsing, analysis, dashboard rendering, and export
- **Backend**: Rust (Tauri) for file I/O operations

## Development Commands

```bash
# Install dependencies
npm install

# Start dev server (Vite frontend at localhost:1420)
npm run dev

# Build frontend artifacts
npm run build

# Run the Tauri development app
npm run tauri dev

# Build production distributable
npm run tauri build
```

## Architecture & Key Modules

### Data Flow
1. **File Selection** → User picks a folder containing Excel reports via native dialog
2. **Parsing** (`src/modules/parser.js`) → Rust backend reads files; frontend extracts volunteer data from sheets
3. **Analysis** (`src/modules/analyzer.js`) → Compliance metrics computed per volunteer
4. **Rendering** (`src/modules/dashboard.js`) → Table view with modal detail panels
5. **Export** (`src/modules/exporter.js`) → XLSX/CSV/PDF report generation

### Frontend Module Structure

- **`main.js`**: Event listeners for folder selection, filter buttons, export buttons; coordinates data flow
- **`parser.js`**: Invokes Rust `read_dir` and `read_file_base64` commands; parses XLSX using `xlsx` library; extracts service records with validation flags
- **`analyzer.js`**: Core compliance logic—computes 80-hour and 90-day requirements, RCP/AIT tracking, psychosocial hours. Applies time-window filters (current year / last 3 months / last year).
- **`dashboard.js`**: Renders volunteer table with sorting; shows modal with service details; handles real-time updates (Jefatura toggle, psychosocial flagging)
- **`exporter.js`**: Generates and saves reports in XLSX/CSV/PDF formats using `jsPDF` and `xlsx` libraries

### Rust Backend (`src-tauri/src/lib.rs`)

Two Tauri commands exposed:
- **`read_dir(path)`** → Lists `.xls` / `.xlsx` files in a directory
- **`read_file_base64(path)`** → Reads file as base64 (sent to frontend for XLSX parsing)

## Compliance Logic (Critical)

The analyzer computes three binary compliance requirements per volunteer:

1. **80 Hours** (`cumple80Horas`): Valid PC hours in the selected time window ≥ 80
   - Valid categories: motivos [2.2, 4.1, 4.2, 6.1, 6.7, 6.5] or prefixes [3.*, 7.*], "Oficina Voluntario" (limited), "Entrevista"
   - Jefatura volunteers can count unlimited "Oficina Voluntario"; others only the first one per window

2. **90 Days** (`cumple90Dias`): Last valid service date ≤ 90 days ago
   - Valid services reset the clock; office/interview work also counts
   
3. **RCP/AIT** (`cumpleRCP`): Has both RCP and AIT training in last 3 years (or volunteer age < 3 years = exempt)
   - Detected via denominación containing reciclaje/recertificación/módulo + RCP/SVB or AIT

**Overall Status**:
- `APTO`: All three requirements met
- `ALERTA`: One or two unmet
- `PELIGRO`: All three unmet

Time window filtering affects only the 80-hour calculation; 90-day and RCP checks are absolute.

## File Structure Notes

- `src/index.html`: Contains dashboard table, modal template, and metric cards
- `src/styles.css`: All styling (badges for APTO/ALERTA/PELIGRO, modal styles)
- `src/assets/`: SVG logos (not user-facing, bundled for flavor)
- `src-tauri/src-tauri.conf.json`: Defines window size (1200x800 min), bundling config, CSP disabled for simplicity
- `src-tauri/Cargo.toml`: Tauri 2, minimal dependencies (serde, base64, fs/dialog plugins)

## Important Implementation Details

- **Sheet parsing**: Always uses first sheet; expects specific column order (motivo, fecha, denominación, lugar, nServicio, horasProg, horasFirm)
- **Date formats**: Parsed as "DD/MM/YYYY" from Excel; converted to JS Date for comparison
- **Time parsing**: "HH:MM" strings split and converted to decimal hours; also handles numeric input
- **Modal updates**: Real-time via `dataUpdated` event; `showVolunteerModal()` re-renders when Jefatura or Psicosocial flags toggle
- **Sorting**: Sortable headers; stores column and direction in module-level state
- **Exempt volunteers**: Those with < 3 years seniority are exempt from RCP/AIT requirement
- **Excel export metadata**: Includes computed fields; not editable downstream

## Testing the App

- Load the example `.xls` files (15970.xls, etc.) via folder selection
- Toggle estado/time filters to verify state isolation
- Click volunteer rows to inspect details and verify hour calculations
- Test export to all three formats and verify formatting
- Toggle Jefatura checkbox and verify Oficina hour limits adjust

## Building for Distribution

The Tauri bundle is configured for Windows/Mac/Linux. Run:
```bash
npm run tauri build
```
Icons must exist in `src-tauri/icons/` (32x32, 128x128, 128x128@2x PNG; .icns, .ico for macOS/Windows).
