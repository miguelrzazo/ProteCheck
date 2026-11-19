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

test('counts total, PC, and Psicosocial services separately within the selected period', () => {
    const year = new Date().getFullYear();
    const service = (motivo, denominacion, horasFirmadas, overrides = {}) => ({
        ...makeService({ date: `${year}-01-10`, motivo, denominacion, horasFirmadas }),
        ...overrides,
    });
    const services = [
        service('2.2', 'SERVICIO PC', 4),
        service('5.3', 'ACOMPAÑAMIENTO', 3),
        service('5,3 - Retén', 'GUARDIA', 2),
        service('6.5', 'FORMACIÓN', 1),
        service('4.2', 'ENTREVISTA', 2),
        service('5.3', 'GUARDIA', 0, { horasProgramadas: 6 }),
        service('5.31', 'OTRO MOTIVO', 1),
        service('5.3', 'FUERA DEL PERIODO', 8, { fecha: new Date(year - 1, 0, 10) }),
    ];
    const volunteer = { nvol: '1', isJefatura: false, services };
    const [signed] = analyzeData([volunteer], 'todo', 'anoActual', 'firmadas');
    const [scheduled] = analyzeData([volunteer], 'todo', 'anoActual', 'programadas');

    assert.deepEqual(
        [signed.serviciosEnVentana, signed.serviciosPC, signed.serviciosPsicosocial],
        [7, 2, 4],
    );
    assert.deepEqual(
        [signed.horasTotalesTimeWindow, signed.horasValidasTimeWindow, signed.horasPsicosocial],
        [13, 6, 7],
    );
    assert.deepEqual(
        [scheduled.serviciosEnVentana, scheduled.serviciosPC, scheduled.serviciosPsicosocial],
        [7, 2, 4],
    );
    assert.deepEqual(
        [scheduled.horasTotalesTimeWindow, scheduled.horasValidasTimeWindow, scheduled.horasPsicosocial],
        [19, 6, 13],
    );
    assert.equal(services[1].esPsicosocial, true);
    assert.equal(services[6].esPsicosocial, false);
});
