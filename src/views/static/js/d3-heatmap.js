var utopia_model_results = null;

document.addEventListener('DOMContentLoaded', function () {
    // Select the "Run" button
    let runButton = document.getElementById('run-model');
    let extractVariablesFromClientSide = function(){
        let utopiaObject = {
            MicroPhysProperties: {
                MPdensity_kg_m3: document.getElementById('density').value,
                MP_composition: document.getElementById('mpp_composition').value,
                shape: "sphere", //default  
                N_sizeBins: 5, //default
                big_bin_diameter_um: document.getElementById('bbdiameter').value,  
                runName: document.getElementById('mpp_composition').value,
            }, 
            EnvCharacteristics: {
                spm_diameter_um: document.getElementById('spmDiameter').value,
                spm_density_kg_m3: document.getElementById('spmDensity').value
            },
            MicroWeatProperties:{
                fragmentation_style: document.getElementById('fragmentation_style').value
            },
            EmScenario:{
                MPform: document.getElementById('mp_form').value,
                size_bin: document.getElementById('es_bin_size').value,
                input_flow_g_s: document.getElementById('input_flow_g_s').value,
                emiss_comp: document.getElementById('emiss_comp').value
            }
        }        
        return JSON.stringify(utopiaObject)
    }

    // This method builds the heatmap
    let assembleHeatMap = function(title, csvText){
        // Remove any existing heatmap
        d3.select('#heatmap-container').selectAll('*').remove();
        // Set the dimensions and margins of the graph
        const margin = {top: 50, right: 5, bottom: 150, left: 150},
        // viewportWidth = window.innerWidth * 0.48,
        viewportWidth = 810, // Temporary static width for the heatmap container
        viewportHeight = window.innerHeight * 0.6,
        cellSize = 26, // Size of each cell in px
        width = viewportWidth - margin.left - margin.right,
        height = viewportHeight - margin.top - margin.bottom;
        // const heatmapContainerWidth = width + margin.left + margin.right + 55;
        const heatmapContainerHeight = height + margin.top + margin.bottom * 2 + 30;

        // Append the SVG element to the body of the page
        const svg = d3.select("#heatmap-container")
            .append("svg")
            .attr("width", width)
            .attr("height", heatmapContainerHeight)
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        var data = d3.csvParse(csvText);

        // Labels of row and columns -> unique identifier of the column called 'group' and 'variable'
        const myGroups = Array.from(new Set(data.map(d => d.group)))
        const myVars = Array.from(new Set(data.map(d => d.variable)))
        const myValues = data.map(d => parseFloat(d.value));

        // Get the minimum and maximum values
        const minValue = d3.min(myValues);
        const maxValue = d3.max(myValues);

        // Build X scales and axis:
        const x = d3.scaleBand()
                .range([0, myVars.length * cellSize + 55])
                .domain(myVars)
                .padding(0.05);
        const yHeight = myGroups.length * cellSize + 50;

        svg.append("g")
                .style("font-size", 16) // Decrease font size
                .attr("transform", `translate(-2, ${yHeight})`)
                .call(d3.axisBottom(x)
                    .tickSize(0))
                .selectAll("text")
                .attr("dy", "1em") // Adjust vertical positioning
                .attr("transform", "rotate(-45)") // Rotate labels
                .style("text-anchor", "end")
                .attr("dx", "-0.7em"); // Adjust text alignment

        // Build Y scales and axis:
        const y = d3.scaleBand()
                .range([yHeight, 0])
                .domain(myGroups.reverse())
                .padding(0.05);
        svg.append("g")
                .style("font-size", 16) // Decrease font size
                .attr("transform", `translate(-2, 0)`)
                .call(d3.axisLeft(y)
                    .tickSize(0))
                .selectAll("text")
                .attr("transform", "rotate(0)") // Keep labels horizontal
                .style("text-anchor", "end")
                .attr("dx", "-0.5em"); // Add some margin to the right for y labels

        // Build color scale
        const myColor = d3.scaleSequential()
            .interpolator(d3.interpolateViridis)
            .domain([minValue, maxValue])

        // Function to get color based on value
        const getColor = value => {
            if (value === '') {
                return 'grey'; // Color for empty values
            } else {
                return myColor(value); // Scalar color for other values
            }
        };

        // Create a tooltip
        const tooltip = d3.select("#heatmap-container")
            .append("div")
            .style("opacity", 0)
            .attr("class", "tooltip")
            .style("background-color", "white")
            .style("border", "solid")
            .style("border-width", "2px")
            .style("border-radius", "5px")
            .style("padding", "5px")

        // Three functions that change the tooltip when the user hovers/moves/leaves a cell
        const mouseover = function (event, d) {
                tooltip
                    .style("opacity", 1);
                d3.select(this)
                    .style("stroke", "black") // Set stroke color to a darker grey
                    .style("opacity", 1);  // Make the cell color darker
        };

        const mousemove = function(event, d) {
            if (d.value !== "") {
                // Calculate the position of the tooltip relative to the mouse pointer
                const tooltipLeft = event.pageX + 10;
                const tooltipTop = event.pageY - 50;

                // Update the position of the tooltip
                tooltip
                    .html("" + d.value)
                    .style("left", tooltipLeft + "px")
                    .style("top", tooltipTop + "px")
                    .style("display", "block");
            } else {
                // If d.value is empty, hide the tooltip
                tooltip.style("display", "none");
            }
        };

        const mouseleave = function (event, d) {
                tooltip
                    .style("opacity", 0);
                d3.select(this)
                    .style("stroke", "white") // Set stroke color back to white
                    .style("opacity", 0.8); // Reset the cell color
        };

        // Add the squares
        svg.selectAll()
            .data(data, function(d) {return d.group+':'+d.variable;})
            .join("rect")
                .attr("x", function(d) { return x(d.variable) })
                .attr("y", function(d) { return y(d.group) })
                .attr("width", cellSize) // Adjusted to square cells
                .attr("height", cellSize) // Adjusted to square cells
                .attr("margin-bottom", 1.6)
                .attr("margin-right", 1.6)
            .style("fill", function (d) { return getColor(d.value) })
            .style("stroke-width", 1) // Reduce stroke width to 1 pixel
                .style("opacity", 0.8)
            .on("mouseover", mouseover)
            .on("mousemove", mousemove)
            .on("mouseleave", mouseleave)

        // Update the text size of the axes labels
        svg.selectAll(".axis text")
            .style("font-size", "16px");

        // Update the text size of the title
        svg.append("text")
            .attr("x", 255) // Title's position on the x-axis
            .attr("y", -20)
            .attr("text-anchor", "middle")
            .style("font-size", "24px")
            .text(title);

        // Constants for the legend
        const legendWidth = 30;
        const legendHeight = myGroups.length * cellSize + 50; // Height of the legend to match heatmap
        const legendYOffset = 52; // Offset to match the heatmap
        const legendScaleOffset = legendYOffset - 0.5;

        // Remove any existing heatmap
        d3.select('#legend-container').selectAll('*').remove();
        const legendSvg = d3.select("#legend-container")
            .append("svg")
            .attr("width", legendWidth + 50)
            .attr("height", heatmapContainerHeight)
            .style("padding-left", "9px")
            .attr("dy", "2em") // Adjust vertical positioning
            .append("g");

        // Scale numerical values for the legend
        const legendScale = d3.scaleLinear()
            .domain([minValue, maxValue])
            .range([legendHeight - 3, 0]);

        // Append legend gradient definition
        const minMaxDifference = maxValue - minValue
        const defs = legendSvg.append("defs");
        const linearGradient = defs.append("linearGradient")
            .attr("id", "linear-gradient")
            .attr("x1", "0%")
            .attr("y1", "100%")
            .attr("x2", "0%")
            .attr("y2", "0%");

        // Define the gradient stops with more breakpoints
        // Starting (minimum) color value
        linearGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", myColor(minValue));

        // Inbetween breakpoint color values
        for (let i = 0.25; i < 1; i += 0.25) {
            let num = 100 * i;
            linearGradient.append("stop")
                .attr("offset", `${num}%`)
                .attr("stop-color", myColor(minValue + (minMaxDifference) * i));
        }

        // Last (maximum) color value
        linearGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", myColor(maxValue));

        // Build the rectangle and fill with gradient color
        legendSvg.append("rect")
            .attr("transform", `translate(0, ${legendYOffset})`)
            .attr("width", cellSize)
            .attr("height", legendHeight - 3)
            .attr("stroke", "black")
            .style("stroke-width", 0.9)
            .style("fill", "url(#linear-gradient)")
            .style("opacity", 0.8); // To match cell colors in the heatmap when not selected

        // Add the scale for the legend
        legendSvg.append("g")
            .attr("transform", `translate(${cellSize}, ${legendScaleOffset})`)
            .style("stroke-width", 0.9)
            .call(d3.axisRight(legendScale)
                .ticks(10)
                .tickFormat(d3.format(".2f")));
    }
    
    // Add event listener for button click
    runButton.addEventListener('click', function() {
        // Collect all variable values to be sent to the backend
        let inputData = extractVariablesFromClientSide();
        // Make HTTP post and get result
        // URL to which you want to send the POST request
        var url = '/run_model';
        // Options for the fetch() function
        var options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(inputData)
        };
        // Send the POST request
        fetch(url, options)
            .then(response => {
                // Closing the open parameter containers
                var containers = document.querySelectorAll('.toggle_container');
                containers.forEach(function(container) {
                    container.style.display = "none"; // Hide the entire container
                });
                // Fetching the master column container
                let masterContainer = document.getElementById('master-column');
                masterContainer.style.display = "flex"; // Reveal the model run information box
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json(); // Parse the response body as JSON
            })
            .then(model_results => {
                utopia_model_results = model_results; //store values from backend for assembling all visualizations
                assembleHeatMap("Mass Fraction Distribution Heatmap", model_results.mass_fraction_distribution_heatmap);
            })
            .catch(error => {
                console.error('There was a problem with the POST request:', error);
            });        
        
    });

    // Views actions
    let mass_fraction_distribution_btn = document.getElementById('mass_fraction_distribution_btn')
    let number_fraction_distribution_btn = document.getElementById('number_fraction_distribution_btn')
    
    mass_fraction_distribution_btn.addEventListener('click', function() {
        if (utopia_model_results !== null){
            assembleHeatMap("Mass Fraction Distribution Heatmap", utopia_model_results.mass_fraction_distribution_heatmap)
        }
    });
    number_fraction_distribution_btn.addEventListener('click', function() {
        if(utopia_model_results !== null){
            assembleHeatMap('Number Fraction Distribution Heatmap' , utopia_model_results.number_fraction_distribution_heatmap);
        }
    });
});