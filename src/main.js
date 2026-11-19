import { inject } from '@vercel/analytics';
import { processFolder } from './modules/parser.js';
import { filesFromDrop } from './modules/import-files.js';
import { analyzeData } from './modules/analyzer.js';
import { renderDashboard, setupSortHeaders, applySorting, getSortInfo } from './modules/dashboard.js';
import { exportToXLSX, exportToCSV, exportToPDF } from './modules/exporter.js';
import { initOnboarding } from './modules/onboarding.js';

// Initialize Vercel Web Analytics
inject();

let currentData = [];
let currentEstadoFilter = 'todo';
let currentTimeFilter = 'anoActual';
let currentHorasMode = 'firmadas';
let importing = false;
let refreshingFolder = false;

// ── Theme toggle ─────────────────────────────────────────
const THEMES = ['dark', 'light', 'system'];
const THEME_ICONS  = { dark: '🌙', light: '☀️', system: '◑' };
const THEME_TITLES = { dark: 'Modo oscuro', light: 'Modo claro', system: 'Seguir sistema' };
let currentTheme = localStorage.getItem('protecheck-theme') || 'system';

function applyTheme(theme) {
    currentTheme = theme;
    localStorage.setItem('protecheck-theme', theme);
    const root = document.documentElement;
    if (theme === 'system') {
        root.removeAttribute('data-theme');
    } else {
        root.setAttribute('data-theme', theme);
    }
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) {
        btn.textContent = THEME_ICONS[theme];
        btn.title = THEME_TITLES[theme];
    }
}

// Detect initial theme before DOMContentLoaded to avoid flash
applyTheme(currentTheme);

document.addEventListener('DOMContentLoaded', () => {
    // Theme toggle
    document.getElementById('btn-theme-toggle').addEventListener('click', () => {
        const idx = THEMES.indexOf(currentTheme);
        applyTheme(THEMES[(idx + 1) % THEMES.length]);
    });
    // Sync icon now that DOM is ready
    const themeBtn = document.getElementById('btn-theme-toggle');
    themeBtn.textContent = THEME_ICONS[currentTheme];
    themeBtn.title = THEME_TITLES[currentTheme];

    // App version
    const verEl = document.getElementById('app-version');
    if (verEl) verEl.textContent = `v${__APP_VERSION__}`;

    // Buttons
    const folderInput = document.getElementById('folder-input');
    const filesInput = document.getElementById('files-input');
    const selectFolder = (refresh) => {
        refreshingFolder = refresh;
        folderInput.click();
    };
    document.getElementById('btn-select-folder').addEventListener('click', () => selectFolder(false));
    document.getElementById('btn-refresh').addEventListener('click', () => selectFolder(true));
    document.getElementById('btn-select-files').addEventListener('click', () => filesInput.click());

    folderInput.addEventListener('change', () => {
        const files = Array.from(folderInput.files);
        folderInput.value = '';
        if (files.length) importReports(files, { folder: true, preserve: refreshingFolder });
    });
    filesInput.addEventListener('change', () => {
        const files = Array.from(filesInput.files);
        filesInput.value = '';
        if (files.length) importReports(files);
    });
    
    // Estado Filters
    const estadoBtns = document.querySelectorAll('.estado-btn');
    estadoBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            estadoBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentEstadoFilter = e.target.dataset.filter;
            updateDashboard();
        });
    });

    // Time Filters
    const timeBtns = document.querySelectorAll('.time-btn');
    timeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            timeBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentTimeFilter = e.target.dataset.filter;
            updateDashboard();
        });
    });
    
    // Horas mode toggle
    const horasBtns = document.querySelectorAll('.horas-btn');
    horasBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            horasBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentHorasMode = e.target.dataset.mode;
            updateDashboard();
        });
    });

    // Exports — apply the same analysis + sort visible in the UI
    function getExportData() {
        const analyzed = analyzeData(currentData, currentEstadoFilter, currentTimeFilter, currentHorasMode);
        return applySorting(analyzed);
    }
    document.getElementById('btn-export-xlsx').addEventListener('click', () => {
        exportToXLSX(getExportData(), currentHorasMode, currentTimeFilter, getSortInfo());
    });
    document.getElementById('btn-export-csv').addEventListener('click', () => {
        exportToCSV(getExportData(), currentHorasMode, currentTimeFilter);
    });
    document.getElementById('btn-export-pdf').addEventListener('click', () => {
        exportToPDF(getExportData(), currentHorasMode, currentTimeFilter, getSortInfo());
    });
    
    // Sort Headers
    setupSortHeaders(() => { updateDashboard() });

    // Manual button dropdown
    const manualBtn  = document.getElementById('btn-manual');
    const manualMenu = document.getElementById('manual-menu');
    manualBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        manualMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', () => manualMenu.classList.add('hidden'));

    // Open external links via window.open so Tauri forwards them to the system browser
    document.getElementById('manual-contact').addEventListener('click', (e) => {
        e.preventDefault();
        window.open('mailto:mrz_coding_sol.figure210@passinbox.com', '_blank');
    });
    document.getElementById('manual-github').addEventListener('click', (e) => {
        e.preventDefault();
        window.open('https://github.com/miguelrzazo/ProteCheck', '_blank');
    });

    // Manual modal
    document.getElementById('manual-open').addEventListener('click', (e) => {
        e.stopPropagation();
        manualMenu.classList.add('hidden');
        document.getElementById('manual-modal').classList.remove('hidden');
    });
    document.getElementById('manual-close').addEventListener('click', () => {
        document.getElementById('manual-modal').classList.add('hidden');
    });
    document.getElementById('manual-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('manual-modal')) {
            document.getElementById('manual-modal').classList.add('hidden');
        }
    });

    // Data updates from UI
    document.addEventListener('dataUpdated', () => { updateDashboard() });

    // ── Drag-drop file handling ───────────────────────────
    setupDragDrop();

    // Jefatura toggle from modal — updates the raw volunteer so it persists through re-analysis
    document.addEventListener('jefaturaToggled', (e) => {
        const raw = currentData.find(v => v.nvol === e.detail.nvol);
        if (raw) raw.isJefatura = e.detail.value;
        updateDashboard();
    });

    // First-run onboarding
    initOnboarding();
});

