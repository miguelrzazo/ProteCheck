import * as XLSX from 'xlsx';
import { parseStringDate, parseHorasFirmadas } from './analyzer.js';
import { isExcelFile } from './import-files.js';

const HEADER_ALIASES = {
    'motivo': 'motivo',
    'fecha': 'fecha',
    'denominacion': 'denominacion',
    'lugar': 'lugar',
    'n. servicio': 'nservicio',
    'horas': 'horas',
    'h.firmadas': 'hfirmadas',
};

function findColumnMap(rows) {
    // Scan the first rows for a header row containing a "Motivo" column
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
        const r = rows[i];
        if (!r) continue;
        const motivoIdx = r.findIndex(c => c != null && String(c).trim().toLowerCase() === 'motivo');
        if (motivoIdx !== -1) {
            const col = { motivo: motivoIdx };
            for (let j = motivoIdx; j < r.length; j++) {
                const key = r[j] != null ? String(r[j]).trim().toLowerCase() : '';
                if (HEADER_ALIASES[key]) col[HEADER_ALIASES[key]] = j;
            }
            return { headerRow: i, col };
        }
    }
    // Fallback: legacy 8-column layout with a leading empty column
    return { headerRow: 0, col: { motivo: 1, fecha: 2, denominacion: 3, lugar: 4, nservicio: 5, horas: 6, hfirmadas: 7 } };
}

export async function parseVolunteerFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const match = file.name.match(/\d+/);
    const nvol = match ? match[0] : file.name;
    const services = [];

    const { headerRow, col } = findColumnMap(rows);

    for (let i = headerRow + 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r) continue;
        const motivo = r[col.motivo]?.toString().trim();
        if (!motivo) continue;

        const fechaStr  = r[col.fecha]?.toString().trim();
        const denom     = r[col.denominacion]?.toString().trim();
        const lugar     = r[col.lugar]?.toString().trim();
        const nServicio = parseFloat(r[col.nservicio]);
        const horasProg = parseFloat(r[col.horas]) || 0;
        const horasFirmStr = r[col.hfirmadas]?.toString().trim();

        services.push({
            motivo,
            fecha:           parseStringDate(fechaStr),
            fechaStr,
            denominacion:    denom,
            lugar,
            nServicio,
            horasProgramadas: horasProg,
            horasFirmadas:   parseHorasFirmadas(horasFirmStr),
            esValido: ['2.2', '4.1', '4.2', '6.1', '6.7'].includes(motivo)
                      || motivo.startsWith('3.') || motivo.startsWith('7.'),
        });
    }

    return { nvol, fileName: file.name, isJefatura: false, services };
}

export async function processFolder(files) {
    const volunteers = [];
    for (const file of files.filter(isExcelFile)) {
        try {
            volunteers.push(await parseVolunteerFile(file));
        } catch (error) {
            console.error('Error reading file', file.name, error);
        }
    }
    return volunteers;
}
