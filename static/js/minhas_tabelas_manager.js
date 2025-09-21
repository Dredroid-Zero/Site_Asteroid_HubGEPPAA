document.addEventListener('DOMContentLoaded', function() {
    
    // --- LÓGICA DAS DICAS INTELIGENTES ---
    const manageAlert = document.getElementById('manage-tables-alert');
    const reanalyzeAlert = document.getElementById('reanalyze-alert');
    const reanalyzeButtonContainer = document.getElementById('reanalyze-button-container'); // O novo contêiner do botão

    // Função para mostrar a segunda dica e ativar o destaque
    function showReanalyzeTip() {
        if (reanalyzeAlert && localStorage.getItem('reanalyzeAlertDismissed') !== 'true') {
            reanalyzeAlert.classList.remove('d-none');
            if (reanalyzeButtonContainer) {
                reanalyzeButtonContainer.classList.add('reanalyze-highlight-active');
            }
        }
    }

    // Lógica para a primeira dica (Gerenciar)
    if (manageAlert) {
        if (localStorage.getItem('manageTablesAlertDismissed') === 'true') {
            manageAlert.classList.add('d-none');
        }
        manageAlert.addEventListener('close.bs.alert', function () {
            localStorage.setItem('manageTablesAlertDismissed', 'true');
            // Ao fechar a primeira, chama a função para mostrar a segunda
            showReanalyzeTip();
        });
    }

    // Lógica para a segunda dica (Reanalisar)
    if (reanalyzeAlert) {
        // Se a primeira dica já foi fechada no passado E a segunda ainda não foi, mostra a segunda
        if (localStorage.getItem('manageTablesAlertDismissed') === 'true' && localStorage.getItem('reanalyzeAlertDismissed') !== 'true') {
             showReanalyzeTip(); // Chama a função que também ativa o destaque
        }
        reanalyzeAlert.addEventListener('close.bs.alert', function () {
            localStorage.setItem('reanalyzeAlertDismissed', 'true');
            // Ao fechar a segunda dica, remove o destaque
            if (reanalyzeButtonContainer) {
                reanalyzeButtonContainer.classList.remove('reanalyze-highlight-active');
            }
        });
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

    // --- LÓGICA DE CLIQUE NA TABELA (SIMPLIFICADA) ---
    if(tableBody) tableBody.addEventListener('click', (e) => {
        if (tableBody.classList.contains('delete-mode')) {
            const row = e.target.closest('tr');
            if (!row) return;
            const checkbox = row.querySelector('.row-checkbox');
            if (e.target.tagName !== 'INPUT') checkbox.checked = !checkbox.checked;
            row.classList.toggle('selected', checkbox.checked);
            const selectedCount = tableBody.querySelectorAll('.row-checkbox:checked').length;
            if(confirmDeleteBtn) confirmDeleteBtn.disabled = (selectedCount === 0);
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

    // --- LÓGICA DA ANIMAÇÃO DE REANÁLISE ---
    const reanalyzeForm = document.getElementById('reanalyze-form');
    if (reanalyzeForm) {
        reanalyzeForm.addEventListener('submit', function() {
            const loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'flex';
            }
        });
    }
});