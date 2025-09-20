// static/js/search_manager.js (VERSÃO COM DICA INTELIGENTE)

document.addEventListener('DOMContentLoaded', function() {
    
    // --- NOVO: LÓGICA DA DICA DISPENSÁVEL ---
    const configAlert = document.getElementById('config-alert');
    if (configAlert) {
        // Verifica se o usuário já dispensou o alerta antes
        if (localStorage.getItem('configAlertDismissed') === 'true') {
            configAlert.classList.add('d-none'); // Esconde o alerta se já foi dispensado
        }

        // Quando o alerta for fechado, salva essa informação
        configAlert.addEventListener('close.bs.alert', function () {
            localStorage.setItem('configAlertDismissed', 'true');
        });
    }

    // --- O RESTO DO CÓDIGO CONTINUA O MESMO ---

    // Lógica da barra de progresso
    const searchForm = document.getElementById('search-form');
    if (searchForm) {
        searchForm.addEventListener('submit', function(e) { if (!this.checkValidity()) return; runProgressBarAnimation(); });
    }

    // Lógica do modo de seleção de linhas
    const initialSaveButtons = document.getElementById('initial-save-buttons');
    const enableSelectModeBtn = document.getElementById('enable-select-mode');
    const selectionControls = document.getElementById('selection-controls');
    const cancelSelectModeBtn = document.getElementById('cancel-select-mode');
    const resultsTable = document.querySelector('.results-card table');
    const resultsTableBody = document.getElementById('results-tbody');
    const selectedObjectsInput = document.getElementById('selected_objects_input');
    const selectForm = document.getElementById('select-form');
    const instructionText = document.getElementById('selection-instruction');
    const saveSelectedBtn = document.getElementById('save-selected-btn');

    if (enableSelectModeBtn) {
        enableSelectModeBtn.addEventListener('click', () => {
            initialSaveButtons.classList.add('d-none');
            initialSaveButtons.classList.remove('d-flex');
            selectionControls.classList.add('d-flex');
            selectionControls.classList.remove('d-none');
            resultsTable.classList.add('selection-mode');
            instructionText.classList.remove('d-none');
        });
    }

    if (cancelSelectModeBtn) {
        cancelSelectModeBtn.addEventListener('click', () => {
            initialSaveButtons.classList.add('d-flex');
            initialSaveButtons.classList.remove('d-none');
            selectionControls.classList.add('d-none');
            selectionControls.classList.remove('d-flex');
            resultsTable.classList.remove('selection-mode');
            instructionText.classList.add('d-none');
            if (resultsTableBody) {
                resultsTableBody.querySelectorAll('tr.selected').forEach(row => {
                    row.classList.remove('selected');
                    const checkbox = row.querySelector('.row-checkbox');
                    if (checkbox) checkbox.checked = false;
                });
            }
            if (saveSelectedBtn) { saveSelectedBtn.disabled = true; }
        });
    }

    if (resultsTableBody) {
        resultsTableBody.addEventListener('click', (e) => {
            if (resultsTable.classList.contains('selection-mode')) {
                const row = e.target.closest('tr');
                if (!row) return;
                const checkbox = row.querySelector('.row-checkbox');
                if (!checkbox) return;
                if (e.target.tagName !== 'INPUT') { checkbox.checked = !checkbox.checked; }
                row.classList.toggle('selected', checkbox.checked);
                const selectedCount = resultsTableBody.querySelectorAll('.row-checkbox:checked').length;
                saveSelectedBtn.disabled = (selectedCount === 0);
            }
        });
    }

    if (selectForm) {
        selectForm.addEventListener('submit', function(e) {
            const checkedBoxes = resultsTableBody.querySelectorAll('.row-checkbox:checked');
            const selectedObjectNames = Array.from(checkedBoxes).map(box => box.closest('tr').dataset.objectName);
            if (selectedObjectNames.length === 0) { alert('Por favor, selecione pelo menos uma linha para salvar.'); e.preventDefault(); return; }
            selectedObjectsInput.value = selectedObjectNames.join(',');
        });
    }

    const tableSelect = document.getElementById('table-select');
    if (tableSelect) {
        const syncTableValue = (value) => { document.querySelectorAll('.table-dest-input').forEach(input => { input.value = value; }); };
        tableSelect.addEventListener('change', (e) => syncTableValue(e.target.value));
        syncTableValue(tableSelect.value);
    }
});

// --- FUNÇÃO DA ANIMAÇÃO DA BARRA DE PROGRESSO (sem alterações) ---
function runProgressBarAnimation() {
    const DURATION_NORMAL_CHUNK_MS = 2000;
    const DURATION_LAST_CHUNK_MS = 5000;
    const CHUNK_SIZE = 25;
    const loadingOverlay = document.getElementById('loadingOverlay');
    const progressBar = document.getElementById('progress-bar');
    const asteroidIcon = document.getElementById('asteroid-icon');
    const progressChunksText = document.getElementById('progress-chunks');
    const textarea = document.getElementById('identificadores');
    const totalAsteroids = textarea.value.trim().split('\n').filter(line => line.trim() !== '').length;
    if (totalAsteroids === 0) return;
    const totalChunks = Math.ceil(totalAsteroids / CHUNK_SIZE);
    loadingOverlay.style.display = 'flex';
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    function animateSingleBar(duration) {
        return new Promise(resolve => {
            let start = null;
            function step(timestamp) {
                if (!start) start = timestamp;
                let progress = (timestamp - start) / duration;
                if (progress >= 1) progress = 1;
                const percentage = progress * 100;
                progressBar.style.width = percentage + '%';
                asteroidIcon.style.left = percentage + '%';
                if (progress < 1) { requestAnimationFrame(step); } 
                else { progressBar.style.width = '100%'; asteroidIcon.style.left = '100%'; resolve(); }
            }
            requestAnimationFrame(step);
        });
    }
    async function runChunkAnimation() {
        for (let i = 1; i <= totalChunks; i++) {
            progressChunksText.textContent = `Analisando bloco ${i} de ${totalChunks}...`;
            if (i > 1) {
                progressBar.style.transition = 'none';
                asteroidIcon.style.transition = 'none';
                progressBar.style.width = '0%';
                asteroidIcon.style.left = '0%';
                await sleep(50);
            }
            const isLastChunk = (i === totalChunks);
            const currentDuration = isLastChunk ? DURATION_LAST_CHUNK_MS : DURATION_NORMAL_CHUNK_MS;
            const durationInSeconds = currentDuration / 1000;
            progressBar.style.transition = `width ${durationInSeconds}s linear`;
            asteroidIcon.style.transition = `left ${durationInSeconds}s linear`;
            await animateSingleBar(currentDuration);
            if (!isLastChunk) { await sleep(200); }
        }
        progressChunksText.textContent = 'Finalizando e montando a tabela...';
    }
    runChunkAnimation();
}