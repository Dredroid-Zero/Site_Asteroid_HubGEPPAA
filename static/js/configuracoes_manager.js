document.addEventListener('DOMContentLoaded', function() {
    // Elementos da página
    const visibilityContainer = document.getElementById('column-visibility-container');
    const sortableList = document.getElementById('sortable-list');
    const saveButton = document.getElementById('save-settings-btn');
    let sortableInstance = null;

    /**
     * Função principal que desenha a página com base no appState
     */
    function renderSettings() {
        // 1. Limpa os contentores
        visibilityContainer.innerHTML = '';
        sortableList.innerHTML = '';

        // Cria duas colunas para os checkboxes
        const col1 = document.createElement('div');
        col1.className = 'col-md-6';
        const col2 = document.createElement('div');
        col2.className = 'col-md-6';

        // 2. Preenche a lista de checkboxes de visibilidade
        ALL_COLUMNS.forEach((colName, index) => {
            const isChecked = appState.visible_columns.includes(colName);
            
            const wrapper = document.createElement('div');
            wrapper.className = 'form-check form-switch mb-2';
            wrapper.innerHTML = `
                <input class="form-check-input column-checkbox" type="checkbox" value="${colName}" id="col_${index}" ${isChecked ? 'checked' : ''}>
                <label class="form-check-label ms-2" for="col_${index}">${colName}</label>
            `;
            // Adiciona na primeira ou segunda coluna
            if (index < Math.ceil(ALL_COLUMNS.length / 2)) {
                col1.appendChild(wrapper);
            } else {
                col2.appendChild(wrapper);
            }
        });

        visibilityContainer.appendChild(col1);
        visibilityContainer.appendChild(col2);

        // 3. Preenche a lista de ordenação
        appState.column_order.forEach(colName => {
            const li = document.createElement('li');
            li.className = 'list-group-item bg-dark';
            li.dataset.colName = colName;
            li.innerHTML = `<i class="fas fa-grip-vertical me-3 text-secondary" title="Arraste para reordenar"></i> ${colName}`;
            sortableList.appendChild(li);
        });

        // Inicializa (ou reinicializa) o SortableJS
        if (sortableInstance) sortableInstance.destroy();
        sortableInstance = new Sortable(sortableList, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag'
        });

        // Adiciona os event listeners aos novos checkboxes
        document.querySelectorAll('.column-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', updateSortableList);
        });
    }

    /**
     * Atualiza a lista de arrastar quando um checkbox é (des)marcado
     */
    function updateSortableList() {
        const visibleColumns = new Set(
            Array.from(document.querySelectorAll('.column-checkbox:checked')).map(cb => cb.value)
        );

        // Remove itens que não estão mais visíveis
        sortableList.querySelectorAll('li').forEach(item => {
            if (!visibleColumns.has(item.dataset.colName)) {
                item.remove();
            }
        });

        // Adiciona itens que se tornaram visíveis
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

    // --- EVENT LISTENERS PARA OS BOTÕES ---
    
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
        // 1. Pega as colunas visíveis
        const newVisibleColumns = Array.from(document.querySelectorAll('.column-checkbox:checked')).map(cb => cb.value);

        // 2. Pega a nova ordem
        const newColumnOrder = Array.from(sortableList.querySelectorAll('li')).map(li => li.dataset.colName);

        // 3. Atualiza o estado da aplicação
        appState.visible_columns = newVisibleColumns;
        appState.column_order = newColumnOrder;

        // 4. Salva no Local Storage
        saveStateToLocalStorage();

        // 5. Dá um feedback visual
        alert('Configurações salvas com sucesso!');
    });

    // Chama a função para desenhar a página quando ela carregar
    renderSettings();
});