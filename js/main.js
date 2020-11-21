//global variables
const log = console.log;
//var keyArray = ["pop_dens_increase_2010_2020", "pop_total_2020", "pop_increase", "pct_urban_2020", "pct_change_urban", "median_age_2020"];

var keyArray = ["Rate of Population Density Increase (2010-2020)", "Population Total in 2020", "Rate of Population Increase (2010-2020)", "Percent of Population Urbanized (2020)", "Percent Change in Urbanization (2010-2020)", "Median Age (2020)"];

var expressed = keyArray[0];

window.onload = initialize(); //start script once HTML is loaded

function initialize() { //the first function called once the html is loaded
    setMap();
};

function setMap() { //set choropleth map parameters
    //map frame dimensions
    var width = 960;
    var height = 500;

    var title = d3.select("#map")
        .append("h1")
        .text("United States Choropleth");

    //create a new svg element with the above dimensions
    var map = d3.select("#map")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
    //.attr("class", "map");

    //create USA albers equal area conic projection, centered on USA
    var projection = d3.geoAlbersUsa()
        .scale(1050);

    //create svg path generator using the projection
    var path = d3.geoPath()
        .projection(projection);

    var graticule = d3.geoGraticule()
        .step([10, 10]); //place graticule lines every 10 degrees of longitude and latitude

    //create graticule background
    var gratBackground = map.append("path")
        .datum(graticule.outline) //bind graticule background
        .attr("class", "gratBackground") //assign class for styling
        .attr("d", path) //project graticule

    //create graticule lines
    var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
        .data(graticule.lines) //bind graticule lines to each element to be created
        .enter() //create an element for each datum
        .append("path") //append each element to the svg as a path element
        .attr("class", "gratLines") //assign class for styling
        .attr("d", path); //project graticule lines

    queue() //use queue.js to parallelize asynchronous data loading for cpu efficiency
        .defer(d3.csv, "data/usdemographics.csv") //load attributes data from csv
        .defer(d3.json, "data/usa.json") //load geometry from states topojson
        .await(callback);

    function callback(error, csvData, usStates) {
        console.log(csvData)
        console.log(usStates)

        var recolorMap = colorScale(csvData); //retrieve color scale generator

        //variables for csv to json data transfer
        var jsonRegions = usStates.objects.StateBoundaries.geometries;

        //loop through csv data to assign each csv region's values to json region properties
        for (var i = 0; i < csvData.length; i++) {
            var csvRegion = csvData[i]; //the current region's attributes
            var csvStateFP = csvRegion.STATEFP; //STATEFP -- UNIQUE STATE IDENTIFIER

            //loop through json regions to assign csv data to the right region
            for (var a = 0; a < jsonRegions.length; a++) {

                //where STATEFP codes match, attach csv data to json object
                if (jsonRegions[a].properties.STATEFP == csvStateFP) {

                    //one more for loop to assign all key/value pairs to json object
                    for (var key in keyArray) {
                        var attr = keyArray[key];
                        var val = parseFloat(csvRegion[attr]);
                        jsonRegions[a].properties[attr] = val;
                    };

                    jsonRegions[a].properties.NAME = csvRegion.name; //set prop
                    break; //stop looking through the json regions
                };
            };
        };

        //add regions to map as enumeration units colored by data
        var regions = map.selectAll(".regions")
            .data(topojson.feature(usStates, usStates.objects.StateBoundaries).features) //bind regions data to path element
            .enter() //create elements
            .append("path") //append elements to svg
            .attr("class", "regions") //assign class for additional styling
            .attr("id", function (d) {
                return 'st-' + d.properties.STATEFP
            })
            .attr("d", path) //project data as geometry in svg
            .style("fill", function (d) { //color enumeration units
                return choropleth(d, recolorMap);
            })
            .on("mouseover", highlight)
            .on("mouseout", dehighlight)
            .on("mousemove", moveLabel)
            .append("desc") //append the current color
            .text(function (d) {
                return choropleth(d, recolorMap);
            });

        createDropdown(csvData); //create the dropdown menu
        createChart(csvData);

        var title = d3.select()
            .append("H3")
            .text("United States Choropleth");
    };
};


function createChart(csvData) {

    document.getElementById('chart').innerHTML = '';

    var size = {
        width: 960,
        height: 700,
        margin: {
            top: 20,
            right: 20,
            bottom: 30,
            left: 150
        }
    };

    var selector = '#chart';

    var margin = size.margin;
    var width = size.width - margin.left - margin.right;
    var height = size.height - margin.top - margin.bottom;

    var arrayValue = [];
    var arrayNegValue = [];
    for (let i = 0; i < csvData.length; i++) {
        arrayValue.push(csvData[i][expressed]);
        if (csvData[i][expressed] < 0)
            arrayNegValue.push(csvData[i][expressed])
    }

    var minDataPoint = 0;
    if (arrayNegValue.length > 0)
        minDataPoint = d3.max(arrayNegValue);

    var maxDataPoint = d3.max(arrayValue);

    var x = d3.scaleLinear()
        .domain([minDataPoint, maxDataPoint])
        .range([0, width]);

    var y = d3.scaleBand()
        .domain(csvData.map(d => d.name))
        .rangeRound([0, height])
        .padding(0.2);

    var xAxis = d3.axisBottom(x);

    var yAxis = d3.axisLeft(y)
        .tickSize(0);

    var svg = d3.select(selector)
        .attr('width', size.width)
        .attr('height', size.height);

    var chart = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    var bar = chart.selectAll('.bar')
        .data(csvData)
        .enter().append('rect')
        .attr('class', d => `bar ${d[expressed] < 0 ? 'negative' : 'positive'}`)
        .attr('x', d => x(Math.min(0, d[expressed])))
        .attr('y', d => y(d.name))
        .attr('width', d => Math.abs(x(d[expressed]) - x(0)))
        .attr('height', y.bandwidth());

    chart.append('g')
        .attr('transform', `translate(0, ${height})`)
        .attr('class', 'axis x')
        .call(xAxis);

    chart.append('g')
        .attr('class', 'axis y')
        .attr('transform', `translate(${x(0)}, 0)`)
        .call(yAxis);

}


