import { open } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { processFolder, parseVolunteerFile } from './modules/parser.js';
import { analyzeData } from './modules/analyzer.js';
import { renderDashboard, setupSortHeaders, applySorting, getSortInfo } from './modules/dashboard.js';
import { exportToXLSX, exportToCSV, exportToPDF } from './modules/exporter.js';

let currentData = [];
let currentEstadoFilter = 'todo';
let currentTimeFilter = 'anoActual';
let currentHorasMode = 'firmadas';
let currentFolderPath = null;

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
        window.open('mailto:mrosaz00@estudiantes.unileon.es', '_blank');
    });
    document.getElementById('manual-github').addEventListener('click', (e) => {
        e.preventDefault();
        window.open('https://github.com', '_blank');
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
});

async function handleSelectFolder() {
    try {
        const folderPath = await open({
            directory: true,
            multiple: false,
            title: 'Selecciona la carpeta con los archivos Excel (.xls)'
        });
        
        if (folderPath) {
            currentFolderPath = folderPath;
            document.getElementById('btn-refresh').classList.remove('hidden');
            
            document.getElementById('dashboard').classList.add('hidden');
            document.getElementById('loader').classList.remove('hidden');
            
            // Allow UI to update
            setTimeout(async () => {
                currentData = await processFolder(folderPath);
                
                document.getElementById('loader').classList.add('hidden');
                
                if (currentData.length === 0) {
                    alert('No se encontraron archivos .xls válidos en la carpeta seleccionada.');
                    return;
                }
                
                updateDashboard();
            }, 100);
        }
    } catch(e) {
        console.error(e);
        alert('Error al seleccionar la carpeta.');
        document.getElementById('loader').classList.add('hidden');
    }
}

async function handleRefresh() {
    if (!currentFolderPath) return;
    
    // Guardar estados manuales actuales
    const manualStates = currentData.map(v => ({
        nvol: v.nvol,
        isJefatura: v.isJefatura,
        psicoOverrides: v.services.filter(s => s.forcePsicosocial).map(s => `${s.fechaStr}|${s.motivo}|${s.denominacion}`)
    }));

    document.getElementById('loader').classList.remove('hidden');
    
    try {
        // Volver a procesar la carpeta
        const newData = await processFolder(currentFolderPath);
        
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

async function handleDroppedPaths(paths) {
    const xlsPaths = paths.filter(p => /\.(xls|xlsx)$/i.test(p));
    if (!xlsPaths.length) return;

    if (!currentFolderPath) {
        showDropOverlay(true, 'Selecciona una carpeta primero antes de añadir archivos');
        setTimeout(hideDropOverlay, 2500);
        return;
    }

    hideDropOverlay();
    document.getElementById('loader').classList.remove('hidden');

    let added = 0, updated = 0;
    for (const srcPath of xlsPaths) {
        try {
            const fileName = srcPath.replace(/\\/g, '/').split('/').pop();
            const destPath = await join(currentFolderPath, fileName);

            // Copy: read via existing Rust command, write via fs plugin
            const base64 = await invoke('read_file_base64', { path: srcPath });
            const binary  = atob(base64);
            const bytes   = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            await writeFile(destPath, bytes);

            // Parse the newly copied file
            const fresh = await parseVolunteerFile({ path: destPath, name: fileName });

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

async function setupDragDrop() {
    try {
        const appWindow = getCurrentWebviewWindow();
        await appWindow.onDragDropEvent((event) => {
            const { type, paths } = event.payload;
            if (type === 'over' || type === 'hover') {
                const hasXls = (paths || []).some(p => /\.(xls|xlsx)$/i.test(p));
                if (hasXls) showDropOverlay(false, 'Suelta el archivo XLS para añadir voluntario');
            } else if (type === 'drop') {
                handleDroppedPaths(paths || []);
            } else {
                hideDropOverlay();
            }
        });
    } catch (e) {
        console.warn('Drag-drop no disponible en este entorno:', e);
    }
}
