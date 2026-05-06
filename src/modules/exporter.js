import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile, writeFile } from '@tauri-apps/plugin-fs';

// ── Shared helpers ────────────────────────────────────────
const SORT_LABELS = {
    nvol: 'NVOL', antiguedadYears: 'ANTIGÜEDAD', serviciosEnVentana: 'SERVICIOS',
    horasTotalesTimeWindow: 'H.TOT', horasValidasTimeWindow: 'HORAS PC',
    horasPsicosocial: 'H.PSICO', horasRetenPC: 'RETÉN PC',
};

const TIME_LABELS = {
    anoActual: 'AÑO ACTUAL', ultimoAno: '12M EXACTOS',
    ultimoAnoVencido: '12M VENCIDO', tresMeses: '3 MESES',
};

function horasLabel(mode) {
    return mode === 'programadas' ? 'H.PROG' : 'H.FIRM';
}

function nvol(v) {
    let s = v.nvol;
    if (v.isJefatura)  s += ' ★';
    if (v.hasOverrides) s += ' ~';
    return s;
}

function rcpLabel(v) {
    return v.exentoRCP ? 'EXN' : (v.cumpleRCP ? 'SÍ' : 'NO');
}

function buildRows(data, horasMode) {
    const hLabel = `Horas PC (${horasMode === 'programadas' ? 'Prog.' : 'Firm.'})`;
    return {
        headers: [
            'NVOL', 'Antigüedad', 'Servicios', 'H. Totales',
            hLabel, 'H. Psico', 'Retén PC',
            'Cumple 80h', 'Días sin servicio', 'Cumple 90d', 'RCP/AIT', 'ESTADO',
        ],
        rows: data.map(v => [
            nvol(v),
            `${v.antiguedadYears.toFixed(1)}a`,
            v.serviciosEnVentana,
            v.horasTotalesTimeWindow.toFixed(1),
            v.horasValidasTimeWindow.toFixed(1),
            v.horasPsicosocial.toFixed(1),
            v.horasRetenPC.toFixed(1),
            v.cumple80Horas ? 'Sí' : 'No',
            v.daysSinceLastValid === Infinity ? '∞' : v.daysSinceLastValid,
            v.cumple90Dias ? 'Sí' : 'No',
            rcpLabel(v),
            v.estado,
        ]),
    };
}

