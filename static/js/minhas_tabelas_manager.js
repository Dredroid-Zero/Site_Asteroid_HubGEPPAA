document.addEventListener('DOMContentLoaded', function() {
    // --- REFERÊNCIAS AOS ELEMENTOS ---
    const tableSelect = document.getElementById('active_table_select');
    const tableBody = document.getElementById('table-body-sortable');
    const tableHeadRow = document.getElementById('table-head-row');
    const emptyMessage = document.getElementById('empty-table-message');
    const activeTableNameDisplays = document.querySelectorAll('.dynamic-active-table-name');
    const managementPanel = document.getElementById('management-panel');
    const reanalyzeForm = document.getElementById('reanalyze-form');
    const downloadCsvBtn = document.getElementById('download-csv-btn');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const progressAsteroid = document.getElementById('progress-asteroid');
    const progressTitle = document.getElementById('progress-title');
    const reorderControls = document.getElementById('reorder-controls');
    const deleteControls = document.getElementById('delete-controls');
    
    // Modais
    const createModal = new bootstrap.Modal(document.getElementById('createTableModal'));
    const renameModal = new bootstrap.Modal(document.getElementById('renameTableModal'));
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteTableModal'));
    const reanalyzeReportModal = new bootstrap.Modal(document.getElementById('reanalyzeReportModal'));
    let sortable = null;

    // --- LÓGICA DE REANÁLISE COM RELATÓRIO E DESTAQUE ---
    reanalyzeForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const activeTable = appState.active_table;
        const tableData = appState.saved_tables[activeTable];

        if (!tableData || tableData.length === 0) {
            alert('Tabela vazia, nada para reanalisar.');
            return;
        }
        if (!confirm(`Isso buscará novamente os dados de todos os ${tableData.length} objetos nesta tabela e destacará as mudanças. Deseja continuar?`)) {
            return;
        }

        const oldDataMap = new Map(tableData.map(row => [row.Objeto, { ...row }]));
        const identifiers = tableData.map(row => row.Objeto);
        
        const CHUNK_SIZE = 25;
        const chunks = [];
        for (let i = 0; i < identifiers.length; i += CHUNK_SIZE) {
            chunks.push(identifiers.slice(i, i + CHUNK_SIZE));
        }

        let newTotalResults = [];
        showLoading(true);
        resetProgressBar();

        try {
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const chunkNumber = i + 1;
                
                updateProgressText(`Reanalisando lote ${chunkNumber} de ${chunks.length}...`);
                
                const response = await fetch('/api/run-search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identificadores: chunk.join('\n') })
                });
                if (!response.ok) throw new Error(`Erro no lote ${chunkNumber}: ${response.statusText}`);

                const chunkResults = await response.json();
                if (chunkResults.length > 0) newTotalResults.push(...chunkResults);
                
                const progress = (chunkNumber / chunks.length) * 100;
                updateProgressBar(progress);
                
                await new Promise(resolve => setTimeout(resolve, 500)); 
            }

            updateProgressText('Comparando dados...');
            await new Promise(resolve => setTimeout(resolve, 600));

            const changes = [];
            const fieldsToCompare = ['Status do objeto', 'Incerteza', 'Tipo de Órbita', 'Comprimento do Arco (dias)', 'Oposições'];

            newTotalResults.forEach(newRow => {
                const oldRow = oldDataMap.get(newRow.Objeto);
                if (oldRow) {
                    fieldsToCompare.forEach(field => {
                        const oldValue = oldRow[field] !== null && oldRow[field] !== undefined ? oldRow[field] : 'N/A';
                        const newValue = newRow[field] !== null && newRow[field] !== undefined ? newRow[field] : 'N/A';
                        
                        if (String(oldValue) !== String(newValue)) {
                            changes.push({
                                objectName: newRow.Objeto,
                                field: field,
                                oldValue: oldValue,
                                newValue: newValue
                            });
                        }
                    });
                }
            });

            if (newTotalResults.length > 0) {
                appState.saved_tables[activeTable] = newTotalResults;
                saveStateToLocalStorage();
                renderPage();
                
                setTimeout(() => {
                    highlightChanges(changes);
                    showReanalyzeReport(changes);
                }, 100);

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
    
    function showReanalyzeReport(changes) {
        const reportBody = document.getElementById('reanalyzeReportBody');
        if (!reportBody) return;

        let reportHTML = '<h5>Análise Finalizada!</h5>';

        if (changes.length > 0) {
            reportHTML += `<p>${changes.length} atualização(ões) encontrada(s):</p><ul class="list-group">`;
            changes.forEach(change => {
                reportHTML += `<li class="list-group-item"><strong>${change.objectName}</strong> mudou <em>${change.field}</em> de <span class="badge bg-secondary">${change.oldValue}</span> para <span class="badge bg-info text-dark">${change.newValue}</span>.</li>`;
            });
            reportHTML += '</ul>';
        } else {
            reportHTML += '<p class="mt-3">Nenhuma atualização encontrada nos dados dos objetos.</p>';
        }

        reportBody.innerHTML = reportHTML;
        reanalyzeReportModal.show();
    }

    function highlightChanges(changes) {
        // Obter os cabeçalhos visíveis a partir do DOM, já que eles refletem a ordem atual
        const headers = Array.from(tableHeadRow.querySelectorAll('th')).map(th => th.textContent);
    
        changes.forEach(change => {
            const colIndex = headers.indexOf(change.field);
    
            // Se a coluna da mudança estiver visível
            if (colIndex !== -1) {
                const row = tableBody.querySelector(`tr[data-object-name="${change.objectName}"]`);
                if (row) {
                    // O índice da célula (td) corresponde ao índice do cabeçalho (th)
                    const cell = row.querySelectorAll('td')[colIndex];
                    if (cell) {
                        cell.classList.add('cell-highlighted');
                    }
                }
            }
        });
    }
    
    function showLoading(show) { 
        const reanalyzeButton = reanalyzeForm.querySelector('button'); 
        if (show) { 
            document.body.classList.add('loading-active'); 
            if(reanalyzeButton) reanalyzeButton.disabled = true; 
        } else { 
            document.body.classList.remove('loading-active'); 
            if(reanalyzeButton) reanalyzeButton.disabled = false; 
        } 
    }

    function resetProgressBar() { 
        if (!progressTitle || !progressBarFill || !progressAsteroid) return; 
        progressTitle.textContent = 'Preparando reanálise...'; 
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
            
            tableHeadRow.innerHTML = '<th class="control-col"></th><th>N°</th>';
            headers.forEach(header => tableHeadRow.innerHTML += `<th>${header}</th>`);

            activeTableData.forEach((row, index) => {
                const tr = document.createElement('tr');
                tr.dataset.objectName = row['Objeto'];
                
                let rowHTML = `<td class="control-col"><span class="drag-handle"><i class="fas fa-grip-vertical"></i></span><input class="form-check-input row-checkbox" type="checkbox"></td><td>${index + 1}</td>`;
                
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
            appState.saved_tables[newName] = [];
            appState.active_table = newName;
            saveStateToLocalStorage();
            createModal.hide();
            newNameInput.value = '';
            renderPage();
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
        
        let csvContent = '\uFEFF' + '"N°";' + headers.join(';') + '\n';
        
        data.forEach((row, index) => {
            const rowNumber = index + 1;
            let rowValues = [rowNumber];

            headers.forEach(header => {
                let cell = row[header] ? String(row[header]) : '';
                cell = cell.replace(/"/g, '""');
                if (cell.includes(';') || cell.includes('"') || cell.includes('\n')) {
                    cell = `"${cell}"`;
                }
                rowValues.push(cell);
            });
            csvContent += rowValues.join(';') + '\n';
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
    
    renderPage();
});