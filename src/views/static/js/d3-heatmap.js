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
                // fragmentation_range: document.getElementById('customFragmentationRange').value;
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
            if (selectedCell) { // unselecting previously selected cell
                d3.select(selectedCell)
                    .style("stroke", "white") // set stroke color back to white
                    .style("stroke-width", "0.8px")
                    .style("opacity", 0.7); // reset the cell color
            }
        }
    }

    // Function to unselect selections and display the global overview info on right
    function unselectWithGlobal() {
        unselectEverything();
        d3.select("#global-view").style("display", "flex");
    }

    // Function to unblur all compartments
    function unblurCompartments() {
        d3.selectAll('.compartment')
            .classed('blurry', false);
    }

    // Function to round large floats to give a more precise and visually appealing number.
    function roundDynamiucFloat(value) {
        let num = Number(value).toFixed(10);

        if (num < 0.0000000005) {
            return "< 0.0000000005";
        } else if (num < 0.000000005) {
            return Number(num).toFixed(9);
        } else if (num < 0.00000005) {
            return Number(num).toFixed(8);
        } else if (num < 0.0000005) {
            return Number(num).toFixed(7);
        } else if (num < 0.000005) {
            return Number(num).toFixed(6);
        } else if (num < 0.00005) {
            return Number(num).toFixed(5);
        } else if (num < 0.0005) {
            return Number(num).toFixed(4);
        } else if (num < 0.005) {
            return Number(num).toFixed(3);
        } else {
            return Number(num).toFixed(2);
        }
    }

    // Building the new heatmaps with respect to compartments
    let assembleHeatMap = function(title, csvText, mode, csvExtended) {
        // remove any existing heatmap
        d3.select('#heatmap-container').selectAll('*').remove();
        // set the dimensions and margins of the graph
        const margin = {top: 50, right: 5, bottom: 150, left: 150},
            viewportWidth = 810,
            viewportHeight = window.innerHeight * 0.6,
            width = viewportWidth - margin.left - margin.right,
            height = viewportHeight - margin.top - margin.bottom;
        const heatmapContainerHeight = height + margin.top + margin.bottom * 2 + 30;
        // append the SVG element to the body of the page
        const container = d3.select("#heatmap-container")
            .attr("width", width + 160)
            .attr("height", heatmapContainerHeight)
            .on("click", unselectEverything) // closing info column only when ckicked in heatmap area to let user copy info column elements
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        // Update the text size of the title
        container.append("text")
            .attr("id", "main-title")
            .attr("x", 255) // Title's position on the x-axis
            .attr("y", -20)
            .attr("text-anchor", "middle")
            .style("grid-template-columns", "repeat(6, 1fr)")
            .style("margin-bottom", "30px")
            .text(title);

        let data = d3.csvParse(csvExtended);
        const myGroups = Array.from(new Set(data.map(d => d.group))).reverse();
        const myVars = Array.from(new Set(data.map(d => d.variable))).reverse();

        let myValues = null;
        // Column labels for fetching different properties for selected cell (different for mass and particle number)
        let fraction = null;
        let originFraction = null;
        let cellResidence = null;
        let cellPersistence = null;
        let totalInflow = null;
        let inflows = null;
        let totalOutflow = null;
        let outflows = null;

        // Getting the values depending on mode and storing appropriate column labels
        if (mode === "mass") {
            myValues = data.map(d => parseFloat(d.mass));
            fraction = 'mass';
            originFraction = 'mass_fraction';
            cellResidence = 'Residence_time_mass_years';
            cellPersistence = 'Persistence_time_mass_years';
            totalInflow = 'Total_inflows_g_s';
            inflows = 'inflows_g_s';
            totalOutflow = 'Total_outflows_g_s';
            outflows = 'outflows_g_s';
            // detailedInfoItems.set("fraction", 'mass_fraction');
        } else {
            myValues = data.map(d => parseFloat(d.number));
            fraction = 'number';
            originFraction = 'number_fraction';
            cellResidence = 'Residence_time_num_years';
            cellPersistence = 'Persistence_time_num_years';
            totalInflow = 'Total_inflows_num_s';
            inflows = 'inflows_num_s';
            totalOutflow = 'Total_outflows_num_s';
            outflows = 'outflows_num_s';
            // detailedInfoItems.set("fraction", 'number_fraction');
        }

        const collections = {}; // for storing data for each compartment separately
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
            if (value === '' || value === 0 || Number.isNaN(value)) {
                return '#EDEDED'; // color for empty values
            } else {
                return myColor(value); // scalar color for other values
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
                    .style("stroke", "#737373") // set stroke color to a darker grey
                    .style("stroke-width", "1.2px")
                    .style("opacity", 1);  // make the cell color darker
            }
        };

        const mousemove = function(event, d) {
            if (d[fraction] !== "" && d[fraction] !== 0 && d[fraction] !== "0" && !Number.isNaN(d[fraction])) { // <--adjusted for extended data
                // Calculate the position of the tooltip relative to the mouse pointer
                const tooltipLeft = event.pageX + 10;
                const tooltipTop = event.pageY - 50;

                let totPercentage = roundDynamiucFloat((d[originFraction] * 100));

                // Update the position of the tooltip
                tooltip
                    .html(`Log ${mode} fraction: ${Number(d[fraction]).toFixed(2)}<br>% of total ${mode} = ${totPercentage}%`) // <--------------- with extended data
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
                .html('')
                .style("opacity", 0);
            if (this !== selectedCell) { // only reset stroke for the unselected cells
                d3.select(this)
                    .style("stroke", "white") // set stroke color back to white
                    .style("stroke-width", "0.8px")
                    .style("opacity", 0.7); // reset the cell color
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

        // Function to add flows information to given d3 flow element
        function addFlowToTable(tableRow, flowName, value, flowPercentage) {
            let flowValue = roundDynamiucFloat(value);
            let percentage = roundDynamiucFloat(flowPercentage);

            tableRow.append("td")
                .text(`${flowName.charAt(0).toUpperCase()}${flowName.slice(1)}`);
            tableRow.append("td").text(`${flowValue}`);
            tableRow.append("td").text(` `);
            tableRow.append("td").text(`${percentage}`);
        }

        // Function to add an empty placeholder entry to flows table for cells with now inflows-outflows
        function addEmptyFlow(tableRow) {
            tableRow.append("th").text(` `);
            tableRow.append("td").text(`< 0.0000000005`);
            tableRow.append("td").text(` `);
            tableRow.append("td").text(`< 0.0000000005`);
        }

        // Function to handle cell selection
        const cellClick = function(event, d) {
            event.stopPropagation(); // disallowing cpompartment selection to take place
            unselectEverything();

            if (d[fraction] !== "" && d[fraction] !== 0 && d[fraction] !== "0" && !Number.isNaN(d[fraction])) { // for cells that have a value
                selectedCell = this; // update selected cell
                const selection = d3.select(selectedCell);
                const cellCompartment = selection.attr("data-compartment").replaceAll("compartment ", "") + " compartment"
                const cellMPForm = selection.attr('part-type').toString();
                const compName = d3.select(selectedCell).attr("data-compartment").replaceAll(" ", "-");
                const selectedComp = (d3.select(`#${compName}`));
                blurCompartments(selectedComp);

                // populating the title
                d3.select('#cell-title')
                    .html(`${selection.attr('size-bin')} µm ${getMPForm(cellMPForm)} particles in the ${cellCompartment}`);

                // populating the detailed information fields
                let totalPercentage = roundDynamiucFloat(selection.attr('total-percent'));

                // updating cell information in detailed view
                d3.select(`#cell-info-percentage`)
                    .html(`Log ${mode} fraction = ` + Number(d[fraction]).toFixed(2));
                d3.select(`#total-percent`)
                    .html(`% of total ${mode} = ${totalPercentage}%`);
                d3.select(`#residence-value`)
                    .html(`Residence time = ${Math.round(selection.attr('residence'))} (years)`);
                d3.select(`#persistence-value`)
                    .html(`Persistence = ${Math.round(selection.attr('persistance'))} (years)`);

                // populating total inflows and outflows
                let totalInflow = Number(selection.attr('total-inflow')).toFixed(4);
                let totalOutflow = Number(selection.attr('total-outflow')).toFixed(4);
                d3.select('#total-inflow')
                    .html(`${totalInflow}`);
                d3.select('#total-outflow')
                    .html(`${totalOutflow}`);
                // getting the inflows and outflows and converting them into Maps
                let inflowsString = (selection.attr('inflows')).replace(/'/g, '"');
                let outflowsString = (selection.attr('outflows')).replace(/'/g, '"');
                let inflowsObj = JSON.parse(inflowsString);
                let outflowsObj = JSON.parse(outflowsString);
                let inflowsMap = new Map(Object.entries(inflowsObj));
                let outflowsMap = new Map(Object.entries(outflowsObj));

                // filling the inflows and outflows table
                const inflowContainer = d3.select('#inflows-table');
                const inflowsBody = d3.select("#inflows-body");
                inflowsBody.selectAll('*').remove();

                // listing all the inflows if there are any
                if (totalInflow > 0) {
                    let inflowsArray = Array.from(inflowsMap);
                    inflowsArray.sort((a, b) => b[1] - a[1]);
                    inflowsMap = new Map(inflowsArray);

                    inflowsMap.forEach((value, key) => {
                        let inflowName = key.replaceAll("k_", "").replaceAll("_", " ");
                        let inflowPercentage = (100 * Number(value).toFixed(4)) / totalInflow;
                        let inflowsTableRow = inflowsBody.append("tr"); // creating the row entry per inflow item
                        // Listing the elements in the table
                        addFlowToTable(inflowsTableRow, inflowName, value, inflowPercentage);
                    });
                } else { // if no inflows then showing one row with a less than <minimum value>
                    let inflowsTableRow = inflowsBody.append("tr");
                    addEmptyFlow(inflowsTableRow);
                }
                const outflowContainer = d3.select('#outflows-table');
                const outflowsBody = d3.select("#outflows-body");
                outflowsBody.selectAll('*').remove();

                // listing all the outflows if there are any
                if (totalOutflow > 0) {
                    // ordering the outflows to decending order
                    let outflowsArray = Array.from(outflowsMap);
                    outflowsArray.sort((a, b) => b[1] - a[1]);
                    outflowsMap = new Map(outflowsArray);

                    outflowsMap.forEach((value, key) => {
                        let outflowName = key.replaceAll("k_", "").replaceAll("_", " ");
                        let outflowPercentage = (100 * Number(value).toFixed(4)) / totalOutflow;
                        let outflowsTableRow = outflowsBody.append("tr");

                        addFlowToTable(outflowsTableRow, outflowName, value, outflowPercentage);
                    });
                } else { // if no inflows then showing one row with a less than <minimum value>
                    let outflowsTableRow = outflowsBody.append("tr");
                    addEmptyFlow(outflowsTableRow);
                }

                d3.select(this)
                    .style("stroke", "black") // set stroke color to black
                    .style("stroke-width", "3px")
                    .style("opacity", 1);  // make the cell color darker
                // Display current view container
                document.getElementById(`detailed-view-cell`).style.display = 'flex';

            } else { // for empty grey cells
                document.getElementById(`detailed-view-compartment`).style.display = 'none';
                d3.select("#cell-info")
                    .html("");
                // Hide all information containers
                document.getElementById(`detailed-view-cell`).style.display = 'none';
                d3.select(selectedCell)
                    .style("stroke", "white") // set stroke color back to white
                    .style("stroke-width", "0.8px")
                    .style("opacity", 0.7); // reset the cell color
                selectedCell = null;

                if (selectedCompartment) { // unselecting previously selected compartment
                    d3.select(selectedCompartment)
                        .style("border", "solid 1px #000"); // reset the compartment border
                }
            }
        };

        // Function to create a heatmap for a given compartment
        function createHeatmap(container, compartmentType, variable) {
            if (compartmentType !== "compartment empty" && compartmentType !== "new-legend-container" && compartmentType !== "nothing") {

                const svgWrapper = container.append("div")
                    .attr("class", "white-background");

                let svg = svgWrapper.append("svg")
                    .attr("width", (singleCellSize + singleCellGap) * 5.83)
                    .attr("height", (singleCellSize + singleCellGap) * 4.57)
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
                    .attr("fill", d => getColor(parseFloat(d[fraction])))
                    .attr("total-percent", d => (Number(d[originFraction] * 100)))
                    .attr("residence", d => parseFloat(d[cellResidence]))
                    .attr("persistance", d => parseFloat(d[cellPersistence]))
                    .attr("total-inflow",  d => parseFloat(d[totalInflow]))
                    .attr("total-outflow",  d => parseFloat(d[totalOutflow]))
                    .attr("inflows",  d => d[inflows])
                    .attr("outflows",  d => d[outflows])
                    .attr("stroke", "white")
                    .attr("z-index", "9") // lifting up the cells
                    .style("stroke-width", "0.8px")
                    .style("opacity", 0.7)
                    .style("cursor", "pointer")
                    .on("mouseover", mouseover)
                    .on("mousemove", mousemove)
                    .on("mouseleave", mouseleave)
                    .on("click", cellClick)
                    .attr('data-value', d => parseFloat(d[fraction]))
                    .attr('data-compartment', compartmentType)
                    .attr('size-bin', d => parseGroup(d.group).size)
                    .attr('part-type', d => parseGroup(d.group).type);
            }
        }

        // Drawing out the compartments TODO need to refactor this scramble-bamble!!!
        for (let i = 1; i < 6; i++) {
            const row = container.append("div")
                .attr("class", "horiz-area");

            let currentCompartment;
            if (i === 1) {
                currentCompartment = myVars[0];
                const compartmentContainer = row.append("div") // creating a container for the title and svg
                    .attr("class", "compartment air")
                    .attr("id", "compartment-air")
                    .attr("comp-title", `${currentCompartment}`);

                compartmentContainer.append("div")
                    .attr("class", "compartment-title")
                    .style("text-align", "center")
                    .text(`${currentCompartment}`);

                createHeatmap(compartmentContainer, "compartment air", currentCompartment);

            } else {
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
                        .style("font-weight", "bold");

                    let compartmentContainer = d3.select(`#${uniqueCompartment}`);
                    createHeatmap(compartmentContainer, compartmentType, currentCompartment)
                }
            }
            let masterContainer = document.getElementById('legend-container');
            masterContainer.style.display = "none"; // reveal the model run information box
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
            .attr("width", legendWidth + 50)  // additional space for axis
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
            .style("opacity", 0.7);

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

    // Building the global distribution overview
    let assembleGlobalView = function(title, mode, csvExtendedComp, globalInfo) {
        // Remove any existing heatmap
        d3.select('#heatmap-container').selectAll('*').remove();
        d3.select('#global-exposure').html(`Overall exposure indicators ${mode}`);
        // Set the dimensions and margins of the graph
        const margin = {top: 50, right: 5, bottom: 150, left: 150},
            viewportWidth = 810,
            viewportHeight = window.innerHeight * 0.6,
            width = viewportWidth - margin.left - margin.right,
            height = viewportHeight - margin.top - margin.bottom;
        const heatmapContainerHeight = height + margin.top + margin.bottom * 2 + 30;
        // Append the SVG element to the body of the page
        const container = d3.select("#heatmap-container")
            .attr("width", width + 160)
            .attr("height", heatmapContainerHeight)
            .on("click", unselectWithGlobal)
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        // Update the text size of the title
        container.append("text")
            .attr("id", "main-title")
            .attr("x", 255) // title's position on the x-axis
            .attr("y", -20)
            .attr("text-anchor", "middle")
            .style("grid-template-columns", "repeat(6, 1fr)")
            .style("margin-bottom", "30px")
            .text(title);

        // * * * * * * * * * * * * * * * * Global data * * * * * * * * * * * * * * * * * *
        let globalData = d3.csvParse(globalInfo);
        let globalMap = new Map();
        globalData.forEach(row => {
            // converting dataframe elements to Map elements
            globalMap.set(row.variable, row.value);
        });
        let difference = 'Difference';
        let pov = null;
        let tov = null;
        let ctd = null;
        let povDict = 'Pov_size_dict_years';
        let tovDict = 'Tov_size_dict_years';
        // Getting the values depending on mode and storing appropriate column labels
        if (mode === "mass") {
            pov = 'Pov_mass_years';
            tov = 'Tov_mass_years';
            ctd = 'CTD_mass';
        } else {
            pov = 'Pov_num_years';
            tov = 'Tov_num_years';
            ctd = 'CTD_num';
        }

        // * * * * * * * * * * * * * * * * Compartment data * * * * * * * * * * * * * * * * * *
        let data = d3.csvParse(csvExtendedComp);
        const myVars = Array.from(new Set(data.map(d => d.Compartments))).reverse();

        const collections = {}; // for storing data for each compartment separately
        // Dividing the data according to myVars elements (compartments)
        myVars.forEach(variable => {
            collections[variable] = data.filter(d => d.variable === variable);
        });

        // Column labels for fetching different properties for selected compartment (different for mass and particle number)
        let compSize = null;
        let compPercent = null;
        let compConcentration = null;
        let compResidence = null;
        let compPersistence = null;
        let compInflows = null;
        let compOutflows = null;

        // Getting the values depending on mode and storing appropriate column labels
        if (mode === "mass") {
            compSize = 'mass_g';
            compPercent = 'percent_mass';
            compConcentration = 'Concentration_g_m3';
            compResidence = 'Residence_time_mass_years';
            compPersistence = 'Persistence_time_mass_years';
            compInflows = 'inflows_g_s';
            compOutflows = 'outflows_g_s';
        } else {
            compSize = 'number_of_particles';
            compPercent = 'percent_number';
            compConcentration = 'Concentration_num_m3';
            compResidence = 'Residence_time_num_years';
            compPersistence = 'Persistence_time_num_years';
            compInflows = 'inflows_num_s';
            compOutflows = 'outflows_num_s';
        }

        // Create a tooltip
        const tooltip = d3.select("#heatmap-container")
            .append("div")
            .style("opacity", 0)
            .attr("class", "tooltip");

        // Three functions that change the tooltip when the user hovers/moves/leaves a compartment
        const mouseover = function (event, d) {
            tooltip
                .style("opacity", 1);
            if (this !== selectedCompartment) { // to ensure that the selected cell still appears selected
                d3.select(this)
                    .style("stroke", "black") // set stroke color to a darker grey
                    .style("stroke-width", "1.5px")
                    .style("opacity", 1.5);  // make the cell color darker
            }
        };

        const mousemove = function(event, d) {
            // Calculate the position of the tooltip relative to the mouse pointer
            const tooltipLeft = event.pageX + 10;
            const tooltipTop = event.pageY - 50;

            // Update the position of the tooltip
            tooltip
                .html(`Concentration (in ${mode}/m\u00B3) = ${d3.select(this).attr('comp-concentration')} <br>% of total ${mode} in the system = ${roundDynamiucFloat(d3.select(this).attr('comp-percent'))} % <br> Persistence = ${d3.select(this).attr('comp-persistence')} <br>Residence time = ${d3.select(this).attr('comp-residence')} (years)`)
                .style("left", tooltipLeft + "px")
                .style("top", tooltipTop + "px")
                .style("display", "block");
        };

        const mouseleave = function (event, d) {
            tooltip
                .html('')
                .style("opacity", 0);
            if (this !== selectedCell) { // only reset stroke for the unselected cells
                d3.select(this)
                    .style("stroke", "black") // set stroke color back to white
                    .style("stroke-width", "0.8px")
                    .style("opacity", 0.9); // reset the cell color
            }
        };

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

        // Function to add the %, pov, and tov to global table
        function addFlowToGlobalTable(tableRow, flowName, tovValue, povValue) {

            if (tovValue === "NaN") {
                tableRow.append("td").text(`${flowName}`);
                tableRow.append("td").text(`-`);
                tableRow.append("td").text(`-`);
                tableRow.append("td").text(`-`);
            } else {
                tableRow.append("td").text(`${flowName}`);
                tableRow.append("td").text(`-`);
                tableRow.append("td").text(`${povValue}`);
                tableRow.append("td").text(`${tovValue}`);
            }
        }

        // Function to add flows information to given d3 flow element
        function addFlowToTable(tableRow, flowName, value) {
            let flowValue = roundDynamiucFloat(value);

            tableRow.append("td")
                .text(`${flowName.charAt(0).toUpperCase()}${flowName.slice(1)}`);
            tableRow.append("td").text(`${flowValue}`);
            // tableRow.append("td").text(` `);
            tableRow.append("td").text(` `);
        }

        // Handling compartment selection
        const compartmentClick = function(event) {
            event.stopPropagation();
            unselectEverything();
            d3.select("#global-view").style("display", "none");
            const clickedClass = d3.select(this).attr("class");

            selectedCompartment = this; // update selected compartment
            let selection = d3.select(selectedCompartment);
            blurCompartments(selection);
            selection.style("border", "solid 3px #000"); // change the border to appear selected
            d3.select('#compartment-title')
                .html(`${d3.select(selectedCompartment).attr('comp-title')} Compartment`);
            // adding general info about selected compartment
            d3.select(`#comp-concentration`)
                .html(`Concentration (in ${mode}/m\u00B3) = ${d3.select(selectedCompartment).attr('comp-concentration')}`);
            d3.select(`#comp-total-percent`)
                .html(`% of total ${mode} = ${roundDynamiucFloat(d3.select(selectedCompartment).attr('comp-percent'))} %`);
            d3.select(`#comp-persistence`)
                .html(`Persistence = ${d3.select(selectedCompartment).attr('comp-persistence')}`);
            d3.select(`#comp-residence`)
                .html(`Residence time = ${d3.select(selectedCompartment).attr('comp-residence')} (years)`);

            // getting the inflows and outflows and converting them into Maps
            let inflowsString = (selection.attr('comp-inflows')).replace(/'/g, '"');
            let outflowsString = (selection.attr('comp-outflows')).replace(/'/g, '"');
            let inflowsObj = JSON.parse(inflowsString);
            let outflowsObj = JSON.parse(outflowsString);
            let inflowsMap = new Map(Object.entries(inflowsObj));
            let outflowsMap = new Map(Object.entries(outflowsObj));

            // filling the inflows and outflows table
            const inflowContainer = d3.select('#comp-inflows-table');
            const inflowsBody = d3.select("#comp-inflows");
            inflowsBody.selectAll('*').remove();

            let inflowsArray = Array.from(inflowsMap);
            inflowsArray.sort((a, b) => b[1] - a[1]);
            inflowsMap = new Map(inflowsArray);

            let totalCompInflow = 0;
            inflowsMap.forEach((value, key) => {
                totalCompInflow += value; // coputing total
                let inflowName = key.replaceAll("k_", "").replaceAll("_", " ");
                let inflowsTableRow = inflowsBody.append("tr"); // creating the row entry per inflow item
                // Listing the elements in the table
                addFlowToTable(inflowsTableRow, inflowName, value);
            });
            d3.select('#comp-total-inflow').text(roundDynamiucFloat(totalCompInflow));

            const outflowContainer = d3.select('#comp-outflows-table');
            const outflowsBody = d3.select("#comp-outflows");
            outflowsBody.selectAll('*').remove();

            // ordering the outflows to decending order
            let outflowsArray = Array.from(outflowsMap);
            outflowsArray.sort((a, b) => b[1] - a[1]);
            outflowsMap = new Map(outflowsArray);

            let totalCompOutflow = 0;
            outflowsMap.forEach((value, key) => {
                totalCompOutflow += value; // coputing total
                let outflowName = key.replaceAll("k_", "").replaceAll("_", " ");
                let outflowsTableRow = outflowsBody.append("tr");

                addFlowToTable(outflowsTableRow, outflowName, value);
            });
            d3.select('#comp-total-outflow').text(roundDynamiucFloat(totalCompOutflow));

            // Display current view container
            document.getElementById(`detailed-view-compartment`).style.display = 'flex';
        };

        // Drawing out the compartments
        for (let i = 1; i < 6; i++) {
            const row = container.append("div")
                .attr("class", "horiz-area");

            let currentCompartment;
            if (i === 1) {
                currentCompartment = myVars[0];
                const compartmentContainer = row.append("div") // creating a container for the title and svg
                    .attr("class", "compartment air")
                    .attr("id", "compartment-air")
                    .style("cursor", "pointer")
                    .attr("comp-title", `${currentCompartment}`)
                    .on("click", compartmentClick)
                    .style("capacity", 0.9)
                    .style("font-weight", "normal")
                    .attr("mode", mode)
                    .attr("current-compartment", currentCompartment)
                    .attr("comp-size", parseFloat(collections[currentCompartment][0][compSize]))
                    .attr("comp-percent", (collections[currentCompartment][0][compPercent]))
                    .attr("comp-concentration", roundDynamiucFloat(parseFloat(collections[currentCompartment][0][compConcentration])))
                    .attr("comp-residence", Math.round(parseFloat(collections[currentCompartment][0][compResidence])))
                    .attr("comp-persistence", Math.round(parseFloat(collections[currentCompartment][0][compPersistence])))
                    .attr("comp-inflows", collections[currentCompartment][0][compInflows])
                    .attr("comp-outflows", collections[currentCompartment][0][compOutflows])
                    .on("mouseover", mouseover)
                    .on("mousemove", mousemove)
                    .on("mouseleave", mouseleave);

                compartmentContainer.append("div")
                    .attr("class", "compartment-title")
                    .style("text-align", "center")
                    .style("margin-bottom", "8px")
                    .text(`${currentCompartment}`);
                compartmentContainer.append("div")
                    .attr("class", "compartment-field")
                    .text(`C = ${roundDynamiucFloat(parseFloat(collections[currentCompartment][0][compConcentration]))}`);
                compartmentContainer.append("div")
                    .attr("class", "compartment-field")
                    .text(`${roundDynamiucFloat(collections[currentCompartment][0][compPercent])} %`);
                compartmentContainer.append("div")
                    .attr("class", "compartment-field")
                    .text(`Persistance = ${Math.round(parseFloat(collections[currentCompartment][0][compPersistence]))}`);
                compartmentContainer.append("div")
                    .attr("class", "compartment-field")
                    .text(`Residence = ${Math.round(parseFloat(collections[currentCompartment][0][compResidence]))}`);

            } else {
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
                        .attr("comp-title", compTitle.replaceAll('_', ' '))
                        .text(`${compTitle.replaceAll("_", " ")}`)
                        .style("font-weight", "bold");

                    let compartmentContainer = d3.select(`#${uniqueCompartment}`);
                    if (compartmentType !== "compartment empty" && compartmentType !== "new-legend-container" && compartmentType !== "nothing") {
                        compartmentContainer.style("cursor", "pointer")
                            .style("capacity", 0.9)
                            .attr("mode", mode)
                            .attr("current-compartment", currentCompartment)
                            .attr("comp-size", parseFloat(collections[currentCompartment][0][compSize]))
                            .attr("comp-percent", (collections[currentCompartment][0][compPercent]))
                            .attr("comp-concentration", roundDynamiucFloat(parseFloat(collections[currentCompartment][0][compConcentration])))
                            .attr("comp-residence", Math.round(parseFloat(collections[currentCompartment][0][compResidence])))
                            .attr("comp-persistence", Math.round(parseFloat(collections[currentCompartment][0][compPersistence])))
                            .attr("comp-inflows", collections[currentCompartment][0][compInflows])
                            .attr("comp-outflows", collections[currentCompartment][0][compOutflows])
                            .on("click", compartmentClick)
                            .on("mouseover", mouseover)
                            .on("mousemove", mousemove)
                            .on("mouseleave", mouseleave);

                        compartmentContainer.append("div")
                            .attr("class", "compartment-field")
                            .style("margin-top", "8px")
                            .text(`C = ${roundDynamiucFloat(parseFloat(collections[currentCompartment][0][compConcentration]))}`);
                        compartmentContainer.append("div")
                            .attr("class", "compartment-field")
                            .text(`${roundDynamiucFloat(collections[currentCompartment][0][compPercent])} %`);
                        compartmentContainer.append("div")
                            .attr("class", "compartment-field")
                            .text(`Persistance = ${Math.round(parseFloat(collections[currentCompartment][0][compPersistence]))}`);
                        compartmentContainer.append("div")
                            .attr("class", "compartment-field")
                            .text(`Residence = ${Math.round(parseFloat(collections[currentCompartment][0][compResidence]))}`);
                    }
                }
            }
            let masterContainer = document.getElementById('legend-container');
            masterContainer.style.display = "none"; // reveal the model run information box
        }
        // Append the new legend container
        const cont13 = d3.select("#compartment-13");
        const newLegendContainer = cont13.append("div")
            .attr("class", "new-legend-container");

        let differenceString = globalMap.get(difference);
        let differenceParts = differenceString.split("e");
        // Populating the global information fields
        d3.select('#difference')
            .html(`Difference inflow-outflow = ${Number(parseFloat(differenceParts[0])).toFixed(2)}e${differenceParts[1]} (g)`);
        d3.select('#global-persistence')
            .html(`Overall persistence (Pov): ${Math.round(globalMap.get(pov))} years`);
        d3.select('#global-residence')
            .html(`Overall residence time (Tov): ${Math.round(globalMap.get(tov))} years`);
        d3.select('#global-travel')
            .html(`Characteristic travel distance (CTD): ${Math.round(globalMap.get(ctd))} years`);

        // getting the inflows and outflows and converting them into Maps
        let povBySizeString = (globalMap.get(povDict)).replace(/'/g, '"');
        let tovBySizeString = (globalMap.get(tovDict)).replace(/'/g, '"');
        let povBySizeObj = JSON.parse(povBySizeString);
        let tovBySizeObj = JSON.parse(tovBySizeString);
        let povBySizeMap = new Map(Object.entries(povBySizeObj));
        let tovBySizeMap = new Map(Object.entries(tovBySizeObj));

        // populating the %, pov, and tov table
        const povBySizeContainer = d3.select('#global-table');
        const povBySizeBody = d3.select("#global-table-body");
        povBySizeBody.selectAll('*').remove();

        d3.select('#global-number').html(`% ${mode}`)
        // getting the pov, and tov per fraction size for the table
        povBySizeMap.forEach((value, key) => {
            let  povValue;
            if (value > 10) {
                povValue = Math.round(value);
            } else {
                povValue = Number(value).toFixed(2);
            }
            let tovValue;
            if (tovBySizeMap.get(key) > 10) {
                tovValue = Math.round(tovBySizeMap.get(key));
            } else {
                tovValue = Number(tovBySizeMap.get(key)).toFixed(2);
            }
            let globalTableRow = povBySizeBody.append("tr"); // creating the row entry per inflow item
            // populating the elements in the table
            addFlowToGlobalTable(globalTableRow, key, tovValue, povValue);
        });
    }

    // Add event listener for button click
    runButton.addEventListener('click', function() {
        document.getElementById('loading-spinner').style.display = 'block'; // loading animation
        document.getElementById('main-content').classList.add('blur'); // blurring the background
        // Ensure the selected fragmentation value in WP is displayed correctly
        document.getElementById('selectedFragmentationRange').textContent = document.getElementById('customFragmentationRange').value;
        // Hide all information containers besides the global
        unselectWithGlobal();
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
            container.style.display = "none"; // hide the entire container
        });
        // Send the POST request
        fetch(url, options)
            .then(response => {
                // Fetching the master column container
                let masterContainer = document.getElementById('master-column');
                masterContainer.style.display = "flex"; // reveal the model run information box

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json(); // parse the response body as JSON
            })
            .then(model_results => {
                utopia_model_results = model_results; // store values from backend for assembling all visualizations
                assembleGlobalView('Mass Fraction Distribution Overview', "mass", utopia_model_results.extended_comp, utopia_model_results.global_info_dict);
                comp_mass_fraction_distribution_btn.classList.remove('active');
                comp_number_fraction_distribution_btn.classList.remove('active');
                number_fraction_overview_btn.classList.remove('active');
                mass_fraction_overview_btn.classList.add('active');
            })
            .catch(error => {
                console.error('There was a problem with the POST request:', error);
            })
            .finally(() => { // hiding the loading animation and cancelling the blur effect
                document.getElementById('loading-spinner').style.display = 'none';
                document.getElementById('main-content').classList.remove('blur');
                let inputs = getModelRunInfo(inputData); // getting input information as an array
                let modelRunText = `Input of ${inputs[0]}g/s of ${inputs[1]} ${inputs[2]} spherical microplastics particles of ${inputs[3]}kg/m3 density into the ${inputs[4]} compartment. Selected fragmentation style: ${inputs[5]}.`
                let runModelContainer = document.getElementById("model-run-input");
                runModelContainer.textContent = modelRunText; // assigning the text with model input to Model Run
            });
    });

    // Getting the input information
    function getModelRunInfo(inputJsonData) {
        let parsedInput = JSON.parse(inputJsonData); // parsing the JSON object
        let indexes = [3, 3, 3, 0, 3, 2]; // listing the input parameter field indexes in the correct order
        // Listing the input elements with the correct names in model
        let fieldNameArray = ["input_flow_g_s", "MPform", "size_bin", "MPdensity_kg_m3", "emiss_comp", "fragmentation_style"];
        let fieldValueArray = []; // array for storing the actual presentable elements
        for (let i = 0; i < indexes.length; i++) {
            let index = indexes[i]; // index for fetching the field from JSON object
            let inputFieldName = fieldNameArray[i]; // the input field name from some specific field
            // Validating the parsed JSON object
            if (Object.keys(parsedInput)[index]) {
                // Fetching the input element from the model (JSON)
                let element = parsedInput[Object.keys(parsedInput)[index]][inputFieldName];
                if (i === 1) { // check to make Emission Scenario MP form field presentable
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
                } else if (i === 2) { // check to make Emission Scenario size bin field presentable
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
                } else { // adding the element name, replacing _ with spaces where needed
                    fieldValueArray.push(element.toString().replaceAll("_", " "));
                }
            } else {
                console.log(`Index ${index} is out of bounds.`);
                fieldValueArray.push(null);
            }
        }
        return fieldValueArray; // returning the array of presentable inputs
    }

    // Views actions
    let comp_mass_fraction_distribution_btn = document.getElementById('comp_mass_fraction_distribution_btn')
    let comp_number_fraction_distribution_btn = document.getElementById('comp_number_fraction_distribution_btn')
    let mass_fraction_overview_btn = document.getElementById('mass_fraction_overview_btn')
    let number_fraction_overview_btn = document.getElementById('number_fraction_overview_btn')

    comp_mass_fraction_distribution_btn.addEventListener('click', function() {
        if(utopia_model_results !== null){
            // Hide all information containers
            unselectEverything();
            // Removing selection from the other
            comp_number_fraction_distribution_btn.classList.remove('active');
            mass_fraction_overview_btn.classList.remove('active');
            number_fraction_overview_btn.classList.remove('active');
            // Highlighting selection on the navbar
            comp_mass_fraction_distribution_btn.classList.add('active');
            d3.select("#global-view").style("display", "none");
            assembleHeatMap('Mass Fraction Distribution Heatmap', utopia_model_results.mass_fraction_distribution_heatmap, "mass", utopia_model_results.extended_csv_table);
        }
    });
    comp_number_fraction_distribution_btn.addEventListener('click', function() {
        if(utopia_model_results !== null){
            // Hide all information containers
            unselectEverything();
            // Removing selection from the other
            comp_mass_fraction_distribution_btn.classList.remove('active');
            mass_fraction_overview_btn.classList.remove('active');
            number_fraction_overview_btn.classList.remove('active');
            // Highlighting selection on the navbar
            comp_number_fraction_distribution_btn.classList.add('active');
            d3.select("#global-view").style("display", "none");
            assembleHeatMap('Particle Number Fraction Distribution Heatmap', utopia_model_results.number_fraction_distribution_heatmap, "particle number", utopia_model_results.extended_csv_table);
        }
    });
    mass_fraction_overview_btn.addEventListener('click', function() { // mass Distribution Overview
        if(utopia_model_results !== null){
            // Hide all information containers
            unselectEverything();
            // Removing selection from the other
            comp_mass_fraction_distribution_btn.classList.remove('active');
            comp_number_fraction_distribution_btn.classList.remove('active');
            number_fraction_overview_btn.classList.remove('active');
            // Highlighting selection on the navbar
            mass_fraction_overview_btn.classList.add('active');
            d3.select("#global-view").style("display", "flex");
            assembleGlobalView('Mass Fraction Distribution Overview', "mass", utopia_model_results.extended_comp, utopia_model_results.global_info_dict);
        }
    });
    number_fraction_overview_btn.addEventListener('click', function() { // number Fraction Distribution Overview
        if(utopia_model_results !== null){
            // Hide all information containers
            unselectEverything();
            // Removing selection from the other
            comp_mass_fraction_distribution_btn.classList.remove('active');
            comp_number_fraction_distribution_btn.classList.remove('active');
            mass_fraction_overview_btn.classList.remove('active');
            // Highlighting selection on the navbar
            number_fraction_overview_btn.classList.add('active');
            d3.select("#global-view").style("display", "flex");
            assembleGlobalView('Particle Number Fraction Distribution Overview', "particle number", utopia_model_results.extended_comp, utopia_model_results.global_info_dict);
        }
    });

    const rangeInput = document.getElementById('customFragmentationRange');
    const rangeValue = document.getElementById('selectedFragmentationRange');
    rangeInput.addEventListener('click', function () {
        // Update span value whenever the slider changes
        rangeInput.addEventListener('input', function() {
            rangeValue.textContent = rangeInput.value;
        });
    });
});