// CONSTANTES GLOBAIS DA APLICAÇÃO (REORGANIZADAS)
const ALL_COLUMNS = [
    // 1. Entrada do Usuário
    'Objeto',
    // 2. Campos Calculados
    'Status do objeto',
    '(*?)',
    // 3. API JPL (NASA)
    'Nome Completo',
    // 4. API WAMO (MPC)
    'Designação IAU',
    'String da Observação',
    'Linhas de Observação WAMO',
    'Status de Consulta',
    // 5. Web Scraping (MPC)
    'Descrição',
    'Tipo de Órbita',
    'Magnitude Absoluta',
    'Incerteza',
    'Referência',
    'Observações Utilizadas',
    'Oposições',
    'Comprimento do Arco (dias)',
    'Primeira Oposição Usada',
    'Última Oposição Usada',
    'Primeira Data de Obs. Usada',
    'Última Data de Obs. Usada',
];

const DEFAULT_COLUMNS = [
    // 1. Entrada do Usuário
    'Objeto',
    // 2. Campos Calculados
    'Status do objeto',
    '(*?)',
    // 3. API JPL (NASA)
    'Nome Completo',
    // 4. API WAMO (MPC)
    'Designação IAU',
    // 5. Web Scraping (MPC)
    'Tipo de Órbita',
    'Descrição',
    
    
];


let appState = {};
let tourTimeouts = [];
let activePopovers = [];

function saveStateToLocalStorage() {
    localStorage.setItem('asteroidHubState', JSON.stringify(appState));
    console.log("Estado salvo no Local Storage:", appState);
}

function loadStateFromLocalStorage() {
    const savedState = localStorage.getItem('asteroidHubState');
    if (savedState) {
        appState = JSON.parse(savedState);
    } else {
        appState = {
            saved_tables: { 'Tabela Padrão': [] },
            active_table: 'Tabela Padrão',
            visible_columns: [...DEFAULT_COLUMNS],
            column_order: [...DEFAULT_COLUMNS]
        };
        saveStateToLocalStorage();
    }
}

loadStateFromLocalStorage();

// --- O RESTO DO FICHEIRO CONTINUA EXATAMENTE IGUAL ---
function lockContent(exceptions = []) {
    document.querySelectorAll('.main-card, .results-card').forEach(el => {
        if (!exceptions.includes(el)) {
            el.classList.add('content-locked');
        }
    });
    exceptions.forEach(el => {
        if(el) el.classList.add('in-focus');
    });
}
function unlockContent() {
    document.querySelectorAll('.content-locked').forEach(el => el.classList.remove('content-locked'));
    document.querySelectorAll('.in-focus').forEach(el => el.classList.remove('in-focus'));
}
function getPopoverTitleWithCloseButton(originalTitle) {
    return `
        <div class="d-flex justify-content-between align-items-center">
            <span>${originalTitle}</span>
            <button type="button" class="btn-close popover-close-btn" aria-label="Close"></button>
        </div>
    `;
}
function showDynamicPopover(element, title, content, options = {}) {
    if (!element) return;
    const oldInstance = bootstrap.Popover.getInstance(element);
    if(oldInstance) oldInstance.dispose();
    const config = {
        timeout: options.timeout || null,
        placement: options.placement || 'bottom',
        tourStep: options.tourStep || null,
        showCloseButton: options.showCloseButton !== false
    };
    let finalContent = content;
    if (config.tourStep) {
        const buttonText = config.tourStep.current < config.tourStep.total ? "Próximo Passo &raquo;" : "Finalizar Tour";
        finalContent += `<div class="d-flex justify-content-end mt-2 pt-2 border-top border-secondary">
                                <button class="btn btn-sm btn-outline-light popover-skip-button" onclick="advanceTour(${config.tourStep.current})">
                                    ${buttonText}
                                </button>
                             </div>`;
    }
    const popover = new bootstrap.Popover(element, {
        title: config.showCloseButton ? getPopoverTitleWithCloseButton(title) : title,
        content: finalContent,
        trigger: 'manual',
        html: true,
        sanitize: false,
        placement: config.placement,
        animation: true,
        customClass: 'popover-tip'
    });
    element.classList.add('spotlight');
    popover.show();
    activePopovers.push(popover);
    if (config.timeout) {
        const timeoutId = setTimeout(() => {
            popover.hide();
            element.classList.remove('spotlight');
        }, config.timeout);
        tourTimeouts.push(timeoutId);
    }
}
document.addEventListener('DOMContentLoaded', function () {
    const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
    popoverTriggerList.forEach(popoverTriggerEl => {
        popoverTriggerEl.addEventListener('show.bs.popover', () => {
            const popoverInstance = bootstrap.Popover.getInstance(popoverTriggerEl);
            if (popoverInstance) {
                const originalTitle = popoverTriggerEl.getAttribute('data-bs-title') || popoverTriggerEl.getAttribute('title');
                popoverInstance.setContent({
                    '.popover-header': getPopoverTitleWithCloseButton(originalTitle)
                });
            }
        });
    });
    document.body.addEventListener('click', function(event) {
        if (event.target.classList.contains('popover-close-btn')) {
            const popoverEl = event.target.closest('.popover');
            if (popoverEl) {
                const triggerEl = document.querySelector(`[aria-describedby="${popoverEl.id}"]`);
                if (triggerEl) {
                    const popoverInstance = bootstrap.Popover.getInstance(triggerEl);
                    if (popoverInstance) popoverInstance.hide();
                }
            }
        }
    });
    const dismissibleAlerts = document.querySelectorAll('.alert-dismissible');
    const visibleAlerts = [];
    dismissibleAlerts.forEach(alert => {
        if (!alert.id) return;
        if (localStorage.getItem(`alert-dismissed-${alert.id}`) === 'true') {
            alert.style.display = 'none';
        } else if (alert.offsetParent !== null) {
            visibleAlerts.push(alert);
        }
        alert.addEventListener('close.bs.alert', function () {
            localStorage.setItem(`alert-dismissed-${alert.id}`, 'true');
            unlockContent();
        });
    });
    if (visibleAlerts.length > 0) {
        lockContent(visibleAlerts);
    }
});