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
    // 1. MUDANÇA: Referência ao novo ID e nome da variável
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

    // 2. MUDANÇA: Nome da função e lógica interna
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
    // 3. MUDANÇA: O evento 'change' agora chama a nova função
    filtroAno.addEventListener('change', updateCampanhaDropdown);
    searchForm.addEventListener('submit', performInitialSearch);
    keywordInput.addEventListener('input', filterTableByKeyword);

    // --- FUNÇÕES PRINCIPAIS ---
    async function performInitialSearch(event) {
        event.preventDefault();
        const ano = filtroAno.value;
        // 4. MUDANÇA: Pega o valor da campanha e ajusta a validação
        const campanha = filtroCampanha.value;
        if (!ano || !campanha) {
            alert('Por favor, selecione um Ano e uma Campanha para iniciar a busca.');
            return;
        }
        // 5. MUDANÇA: Envia 'campanha' como parâmetro para a API
        const params = new URLSearchParams({ ano, campanha });
        const url = `/api/search-mcti?${params.toString()}`;
        try {
            resultsCard.classList.add('d-none'); // Esconde o card de resultados antes da busca
            // Adicionar um feedback de carregamento seria uma boa melhoria futura
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
        // Filtra os dados da campanha completa
        const filteredData = fullCampaignData.filter(row => {
            // Concatena todos os valores da linha em uma string e busca pelo termo
            return Object.values(row).join(' ').toLowerCase().includes(searchTerm);
        });
        renderTable(filteredData, false); // Re-renderiza a tabela sem resetar o cabeçalho
    }

    function renderTable(data, isNewSearch = true) {
        tableBody.innerHTML = '';
        resultsCard.classList.remove('d-none');
        resultsCount.textContent = `${data.length} de ${fullCampaignData.length} encontrado(s)`;
        
        if (isNewSearch) {
            keywordInput.value = ''; // Limpa o campo de filtro
            tableHead.innerHTML = ''; // Limpa o cabeçalho
        }

        // 6. MUDANÇA: A ordem das colunas agora usa 'Campanha'
        const columnOrder = ['Ano', 'Campanha', 'Objeto', 'Linked', 'Observadores', 'Equipe', 'Data', 'Localizacao'];

        if (data.length === 0) {
            tableHead.innerHTML = ''; // Garante que o cabeçalho esteja vazio
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
                // O código aqui já é dinâmico, então ele pegará row['Campanha'] automaticamente
                let cellData = row[headerText] || '-';
                // Lógica especial para a coluna 'Linked'
                if (headerText === 'Linked' && cellData && cellData !== '-') {
                    const link = document.createElement('a');
                    link.href = cellData;
                    link.textContent = 'Link';
                    link.target = '_blank';
                    td.appendChild(link);
                } else {
                    td.textContent = cellData;
                }
                trBody.appendChild(td);
            });
            tableBody.appendChild(trBody);
        });
    }
    
    initializePage();
}

// Garante que o script só rode quando a página correta for carregada
if (document.getElementById('mcti-search-form')) {
    initializeMctiPage();
}