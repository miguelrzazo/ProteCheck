import { isAfter, subMonths, subYears, startOfMonth, differenceInDays, getYear } from 'date-fns';

export function parseStringDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date();
}

export function parseHorasFirmadas(value) {
    if (typeof value === 'string' && value.includes(':')) {
        const [h, m] = value.split(':').map(Number);
        return h + (m / 60);
    }
    return parseFloat(value) || 0;
}

export function analyzeData(volunteers, estadoFilter, timeFilter, horasMode = 'firmadas') {
    const today = new Date();
    const currentYear = getYear(today);
    
    let analyzed = volunteers.map(vol => {
        // Sort services by date ascending
        const sortedServices = [...vol.services]
            .filter(s => s.fecha != null)
            .sort((a, b) => a.fecha - b.fecha);
            
        const firstServiceDate = sortedServices.length > 0 ? sortedServices[0].fecha : today;
        const antiguedadYears = differenceInDays(today, firstServiceDate) / 365.25;
        
        let horasTotalesTimeWindow = 0;
        let horasValidasTimeWindow = 0;
        let horasPsicosocial = 0;
        let horasRetenPC = 0;
        let serviciosEnVentana = 0;

        let hasRCP = false;
        let hasAIT = false;
        let lastValidServiceDate = null;
        let hasCountedOficinaInWindow = false;
        let lastReciclajeDate = null;
        
        for (const s of sortedServices) {
            const den = (s.denominacion || '').toLowerCase();
            const isOficina = den.includes('oficina voluntario');
            const isEntrevista = den.includes('entrevista');

            // Check valid services (PC) for 90-days clock
            if (s.esValido || isOficina || isEntrevista) {
                lastValidServiceDate = s.fecha;
            }

            // Time window calculation for hours
            let isInTimeWindow = false;
            if (timeFilter === 'ultimoAno') {
                isInTimeWindow = isAfter(s.fecha, subYears(today, 1));
            } else if (timeFilter === 'ultimoAnoVencido') {
                // From the 1st of the same month, 12 months ago
                isInTimeWindow = isAfter(s.fecha, startOfMonth(subYears(today, 1)));
            } else if (timeFilter === 'tresMeses') {
                isInTimeWindow = isAfter(s.fecha, subMonths(today, 3));
            } else {
                // Default: current year (Año natural)
                isInTimeWindow = getYear(s.fecha) === currentYear;
            }

            s.inTimeWindow = isInTimeWindow;
            // Hours to use for all calculations based on selected mode
            const horas = horasMode === 'programadas' ? (s.horasProgramadas || 0) : s.horasFirmadas;
            s.horasUsadas = horas;

            if (isInTimeWindow) {
                horasTotalesTimeWindow += horas;
                serviciosEnVentana++;

                let addsToHours = false;
                if (!s.forceInvalid) {
                    if (isOficina) {
                        if (vol.isJefatura) {
                            addsToHours = true;
                        } else if (!hasCountedOficinaInWindow) {
                            addsToHours = true;
                            hasCountedOficinaInWindow = true;
                        }
                    } else if (s.esValido || s.forceValid) {
                        addsToHours = true;
                    } else if (isEntrevista) {
                        addsToHours = true;
                    }
                }

                if (addsToHours) {
                    horasValidasTimeWindow += horas;
                }

                // Psicosocial and Reten check
                const isPsico = s.forcePsicosocial || isEntrevista || den.includes('romeo') || den.includes('reunion psicosocial') || den.includes('reunión psicosocial');

                if (isPsico) {
                    horasPsicosocial += horas;
                } else if (den.includes('samur') || den.includes('fenix')) {
                    horasRetenPC += horas;
                }
            }
            
            // RCP / AIT detection
            {
                const upperDen = (s.denominacion || '').toUpperCase();
                const isFormacion = upperDen.includes('RECICLAJE') ||
                    upperDen.includes('RECERTIFICACION') || upperDen.includes('RECERTIFICACIÓN') ||
                    upperDen.includes('MODULO') || upperDen.includes('MÓDULO');
                const isRCPcourse = upperDen.includes('RCP') || upperDen.includes('SVB');
                const isAITcourse = upperDen.includes('AIT');

                if (isFormacion && (isRCPcourse || isAITcourse)) {
                    // Track latest course date for display (no time restriction)
                    if (!lastReciclajeDate || s.fecha > lastReciclajeDate) lastReciclajeDate = s.fecha;
                    // Compliance check: only courses within 3 years count
                    if (isAfter(s.fecha, subYears(today, 3))) {
                        if (isRCPcourse) hasRCP = true;
                        if (isAITcourse) hasAIT = true;
                    }
                }
            }
        }
        
        const hasRCPandAITinLast3Years = hasRCP && hasAIT;
        
        const daysSinceLastValid = lastValidServiceDate ? differenceInDays(today, lastValidServiceDate) : Infinity;
        const cumple90Dias = daysSinceLastValid <= 90;
        const cumple80Horas = horasValidasTimeWindow >= 80;
        
        const exentoRCP = antiguedadYears < 3;
        const cumpleRCP = exentoRCP || hasRCPandAITinLast3Years;
        
        // Determine overall status
        let estado = 'APTO';
        if (!cumple90Dias && !cumple80Horas && !cumpleRCP) {
            estado = 'PELIGRO';
        } else if (!cumple90Dias || !cumple80Horas || !cumpleRCP) {
            estado = 'ALERTA';
        }
        
        const hasOverrides = sortedServices.some(s => s.forceValid || s.forceInvalid || s.forcePsicosocial);

        const lastReciclajeStr = lastReciclajeDate
            ? `${String(lastReciclajeDate.getMonth() + 1).padStart(2, '0')}/${lastReciclajeDate.getFullYear()}`
            : null;

        return {
            ...vol,
            sortedServices,
            antiguedadYears,
            lastReciclajeStr,
            horasTotalesTimeWindow,
            horasValidasTimeWindow,
            horasPsicosocial,
            horasRetenPC,
            serviciosEnVentana,
            hasOverrides,
            daysSinceLastValid,
            cumple90Dias,
            cumple80Horas,
            exentoRCP,
            cumpleRCP,
            hasRCPandAITinLast3Years,
            estado
        };
    });

    // Apply global UI filter
    if (estadoFilter && estadoFilter !== 'todo') {
        if (estadoFilter === 'aptos') {
            analyzed = analyzed.filter(v => v.estado === 'APTO');
        } else if (estadoFilter === 'alerta') {
            analyzed = analyzed.filter(v => v.estado === 'ALERTA' || v.estado === 'PELIGRO');
        } else if (estadoFilter === 'rcp') {
            analyzed = analyzed.filter(v => !v.cumpleRCP);
        }
    }

    return analyzed;
}
