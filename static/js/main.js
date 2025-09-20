// static/js/main.js

document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('search-form');
    const loadingOverlay = document.getElementById('loading-overlay');

    // --- Loading overlay e feedback do botão para a busca principal ---
    if (searchForm) {
        searchForm.addEventListener('submit', function() {
            loadingOverlay.style.display = 'flex';
            const submitButton = searchForm.querySelector('button[type="submit"]');
            if(submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
            }
        });
    }

    // --- Lógica para o modo de seleção individual ---
    const enableAddModeBtn = document.getElementById('enable-add-mode');
    const initialControls = document.getElementById('initial-add-controls');
    const addControlsDiv = document.getElementById('add-controls');
    const cancelAddBtn = document.getElementById('cancel-add-mode');
    const addForm = document.getElementById('add-form');
    const objectsToAddInput = document.getElementById('objects_to_add_input');
    const actionCols = document.querySelectorAll('.action-col');
    const addButtons = document.querySelectorAll('.add-btn');

    let objectsToAdd = new Set();

    if (enableAddModeBtn) {
        enableAddModeBtn.addEventListener('click', function() {
            initialControls.classList.add('hidden');
            addControlsDiv.classList.remove('hidden');
            actionCols.forEach(col => col.classList.remove('hidden'));
        });
    }
    
    // --- Lógica de Cancelamento Aprimorada ---
    if (cancelAddBtn) {
        cancelAddBtn.addEventListener('click', function() {
            addControlsDiv.classList.add('hidden');
            initialControls.classList.remove('hidden');
            actionCols.forEach(col => col.classList.add('hidden'));

            objectsToAdd.clear();
            addButtons.forEach(button => {
                button.innerHTML = '<i class="fas fa-plus"></i>';
                button.classList.remove('btn-warning');
                button.classList.add('btn-success');
            });
            document.querySelectorAll('tr.table-warning').forEach(row => {
                row.classList.remove('table-warning');
                row.style.backgroundColor = '';
            });
        });
    }

    // --- Lógica para seleção de cada linha ---
    addButtons.forEach(button => {
        button.addEventListener('click', function() {
            const row = this.closest('tr');
            const objectName = row.dataset.objectName;

            if (objectsToAdd.has(objectName)) {
                objectsToAdd.delete(objectName);
                this.innerHTML = '<i class="fas fa-plus"></i>';
                this.classList.replace('btn-warning', 'btn-success');
                row.classList.remove('table-warning');
                row.style.backgroundColor = '';
            } else {
                objectsToAdd.add(objectName);
                this.innerHTML = '<i class="fas fa-check"></i>';
                this.classList.replace('btn-success', 'btn-warning');
                row.classList.add('table-warning');
                row.style.backgroundColor = 'rgba(255, 193, 7, 0.2)';
            }
        });
    });

    // --- Submissão da seleção individual e dos formulários de salvar todos ---
    function setupFormSubmission(formId, inputId) {
        const form = document.getElementById(formId);
        if (form) {
            form.addEventListener('submit', function() {
                if (inputId) {
                     document.getElementById(inputId).value = Array.from(objectsToAdd).join(',');
                }
                loadingOverlay.style.display = 'flex';
            });
        }
    }
    setupFormSubmission('add-form', 'objects_to_add_input');
    setupFormSubmission('add-all-form');

    // --- Auto-esconder notificações ---
    document.querySelectorAll('.alert').forEach(alert => {
        setTimeout(() => {
            let bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }, 5000);
    });
});