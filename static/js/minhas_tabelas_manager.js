document.addEventListener('DOMContentLoaded', function() {
    if (Sortable && Sortable.MultiDrag) {
        Sortable.mount(new Sortable.MultiDrag());
    } else {
        console.error("SortableJS MultiDrag plugin não foi encontrado.");
    }

    const tableBody = document.getElementById('table-body-sortable');
    const managementPanel = document.querySelector('.main-card');
    const contentCard = document.querySelector('.results-card');
    const scrollableContainer = document.querySelector('.table-responsive');
    let sortable = null;

    // --- MODO DE EXCLUSÃO ---
    const enableDeleteBtn = document.getElementById('enable-delete-mode');
    const deleteControls = document.getElementById('delete-controls');
    const cancelDeleteBtn = document.getElementById('cancel-delete-mode');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const deleteForm = document.getElementById('delete-rows-form');
    const deleteInput = document.getElementById('rows_to_delete_input');

    if(enableDeleteBtn) enableDeleteBtn.addEventListener('click', () => { enterMode('delete'); });
    if(cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => { exitAllModes(); });
    
    // --- MODO DE REORDENAÇÃO ---
    const enableReorderBtn = document.getElementById('reorder-rows-btn');
    const reorderControls = document.getElementById('reorder-controls');
    const saveReorderBtn = document.getElementById('save-reorder-btn');
    const cancelReorderBtn = document.getElementById('cancel-reorder-btn');

    if(enableReorderBtn) enableReorderBtn.addEventListener('click', () => { enterMode('reorder'); });
    if(cancelReorderBtn) cancelReorderBtn.addEventListener('click', () => { exitAllModes(true); });
    if(saveReorderBtn) saveReorderBtn.addEventListener('click', saveOrder);

    // --- LÓGICA DE CLIQUE NA TABELA ---
    if(tableBody) tableBody.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (!row) return;

        // Se o clique foi no ícone de arrastar, não fazemos nada com a seleção.
        // Apenas garantimos que a linha clicada seja a selecionada se nenhuma outra estiver.
        if (e.target.closest('.drag-handle')) {
            if (!row.classList.contains('selected')) {
                tableBody.querySelectorAll('tr.selected').forEach(selectedRow => {
                    selectedRow.classList.remove('selected');
                });
                row.classList.add('selected');
            }
            return;
        }

        if (tableBody.classList.contains('delete-mode')) {
            const checkbox = row.querySelector('.row-checkbox');
            if (e.target.tagName !== 'INPUT') checkbox.checked = !checkbox.checked;
            row.classList.toggle('selected', checkbox.checked);
            const selectedCount = tableBody.querySelectorAll('.row-checkbox:checked').length;
            if(confirmDeleteBtn) confirmDeleteBtn.disabled = (selectedCount === 0);
        }
        else if (tableBody.classList.contains('reorder-mode')) {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                row.classList.toggle('selected');
            } else {
                tableBody.querySelectorAll('tr.selected').forEach(selectedRow => {
                    selectedRow.classList.remove('selected');
                });
                row.classList.add('selected');
            }
        }
    });

    if(deleteForm) deleteForm.addEventListener('submit', function(e) {
        const selectedCheckboxes = tableBody.querySelectorAll('.row-checkbox:checked');
        const objectNames = Array.from(selectedCheckboxes).map(cb => cb.closest('tr').dataset.objectName);
        if (objectNames.length === 0 || !confirm(`Tem certeza que deseja excluir ${objectNames.length} linha(s)?`)) {
            e.preventDefault();
            return;
        }
        deleteInput.value = objectNames.join(',');
    });

    function enterMode(mode) {
        exitAllModes();
        if(managementPanel) managementPanel.classList.add('d-none');
        if(contentCard.querySelector('.results-header')) contentCard.querySelector('.results-header').classList.add('d-none');

        if (mode === 'delete') {
            tableBody.classList.add('delete-mode');
            if(deleteControls) deleteControls.classList.remove('d-none');
        } else if (mode === 'reorder') {
            tableBody.classList.add('reorder-mode');
            if(reorderControls) reorderControls.classList.remove('d-none');
            sortable = new Sortable(tableBody, { 
                handle: '.drag-handle',
                animation: 150, 
                ghostClass: 'sortable-ghost', 
                dragClass: 'sortable-drag',
                dataIdAttr: 'data-object-name',
                multiDrag: true,
                selectedClass: 'selected',
                scroll: true, 
                forceFallback: true,
                scrollable: scrollableContainer,
                scrollSensitivity: 70,
                scrollSpeed: 15
            });
        }
    }

    function exitAllModes(reload = false) {
        if(managementPanel) managementPanel.classList.remove('d-none');
        if(contentCard.querySelector('.results-header')) contentCard.querySelector('.results-header').classList.remove('d-none');
        tableBody.classList.remove('delete-mode', 'reorder-mode');
        if(deleteControls) deleteControls.classList.add('d-none');
        if(reorderControls) reorderControls.classList.add('d-none');
        tableBody.querySelectorAll('.row-checkbox:checked').forEach(cb => cb.checked = false);
        tableBody.querySelectorAll('tr.selected').forEach(row => row.classList.remove('selected'));
        if(confirmDeleteBtn) confirmDeleteBtn.disabled = true;
        if (sortable) sortable.destroy();
        sortable = null;
        if (reload) window.location.reload();
    }

    async function saveOrder() {
        if (!sortable) return;
        const newOrder = sortable.toArray();
        try {
            const response = await fetch('/reorder-rows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ new_order: newOrder }) });
            if (response.ok) { exitAllModes(true); } else { alert('Erro ao salvar a nova ordem.'); }
        } catch (error) { console.error('Fetch error:', error); alert('Erro de conexão ao salvar a nova ordem.'); }
    }
});