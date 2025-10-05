document.addEventListener('DOMContentLoaded', function () {
    // --- REFERÊNCIAS AOS ELEMENTOS ---
    const searchForm = document.getElementById('mcti-search-form');
    const resultsCard = document.getElementById('mcti-results-card');
    const tableHead = document.getElementById('mcti-table-head');
    const tableBody = document.getElementById('mcti-table-body');
    const resultsCount = document.getElementById('mcti-results-count');
    const emptyMessage = document.getElementById('mcti-empty-message');
    const keywordInput = document.getElementById('keyword-search-input');

    const filtroAno = document.getElementById('filtro-ano');
    const filtroPeriodo = document.getElementById('filtro-periodo');
    
    let allFilterOptions = {};
    let fullCampaignData = [];

    // --- INICIALIZAÇÃO DA PÁGINA ---
    async function initializePage() {
        try {
            const response = await fetch('/api/mcti-filter-options');
            if (!response.ok) throw new Error('Falha ao carregar opções de filtro');
            
            allFilterOptions = await response.json();
            populateAnoDropdown(Object.keys(allFilterOptions));
        } catch (error) {
            console.error("Erro ao inicializar a página:", error);
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

    function updatePeriodoDropdown() {
        const selectedAno = filtroAno.value;
        filtroPeriodo.innerHTML = '<option selected value="">Selecione um Período...</option>';

        if (selectedAno && allFilterOptions[selectedAno]) {
            const periodosDoAno = allFilterOptions[selectedAno];
            periodosDoAno.forEach(periodo => {
                const option = document.createElement('option');
                option.value = periodo;
                option.textContent = periodo;
                filtroPeriodo.appendChild(option);
            });
            filtroPeriodo.disabled = false;
        } else {
            filtroPeriodo.disabled = true;
        }
    }

    // --- LÓGICA DOS EVENTOS ---
    filtroAno.addEventListener('change', updatePeriodoDropdown);
    searchForm.addEventListener('submit', performInitialSearch);
    keywordInput.addEventListener('input', filterTableByKeyword);

    // --- FUNÇÕES PRINCIPAIS ---
    async function performInitialSearch(event) {
        event.preventDefault();
        const ano = filtroAno.value;
        const periodo = filtroPeriodo.value;

        if (!ano || !periodo) {
            alert('Por favor, selecione um Ano e um Período para iniciar a busca.');
            return;
        }

        const params = new URLSearchParams({ ano, periodo });
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

    // FUNÇÃO ATUALIZADA com a ordem de colunas personalizada
    function renderTable(data, isNewSearch = true) {
        tableBody.innerHTML = '';
        resultsCard.classList.remove('d-none');
        resultsCount.textContent = `${data.length} de ${fullCampaignData.length} encontrado(s)`;

        if (isNewSearch) {
            keywordInput.value = '';
            tableHead.innerHTML = '';
        }

        // Define a ordem exata das colunas a serem exibidas
        const columnOrder = ['Ano', 'Periodo', 'Objeto', 'Linked', 'Observadores', 'Equipe', 'Data', 'Localizacao'];

        if (data.length === 0) {
            // Se não houver dados, garante que o cabeçalho não seja mostrado
            tableHead.innerHTML = ''; 
            emptyMessage.classList.remove('d-none');
            document.querySelector('#mcti-results-card .table-responsive').classList.add('d-none');
            return;
        }
        
        emptyMessage.classList.add('d-none');
        document.querySelector('#mcti-results-card .table-responsive').classList.remove('d-none');
        
        // Cria o cabeçalho da tabela apenas se for uma nova busca
        if (isNewSearch && data.length > 0) {
            const trHead = document.createElement('tr');
            // Itera sobre a nossa lista ordenada para criar os cabeçalhos
            columnOrder.forEach(headerText => {
                const th = document.createElement('th');
                th.textContent = headerText;
                trHead.appendChild(th);
            });
            tableHead.appendChild(trHead);
        }

        // Preenche o corpo da tabela com os dados
        data.forEach(row => {
            const trBody = document.createElement('tr');
            // Itera sobre a nossa lista ordenada para garantir a ordem das células
            columnOrder.forEach(headerText => {
                const td = document.createElement('td');
                td.textContent = row[headerText] || '-';
                trBody.appendChild(td);
            });
            tableBody.appendChild(trBody);
        });
    }
    
    initializePage();
});