function updateDashboard() {
    const analyzed = analyzeData(currentData, currentEstadoFilter, currentTimeFilter, currentHorasMode);
    renderDashboard(analyzed, currentTimeFilter, currentHorasMode);
}

// ── Drag-drop ─────────────────────────────────────────────

function showDropOverlay() {
    const overlay = document.getElementById('drop-overlay');
    overlay.classList.remove('hidden');
}

function hideDropOverlay() {
    document.getElementById('drop-overlay').classList.add('hidden');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.add('hidden'), 2200);
}

// Preserve manual service flags when re-importing a volunteer
function mergeVolunteerState(existing, fresh) {
    fresh.isJefatura = existing.isJefatura;
    const prevByKey = {};
    existing.services.forEach(s => {
        prevByKey[`${s.fechaStr}|${s.motivo}|${s.denominacion}`] = s;
    });
    fresh.services.forEach(s => {
        const prev = prevByKey[`${s.fechaStr}|${s.motivo}|${s.denominacion}`];
        if (prev) {
            s.forcePsicosocial = prev.forcePsicosocial || false;
            s.forceValid       = prev.forceValid       || false;
            s.forceInvalid     = prev.forceInvalid     || false;
        }
    });
    return fresh;
}

async function importReports(source, { folder = false, preserve = true } = {}) {
    if (importing) {
        showToast('Espera a que termine la importación en curso.');
        return;
    }

    const loader = document.getElementById('loader');
    importing = true;
    loader.classList.remove('hidden');
    try {
        const reports = await processFolder(await source);
        if (!reports.length) {
            showToast('No se encontraron informes .xls o .xlsx válidos.');
            return;
        }

        const existing = new Map(currentData.map(report => [report.nvol, report]));
        const imported = folder ? new Map() : existing;
        let added = 0;
        let updated = 0;
        for (const fresh of reports) {
            const previous = imported.get(fresh.nvol) || (preserve && existing.get(fresh.nvol));
            if (previous) {
                mergeVolunteerState(previous, fresh);
                updated++;
            } else {
                added++;
            }
            imported.set(fresh.nvol, fresh);
        }
        currentData = [...imported.values()];
        if (folder) document.getElementById('btn-refresh').classList.remove('hidden');
        updateDashboard();

        const message = [
            added && `${added} voluntario${added > 1 ? 's' : ''} añadido${added > 1 ? 's' : ''}`,
            updated && `${updated} actualizado${updated > 1 ? 's' : ''}`,
        ].filter(Boolean).join(', ');
        showToast(`✓ ${message}`);
    } catch (error) {
        console.error('Error al importar informes', error);
        showToast('No se pudieron leer los archivos seleccionados.');
    } finally {
        importing = false;
        loader.classList.add('hidden');
    }
}

function setupDragDrop() {
    document.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        if (event.dataTransfer.types.includes('Files')) {
            showDropOverlay();
        }
    });

    document.addEventListener('dragleave', (event) => {
        event.preventDefault();
        event.stopPropagation();

        // Hide when the pointer leaves the viewport through any edge
        const inViewport = event.clientX > 0 && event.clientY > 0 &&
            event.clientX < (window.innerWidth || document.documentElement.clientWidth) &&
            event.clientY < (window.innerHeight || document.documentElement.clientHeight);
        if (!inViewport || event.relatedTarget === null) {
            hideDropOverlay();
        }
    });

    document.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();

        hideDropOverlay();
        if (event.dataTransfer.types.includes('Files') && !importing) {
            importReports(filesFromDrop(event.dataTransfer));
        }
    });
}
