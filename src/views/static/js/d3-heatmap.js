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
            EnvCharacteristics: { // Currently just commented out
                // spm_diameter_um: document.getElementById('spmDiameter').value,
                // spm_density_kg_m3: document.getElementById('spmDensity').value
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

    // Building the new heatmap with respect to compartments
    let assembleCompHeatMap = function(title, csvText) {
        // Remove any existing heatmap
        d3.select('#heatmap-container').selectAll('*').remove();
        // Set the dimensions and margins of the graph
        const margin = {top: 50, right: 5, bottom: 150, left: 150},
            // viewportWidth = window.innerWidth * 0.48,
            viewportWidth = 810, // Temporary static width for the heatmap container
            viewportHeight = window.innerHeight * 0.6,
            // cellSize = 26, // Size of each cell in px
            width = viewportWidth - margin.left - margin.right,
            height = viewportHeight - margin.top - margin.bottom;
        const heatmapContainerHeight = height + margin.top + margin.bottom * 2 + 30;
        // Append the SVG element to the body of the page
        const container = d3.select("#heatmap-container")
            .attr("width", width + 160)
            .attr("height", heatmapContainerHeight)
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        // Update the text size of the title
        container.append("text")
            .attr("x", 255) // Title's position on the x-axis
            .attr("y", -20)
            .attr("text-anchor", "middle")
            .style("grid-template-columns", "repeat(6, 1fr)")
            .style("margin-bottom", "30px")
            .text(title);

        let data = d3.csvParse(csvText);
        // Labels of row and columns TODO -> unique identifier of the column called 'group'
        const myGroups = Array.from(new Set(data.map(d => d.group)));
        const myVars = Array.from(new Set(data.map(d => d.variable))).reverse();
        const myValues = data.map(d => parseFloat(d.value));

        // // Get the minimum and maximum values
        const minValue = d3.min(myValues);
        const maxValue = d3.max(myValues);

        let xNoLabels = [0, 1, 2, 3, 4]
        let yNoLabels = [0, 1, 2, 3]
        // Variables compartment matrices
        const singleCellSize = 19;
        const singleCellGap = 0.02;
        var singleMargin = {top: 0, right: 0, bottom: 0, left: 0},
            singleWidth = 270 - margin.left - margin.right,
            singleHeight = 290 - margin.top - margin.bottom;

        // Function to get color based on value TODO will be used later when values are set
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
                .style("stroke", "#737373") // Set stroke color to a darker grey
                .style("stroke-width", "1.2px")
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
            if (this !== selectedCell) { // Only reset stroke for the unselected cells
                d3.select(this)
                    .style("stroke", "#737373") // Set stroke color back to white
                    .style("stroke-width", "0.8px")
                    .style("opacity", 0.8); // Reset the cell color
            }
        };

        let selectedCell = null; // Variable to store the selected cell
        // Function to handle cell selection
        const cellClick = function(event, d) {
            if (d.value !== "") { // For cells that have a value
                if (selectedCell) { // Unselecting previously selected cell
                    d3.select(selectedCell)
                        .style("stroke", "#737373") // Set stroke color back to white
                        .style("opacity", 0.8); // Reset the cell color
                }
                selectedCell = this; // Update selected cell
                d3.select("#cell-info") // Update cell info
                    .html("Log mass function = " + d.value);
                d3.select(this)
                    .style("stroke", "black") // Set stroke color to black
                    .style("opacity", 1);  // Make the cell color darker
                document.getElementById('detailed-view').style.display = 'flex'; // Display detailed view container

            } else { // For empty grey cells
                d3.select("#cell-info")
                    .html("");
                document.getElementById('detailed-view').style.display = 'none'; // Hide the detailed view
                d3.select(selectedCell)
                    .style("stroke", "#737373") // Set stroke color back to white
                    .style("opacity", 0.8); // Reset the cell color
                selectedCell = null;
            }
        };

        // Drawing out the compartments
        for (let i = 1; i < 6; i++) {
            const row = container.append("div")
                .attr("class", "horiz-area")
                .style("background-color", "white");

            if (i === 1) {
                // Create a container for the title and svg
                const compartmentContainer = row.append("div")
                    .attr("class", "compartment air")
                    .attr("id", "compartment-air-container");

                // Append the title
                compartmentContainer.append("div")
                    .attr("class", "compartment-title")
                    .style("text-align", "center")
                    .text(`${myVars[0]}`);

                // Create svg for the air compartment matrix and its axes
                var svg = compartmentContainer.append("svg")
                    .attr("width", singleWidth + singleMargin.top + singleMargin.right)
                    .attr("height", singleHeight + 20 + 10)
                    .append("g")
                    .attr("transform", "translate(" + singleMargin.left + "," + 0 + ")");

                // Build X scales and axis:
                var x = d3.scaleBand()
                    .range([0, singleWidth])
                    .domain(xNoLabels)
                    .padding(0.01);
                const xaxis = svg.append("g")
                    .attr("transform", "translate(-7," + (singleHeight - 0) + ")")
                    .call(d3.axisBottom(x)
                        .tickSize(0)
                        .tickFormat(""))
                    .selectAll("path, line, text")
                    .style("display", "none");

                // Build Y scales and axis:
                var y = d3.scaleBand()
                    .range([singleHeight, 0 ])
                    .domain(yNoLabels)
                    .padding(0.01);
                const yaxis = svg.append("g")
                    .call(d3.axisLeft(y)
                        .tickSize(0)
                        .tickFormat(""))
                    .selectAll("path, line, text")
                    .style("display", "none");

                // Creating the grid of squares
                for (let row = 0; row < 4; row++) {
                    for (let col = 0; col < 5; col++) {
                        svg.append("rect")
                            .attr("x", x(xNoLabels[col]) + 1)
                            .attr("y", y(yNoLabels[row]) + 1)
                            .attr("width", singleCellSize - singleCellGap)
                            .attr("height", singleCellSize - singleCellGap)
                            .attr("fill", "white")
                            .attr("stroke", "#737373")
                            .style("stroke-width", "0.8px")
                            .style("opacity", 0.8)
                            .on("mouseover", mouseover)
                            .on("mousemove", mousemove)
                            .on("mouseleave", mouseleave)
                            .on("click", cellClick); // To select a cell;
                    }
                }

            } else {
                // Create columns within each row
                for (let j = 1; j < 7; j++) {
                    const uniqueNumber = (i - 2) * 6 + j;
                    let compartmentType = "";
                    let uniqueCompartment = "";
                    let compTitle = "";

                    if (uniqueNumber === 1 || uniqueNumber === 7) { // Agricultural
                        compartmentType = "compartment agricultural";
                        uniqueCompartment = `compartment-${uniqueNumber}`;
                        if (uniqueNumber === 1) {
                            compTitle = myVars[2];
                        } else {
                            compTitle = myVars[1];
                        }
                    } else if (uniqueNumber === 2 || uniqueNumber === 8) { // Urban
                        compartmentType = "compartment urban";
                        uniqueCompartment = `compartment-${uniqueNumber}`;
                        if (uniqueNumber === 2) {
                            compTitle = myVars[6];
                        } else {
                            compTitle = myVars[5];
                        }
                    } else if (uniqueNumber === 3 || uniqueNumber === 9) { // Background
                        compartmentType = "compartment background";
                        uniqueCompartment = `compartment-${uniqueNumber}`;
                        if (uniqueNumber === 3) {
                            compTitle = myVars[4];
                        } else {
                            compTitle = myVars[3];
                        }
                    } else if (uniqueNumber === 4 || uniqueNumber === 10) { // Fresh Water
                        compartmentType = "compartment freshwater";
                        uniqueCompartment = `compartment-${uniqueNumber}`;
                        if (uniqueNumber === 4) {
                            compTitle = myVars[11];
                        } else {
                            compTitle = myVars[10];
                        }
                    } else if (uniqueNumber === 5 || uniqueNumber === 11) { // Coast
                        compartmentType = "compartment coastal";
                        uniqueCompartment = `compartment-${uniqueNumber}`;
                        if (uniqueNumber === 5) {
                            compTitle = myVars[13];
                        } else {
                            compTitle = myVars[12];
                        }
                    } else if (uniqueNumber === 6 || uniqueNumber === 12 || uniqueNumber === 18) { // Ocean
                        compartmentType = "compartment ocean";
                        uniqueCompartment = `compartment-${uniqueNumber}`;
                        if (uniqueNumber === 6) {
                            compTitle = myVars[16];
                        } else if (uniqueNumber === 12) {
                            compTitle = myVars[15];
                        } else {
                            compTitle = myVars[14];
                        }
                    } else if (uniqueNumber === 16 || uniqueNumber === 17 || uniqueNumber === 24) { // Sediment
                        compartmentType = "compartment sediment";
                        uniqueCompartment = `compartment-${uniqueNumber}`;
                        if (uniqueNumber === 16) {
                            compTitle = myVars[9];
                        } else if (uniqueNumber === 17) {
                            compTitle = myVars[7];
                        } else {
                            compTitle = myVars[8];
                        }
                    } else { // Legend or empty
                        uniqueCompartment = `compartment-${uniqueNumber}`;
                        if (uniqueNumber === 13) {
                            compartmentType = "new-legend-container";
                        } else if (uniqueNumber === 14 || uniqueNumber === 15) {
                            compartmentType = "nothing";
                        } else {
                            compartmentType = "compartment empty";
                        }
                    }
                    row.append("div")
                        .attr("class", `${compartmentType}`)
                        .attr("id", `${uniqueCompartment}`)
                        .text(`${compTitle.replaceAll("_", " ")}`);

                    if (compartmentType !== "compartment empty" && compartmentType !== "new-legend-container" && compartmentType !== "nothing") {
                        // Creating svg for the compartment matrix and its axes
                        var svg = d3.select(`#${uniqueCompartment}`)
                            .append("svg")
                            .attr("width", singleWidth + singleMargin.left + singleMargin.right)
                            .attr("height", singleHeight + singleMargin.top + singleMargin.bottom)
                            .append("g")
                            .attr("transform",
                                "translate(" + singleMargin.left + "," + singleMargin.top + ")");

                        // Build X scales and axis:
                        var x = d3.scaleBand()
                            .range([0, singleWidth])
                            .domain(xNoLabels)
                            .padding(0.01);
                        const xaxis = svg.append("g")
                            .attr("transform", "translate(-7," + (singleHeight - 0) + ")")
                            .call(d3.axisBottom(x)
                                .tickSize(0)
                                .tickFormat(""))
                            .selectAll("path, line, text")
                            .style("display", "none");

                        // Build Y scales and axis:
                        var y = d3.scaleBand()
                            .range([singleHeight, 0 ])
                            .domain(yNoLabels)
                            .padding(0.01);
                        const yaxis = svg.append("g")
                            .call(d3.axisLeft(y)
                                .tickSize(0)
                                .tickFormat(""))
                            .selectAll("path, line, text")
                            .style("display", "none");

                        // Creating the grid of squares
                        for (let row = 0; row < 4; row++) {
                            for (let col = 0; col < 5; col++) {
                                svg.append("rect")
                                    .attr("x", x(xNoLabels[col]) + 1)
                                    .attr("y", y(yNoLabels[row]) + 1)
                                    .attr("width", singleCellSize - singleCellGap)
                                    .attr("height", singleCellSize - singleCellGap)
                                    .attr("fill", "white")
                                    .attr("stroke", "#737373")
                                    .style("stroke-width", "0.8px")
                                    .style("opacity", 0.8)
                                    .on("mouseover", mouseover)
                                    .on("mousemove", mousemove)
                                    .on("mouseleave", mouseleave)
                                    .on("click", cellClick); // To select a cell
                            }
                        }
                    }
                }
            }
            let masterContainer = document.getElementById('legend-container');
            masterContainer.style.display = "none"; // Reveal the model run information box
        }

        // Append the new legend container
        const cont13 = d3.select("#compartment-13");
        const newLegendContainer = cont13.append("div")
            .attr("class", "new-legend-container");

        newLegendContainer.append("h5")
                .text(`Legend`);

        newLegendContainer.append("h5")
            .text(`Fraction of plastic mass/particle number:`);

        // Build color scale
        const myColor = d3.scaleSequential()
            .interpolator(d3.interpolateViridis)
            .domain([minValue, maxValue])

        // Constants for the legend
        const legendWidth = 17;
        const legendHeight = 220;
        // Remove any existing legend
        d3.select('#new-legend').remove();

        const newLegendSvg = newLegendContainer.append("div")
            .attr("id", "new-legend")
            .append("svg")
            .attr("transform", `translate(420, -35)`)
            .attr("width", legendWidth + 50)  // Additional space for axis
            .attr("height", legendHeight);

        // Scale numerical values for the legend
        const legendScale = d3.scaleLinear()
            .domain([-10, -1])
            .range([legendHeight - 20, 0]);

        // Append legend gradient definition
        const minMaxDifference = maxValue - minValue
        const defs = newLegendSvg.append("defs");
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
        newLegendSvg.append("rect")
            .attr("width", legendWidth)
            .attr("height", legendHeight - 10)
            .attr("stroke", "black")
            .style("stroke-width", 0.9)
            .style("fill", "url(#linear-gradient)")
            .style("opacity", 0.8);

        // Add the scale for the legend
        newLegendSvg.append("g")
            .attr("transform", `translate(${legendWidth}, 5)`)
            .attr("height", legendHeight - 15)
            .style("stroke-width", 0.0)
            .call(d3.axisRight(legendScale)
                .tickValues([-10, -1])
                .tickSize(0)  // No visible ticks
                .tickFormat(d => `10\u207B${Math.abs(d)}`));

        // Labels for x and y axis
        var xAxisLabels = [5000, 500, 50, 5, 0.5]
        var yAxisLabels = ["Biofouled and Heteoaggregated", "Biofouled", "Heteoaggregated", "Free Microplastic"]
        // Variables the legend matrix
        const cellSize = 19;
        const cellGap = 0.02;
        var legendMargin = {top: 0, right: 30, bottom: 70, left: 205},
            legWidth = 270 - margin.left - margin.right,
            legHeight = 290 - margin.top - margin.bottom;

        // Creating svg for the legend matrix and its axes
        var svg = d3.select("#new-legend")
            .append("svg")
            .attr("width", legWidth + legendMargin.left + legendMargin.right)
            .attr("height", legHeight + legendMargin.top + legendMargin.bottom)
            .append("g")
            .attr("transform",
                "translate(" + legendMargin.left + "," + legendMargin.top + ")");


        // Build X scales and axis:
        var x = d3.scaleBand()
            .range([0, legWidth])
            .domain(xAxisLabels)
            .padding(0.01);
        const xaxis = svg.append("g")
            .attr("transform", "translate(-7," + (legHeight - 0) + ")")
            .call(d3.axisBottom(x)
                .tickSize(0));
        xaxis.selectAll("text").style("font-size", "13px")
        xaxis.selectAll("text").style("font-weight", "normal");
        xaxis.selectAll("text").attr("transform", "rotate(-90)");
        xaxis.selectAll("text").attr("text-anchor", "end");
        xaxis.selectAll("path").style("stroke", "none");

        // Build Y scales and axis:
        var y = d3.scaleBand()
            .range([legHeight, 0 ])
            .domain(yAxisLabels)
            .padding(0.01);
        const yaxis = svg.append("g")
            .call(d3.axisLeft(y)
                .tickSize(0));
        yaxis.selectAll("text").style("font-size", "14px");
        yaxis.selectAll("text").style("font-weight", "normal");
        yaxis.selectAll("path").style("stroke", "none");

        // Creating the grid of squares
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 5; col++) {
                svg.append("rect")
                    .attr("x", x(xAxisLabels[col]) + 1)
                    .attr("y", y(yAxisLabels[row]))
                    .attr("width", cellSize - cellGap)
                    .attr("height", cellSize - cellGap)
                    .attr("fill", "white")
                    .attr("stroke", "black");
            }
        }
        // Add heading text within the SVG
        svg.append("text")
            .attr("x", legWidth / 2 - 1)
            .attr("y", 143)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "lighter")
            .text("Size Class (µm)");
    }

    // This method builds the heatmap
    let assembleHeatMap = function(title, csvText){
        // Remove any existing heatmap
        d3.select('#heatmap-container').selectAll('*').remove();
        // Set the dimensions and margins of the graph
        const margin = {top: 50, right: 5, bottom: 150, left: 100},
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
                    .style("stroke", "#737373") // Set stroke color to a darker grey
                    .style("stroke-width", "1.2px")
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
            if (this !== selectedCell) { // Only reset stroke for the unselected cells
                d3.select(this)
                    .style("stroke", "#737373") // Set stroke color back to white
                    .style("stroke-width", "0.8px")
                    .style("opacity", 0.8); // Reset the cell color
            }
        };

        let selectedCell = null; // Variable to store the selected cell
        // Function to handle cell selection
        const cellClick = function(event, d) {
            if (d.value !== "") { // For cells that have a value
                if (selectedCell) { // Unselecting previously selected cell
                    d3.select(selectedCell)
                        .style("stroke", "#737373") // Set stroke color back to white
                        .style("opacity", 0.8); // Reset the cell color
                }
                selectedCell = this; // Update selected cell
                d3.select("#cell-info") // Update cell info
                    .html("Log mass function = " + d.value);
                d3.select(this)
                    .style("stroke", "black") // Set stroke color to black
                    .style("opacity", 1);  // Make the cell color darker
                document.getElementById('detailed-view').style.display = 'flex'; // Display detailed view container

            } else { // For empty grey cells
                d3.select("#cell-info")
                    .html("");
                document.getElementById('detailed-view').style.display = 'none'; // Hide the detailed view
                d3.select(selectedCell)
                    .style("stroke", "#737373") // Set stroke color back to white
                    .style("opacity", 0.8); // Reset the cell color
                selectedCell = null;
            }
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
            .style("stroke-width", 0.8) // Reduce stroke width to 1 pixel
            .style("stroke", "#737373")
                .style("opacity", 0.8)
            .on("mouseover", mouseover)
            .on("mousemove", mousemove)
            .on("mouseleave", mouseleave)
            .on("click", cellClick); // To select a cell

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
        let masterContainer = document.getElementById('legend-container');
        masterContainer.style.display = "flex"; // Reveal the model run information box
        const legendWidth = 30;
        const legendHeight = myGroups.length * cellSize + 50; // Height of the legend to match heatmap
        const legendYOffset = 52; // Offset to match the heatmap
        const legendScaleOffset = legendYOffset - 0.5;

        // Remove any existing legend
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
            .domain([-10, -1])
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
                .tickValues([-10, -1])
                .tickSize(0)  // No visible ticks
                .tickFormat(d => `10\u207B${Math.abs(d)}`));
    }

    // Add event listener for button click
    runButton.addEventListener('click', function() {
        document.getElementById('loading-spinner').style.display = 'block'; // Loading animation
        document.getElementById('main-content').classList.add('blur'); // Blurring the background
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
        // Closing the open parameter containers
        var containers = document.querySelectorAll('.toggle_container');
        containers.forEach(function(container) {
            container.style.display = "none"; // Hide the entire container
        });
        // Send the POST request
        fetch(url, options)
            .then(response => {
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
            })
            .finally(() => { // Hiding the loading animation and cancelling the blur effect
                document.getElementById('loading-spinner').style.display = 'none';
                document.getElementById('main-content').classList.remove('blur');
                let inputs = getModelRunInfo(inputData); // Getting input information as an array
                let modelRunText = `Input of ${inputs[0]}g/s of ${inputs[1]} ${inputs[2]} spherical microplastics particles of ${inputs[3]}kg/m3 density into the ${inputs[4]} compartment. Selected fragmentation style: ${inputs[5]}.`
                let runModelContainer = document.getElementById("model-run-input");
                runModelContainer.textContent = modelRunText; // Assigning the text with model input to Model Run
            });
    });

    // Getting the input information
    function getModelRunInfo(inputJsonData) {
        let parsedInput = JSON.parse(inputJsonData); // Parsing the JSON object
        let indexes = [3, 3, 3, 0, 3, 2]; // Listing the input parameter field indexes in the correct order
        // Listing the input elements with the correct names in model
        let fieldNameArray = ["input_flow_g_s", "MPform", "size_bin", "MPdensity_kg_m3", "emiss_comp", "fragmentation_style"];
        let fieldValueArray = []; // Array for storing the actual presentable elements
        for (let i = 0; i < indexes.length; i++) {
            let index = indexes[i]; // Index for fetching the field from JSON object
            let inputFieldName = fieldNameArray[i]; // The input field name from some specific field
            // Validating the parsed JSON object
            if (Object.keys(parsedInput)[index]) {
                // Fetching the input element from the model (JSON)
                let element = parsedInput[Object.keys(parsedInput)[index]][inputFieldName];
                if (i === 1) { // Check to make Emission Scenario MP form field presentable
                    let cleanName = "";
                    if (element === "freeMP") {
                        cleanName = "Free";
                    } else if (element === "heterMP") {
                        cleanName = "Heter"; // heteroaggregated
                    } else if (element === "biofMP") {
                        cleanName = "Biof"; // biofouled
                    } else {
                        cleanName = "HeterBiof"; // heteroaggregted and biofouled
                    }
                    fieldValueArray.push(cleanName);
                } else if (i === 2) { // Check to make Emission Scenario size bin field presentable
                    let numValue = 0;
                    if (element === "a") {
                        numValue = "0.5μm";
                    } else if (element === "b") {
                        numValue = "5μm";
                    } else if (element === "c") {
                        numValue = "50μm";
                    } else if (element === "d") {
                        numValue = "500μm";
                    } else {
                        numValue = "5mm";
                    }
                    fieldValueArray.push(numValue);
                } else { // Adding the element name, replacing _ with spaces where needed
                    fieldValueArray.push(element.toString().replaceAll("_", " "));
                }
            } else {
                console.log(`Index ${index} is out of bounds.`);
                fieldValueArray.push(null);
            }
        }
        return fieldValueArray; // Returning the array of presentable inputs
    }

    // Views actions
    let mass_fraction_distribution_btn = document.getElementById('mass_fraction_distribution_btn')
    let number_fraction_distribution_btn = document.getElementById('number_fraction_distribution_btn')
    let comp_mass_fraction_distribution_btn = document.getElementById('comp_mass_fraction_distribution_btn')
    let comp_number_fraction_distribution_btn = document.getElementById('comp_number_fraction_distribution_btn')
    
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
    comp_mass_fraction_distribution_btn.addEventListener('click', function() {
        if(utopia_model_results !== null){
            assembleCompHeatMap('New Mass Fraction Distribution Heatmap' , utopia_model_results.mass_fraction_distribution_heatmap);
        }
    });
    comp_number_fraction_distribution_btn.addEventListener('click', function() {
        if(utopia_model_results !== null){
            assembleCompHeatMap('New Number Fraction Distribution Heatmap' , utopia_model_results.number_fraction_distribution_heatmap);
        }
    });
});