function initializeSettingsPage() {
    // Todo o seu código original agora vive dentro desta função.
    
    const visibilityContainer = document.getElementById('column-visibility-container');
    const sortableList = document.getElementById('sortable-list');
    const saveButton = document.getElementById('save-settings-btn');
    let sortableInstance = null;

    function renderSettings() {
        if (!visibilityContainer || !sortableList) {
            console.error("Elementos da página de configurações não foram encontrados!");
            return;
        }

        visibilityContainer.innerHTML = '';
        sortableList.innerHTML = '';

        const col1 = document.createElement('div');
        col1.className = 'col-md-6';
        const col2 = document.createElement('div');
        col2.className = 'col-md-6';

        ALL_COLUMNS.forEach((colName, index) => {
            const isChecked = appState.column_order.includes(colName);
            const wrapper = document.createElement('div');
            wrapper.className = 'form-check form-switch mb-2';
            wrapper.innerHTML = `
                <input class="form-check-input column-checkbox" type="checkbox" value="${colName}" id="col_${index}" ${isChecked ? 'checked' : ''}>
                <label class="form-check-label ms-2" for="col_${index}">${colName}</label>
            `;
            if (index < Math.ceil(ALL_COLUMNS.length / 2)) {
                col1.appendChild(wrapper);
            } else {
                col2.appendChild(wrapper);
            }
        });

        visibilityContainer.appendChild(col1);
        visibilityContainer.appendChild(col2);

        appState.column_order.forEach(colName => {
            const li = document.createElement('li');
            li.className = 'list-group-item bg-dark';
            li.dataset.colName = colName;
            li.innerHTML = `<i class="fas fa-grip-vertical me-3 text-secondary" title="Arraste para reordenar"></i> ${colName}`;
            sortableList.appendChild(li);
        });

        if (sortableInstance) sortableInstance.destroy();
        sortableInstance = new Sortable(sortableList, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag'
        });

        document.querySelectorAll('.column-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', updateSortableList);
        });
    }

    function updateSortableList() {
        const visibleColumns = new Set(
            Array.from(document.querySelectorAll('.column-checkbox:checked')).map(cb => cb.value)
        );

        sortableList.querySelectorAll('li').forEach(item => {
            if (!visibleColumns.has(item.dataset.colName)) {
                item.remove();
            }
        });

        visibleColumns.forEach(colName => {
            if (!sortableList.querySelector(`li[data-col-name="${colName}"]`)) {
                const li = document.createElement('li');
                li.className = 'list-group-item bg-dark';
                li.dataset.colName = colName;
                li.innerHTML = `<i class="fas fa-grip-vertical me-3 text-secondary" title="Arraste para reordenar"></i> ${colName}`;
                sortableList.appendChild(li);
            }
        });
    }

    document.getElementById('select-all').addEventListener('click', () => {
        document.querySelectorAll('.column-checkbox').forEach(cb => cb.checked = true);
        updateSortableList();
    });

    document.getElementById('select-none').addEventListener('click', () => {
        document.querySelectorAll('.column-checkbox').forEach(cb => cb.checked = false);
        updateSortableList();
    });

    document.getElementById('select-default').addEventListener('click', () => {
        document.querySelectorAll('.column-checkbox').forEach(cb => {
            cb.checked = DEFAULT_COLUMNS.includes(cb.value);
        });
        updateSortableList();
    });

    saveButton.addEventListener('click', () => {
        const newColumnOrder = Array.from(sortableList.querySelectorAll('li')).map(li => li.dataset.colName);
        appState.column_order = newColumnOrder;
        saveStateToLocalStorage();
        alert('Configurações salvas com sucesso!');
        renderSettings();
    });

    renderSettings();
}

// ========================================================================
// NOVO: REGISTA ESTE SCRIPT NA LISTA DE TAREFAS DO MAIN.JS
// ========================================================================
window.pageInitializers.push(initializeSettingsPage);