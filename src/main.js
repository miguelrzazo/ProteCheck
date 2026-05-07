import { processFolder, parseVolunteerFile } from './modules/parser.js';
import { analyzeData } from './modules/analyzer.js';
import { renderDashboard, setupSortHeaders, applySorting, getSortInfo } from './modules/dashboard.js';
import { exportToXLSX, exportToCSV, exportToPDF } from './modules/exporter.js';
import { initOnboarding } from './modules/onboarding.js';

let currentData = [];
let currentEstadoFilter = 'todo';
let currentTimeFilter = 'anoActual';
let currentHorasMode = 'firmadas';
let currentDirectoryHandle = null;

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
    document.getElementById('btn-select-folder').addEventListener('click', handleSelectFolder);
    
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
    
    // Refresh
    document.getElementById('btn-refresh').addEventListener('click', handleRefresh);

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

async function handleSelectFolder() {
    try {
        const directoryHandle = await window.showDirectoryPicker({
            mode: 'read'
        });
        
        if (directoryHandle) {
            currentDirectoryHandle = directoryHandle;
            document.getElementById('btn-refresh').classList.remove('hidden');
            
            document.getElementById('dashboard').classList.add('hidden');
            document.getElementById('loader').classList.remove('hidden');
            
            // Allow UI to update
            setTimeout(async () => {
                currentData = await processFolder(directoryHandle);
                
                document.getElementById('loader').classList.add('hidden');
                
                if (currentData.length === 0) {
                    alert('No se encontraron archivos .xls o .xlsx válidos en la carpeta seleccionada.');
                    return;
                }
                
                updateDashboard();
            }, 100);
        }
    } catch(e) {
        if (e.name !== 'AbortError') {
            console.error(e);
            alert('Error al seleccionar la carpeta. Asegúrate de usar un navegador compatible (Chrome/Edge/Opera).');
        }
        document.getElementById('loader').classList.add('hidden');
    }
}

async function handleRefresh() {
    if (!currentDirectoryHandle) return;
    
    // Guardar estados manuales actuales
    const manualStates = currentData.map(v => ({
        nvol: v.nvol,
        isJefatura: v.isJefatura,
        psicoOverrides: v.services.filter(s => s.forcePsicosocial).map(s => `${s.fechaStr}|${s.motivo}|${s.denominacion}`)
    }));

    document.getElementById('loader').classList.remove('hidden');
    
    try {
        // Volver a procesar la carpeta
        const newData = await processFolder(currentDirectoryHandle);
        
        // Re-aplicar estados manuales
        newData.forEach(v => {
            const state = manualStates.find(ms => ms.nvol === v.nvol);
            if (state) {
                v.isJefatura = state.isJefatura;
                v.services.forEach(s => {
                    const key = `${s.fechaStr}|${s.motivo}|${s.denominacion}`;
                    if (state.psicoOverrides.includes(key)) {
                        s.forcePsicosocial = true;
                    }
                });
            }
        });

        currentData = newData;
        updateDashboard();
    } catch(e) {
        console.error(e);
        alert('Error al refrescar la carpeta.');
    } finally {
        document.getElementById('loader').classList.add('hidden');
    }
}

function updateDashboard() {
    const analyzed = analyzeData(currentData, currentEstadoFilter, currentTimeFilter, currentHorasMode);
    renderDashboard(analyzed, currentTimeFilter, currentHorasMode);
}

// ── Drag-drop ─────────────────────────────────────────────

function showDropOverlay(warn = false, message = 'Suelta el archivo XLS para añadir voluntario') {
    const overlay = document.getElementById('drop-overlay');
    const inner   = overlay.querySelector('.drop-overlay-inner');
    const icon    = overlay.querySelector('.drop-icon');
    document.getElementById('drop-message').textContent = message;
    inner.classList.toggle('warn', warn);
    icon.textContent = warn ? '⚠' : '⤓';
    overlay.classList.remove('hidden');
}

function hideDropOverlay() {
    document.getElementById('drop-overlay').classList.add('hidden');
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

async function handleDroppedFiles(files) {
    const xlsFiles = Array.from(files).filter(f => /\.(xls|xlsx)$/i.test(f.name));
    if (!xlsFiles.length) return;

    if (!currentDirectoryHandle) {
        showDropOverlay(true, 'Selecciona una carpeta primero antes de añadir archivos');
        setTimeout(hideDropOverlay, 2500);
        return;
    }

    hideDropOverlay();
    document.getElementById('loader').classList.remove('hidden');

    let added = 0, updated = 0;
    for (const file of xlsFiles) {
        try {
            // Parse the newly dropped file
            const fresh = await parseVolunteerFile(file);

            // Merge into currentData
            const existingIdx = currentData.findIndex(v => v.nvol === fresh.nvol);
            if (existingIdx >= 0) {
                currentData[existingIdx] = mergeVolunteerState(currentData[existingIdx], fresh);
                updated++;
            } else {
                currentData.push(fresh);
                added++;
            }
        } catch (e) {
            console.error('Error processing dropped file', e);
        }
    }

    document.getElementById('loader').classList.add('hidden');
    if (added + updated > 0) updateDashboard();

    // Brief toast-style message via the overlay
    const msg = [added && `${added} voluntario${added > 1 ? 's' : ''} añadido${added > 1 ? 's' : ''}`,
                 updated && `${updated} actualizado${updated > 1 ? 's' : ''}`]
        .filter(Boolean).join(', ');
    if (msg) {
        showDropOverlay(false, `✓ ${msg}`);
        setTimeout(hideDropOverlay, 1800);
    }
}

function setupDragDrop() {
    document.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        if (event.dataTransfer.types.includes('Files')) {
            showDropOverlay(false, 'Suelta el archivo XLS para añadir voluntario');
        }
    });

    document.addEventListener('dragleave', (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        if (event.clientX === 0 || event.clientY === 0) {
            hideDropOverlay();
        }
    });

    document.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        const files = event.dataTransfer.files;
        if (files && files.length > 0) {
            handleDroppedFiles(files);
        } else {
            hideDropOverlay();
        }
    });
}
