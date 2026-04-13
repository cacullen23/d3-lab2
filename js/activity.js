// Find TODO statements and complete them to build the interactive airline route map.

// TODO: add your uniqname to the HTML (use id #uniqname) file so that your work can be identified 

// import data using d3.csv()
const dataFile = await d3.csv('/data/routes.csv');

const colornone = "#ccc";

// define colors for airlines, you can expand this as needed, WN is Southwest, B6 is JetBlue
const airlineColor = { WN: "orange", B6: "steelblue" };
const airlineName = { WN: "Southwest Airlines", B6: "JetBlue" };

// create options from selector that allows us to view all airlines or filter by a specific airline
const airlines = ["all", ...new Set(dataFile.map(d => d.Airline))];

// build selector from data
const select = d3.select("body")
    .insert("select", "#chart")
    .on("change", function () { draw(this.value); });

select.selectAll("option")
    .data(airlines)
    .join("option")
    .attr("value", d => d)
    .text(d => d === "all" ? "All Airlines" : (airlineName[d] || d));

// helper function to build outgoing links for each leaf node
function bilink(root) {
    const map = new Map(root.leaves().map(d => [id(d), d]));

    for (const d of root.leaves()) {
        d.incoming = [];
        d.outgoing = d.data.destinations
            .map(({ target, airline, targetRegion }) => [d, map.get(`root/${targetRegion}/${target}`), airline])
            .filter(([, target]) => target !== undefined);
    }

    for (const d of root.leaves()) {
        for (const o of d.outgoing) {
            o[1].incoming.push(o);
        }
    }

    return root;
}

// helper function to generate a unique ID for each node based on its position in the hierarchy
function id(node) {
    return `${node.parent ? id(node.parent) + "/" : ""}${node.data.name}`;
}

//rebuild hierarchy data and redraw chart on selection change
function draw(airlineFilter) {

    // filter data based on selection, if "all" is selected, use the entire dataset
    const filtered = airlineFilter === "all"
        ? dataFile
        : dataFile.filter(d => d.Airline === airlineFilter);

    // group data by source region and then by source airport
    const grouped = d3.group(filtered, d => d["Source region"], d => d["Source airport"]);

    // transform grouped data into a hierarchy format suitable for the chart
    const hierarchyData = {
        name: "root",
        children: Array.from(grouped, ([region, airports]) => ({
            name: region,
            children: Array.from(airports, ([airport, routes]) => ({
                name: airport,
                region: region,
                destinations: routes.map(r => ({
                    target: r["Destination airport"],
                    airline: r.Airline,
                    targetRegion: r["Destination region"]
                }))
            }))
        }))
    };

    document.getElementById("chart").innerHTML = "";
    document.getElementById("chart").appendChild(createChart(hierarchyData));
}

draw("all"); // initial draw

// create chart
function createChart(data) {
    const width = 954;
    const radius = width / 2;

    const tree = d3.cluster()
        .size([2 * Math.PI, radius - 100]);

    const root = tree(
        bilink(
            d3.hierarchy(data)
                .sort((a, b) =>
                    d3.ascending(a.height, b.height) || d3.ascending(a.data.name, b.data.name)
                )
        )
    );

    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", width)
        .attr("viewBox", [-width / 2, -width / 2, width, width])
        .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");

    const line = d3.lineRadial()
        .curve(d3.curveBundle.beta(0.85))
        .radius(d => d.y)
        .angle(d => d.x);

    const link = svg.append("g")
        .attr("fill", "none")
        .selectAll()
        .data(root.leaves().flatMap(leaf => leaf.outgoing))
        .join("path")
        .style("mix-blend-mode", "multiply")
        .attr("stroke", d => airlineColor[d[2]] || colornone)
        .attr("stroke-opacity", 0.5)
        .attr("stroke-width", 1.5)
        .attr("d", ([i, o]) => line(i.path(o)))
        .each(function(d) { d.path = this; });

    const node = svg.append("g")
        .selectAll()
        .data(root.leaves())
        .join("g")
        .attr("transform", d => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`)
        .append("text")
        .attr("dy", "0.31em")
        .attr("x", d => d.x < Math.PI ? 6 : -6)
        .attr("text-anchor", d => d.x < Math.PI ? "start" : "end")
        .attr("transform", d => d.x >= Math.PI ? "rotate(180)" : null)
        .text(d => d.data.name)
        .each(function(d) { d.text = this; })
        .on("mouseover", overed)
        .on("mouseout", outed)
        .call(text =>
            text.append("title").text(d =>
                `${d.data.name}
Region: ${d.parent.data.name}
Outgoing routes: ${d.outgoing.length}
Incoming routes: ${d.incoming.length}`
            )
        );

    function overed(event, d) {
        link
            .attr("stroke", l => airlineColor[l[2]] || colornone)
            .attr("stroke-opacity", 0.08);

        d3.select(this).attr("font-weight", "bold").attr("fill", "black");

        d3.selectAll(d.incoming.map(l => l.path))
            .attr("stroke", colorin)
            .attr("stroke-opacity", 1)
            .attr("stroke-width", 2.5)
            .raise();

        d3.selectAll(d.outgoing.map(l => l.path))
            .attr("stroke", colorout)
            .attr("stroke-opacity", 1)
            .attr("stroke-width", 2.5)
            .raise();

        d3.selectAll(d.incoming.map(([source]) => source.text))
            .attr("fill", colorin)
            .attr("font-weight", "bold");

        d3.selectAll(d.outgoing.map(([, target]) => target.text))
            .attr("fill", colorout)
            .attr("font-weight", "bold");
    }

    function outed(event, d) {
        link
            .attr("stroke", l => airlineColor[l[2]] || colornone)
            .attr("stroke-opacity", 0.5)
            .attr("stroke-width", 1.5);

        d3.select(this).attr("font-weight", null).attr("fill", null);

        d3.selectAll(d.incoming.map(l => l.path)).attr("stroke-width", 1.5);
        d3.selectAll(d.outgoing.map(l => l.path)).attr("stroke-width", 1.5);

        d3.selectAll(d.incoming.map(([source]) => source.text))
            .attr("fill", null)
            .attr("font-weight", null);

        d3.selectAll(d.outgoing.map(([, target]) => target.text))
            .attr("fill", null)
            .attr("font-weight", null);
    }

    return svg.node();
}
