document.addEventListener('DOMContentLoaded', function () {
    const sortableList = document.getElementById('sortable-list');
    const columnOrderTextarea = document.getElementById('column_order_textarea');
    const checkboxes = document.querySelectorAll('.column-checkbox');
    const form = document.querySelector('form');

    if (!sortableList || !columnOrderTextarea || !form) {
        console.error("Elementos essenciais para as configurações não foram encontrados.");
        return;
    }

    const sortable = new Sortable(sortableList, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag'
    });

    function updateSortableListFromCheckboxes() {
        const currentlyVisible = new Set();
        const orderedVisibleColumns = [];

        // Pega a ordem atual da lista arrastável
        sortableList.querySelectorAll('li').forEach(item => {
            currentlyVisible.add(item.dataset.colName);
        });

        // Adiciona novos itens que foram marcados
        checkboxes.forEach(cb => {
            if (cb.checked && !currentlyVisible.has(cb.value)) {
                const newItem = createSortableItem(cb.value);
                sortableList.appendChild(newItem);
            }
        });

        // Remove itens que foram desmarcados
        sortableList.querySelectorAll('li').forEach(item => {
            const colName = item.dataset.colName;
            const correspondingCheckbox = document.querySelector(`.column-checkbox[value="${colName}"]`);
            if (!correspondingCheckbox || !correspondingCheckbox.checked) {
                item.remove();
            }
        });
    }

    function createSortableItem(colName) {
        const li = document.createElement('li');
        li.className = 'list-group-item bg-dark';
        li.dataset.colName = colName;
        li.innerHTML = `<i class="fas fa-grip-vertical me-3 text-secondary" title="Arraste para reordenar"></i> ${colName}`;
        return li;
    }
    
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateSortableListFromCheckboxes);
    });

    document.getElementById('select-all')?.addEventListener('click', () => {
        checkboxes.forEach(cb => { cb.checked = true; });
        updateSortableListFromCheckboxes();
    });

    document.getElementById('select-none')?.addEventListener('click', () => {
        checkboxes.forEach(cb => { cb.checked = false; });
        updateSortableListFromCheckboxes();
    });

    document.getElementById('select-default')?.addEventListener('click', () => {
        checkboxes.forEach(cb => {
            cb.checked = DEFAULT_COLUMNS_FROM_FLASK.includes(cb.value);
        });
        updateSortableListFromCheckboxes();
    });

    form.addEventListener('submit', function () {
        const orderedCols = Array.from(sortableList.querySelectorAll('li')).map(li => li.dataset.colName);
        columnOrderTextarea.value = orderedCols.join('\n');
    });
});