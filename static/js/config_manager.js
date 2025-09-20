// static/js/config_manager.js (VERSÃO DINÂMICA E CORRIGIDA)

document.addEventListener('DOMContentLoaded', function () {
    const sortableList = document.getElementById('sortable-list');
    const columnOrderTextarea = document.getElementById('column_order_textarea');
    const checkboxes = document.querySelectorAll('.column-checkbox');

    // Inicializa a biblioteca de arrastar e soltar
    const sortable = new Sortable(sortableList, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        onEnd: function () {
            updateTextarea();
        }
    });

    // Função para atualizar o campo de texto escondido com a nova ordem
    function updateTextarea() {
        const orderedCols = Array.from(sortableList.querySelectorAll('li')).map(li => li.dataset.colName);
        columnOrderTextarea.value = orderedCols.join('\n');
    }

    // Função para criar um novo item para a lista de ordenação
    function createSortableItem(colName) {
        const li = document.createElement('li');
        li.className = 'list-group-item bg-dark';
        li.dataset.colName = colName;
        
        const icon = document.createElement('i');
        icon.className = 'fas fa-grip-vertical me-3 text-secondary';
        icon.title = 'Arraste para reordenar';
        
        li.appendChild(icon);
        li.appendChild(document.createTextNode(` ${colName}`));
        
        return li;
    }

    // ==================================================================
    // A LÓGICA DE CORREÇÃO ESTÁ AQUI
    // Adiciona um "ouvinte" a cada checkbox de visibilidade
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function (event) {
            const colName = event.target.value;
            const isChecked = event.target.checked;

            if (isChecked) {
                // Se marcou, adiciona o item na lista de ordenação
                const newItem = createSortableItem(colName);
                sortableList.appendChild(newItem);
            } else {
                // Se desmarcou, remove o item da lista de ordenação
                const itemToRemove = sortableList.querySelector(`li[data-col-name="${colName}"]`);
                if (itemToRemove) {
                    itemToRemove.remove();
                }
            }
            // Atualiza a ordem no campo de texto após qualquer mudança
            updateTextarea();
        });
    });
    // ==================================================================


    // Lógica para os botões "Selecionar Todas", "Nenhuma" e "Padrão"
    document.getElementById('select-all').addEventListener('click', () => {
        checkboxes.forEach(cb => {
            if (!cb.checked) {
                cb.checked = true;
                cb.dispatchEvent(new Event('change')); // Simula o clique para atualizar a lista
            }
        });
    });

    document.getElementById('select-none').addEventListener('click', () => {
        checkboxes.forEach(cb => {
            if (cb.checked) {
                cb.checked = false;
                cb.dispatchEvent(new Event('change')); // Simula o clique para atualizar a lista
            }
        });
    });

    document.getElementById('select-default').addEventListener('click', () => {
        checkboxes.forEach(cb => {
            const shouldBeChecked = DEFAULT_COLUMNS_FROM_FLASK.includes(cb.value);
            if (cb.checked !== shouldBeChecked) {
                cb.checked = shouldBeChecked;
                cb.dispatchEvent(new Event('change')); // Simula o clique para atualizar a lista
            }
        });
    });


    // Garante que o textarea tenha a ordem inicial correta ao carregar a página
    updateTextarea();
});