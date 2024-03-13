document.addEventListener('DOMContentLoaded', function() {
    var toggleButtons = document.querySelectorAll('.toggle-btn');
    toggleButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            var target = this.getAttribute('data-target');
            var targetTable = document.getElementById('table-' + target);
            var otherTables = document.querySelectorAll('.table-responsive');
            otherTables.forEach(function(table) {
                if (table !== targetTable) {
                    table.style.display = 'none';
                }
            });
            targetTable.style.display = targetTable.style.display === 'none' ? 'block' : 'none';
        });
    });
});