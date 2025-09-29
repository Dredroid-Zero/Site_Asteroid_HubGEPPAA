document.addEventListener('DOMContentLoaded', function() {
    // Referências aos elementos da página
    const tableSelect = document.getElementById('active_table_select');
    const tableBody = document.getElementById('table-body-sortable');
    const tableHeadRow = document.getElementById('table-head-row');
    const emptyMessage = document.getElementById('empty-table-message');
    const activeTableNameDisplays = document.querySelectorAll('.dynamic-active-table-name');
    const managementPanel = document.getElementById('management-panel');
    const loadingOverlay = document.getElementById('loading-overlay');
    const reanalyzeForm = document.getElementById('reanalyze-form');
    const downloadCsvBtn = document.getElementById('download-csv-btn');
    
    // Controles de modo
    const reorderControls = document.getElementById('reorder-controls');
    const deleteControls = document.getElementById('delete-controls');

    // Instâncias dos modais
    const createModal = new bootstrap.Modal(document.getElementById('createTableModal'));
    const renameModal = new bootstrap.Modal(document.getElementById('renameTableModal'));
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteTableModal'));
    let sortable = null;

    function renderPage() {
        tableSelect.innerHTML = '';
        Object.keys(appState.saved_tables).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            if (name === appState.active_table) option.selected = true;
            tableSelect.appendChild(option);
        });
        activeTableNameDisplays.forEach(span => span.textContent = appState.active_table);
        const activeTableData = appState.saved_tables[appState.active_table] || [];
        tableBody.innerHTML = '';
        tableHeadRow.innerHTML = '';
        if (activeTableData.length > 0) {
            emptyMessage.classList.add('d-none');
            document.querySelector('.table-responsive').classList.remove('d-none');
            const headers = appState.column_order.filter(col => col in activeTableData[0]);
            tableHeadRow.innerHTML = '<th class="control-col"></th>';
            headers.forEach(header => tableHeadRow.innerHTML += `<th>${header}</th>`);
            activeTableData.forEach(row => {
                const tr = document.createElement('tr');
                tr.dataset.objectName = row['Objeto'];
                let rowHTML = '<td class="control-col"><span class="drag-handle"><i class="fas fa-grip-vertical"></i></span><input class="form-check-input row-checkbox" type="checkbox"></td>';
                headers.forEach(header => rowHTML += `<td>${row[header] || '-'}</td>`);
                tr.innerHTML = rowHTML;
                tableBody.appendChild(tr);
            });
        } else {
            emptyMessage.classList.remove('d-none');
            document.querySelector('.table-responsive').classList.add('d-none');
        }
    }

    tableSelect.addEventListener('change', function() {
        appState.active_table = this.value;
        saveStateToLocalStorage();
        renderPage();
    });

    document.getElementById('confirm-create-table').addEventListener('click', () => {
        const newNameInput = document.getElementById('new_name_create_input');
        const newName = newNameInput.value.trim();
        if (newName && !appState.saved_tables[newName]) {
            const initialTableCount = Object.keys(appState.saved_tables).length;
            appState.saved_tables[newName] = [];
            appState.active_table = newName;
            saveStateToLocalStorage();
            createModal.hide();
            newNameInput.value = '';
            renderPage();
            // A dica de gerenciamento quando a *segunda* tabela é criada.
            if (initialTableCount === 1 && localStorage.getItem('tableManagementTipShown') !== 'true') {
                 const tipContent = 'Parabéns pela sua nova tabela! Agora você pode alternar facilmente entre seus projetos aqui.';
                 setTimeout(() => {
                    showDynamicPopover(tableSelect, 'Múltiplas Tabelas!', tipContent, 10000);
                 }, 500);
                 localStorage.setItem('tableManagementTipShown', 'true');
            }
        } else {
            alert('Nome inválido ou já existente.');
        }
    });

    document.getElementById('confirm-rename-table').addEventListener('click', () => {
        const oldName = appState.active_table;
        const newNameInput = document.getElementById('new_name_rename_input');
        const newName = newNameInput.value.trim();
        if (newName && newName !== oldName && !appState.saved_tables[newName]) {
            appState.saved_tables[newName] = appState.saved_tables[oldName];
            delete appState.saved_tables[oldName];
            appState.active_table = newName;
            saveStateToLocalStorage();
            renameModal.hide();
            newNameInput.value = '';
            renderPage();
        } else {
            alert('Novo nome inválido ou já existente.');
        }
    });

    document.getElementById('confirm-delete-table').addEventListener('click', () => {
        const tableToDelete = appState.active_table;
        if (Object.keys(appState.saved_tables).length <= 1) {
            alert('Não é possível excluir a última tabela.');
            return;
        }
        if (confirm(`Tem certeza que deseja excluir a tabela '${tableToDelete}'?`)) {
            delete appState.saved_tables[tableToDelete];
            appState.active_table = Object.keys(appState.saved_tables)[0];
            saveStateToLocalStorage();
            deleteModal.hide();
            renderPage();
        }
    });

    downloadCsvBtn.addEventListener('click', function() {
        const activeTable = appState.active_table;
        const data = appState.saved_tables[activeTable];
        if (!data || data.length === 0) {
            alert('A tabela está vazia. Não há nada para baixar.');
            return;
        }
        const headers = appState.column_order.filter(col => col in data[0]);
        let csvContent = '\uFEFF' + headers.join(';') + '\n';
        data.forEach(row => {
            const values = headers.map(header => {
                let cell = row[header] ? String(row[header]) : '';
                cell = cell.replace(/"/g, '""');
                if (cell.includes(';') || cell.includes('"') || cell.includes('\n')) {
                    cell = `"${cell}"`;
                }
                return cell;
            });
            csvContent += values.join(';') + '\n';
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${activeTable.replace(/ /g,"_")}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    reanalyzeForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const activeTable = appState.active_table;
        const tableData = appState.saved_tables[activeTable];
        if (!tableData || tableData.length === 0) {
            alert('Tabela vazia, nada para reanalisar.');
            return;
        }
        if (!confirm(`Isso buscará novamente os dados de todos os ${tableData.length} objetos nesta tabela. Pode demorar um pouco. Deseja continuar?`)) {
            return;
        }
        showLoading(true, 'Reanalisando dados...');
        const identifiers = tableData.map(row => row.Objeto).join('\n');
        try {
            const response = await fetch('/api/run-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identificadores: identifiers })
            });
            if (!response.ok) throw new Error('A resposta do servidor não foi OK.');
            const newResults = await response.json();
            if (newResults && newResults.length > 0) {
                appState.saved_tables[activeTable] = newResults;
                saveStateToLocalStorage();
                alert('Reanálise concluída com sucesso!');
                renderPage();
            } else {
                alert('Nenhum dado novo foi encontrado durante a reanálise.');
            }
        } catch (error) {
            console.error('Erro ao reanalisar dados:', error);
            alert('Ocorreu um erro ao comunicar com o servidor durante a reanálise.');
        } finally {
            showLoading(false);
        }
    });

    function showLoading(show, message = '') {
        const title = document.getElementById('progress-title');
        if (show) {
            if(title) title.textContent = message;
            loadingOverlay.style.display = 'flex';
        } else {
            loadingOverlay.style.display = 'none';
        }
    }
    
    document.getElementById('enable-delete-mode').addEventListener('click', () => enterMode('delete'));
    document.getElementById('reorder-rows-btn').addEventListener('click', () => enterMode('reorder'));
    document.getElementById('cancel-delete-mode').addEventListener('click', () => exitAllModes());
    document.getElementById('cancel-reorder-btn').addEventListener('click', () => exitAllModes());
    document.getElementById('save-reorder-btn').addEventListener('click', saveOrder);

    document.getElementById('delete-rows-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const selectedCheckboxes = tableBody.querySelectorAll('.row-checkbox:checked');
        const objectNamesToDelete = Array.from(selectedCheckboxes).map(cb => cb.closest('tr').dataset.objectName);
        if (objectNamesToDelete.length > 0 && confirm(`Excluir ${objectNamesToDelete.length} linha(s)?`)) {
            const activeTable = appState.active_table;
            appState.saved_tables[activeTable] = appState.saved_tables[activeTable].filter(row => !objectNamesToDelete.includes(row.Objeto));
            saveStateToLocalStorage();
            exitAllModes();
            renderPage();
        }
    });

    tableBody.addEventListener('click', (e) => {
        if (tableBody.classList.contains('delete-mode')) {
            const row = e.target.closest('tr');
            if (!row) return;
            const checkbox = row.querySelector('.row-checkbox');
            if (e.target.tagName !== 'INPUT') checkbox.checked = !checkbox.checked;
            row.classList.toggle('selected', checkbox.checked);
            const selectedCount = tableBody.querySelectorAll('.row-checkbox:checked').length;
            document.getElementById('confirm-delete-btn').disabled = (selectedCount === 0);
        }
    });
    
    function enterMode(mode) {
        managementPanel.classList.add('d-none');
        if (mode === 'delete') {
            deleteControls.classList.remove('d-none');
            tableBody.classList.add('delete-mode');
        } else if (mode === 'reorder') {
            reorderControls.classList.remove('d-none');
            tableBody.classList.add('reorder-mode');
            sortable = new Sortable(tableBody, { animation: 150, handle: '.drag-handle', dataIdAttr: 'data-object-name' });
        }
    }

    function exitAllModes() {
        managementPanel.classList.remove('d-none');
        deleteControls.classList.add('d-none');
        reorderControls.classList.add('d-none');
        tableBody.classList.remove('delete-mode', 'reorder-mode');
        if (sortable) sortable.destroy();
        sortable = null;
        tableBody.querySelectorAll('tr.selected').forEach(row => row.classList.remove('selected'));
        tableBody.querySelectorAll('.row-checkbox:checked').forEach(cb => cb.checked = false);
        document.getElementById('confirm-delete-btn').disabled = true;
    }
    
    function saveOrder() {
        if (!sortable) return;
        const newOrder = sortable.toArray();
        const activeTable = appState.active_table;
        const rowMap = appState.saved_tables[activeTable].reduce((map, row) => (map[row.Objeto] = row, map), {});
        appState.saved_tables[activeTable] = newOrder.map(objName => rowMap[objName]);
        saveStateToLocalStorage();
        exitAllModes();
        renderPage();
    }

    // --- NOVAS DICAS DINÂMICAS ---
    const manageTablesAlert = document.getElementById('manage-tables-alert');
    if(manageTablesAlert) {
        manageTablesAlert.addEventListener('close.bs.alert', function () {
            startTablesPageTour();
        });
    }

    function startTablesPageTour() {
        if (localStorage.getItem('tablesPageTourShown') === 'true') {
            return;
        }
        localStorage.setItem('tablesPageTourShown', 'true');

        setTimeout(() => {
            const tipContent = 'Use este botão para buscar novamente os dados de todos os objetos da tabela, atualizando-os com as informações mais recentes.';
            showDynamicPopover(reanalyzeForm, 'Atualizar Dados', tipContent);
        }, 500);

        setTimeout(() => {
            const tipContent = 'Exporte todos os dados desta tabela para um arquivo CSV, compatível com Excel e outras planilhas.';
            showDynamicPopover(downloadCsvBtn, 'Baixar Tabela', tipContent);
        }, 8000);
    }

    renderPage();
});