// ── XLSX ──────────────────────────────────────────────────
export async function exportToXLSX(data, horasMode = 'firmadas', timeFilter = 'anoActual', sortInfo = {}) {
    const { headers, rows } = buildRows(data, horasMode);
    const revisionDate = format(new Date(), 'dd/MM/yyyy HH:mm');

    // Metadata rows at top
    const metaRows = [
        ['ProteCheck — Reporte de Cumplimiento'],
        [`Generado: ${revisionDate}`],
        [`Periodo: ${TIME_LABELS[timeFilter] || timeFilter}   Horas: ${horasMode.toUpperCase()}   Ordenado por: ${SORT_LABELS[sortInfo.col] || sortInfo.col || 'NVOL'} ${sortInfo.asc ? '↑' : '↓'}`],
        [],
        headers,
        ...rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(metaRows);

    // Style the header row (row index 4, 0-based)
    const headerRowIdx = 4;
    headers.forEach((_, ci) => {
        const cellAddr = XLSX.utils.encode_cell({ r: headerRowIdx, c: ci });
        if (ws[cellAddr]) {
            ws[cellAddr].s = { font: { bold: true }, fill: { fgColor: { rgb: '1A3A6B' } } };
        }
    });

    // Column widths
    ws['!cols'] = [8, 10, 9, 10, 12, 9, 9, 10, 14, 10, 8, 9].map(w => ({ wch: w }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cumplimiento');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    try {
        const filePath = await save({
            filters: [{ name: 'Excel', extensions: ['xlsx'] }],
            defaultPath: `ProteCheck_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`,
        });
        if (filePath) {
            await writeFile(filePath, new Uint8Array(excelBuffer));
            alert('Exportado a XLSX con éxito.');
        }
    } catch (e) {
        console.error(e);
        alert('Error al exportar XLSX.');
    }
}

// ── CSV ───────────────────────────────────────────────────
export async function exportToCSV(data, horasMode = 'firmadas', timeFilter = 'anoActual') {
    const { headers, rows } = buildRows(data, horasMode);
    const revisionDate = format(new Date(), 'dd/MM/yyyy HH:mm');

    const allRows = [
        ['ProteCheck — Reporte de Cumplimiento'],
        [`Generado: ${revisionDate}`],
        [`Periodo: ${TIME_LABELS[timeFilter] || timeFilter}`, `Horas: ${horasMode.toUpperCase()}`],
        [],
        headers,
        ...rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(allRows);
    const csv = XLSX.utils.sheet_to_csv(ws);

    try {
        const filePath = await save({
            filters: [{ name: 'CSV', extensions: ['csv'] }],
            defaultPath: `ProteCheck_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`,
        });
        if (filePath) {
            await writeTextFile(filePath, csv);
            alert('Exportado a CSV con éxito.');
        }
    } catch (e) {
        console.error(e);
        alert('Error al exportar CSV.');
    }
}

// ── PDF ───────────────────────────────────────────────────
// SAMUR-PC terminal palette (print-safe on white)
const PDF_NAVY   = [10,  30,  70];   // deep navy header
const PDF_BLUE   = [26, 107, 255];   // samur blue accent
const PDF_THEAD  = [20,  55, 120];   // table header
const PDF_ALT    = [240, 245, 253];  // alternating row
const PDF_WHITE  = [255, 255, 255];
const PDF_DIM    = [140, 150, 165];
const PDF_TEXT   = [20,  25,  35];

const C_APTO    = [0,   160,  90];
const C_ALERTA  = [185, 135,   0];
const C_PELIGRO = [210,  35,  20];

export async function exportToPDF(data, horasMode = 'firmadas', timeFilter = 'anoActual', sortInfo = {}) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();   // 297mm
    const ph = doc.internal.pageSize.getHeight();  // 210mm
    const revisionDate = format(new Date(), 'dd/MM/yyyy HH:mm');
    const sortLabel = `${SORT_LABELS[sortInfo.col] || sortInfo.col || 'NVOL'} ${sortInfo.asc ? '↑' : '↓'}`;

    // ── Header band ────────────────────────────────────────
    doc.setFillColor(...PDF_NAVY);
    doc.rect(0, 0, pw, 22, 'F');

    // Accent stripe
    doc.setFillColor(...PDF_BLUE);
    doc.rect(0, 22, pw, 1.2, 'F');

    // Logo prompt
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...PDF_BLUE);
    doc.text('SAMUR·PC >', 10, 9);

    doc.setTextColor(...PDF_WHITE);
    doc.setFontSize(13);
    doc.text('ProteCheck', 37, 9);

    // App version / subtitle
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(160, 185, 230);
    doc.text('REPORTE DE CUMPLIMIENTO', 10, 16);

    // Right-side metadata
    doc.setFontSize(7);
    doc.setTextColor(130, 160, 210);
    const meta = `${revisionDate}  ·  ${TIME_LABELS[timeFilter] || timeFilter}  ·  HORAS: ${horasMode.toUpperCase()}  ·  ORDEN: ${sortLabel}  ·  ${data.length} voluntarios`;
    doc.text(meta, pw - 10, 16, { align: 'right' });

    // ── Legend strip ───────────────────────────────────────
    const legendY = 27;
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    const legends = [
        { label: '● APTO',    color: C_APTO },
        { label: '● ALERTA',  color: C_ALERTA },
        { label: '● PELIGRO', color: C_PELIGRO },
        { label: '★ Jefatura', color: [180, 140, 0] },
        { label: '~ Ajustes manuales', color: [...PDF_BLUE] },
    ];
    let lx = 10;
    legends.forEach(({ label, color }) => {
        doc.setTextColor(...color);
        doc.text(label, lx, legendY);
        lx += doc.getTextWidth(label) + 6;
    });

    // ── Table ──────────────────────────────────────────────
    const hLabel = `HORAS PC\n(${horasMode === 'programadas' ? 'PROG' : 'FIRM'})`;
    const tableHead = [
        ['NVOL', 'ANTIGÜEDAD', 'SERV', 'H.TOT', hLabel, 'H.PSICO', 'RETÉN', '80H', 'DÍAS', '90D', 'RCP', 'ESTADO'],
    ];
    const tableBody = data.map(v => [
        nvol(v),
        `${v.antiguedadYears.toFixed(1)}a`,
        v.serviciosEnVentana,
        `${v.horasTotalesTimeWindow.toFixed(1)}h`,
        `${v.horasValidasTimeWindow.toFixed(1)}h`,
        `${v.horasPsicosocial.toFixed(1)}h`,
        `${v.horasRetenPC.toFixed(1)}h`,
        v.cumple80Horas ? 'SÍ' : 'NO',
        v.daysSinceLastValid === Infinity ? '∞' : String(v.daysSinceLastValid),
        v.cumple90Dias ? 'SÍ' : 'NO',
        rcpLabel(v),
        v.estado,
    ]);

    autoTable(doc, {
        startY: 31,
        head: tableHead,
        body: tableBody,
        theme: 'plain',
        styles: {
            font: 'courier',
            fontSize: 7.5,
            cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
            textColor: PDF_TEXT,
            lineColor: [210, 218, 230],
            lineWidth: 0.2,
        },
        headStyles: {
            fillColor: PDF_THEAD,
            textColor: PDF_WHITE,
            fontStyle: 'bold',
            fontSize: 7,
            halign: 'center',
            valign: 'middle',
            minCellHeight: 8,
        },
        alternateRowStyles: {
            fillColor: PDF_ALT,
        },
        bodyStyles: {
            valign: 'middle',
        },
        columnStyles: {
            0:  { halign: 'left',   cellWidth: 18 },  // NVOL
            1:  { halign: 'center', cellWidth: 18 },  // Antigüedad
            2:  { halign: 'center', cellWidth: 12 },  // Servicios
            3:  { halign: 'center', cellWidth: 16 },  // H.Tot
            4:  { halign: 'center', cellWidth: 20 },  // Horas PC
            5:  { halign: 'center', cellWidth: 16 },  // H.Psico
            6:  { halign: 'center', cellWidth: 14 },  // Retén
            7:  { halign: 'center', cellWidth: 12 },  // 80h
            8:  { halign: 'center', cellWidth: 14 },  // Días
            9:  { halign: 'center', cellWidth: 12 },  // 90d
            10: { halign: 'center', cellWidth: 12 },  // RCP
            11: { halign: 'center', cellWidth: 22 },  // Estado
        },
        didParseCell(hook) {
            const { section, column, cell } = hook;
            if (section !== 'body') return;
            // Colour 80h and 90d NO cells
            if ((column.index === 7 || column.index === 9) && cell.raw === 'NO') {
                cell.styles.textColor = C_PELIGRO;
                cell.styles.fontStyle = 'bold';
            }
            // Colour ESTADO column
            if (column.index === 11) {
                if (cell.raw === 'APTO')    { cell.styles.textColor = C_APTO;    cell.styles.fontStyle = 'bold'; }
                if (cell.raw === 'ALERTA')  { cell.styles.textColor = C_ALERTA;  cell.styles.fontStyle = 'bold'; }
                if (cell.raw === 'PELIGRO') { cell.styles.textColor = C_PELIGRO; cell.styles.fontStyle = 'bold'; }
            }
        },
        didDrawPage(hook) {
            const { pageNumber, pageCount } = hook;
            // Footer
            doc.setFont('courier', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(...PDF_DIM);
            doc.text(`ProteCheck · SAMUR-PC · ${revisionDate}`, 10, ph - 5);
            doc.text(`Pág. ${pageNumber} / ${pageCount}`, pw - 10, ph - 5, { align: 'right' });
            // Bottom accent line
            doc.setFillColor(...PDF_BLUE);
            doc.rect(0, ph - 3, pw, 0.8, 'F');
        },
    });

    try {
        const filePath = await save({
            filters: [{ name: 'PDF', extensions: ['pdf'] }],
            defaultPath: `ProteCheck_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`,
        });
        if (filePath) {
            await writeFile(filePath, new Uint8Array(doc.output('arraybuffer')));
            alert('Exportado a PDF con éxito.');
        }
    } catch (e) {
        console.error(e);
        alert('Error al exportar PDF.');
    }
}