function createDropdown(csvData) {
    //add a select element for the dropdown menu
    var dropdown = d3.select("#option")
        .append("div")
        .attr("class", "dropdown") //for positioning menu with css
        .html("<h3>Select Variable:</h3>")
        .append("select")
        .on("change", function () {
            changeAttribute(this.value, csvData)
        }); //changes expressed attribute

    //create each option element within the dropdown
    dropdown.selectAll("options")
        .data(keyArray)
        .enter()
        .append("option")
        .attr("value", function (d) {
            return d
        })
        .text(function (d) {
            d = d[0].toUpperCase() + d.substring(1, 3) + d.substring(3);
            return d
        });
};

function colorScale(csvData) {

    //create quantile classes with color scale
    var color = d3.scaleQuantile() //designate quantile scale generator
        .range([
            "#e4f8da",
            "#ccf1ba",
            "#9ee480",
            "#66d641",
            "#3ace00"
        ]);

    //build array of all currently expressed values for input domain
    var domainArray = [];
    for (var i in csvData) {
        domainArray.push(Number(csvData[i][expressed]));
    };

    //for equal-interval scale, use min and max expressed data values as domain
    // color.domain([
    // 	d3.min(csvData, function(d) { return Number(d[expressed]); }),
    // 	d3.max(csvData, function(d) { return Number(d[expressed]); })
    // ]);

    //for quantile scale, pass array of expressed values as domain
    color.domain(domainArray);

    return color; //return the color scale generator
};

function choropleth(d, recolorMap) {

    //get data value
    var value = d.properties[expressed];
    //if value exists, assign it a color; otherwise assign gray
    if (value) {
        return recolorMap(value); //recolorMap holds the colorScale generator
    } else {
        return "#ccc";
    };
};

function changeAttribute(attribute, csvData) {
    //change the expressed attribute
    expressed = attribute;

    //recolor the map
    d3.selectAll(".regions") //select every region
        .style("fill", function (d) { //color enumeration units
            return choropleth(d, colorScale(csvData)); //->
        })
        .select("desc") //replace the color text in each region's desc element
        .text(function (d) {
            return choropleth(d, colorScale(csvData)); //->
        });

    createChart(csvData);
};

function format(value) {

    //format the value's display according to the attribute
    if (expressed != "Population") {
        value = "$" + roundRight(value);
    } else {
        value = roundRight(value);
    };

    return value;
};

function roundRight(number) {

    if (number >= 100) {
        var num = Math.round(number);
        return num.toLocaleString();
    } else if (number < 100 && number >= 10) {
        return number.toPrecision(4);
    } else if (number < 10 && number >= 1) {
        return number.toPrecision(3);
    } else if (number < 1) {
        return number.toPrecision(2);
    };
};

function highlight(data) {

    var props = data.properties; //json properties

    d3.select("#st-" + props.STATEFP) //select the current region in the DOM
        .style("fill", "#123456"); //set the enumeration unit fill to black

    var labelAttribute = "<h1>" + props[expressed] +
        "</h1><br><b>" + expressed + "</b>"; //label content
    var labelName = props.name //html string for name to go in child div

    //create info label div
    var infolabel = d3.select("body")
        .append("div") //create the label div
        .attr("class", "infolabel")
        .attr("id", 'st-' + props.STATEFP + "label") //for styling label
        .html(labelAttribute) //add text
        .append("div") //add child div for feature name
        .attr("class", "labelname") //for styling name
        .html(labelName); //add feature name to label
};

function dehighlight(data) {

    var props = data.properties; //json properties
    var region = d3.select("#st-" + props.STATEFP); //select the current region
    var fillcolor = region.select("desc").text(); //access original color from desc
    region.style("fill", fillcolor); //reset enumeration unit to orginal color

    d3.select("#st-" + props.STATEFP + "label").remove(); //remove info label
};

function moveLabel() {

    var x = d3.event.clientX + 10; //horizontal label coordinate based mouse position stored in d3.event
    var y = d3.event.clientY - 75; //vertical label coordinate
    d3.select(".infolabel") //select the label div for moving
        .style("margin-left", x + "px") //reposition label horizontal
        .style("margin-top", y + "px"); //reposition label vertical
};
