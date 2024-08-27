let utopia_model_results = null;
let selectedCell = null;
let selectedCompartment = null;

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

    // Function to unselect all selected elements (cell/compartment), hide selection info and unblur all
    function unselectEverything() {
        document.getElementById(`detailed-view-cell`).style.display = 'none';
        document.getElementById(`detailed-view-compartment`).style.display = 'none';
        if (selectedCell !== null || selectedCompartment !== null) {
            unblurCompartments();
            if (selectedCompartment) { // unselecting previously selected compartment
                d3.select(selectedCompartment)
                    .style("border", "solid 1px #000");
                selectedCompartment = null;
            }
            if (selectedCell) { // Unselecting previously selected cell
                d3.select(selectedCell)
                    .style("stroke", "white") // Set stroke color back to white
                    .style("opacity", 0.8); // Reset the cell color
            }
        }
    }

    // Function to unblur all compartments
    function unblurCompartments() {
        d3.selectAll('.compartment')
            .classed('blurry', false);
    }

    // Building the new heatmaps with respect to compartments
    let assembleCompHeatMap = function(title, csvText, mode, csvExtended) {
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
            .attr("transform", `translate(${margin.left}, ${margin.top})`)
            .on("click", unselectEverything); // closing info and unselecting when clicked outside of compartments

        // Update the text size of the title
        container.append("text")
            .attr("id", "main-title")
            .attr("x", 255) // Title's position on the x-axis
            .attr("y", -20)
            .attr("text-anchor", "middle")
            .style("grid-template-columns", "repeat(6, 1fr)")
            .style("margin-bottom", "30px")
            .text(title);

        let data = d3.csvParse(csvText);
        const myGroups = Array.from(new Set(data.map(d => d.group))).reverse();
        const myVars = Array.from(new Set(data.map(d => d.variable))).reverse();
        const myValues = data.map(d => parseFloat(d.value));
        const collections = {}; // For storing data for each compartment separately

        // Dividing the data according to myVars elements (compartments)
        myVars.forEach(variable => {
            collections[variable] = data.filter(d => d.variable === variable);
        });

        // Parsing groups from long label to two divided labels for new x and y
        // e.g 'freeMP + 0.5' -> type: 'freeMP', size: 0.5
        function parseGroup(group) {
            const [type, size] = group.split(' + ');
            return {
                type: type.trim(),
                size: parseFloat(size.trim())
            };
        }

        // Get the minimum and maximum values
        const minValue = d3.min(myValues);
        const maxValue = d3.max(myValues);

        // Variables for compartment matrix sizes etc
        const singleCellSize = 21;
        const singleCellGap = 0.01;
        let singleMargin = {top: 0, right: 0, bottom: 0, left: 0},
            singleWidth = 280 - margin.left - margin.right,
            singleHeight = 300 - margin.top - margin.bottom;

        // Build color scale
        const myColor = d3.scaleSequential()
            .interpolator(d3.interpolateViridis)
            .domain([minValue, maxValue])

        // Function to get color based on value
        const getColor = value => {
            if (value === '') {
                return '#EDEDED'; // Color for empty values
            } else {
                return myColor(value); // Scalar color for other values
            }
        };

        // Create a tooltip
        const tooltip = d3.select("#heatmap-container")
            .append("div")
            .style("opacity", 0)
            .attr("class", "tooltip");

        // Three functions that change the tooltip when the user hovers/moves/leaves a cell
        const mouseover = function (event, d) {
            tooltip
                .style("opacity", 1);
            if (this !== selectedCell) { // to ensure that the selected cell still appears selected
                d3.select(this)
                    .style("stroke", "#737373") // Set stroke color to a darker grey
                    .style("stroke-width", "1.2px")
                    .style("opacity", 1);  // Make the cell color darker
            }
        };

        const mousemove = function(event, d) {
            if (d.value !== "") {
                // Calculate the position of the tooltip relative to the mouse pointer
                const tooltipLeft = event.pageX + 10;
                const tooltipTop = event.pageY - 50;

                // Update the position of the tooltip
                tooltip
                    .html("" + Number(d.value).toFixed(2))
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
                    .style("stroke", "white") // Set stroke color back to white
                    .style("stroke-width", "0.8px")
                    .style("opacity", 0.8); // Reset the cell color
            }
        };

        // Function to get the long name of the MP form to present in the cell selection title
        function getMPForm(shortForm) {
            let formLabels = ["biofouled and heteoaggregated", "biofouled", "heteoaggregated", "free microplastic"]
            let longForm = "";
            shortForm = shortForm.replaceAll(" ", "")

            switch (shortForm) {
                case 'heterBiofMP':
                    longForm = formLabels[0]
                    break;
                case 'biofMP':
                    longForm = formLabels[1]
                    break;
                case 'heterMP':
                    longForm = formLabels[2]
                    break;
                default:
                    longForm = formLabels[3]
            }
            return longForm;
        }

        // Function to blur all the unselected compartments
        function blurCompartments(currentCompartment) {
            const selectedElement = d3.select(currentCompartment);
            unblurCompartments(); // first unblurring all compartments

            d3.selectAll('.compartment') // iterating over all compartments and selecting the compartment
                .each(function() {
                    const element = d3.select(this);
                    // blurring only actual compartments, leaving out the legend, empty and nothing compartnents
                    if (!element.classed("empty") && !element.classed("new-legend-container") && !element.classed("nothing")) {
                        element.classed('blurry', true);
                    }
                });
            selectedElement.node().classed('blurry', false); // unblurring the selected element compartment
        }


        // Function to handle cell selection
        const cellClick = function(event, d) {
            event.stopPropagation(); // Disallowing cpompartment selection to take place
            unselectEverything();

            if (d.value !== "") { // For cells that have a value
                selectedCell = this; // Update selected cell
                const selection = d3.select(selectedCell);
                const cellCompartment = selection.attr("data-compartment").replaceAll("compartment ", "") + " compartment"
                const cellMPForm = selection.attr('part-type').toString();
                const compName = d3.select(selectedCell).attr("data-compartment").replaceAll(" ", "-");
                const selectedComp = (d3.select(`#${compName}`));
                blurCompartments(selectedComp);

                d3.select(`#cell-info-percentage`) // Update cell info
                    .html(`Log ${mode} function = ` + Number(d.value).toFixed(2));
                d3.select(`#total-percent`) // Update cell info
                    .html(`% of total ${mode} = __%`);
                d3.select(`#residence-value`) // Update cell info
                    .html(`Residence time = ${Number(d.value).toFixed(2)}/sum(output_flows)`);
                d3.select(`#persistence-value`) // Update cell info
                    .html(`Persistence = ${Number(d.value).toFixed(2)}/discorporation_flow`);
                d3.select('#cell-title')
                    .html(`${selection.attr('size-bin')} µm ${getMPForm(cellMPForm)} particles in the ${cellCompartment}`)

                d3.select(this)
                    .style("stroke", "black") // Set stroke color to black
                    .style("stroke-width", "2.5px")
                    .style("opacity", 1);  // Make the cell color darker
                // Hide all information containers
                document.getElementById(`detailed-view-cell`).style.display = 'none';
                document.getElementById(`detailed-view-compartment`).style.display = 'none';
                // Display current view container
                document.getElementById(`detailed-view-cell`).style.display = 'flex';

            } else { // For empty grey cells
                document.getElementById(`detailed-view-compartment`).style.display = 'none';
                d3.select("#cell-info")
                    .html("");
                // Hide all information containers
                document.getElementById(`detailed-view-cell`).style.display = 'none';
                d3.select(selectedCell)
                    .style("stroke", "white") // Set stroke color back to white
                    .style("opacity", 0.8); // Reset the cell color
                selectedCell = null;

                if (selectedCompartment) { // Unselecting previously selected compartment
                    d3.select(selectedCompartment)
                        .style("border", "solid 1px #000"); // Reset the compartment border
                }
            }
        };

        // Handling compartment selection
        const compartmentClick = function(event) {
            event.stopPropagation();
            unselectEverything();
            const clickedClass = d3.select(this).attr("class");

            selectedCompartment = this; // Update selected compartment
            blurCompartments(d3.select(selectedCompartment));
            d3.select(`#cell-info-compartment`) // Update compartment info
                .html(`The ${clickedClass} is selected`);
            d3.select(selectedCompartment)
                .style("border", "solid 3px #000"); // Change the border to appear sleected
            d3.select('#compartment-title')
                .html(`${d3.select(selectedCompartment).attr('comp-title')} Compartment`)

            // Hide all information containers
            document.getElementById(`detailed-view-cell`).style.display = 'none';
            document.getElementById(`detailed-view-compartment`).style.display = 'none';
            // Display current view container
            document.getElementById(`detailed-view-compartment`).style.display = 'flex';
        };

        // Function to create a heatmap for a given compartment
        function createHeatmap(container, compartmentType, variable) {
            if (compartmentType !== "compartment empty" && compartmentType !== "new-legend-container" && compartmentType !== "nothing") {
                container.style("cursor", "pointer")
                    .on("click", compartmentClick);

                const svgWrapper = container.append("div")
                    .attr("class", "white-background");

                let svg = svgWrapper.append("svg")
                    .attr("width", (singleCellSize + singleCellGap) * 5.829)
                    .attr("height", (singleCellSize + singleCellGap) * 4.56)
                    .append("svg")
                    .attr("transform",
                        "translate(" + singleMargin.left + "," + singleMargin.top + ")");

                const xScale = d3.scaleBand()
                    .domain(Array.from(new Set(myGroups.map(g => parseGroup(g).size))))
                    .range([0, singleWidth])
                    .padding(0.01);
                svg.append("g")
                    .attr("transform", "translate(-7," + (singleHeight) + ")")
                    .call(d3.axisBottom(xScale)
                        .tickSize(0)
                        .tickFormat(""))
                    .selectAll("path, line, text")
                    .style("display", "none");

                const yScale = d3.scaleBand()
                    .domain(Array.from(new Set(myGroups.map(g => parseGroup(g).type))))
                    .range([singleHeight, 0])
                    .padding(0.01);
                svg.append("g")
                    .call(d3.axisLeft(yScale)
                        .tickSize(0)
                        .tickFormat(""))
                    .selectAll("path, line, text")
                    .style("display", "none");

                // Getting the data for a given variable/myVars element (compartment)
                let variableData = collections[variable];

                // Select all squares and bind data to rect elements
                const rects = svg.selectAll("rect")
                    .data(variableData, d => d.group + ':' + d.variable);

                rects.join("rect")
                    .attr("x", d => xScale(parseGroup(d.group).size)) // parsing the I part of myGroup element
                    .attr("y", d => yScale(parseGroup(d.group).type)) // parsing the II part of myGroup element
                    .attr("width", singleCellSize - singleCellGap)
                    .attr("height", singleCellSize - singleCellGap)
                    .attr("fill", d => getColor(d.value))
                    .attr("stroke", "white")
                    .attr("z-index", "9") // lifting up the cells
                    .style("stroke-width", "0.8px")
                    .style("opacity", 0.8)
                    .on("mouseover", mouseover)
                    .on("mousemove", mousemove)
                    .on("mouseleave", mouseleave)
                    .on("click", cellClick)
                    .attr('data-value', d => d.value)
                    .attr('data-compartment', compartmentType)
                    .attr('size-bin', d => parseGroup(d.group).size)
                    .attr('part-type', d => parseGroup(d.group).type);
            }
        }

        // // TODO experimenting with extended data -> getting compartments, and drawing cells but with NaN values
        // let extendedData = d3.csvParse(csvExtended);
        // const myMpForm = Array.from(new Set(extendedData.map(d => d.MP_Form))).reverse();
        // const mySizeFrac = Array.from(new Set(extendedData.map(d => d.Size_Fraction_um))).reverse();
        // const myCompartments = Array.from(new Set(extendedData.map(d => d.Compartment))).reverse();
        //
        // let newValues = null;
        // let valueVar = null;
        //
        // if (mode === "mass") {
        //     newValues = extendedData.map(d => parseFloat(d.mass_g));
        //     valueVar = 'mass_g';
        // } else {
        //     newValues = extendedData.map(d => parseFloat(d.number_of_particles));
        //     valueVar = 'number_of_particles';
        // }
        //
        // const newCollections = {}; // For storing data for each compartment separately
        //
        // // Dividing the data according to myVars elements (compartments)
        // myCompartments.forEach(variable => {
        //     newCollections[variable] = extendedData.filter(d => d.Compartment === variable);
        // });
        //
        // // Parsing groups from long label to two divided labels for new x and y
        // // e.g 'freeMP + 0.5' -> type: 'freeMP', size: 0.5
        // function parseGroup(group) {
        //     const [type, size] = group.split(' + ');
        //     return {
        //         type: type.trim(),
        //         size: parseFloat(size.trim())
        //     };
        // }
        //
        // // Get the minimum and maximum values
        // const minValue = d3.min(newValues);
        // const maxValue = d3.max(newValues);
        //
        // // Variables for compartment matrix sizes etc
        // const singleCellSize = 21;
        // const singleCellGap = 0.01;
        // let singleMargin = {top: 0, right: 0, bottom: 0, left: 0},
        //     singleWidth = 280 - margin.left - margin.right,
        //     singleHeight = 300 - margin.top - margin.bottom;
        //
        // // Build color scale
        // const myColor = d3.scaleSequential()
        //     .interpolator(d3.interpolateViridis)
        //     .domain([minValue, maxValue])
        //
        // // Function to get color based on value
        // const getColor = value => {
        //     if (value === '') {
        //         return '#EDEDED'; // Color for empty values
        //     } else {
        //         return myColor(value); // Scalar color for other values
        //     }
        // };
        //
        // // Create a tooltip
        // const tooltip = d3.select("#heatmap-container")
        //     .append("div")
        //     .style("opacity", 0)
        //     .attr("class", "tooltip");
        //
        // // Three functions that change the tooltip when the user hovers/moves/leaves a cell
        // const mouseover = function (event, d) {
        //     tooltip
        //         .style("opacity", 1);
        //     if (this !== selectedCell) { // to ensure that the selected cell still appears selected
        //         d3.select(this)
        //             .style("stroke", "#737373") // Set stroke color to a darker grey
        //             .style("stroke-width", "1.2px")
        //             .style("opacity", 1);  // Make the cell color darker
        //     }
        // };
        //
        // const mousemove = function(event, d) {
        //     if (d.value !== "") {
        //         // Calculate the position of the tooltip relative to the mouse pointer
        //         const tooltipLeft = event.pageX + 10;
        //         const tooltipTop = event.pageY - 50;
        //
        //         // Update the position of the tooltip
        //         tooltip
        //             .html("" + Number(d.value).toFixed(2))
        //             .style("left", tooltipLeft + "px")
        //             .style("top", tooltipTop + "px")
        //             .style("display", "block");
        //     } else {
        //         // If d.value is empty, hide the tooltip
        //         tooltip.style("display", "none");
        //     }
        // };
        //
        // const mouseleave = function (event, d) {
        //     tooltip
        //         .style("opacity", 0);
        //     if (this !== selectedCell) { // Only reset stroke for the unselected cells
        //         d3.select(this)
        //             .style("stroke", "white") // Set stroke color back to white
        //             .style("stroke-width", "0.8px")
        //             .style("opacity", 0.8); // Reset the cell color
        //     }
        // };
        //
        // function getMPForm(shortForm) {
        //     let formLabels = ["biofouled and heteoaggregated", "biofouled", "heteoaggregated", "free microplastic"]
        //     let longForm = "";
        //     shortForm = shortForm.replaceAll(" ", "")
        //
        //     switch (shortForm) {
        //         case 'heterBiofMP':
        //             longForm = formLabels[0]
        //             break;
        //         case 'biofMP':
        //             longForm = formLabels[1]
        //             break;
        //         case 'heterMP':
        //             longForm = formLabels[2]
        //             break;
        //         default:
        //             longForm = formLabels[3]
        //     }
        //     return longForm;
        // }
        //
        // function blurCompartments(currentCompartment) { // TODO need to fix the unblurrign of selected cell's compartment
        //     const selectedElement = d3.select(currentCompartment);
        //     unblurCompartments();
        //
        //     d3.selectAll('.compartment')
        //         .each(function() {
        //             const element = d3.select(this);
        //
        //             if (!element.classed("empty") && !element.classed("new-legend-container") && !element.classed("nothing")) {
        //                 if (this !== selectedElement.node()) {
        //                     element.classed('blurry', true);
        //                 }
        //             }
        //         });
        //     selectedElement.classed('blurry', false);
        // }
        //
        // function unblurCompartments() {
        //     // TODO debuging printout
        //     console.log("UNBLURRING ALL")
        //     d3.selectAll('.compartment')
        //         .classed('blurry', false);
        // }
        //
        // let selectedCell = null; // Variable to store the selected cell
        // // Function to handle cell selection
        // const cellClick = function(event, d) {
        //     event.stopPropagation(); // Disallowing cpompartment selection to take place
        //
        //     unblurCompartments();
        //
        //     if (d.value !== "") { // For cells that have a value
        //         if (selectedCompartment) { // unselecting previously selected compartment
        //             document.getElementById(`detailed-view-compartment`).style.display = 'none';
        //             d3.select(selectedCompartment)
        //                 .style("border", "solid 1px #000");
        //             selectedCompartment = null;
        //         }
        //         if (selectedCell) { // Unselecting previously selected cell
        //             d3.select(selectedCell)
        //                 .style("stroke", "white") // Set stroke color back to white
        //                 .style("opacity", 0.8); // Reset the cell color
        //         }
        //
        //         selectedCell = this; // Update selected cell
        //         const selection = d3.select(selectedCell);
        //         const cellCompartmentName = selection.attr("data-compartment").replaceAll("compartment ", "") + " compartment"
        //         const cellCompartment = d3.select(`.${selection.attr("data-compartment")}`);
        //         const cellMPForm = selection.attr('part-type').toString();
        //
        //         // TODO debugging blurring, need to fix this part here
        //         // console.log(`This is the compartment type: ${cellCompartment.attr("class")}`);
        //         // blurCompartments(cellCompartment);
        //
        //         d3.select(`#cell-info-percentage`) // Update cell info
        //             .html(`Log ${mode} function = ` + Number(d.value).toFixed(2));
        //         d3.select(`#residence-value`) // Update cell info
        //             .html(`Residence time = ${Number(d.value).toFixed(2)}/sum(output_flows)`);
        //         d3.select(`#persistence-value`) // Update cell info
        //             .html(`Persistence = ${Number(d.value).toFixed(2)}/discorporation_flow`);
        //         d3.select('#cell-title')
        //             .html(`${selection.attr('size-bin')} µm ${getMPForm(cellMPForm)} particles in the ${cellCompartmentName}`)
        //
        //         d3.select(this)
        //             .style("stroke", "black") // Set stroke color to black
        //             .style("stroke-width", "2.5px")
        //             .style("opacity", 1);  // Make the cell color darker
        //         // Hide all information containers
        //         document.getElementById(`detailed-view-cell`).style.display = 'none';
        //         document.getElementById(`detailed-view-compartment`).style.display = 'none';
        //         // Display current view container
        //         document.getElementById(`detailed-view-cell`).style.display = 'flex';
        //
        //     } else { // For empty grey cells
        //         document.getElementById(`detailed-view-compartment`).style.display = 'none';
        //         d3.select("#cell-info")
        //             .html("");
        //         // Hide all information containers
        //         document.getElementById(`detailed-view-cell`).style.display = 'none';
        //         d3.select(selectedCell)
        //             .style("stroke", "white") // Set stroke color back to white
        //             .style("opacity", 0.8); // Reset the cell color
        //         selectedCell = null;
        //
        //         if (selectedCompartment) { // Unselecting previously selected compartment
        //             d3.select(selectedCompartment)
        //                 .style("border", "solid 1px #000"); // Reset the compartment border
        //         }
        //     }
        // };
        //
        // // Handling compartment selection
        // let selectedCompartment = null;
        // const compartmentClick = function(event) {
        //     unblurCompartments();
        //     const clickedClass = d3.select(this).attr("class");
        //     console.log(`clicked on ${clickedClass}`);
        //
        //     if (selectedCell) { // Unselecting previously selected cell
        //         document.getElementById(`detailed-view-cell`).style.display = 'none';
        //         d3.select(selectedCell)
        //             .style("stroke", "white") // Set stroke color back to white
        //             .style("stroke-width", "0.8"); // Reset the cell color
        //     }
        //     if (selectedCompartment) { // Unselecting previously selected compartment
        //         d3.select(selectedCompartment)
        //             .style("border", "solid 1px #000"); // Reset the compartment border
        //     }
        //
        //     selectedCompartment = this; // Update selected compartment
        //     console.log(`selectedCompartment class: ${d3.select(selectedCompartment).attr("class")}`)
        //     blurCompartments(selectedCompartment);
        //
        //     d3.select(`#cell-info-compartment`) // Update compartment info
        //         .html(`The ${clickedClass} is selected`);
        //     d3.select(selectedCompartment)
        //         .style("border", "solid 3px #000"); // Change the border to appear sleected
        //
        //     // Hide all information containers
        //     document.getElementById(`detailed-view-cell`).style.display = 'none';
        //     document.getElementById(`detailed-view-compartment`).style.display = 'none';
        //     // Display current view container
        //     document.getElementById(`detailed-view-compartment`).style.display = 'flex';
        // };
        //
        // // Function to create a heatmap for a given compartment
        // function createHeatmap(container, compartmentType, variable) {
        //     if (compartmentType !== "compartment empty" && compartmentType !== "new-legend-container" && compartmentType !== "nothing") {
        //         container.style("cursor", "pointer")
        //             .on("click", compartmentClick);
        //
        //         const svgWrapper = container.append("div")
        //             .attr("class", "white-background");
        //
        //         let svg = svgWrapper.append("svg")
        //             .attr("width", (singleCellSize + singleCellGap) * 5.829)
        //             .attr("height", (singleCellSize + singleCellGap) * 4.56)
        //             .append("svg")
        //             .attr("transform",
        //                 "translate(" + singleMargin.left + "," + singleMargin.top + ")");
        //
        //         const xScale = d3.scaleBand()
        //             .domain(Array.from(mySizeFrac))
        //             .range([0, singleWidth])
        //             .padding(0.01);
        //         svg.append("g")
        //             .attr("transform", "translate(-7," + (singleHeight) + ")")
        //             .call(d3.axisBottom(xScale)
        //                 .tickSize(0)
        //                 .tickFormat(""))
        //             .selectAll("path, line, text")
        //             .style("display", "none");
        //
        //         const yScale = d3.scaleBand()
        //             .domain(Array.from(myMpForm))
        //             .range([singleHeight, 0])
        //             .padding(0.01);
        //         svg.append("g")
        //             .call(d3.axisLeft(yScale)
        //                 .tickSize(0)
        //                 .tickFormat(""))
        //             .selectAll("path, line, text")
        //             .style("display", "none");
        //
        //         // Getting the data for a given variable/myVars element (compartment)
        //         let variableData = newCollections[variable];
        //
        //         // Select all squares and bind data to rect elements
        //         const rects = svg.selectAll("rect")
        //             .data(variableData, d => d.MP_Form + ':' + d.Size_Fraction_um + ':' + d.variable); // <- this is ?
        //
        //         rects.join("rect")
        //             .attr("x", d => xScale(d.Size_Fraction_um))
        //             .attr("y", d => yScale(d.MP_Form))
        //             .attr("width", singleCellSize - singleCellGap)
        //             .attr("height", singleCellSize - singleCellGap)
        //             .attr("fill", d => getColor(d[valueVar]))
        //             .attr("stroke", "white")
        //             .attr("z-index", "9") // lifting up the cells
        //             .style("stroke-width", "0.8px")
        //             .style("opacity", 0.8)
        //             .on("mouseover", mouseover)
        //             .on("mousemove", mousemove)
        //             .on("mouseleave", mouseleave)
        //             .on("click", cellClick)
        //             .attr('data-value', d => d[valueVar])
        //             .attr('data-compartment', compartmentType)
        //             .attr('size-bin', d => d.Size_Fraction_um)
        //             .attr('part-type', d => d.MP_Form);
        //     }
        // }

        // Drawing out the compartments TODO need to refactor this scramble-bamble!!!
        for (let i = 1; i < 6; i++) {
            const row = container.append("div")
                .attr("class", "horiz-area");

            let currentCompartment;
            if (i === 1) {
                currentCompartment = myVars[0];
                const compartmentContainer = row.append("div") // Creating a container for the title and svg
                    .attr("class", "compartment air")
                    .attr("id", "compartment-air")
                    .style("cursor", "pointer")
                    .attr("comp-title", `${currentCompartment}`)
                    .on("click", compartmentClick);

                compartmentContainer.append("div")
                    .attr("class", "compartment-title")
                    .style("text-align", "center")
                    .text(`${currentCompartment}`);

                createHeatmap(compartmentContainer, "compartment air", currentCompartment);

            } else { // TODO need to refactor this scramble-bamble!!!
                // Creating columns within each row
                for (let j = 1; j < 7; j++) {
                    const uniqueNumber = (i - 2) * 6 + j;
                    let compartmentType = "compartment ";
                    let uniqueCompartment = "";
                    let compTitle = "";

                    switch (uniqueNumber) {
                        case 1: // Impacted soil
                        case 7:
                            if (uniqueNumber === 1) {
                                currentCompartment = myVars[2];
                                compTitle = currentCompartment;
                            } else {
                                currentCompartment = myVars[1];
                                compTitle = currentCompartment;
                            }
                            uniqueCompartment = `compartment-${compTitle.toLowerCase().replaceAll("_", "-")}`;
                            break;

                        case 2: // Background Soil
                        case 8:
                            if (uniqueNumber === 2) {
                                currentCompartment = myVars[4];
                                compTitle = currentCompartment;
                            } else {
                                currentCompartment = myVars[3];
                                compTitle = currentCompartment;
                            }
                            uniqueCompartment = `compartment-${compTitle.toLowerCase().replaceAll("_", "-")}`;
                            break;

                        case 3: // Freshwater
                        case 9:
                            if (uniqueNumber === 3) {
                                currentCompartment = myVars[11];
                                compTitle = "Freshwater Surface";
                            } else {
                                currentCompartment = myVars[10];
                                compTitle = "Freshwater";
                            }
                            uniqueCompartment = `compartment-${compTitle.toLowerCase().replaceAll(" ", "-")}`;
                            break;

                        case 4: // Beach
                        case 10:
                            if (uniqueNumber === 4) {
                                currentCompartment = myVars[6];
                                compTitle = "Beach Surface";
                            } else {
                                currentCompartment = myVars[5];
                                compTitle = "Beach Subsurface";
                            }
                            uniqueCompartment = `compartment-${compTitle.toLowerCase().replaceAll(" ", "-")}`;
                            break;

                        case 5: // Coastal Water
                        case 11:
                            if (uniqueNumber === 5) {
                                currentCompartment = myVars[13];
                                compTitle = "Coastal Water Surface";
                            } else {
                                currentCompartment = myVars[12];
                                compTitle = "Coastal Water";
                            }
                            uniqueCompartment = `compartment-${compTitle.toLowerCase().replaceAll(" ", "-")}`;
                            break;

                        case 6: // Ocean
                        case 12:
                        case 18:
                            if (uniqueNumber === 6) {
                                currentCompartment = myVars[16];
                                compTitle = "Ocean Surface";
                            } else if (uniqueNumber === 12) {
                                currentCompartment = myVars[15];
                                compTitle = "Mixed Ocean";
                            } else {
                                currentCompartment = myVars[14];
                                compTitle = "Deep Ocean";
                            }
                            uniqueCompartment = `compartment-${compTitle.toLowerCase().replaceAll(" ", "-")}`;
                            break;

                        case 14: // Freshwater Sediment
                        case 17: // Coastal Water Sediment
                        case 24: // Ocean Sediment
                            if (uniqueNumber === 14) {
                                currentCompartment = myVars[9];
                                compTitle = "Freshwater Sediment";
                            } else if (uniqueNumber === 17) {
                                currentCompartment = myVars[7];
                                compTitle = "Coastal Water Sediment";
                            } else {
                                currentCompartment = myVars[8];
                                compTitle = "Ocean Sediment";
                            }
                            uniqueCompartment = `compartment-${compTitle.toLowerCase().replaceAll(" ", "-")}`;
                            break;

                        default:
                            uniqueCompartment = `compartment-${uniqueNumber}`;
                            if (uniqueNumber === 13) {
                                compartmentType = "new-legend-container";
                            } else if (uniqueNumber === 15) {
                                compartmentType = "nothing";
                            } else {
                                compartmentType = "compartment empty";
                            }
                            break;
                    }
                    compartmentType += compTitle.replaceAll("_", " ").toLowerCase()
                    row.append("div")
                        .attr("class", `${compartmentType}`)
                        .attr("id", `${uniqueCompartment}`)
                        .attr("comp-title", compTitle)
                        .text(`${compTitle.replaceAll("_", " ")}`)
                        .style("font-geight", "normal");

                    let compartmentContainer = d3.select(`#${uniqueCompartment}`);
                    createHeatmap(compartmentContainer, compartmentType, currentCompartment)
                }
            }
            let masterContainer = document.getElementById('legend-container');
            masterContainer.style.display = "none"; // Reveal the model run information box
        }

        // Append the new legend container
        const cont13 = d3.select("#compartment-13");
        const newLegendContainer = cont13.append("div")
            .attr("class", "new-legend-container");

        newLegendContainer.append("h6")
            .text(`Fraction of total plastic`)
            .style("font-size", '16px')
            .style("text-align", "center");

        if (mode === "mass") {
            newLegendContainer.append("h6")
                .text(`mass`)
                .style("font-size", '16px')
                .style("text-align", "center");
        } else {
            newLegendContainer.append("h6")
                .text(`particle number`)
                .style("font-size", '16px')
                .style("text-align", "center");
        }

        // Constants for the legend
        const legendWidth = 17;
        const legendHeight = 220;
        // Remove any existing legend
        d3.select('#new-legend').remove();

        const newLegendSvg = newLegendContainer.append("div")
            .attr("id", "new-legend")
            .append("svg")
            .attr("transform", `translate(290, -35)`)
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
            .style("stroke-width", 0.8)
            .style("fill", "url(#linear-gradient)")
            .style("opacity", 0.8);

        // Add the scale for the legend
        const superscripts = "⁰¹²³⁴⁵⁶⁷⁸⁹";
        newLegendSvg.append("g")
            .attr("transform", `translate(${legendWidth}, 6)`)
            .attr("height", legendHeight - 10)
            .style("stroke-width", 0.0)
            .style("font-size", '15px')
            .style("font-weight", 'normal')
            .call(d3.axisRight(legendScale)
                .tickValues([-10, -1])
                .tickSize(0)  // No visible ticks
                .tickFormat(d => `10\u207B${Math.abs(d).toString().split('').map(digit => superscripts[digit]).join('')}`));

        // Labels for x- and y-axis
        let xAxisLabels = [5000, 500, 50, 5, 0.5]
        let yAxisLabels = ["Biofouled & Heteoagg.", "Biofouled", "Heteoaggregated", "Free Microplastic"]
        // Variables the legend matrix
        const cellSize = 19;
        const cellGap = 0.02;
        let legendMargin = {top: 0, right: 30, bottom: 70, left: 110},
            legWidth = 270 - margin.left - margin.right,
            legHeight = 290 - margin.top - margin.bottom;

        // Creating svg for the legend matrix and its axes
        let svg = d3.select("#new-legend")
            .append("svg")
            .attr("width", 255)
            .attr("height", legHeight + legendMargin.top + legendMargin.bottom)
            .attr("transform",
                "translate(" + -30 + "," + -20 + ")")
            .append("g")
            .attr("transform",
                "translate(" + legendMargin.left + "," + legendMargin.top + ")");

        // Build x scales and axis:
        let x = d3.scaleBand()
            .range([0, legWidth])
            .domain(xAxisLabels)
            .padding(0.01);
        const xaxis = svg.append("g")
            .attr("transform", "translate(-6," + (legHeight) + ")")
            .call(d3.axisBottom(x)
                .tickSize(0));
        xaxis.selectAll("text").style("font-size", "11px")
        xaxis.selectAll("text").style("font-weight", "normal");
        xaxis.selectAll("text").attr("transform", "rotate(-90)");
        xaxis.selectAll("text").attr("text-anchor", "end");
        xaxis.selectAll("path").style("stroke", "none");

        // Build y scales and axis:
        let y = d3.scaleBand()
            .range([legHeight, 0 ])
            .domain(yAxisLabels)
            .padding(0.01);
        const yaxis = svg.append("g")
            .call(d3.axisLeft(y)
                .tickSize(0));
        yaxis.selectAll("text").style("font-size", "11px");
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
                    .attr("stroke-width", 0.5)
                    .attr("stroke", "black");
            }
        }
        // Add x scale explanation underneath the legend
        svg.append("text")
            .attr("x", legWidth / 2 - 1)
            .attr("y", 143)
            .attr("text-anchor", "middle")
            .style("font-size", "14px")
            .style("font-weight", "lighter")
            .text("Size Class (µm)");
    }

    // Add event listener for button click
    runButton.addEventListener('click', function() {
        document.getElementById('loading-spinner').style.display = 'block'; // Loading animation
        document.getElementById('main-content').classList.add('blur'); // Blurring the background
        // Hide all information containers
        unselectEverything();
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
                assembleCompHeatMap('Mass Fraction Distribution Heatmap' , utopia_model_results.mass_fraction_distribution_heatmap, "mass", utopia_model_results.extended_csv_table);
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
                    switch (element) {
                        case "freeMP":
                            cleanName = "Free"; // free microplastics
                            break
                        case "heterMP":
                            cleanName = "Heter"; // heteroaggregated
                            break
                        case "biofMP":
                            cleanName = "Biof"; // biofouled
                            break
                        default:
                            cleanName = "HeterBiof"; // heteroaggregted and biofouled
                        }
                    fieldValueArray.push(cleanName);
                } else if (i === 2) { // Check to make Emission Scenario size bin field presentable
                    let numValue = 0;
                    switch (element) {
                        case "a":
                            numValue = "0.5μm";
                            break
                        case "b":
                            numValue = "5μm";
                            break
                        case "c":
                            numValue = "50μm";
                            break
                        case "d":
                            numValue = "500μm";
                            break
                        default:
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
    let comp_mass_fraction_distribution_btn = document.getElementById('comp_mass_fraction_distribution_btn')
    let comp_number_fraction_distribution_btn = document.getElementById('comp_number_fraction_distribution_btn')

    comp_mass_fraction_distribution_btn.addEventListener('click', function() {
        if(utopia_model_results !== null){
            // Hide all information containers
            unselectEverything();
            // Removing selection from the other
            comp_number_fraction_distribution_btn.classList.remove('active');
            // Highlighting selection on the navbar
            comp_mass_fraction_distribution_btn.classList.add('active');
            assembleCompHeatMap('Mass Fraction Distribution Heatmap' , utopia_model_results.mass_fraction_distribution_heatmap, "mass", utopia_model_results.extended_csv_table);
        }
    });
    comp_number_fraction_distribution_btn.addEventListener('click', function() {
        if(utopia_model_results !== null){
            // Hide all information containers
            unselectEverything();
            // Removing selection from the other
            comp_mass_fraction_distribution_btn.classList.remove('active');
            // Highlighting selection on the navbar
            comp_number_fraction_distribution_btn.classList.add('active');
            assembleCompHeatMap('Number Fraction Distribution Heatmap' , utopia_model_results.number_fraction_distribution_heatmap, "number", utopia_model_results.extended_csv_table);
        }
    });
});