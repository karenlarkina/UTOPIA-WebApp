// Old version
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
    // initialize components
    generateMaterialProperties()
});

function toggleOptions(container_id) {
    // Get all toggle containers
    var containers = document.querySelectorAll('.toggle_container');

    // Get the selected container
    var selectedContainer = document.getElementById(container_id);

    // Check if the selected container is already visible
    var isSelectedContainerVisible = (selectedContainer.style.display === "flex");

    // Hide all elements in all toggle containers if the same container is clicked twice
    if (isSelectedContainerVisible) {
        containers.forEach(function(container) {
            container.style.display = "none"; // Hide the entire container
        });
    } else {
        // Hide all elements in all toggle containers
        containers.forEach(function(container) {
            container.style.display = "none"; // Hide the entire container
        });

        // Show elements for the selected container
        selectedContainer.style.display = "flex"; // Show the selected container
    }
    if (container_id == 'mpp_container'){
        // Select the first option by default
        var mppCompositionSelect = document.getElementById("mpp_composition");
        mppCompositionSelect.selectedIndex = 0;

        // Trigger the onchange event manually
        mppCompositionSelect.dispatchEvent(new Event('change'));
    }
}

function generateMaterialProperties() {
    var materialSelect = document.getElementById("mpp_composition");
    var selectedMaterial = materialSelect.value;
    var materialPropertiesDiv = document.getElementById("materialProperties");
    
    // Clear previous content
    materialPropertiesDiv.innerHTML = "";

    // Add new content based on selected material
    switch (selectedMaterial) {
      case "PVC":
        materialPropertiesDiv.innerHTML = '<div class="row"><label class="col-md-4" for="density">Density (kg/m³):</label><input type="number" class="col-md-3" id="density" value="1580"></div><label>Shape: Sphere</label><div class="row"><label for="bbdiameter" class="col-md-4">Big Bin Diameter (µm):</label> <input class="col-md-3" type="number" id="bbdiameter" value="5000"></div>';
        break;
      case "PE":
        materialPropertiesDiv.innerHTML = '<div class="row"><label class="col-md-4" for="density">Density (kg/m³):</label><input type="number" class="col-md-3" id="density" value="980"></div><label>Shape: Sphere</label><div class="row"><label for="bbdiameter" class="col-md-4">Big Bin Diameter (µm):</label> <input class="col-md-3" type="number" id="bbdiameter" value="5000"></div>';
        break;
      case "PA":
        materialPropertiesDiv.innerHTML = '<div class="row"><label class="col-md-4" for="density">Density (kg/m³): </label> <input type="number" class="col-md-3" id="density" value="1000"></div><label>Shape: Sphere</label><div class="row"><label for="bbdiameter" class="col-md-4">Big Bin Diameter (µm):</label> <input class="col-md-3" type="number" id="bbdiameter" value="5000"></div>';
        break;
      default:
        materialPropertiesDiv.innerHTML = '<div class="row"><label class="col-md-4">No properties available for selected material</label></div>';
    }
}