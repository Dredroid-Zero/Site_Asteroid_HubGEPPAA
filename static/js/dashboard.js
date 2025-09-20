// static/js/dashboard.js

document.addEventListener('DOMContentLoaded', function() {
    const toggleSidebarBtn = document.getElementById('toggleSidebar');
    const sidebar = document.getElementById('sidebar');

    if (toggleSidebarBtn && sidebar) {
        toggleSidebarBtn.addEventListener('click', function() {
            sidebar.classList.toggle('is-visible');
        });
    }

    // Opcional: Fechar a sidebar se clicar fora dela em modo mobile
    document.addEventListener('click', function(event) {
        if (sidebar && sidebar.classList.contains('is-visible')) {
            const isClickInsideSidebar = sidebar.contains(event.target);
            const isClickOnToggler = toggleSidebarBtn.contains(event.target);

            if (!isClickInsideSidebar && !isClickOnToggler) {
                sidebar.classList.remove('is-visible');
            }
        }
    });
});