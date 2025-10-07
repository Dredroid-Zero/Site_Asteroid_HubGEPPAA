// CONSTANTES GLOBAIS DA APLICAÇÃO
const ALL_COLUMNS = [ 'Objeto', 'Status do objeto', '(*?)', 'Nome Completo', 'Designação IAU', 'String da Observação', 'Linhas de Observação WAMO', 'Status de Consulta', 'Descrição', 'Tipo de Órbita', 'Magnitude Absoluta', 'Incerteza', 'Referência', 'Observações Utilizadas', 'Oposições', 'Comprimento do Arco (dias)', 'Primeira Oposição Usada', 'Última Oposição Usada', 'Primeira Data de Obs. Usada', 'Última Data de Obs. Usada'];
const DEFAULT_COLUMNS = ['Objeto', 'Status do objeto', '(*?)', 'Nome Completo', 'Designação IAU', 'Tipo de Órbita', 'Descrição'];

let appState = {};
let activePopovers = [];

// SISTEMA DE REGISTO DE INICIALIZADORES
window.pageInitializers = [];

function saveStateToLocalStorage() {
    localStorage.setItem('asteroidHubState', JSON.stringify(appState));
}

function loadStateFromLocalStorage() {
    const savedState = localStorage.getItem('asteroidHubState');
    const defaultState = {
        saved_tables: { 'Tabela Padrão': [] },
        active_table: 'Tabela Padrão',
        column_order: [...DEFAULT_COLUMNS]
    };

    if (savedState) {
        let loadedState = JSON.parse(savedState);
        appState = { ...defaultState, ...loadedState };
    } else {
        appState = defaultState;
    }
    saveStateToLocalStorage();
}

loadStateFromLocalStorage();

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
    document.querySelectorAll('.spotlight').forEach(el => el.classList.remove('spotlight'));
}

function getPopoverTitleWithCloseButton(originalTitle) {
    return `
        <div class="d-flex justify-content-between align-items-center">
            <span>${originalTitle}</span>
            <button type="button" class="btn-close popover-close-btn"></button>
        </div>
    `;
}

function showDynamicPopover(element, title, content, options = {}) {
    if (!element) return;
    
    const oldInstance = bootstrap.Popover.getInstance(element);
    if(oldInstance) oldInstance.dispose();
    
    const config = {
        placement: options.placement || 'bottom',
        tourStep: options.tourStep || null,
        showCloseButton: options.showCloseButton !== false
    };

    let footerHTML = '';
    if (config.tourStep) {
        const isFinal = config.tourStep.current === config.tourStep.total;
        const buttonText = isFinal ? "Finalizar Tour" : "Próximo Passo &raquo;";
        const action = "advance";
        const step = config.tourStep.current;
        footerHTML = `
            <div class="d-flex justify-content-end mt-2 pt-2 border-top border-secondary">
                <button class="btn btn-sm btn-outline-light" 
                        data-tour-action="${action}" 
                        data-tour-step="${step}">
                    ${buttonText}
                </button>
            </div>`;
    }

    const finalContent = content + footerHTML;

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
}

document.addEventListener('DOMContentLoaded', function () {
    // OUVINTE GLOBAL PARA OS BOTÕES DO TOUR
    document.body.addEventListener('click', function(event) {
        const tourButton = event.target.closest('[data-tour-action]');
        if (tourButton) {
            const action = tourButton.dataset.tourAction;
            const step = tourButton.dataset.tourStep;
            if (action === 'advance' && window.currentTour && typeof window.currentTour.advance === 'function') {
                window.currentTour.advance(parseInt(step, 10));
            }
        }

        // OUVINTE PARA FECHAR POPOVERS NORMAIS
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

    // LÓGICA CENTRALIZADA PARA AS DICAS (ALERTS)
    const dismissibleAlerts = document.querySelectorAll('.alert-dismissible');
    dismissibleAlerts.forEach(alert => {
        if (!alert.id) return;
        
        if (localStorage.getItem(`alert-dismissed-${alert.id}`) === 'true') {
             alert.style.display = 'none';
        }

        alert.addEventListener('close.bs.alert', function (event) {
            localStorage.setItem(`alert-dismissed-${event.target.id}`, 'true');
            unlockContent();

            if (event.target.id === 'save-results-alert') {
                document.dispatchEvent(new CustomEvent('tour:start-save-results'));
            } else if (event.target.id === 'manage-tables-tip-alert') {
                document.dispatchEvent(new CustomEvent('tour:start-manage-tables'));
            }
        });
    });

    // EXECUTA TODOS OS SCRIPTS DE PÁGINA REGISTADOS
    window.pageInitializers.forEach(initFunc => {
        try {
            initFunc();
        } catch (e) {
            console.error("Erro ao executar o inicializador de página:", e);
        }
    });
});