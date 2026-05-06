let currentSortCol = 'nvol';
let currentSortAsc = true;
let currentOpenModalNvol = null;
let currentTimeFilter = 'anoActual';
let currentHorasMode = 'firmadas';

const FILTER_LABELS = {
    anoActual:        'AÑO ACTUAL',
    ultimoAno:        '12M EXACTOS',
    ultimoAnoVencido: '12M VENCIDO',
    tresMeses:        '3 MESES',
};

function horasBar(horas, objetivo = 80, width = 10) {
    const pct = Math.min(horas / objetivo, 1);
    const filled = Math.round(pct * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const cls = pct >= 1 ? '' : (pct >= 0.6 ? 'warn' : 'danger');
    return `<span class="prog-bar ${cls}" title="${horas.toFixed(1)}h / ${objetivo}h">${bar}</span>`;
}

export function applySorting(data) {
    return [...data].sort((a, b) => {
        let valA = a[currentSortCol];
        let valB = b[currentSortCol];
        if (currentSortCol === 'nvol') {
            valA = parseInt(valA) || 0;
            valB = parseInt(valB) || 0;
        }
        if (valA < valB) return currentSortAsc ? -1 : 1;
        if (valA > valB) return currentSortAsc ? 1 : -1;
        return 0;
    });
}

export function getSortInfo() {
    return { col: currentSortCol, asc: currentSortAsc };
}

export function setupSortHeaders(onSort) {
    const headers = document.querySelectorAll('th.sortable');
    headers.forEach(th => {
        th.addEventListener('click', () => {
            const sortKey = th.dataset.sort;
            if (currentSortCol === sortKey) {
                currentSortAsc = !currentSortAsc;
            } else {
                currentSortCol = sortKey;
                currentSortAsc = false; // By default sort desc for numbers, but we will handle it
            }
            
            // Update UI
            headers.forEach(h => { h.classList.remove('asc', 'desc'); });
            th.classList.add(currentSortAsc ? 'asc' : 'desc');
            
            onSort();
        });
    });
}

export function renderDashboard(analyzedData, timeFilter = 'anoActual', horasMode = 'firmadas') {
    currentTimeFilter = timeFilter;
    currentHorasMode = horasMode;
    const dashboard = document.getElementById('dashboard');
    dashboard.classList.remove('hidden');

    let totalVols = analyzedData.length;
    let aptos = 0;
    let alerta = 0;
    let peligro = 0;
    
    const sortedData = applySorting(analyzedData);

    const tbody = document.querySelector('#volunteers-table tbody');
    tbody.innerHTML = '';

    sortedData.forEach(vol => {
        if (vol.estado === 'APTO') aptos++;
        if (vol.estado === 'ALERTA') alerta++;
        if (vol.estado === 'PELIGRO') peligro++;
        
        const rcpBase = vol.exentoRCP ? 'EXN' : (vol.cumpleRCP ? 'OK' : 'FAIL');
        const rcpStatus = vol.lastReciclajeStr && !vol.exentoRCP
            ? `${rcpBase}<br><span class="rcp-date">${vol.lastReciclajeStr}</span>`
            : rcpBase;
        const badgeClass = vol.estado === 'APTO' ? 'valid' : (vol.estado === 'ALERTA' ? 'alerta' : 'peligro');
        const estadoLabel = `<span class="badge ${badgeClass}">${vol.estado}</span>`;
        const jefaturaTag = vol.isJefatura ? ' <span class="badge jefatura" title="Jefatura: suma todas las horas de Oficina Voluntario">★ JEF</span>' : '';
        const overrideMark = vol.hasOverrides ? '<span class="override-mark" title="Horas PC con ajustes manuales">~</span>' : '';
        const rowClass = vol.estado === 'PELIGRO' ? 'row-peligro' : (vol.estado === 'ALERTA' ? 'row-alerta' : 'row-apto');

        const tr = document.createElement('tr');
        tr.className = rowClass;
        tr.innerHTML = `
            <td><b>${vol.nvol}</b>${jefaturaTag}</td>
            <td>${vol.antiguedadYears.toFixed(1)}a</td>
            <td>${vol.serviciosEnVentana}</td>
            <td>${vol.horasTotalesTimeWindow.toFixed(1)}h</td>
            <td>${horasBar(vol.horasValidasTimeWindow)} ${vol.horasValidasTimeWindow.toFixed(1)}h${overrideMark}</td>
            <td>${vol.horasPsicosocial.toFixed(1)}h</td>
            <td>${vol.horasRetenPC.toFixed(1)}h</td>
            <td>${vol.cumple90Dias ? 'OK' : 'FAIL'}</td>
            <td>${rcpStatus}</td>
            <td>${estadoLabel}</td>
        `;

        tr.addEventListener('click', () => showVolunteerModal(vol));
        tbody.appendChild(tr);
    });

    document.getElementById('metric-voluntarios').innerText = totalVols;
    document.getElementById('metric-aptos').innerText = aptos;
    document.getElementById('metric-alerta').innerText = alerta;
    document.getElementById('metric-peligro').innerText = peligro;

    // If modal is open, refresh it with updated analysis
    if (currentOpenModalNvol) {
        const vol = sortedData.find(v => v.nvol === currentOpenModalNvol);
        if (vol) showVolunteerModal(vol);
    }
}

function showVolunteerModal(vol) {
    currentOpenModalNvol = vol.nvol;
    document.getElementById('modal-title').innerText = `Voluntario ${vol.nvol}`;
    
    const badgeClass = vol.estado === 'APTO' ? 'valid' : (vol.estado === 'ALERTA' ? 'alerta' : 'peligro');
    const badgeEl = document.getElementById('modal-estado-badge');
    badgeEl.className = `badge ${badgeClass}`;
    badgeEl.innerText = vol.estado;

    document.getElementById('modal-antiguedad').innerText = vol.antiguedadYears.toFixed(1);
    document.getElementById('modal-h-actual').innerText = vol.horasValidasTimeWindow.toFixed(1);
    document.getElementById('modal-dias').innerText = vol.daysSinceLastValid === Infinity ? '∞' : vol.daysSinceLastValid;

    // Jefatura checkbox — dispatches to main.js which updates raw data then re-analyzes
    const jefaturaCheck = document.getElementById('modal-jefatura-checkbox');
    jefaturaCheck.checked = vol.isJefatura;
    jefaturaCheck.onchange = (e) => {
        document.dispatchEvent(new CustomEvent('jefaturaToggled', { detail: { nvol: vol.nvol, value: e.target.checked } }));
    };

    // Alert box
    const alertBox = document.getElementById('modal-alert-box');
    let errors = [];
    if (!vol.cumple80Horas) errors.push(`Le faltan ${(80 - vol.horasValidasTimeWindow).toFixed(1)} horas para el objetivo de las Horas PC.`);
    if (!vol.cumple90Dias) errors.push(`Lleva ${vol.daysSinceLastValid} días sin realizar un servicio válido (máx 90).`);
    if (!vol.cumpleRCP) errors.push(`No se encuentra curso RCP o AIT en los últimos 3 años.`);
    
    if (errors.length > 0) {
        alertBox.innerHTML = errors.map(e => `• ${e}`).join('<br>');
        alertBox.classList.remove('hidden');
    } else {
        alertBox.classList.add('hidden');
    }

    // Update hours column header to reflect active mode
    const horasHeader = document.querySelector('#services-table th:nth-child(4)');
    if (horasHeader) horasHeader.textContent = currentHorasMode === 'programadas' ? 'H.PROG' : 'H.FIRM';

    const tbody = document.querySelector('#services-table tbody');
    tbody.innerHTML = '';

    // Close any open dropdown when clicking outside
    const modalEl = document.getElementById('volunteer-modal');
    modalEl.onclick = (e) => {
        if (!e.target.closest('.svc-actions')) {
            modalEl.querySelectorAll('.svc-menu').forEach(m => {
                m.classList.add('hidden');
                m.previousElementSibling?.classList.remove('open');
            });
        }
    };

    const filterLabel = FILTER_LABELS[currentTimeFilter] || currentTimeFilter.toUpperCase();
    let cutoffInserted = false;
    let seenInWindow = false;

    vol.sortedServices.slice().reverse().forEach(s => {
        if (s.inTimeWindow) seenInWindow = true;

        // Insert cutoff row the first time we cross from in-window to out-of-window
        if (!cutoffInserted && !s.inTimeWindow && seenInWindow) {
            cutoffInserted = true;
            const cutoffTr = document.createElement('tr');
            cutoffTr.className = 'cutoff-row';
            cutoffTr.innerHTML = `<td colspan="5" class="cutoff-cell">── FUERA DE VENTANA [${filterLabel}] ─────────────────────</td>`;
            tbody.appendChild(cutoffTr);
        }

        const tr = document.createElement('tr');

        const den = (s.denominacion || '').toLowerCase();
        const isOficina    = den.includes('oficina voluntario');
        const isEntrevista = den.includes('entrevista');
        // Whether the service would count naturally (without any force flags)
        const isNaturalPC = s.esValido || isOficina || isEntrevista;

        // Badge reflecting current PC state
        let validBadge;
        if (s.forceInvalid) {
            validBadge = '<span class="badge peligro" style="font-size:10px;">-PC</span>';
        } else if (s.forceValid && !s.esValido) {
            validBadge = '<span class="badge alerta" style="font-size:10px;">+PC</span>';
        } else if (s.esValido) {
            validBadge = '<span class="badge valid" style="font-size:10px;">Válido</span>';
        } else if (isOficina) {
            validBadge = '<span class="badge alerta" style="font-size:10px;">Oficina</span>';
        } else if (isEntrevista) {
            validBadge = '<span class="badge alerta" style="font-size:10px;">Entrevista</span>';
        } else {
            validBadge = '<span class="badge peligro" style="font-size:10px;">No Válido</span>';
        }

        // Dim rows that aren't contributing to PC hours
        const isExcluded = s.forceInvalid || (!isNaturalPC && !s.forceValid);
        if (isExcluded) tr.classList.add('row-invalid');
        if (/(RCP|AIT|SVB)/i.test(s.denominacion || '')) tr.classList.add('row-rcp');

        // PC button: state depends on whether service naturally counts or not
        let pcClass, pcLabel;
        if (isNaturalPC) {
            if (s.forceInvalid) {
                pcClass = 'off-red'; pcLabel = 'H. PC';   // excluded — can restore
            } else {
                pcClass = 'on';     pcLabel = 'H. PC';   // counting — can exclude
            }
        } else {
            pcClass = s.forceValid ? 'on' : ''; pcLabel = '+ H. PC';
        }
        const psicoClass = s.forcePsicosocial ? 'on' : '';

        tr.innerHTML = `
            <td>${s.fechaStr}</td>
            <td>${s.motivo}<br>${validBadge}</td>
            <td>${s.denominacion || ''}</td>
            <td>${(s.horasUsadas ?? s.horasFirmadas).toFixed(2)}h</td>
            <td>
                <div class="svc-actions">
                    <button class="btn-svc-toggle">ACC ▾</button>
                    <div class="svc-menu hidden">
                        <button class="svc-menu-btn ${pcClass}">
                            <span class="svc-dot"></span>${pcLabel}
                        </button>
                        <button class="svc-menu-btn ${psicoClass}">
                            <span class="svc-dot"></span>+ Psicosocial
                        </button>
                    </div>
                </div>
            </td>
        `;

        // Open/close dropdown
        const toggleBtn = tr.querySelector('.btn-svc-toggle');
        const menu      = tr.querySelector('.svc-menu');
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = !menu.classList.contains('hidden');
            modalEl.querySelectorAll('.svc-menu').forEach(m => {
                m.classList.add('hidden');
                m.previousElementSibling?.classList.remove('open');
            });
            if (!isOpen) {
                menu.classList.remove('hidden');
                toggleBtn.classList.add('open');
            }
        });

        const [btnPc, btnPsico] = tr.querySelectorAll('.svc-menu-btn');

        btnPc.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isNaturalPC) {
                // Toggle exclusion of a naturally-valid service
                s.forceInvalid = !s.forceInvalid;
            } else {
                // Toggle forced inclusion of a normally-invalid service
                s.forceValid = !s.forceValid;
            }
            document.dispatchEvent(new Event('dataUpdated'));
            showVolunteerModal(vol);
        });

        btnPsico.addEventListener('click', (e) => {
            e.stopPropagation();
            s.forcePsicosocial = !s.forcePsicosocial;
            document.dispatchEvent(new Event('dataUpdated'));
            showVolunteerModal(vol);
        });

        tbody.appendChild(tr);
    });

    document.getElementById('volunteer-modal').classList.remove('hidden');
}

document.getElementById('btn-close-modal').addEventListener('click', () => {
    currentOpenModalNvol = null;
    document.getElementById('volunteer-modal').classList.add('hidden');
});
