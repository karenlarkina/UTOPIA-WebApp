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
                fragmentation_style: document.getElementById('fragmentation_style').value,
                fragmentation_timescale: document.getElementById('t_frag_gen_FreeSurfaceWater').value,
                discorporation_timescale: document.getElementById('t_half_deg_free').value,
                runName: document.getElementById('mpp_composition').value,
            }, 
            // EnvCharacteristics: { // TODO implement download and upload
            // },
            EmScenario:{
                MPform: document.getElementById('mp_form').value,
                size_bin: document.getElementById('es_bin_size').value,
                input_flow_g_s: document.getElementById('input_flow_g_s').value,
                emiss_comp: document.getElementById('emiss_comp').value
            }
        }
        return JSON.stringify(utopiaObject)
    }

    // Helper: flatten object to key-value pairs
    function flattenObject(obj, prefix = '', res = {}) {
        for (let key in obj) {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                flattenObject(obj[key], prefix + key + '.', res);
            } else {
                res[prefix + key] = obj[key];
            }
        }
        return res;
    }

    /**
     * Function to export the current parameters from client side as a CSV file.
     * */
    document.getElementById('export-inputs').addEventListener('click', function() {
        const jsonStr = extractVariablesFromClientSide();
        const obj = JSON.parse(jsonStr);
        const flat = flattenObject(obj);
        const headers = Object.keys(flat).join(',');
        const values = Object.values(flat).join(',');
        const csvContent = headers + '\n' + values;
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'utopia_parameters.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });


    // - - Import related variables and functions - -
    const importBtn = d3.select("#import-inputs");
    const deleteBtn = document.getElementById("delete-import-file");
    const importFileInput = document.getElementById("import-file");

    importBtn.on('click', () => importFileInput.click());
    importFileInput.addEventListener('change', handleImportFileChange);
    deleteBtn.addEventListener('click', deleteImportFile);

    /**
     * Function to handle the import file gotten from the user
     * and checking its validity before applying the parameters.
     * @param {*} event change event from the file input
     */
    function handleImportFileChange(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                let text = e.target.result;
                
                // depending on text erditor, some special charecters might be added
                // remove such characters (BOM) if present
                if (text.charCodeAt(0) === 0xFEFF) {
                    text = text.slice(1);
                }
                
                // splitting headers and values
                const lines = text.trim().split(/\r?\n/);
                const headerLine = lines[0].trim();
                const valueLine = lines[1].trim();
                const headers = headerLine.split(',').map(h => h.trim());
                const values = valueLine.split(',').map(v => v.trim());
                
                const jsonStr = extractVariablesFromClientSide();
                const obj = JSON.parse(jsonStr);
                const flat = flattenObject(obj);
                // checking the given headers
                const expectedHeaders = Object.keys(flat);
                const isValid = headers.length === expectedHeaders.length &&
                    headers.every((h, i) => h === expectedHeaders[i]);
                if (!isValid) {
                    let errorMsg = 'Invalid file: headers do not match expected parameters.\n\n';
                    
                    // finding the differences the help the user
                    const maxLen = Math.max(headers.length, expectedHeaders.length);
                    let differences = [];
                    
                    for (let i = 0; i < maxLen; i++) {
                        const expected = expectedHeaders[i] || '(missing)';
                        const received = headers[i] || '(missing)';
                        
                        if (expected !== received) {
                            differences.push({
                                position: i + 1,
                                expected: expected,
                                received: received
                            });
                        }
                    }
                    if (differences.length > 0) {
                        errorMsg += 'Differences found:\n';
                        differences.forEach(diff => {
                            errorMsg += `  Column ${diff.position}:\n`;
                            errorMsg += `    Expected:  "${diff.expected}"\n`;
                            errorMsg += `    Received:  "${diff.received}"\n`;
                        });
                        errorMsg += '\n';
                    }
                    
                    errorMsg += `Total columns - Expected: ${expectedHeaders.length}, Received: ${headers.length}\n\n`;
                    errorMsg += 'Full comparison:\n\n';
                    errorMsg += 'Expected headers:\n' + expectedHeaders.join(',') + '\n\n';
                    errorMsg += 'Received headers:\n' + headers.join(',');
                    
                    alert(errorMsg);
                    resetImport();
                    return;
                }
                
                // a mapping from CSV keys to field IDs ion HTML
                const keyToFieldId = {
                    'MPdensity_kg_m3': 'density',
                    'MP_composition': 'mpp_composition',
                    'shape': 'shape',
                    'N_sizeBins': 'N_sizeBins',
                    'fragmentation_style': 'fragmentation_style',
                    'fragmentation_timescale': 't_frag_gen_FreeSurfaceWater',
                    'discorporation_timescale': 't_half_deg_free',
                    'runName': 'runName',
                    'MPform': 'mp_form',
                    'size_bin': 'es_bin_size',
                    'input_flow_g_s': 'input_flow_g_s',
                    'emiss_comp': 'emiss_comp'
                };
                
                // mapping values to each field
                headers.forEach((key, i) => {
                    const fieldKey = key.split('.').pop();
                    const fieldId = keyToFieldId[fieldKey] || fieldKey;
                    const el = document.getElementById(fieldId);
                    
                    if (el) {
                        el.value = values[i];
                        const changeEvent = new Event('change', { bubbles: true });
                        el.dispatchEvent(changeEvent);
                    } else {
                        console.warn(`Field not found: ${fieldId} (from key: ${fieldKey})`);
                    }
                });
                
                // updating special case fields
                const compositionField = document.getElementById('mpp_composition');
                if (compositionField) {
                    generateMaterialProperties();
                }
                const fragField = document.getElementById('fragmentation_style');
                if (fragField) {
                    document.getElementById('selectedFragmentationRange').textContent = fragField.value;
                }
                
                alert('Parameters imported successfully.');
            };
            reader.readAsText(file);
            importBtn.html("Edit File");
            deleteBtn.style.display = "inline-block";
        } else {
            resetImport();
        }
    }

    function resetImport() {
        importBtn.html("Add File");
        deleteBtn.style.display = "none";
    }

    function deleteImportFile() {
        importFileInput.value = "";
        resetImport();
    }

    /**
     * Image creation and download using domtoimage.
     * */
    const visualizationToPng = document.getElementById("export-png");
    visualizationToPng.addEventListener("click", function() {
        const heatmapContainer = document.getElementById("master-column");
        document.body.style.cursor = 'wait';
        
        // detecting the current view type
        const title = document.querySelector("#main-title")?.textContent || "";
        const isFlowView = title.toLowerCase().includes("flow");
        const rect = heatmapContainer.getBoundingClientRect();
        
        // cropping the visaulization for global and heatmaps because of the legend
        const cropBottom = isFlowView ? 0 : 110;
        const scale = 3;
        
        const options = {
            quality: 1,
            bgcolor: '#ffffff',
            
            // adjust height to crop bottom
            width: rect.width * scale,
            height: (rect.height - cropBottom) * scale,
            
            style: {
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: rect.width + 'px',
                height: (rect.height - cropBottom) + 'px'
            },
            
            cacheBust: true
        };
        
        domtoimage.toPng(heatmapContainer, options)
            .then(function(dataUrl) {
                document.body.style.cursor = 'default';
                
                const link = document.createElement('a');
                const fileName = title.replaceAll(" ", "_");
                
                link.download = `Utopia_${fileName}.png`;
                link.href = dataUrl;
                link.click();
            })
            .catch(function(error) {
                document.body.style.cursor = 'default';
            });
    });

    // Function to unselect all selected elements (cell/compartment), hide selection info and unblur all
    function unselectEverything() {
        document.getElementById(`detailed-view-cell`).style.display = "none";
        document.getElementById(`detailed-view-compartment`).style.display = "none";
        document.getElementById(`about-page`).style.display = "none";
        d3.select("#master-column").style("display", "flex");

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
        // d3.select(".info-containers").style("display", "flex");
    }

    // Function to unselect selections and display the global overview info on right
    function unselectWithGlobal() {
        unselectEverything();
        d3.select("#global-view").style("display", "flex");
        d3.selectAll(".additional-info").style("display", "none");
        d3.selectAll(".compartment-percent-big").style("display", "block");
    }

    // Function to unselect selections and display the global overview info on right
    function unselectForAbout() {
        unselectEverything();
        d3.select("#master-column").style("display", "none");
    }

    // Function to unblur all compartments
    function unblurCompartments() {
        d3.selectAll('.compartment')
            .classed('blurry', false);
    }


