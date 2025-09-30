// Adicionamos a função ao escopo global para que o onclick do popover funcione
window.advanceTour = (currentStep) => {
    console.error("Função advanceTour principal ainda não foi carregada.");
};

document.addEventListener('DOMContentLoaded', function() {
    // --- SELETORES DE ELEMENTOS ---
    const searchSection = document.getElementById('search-section');
    const resultsSection = document.getElementById('results-section');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('identificadores-input');
    const searchButton = document.getElementById('search-button');
    const loadingOverlay = document.getElementById('loading-overlay');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const progressAsteroid = document.getElementById('progress-asteroid');
    const progressTitle = document.getElementById('progress-title');
    const resultsCard = document.querySelector('.results-card');
    const mainCard = document.querySelector('.main-card');
    const saveResultsAlert = document.getElementById('save-results-alert');
    const customizeViewAlert = document.getElementById('customize-view-alert');
    const newSearchBtn = document.getElementById('new-search-btn');
    const tableSelect = document.getElementById('table-select-dropdown');
    const initialSaveButtons = document.getElementById('initial-save-buttons');
    const resultsTbody = document.getElementById('results-tbody');
    const resultsThead = document.getElementById('results-thead');
    const saveAllBtn = document.getElementById('save-all-btn');
    const enableSelectModeBtn = document.getElementById('enable-select-mode-btn');
    const cancelSelectModeBtn = document.getElementById('cancel-select-mode-btn');
    const saveSelectedBtn = document.getElementById('save-selected-btn');
    
    let currentSearchResults = [];

    // --- LÓGICA DE BUSCA COM PROGRESSO EM LOTES ---
    searchForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const allIdentifiers = searchInput.value.trim().split('\n').filter(line => line.trim() !== '');
        if (allIdentifiers.length === 0) return;

        const CHUNK_SIZE = 25;
        const chunks = [];
        for (let i = 0; i < allIdentifiers.length; i += CHUNK_SIZE) {
            chunks.push(allIdentifiers.slice(i, i + CHUNK_SIZE));
        }

        let totalResults = [];
        showLoading(true);
        resetProgressBar();

        try {
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const chunkNumber = i + 1;
                
                updateProgressText(`Analisando lote ${chunkNumber} de ${chunks.length}...`);
                
                const response = await fetch('/api/run-search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identificadores: chunk.join('\n') })
                });

                if (!response.ok) throw new Error(`Erro no lote ${chunkNumber}: ${response.statusText}`);

                const chunkResults = await response.json();
                if (chunkResults.length > 0) totalResults.push(...chunkResults);
                
                const progress = (chunkNumber / chunks.length) * 100;
                updateProgressBar(progress);
                
                await new Promise(resolve => setTimeout(resolve, 500)); 
            }

            updateProgressText('Finalizando...');
            await new Promise(resolve => setTimeout(resolve, 600));

            if (totalResults.length > 0) {
                renderResultsAndShowUI(totalResults);
            } else {
                alert('Nenhum resultado encontrado para os identificadores fornecidos.');
            }

        } catch (error) {
            console.error('Erro durante a busca em lotes:', error);
            alert('Ocorreu um erro durante a busca. Por favor, tente novamente.');
        } finally {
            showLoading(false);
        }
    });

    // --- FUNÇÕES DE CONTROLO DA BARRA DE PROGRESSO E UI ---
    function showLoading(show) {
        if (show) {
            document.body.classList.add('loading-active');
            searchButton.disabled = true;
        } else {
            document.body.classList.remove('loading-active');
            searchButton.disabled = false;
        }
    }

    function resetProgressBar() {
        if (!progressTitle || !progressBarFill || !progressAsteroid) return;
        progressTitle.textContent = 'Preparando a busca...';
        progressBarFill.style.width = '0%';
        progressAsteroid.style.left = '0%';
        progressBarFill.setAttribute('aria-valuenow', 0);
    }

    function updateProgressText(text) {
        if(progressTitle) progressTitle.textContent = text;
    }

    function updateProgressBar(percentage) {
        if(progressBarFill && progressAsteroid) {
            progressBarFill.style.width = `${percentage}%`;
            progressAsteroid.style.left = `${percentage}%`;
            progressBarFill.setAttribute('aria-valuenow', percentage);
        }
    }

    function renderResultsAndShowUI(results) {
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
    }

    function renderResults(results) {
        document.getElementById('results-count').textContent = `${results.length} encontrado(s)`;
        tableSelect.innerHTML = '';
        Object.keys(appState.saved_tables).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            tableSelect.appendChild(option);
        });
        const headers = results.length > 0 ? appState.column_order.filter(col => col in results[0]) : [];
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
    
    // --- LÓGICA DAS DICAS DINÂMICAS E TOUR ---
    searchInput.addEventListener('focus', function() {
        if (localStorage.getItem('multiSearchTipShown') === 'true') return;
        const tipContent = 'Você pode pesquisar vários objetos de uma vez! Basta colar os códigos na caixa de texto, garantindo que cada um fique em uma linha separada.';
        showDynamicPopover(searchInput, 'Busca em Lote', tipContent, {
            placement: 'top',
            timeout: 10000,
            showCloseButton: true
        });
        localStorage.setItem('multiSearchTipShown', 'true');
    }, { once: true });

    if (saveResultsAlert) {
        saveResultsAlert.addEventListener('close.bs.alert', function () {
            startGuidedTour();
        });
    }
    
    function startGuidedTour() {
        if (localStorage.getItem('guidedTourShown') === 'true') {
            unlockContent();
            return;
        }
        localStorage.setItem('guidedTourShown', 'true');
        lockContent([resultsCard, mainCard]);
        showTourStep(1);
    }
    
    function showTourStep(step) {
        clearAllPopoversAndTimers();
        if (step === 1) {
            const tipContent = 'Primeiro, escolha em qual das suas tabelas você quer salvar estes resultados.';
            showDynamicPopover(tableSelect.parentNode, 'Passo 1 de 2', tipContent, {
                tourStep: { current: 1, total: 2 },
                showCloseButton: false
            });
            const timeoutId = setTimeout(() => advanceTour(1), 10000);
            tourTimeouts.push(timeoutId);
        } else if (step === 2) {
            const tipContent = 'Agora, salve tudo de uma vez ou clique para selecionar linhas específicas.';
            showDynamicPopover(initialSaveButtons, 'Passo 2 de 2', tipContent, {
                tourStep: { current: 2, total: 2 },
                showCloseButton: false
            });
            const timeoutId = setTimeout(() => finishTour(), 10000);
            tourTimeouts.push(timeoutId);
        }
    }

    window.advanceTour = (currentStep) => {
        clearAllPopoversAndTimers();
        if (currentStep < 2) {
            showTourStep(currentStep + 1);
        } else {
            finishTour();
        }
    }
    
    function finishTour() {
        clearAllPopoversAndTimers();
        unlockContent();
    }

    function clearAllPopoversAndTimers() {
        tourTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        tourTimeouts = [];
        activePopovers.forEach(popover => popover.dispose());
        activePopovers = [];
        document.querySelectorAll('.spotlight').forEach(el => el.classList.remove('spotlight'));
    }

    // --- LÓGICA DE SALVAR E MODO DE SELEÇÃO ---
    saveAllBtn.addEventListener('click', function() { addRowsToTable(tableSelect.value, currentSearchResults); alert(`${currentSearchResults.length} resultado(s) salvo(s) com sucesso em '${tableSelect.value}'.`); });
    saveSelectedBtn.addEventListener('click', function() { const selectedRows = getSelectedRows(); addRowsToTable(tableSelect.value, selectedRows); alert(`${selectedRows.length} resultado(s) salvo(s) com sucesso em '${tableSelect.value}'.`); exitSelectMode(); });
    function addRowsToTable(tableName, rowsToAdd) { if (!appState.saved_tables[tableName]) return; const existingObjects = new Set(appState.saved_tables[tableName].map(r => r.Objeto)); rowsToAdd.forEach(newRow => { if (!existingObjects.has(newRow.Objeto)) { appState.saved_tables[tableName].push(newRow); } }); saveStateToLocalStorage(); }
    enableSelectModeBtn.addEventListener('click', enterSelectMode);
    cancelSelectModeBtn.addEventListener('click', exitSelectMode);
    resultsTbody.addEventListener('click', (e) => { if (resultsTbody.classList.contains('selection-mode')) { const row = e.target.closest('tr'); if (!row) return; const checkbox = row.querySelector('.row-checkbox'); if (e.target.tagName !== 'INPUT') checkbox.checked = !checkbox.checked; updateSelectionState(); } });
    function enterSelectMode() { initialSaveButtons.classList.add('d-none'); document.getElementById('selection-controls').classList.remove('d-none'); document.getElementById('selection-instruction').classList.remove('d-none'); resultsTbody.classList.add('selection-mode'); document.querySelectorAll('.selection-col').forEach(c => c.classList.remove('d-none')); }
    function exitSelectMode() { initialSaveButtons.classList.remove('d-none'); document.getElementById('selection-controls').classList.add('d-none'); document.getElementById('selection-instruction').classList.add('d-none'); resultsTbody.classList.remove('selection-mode'); document.querySelectorAll('.selection-col').forEach(c => c.classList.add('d-none')); document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = false); document.getElementById('save-selected-btn').disabled = true; }
    function updateSelectionState() { const selectedCount = getSelectedRows().length; document.getElementById('save-selected-btn').disabled = selectedCount === 0; }
    function getSelectedRows() { const selectedObjects = new Set(); document.querySelectorAll('.row-checkbox:checked').forEach(cb => { selectedObjects.add(cb.closest('tr').dataset.objectName); }); return currentSearchResults.filter(row => selectedObjects.has(row.Objeto)); }
});