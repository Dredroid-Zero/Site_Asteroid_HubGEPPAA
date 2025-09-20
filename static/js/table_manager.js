// static/js/table_manager.js

document.addEventListener('DOMContentLoaded', function() {
    const tableWrapper = document.getElementById('main-table-wrapper');
    const table = tableWrapper ? tableWrapper.querySelector('table') : null;
    
    // Se não houver tabela na página, não executa o resto do código.
    if (!table) return;

    // --- Controles e Modos de Edição ---
    const enterDeleteBtn = document.getElementById('enter-delete-mode');
    const enterReorderBtn = document.getElementById('enter-reorder-mode');
    const cancelEditBtn = document.getElementById('cancel-edit-mode');
    const editButtonsDiv = document.getElementById('edit-buttons');
    const deleteForm = document.getElementById('delete-form');
    const reorderForm = document.getElementById('reorder-form');
    
    let sortableInstance = null;
    let rowsToDelete = new Set();

    function enterEditMode() {
        enterDeleteBtn.style.display = 'none';
        enterReorderBtn.style.display = 'none';
        editButtonsDiv.style.display = 'block';
    }

    // --- Modo de Exclusão ---
    if (enterDeleteBtn) {
        enterDeleteBtn.addEventListener('click', function() {
            enterEditMode();
            deleteForm.style.display = 'inline-block';
            
            // Adiciona uma célula de ação em cada linha para o botão de deletar
            table.querySelectorAll('tbody tr').forEach(row => {
                // Usamos o primeiro campo da linha como identificador do objeto.
                const objectName = row.cells[0].textContent.trim();
                const actionCell = row.insertCell(0); // Insere a célula no início da linha
                actionCell.classList.add('action-cell-delete');
                
                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
                deleteBtn.className = 'btn btn-danger btn-sm rounded-pill';
                deleteBtn.title = 'Marcar para exclusão';
                
                deleteBtn.onclick = () => {
                    if (rowsToDelete.has(objectName)) {
                        rowsToDelete.delete(objectName);
                        row.classList.remove('row-marked-for-deletion');
                        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
                        deleteBtn.classList.replace('btn-outline-warning', 'btn-danger');
                        deleteBtn.title = 'Marcar para exclusão';
                    } else {
                        rowsToDelete.add(objectName);
                        row.classList.add('row-marked-for-deletion');
                        deleteBtn.innerHTML = '<i class="fas fa-undo"></i>';
                        deleteBtn.classList.replace('btn-danger', 'btn-outline-warning');
                        deleteBtn.title = 'Cancelar exclusão';
                    }
                };
                actionCell.appendChild(deleteBtn);
            });
            
            // Adiciona o cabeçalho para a nova coluna
            const headerRow = table.querySelector('thead tr');
            if (headerRow) {
                const th = document.createElement('th');
                th.innerHTML = '<i class="fas fa-trash-alt"></i> Excluir';
                th.classList.add('action-header-delete');
                headerRow.insertBefore(th, headerRow.firstChild);
            }
        });
    }

    // --- Modo de Reordenação ---
    if (enterReorderBtn) {
        enterReorderBtn.addEventListener('click', function() {
            enterEditMode();
            reorderForm.style.display = 'inline-block';

            const tbody = table.querySelector('tbody');
            sortableInstance = new Sortable(tbody, {
                animation: 150,
                handle: '.reorder-handle',
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
            });
            
            // Adiciona a alça de reordenação em cada linha
            table.querySelectorAll('tbody tr').forEach(row => {
                const actionCell = row.insertCell(0);
                actionCell.classList.add('action-cell-reorder');
                actionCell.innerHTML = '<span class="reorder-handle"><i class="fas fa-grip-vertical"></i></span>';
            });
            
            // Adiciona o cabeçalho para a nova coluna
            const headerRow = table.querySelector('thead tr');
            if (headerRow) {
                const th = document.createElement('th');
                th.innerHTML = '<i class="fas fa-arrows-alt"></i> Mover';
                th.classList.add('action-header-reorder');
                headerRow.insertBefore(th, headerRow.firstChild);
            }
        });
    }

    // --- Cancelar Modo de Edição ---
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            // Simplesmente recarrega a página para reverter todas as mudanças visuais.
            // É a forma mais simples e robusta de garantir o estado original.
            window.location.reload();
        });
    }

    // --- Submissão dos Formulários de Edição ---
    if (deleteForm) {
        deleteForm.addEventListener('submit', () => {
            document.getElementById('objects_to_delete').value = Array.from(rowsToDelete).join(',');
        });
    }

    if (reorderForm) {
        reorderForm.addEventListener('submit', () => {
            const orderedObjects = Array.from(table.querySelectorAll('tbody tr')).map(row => {
                // Assume que o nome do objeto está na segunda célula após a célula de ação
                return row.cells[1].textContent.trim();
            });
            document.getElementById('ordered_objects').value = orderedObjects.join(',');
        });
    }
});

// --- Função Global para Exportar a Tabela para CSV ---
function exportTable() {
    const activeTableName = document.querySelector('h3 > .active-table-name')?.textContent || 'tabela';
    const table = document.querySelector('#main-table-wrapper table');
    if (!table) return;
    
    let csv = [];
    const rows = table.querySelectorAll('tr');
    
    for (const row of rows) {
        const rowData = [];
        const cols = row.querySelectorAll('th, td');
        for (const col of cols) {
            // Limpa o texto para remover espaços extras e quebras de linha
            let data = col.innerText.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s\s+/g, ' ').trim();
            // Escapa aspas duplas
            data = data.replace(/"/g, '""');
            rowData.push(`"${data}"`);
        }
        csv.push(rowData.join(','));
    }
    
    const csvContent = "data:text/csv;charset=utf-8," + csv.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${activeTableName.trim()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}