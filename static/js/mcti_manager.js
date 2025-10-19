function initializeMctiPage() {
    // --- REFERÊNCIAS AOS ELEMENTOS ---
    const searchForm = document.getElementById('mcti-search-form');
    const resultsCard = document.getElementById('mcti-results-card');
    const tableHead = document.getElementById('mcti-table-head');
    const tableBody = document.getElementById('mcti-table-body');
    const resultsCount = document.getElementById('mcti-results-count');
    const emptyMessage = document.getElementById('mcti-empty-message');
    const keywordInput = document.getElementById('keyword-search-input');
    const filtroAno = document.getElementById('filtro-ano');
    const filtroCampanha = document.getElementById('filtro-campanha');
    const enterSelectionModeBtn = document.getElementById('enter-selection-mode-btn');
    const cancelSelectionModeBtn = document.getElementById('cancel-selection-mode-btn');
    const selectionControls = document.getElementById('selection-controls');
    const searchSelectedBtn = document.getElementById('search-selected-btn');
    const selectedCountBadge = document.getElementById('selected-count-badge');
    
    // --- ESTADO DA PÁGINA ---
    let allFilterOptions = {};
    let fullCampaignData = [];
    let isSelectionModeActive = false;
    let selectedObjects = new Set();
    let isTourActive = false;
    let tourOverlay = null;
    let isTourSimulatingClick = false; // ✅ NOSSO NOVO SINALIZADOR

// ==========================================================
    // >>> LÓGICA DO TOUR GUIADO (COM A ESTRATÉGIA FINAL) <<<
    // ==========================================================
    const TOUR_STORAGE_KEY = 'mctiSelectionTourShown_v14'; 

    window.currentMctiTour = {
        advance: (nextStep) => {
            showTourStep(nextStep);
        },
        finish: () => {
            if (!isTourActive) return;
            isTourActive = false;
            localStorage.setItem(TOUR_STORAGE_KEY, 'true');
            clearTourUI();
            
            if (isSelectionModeActive) {
                exitSelectionMode(true);
            }
        }
    };

    function startTour() {
        if (localStorage.getItem(TOUR_STORAGE_KEY) === 'true' || isTourActive) return;
        
        isTourActive = true;
        tourOverlay = document.createElement('div');
        tourOverlay.className = 'tour-overlay';
        document.body.appendChild(tourOverlay);

        setTimeout(() => showTourStep(1), 500);
    }

    function showTourStep(step) {
        clearTourUI(false);

        let targetElement, title, content, buttonText, nextStep;

        switch (step) {
            case 1:
                targetElement = enterSelectionModeBtn;
                title = 'Enviar para Busca';
                content = '<p>Use este botão para selecionar objetos e enviá-los para a busca principal.</p>';
                buttonText = 'Próximo <i class="fas fa-arrow-right ms-2"></i>';
                nextStep = 2;
                break;
            
            case 2:
                isTourSimulatingClick = true;
                enterSelectionModeBtn.click();
                isTourSimulatingClick = false;

                setTimeout(() => showTourStep(3), 500);
                return;

            case 3:
                targetElement = tableHead.querySelector('th'); 
                title = 'Passo 2: Selecione';
                content = '<p>Agora você pode marcar os objetos que deseja. Use a caixa no cabeçalho para selecionar todos os itens visíveis.</p>';
                buttonText = 'Próximo <i class="fas fa-arrow-right ms-2"></i>';
                nextStep = 4;
                break;

            case 4:
                targetElement = searchForm;
                title = 'Passo 3: Navegue (Opcional)';
                content = '<p>Enquanto seleciona, você pode usar os filtros para buscar em outras campanhas. <strong>Sua seleção será mantida!</strong></p>';
                buttonText = 'Próximo <i class="fas fa-arrow-right ms-2"></i>';
                nextStep = 5;
                break;

            case 5:
                targetElement = searchSelectedBtn;
                title = 'Passo 4: Decida';
                content = '<p>Quando terminar, clique em <strong>Buscar</strong> para enviar sua lista, ou no <strong>X</strong> para limpar tudo e sair.</p>';
                buttonText = 'Entendi!';
                nextStep = 6;
                break;
            
            case 6:
                window.currentMctiTour.finish();
                return;
        }

        if (targetElement) {
            createPopover(targetElement, title, content, buttonText, nextStep);
        }
    }

    function createPopover(element, title, content, buttonText, nextStep) {
        element.classList.add('tour-highlight');
        
        const popoverContent = `
            <div>
                ${content}
            
                <button class="btn btn-sm btn-outline-light w-100 mt-2" onclick="window.currentMctiTour.advance(${nextStep})">${buttonText}</button>
            </div>
        `;
        
        const popover = new bootstrap.Popover(element, {
            title,
            content: popoverContent,
            html: true,
            trigger: 'manual',
            placement: 'top',
            fallbackPlacements: ['bottom', 'left', 'right'],
            customClass: 'popover-tip',
            sanitize: false 
        });
        popover.show();
    }
    
    function clearTourUI(clearOverlay = true) {
        document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
        
        document.querySelectorAll('.popover').forEach(popoverEl => {
            const trigger = document.querySelector(`[aria-describedby="${popoverEl.id}"]`);
            if(trigger) {
                const instance = bootstrap.Popover.getInstance(trigger);
                if (instance) instance.dispose();
            } else {
                popoverEl.remove();
            }
        });

        if (clearOverlay && tourOverlay) {
            tourOverlay.remove();
            tourOverlay = null;
        }
    }
    // ==========================================================
    // >>> FIM DA LÓGICA DO TOUR GUIADO <<<
    // ==========================================================

    // --- LÓGICA DE EVENTOS ---
    filtroAno.addEventListener('change', updateCampanhaDropdown);
    searchForm.addEventListener('submit', performInitialSearch);
    keywordInput.addEventListener('input', filterTableByKeyword);
    enterSelectionModeBtn.addEventListener('click', enterSelectionMode);
    cancelSelectionModeBtn.addEventListener('click', () => exitSelectionMode(false));
    searchSelectedBtn.addEventListener('click', searchSelectedObjects);

    // --- FUNÇÕES DE INICIALIZAÇÃO ---
    async function initializePage() {
        try {
            const response = await fetch('/api/mcti-filter-options');
            if (!response.ok) throw new Error('Falha ao carregar opções de filtro');
            allFilterOptions = await response.json();
            populateAnoDropdown(Object.keys(allFilterOptions));
            filtroAno.disabled = false;
        } catch (error) {
            console.error("ERRO ao inicializar a página:", error);
            alert("Não foi possível carregar as opções de filtro. Por favor, recarregue a página.");
        }
    }

    function populateAnoDropdown(anos) {
        filtroAno.innerHTML = '<option selected value="">Selecione um Ano...</option>';
        anos.forEach(ano => {
            const option = document.createElement('option');
            option.value = ano;
            option.textContent = ano;
            filtroAno.appendChild(option);
        });
    }

    function updateCampanhaDropdown() {
        const selectedAno = filtroAno.value;
        filtroCampanha.innerHTML = '<option selected value="">Selecione uma Campanha...</option>';
        if (selectedAno && allFilterOptions[selectedAno]) {
            const campanhasDoAno = allFilterOptions[selectedAno];
            campanhasDoAno.forEach(campanha => {
                const option = document.createElement('option');
                option.value = campanha;
                option.textContent = campanha;
                filtroCampanha.appendChild(option);
            });
            filtroCampanha.disabled = false;
        } else {
            filtroCampanha.disabled = true;
        }
    }

    // --- FUNÇÕES DO MODO DE SELEÇÃO ---
    function enterSelectionMode() {
        // ✅ NOVA LÓGICA COM O SINALIZADOR
        if (isTourSimulatingClick) {
            // Se o tour está a simular o clique, não fazemos nada de especial
        } else if (isTourActive) {
            // Se foi um clique REAL do usuário durante o tour, avançamos o tour
            window.currentMctiTour.advance(2);
            return; 
        }

        // A lógica original da sua função funcional
        if (isSelectionModeActive) return; 
        
        isSelectionModeActive = true;
        enterSelectionModeBtn.classList.add('d-none');
        selectionControls.classList.remove('d-none');
        renderTable(getCurrentFilteredData(), false);
    }

    function exitSelectionMode(force = false) {
        if (!force && selectedObjects.size > 0) {
            if (!confirm(`Você tem ${selectedObjects.size} objeto(s) selecionado(s). Deseja limpar a seleção e sair?`)) {
                return;
            }
        }
        isSelectionModeActive = false;
        selectedObjects.clear();
        enterSelectionModeBtn.classList.remove('d-none');
        selectionControls.classList.add('d-none');
        updateSelectionUI();
        renderTable(getCurrentFilteredData(), false);
    }

    function updateSelectionUI() {
        const count = selectedObjects.size;
        selectedCountBadge.textContent = count;
        searchSelectedBtn.disabled = count === 0;
    }

    function searchSelectedObjects() {
        if (selectedObjects.size === 0) return;
        const objectCodes = Array.from(selectedObjects);
        sessionStorage.setItem('pendingSearchObjects', objectCodes.join('\n'));
        window.location.href = '/';
    }

    function getCurrentFilteredData() {
        const searchTerm = keywordInput.value.toLowerCase();
        if (!searchTerm) { return fullCampaignData; }
        return fullCampaignData.filter(row => Object.values(row).join(' ').toLowerCase().includes(searchTerm));
    }

    // --- FUNÇÕES DE BUSCA E RENDERIZAÇÃO ---
    async function performInitialSearch(event) {
        event.preventDefault();
        const ano = filtroAno.value;
        const campanha = filtroCampanha.value;
        if (!ano || !campanha) {
            alert('Por favor, selecione um Ano e uma Campanha para iniciar a busca.');
            return;
        }
        const params = new URLSearchParams({ ano, campanha });
        const url = `/api/search-mcti?${params.toString()}`;
        try {
            resultsCard.classList.add('d-none');
            const response = await fetch(url);
            if (!response.ok) throw new Error('Erro ao buscar dados da campanha');
            fullCampaignData = await response.json();

            isSelectionModeActive = false;
            selectedObjects.clear();
            enterSelectionModeBtn.classList.remove('d-none');
            selectionControls.classList.add('d-none');
            
            renderTable(fullCampaignData, true);

            if (fullCampaignData.length > 0) {
                startTour();
            }

        } catch (error) {
            console.error("Erro na busca inicial:", error);
            alert("Ocorreu um erro ao buscar os dados da campanha.");
        }
    }
    
    function filterTableByKeyword() {
        renderTable(getCurrentFilteredData(), false);
    }

    function renderTable(data, isNewSearch = true) {
        tableBody.innerHTML = '';
        tableHead.innerHTML = '';
        if (isNewSearch) { keywordInput.value = ''; }
        resultsCard.classList.remove('d-none');
        resultsCount.textContent = `${data.length} de ${fullCampaignData.length} encontrado(s)`;
        if (data.length === 0) {
            emptyMessage.classList.remove('d-none');
            document.querySelector('#mcti-results-card .table-responsive').classList.add('d-none');
            enterSelectionModeBtn.classList.add('d-none');
            return;
        }
        if (!isSelectionModeActive) {
            enterSelectionModeBtn.classList.remove('d-none');
        }
        emptyMessage.classList.add('d-none');
        document.querySelector('#mcti-results-card .table-responsive').classList.remove('d-none');
        const columnOrder = ['Ano', 'Campanha', 'Objeto', 'Linked', 'Observadores', 'Equipe', 'Data', 'Localizacao'];
        const trHead = document.createElement('tr');
        if (isSelectionModeActive) {
            const thSelect = document.createElement('th');
            thSelect.style.width = '1%';
            const selectAllCheckbox = document.createElement('input');
            selectAllCheckbox.type = 'checkbox';
            selectAllCheckbox.className = 'form-check-input';
            selectAllCheckbox.title = 'Selecionar/Desselecionar Todos os Visíveis';
            selectAllCheckbox.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                const visibleCheckboxes = tableBody.querySelectorAll('.object-checkbox');
                visibleCheckboxes.forEach(cb => {
                    const objectCode = cb.dataset.objectCode;
                    if (isChecked) {
                        selectedObjects.add(objectCode);
                    } else {
                        selectedObjects.delete(objectCode);
                    }
                    cb.checked = isChecked;
                });
                updateSelectionUI();
            });
            thSelect.appendChild(selectAllCheckbox);
            trHead.appendChild(thSelect);
        }
        columnOrder.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            trHead.appendChild(th);
        });
        tableHead.appendChild(trHead);
        data.forEach(row => {
            const trBody = document.createElement('tr');
            if (isSelectionModeActive) {
                const tdSelect = document.createElement('td');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'form-check-input object-checkbox';
                checkbox.dataset.objectCode = row['Objeto'];
                checkbox.checked = selectedObjects.has(row['Objeto']);
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        selectedObjects.add(row['Objeto']);
                    } else {
                        selectedObjects.delete(row['Objeto']);
                    }
                    updateSelectionUI();
                });
                tdSelect.appendChild(checkbox);
                trBody.appendChild(tdSelect);
            }
            columnOrder.forEach(headerText => {
                const td = document.createElement('td');
                const cellData = row[headerText] || '-';
                td.textContent = cellData;
                trBody.appendChild(td);
            });
            tableBody.appendChild(trBody);
        });
        updateSelectionUI();
    }
    
    initializePage();
}

if (document.getElementById('mcti-search-form')) {
    window.pageInitializers.push(initializeMctiPage);
}