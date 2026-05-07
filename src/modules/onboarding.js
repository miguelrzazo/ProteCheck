const STORAGE_KEY = 'protecheck-onboarding-done';

const STEPS = [
    {
        title: '// bienvenido a ProteCheck',
        body: `<p>ProteCheck analiza los informes <strong>.xls</strong> exportados desde Apúntate y calcula el estado de cumplimiento de cada voluntario.</p>
               <p><strong>Privacidad garantizada:</strong> Todo el análisis se realiza <strong>100% de forma local</strong> en tu navegador. Ningún archivo ni dato se sube a internet.</p>
               <p>Haz clic en <strong>📁 Seleccionar Carpeta</strong> y elige la carpeta que contiene los archivos. También puedes arrastrar un archivo <code>.xls</code> directamente sobre la ventana.</p>`,
        btn: 'Siguiente →'
    },
    {
        title: '// estados de cumplimiento',
        body: `<p>Cada voluntario recibe uno de estos estados según tres condiciones:</p>
               <ul>
                   <li><span class="badge valid">APTO</span> &mdash; Cumple las tres condiciones.</li>
                   <li><span class="badge alerta">ALERTA</span> &mdash; Falla una o dos condiciones.</li>
                   <li><span class="badge peligro">PELIGRO</span> &mdash; Falla las tres condiciones.</li>
               </ul>
               <p>Las condiciones son: <strong>≥ 80 h PC</strong> en el período seleccionado, <strong>≤ 90 días</strong> sin servicio válido, y <strong>RCP + AIT</strong> vigentes (últimos 3 años).</p>`,
        btn: 'Siguiente →'
    },
    {
        title: '// filtros y exportación',
        body: `<p>Usa los filtros <strong>ESTADO</strong>, <strong>HORAS</strong> y <strong>PERIODO</strong> para acotar la vista según tus necesidades.</p>
               <p>Haz clic en cualquier fila para ver el detalle del voluntario, ajustar servicios manualmente y activar el modo Jefatura.</p>
               <p>Exporta el informe con los botones <strong>XLSX</strong>, <strong>CSV</strong> o <strong>PDF</strong>. Abre el <strong>Manual</strong> desde el menú superior si tienes dudas.</p>`,
        btn: 'Empezar ✓'
    }
];

let currentStep = 0;

function render() {
    const step = STEPS[currentStep];
    document.getElementById('onboarding-title').textContent = step.title;
    document.getElementById('onboarding-body').innerHTML = step.body;
    document.getElementById('onboarding-btn').textContent = step.btn;
    document.getElementById('onboarding-counter').textContent = `${currentStep + 1} / ${STEPS.length}`;
    const dots = document.querySelectorAll('.onboarding-dot');
    dots.forEach((d, i) => d.classList.toggle('active', i === currentStep));
}

function closeOnboarding() {
    localStorage.setItem(STORAGE_KEY, '1');
    document.getElementById('onboarding-modal').classList.add('hidden');
}

export function initOnboarding() {
    if (localStorage.getItem(STORAGE_KEY)) return;
    currentStep = 0;
    render();
    document.getElementById('onboarding-modal').classList.remove('hidden');

    document.getElementById('onboarding-btn').addEventListener('click', () => {
        if (currentStep < STEPS.length - 1) {
            currentStep++;
            render();
        } else {
            closeOnboarding();
        }
    });

    document.getElementById('onboarding-skip').addEventListener('click', closeOnboarding);
}
