function initializeSearchPage() {
    // ----- FUNÇÕES DE GESTÃO DO ESTADO DO GLOSSÁRIO -----
    function getGlossaryState() {
        const state = localStorage.getItem('glossaryHelpState');
        return state ? JSON.parse(state) : {};
    }

    function saveGlossaryState(state) {
        localStorage.setItem('glossaryHelpState', JSON.stringify(state));
    }

    // ----- FUNÇÃO GLOBAL PARA GERIR CONTAGEM DE 1 CLIQUE -----
    window.closeAndHidePopover = function(closeButton) {
        const popoverEl = closeButton.closest('.popover');
        if (!popoverEl) return;
        const triggerEl = document.querySelector(`[aria-describedby="${popoverEl.id}"]`);
        if (!triggerEl) return;

        const columnName = triggerEl.getAttribute('data-bs-title');

        const popoverInstance = bootstrap.Popover.getInstance(triggerEl);
        if (popoverInstance) {
            popoverInstance.hide();
        }

        const glossaryState = getGlossaryState();
        glossaryState[columnName] = (glossaryState[columnName] || 0) + 1;
        saveGlossaryState(glossaryState);

        if (glossaryState[columnName] >= 1) {
            triggerEl.style.visibility = 'hidden';
        }
    }

    // --- DICIONÁRIO DE DADOS PARA O GLOSSÁRIO ---
    const GLOSSARY_DATA = {
        'Objeto': { summary: 'O código de identificação preliminar que você usou na busca.', link: '/faq#headingObjeto' },
        'Status do objeto': { summary: 'Indica se o objeto é “Numerado”, “Provisório” e se foi detectado de forma fraca (Faint Detection).', link: '/faq#headingStatus' },
        '(*?)': { summary: 'Marca a observação específica que levou o MPC a gerar uma nova designação.', link: '/faq#headingAsterisco' },
        'Designação IAU': { summary: 'A “matrícula” provisória ou permanente do objeto atribuída pela IAU.', link: '/faq#headingDesignacaoIAU' },
        'Tipo de Órbita': { summary: 'A “vizinhança” no Sistema Solar em que o objeto orbita.', link: '/faq#headingTipoOrbita' },
        'Nome Completo': { summary: 'O “nome de batismo” oficial do objeto, se ele tiver um.', link: '/faq#headingNomeCompleto' },
        'Descrição': { summary: 'O “certificado de nascimento” do objeto, com detalhes da sua descoberta.', link: '/faq#headingDescricao' },
        'Incerteza': { summary: 'A “nota de confiança” da órbita, numa escala de 0 (muito confiável) a 9 (muito incerta).', link: '/faq#headingIncerteza' },
        'String da Observação': { summary: 'Um “telegrama técnico” da primeira observação encontrada, com todos os dados essenciais.', link: '/faq#headingStringObservacao' },
        'Linhas de Observação WAMO': { summary: 'O número total de “fotografias” (observações) conhecidas deste objeto.', link: '/faq#headingLinhasWAMO' },
        'Status de Consulta': { summary: 'Mostra se os dados exibidos já foram oficialmente publicados pelo MPC.', link: '/faq#headingStatusConsulta' },
        'Magnitude Absoluta': { summary: 'Uma medida do brilho e do tamanho do asteroide. Números menores indicam objetos maiores.', link: '/faq#headingMagAbsoluta' },
        'Referência': { summary: 'O código do “documento oficial” (publicação do MPC) onde a órbita foi anunciada.', link: '/faq#headingReferencia' },
        'Observações Utilizadas': { summary: 'O número de observações realmente usadas para calcular a órbita.', link: '/faq#headingObsUtilizadas' },
        'Oposições': { summary: 'O número de vezes que o asteroide foi observado durante suas “passagens ideais” anuais.', link: '/faq#headingOposicoes' },
        'Comprimento do Arco (dias)': { summary: 'O tempo, em dias, entre a primeira e a última observação usadas no cálculo da órbita.', link: '/faq#headingComprimentoArco' },
        'Primeira Oposição Usada': { summary: 'Os anos da primeira e da última oposição usadas neste cálculo.', link: '/faq#headingPrimeiraOposicao' },
        'Última Oposição Usada': { summary: 'Os anos da primeira e da última oposição usadas neste cálculo.', link: '/faq#headingUltimaOposicao' },
        'Primeira Data de Obs. Usada': { summary: 'As datas exatas da primeira e da última observação usadas no cálculo da órbita.', link: '/faq#headingPrimeiraData' },
        'Última Data de Obs. Usada': { summary: 'As datas exatas da primeira e da última observação usadas no cálculo da órbita.', link: '/faq#headingUltimaData' }
    };

    // --- SELETORES DE ELEMENTOS ---
    const searchSection = document.getElementById('search-section');
    const resultsSection = document.getElementById('results-section');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('identificadores-input');
    const searchButton = document.getElementById('search-button');
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
    let isTourActive = false;

    // --- LÓGICA DE BUSCA ---
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

    // --- FUNÇÕES DE UI ---
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
        
        const glossaryState = getGlossaryState(); 
        const headers = appState.column_order;
        
        const headerHtml = headers.map(header => {
            if (glossaryState[header] >= 1) { return `<th>${header}</th>`; }
            const glossaryEntry = GLOSSARY_DATA[header];
            if (glossaryEntry) {
                const popoverContent = `
                    <div class="glossary-popover">
                        <div class="d-flex justify-content-between align-items-start">
                            <p class="me-2 mb-0">${glossaryEntry.summary}</p>
                            <button type="button" class="btn-close btn-close-white flex-shrink-0" onclick="window.closeAndHidePopover(this)"></button>
                        </div>
                        <a href="${glossaryEntry.link}" target="_blank" class="btn btn-sm btn-outline-light mt-2 d-block">Saiba Mais</a>
                    </div>
                `;
                return `<th>${header}<button type="button" class="btn btn-link btn-sm p-0 ms-1 help-icon" 
                                data-bs-toggle="popover" data-bs-trigger="focus"
                                tabindex="0" data-bs-html="true" data-bs-title="${header}"
                                data-bs-content='${popoverContent.replace(/'/g, "&apos;")}'>
                            <i class="far fa-question-circle"></i></button></th>`;
            }
            return `<th>${header}</th>`;
        }).join('');

        resultsThead.innerHTML = `<tr><th class="selection-col d-none"><i class="fas fa-check"></i></th><th>N°</th>${headerHtml}</tr>`;
        
        resultsTbody.innerHTML = '';
        results.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.dataset.objectName = row['Objeto'];
            let rowHTML = `<td class="selection-col d-none"><input class="form-check-input row-checkbox" type="checkbox"></td><td>${index + 1}</td>`;
            headers.forEach(header => {
                let cellValue = row[header];
                if (cellValue === 'hidden') { cellValue = '-'; }
                if (header === '(*?)' && row['Status do objeto'] === 'Preliminar') { cellValue = '-'; }
                rowHTML += `<td>${cellValue || '-'}</td>`;
            });
            tr.innerHTML = rowHTML;
            resultsTbody.appendChild(tr);
        });

        initializeGlossaryPopovers();
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
    
    function initializeGlossaryPopovers() {
        const popoverTriggerList = [].slice.call(resultsThead.querySelectorAll('[data-bs-toggle="popover"]'));
        popoverTriggerList.map(function (popoverTriggerEl) {
          return new bootstrap.Popover(popoverTriggerEl, { html: true, sanitize: false });
        });
    }

    window.currentTour = {
        advance: (step) => {
            if (step < 2) {
                showTourStep(step + 1);
            } else {
                window.currentTour.finish();
            }
        },
        finish: () => {
            if (!isTourActive) return;
            isTourActive = false;
            clearAllPopovers();
            unlockContent();
            initializeGlossaryPopovers();
        }
    };

    function startGuidedTour() {
        if (localStorage.getItem('guidedTourShown') === 'true' || isTourActive) {
            unlockContent();
            return;
        }
        isTourActive = true;
        localStorage.setItem('guidedTourShown', 'true');
        lockContent([resultsCard, mainCard]);
        showTourStep(1);
    }
    
    function showTourStep(step) {
        clearAllPopovers();
        if (step === 1) {
            const tipContent = 'Primeiro, escolha em qual das suas tabelas você quer salvar estes resultados.';
            showDynamicPopover(tableSelect.parentNode, 'Passo 1 de 2', tipContent, {
                tourStep: { current: 1, total: 2 },
                showCloseButton: false
            });
        } else if (step === 2) {
            const tipContent = 'Agora, salve tudo de uma vez ou clique para selecionar linhas específicas.';
            showDynamicPopover(initialSaveButtons, 'Passo 2 de 2', tipContent, {
                tourStep: { current: 2, total: 2 },
                showCloseButton: false
            });
        }
    }
    
    function clearAllPopovers() {
        document.querySelectorAll('[data-bs-toggle="popover"]').forEach(el => {
            const instance = bootstrap.Popover.getInstance(el);
            if (instance) {
                instance.dispose();
            }
        });
        document.querySelectorAll('.popover').forEach(popover => popover.remove());
    }

    // Ouve o "sinal" do main.js para iniciar o tour
    document.addEventListener('tour:start-save-results', startGuidedTour);

    searchInput.addEventListener('focus', function() {
        if (localStorage.getItem('multiSearchTipShown') === 'true') return;
        const tipContent = 'Você pode pesquisar vários objetos de uma vez! Basta colar os códigos na caixa de texto, garantindo que cada um fique em uma linha separada.';
        showDynamicPopover(searchInput, 'Busca em Lote', tipContent, {
            placement: 'top',
            showCloseButton: true
        });
        localStorage.setItem('multiSearchTipShown', 'true');
    }, { once: true });

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
}

window.pageInitializers.push(initializeSearchPage);