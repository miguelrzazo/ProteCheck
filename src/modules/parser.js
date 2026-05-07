import * as XLSX from 'xlsx';
import { parseStringDate, parseHorasFirmadas } from './analyzer.js';

export async function parseVolunteerFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const match = file.name.match(/\d+/);
    const nvol = match ? match[0] : file.name;
    const services = [];

    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length < 8) continue;
        const motivo = r[1]?.toString().trim();
        if (!motivo) continue;

        const fechaStr  = r[2]?.toString().trim();
        const denom     = r[3]?.toString().trim();
        const lugar     = r[4]?.toString().trim();
        const nServicio = parseFloat(r[5]);
        const horasProg = parseFloat(r[6]) || 0;
        const horasFirmStr = r[7]?.toString().trim();

        services.push({
            motivo,
            fecha:           parseStringDate(fechaStr),
            fechaStr,
            denominacion:    denom,
            lugar,
            nServicio,
            horasProgramadas: horasProg,
            horasFirmadas:   parseHorasFirmadas(horasFirmStr),
            esValido: ['2.2', '4.1', '4.2', '6.1', '6.7', '6.5'].includes(motivo)
                      || motivo.startsWith('3.') || motivo.startsWith('7.'),
        });
    }

    return { nvol, fileName: file.name, isJefatura: false, services };
}

export async function processFolder(directoryHandle) {
    const volunteers = [];
    for await (const entry of directoryHandle.values()) {
        if (entry.kind === 'file' && (entry.name.endsWith('.xls') || entry.name.endsWith('.xlsx'))) {
            try {
                const file = await entry.getFile();
                volunteers.push(await parseVolunteerFile(file));
            } catch (e) {
                console.error('Error reading file', entry.name, e);
            }
        }
    }
    return volunteers;
}
