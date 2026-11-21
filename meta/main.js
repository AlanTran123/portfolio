import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

let data = [];
let commits = [];
let filteredCommits = [];

let xScale;
let yScale;

let commitProgress = 100;
let timeScale;
let commitMaxTime;


/* ============================================================
   LOAD DATA
   ============================================================ */

async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,

    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),

    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}


/* ============================================================
   PROCESS COMMITS
   ============================================================ */

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];

      const {
        author,
        date,
        time,
        timezone,
        datetime,
      } = first;

      const ret = {
        id: commit,

        url:
          'https://github.com/AlanTran123/portfolio/commit/' +
          commit,

        author,
        date,
        time,
        timezone,
        datetime,

        hourFrac:
          datetime.getHours() +
          datetime.getMinutes() / 60,

        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        configurable: true,
        writable: true,
        enumerable: false,
      });

      return ret;
    })
    .sort((a, b) => a.datetime - b.datetime);
}


/* ============================================================
   SUMMARY STATISTICS
   ============================================================ */

function renderCommitInfo(data, commits) {
  const stats = d3.select('#stats');

  stats.selectAll('*').remove();

  const dl = stats
    .append('dl')
    .attr('class', 'stats');


  dl
    .append('dt')
    .html('Total <abbr title="Lines of code">LOC</abbr>');

  dl
    .append('dd')
    .text(data.length);


  dl
    .append('dt')
    .text('Total commits');

  dl
    .append('dd')
    .text(commits.length);


  const numberOfFiles =
    d3.group(data, (d) => d.file).size;

  dl
    .append('dt')
    .text('Number of files');

  dl
    .append('dd')
    .text(numberOfFiles);


  const averageLineLength =
    d3.mean(data, (d) => d.length);

  dl
    .append('dt')
    .text('Avg. line length');

  dl
    .append('dd')
    .text(
      averageLineLength
        ? `${averageLineLength.toFixed(1)} chars`
        : '0 chars'
    );


  const maximumDepth =
    d3.max(data, (d) => d.depth);

  dl
    .append('dt')
    .text('Maximum depth');

  dl
    .append('dd')
    .text(maximumDepth ?? 0);


  const fileLengths = d3.rollups(
    data,
    (values) =>
      d3.max(values, (d) => d.line),
    (d) => d.file,
  );

  const averageFileLength =
    d3.mean(
      fileLengths,
      (d) => d[1]
    );

  dl
    .append('dt')
    .text('Avg. file length');

  dl
    .append('dd')
    .text(
      averageFileLength
        ? `${averageFileLength.toFixed(1)} lines`
        : '0 lines'
    );
}


/* ============================================================
   TOOLTIP
   ============================================================ */

function renderTooltipContent(commit) {
  if (
    !commit ||
    Object.keys(commit).length === 0
  ) {
    return;
  }

  const link =
    document.getElementById('commit-link');

  const date =
    document.getElementById('commit-date');

  const time =
    document.getElementById('commit-time');

  const author =
    document.getElementById('commit-author');

  const lines =
    document.getElementById('commit-lines');


  link.href = commit.url;
  link.textContent = commit.id;


  date.textContent =
    commit.datetime.toLocaleString(
      'en',
      {
        dateStyle: 'full',
      }
    );


  time.textContent =
    commit.datetime.toLocaleString(
      'en',
      {
        timeStyle: 'short',
      }
    );


  author.textContent =
    commit.author;


  lines.textContent =
    commit.totalLines;
}


function updateTooltipVisibility(isVisible) {
  const tooltip =
    document.getElementById('commit-tooltip');

  tooltip.hidden = !isVisible;
}


function updateTooltipPosition(event) {
  const tooltip =
    document.getElementById('commit-tooltip');

  const offset = 15;

  tooltip.style.left =
    `${event.clientX + offset}px`;

  tooltip.style.top =
    `${event.clientY + offset}px`;
}


/* ============================================================
   BRUSH SELECTION
   ============================================================ */

function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }

  const [
    [x0, y0],
    [x1, y1],
  ] = selection;


  const x =
    xScale(commit.datetime);

  const y =
    yScale(commit.hourFrac);


  return (
    x >= x0 &&
    x <= x1 &&
    y >= y0 &&
    y <= y1
  );
}


/* ============================================================
   SELECTED COMMIT COUNT
   ============================================================ */

function renderSelectionCount(selection) {
  const selectedCommits =
    selection
      ? filteredCommits.filter((d) =>
          isCommitSelected(
            selection,
            d
          )
        )
      : [];


  const countElement =
    document.querySelector(
      '#selection-count'
    );


  countElement.textContent =
    `${
      selectedCommits.length ||
      'No'
    } commits selected`;


  return selectedCommits;
}


/* ============================================================
   LANGUAGE BREAKDOWN
   ============================================================ */

