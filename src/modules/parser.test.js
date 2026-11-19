import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseVolunteerFile, processFolder } from './parser.js';

function makeFile(name, rows) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
    const bookType = /\.xls$/i.test(name) ? 'biff8' : 'xlsx';
    const buf = XLSX.write(wb, { type: 'buffer', bookType });
    return new File([buf], name);
}

const HEADER_7 = ['Motivo', 'Fecha', 'Denominacion', 'Lugar', 'N. Servicio', 'Horas', 'H.firmadas'];

test('parses 7-column xlsx layout (copy-pasted, no leading column)', async () => {
    const file = makeFile('12579.xlsx', [
        HEADER_7,
        ['4.2', '20/12/2025', 'DISPOSITIVO DE NAVIDAD', 'CENTRO', 10818, 6, '06:00'],
        ['6.5', '17/10/2025', 'ENTREVISTA A ASPIRANTES', 'BASE 0', 9589, 6, '06:00'],
    ]);

    const vol = await parseVolunteerFile(file);
    assert.equal(vol.nvol, '12579');
    assert.equal(vol.services.length, 2);
    assert.equal(vol.services[0].motivo, '4.2');
    assert.equal(vol.services[0].fechaStr, '20/12/2025');
    assert.equal(vol.services[0].horasFirmadas, 6);
    assert.equal(vol.services[0].esValido, true);
    assert.equal(vol.services[1].esValido, false);
});

test('parses 8-column xls layout (leading empty column)', async () => {
    const file = makeFile('15970.xls', [
        [null, 'Motivo', 'Fecha', 'Denominacion', 'Lugar', 'N. Servicio', 'Horas', 'H.firmadas'],
        [null, '3.1', '18/01/2026', 'Equipo Psicosocial', 'Estación Atocha', 5235, 11, '11:00'],
    ]);

    const vol = await parseVolunteerFile(file);
    assert.equal(vol.services.length, 1);
    assert.equal(vol.services[0].motivo, '3.1');
    assert.equal(vol.services[0].denominacion, 'Equipo Psicosocial');
    assert.equal(vol.services[0].esValido, true);
});

test('imports a folder with mixed-case Excel extensions and ignores companion files', async () => {
    const rows = [
        HEADER_7,
        ['4.2', '20/12/2025', 'SERVICIO DE PRUEBA', 'CENTRO', 1, 6, '06:00'],
    ];
    const reports = await processFolder([
        makeFile('9001.XLS', rows),
        new File(['omitidos'], 'omitidos.csv'),
        makeFile('9002.xlsx', rows),
    ]);

    assert.deepEqual(reports.map(report => report.nvol), ['9001', '9002']);
    assert.ok(reports.every(report => report.services.length === 1));
});
