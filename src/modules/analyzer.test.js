import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeData } from './analyzer.js';

function makeService({ date, motivo, denominacion, horasFirmadas, forceValid = false, forceInvalid = false }) {
    return {
        fecha: new Date(date),
        fechaStr: '01/01/2026',
        motivo,
        denominacion,
        esValido: ['2.2', '4.1', '4.2', '6.1', '6.7'].includes(motivo)
            || motivo.startsWith('3.')
            || motivo.startsWith('7.'),
        forceValid,
        forceInvalid,
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

test('code 6.5 no longer counts toward the 80h requirement', () => {
    const result = analyzeVolunteer([
        makeService({ date: '2026-01-10', motivo: '6.5', denominacion: 'SERVICIO 6.5', horasFirmadas: 5 }),
    ]);

    assert.equal(result.horasValidasTimeWindow, 0);
});

test('Retén Fénix service does not count toward 80h even with a valid motive', () => {
    const result = analyzeVolunteer([
        makeService({ date: '2026-01-10', motivo: '4.2', denominacion: 'RETEN FENIX', horasFirmadas: 5 }),
    ]);

    assert.equal(result.horasValidasTimeWindow, 0);
    assert.equal(result.horasRetenPC, 0);
});

test('manual H.PC override makes a Retén Fénix service count toward 80h', () => {
    const result = analyzeVolunteer([
        makeService({ date: '2026-01-10', motivo: '4.2', denominacion: 'RETEN FENIX', horasFirmadas: 5, forceValid: true }),
    ]);

    assert.equal(result.horasValidasTimeWindow, 5);
    assert.equal(result.horasRetenPC, 0);
});

test('Retén Romeo (code 5.3) counts as psicosocial hours', () => {
    const result = analyzeVolunteer([
        makeService({ date: '2026-01-10', motivo: '5.3', denominacion: 'RETEN ROMEO', horasFirmadas: 3 }),
    ]);

    assert.equal(result.horasPsicosocial, 3);
});
