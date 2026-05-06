import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeData } from './analyzer.js';

function makeService({ date, motivo, denominacion, horasFirmadas }) {
    return {
        fecha: new Date(date),
        fechaStr: '01/01/2026',
        motivo,
        denominacion,
        esValido: ['2.2', '4.1', '4.2', '6.1', '6.7', '6.5'].includes(motivo)
            || motivo.startsWith('3.')
            || motivo.startsWith('7.'),
        horasFirmadas,
        horasProgramadas: horasFirmadas,
    };
}

function analyzeVolunteer(services, isJefatura = false) {
    return analyzeData(
        [{ nvol: '1', isJefatura, services }],
        'todo',
        'anoActual',
        'firmadas'
    )[0];
}

test('non-jefatura only counts one Oficina Voluntario service even when motive is PC-valid', () => {
    const result = analyzeVolunteer([
        makeService({ date: '2026-01-10', motivo: '3.1', denominacion: 'OFICINA VOLUNTARIO', horasFirmadas: 2 }),
        makeService({ date: '2026-02-10', motivo: '3.2', denominacion: 'OFICINA VOLUNTARIO', horasFirmadas: 3 }),
    ]);

    assert.equal(result.horasValidasTimeWindow, 2);
});

test('jefatura counts all Oficina Voluntario services', () => {
    const result = analyzeVolunteer([
        makeService({ date: '2026-01-10', motivo: '3.1', denominacion: 'OFICINA VOLUNTARIO', horasFirmadas: 2 }),
        makeService({ date: '2026-02-10', motivo: '3.2', denominacion: 'OFICINA VOLUNTARIO', horasFirmadas: 3 }),
    ], true);

    assert.equal(result.horasValidasTimeWindow, 5);
});

test('non-jefatura still counts a single Oficina Voluntario service', () => {
    const result = analyzeVolunteer([
        makeService({ date: '2026-01-10', motivo: '3.1', denominacion: 'OFICINA VOLUNTARIO', horasFirmadas: 2 }),
        makeService({ date: '2026-02-10', motivo: '2.2', denominacion: 'SERVICIO PC', horasFirmadas: 4 }),
    ]);

    assert.equal(result.horasValidasTimeWindow, 6);
});