function renderLanguageBreakdown(selection) {
  const selectedCommits =
    selection
      ? filteredCommits.filter((d) =>
          isCommitSelected(
            selection,
            d
          )
        )
      : [];


  const container =
    document.getElementById(
      'language-breakdown'
    );


  if (
    selectedCommits.length === 0
  ) {
    container.innerHTML = '';
    return;
  }


  const lines =
    selectedCommits.flatMap(
      (d) => d.lines
    );


  const breakdown =
    d3.rollup(
      lines,
      (values) =>
        values.length,
      (d) => d.type,
    );


  container.innerHTML = '';


  for (
    const [language, count]
    of breakdown
  ) {
    const proportion =
      count / lines.length;

    const formatted =
      d3.format('.1~%')(
        proportion
      );


    container.innerHTML += `
      <dt>${language}</dt>
      <dd>
        ${count} lines
        (${formatted})
      </dd>
    `;
  }
}


/* ============================================================
   BRUSH EVENT
   ============================================================ */

function brushed(event) {
  const selection =
    event.selection;


  d3
    .selectAll(
      '.dots circle'
    )
    .classed(
      'selected',
      (d) =>
        isCommitSelected(
          selection,
          d
        )
    );


  renderSelectionCount(
    selection
  );


  renderLanguageBreakdown(
    selection
  );
}


/* ============================================================
   DOT EVENTS
   ============================================================ */

function addDotInteractions(selection) {
  selection
    .on(
      'mouseenter',
      (
        event,
        commit
      ) => {

        d3
          .select(
            event.currentTarget
          )
          .style(
            'fill-opacity',
            1
          );


        renderTooltipContent(
          commit
        );


        updateTooltipVisibility(
          true
        );


        updateTooltipPosition(
          event
        );
      }
    )

    .on(
      'mousemove',
      (event) => {
        updateTooltipPosition(
          event
        );
      }
    )

    .on(
      'mouseleave',
      (event) => {

        d3
          .select(
            event.currentTarget
          )
          .style(
            'fill-opacity',
            0.7
          );


        updateTooltipVisibility(
          false
        );
      }
    );
}


/* ============================================================
   SCATTERPLOT
   ============================================================ */

function renderScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;


  const margin = {
    top: 20,
    right: 30,
    bottom: 50,
    left: 60,
  };


  const usableArea = {
    top: margin.top,

    right:
      width -
      margin.right,

    bottom:
      height -
      margin.bottom,

    left:
      margin.left,

    width:
      width -
      margin.left -
      margin.right,

    height:
      height -
      margin.top -
      margin.bottom,
  };


  const svg = d3
    .select('#chart')
    .append('svg')
    .attr(
      'viewBox',
      `0 0 ${width} ${height}`
    )
    .style(
      'overflow',
      'visible'
    );


  xScale = d3
    .scaleTime()
    .domain(
      d3.extent(
        commits,
        (d) => d.datetime
      )
    )
    .range([
      usableArea.left,
      usableArea.right,
    ])
    .nice();


  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([
      usableArea.bottom,
      usableArea.top,
    ]);


  const [
    minLines,
    maxLines,
  ] = d3.extent(
    commits,
    (d) => d.totalLines
  );


  const rScale = d3
    .scaleSqrt()
    .domain([
      minLines,
      maxLines,
    ])
    .range([2, 30]);


  const gridlines = svg
    .append('g')
    .attr(
      'class',
      'gridlines'
    )
    .attr(
      'transform',
      `translate(${usableArea.left}, 0)`
    );


  gridlines.call(
    d3
      .axisLeft(yScale)
      .tickFormat('')
      .tickSize(
        -usableArea.width
      )
  );


  const xAxis =
    d3.axisBottom(
      xScale
    );


  const yAxis =
    d3
      .axisLeft(yScale)
      .tickFormat(
        (d) =>
          String(
            d % 24
          ).padStart(
            2,
            '0'
          ) + ':00'
      );


  svg
    .append('g')
    .attr(
      'class',
      'x-axis'
    )
    .attr(
      'transform',
      `translate(0, ${usableArea.bottom})`
    )
    .call(xAxis);


  svg
    .append('g')
    .attr(
      'class',
      'y-axis'
    )
    .attr(
      'transform',
      `translate(${usableArea.left}, 0)`
    )
    .call(yAxis);


  const dots = svg
    .append('g')
    .attr(
      'class',
      'dots'
    );


  const sortedCommits =
    d3.sort(
      commits,
      (d) =>
        -d.totalLines
    );


  const circles = dots
    .selectAll('circle')

    .data(
      sortedCommits,
      (d) => d.id
    )

    .join('circle')

    .attr(
      'cx',
      (d) =>
        xScale(
          d.datetime
        )
    )

    .attr(
      'cy',
      (d) =>
        yScale(
          d.hourFrac
        )
    )

    .attr(
      'r',
      (d) =>
        rScale(
          d.totalLines
        )
    )

    .attr(
      'fill',
      'steelblue'
    )

    .style(
      'fill-opacity',
      0.7
    );


  addDotInteractions(circles);


  const brush = d3
    .brush()

    .extent([
      [
        usableArea.left,
        usableArea.top,
      ],

      [
        usableArea.right,
        usableArea.bottom,
      ],
    ])

    .on(
      'start brush end',
      brushed
    );


  svg.call(brush);


  svg
    .selectAll(
      '.dots, .overlay ~ *'
    )
    .raise();
}


