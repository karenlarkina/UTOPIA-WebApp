
document.addEventListener('DOMContentLoaded', function () {
    // Select the "Run" button
    var runButton = document.getElementById('run-model');

    // Add event listener for button click
    runButton.addEventListener('click', function() {
        // Remove any existing heatmap
        d3.select('#heatmap-container').selectAll('*').remove();
        // set the dimensions and margins of the graph
        const margin = {top: 100, right: 100, bottom: 100, left: 150},
        width = 700 - margin.left - margin.right,
        height = 700 - margin.top - margin.bottom;

        // append the svg object to the body of the page
        const svg = d3.select("#heatmap-container")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        d3.csv("https://raw.githubusercontent.com/claudiodgl/test/main/test.csv").then(function(data) {
        //d3.csv("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/heatmap_data.csv").then(function (data) {

        // Labels of row and columns -> unique identifier of the column called 'group' and 'variable'
        const myGroups = Array.from(new Set(data.map(d => d.group)))
        const myVars = Array.from(new Set(data.map(d => d.variable)))
        const myValues = data.map(d => parseFloat(d.value));

        // Get the minimum and maximum values
        const minValue = d3.min(myValues);
            const maxValue = d3.max(myValues);

            // Build X scales and axis:
            const x = d3.scaleBand()
                .range([0, width])
                .domain(myVars)
                .padding(0.05);
            svg.append("g")
                .style("font-size", 12) // Decrease font size
                .attr("transform", `translate(0, ${height})`)
                .call(d3.axisBottom(x)
                    .tickSize(0))
                .selectAll("text")
                .attr("dy", "0.5em") // Adjust vertical positioning
                .attr("transform", "rotate(-45)") // Rotate labels
                .style("text-anchor", "end"); // Adjust text alignment

            // Build Y scales and axis:
            const y = d3.scaleBand()
                .range([height, 0])
                .domain(myGroups.reverse())
                .padding(0.05);
            svg.append("g")
                .style("font-size", 12) // Decrease font size
                .call(d3.axisLeft(y)
                    .tickSize(0))
                .selectAll("text")
                .attr("transform", "rotate(0)") // Keep labels horizontal
                .style("text-anchor", "end"); // Adjust text alignment

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

            /*
            // Get the height of the heatmap
            const heatmapHeight = height;

            // Color scale
            const colorScaleGroup = svg.append("g")
                .attr("class", "legend")
                .attr("transform", `translate(${width + 20}, 0)`) // Adjust position
                .attr("height", heatmapHeight); // Set the height

            const colorScaleRects = colorScaleGroup.selectAll(".colorScaleRect")
                .data(d3.range(minValue, maxValue + (maxValue - minValue) / 10, (maxValue - minValue) / 10))
                .enter().append("rect")
                .attr("class", "colorScaleRect")
                .attr("x", 0)
                .attr("y", (d, i) => i * (heatmapHeight / 10)) // Adjust y position
                .attr("width", 20)
                .attr("height", heatmapHeight / 10) // Set the height
                .style("fill", d => myColor(d));

            const colorAxis = d3.axisRight(d3.scaleLinear()
                .domain([minValue, maxValue])
                .range([heatmapHeight, 0])) // Adjust range
                .ticks(6);

            colorScaleGroup.append("g")
                .attr("class", "colorScale")
                .attr("transform", "translate(20,0)") // Shift color scale to the right
                .call(colorAxis)
                .selectAll("text")
                .attr("dx", "-0.5em") // Adjust text position to the right
                .style("text-anchor", "end") // Align text to the end
                .attr("transform", `translate(20, ${heatmapHeight})`);
                */

        // create a tooltip
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
                    .style("stroke", "black")
                    .style("opacity", 1);
            };

            const mousemove = function (event, d) {
                tooltip
                    .html("The value of this cell is: " + d.value)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 40) + "px"); // Adjust top position
            };

            const mouseleave = function (event, d) {
                tooltip
                    .style("opacity", 0);
                d3.select(this)
                    .style("stroke", "white") // Set stroke color to a darker grey
                    .style("opacity", 0.8);
            };

        // add the squares
        svg.selectAll()
            .data(data, function(d) {return d.group+':'+d.variable;})
            .join("rect")
                .attr("x", function(d) { return x(d.variable) })
                .attr("y", function(d) { return y(d.group) })
                .attr("width", x.bandwidth() )
                .attr("height", y.bandwidth() )
            .style("fill", function (d) { return getColor(d.value) })
            .style("stroke-width", 1) // Reduce stroke width to 1 pixel
                .style("opacity", 0.8)
            .on("mouseover", mouseover)
            .on("mousemove", mousemove)
            .on("mouseleave", mouseleave)
            })

        // Add title to graph
        svg.append("text")
            .attr("x", 0)
            .attr("y", -50)
            .attr("text-anchor", "left")
            .style("font-size", "22px")
            .text("UTOPIA Heatmap");

    })
});