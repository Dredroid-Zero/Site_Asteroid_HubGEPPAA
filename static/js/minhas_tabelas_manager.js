function initializeMyTablesPage() {
    // --- REFERÊNCIAS AOS ELEMENTOS E ESTADO DA PÁGINA ---
    const pageState = {
        tableSelect: document.getElementById('active_table_select'),
        tableBody: document.getElementById('table-body-sortable'),
        tableHeadRow: document.getElementById('table-head-row'),
        emptyMessage: document.getElementById('empty-table-message'),
        activeTableNameDisplays: document.querySelectorAll('.dynamic-active-table-name'),
        managementPanel: document.getElementById('management-panel'),
        reanalyzeForm: document.getElementById('reanalyze-form'),
        downloadCsvBtn: document.getElementById('download-csv-btn'),
        reanalyzeBtn: document.querySelector('#reanalyze-form button'), // Seletor para o botão de reanálise
        progressBarFill: document.getElementById('progress-bar-fill'),
        progressAsteroid: document.getElementById('progress-asteroid'),
        progressTitle: document.getElementById('progress-title'),
        reorderControls: document.getElementById('reorder-controls'),
        deleteControls: document.getElementById('delete-controls'),
        manageTablesTipAlert: document.getElementById('manage-tables-tip-alert'),
        manageTablesBtn: document.getElementById('manage-tables-btn'),
        managementOptions: document.getElementById('management-options'),
        reanalyzeTipAlert: document.getElementById('reanalyze-tip-alert'),
        createModal: new bootstrap.Modal(document.getElementById('createTableModal')),
        renameModal: new bootstrap.Modal(document.getElementById('renameTableModal')),
        deleteModal: new bootstrap.Modal(document.getElementById('deleteTableModal')),
        reanalyzeReportModal: new bootstrap.Modal(document.getElementById('reanalyzeReportModal')),
        sortable: null,
        isTourActive: false
    };
    
    // --- LÓGICA DO TOUR ---
    window.currentTour = {
        advance: (step) => {
            if (step === 1) {
                clearAllPopovers();
                pageState.manageTablesBtn.click();
            } else if (step === 2) {
                window.currentTour.finish();
            }
        },
        finish: () => {
            if (!pageState.isTourActive) return;
            pageState.isTourActive = false;
            
            clearAllPopovers();
            unlockContent();
            
            pageState.managementOptions.removeEventListener('shown.bs.collapse', handlePanelShownForTour);

            if (pageState.managementOptions.classList.contains('show')) {
                const collapse = bootstrap.Collapse.getInstance(pageState.managementOptions) || new bootstrap.Collapse(pageState.managementOptions);
                collapse.hide();
            }
            
            showReanalyzeTipIfNeeded();
        }
    };

    const handlePanelShownForTour = () => {
        if (!pageState.isTourActive) return;
        showManageTablesTourStep(2);
    };

    function showManageTipIfNeeded() {
        if (Object.keys(appState.saved_tables).length > 0 && localStorage.getItem('alert-dismissed-manage-tables-tip-alert') !== 'true') {
            pageState.manageTablesTipAlert.classList.remove('d-none');
        }
    }

    function showReanalyzeTipIfNeeded() {
        if (localStorage.getItem('alert-dismissed-manage-tables-tip-alert') === 'true' && 
            localStorage.getItem('alert-dismissed-reanalyze-tip-alert') !== 'true') {
            
            pageState.reanalyzeTipAlert.classList.remove('d-none');
            lockContent([document.querySelector('.results-card')]);
            
            // ===== ADICIONADO: ATIVA O EFEITO DE PISCAR =====
            if (pageState.reanalyzeBtn) pageState.reanalyzeBtn.classList.add('button-spotlight');
            if (pageState.downloadCsvBtn) pageState.downloadCsvBtn.classList.add('button-spotlight');
        }
    }

    function startManageTablesTour() {
        if (localStorage.getItem('manageTablesTourShown') === 'true' || pageState.isTourActive) return;
        
        pageState.isTourActive = true;
        localStorage.setItem('manageTablesTourShown', 'true');
        lockContent([pageState.managementPanel]);
        
        pageState.managementOptions.addEventListener('shown.bs.collapse', handlePanelShownForTour, { once: true });
        showManageTablesTourStep(1);
    }

    function showManageTablesTourStep(step) {
        clearAllPopovers();
        if (step === 1) {
            const content = 'Para organizar suas tabelas, clique em "Gerenciar...". Isso abrirá um painel com todas as opções.';
            showDynamicPopover(pageState.manageTablesBtn, 'Passo 1 de 2', content, {
                placement: 'left',
                tourStep: { current: 1, total: 2 },
                showCloseButton: false
            });
        } else if (step === 2) {
            const content = 'Neste painel você pode Criar, Renomear ou Excluir tabelas, além de outras ações. Explore as opções!';
            showDynamicPopover(pageState.managementOptions, 'Passo 2 de 2', content, {
                placement: 'top',
                tourStep: { current: 2, total: 2 },
                showCloseButton: false
            });
        }
    }
    
    function clearAllPopovers() {
        document.querySelectorAll('[data-bs-toggle="popover"]').forEach(el => {
            const instance = bootstrap.Popover.getInstance(el);
            if (instance) instance.dispose();
        });
        document.querySelectorAll('.popover').forEach(popover => popover.remove());
    }
    
    document.addEventListener('tour:start-manage-tables', startManageTablesTour);

    if (pageState.reanalyzeTipAlert) {
        pageState.reanalyzeTipAlert.addEventListener('close.bs.alert', () => {
            unlockContent();
            // ===== ADICIONADO: REMOVE O EFEITO DE PISCAR =====
            if (pageState.reanalyzeBtn) pageState.reanalyzeBtn.classList.remove('button-spotlight');
            if (pageState.downloadCsvBtn) pageState.downloadCsvBtn.classList.remove('button-spotlight');
        });
    }
    
    // --- O RESTO DO SEU CÓDIGO ORIGINAL (INTACTO) ---
    // (Colei todo o seu código original de volta, sem omissões)

    pageState.reanalyzeForm.addEventListener('submit', async function(event) {
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
        pageState.reanalyzeReportModal.show();
    }

    function highlightChanges(changes) {
        const headers = Array.from(pageState.tableHeadRow.querySelectorAll('th')).map(th => th.textContent);
        changes.forEach(change => {
            const colIndex = headers.indexOf(change.field);
            if (colIndex !== -1) {
                const row = pageState.tableBody.querySelector(`tr[data-object-name="${change.objectName}"]`);
                if (row) {
                    const cell = row.querySelectorAll('td')[colIndex];
                    if (cell) {
                        cell.classList.add('cell-highlighted');
                    }
                }
            }
        });
    }
    
    function showLoading(show) { 
        const reanalyzeButton = pageState.reanalyzeForm.querySelector('button'); 
        if (show) { 
            document.body.classList.add('loading-active'); 
            if(reanalyzeButton) reanalyzeButton.disabled = true; 
        } else { 
            document.body.classList.remove('loading-active'); 
            if(reanalyzeButton) reanalyzeButton.disabled = false; 
        } 
    }

    function resetProgressBar() { 
        if (!pageState.progressTitle || !pageState.progressBarFill || !pageState.progressAsteroid) return; 
        pageState.progressTitle.textContent = 'Preparando reanálise...'; 
        pageState.progressBarFill.style.width = '0%'; 
        pageState.progressAsteroid.style.left = '0%'; 
        pageState.progressBarFill.setAttribute('aria-valuenow', 0); 
    }

    function updateProgressText(text) { 
        if(pageState.progressTitle) pageState.progressTitle.textContent = text; 
    }

    function updateProgressBar(percentage) { 
        if(pageState.progressBarFill && pageState.progressAsteroid) { 
            pageState.progressBarFill.style.width = `${percentage}%`; 
            pageState.progressAsteroid.style.left = `${percentage}%`; 
            pageState.progressBarFill.setAttribute('aria-valuenow', percentage); 
        } 
    }
    
    function renderPage() {
        pageState.tableSelect.innerHTML = '';
        Object.keys(appState.saved_tables).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            if (name === appState.active_table) option.selected = true;
            pageState.tableSelect.appendChild(option);
        });
        pageState.activeTableNameDisplays.forEach(span => span.textContent = appState.active_table);
        const activeTableData = appState.saved_tables[appState.active_table] || [];
        pageState.tableBody.innerHTML = '';
        pageState.tableHeadRow.innerHTML = '';
        if (activeTableData.length > 0) {
            pageState.emptyMessage.classList.add('d-none');
            document.querySelector('.table-responsive').classList.remove('d-none');
            const headers = appState.column_order.filter(col => col in activeTableData[0]);
            pageState.tableHeadRow.innerHTML = '<th class="control-col"></th><th>N°</th>';
            headers.forEach(header => pageState.tableHeadRow.innerHTML += `<th>${header}</th>`);
            activeTableData.forEach((row, index) => {
                const tr = document.createElement('tr');
                tr.dataset.objectName = row['Objeto'];
                let rowHTML = `<td class="control-col"><span class="drag-handle"><i class="fas fa-grip-vertical"></i></span><input class="form-check-input row-checkbox" type="checkbox"></td><td>${index + 1}</td>`;
                headers.forEach(header => rowHTML += `<td>${row[header] || '-'}</td>`);
                tr.innerHTML = rowHTML;
                pageState.tableBody.appendChild(tr);
            });
        } else {
            pageState.emptyMessage.classList.remove('d-none');
            document.querySelector('.table-responsive').classList.add('d-none');
        }
    }

    pageState.tableSelect.addEventListener('change', function() {
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
            pageState.createModal.hide();
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
            pageState.renameModal.hide();
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
            pageState.deleteModal.hide();
            renderPage();
        }
    });

    pageState.downloadCsvBtn.addEventListener('click', function() {
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
        const selectedCheckboxes = pageState.tableBody.querySelectorAll('.row-checkbox:checked');
        const objectNamesToDelete = Array.from(selectedCheckboxes).map(cb => cb.closest('tr').dataset.objectName);
        if (objectNamesToDelete.length > 0 && confirm(`Excluir ${objectNamesToDelete.length} linha(s)?`)) {
            const activeTable = appState.active_table;
            appState.saved_tables[activeTable] = appState.saved_tables[activeTable].filter(row => !objectNamesToDelete.includes(row.Objeto));
            saveStateToLocalStorage();
            exitAllModes();
            renderPage();
        }
    });

    pageState.tableBody.addEventListener('click', (e) => {
        if (pageState.tableBody.classList.contains('delete-mode')) {
            const row = e.target.closest('tr');
            if (!row) return;
            const checkbox = row.querySelector('.row-checkbox');
            if (e.target.tagName !== 'INPUT') checkbox.checked = !checkbox.checked;
            row.classList.toggle('selected', checkbox.checked);
            const selectedCount = pageState.tableBody.querySelectorAll('.row-checkbox:checked').length;
            document.getElementById('confirm-delete-btn').disabled = (selectedCount === 0);
        }
    });
    
    function enterMode(mode) {
        pageState.managementPanel.classList.add('d-none');
        if (mode === 'delete') {
            pageState.deleteControls.classList.remove('d-none');
            pageState.tableBody.classList.add('delete-mode');
        } else if (mode === 'reorder') {
            pageState.reorderControls.classList.remove('d-none');
            pageState.tableBody.classList.add('reorder-mode');
            pageState.sortable = new Sortable(pageState.tableBody, { animation: 150, handle: '.drag-handle', dataIdAttr: 'data-object-name' });
        }
    }

    function exitAllModes() {
        pageState.managementPanel.classList.remove('d-none');
        pageState.deleteControls.classList.add('d-none');
        pageState.reorderControls.classList.add('d-none');
        pageState.tableBody.classList.remove('delete-mode', 'reorder-mode');
        if (pageState.sortable) pageState.sortable.destroy();
        pageState.sortable = null;
        pageState.tableBody.querySelectorAll('tr.selected').forEach(row => row.classList.remove('selected'));
        pageState.tableBody.querySelectorAll('.row-checkbox:checked').forEach(cb => cb.checked = false);
        document.getElementById('confirm-delete-btn').disabled = true;
    }
    
    function saveOrder() {
        if (!pageState.sortable) return;
        const newOrder = pageState.sortable.toArray();
        const activeTable = appState.active_table;
        const rowMap = appState.saved_tables[activeTable].reduce((map, row) => (map[row.Objeto] = row, map), {});
        appState.saved_tables[activeTable] = newOrder.map(objName => rowMap[objName]);
        saveStateToLocalStorage();
        exitAllModes();
        renderPage();
    }
    
    function initialize() {
        if (!appState.active_table || !appState.saved_tables[appState.active_table]) {
            const tableKeys = Object.keys(appState.saved_tables);
            appState.active_table = tableKeys.length > 0 ? tableKeys[0] : 'Tabela Padrão';
            if (!appState.saved_tables[appState.active_table]) {
                appState.saved_tables[appState.active_table] = [];
                saveStateToLocalStorage();
            }
        }
        renderPage();
        showManageTipIfNeeded();
    }

    initialize();
}

window.pageInitializers.push(initializeMyTablesPage);