// Adicionamos a função ao escopo global para que o onclick do popover funcione
window.advanceTour = (currentStep) => {
    console.error("Função advanceTour principal ainda não foi carregada.");
};

document.addEventListener('DOMContentLoaded', function() {
    // Seções da página
    const searchSection = document.getElementById('search-section');
    const resultsSection = document.getElementById('results-section');
    const resultsCard = document.querySelector('.results-card');
    const mainCard = document.querySelector('.main-card');

    // Elementos do formulário de busca
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('identificadores-input');
    
    // Dicas (Alertas)
    const saveResultsAlert = document.getElementById('save-results-alert');
    const customizeViewAlert = document.getElementById('customize-view-alert');

    // Elementos da área de resultados
    const newSearchBtn = document.getElementById('new-search-btn');
    const tableSelect = document.getElementById('table-select-dropdown');
    const initialSaveButtons = document.getElementById('initial-save-buttons');
    
    // --- LÓGICA DAS DICAS DINÂMICAS (VERSÃO FINAL REESCRITA) ---

    // Dica 1: Ao focar na caixa de texto
    searchInput.addEventListener('focus', function() {
        if (localStorage.getItem('multiSearchTipShown') === 'true') return;
        
        const tipContent = 'Você pode pesquisar vários objetos de uma vez! Basta colar os códigos na caixa de texto, garantindo que cada um fique em uma linha separada.';
        showDynamicPopover(searchInput, 'Busca em Lote', tipContent, {
            placement: 'top',
            timeout: 10000,       // Fecha sozinho em 10s
            showCloseButton: true  // Mostra o 'x'
        });
        localStorage.setItem('multiSearchTipShown', 'true');
    }, { once: true });

    // Gatilho para o "Mini-Tour" ao fechar o alerta principal
    if (saveResultsAlert) {
        saveResultsAlert.addEventListener('close.bs.alert', function () {
            startGuidedTour();
        });
    }
    
    // Orquestrador do Tour Guiado
    function startGuidedTour() {
        if (localStorage.getItem('guidedTourShown') === 'true') {
            unlockContent();
            return;
        }
        localStorage.setItem('guidedTourShown', 'true');
        lockContent([resultsCard, mainCard]); // Bloqueia os cards
        
        showTourStep(1);
    }
    
    function showTourStep(step) {
        clearAllPopoversAndTimers();

        if (step === 1) {
            const tipContent = 'Primeiro, escolha em qual das suas tabelas você quer salvar estes resultados.';
            showDynamicPopover(tableSelect.parentNode, 'Passo 1 de 2', tipContent, {
                tourStep: { current: 1, total: 2 },
                showCloseButton: false // NÃO mostra o 'x'
            });
            const timeoutId = setTimeout(() => advanceTour(1), 10000); // Avança sozinho em 10s
            tourTimeouts.push(timeoutId);
        } else if (step === 2) {
            const tipContent = 'Agora, salve tudo de uma vez ou clique para selecionar linhas específicas.';
            showDynamicPopover(initialSaveButtons, 'Passo 2 de 2', tipContent, {
                tourStep: { current: 2, total: 2 },
                showCloseButton: false // NÃO mostra o 'x'
            });
            const timeoutId = setTimeout(() => finishTour(), 10000); // Finaliza sozinho em 10s
            tourTimeouts.push(timeoutId);
        }
    }

    // Função global para avançar o tour
    window.advanceTour = (currentStep) => {
        clearAllPopoversAndTimers(); // <-- CORREÇÃO: Limpa a dica anterior primeiro
        if (currentStep < 2) {
            showTourStep(currentStep + 1);
        } else {
            finishTour();
        }
    }
    
    function finishTour() {
        clearAllPopoversAndTimers();
        unlockContent();
        console.log("Tour finalizado.");
    }

    // Função de limpeza robusta
    function clearAllPopoversAndTimers() {
        tourTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        tourTimeouts = [];
        // Usa a lista de popovers ativos do main.js para garantir que todos sejam fechados
        activePopovers.forEach(popover => popover.dispose());
        activePopovers = [];
        document.querySelectorAll('.spotlight').forEach(el => el.classList.remove('spotlight'));
    }

    // --- CÓDIGO COMPLETO DAS FUNÇÕES RESTANTES (sem abreviações) ---
    const searchButton = document.getElementById('search-button');
    const loadingOverlay = document.getElementById('loading-overlay');
    const resultsTbody = document.getElementById('results-tbody');
    const resultsThead = document.getElementById('results-thead');
    const saveAllBtn = document.getElementById('save-all-btn');
    const enableSelectModeBtn = document.getElementById('enable-select-mode-btn');
    const cancelSelectModeBtn = document.getElementById('cancel-select-mode-btn');
    const saveSelectedBtn = document.getElementById('save-selected-btn');
    let currentSearchResults = [];

    searchForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const query = searchInput.value.trim();
        if (!query) return;
        showLoading(true, 'Buscando dados...');
        try {
            const response = await fetch('/api/run-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identificadores: query })
            });
            if (!response.ok) throw new Error('A resposta do servidor não foi OK.');
            const results = await response.json();
            if (results && results.length > 0) {
                currentSearchResults = results;
                renderResults(results);
                showSearch(false);
                const alertsToShow = [];
                if (saveResultsAlert && localStorage.getItem('alert-dismissed-save-results-alert') !== 'true') {
                    saveResultsAlert.style.display = 'flex';
                    alertsToShow.push(saveResultsAlert);
                }
                if (customizeViewAlert && localStorage.getItem('alert-dismissed-customize-view-alert') !== 'true') {
                    customizeViewAlert.style.display = 'flex';
                    alertsToShow.push(customizeViewAlert);
                }
                if (alertsToShow.length > 0) {
                    lockContent([resultsCard]);
                }
            } else {
                alert('Nenhum dado válido foi encontrado.');
            }
        } catch (error) {
            console.error('Erro ao buscar dados:', error);
            alert('Ocorreu um erro ao comunicar com o servidor.');
        } finally {
            showLoading(false);
        }
    });

    function renderResults(results) {
        document.getElementById('results-count').textContent = `${results.length} encontrado(s)`;
        tableSelect.innerHTML = '';
        Object.keys(appState.saved_tables).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            tableSelect.appendChild(option);
        });
        const headers = appState.column_order.filter(col => col in results[0]);
        resultsThead.innerHTML = `<tr><th class="selection-col d-none"><i class="fas fa-check"></i></th>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
        resultsTbody.innerHTML = '';
        results.forEach(row => {
            const tr = document.createElement('tr');
            tr.dataset.objectName = row['Objeto'];
            let rowHTML = `<td class="selection-col d-none"><input class="form-check-input row-checkbox" type="checkbox"></td>`;
            headers.forEach(header => { rowHTML += `<td>${row[header] || '-'}</td>`; });
            tr.innerHTML = rowHTML;
            resultsTbody.appendChild(tr);
        });
    }

    function showSearch(show = true) {
        if (show) {
            searchSection.classList.remove('d-none');
            resultsSection.classList.add('d-none');
            if(saveResultsAlert) saveResultsAlert.style.display = 'none';
            if(customizeViewAlert) customizeViewAlert.style.display = 'none';
            unlockContent();
            searchInput.value = '';
        } else {
            searchSection.classList.add('d-none');
            resultsSection.classList.remove('d-none');
        }
    }
    newSearchBtn.addEventListener('click', () => showSearch(true));
    
    function showLoading(show, message = '') {
        if (show) {
            loadingOverlay.style.display = 'flex';
            document.getElementById('progress-title').textContent = message;
            searchButton.disabled = true;
            searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando...';
        } else {
            loadingOverlay.style.display = 'none';
            searchButton.disabled = false;
            searchButton.innerHTML = '<i class="fas fa-search me-2"></i> Buscar';
        }
    }

    saveAllBtn.addEventListener('click', function() {
        addRowsToTable(tableSelect.value, currentSearchResults);
        alert(`${currentSearchResults.length} resultado(s) salvo(s) com sucesso em '${tableSelect.value}'.`);
    });

    saveSelectedBtn.addEventListener('click', function() {
        const selectedRows = getSelectedRows();
        addRowsToTable(tableSelect.value, selectedRows);
        alert(`${selectedRows.length} resultado(s) salvo(s) com sucesso em '${tableSelect.value}'.`);
        exitSelectMode();
    });

    function addRowsToTable(tableName, rowsToAdd) {
        if (!appState.saved_tables[tableName]) return;
        const existingObjects = new Set(appState.saved_tables[tableName].map(r => r.Objeto));
        rowsToAdd.forEach(newRow => {
            if (!existingObjects.has(newRow.Objeto)) {
                appState.saved_tables[tableName].push(newRow);
            }
        });
        saveStateToLocalStorage();
    }

    enableSelectModeBtn.addEventListener('click', enterSelectMode);
    cancelSelectModeBtn.addEventListener('click', exitSelectMode);
    
    resultsTbody.addEventListener('click', (e) => {
        if (resultsTbody.classList.contains('selection-mode')) {
            const row = e.target.closest('tr');
            if (!row) return;
            const checkbox = row.querySelector('.row-checkbox');
            if (e.target.tagName !== 'INPUT') checkbox.checked = !checkbox.checked;
            updateSelectionState();
        }
    });

    function enterSelectMode() {
        initialSaveButtons.classList.add('d-none');
        document.getElementById('selection-controls').classList.remove('d-none');
        document.getElementById('selection-instruction').classList.remove('d-none');
        resultsTbody.classList.add('selection-mode');
        document.querySelectorAll('.selection-col').forEach(c => c.classList.remove('d-none'));
    }

    function exitSelectMode() {
        initialSaveButtons.classList.remove('d-none');
        document.getElementById('selection-controls').classList.add('d-none');
        document.getElementById('selection-instruction').classList.add('d-none');
        resultsTbody.classList.remove('selection-mode');
        document.querySelectorAll('.selection-col').forEach(c => c.classList.add('d-none'));
        document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = false);
        document.getElementById('save-selected-btn').disabled = true;
    }

    function updateSelectionState() {
        const selectedCount = getSelectedRows().length;
        document.getElementById('save-selected-btn').disabled = selectedCount === 0;
    }

    function getSelectedRows() {
        const selectedObjects = new Set();
        document.querySelectorAll('.row-checkbox:checked').forEach(cb => {
            selectedObjects.add(cb.closest('tr').dataset.objectName);
        });
        return currentSearchResults.filter(row => selectedObjects.has(row.Objeto));
    }
});