/* ============================================================
   UPDATE SCATTERPLOT
   ============================================================ */

function updateScatterPlot(data, commits) {
  if (commits.length === 0) {
    return;
  }


  const svg =
    d3.select('#chart')
      .select('svg');


  xScale.domain(
    d3.extent(
      commits,
      (d) => d.datetime
    )
  );


  const [
    minLines,
    maxLines,
  ] = d3.extent(
    commits,
    (d) => d.totalLines
  );


  const rScale = d3
    .scaleSqrt()
    .domain([
      minLines,
      maxLines,
    ])
    .range([2, 30]);


  const xAxis =
    d3.axisBottom(
      xScale
    );


  svg
    .select('g.x-axis')
    .transition()
    .duration(200)
    .call(xAxis);


  const dots =
    svg.select(
      'g.dots'
    );


  const sortedCommits =
    d3.sort(
      commits,
      (d) =>
        -d.totalLines
    );


  const circles = dots
    .selectAll('circle')

    .data(
      sortedCommits,
      (d) => d.id
    )

    .join('circle')

    .attr(
      'cx',
      (d) =>
        xScale(
          d.datetime
        )
    )

    .attr(
      'cy',
      (d) =>
        yScale(
          d.hourFrac
        )
    )

    .attr(
      'r',
      (d) =>
        rScale(
          d.totalLines
        )
    )

    .attr(
      'fill',
      'steelblue'
    )

    .style(
      'fill-opacity',
      0.7
    );


  addDotInteractions(circles);


  svg
    .selectAll(
      '.dots, .overlay ~ *'
    )
    .raise();
}


/* ============================================================
   LAB 8 — UNIT VISUALIZATION
   ============================================================ */

function renderFileVisualization(data) {
  const files =
    d3
      .groups(data, (d) => d.file)
      .map(([name, lines]) => ({
        name,
        lines,
      }))
      .sort(
        (a, b) =>
          b.lines.length -
          a.lines.length
      );


  const filesContainer =
    d3.select('#files');


  const fileGroups =
    filesContainer
      .selectAll('div.file')
      .data(
        files,
        (d) => d.name
      )
      .join(
        (enter) => {
          const div =
            enter
              .append('div')
              .attr(
                'class',
                'file'
              );


          div
            .append('dt');


          div
            .append('dd');


          return div;
        }
      );


  fileGroups
    .select('dt')
    .html(
      (d) => `
        <code>${d.name}</code>
        <small>
          ${d.lines.length} lines
        </small>
      `
    );


  fileGroups
    .select('dd')
    .selectAll('div.loc')
    .data(
      (d) => d.lines,
      (d) =>
        `${d.commit}-${d.file}-${d.line}`
    )
    .join('div')
    .attr(
      'class',
      'loc'
    )
    .attr(
      'style',
      (d) =>
        `--level: ${d.depth}`
    )
    .attr(
      'data-type',
      (d) => d.type
    );
}


/* ============================================================
   TIME SLIDER
   ============================================================ */

function onTimeSliderChange() {
  const slider =
    document.getElementById(
      'commit-progress'
    );


  commitProgress =
    Number(
      slider.value
    );


  commitMaxTime =
    timeScale.invert(
      commitProgress
    );


  const timeElement =
    document.getElementById(
      'commit-time-filter'
    );


  timeElement.textContent =
    commitMaxTime.toLocaleString(
      'en',
      {
        dateStyle: 'long',
        timeStyle: 'short',
      }
    );


  filteredCommits =
    commits.filter(
      (d) =>
        d.datetime <=
        commitMaxTime
    );


  if (
    filteredCommits.length === 0
  ) {
    filteredCommits =
      [commits[0]];
  }


  const filteredData =
    filteredCommits.flatMap(
      (d) => d.lines
    );


  updateScatterPlot(
    filteredData,
    filteredCommits
  );


  renderCommitInfo(
    filteredData,
    filteredCommits
  );


  /*
    Lab 8 Step 2:
    update the file visualization
    whenever the time slider changes.
  */

  renderFileVisualization(
    filteredData
  );


  document.getElementById(
    'selection-count'
  ).textContent =
    'No commits selected';


  document.getElementById(
    'language-breakdown'
  ).innerHTML = '';
}


/* ============================================================
   INITIALIZE
   ============================================================ */

data =
  await loadData();


commits =
  processCommits(
    data
  );


filteredCommits =
  commits;


timeScale = d3
  .scaleTime()
  .domain([
    d3.min(
      commits,
      (d) => d.datetime
    ),

    d3.max(
      commits,
      (d) => d.datetime
    ),
  ])
  .range([
    0,
    100
  ]);


commitMaxTime =
  timeScale.invert(
    commitProgress
  );


renderCommitInfo(
  data,
  commits
);


renderScatterPlot(
  data,
  commits
);


renderFileVisualization(
  data
);


document
  .getElementById(
    'commit-progress'
  )
  .addEventListener(
    'input',
    onTimeSliderChange
  );


onTimeSliderChange();