/**
 * Dynamic float rounding with proper handling of very large/small numbers.
 * @param {string} type special cases
 * @param {number|string} value the value to format
 * @returns {string} formatted number string
 */
function roundDynamicFloat(type, value) {
    if (value === null || value === undefined || value === '' || isNaN(value)) {
        return '0.00';
    }
    let num = Number(value);
    if (num === 0) {
        return '0.00';
    }
    const absNum = Math.abs(num);
    if (type === "percent") {
        if (absNum < 0.0001) {
            return '< 0.0001';
        }
    } else if (type === "concentration") {
        if (absNum < 0.000001) {
            return '< 1e-6';
        }
    }
    if (absNum >= 10000) {
        return num.toExponential(2);
    }
    if (absNum >= 100) {
        return num.toFixed(0);
    }
    if (absNum >= 1) {
        return num.toFixed(2);
    }
    if (absNum >= 0.01) {
        return num.toFixed(2);
    }
    if (absNum >= 0.001) {
        return num.toFixed(3);
    }
    if (absNum >= 0.0001) {
        return num.toFixed(4);
    }
    // extremely small numbers
    return num.toExponential(2);
}

    // Building the new heatmaps with respect to compartments
    let assembleHeatMap = function(title, csvText, mode, csvExtended) {
        // remove any existing heatmap
        d3.select('#heatmap-container').selectAll('*').remove();
        // document.getElementsByClassName(`info-containers`).style.display = 'flex';
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
            .style("margin-top", "20px !important")
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
            if (d[fraction] !== "" && d[fraction] !== 0 && d[fraction] !== "0" && !Number.isNaN(d[fraction])) {
                // Calculate the position of the tooltip relative to the mouse pointer
                const tooltipLeft = event.pageX + 10;
                const tooltipTop = event.pageY - 50;

                let totPercentage = roundDynamicFloat("percent", (d[originFraction] * 100));

                // Update the position of the tooltip
                tooltip
                    .html(`Log ${mode} fraction: ${Number(d[fraction]).toFixed(2)}<br>% of total ${mode} = ${totPercentage}%`)
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
            let flowValue = roundDynamicFloat("", value);
            let percentage = roundDynamicFloat("", flowPercentage);

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
                let totalPercentage = roundDynamicFloat("percent", selection.attr('total-percent'));

                // updating cell information in detailed view
                d3.select(`#cell-info-percentage`)
                    .html(`Log ${mode} fraction = ` + Number(d[fraction]).toFixed(2));
                d3.select(`#total-percent`)
                    .html(`% of total ${mode} = ${totalPercentage}%`);
                d3.select(`#residence-value`)
                    .html(`Residence time = ${Math.round(selection.attr('residence'))} years`);
                d3.select(`#persistence-value`)
                    .html(`Persistence = ${Math.round(selection.attr('persistance'))} years`);

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
                    .attr("residence", d => Number(parseFloat(d[cellResidence])).toFixed(3))
                    .attr("persistance", d => Number(parseFloat(d[cellPersistence])).toFixed(3))
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
            .style("grid-column", "Create new scratch file from selection").style("border", "solid 2px white").style("border-radius", "3px")
            .style("width", "353px").style("height", "240px").style("text-align", "left").style("align-items", "start").style("z-index", "10").style("margin-left", "-15px");
            // .attr("class", "new-legend-container");

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
        // document.getElementsByClassName(`info-containers`).style.display = 'flex';
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
            .style("margin-top", "20px !important")
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
        let percent_total = null
        let povDict = 'Pov_size_dict_years';
        let tovDict = 'Tov_size_dict_years';
        let outflows = null;
        // Getting the values depending on mode and storing appropriate column labels
        if (mode === "mass") {
            pov = 'Pov_mass_years';
            tov = 'Tov_mass_years';
            ctd = 'CTD_mass';
            percent_total = 'percent_total_mass';
        } else {
            pov = 'Pov_num_years';
            tov = 'Tov_num_years';
            ctd = 'CTD_num';
            percent_total = 'percent_total_number';
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
                .html(`Concentration (in g/m\u00B3) = ${d3.select(this).attr('comp-concentration')} <br>% of total ${mode} = ${roundDynamicFloat("concentration", d3.select(this).attr('comp-percent'))} %
                                                                            <br> Persistence = ${d3.select(this).attr('comp-persistence')} years<br>Residence time = ${d3.select(this).attr('comp-residence')} years`)
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
        function addFlowToGlobalTable(tableRow, flowName, tovValue, povValue, percent) {

            if (tovValue === "NaN") {
                tableRow.append("td").text(`${flowName}`);
                tableRow.append("td").text(`-`);
                // tableRow.append("td").text(`-`);
                tableRow.append("td").text(`-`);
                tableRow.append("td").text(`-`);
            } else {
                tableRow.append("td").text(`${flowName}`);
                // tableRow.append("td").text(`-`);
                tableRow.append("td").text(`${percent}`);
                tableRow.append("td").text(`${povValue}`);
                tableRow.append("td").text(`${tovValue}`);
            }
        }

        // Function to add flows information to given d3 flow element
        function addFlowToTable(tableRow, flowName, value) {
            let flowValue = roundDynamicFloat("", value);

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

            selection.select(".additional-info")
                .style("display", "block"); // show the additional info container
            selection.select(".compartment-percent-big")
                .style("display", "none"); // hide the big percentage

            selection.style("border", "solid 3px #000"); // change the border to appear selected
            d3.select('#compartment-title')
                .html(`${d3.select(selectedCompartment).attr('comp-title')} Compartment`);
            // adding general info about selected compartment
            d3.select(`#comp-concentration`)
                .html(`Concentration (in g/m\u00B3) = ${d3.select(selectedCompartment).attr('comp-concentration')}`);
            d3.select(`#comp-total-percent`)
                .html(`% of the total ${mode} = ${roundDynamicFloat("percent", d3.select(selectedCompartment).attr('comp-percent'))}`);
            d3.select(`#comp-persistence`)
                .html(`Persistence = ${d3.select(selectedCompartment).attr('comp-persistence')} years`);
            d3.select(`#comp-residence`)
                .html(`Residence time = ${d3.select(selectedCompartment).attr('comp-residence')} years`);

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
            d3.select('#comp-total-inflow').text(roundDynamicFloat("", totalCompInflow));

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
            d3.select('#comp-total-outflow').text(roundDynamicFloat("", totalCompOutflow));

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
                    .attr("comp-concentration", roundDynamicFloat("concentration", parseFloat(collections[currentCompartment][0][compConcentration])))
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
                    .attr("class", "compartment-percent-big")
                    .text(`${roundDynamicFloat("percent", collections[currentCompartment][0][compPercent])} %`);

                // Append additional information (hidden by default)
                const additionalInfo = compartmentContainer.append("div")
                    .attr("class", "additional-info")
                    .style("display", "none");

                additionalInfo.append("div")
                    .attr("class", "compartment-field")
                    .style("margin-top", "8px")
                    .text(`C = ${roundDynamicFloat("concentration", parseFloat(collections[currentCompartment][0][compConcentration]))}`);
                additionalInfo.append("div")
                    .attr("class", "compartment-field")
                    .text(`${roundDynamicFloat("percent", collections[currentCompartment][0][compPercent])} %`);
                additionalInfo.append("div")
                    .attr("class", "compartment-field")
                    .text(`Persistence = ${roundDynamicFloat("", collections[currentCompartment][0][compPersistence])}`);
                additionalInfo.append("div")
                    .attr("class", "compartment-field")
                    .text(`Residence = ${roundDynamicFloat("", collections[currentCompartment][0][compResidence])}`);

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
                            .attr("comp-concentration", roundDynamicFloat("concentration", parseFloat(collections[currentCompartment][0][compConcentration])))
                            .attr("comp-residence", Math.round(parseFloat(collections[currentCompartment][0][compResidence])))
                            .attr("comp-persistence", Math.round(parseFloat(collections[currentCompartment][0][compPersistence])))
                            .attr("comp-inflows", collections[currentCompartment][0][compInflows])
                            .attr("comp-outflows", collections[currentCompartment][0][compOutflows])
                            .on("click", compartmentClick)
                            .on("mouseover", mouseover)
                            .on("mousemove", mousemove)
                            .on("mouseleave", mouseleave);

                        compartmentContainer.append("div")
                            .attr("class", "compartment-percent-big")
                            .text(`${roundDynamicFloat("percent", collections[currentCompartment][0][compPercent])} %`);

                        // Append additional information (hidden by default)
                        const additionalInfo = compartmentContainer.append("div")
                            .attr("class", "additional-info")
                            .style("display", "none"); // Hidden initially

                        additionalInfo.append("div")
                            .attr("class", "compartment-field")
                            .style("margin-top", "8px")
                            .text(`C = ${roundDynamicFloat("concentration", collections[currentCompartment][0][compConcentration])}`);
                        additionalInfo.append("div")
                            .attr("class", "compartment-field")
                            .text(`${roundDynamicFloat("percent", collections[currentCompartment][0][compPercent])} %`);
                        additionalInfo.append("div")
                            .attr("class", "compartment-field")
                            .text(`Persistence = ${roundDynamicFloat("", collections[currentCompartment][0][compPersistence])}`);
                        additionalInfo.append("div")
                            .attr("class", "compartment-field")
                            .text(`Residence = ${roundDynamicFloat("", collections[currentCompartment][0][compResidence])}`);
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
            .html(`Difference inflow-outflow = ${Number.parseFloat(differenceParts[0]).toFixed(2)}e${differenceParts[1]} (g)`);
        d3.select('#global-persistence')
            .html(`Overall persistence (Pov): ${roundDynamicFloat("", globalMap.get(pov))} years`);
        d3.select('#global-residence')
            .html(`Overall residence time (Tov): ${roundDynamicFloat("", globalMap.get(tov))} years`);

        // getting the inflows and outflows and converting them into Maps
        let povBySizeString = (globalMap.get(povDict)).replace(/'/g, '"');
        let tovBySizeString = (globalMap.get(tovDict)).replace(/'/g, '"');
        let percentBySizeString = (globalMap.get(percent_total)).replace(/'/g, '"');
        let povBySizeObj = JSON.parse(povBySizeString);
        let tovBySizeObj = JSON.parse(tovBySizeString);
        let percentBySizeObj = JSON.parse(percentBySizeString);
        let povBySizeMap = new Map(Object.entries(povBySizeObj));
        let tovBySizeMap = new Map(Object.entries(tovBySizeObj));
        let percentBySizeMap = new Map(Object.entries(percentBySizeObj));

        // populating the %, pov, and tov table
        const povBySizeContainer = d3.select('#global-table');
        const povBySizeBody = d3.select("#global-table-body");
        povBySizeBody.selectAll('*').remove();

        d3.select('#global-number').html(`% ${mode}`)
        // d3.select('#global-total').html(`Total ${mode}`)
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
            let percent_of_total = percentBySizeMap.get(key);
            let globalTableRow = povBySizeBody.append("tr"); // creating the row entry per inflow item
            // populating the elements in the table
            addFlowToGlobalTable(globalTableRow, key, tovValue, povValue, percent_of_total);
        });
    }


    // Building the flows graph view
    let createFlowsGraph = function(title, mode, csvExtendedComp) {
        // Remove any existing heatmap
        d3.select('#heatmap-container').selectAll('*').remove();
        // Hide the global info field on right
        document.getElementById(`global-view`).style.display = 'none';
        
        const heatmapContainer = document.getElementById('heatmap-container');
        const containerRect = heatmapContainer.getBoundingClientRect();
        
        // Use actual available space, accounting for info panel on right
        const infoPanel = document.getElementById('master-column').querySelector('.info-containers');
        const infoPanelWidth = infoPanel ? infoPanel.offsetWidth : 520;
        
        // Calculate available width (viewport minus info panel and margins)
        const availableWidth = window.innerWidth - infoPanelWidth;
        const availableHeight = window.innerHeight - 200;
        
        // SVG dimensions based on available space
        const svgWidth = Math.max(1000, availableWidth); // Minimum 1000px
        const svgHeight = Math.max(600, availableHeight); // Minimum 600px
        
        // Define boundaries for nodes
        const nodeWidth = 150;
        const nodeHeight = 60;
        const padding = 10; // Padding from edges
        const topPadding = 10;
        
        const bounds = {
            minX: padding,
            maxX: svgWidth - nodeWidth - padding,
            minY: topPadding,
            maxY: svgHeight - nodeHeight - padding
        };
        
        // Calculate grid from available space
        const containerWidth = bounds.maxX - bounds.minX;
        const containerHeight = bounds.maxY - bounds.minY;
        
        // Horizontal: 6 columns
        const colWidth = containerWidth / 6;
        
        // Vertical: 5 layers
        const layerHeight = containerHeight / 5;

        // Append the SVG element to the body of the page
        const svg = d3.select("#heatmap-container")
            .attr("width", svgWidth)
            .attr("height", svgHeight)
            .on("click", unselectEverything)
            .style("padding", "2px")
            .append("g")
            .attr("transform", `translate(0, 0)`);

        // A row for log scale swithc and title
        const headerContainer = svg.append("g")
            .attr("class", "header-container")
            .attr("transform", `translate(0, 30)`);

        // Group for the log switch and its label
        const switchGroup = headerContainer.append("g")
            .style("align-items", "start")
            .style("display", "flex");
        switchGroup.append("text")
            .attr("x", 50) // Adjust position relative to the toggle switch
            .attr("y", 20)
            .style("font-size", "14px")
            .style("font-weight", "bold")
            .style("margin-right", "10px")
            .text("Log scale: ");
        const toggleSwitch = switchGroup.append("foreignObject")
            .attr("width", 100)
            .attr("height", 30)
            .append("xhtml:div")
            .style("display", "flex")
            .style("align-items", "center")
            .html(`
        <label class="switch">
            <input type="checkbox" id="log-scale-switch" unchecked>
            <span class="slider round"></span>
        </label>`);

        headerContainer.append("text")
            .attr("id", "main-title")
            .attr("x", svgWidth / 2)
            .text(title);

        // Getting the data
        const data = d3.csvParse(csvExtendedComp);

        let connectionsMode = null;
        if (mode === "mass") {
            connectionsMode = 'outflow_conexions_g_s';
        } else {
            connectionsMode = 'outflow_conexions_num_s';
        }

        let compartmentNodes = []
        let compartmentLinks = []

        // Grid positioning helpers
        function getColX(col) {
            return bounds.minX + col * colWidth + (colWidth - nodeWidth) / 2;
        }
        
        function getLayerY(layer) {
            return bounds.minY + layer * layerHeight + (layerHeight - nodeHeight) / 2;
        }

        // Creating compartment nodes with initial positions
        data.forEach((entry, index) => {
            let cssClass = "";
            let initialX = 0;
            let initialY = 0;

            const name = entry.Compartments.toLowerCase();
            
            if (name.includes("air")) {
                cssClass = "air-color";
                initialX = bounds.minX + containerWidth / 2 - nodeWidth / 2;
                initialY = getLayerY(0);
                
            } else if (name.includes("impacted")) {
                cssClass = "impacted";
                initialX = getColX(0);
                if (name.includes("surface")) {
                    initialY = getLayerY(1);
                } else {
                    initialY = getLayerY(1.8);
                }
                
            } else if (name.includes("background")) {
                cssClass = "background";
                initialX = getColX(1);
                if (name.includes("surface")) {
                    initialY = getLayerY(1.8);
                } else {
                    initialY = getLayerY(2.4);
                }
                
            } else if (name.includes("freshwater")) {
                cssClass = "freshwater";
                initialX = getColX(2);
                if (name.includes("surface")) {
                    initialY = getLayerY(1);
                } else if (name.includes("sediment")) {
                    initialY = getLayerY(4);
                    cssClass += " sediment";
                } else {
                    initialY = getLayerY(2.2);
                }
                
            } else if (name.includes("beach")) {
                cssClass = "beach";
                initialX = getColX(3);
                if (name.includes("surface")) {
                    initialY = getLayerY(1);
                } else {
                    initialY = getLayerY(2.2);
                }
                
            } else if (name.includes("coast")) {
                cssClass = "coastal";
                initialX = getColX(4);
                if (name.includes("surface")) {
                    initialY = getLayerY(1);
                } else if (name.includes("sediment")) {
                    initialY = getLayerY(4);
                    cssClass += " sediment";
                } else {
                    initialY = getLayerY(2.2);
                }
                
            } else if (name.includes("ocean")) {
                cssClass = "ocean";
                initialX = getColX(5);
                if (name.includes("surface")) {
                    initialY = getLayerY(1);
                } else if (name.includes("mixed")) {
                    initialY = getLayerY(2);
                } else if (name.includes("sediment")) {
                    initialY = getLayerY(4);
                    cssClass += " sediment";
                } else {
                    initialY = getLayerY(3);
                }
            }

            // Ensure within bounds
            initialX = Math.max(bounds.minX, Math.min(bounds.maxX, initialX));
            initialY = Math.max(bounds.minY, Math.min(bounds.maxY, initialY));

            compartmentNodes.push({
                id: index,
                name: entry.Compartments,
                width: 150,
                height: 60,
                className: cssClass,
                initialX: initialX,
                initialY: initialY
            });
        });


        // Parse the outflows field to extract links
        data.forEach((entry, index) => {
            if (entry[connectionsMode]) {
                try {
                    const outflows = JSON.parse(entry[connectionsMode].replace(/'/g, '"'));
                    for (const [targetName, relations] of Object.entries(outflows)) {
                        const targetNode = compartmentNodes.find(node => node.name === targetName);
                        if (targetNode) {
                            // create relationArray (types of flows) from key-value pairs
                            const relationArray = Object.entries(relations).map(([type, value]) => ({ type, value }));

                            // getting actualWeight as the sum of all relation values
                            const actualWeight = Object.values(relations).reduce((sum, value) => sum + value, 0);
                            const logWeight = Math.log10(actualWeight);

                            compartmentLinks.push({
                                source: compartmentNodes[index],
                                target: targetNode,
                                linkWeight: relationArray.length, // the number of flows in flow map in origin. data as weight
                                relations: relationArray,
                                actualWeight: actualWeight,
                                logWeight: logWeight
                            });
                        }
                    }
                } catch (error) {
                    console.error("Error parsing outflows:", error);
                }
            }
        });


        // Finding bidirectional links between compartments
        const bidirectionalPairs = new Set();
        
        for (let i = 0; i < compartmentLinks.length; i++) {
            for (let j = i + 1; j < compartmentLinks.length; j++) {
                const link1 = compartmentLinks[i];
                const link2 = compartmentLinks[j];
                
                if (link1.source.id === link2.target.id && 
                    link1.target.id === link2.source.id) {
                    
                    const pairKey = `${Math.min(link1.source.id, link1.target.id)}-${Math.max(link1.source.id, link1.target.id)}`;
                    bidirectionalPairs.add(pairKey);
                }
            }
        }
        

        // Store initial positions
        compartmentNodes.forEach(node => {
            node.x = node.initialX;
            node.y = node.initialY;
        });

        // Working area SVG
        const newSvg = svg.append("svg")
            .attr("width", svgWidth)
            .attr("height", svgHeight)
            .style("padding", "2px");

        // Create a tooltip
        const tooltip = d3.select("#heatmap-container")
            .append("div")
            .style("opacity", 0)
            .attr("class", "tooltip");

        // Boundary collision force
        function boundaryForce() {
            compartmentNodes.forEach(node => {
                node.x = Math.max(bounds.minX, Math.min(bounds.maxX, node.x));
                node.y = Math.max(bounds.minY, Math.min(bounds.maxY, node.y));
                
                if (node.fx !== null && node.fx !== undefined) {
                    node.fx = Math.max(bounds.minX, Math.min(bounds.maxX, node.fx));
                }
                if (node.fy !== null && node.fy !== undefined) {
                    node.fy = Math.max(bounds.minY, Math.min(bounds.maxY, node.fy));
                }
            });
        }

        // Create a force simulation
        const simulation = d3.forceSimulation(compartmentNodes)
            .force("link", d3.forceLink(compartmentLinks)
                .id(d => d.id)
                .distance(d => Math.max(100, d.source.width + d.target.width)))
            .force("charge", d3.forceManyBody().strength(-100))
            .force("center", d3.forceCenter(svgWidth / 2, svgHeight / 2))
            .force("position", d3.forceX().x(d => d.initialX).strength(0.5))
            .force("positionY", d3.forceY().y(d => d.initialY).strength(0.5))
            .force("boundary", boundaryForce);

        // Draw links with tooltips as paths
        const link = newSvg.selectAll(".link")
            .data(compartmentLinks)
            .enter()
            .append("path")
            .attr("class", "link")
            .style("stroke", "#999")
            .style("fill", "none")
            .style("opacity", 0.8)
            .on("mouseover", function (event, d) {
                const sourceNode = d.source;
                const targetNode = d.target;
                let scaleValue = '';
                if (typeof usedWeight !== 'undefined' && usedWeight === "logWeight") {
                    scaleValue = 'log10 ';
                }
                if (!sourceNode || !targetNode) return;
                
                const pairKey = `${Math.min(d.source.id, d.target.id)}-${Math.max(d.source.id, d.target.id)}`;
                const isBi = bidirectionalPairs.has(pairKey);
                // Create tooltip content
                const tooltipContent = `
            <b>${sourceNode.name.replaceAll("_", " ")} -> ${targetNode.name.replaceAll("_", " ")}</b><br>
            ${d.relations.map(r => `${r.type.replaceAll("_", " ")}: ${roundDynamicFloat("", r.value)}`).join("<br>")}<br>
            <b>Total ${scaleValue}value:</b> ${roundDynamicFloat("", d[typeof usedWeight !== 'undefined' ? usedWeight : 'actualWeight'])}<br>
        `;

                // Show tooltip
                d3.select(".tooltip")
                    .html(tooltipContent)
                    .style("opacity", 1)
                    .style("left", `${event.pageX + 10}px`)
                    .style("top", `${event.pageY + 10}px`);
            })
            .on("mousemove", function (event) {
                // Update tooltip position as the mouse moves
                d3.select(".tooltip")
                    .style("left", `${event.pageX + 10}px`)
                    .style("top", `${event.pageY + 10}px`);
            })
            .on("mouseout", function () {
                d3.select(".tooltip").html('').style("opacity", 0);
            });

        // Drag event handlers
        function dragStarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        } 
        function dragged(event, d) {
            d.fx = Math.max(bounds.minX, Math.min(bounds.maxX, event.x));
            d.fy = Math.max(bounds.minY, Math.min(bounds.maxY, event.y));
        }
        function dragEnded(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = Math.max(bounds.minX, Math.min(bounds.maxX, d.x));
            d.fy = Math.max(bounds.minY, Math.min(bounds.maxY, d.y));
        }
        
        // Draw nodes
        const node = newSvg.selectAll(".node")
            .data(compartmentNodes)
            .enter()
            .append("g")
            .attr("class", d => `node ${d.className}`)
            .attr("transform", d => `translate(${d.x}, ${d.y})`)
            .call(d3.drag()
                .on("start", dragStarted)
                .on("drag", dragged)
                .on("end", dragEnded)
            )

        node.append("rect")
            .attr("width", 150)
            .attr("height", 60)
            .attr("rx", 5)
            .attr("ry", 5)
            .style("cursor", "pointer")
            .style("fill", d => {
                switch (d.className) {
                    case "air-color": return "#D8F1F1";
                    case "impacted": return "#DCD4C9";
                    case "beach": return "#F3EF92";
                    case "background": return "#BDDBBD";
                    case "freshwater": return "#BDD4E3";
                    case "coastal": return "#9DD9DF";
                    case "ocean": return "#989EEC";
                    case "sediment": return "#D8C4A5";
                    default: return "lightgray";
                }
            })
            .style("stroke", "black");

        node.append("text")
            .attr("x", 75)
            .attr("y", 25)
            .attr("text-anchor", "middle")
            .attr("dy", ".35em")
            .text(d => d.name.replaceAll("_", " "))
            .style("font-size", "12px")
            .style("font-family", "Arial");

        node.append("text")
            .attr("x", 75)
            .attr("y", 47)
            .attr("text-anchor", "middle")
            .attr("font-size", "11px")
            .attr("font-weight", "normal")
            .style("font-family", "Arial");
            // .text("E = ...");

        // Add event listener to the log-scale-switch
        let usedWeight = 'actualWeight';
        document.getElementById("log-scale-switch").addEventListener("change", function () {
            // Update the usedWeight variable based on the checkbox state
            usedWeight = this.checked ? "logWeight" : "actualWeight";
            // Redraw the flows with the updated weight mode
            redrawFlows();
        });

        /**
         * Function to draw/redraw the links with selected weight scale
         */
        function redrawFlows() {
            // Normalize the weights based on the selected scale
            let minWeight = d3.min(compartmentLinks, d => d[usedWeight]);
            let maxWeight = d3.max(compartmentLinks, d => d[usedWeight]);
            
            // Update the links
            newSvg.selectAll(".link")
                .attr("d", d => {
                    const sourceX = d.source.x + d.source.width / 2;
                    const sourceY = d.source.y + d.source.height / 2;
                    const targetX = d.target.x + d.target.width / 2;
                    const targetY = d.target.y + d.target.height / 2;
                    
                    const pairKey = `${Math.min(d.source.id, d.target.id)}-${Math.max(d.source.id, d.target.id)}`;
                    const isBidirectional = bidirectionalPairs.has(pairKey);
                    
                    if (isBidirectional) {
                        const dx = targetX - sourceX;
                        const dy = targetY - sourceY;
                        const dr = Math.sqrt(dx * dx + dy * dy);
                        const curveOffset = dr * 0.2;
                        
                        const midX = (sourceX + targetX) / 2;
                        const midY = (sourceY + targetY) / 2;
                        
                        const perpX = -dy / dr * curveOffset;
                        const perpY = dx / dr * curveOffset;
                        
                        const controlX = midX + perpX;
                        const controlY = midY + perpY;
                        
                        return `M${sourceX},${sourceY} Q${controlX},${controlY} ${targetX},${targetY}`;
                    } else {
                        return `M${sourceX},${sourceY} L${targetX},${targetY}`;
                    }
                })
                .style("stroke-width", d => {
                    const normalized = (d[usedWeight] - minWeight) / (maxWeight - minWeight);
                    return normalized * 30 + 3;
                })
                .style("stroke", d => {
                    const pairKey = `${Math.min(d.source.id, d.target.id)}-${Math.max(d.source.id, d.target.id)}`;
                    return bidirectionalPairs.has(pairKey);
                });

            // midpoints and target arrows
            const arrows = newSvg.selectAll(".midpoint-arrow")
                .data(compartmentLinks);
            
            arrows.enter()
                .append("path")
                .attr("class", "midpoint-arrow")
                .style("fill", "black")
                .merge(arrows)
                .attr("d", d => {
                    const sourceX = d.source.x + d.source.width / 2;
                    const sourceY = d.source.y + d.source.height / 2;
                    const targetX = d.target.x + d.target.width / 2;
                    const targetY = d.target.y + d.target.height / 2;
                    
                    const pairKey = `${Math.min(d.source.id, d.target.id)}-${Math.max(d.source.id, d.target.id)}`;
                    const isBidirectional = bidirectionalPairs.has(pairKey);
                    
                    let midX, midY, dirX, dirY;
                    
                    if (isBidirectional) {
                        const dx = targetX - sourceX;
                        const dy = targetY - sourceY;
                        const dr = Math.sqrt(dx * dx + dy * dy);
                        const curveOffset = dr * 0.2;
                        
                        const midXStraight = (sourceX + targetX) / 2;
                        const midYStraight = (sourceY + targetY) / 2;
                        const perpX = -dy / dr * curveOffset;
                        const perpY = dx / dr * curveOffset;
                        const controlX = midXStraight + perpX;
                        const controlY = midYStraight + perpY;
                        
                        const t = 0.5;
                        midX = (1-t)*(1-t)*sourceX + 2*(1-t)*t*controlX + t*t*targetX;
                        midY = (1-t)*(1-t)*sourceY + 2*(1-t)*t*controlY + t*t*targetY;
                        
                        const tangentX = 2*(1-t)*(controlX - sourceX) + 2*t*(targetX - controlX);
                        const tangentY = 2*(1-t)*(controlY - sourceY) + 2*t*(targetY - controlY);
                        const tangentLength = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
                        
                        dirX = tangentX / tangentLength;
                        dirY = tangentY / tangentLength;
                    } else {
                        midX = (sourceX + targetX) / 2;
                        midY = (sourceY + targetY) / 2;
                        const dx = targetX - sourceX;
                        const dy = targetY - sourceY;
                        const length = Math.sqrt(dx * dx + dy * dy);
                        dirX = dx / length;
                        dirY = dy / length;
                    }
                    
                    const arrowLength = 18;
                    const arrowWidth = 8;
                    // calculate arrowhead points
                    const arrowTipX = midX + dirX * arrowLength;
                    const arrowTipY = midY + dirY * arrowLength;
                    const arrowLeftX = midX - dirY * arrowWidth;
                    const arrowLeftY = midY + dirX * arrowWidth;
                    const arrowRightX = midX + dirY * arrowWidth;
                    const arrowRightY = midY - dirX * arrowWidth;
                    
                    // path for the arrow
                    return `M${arrowLeftX},${arrowLeftY} L${arrowTipX},${arrowTipY} L${arrowRightX},${arrowRightY} Z`;
                });
            
            arrows.exit().remove();
        }

        redrawFlows();

        // Update positions on tick
        simulation.on("tick", () => {
            redrawFlows();

            // update node positions
            newSvg.selectAll(".node")
                .attr("transform", d => `translate(${d.x}, ${d.y})`)
                .raise();
        });
    }


    let modelHasRun = false;
    // Add event listener for button click
    runButton.addEventListener('click', function() {

        document.getElementById('loading-spinner').style.display = 'block'; // loading animation
        document.getElementById('main-content').classList.add('blur'); // blurring the background
        // Ensure the selected fragmentation value in WP is displayed correctly
        document.getElementById('selectedFragmentationRange').textContent = document.getElementById('fragmentation_style').value;
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
                assembleGlobalView('Mass Overview', "mass", utopia_model_results.extended_comp, utopia_model_results.global_info_dict);
                comp_mass_fraction_distribution_btn.classList.remove('active');
                comp_number_fraction_distribution_btn.classList.remove('active');
                number_fraction_overview_btn.classList.remove('active');
                mass_flow_btn.classList.remove('active');
                number_flow_btn.classList.remove('active');
                mass_fraction_overview_btn.classList.add('active');
            })
            .catch(error => {
                console.error('There was a problem with the POST request:', error);
            })
            .finally(() => { // hiding the loading animation and cancelling the blur effect
                document.getElementById('loading-spinner').style.display = 'none';
                document.getElementById('main-content').classList.remove('blur');
                let inputs = getModelRunInfo(inputData); // getting input information as an array
                let modelRunText = `Input of ${inputs[0]} g/s of ${inputs[1]} ${inputs[2]} spherical microplastics particles of ${inputs[3]} kg/m\u00B3 density into the ${inputs[4]} compartment. Selected fragmentation pattern: ${inputs[5]}.`
                let runModelContainer = document.getElementById("model-run-input");
                runModelContainer.textContent = modelRunText; // assigning the text with model input to Model Run
                d3.select("#visualization-menu").style("display", "flex"); // showing the visualization menu
                // Hide all information containers besides the global
                unselectWithGlobal();
            });
    });

    // Getting the input information
    function getModelRunInfo(inputJsonData) {
        let parsedInput = JSON.parse(inputJsonData); // parsing the JSON object
        let indexes = [1, 1, 1, 0, 1, 0]; // listing the input parameter field indexes in the correct order
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
                            numValue = "0.5 μm";
                            break
                        case "b":
                            numValue = "5 μm";
                            break
                        case "c":
                            numValue = "50 μm";
                            break
                        case "d":
                            numValue = "500 μm";
                            break
                        default:
                            numValue = "5 mm";
                    }
                    fieldValueArray.push(numValue);
                } else if (i === 5) {
                    let cleanName = "";
                    switch (element) {
                        case "1":
                            cleanName = "Sequential"; // sequential fragmentation
                            break
                        case "0":
                            cleanName = "Erosive"; // erosive fragmentation
                            break
                        default:
                            cleanName = "Mixed"; // mixed fragmentation
                    }
                    fieldValueArray.push(cleanName);
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
    let mass_flow_btn = document.getElementById('comp_mass_flows_btn')
    let number_flow_btn = document.getElementById('comp_number_flows_btn')

    comp_mass_fraction_distribution_btn.addEventListener('click', function() {
        if(utopia_model_results !== null){
            // Hide all information containers
            unselectEverything();
            // Removing selection from the other
            comp_number_fraction_distribution_btn.classList.remove('active');
            mass_fraction_overview_btn.classList.remove('active');
            number_fraction_overview_btn.classList.remove('active');
            mass_flow_btn.classList.remove('active');
            number_flow_btn.classList.remove('active');
            // Highlighting selection on the navbar
            comp_mass_fraction_distribution_btn.classList.add('active');
            d3.select("#global-view").style("display", "none");
            assembleHeatMap('Heatmap of Mass', utopia_model_results.mass_fraction_distribution_heatmap, "mass", utopia_model_results.extended_csv_table);
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
            mass_flow_btn.classList.remove('active');
            number_flow_btn.classList.remove('active');
            // Highlighting selection on the navbar
            comp_number_fraction_distribution_btn.classList.add('active');
            d3.select("#global-view").style("display", "none");
            assembleHeatMap('Heatmap of Particle', utopia_model_results.number_fraction_distribution_heatmap, "particle number", utopia_model_results.extended_csv_table);
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
            mass_flow_btn.classList.remove('active');
            number_flow_btn.classList.remove('active');
            // Highlighting selection on the navbar
            mass_fraction_overview_btn.classList.add('active');
            d3.select("#global-view").style("display", "flex");
            assembleGlobalView('Mass Overview', "mass", utopia_model_results.extended_comp, utopia_model_results.global_info_dict);
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
            mass_flow_btn.classList.remove('active');
            number_flow_btn.classList.remove('active');
            // Highlighting selection on the navbar
            number_fraction_overview_btn.classList.add('active');
            d3.select("#global-view").style("display", "flex");
            assembleGlobalView('Particle Overview', "particle number", utopia_model_results.extended_comp, utopia_model_results.global_info_dict);
        }
    });

    mass_flow_btn.addEventListener('click', function() { // mass flows
        if(utopia_model_results !== null){
            // Hide all information containers
            unselectEverything();
            // Removing selection from the other
            comp_mass_fraction_distribution_btn.classList.remove('active');
            comp_number_fraction_distribution_btn.classList.remove('active');
            mass_fraction_overview_btn.classList.remove('active');
            number_flow_btn.classList.remove('active');
            number_fraction_overview_btn.classList.remove('active');
            // Highlighting selection on the navbar
            mass_flow_btn.classList.add('active');
            createFlowsGraph("Mass Balance Flows", "mass", utopia_model_results.extended_comp);
        }
    });

    number_flow_btn.addEventListener('click', function() { // particle number flows
        if(utopia_model_results !== null){
            // Hide all information containers
            unselectEverything();
            // Removing selection from the other
            comp_mass_fraction_distribution_btn.classList.remove('active');
            comp_number_fraction_distribution_btn.classList.remove('active');
            mass_fraction_overview_btn.classList.remove('active');
            mass_flow_btn.classList.remove('active');
            number_fraction_overview_btn.classList.remove('active');
            // Highlighting selection on the navbar
            number_flow_btn.classList.add('active');
            createFlowsGraph("Particle Number Flows", "particle number", utopia_model_results.extended_comp);
        }
    });

    let about_page_btn = document.getElementById('about_page_btn')
    about_page_btn.addEventListener( 'click', function () {
        unselectForAbout();
        d3.select('#about-page').style("display", "flex"); // show the about page
    });
    
    const rangeInput = document.getElementById('fragmentation_style');
    const rangeValue = document.getElementById('selectedFragmentationRange');
    rangeInput.addEventListener('input', function() {
        rangeValue.textContent = rangeInput.value;
    });
    rangeValue.textContent = rangeInput.value;
});