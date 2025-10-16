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
    // <<< ALTERAÇÃO AQUI
    const filtroCampanha = document.getElementById('filtro-campanha');
    
    let allFilterOptions = {};
    let fullCampaignData = [];

    // --- INICIALIZAÇÃO DA PÁGINA ---
    async function initializePage() {
        try {
            const response = await fetch('/api/mcti-filter-options');
            if (!response.ok) throw new Error('Falha ao carregar opções de filtro');
            
            allFilterOptions = await response.json();
            
            populateAnoDropdown(Object.keys(allFilterOptions));
            filtroAno.disabled = false;

        } catch (error) {
            console.error("ERRO ao inicializar a página:", error);
            filtroAno.innerHTML = '<option selected value="">Erro ao carregar</option>';
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

    // <<< ALTERAÇÃO AQUI (nome da função e lógica interna)
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

    // --- LÓGICA DOS EVENTOS ---
    // <<< ALTERAÇÃO AQUI
    filtroAno.addEventListener('change', updateCampanhaDropdown);
    searchForm.addEventListener('submit', performInitialSearch);
    keywordInput.addEventListener('input', filterTableByKeyword);

    // --- FUNÇÕES PRINCIPAIS ---
    async function performInitialSearch(event) {
        event.preventDefault();
        const ano = filtroAno.value;
        // <<< ALTERAÇÃO AQUI
        const campanha = filtroCampanha.value;
        if (!ano || !campanha) {
            alert('Por favor, selecione um Ano e uma Campanha para iniciar a busca.');
            return;
        }
        // <<< ALTERAÇÃO AQUI
        const params = new URLSearchParams({ ano, campanha });
        const url = `/api/search-mcti?${params.toString()}`;
        try {
            resultsCard.classList.add('d-none');
            const response = await fetch(url);
            if (!response.ok) throw new Error('Erro ao buscar dados da campanha');
            fullCampaignData = await response.json();
            renderTable(fullCampaignData);
        } catch (error) {
            console.error("Erro na busca inicial:", error);
            alert("Ocorreu um erro ao buscar os dados da campanha.");
        }
    }
    
    function filterTableByKeyword() {
        const searchTerm = keywordInput.value.toLowerCase();
        const filteredData = fullCampaignData.filter(row => {
            return Object.values(row).join(' ').toLowerCase().includes(searchTerm);
        });
        renderTable(filteredData, false);
    }

    function renderTable(data, isNewSearch = true) {
        tableBody.innerHTML = '';
        resultsCard.classList.remove('d-none');
        resultsCount.textContent = `${data.length} de ${fullCampaignData.length} encontrado(s)`;
        if (isNewSearch) {
            keywordInput.value = '';
            tableHead.innerHTML = '';
        }
        
        // <<< ALTERAÇÃO AQUI
        const columnOrder = ['Ano', 'Campanha', 'Objeto', 'Linked', 'Observadores', 'Equipe', 'Data', 'Localizacao'];
        
        if (data.length === 0) {
            tableHead.innerHTML = ''; 
            emptyMessage.classList.remove('d-none');
            document.querySelector('#mcti-results-card .table-responsive').classList.add('d-none');
            return;
        }
        
        emptyMessage.classList.add('d-none');
        document.querySelector('#mcti-results-card .table-responsive').classList.remove('d-none');
        
        if (isNewSearch && data.length > 0) {
            const trHead = document.createElement('tr');
            columnOrder.forEach(headerText => {
                const th = document.createElement('th');
                th.textContent = headerText;
                trHead.appendChild(th);
            });
            tableHead.appendChild(trHead);
        }
        
        data.forEach(row => {
            const trBody = document.createElement('tr');
            columnOrder.forEach(headerText => {
                const td = document.createElement('td');
                td.textContent = row[headerText] || '-';
                trBody.appendChild(td);
            });
            tableBody.appendChild(trBody);
        });
    }
    
    initializePage();
}

// Lógica para garantir que o script certo rode na página certa.
if (document.getElementById('mcti-search-form')) {
    initializeMctiPage();
}