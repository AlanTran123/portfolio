import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

let data = [];
let commits = [];
let filteredCommits = [];

let xScale;
let yScale;
let rScale;

let svg;
let dots;
let xAxis;
let yAxis;
let gridlines;

let commitProgress = 100;
let timeScale;
let commitMaxTime;

let selectedCommits = [];


/* ============================================================
   LOAD DATA
   ============================================================ */

async function loadData() {
  const loadedData = await d3.csv(
    'loc.csv',
    (row) => ({
      ...row,
      line: +row.line,
      depth: +row.depth,
      length: +row.length,
      date: new Date(row.date + 'T00:00' + row.timezone),
      datetime: new Date(row.datetime),
    })
  );

  return loadedData;
}


/* ============================================================
   PROCESS COMMITS
   ============================================================ */

function processCommits(data) {
  return d3
    .groups(
      data,
      (d) => d.commit
    )
    .map(([commit, lines]) => {
      const first = lines[0];

      const datetime =
        new Date(first.datetime);

      const hourFrac =
        datetime.getHours() +
        datetime.getMinutes() / 60;

      return {
        id: commit,
        url:
          `https://github.com/AlanTran123/portfolio/commit/${commit}`,
        author: first.author,
        date: datetime,
        time:
          datetime.toLocaleTimeString(
            'en',
            {
              hour: 'numeric',
              minute: '2-digit',
            }
          ),
        datetime,
        hourFrac,
        totalLines:
          lines.length,
        lines,
      };
    })
    .sort(
      (a, b) =>
        d3.ascending(
          a.datetime,
          b.datetime
        )
    );
}


/* ============================================================
   SUMMARY
   ============================================================ */

function renderCommitInfo(
  filteredData,
  filteredCommits
) {
  const stats =
    d3.select('#stats');

  stats.html('');

  const numberOfFiles =
    d3.group(
      filteredData,
      (d) => d.file
    ).size;

  const avgLineLength =
    d3.mean(
      filteredData,
      (d) => d.length
    );

  const maxDepth =
    d3.max(
      filteredData,
      (d) => d.depth
    );

  const fileLengths =
    d3.rollups(
      filteredData,
      (lines) => lines.length,
      (d) => d.file
    );

  const avgFileLength =
    d3.mean(
      fileLengths,
      (d) => d[1]
    );

  const summary = [
    {
      label: 'Total LOC',
      value:
        filteredData.length,
    },
    {
      label: 'Total commits',
      value:
        filteredCommits.length,
    },
    {
      label: 'Number of files',
      value:
        numberOfFiles,
    },
    {
      label: 'Avg line length',
      value:
        avgLineLength
          ? `${avgLineLength.toFixed(1)} chars`
          : '0 chars',
    },
    {
      label: 'Maximum depth',
      value:
        maxDepth ?? 0,
    },
    {
      label: 'Avg file length',
      value:
        avgFileLength
          ? `${avgFileLength.toFixed(1)} lines`
          : '0 lines',
    },
  ];

  stats
    .selectAll('div')
    .data(summary)
    .join('div')
    .html(
      (d) => `
        <dt>${d.label}</dt>
        <dd>${d.value}</dd>
      `
    );
}


/* ============================================================
   TOOLTIP
   ============================================================ */

function updateTooltipContent(commit) {
  document
    .getElementById(
      'commit-link'
    )
    .href =
      commit.url;

  document
    .getElementById(
      'commit-link'
    )
    .textContent =
      commit.id;

  document
    .getElementById(
      'commit-date'
    )
    .textContent =
      commit.datetime
        .toLocaleDateString(
          'en',
          {
            dateStyle: 'full',
          }
        );

  document
    .getElementById(
      'commit-time'
    )
    .textContent =
      commit.time;

  document
    .getElementById(
      'commit-author'
    )
    .textContent =
      commit.author;

  document
    .getElementById(
      'commit-lines'
    )
    .textContent =
      commit.totalLines;
}


function updateTooltipPosition(event) {
  const tooltip =
    document.getElementById(
      'commit-tooltip'
    );

  tooltip.style.left =
    `${event.clientX + 10}px`;

  tooltip.style.top =
    `${event.clientY + 10}px`;
}


function showTooltip(event, commit) {
  updateTooltipContent(commit);
  updateTooltipPosition(event);

  document
    .getElementById(
      'commit-tooltip'
    )
    .hidden =
      false;
}


function hideTooltip() {
  document
    .getElementById(
      'commit-tooltip'
    )
    .hidden =
      true;
}


/* ============================================================
   SELECTION / BRUSH
   ============================================================ */

function isCommitSelected(
  selection,
  commit
) {
  if (!selection) {
    return false;
  }

  const [[x0, y0], [x1, y1]] =
    selection;

  const x =
    xScale(
      commit.datetime
    );

  const y =
    yScale(
      commit.hourFrac
    );

  return (
    x >= x0 &&
    x <= x1 &&
    y >= y0 &&
    y <= y1
  );
}


function updateSelectionCount() {
  const count =
    selectedCommits.length;

  document
    .getElementById(
      'selection-count'
    )
    .textContent =
      count === 0
        ? 'No commits selected'
        : `${count} ${
            count === 1
              ? 'commit'
              : 'commits'
          } selected`;
}


function updateLanguageBreakdown() {
  const container =
    d3.select(
      '#language-breakdown'
    );

  if (
    selectedCommits.length === 0
  ) {
    container.html('');
    return;
  }

  const selectedLines =
    selectedCommits.flatMap(
      (commit) =>
        commit.lines
    );

  const breakdown =
    d3.rollups(
      selectedLines,
      (lines) => lines.length,
      (d) => d.type
    );

  container.html('');

  container
    .selectAll('div')
    .data(breakdown)
    .join('div')
    .html(
      ([type, count]) => `
        <dt>${type}</dt>
        <dd>${count} lines</dd>
      `
    );
}


function brushed(event) {
  selectedCommits =
    filteredCommits.filter(
      (commit) =>
        isCommitSelected(
          event.selection,
          commit
        )
    );

  dots
    .selectAll('circle')
    .classed(
      'selected',
      (commit) =>
        selectedCommits.includes(
          commit
        )
    );

  updateSelectionCount();
  updateLanguageBreakdown();
}


/* ============================================================
   SCATTERPLOT
   ============================================================ */

function renderScatterPlot() {
  const width = 1000;
  const height = 600;

  const margin = {
    top: 10,
    right: 10,
    bottom: 30,
    left: 50,
  };

  svg =
    d3
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

  xScale =
    d3
      .scaleTime()
      .range([
        margin.left,
        width -
          margin.right,
      ]);

  yScale =
    d3
      .scaleLinear()
      .domain([0, 24])
      .range([
        height -
          margin.bottom,
        margin.top,
      ]);

  rScale =
    d3
      .scaleSqrt()
      .range([2, 30]);

  xAxis =
    svg
      .append('g')
      .attr(
        'transform',
        `translate(0,${
          height -
          margin.bottom
        })`
      );

  yAxis =
    svg
      .append('g')
      .attr(
        'transform',
        `translate(${margin.left},0)`
      );

  gridlines =
    svg
      .append('g')
      .attr(
        'class',
        'gridlines'
      )
      .attr(
        'transform',
        `translate(${margin.left},0)`
      );

  dots =
    svg
      .append('g')
      .attr(
        'class',
        'dots'
      );

  const brush =
    d3
      .brush()
      .extent([
        [
          margin.left,
          margin.top,
        ],
        [
          width -
            margin.right,
          height -
            margin.bottom,
        ],
      ])
      .on(
        'start brush end',
        brushed
      );

  svg
    .append('g')
    .attr(
      'class',
      'brush'
    )
    .call(brush);
}


/* ============================================================
   UPDATE SCATTERPLOT
   ============================================================ */

function updateScatterPlot(
  filteredData,
  commitsToShow
) {
  if (
    commitsToShow.length === 0
  ) {
    return;
  }

  const xDomain =
    d3.extent(
      commitsToShow,
      (d) => d.datetime
    );

  if (
    +xDomain[0] ===
    +xDomain[1]
  ) {
    xDomain[0] =
      new Date(
        xDomain[0].getTime() -
          60 * 60 * 1000
      );

    xDomain[1] =
      new Date(
        xDomain[1].getTime() +
          60 * 60 * 1000
      );
  }

  xScale.domain(xDomain);

  rScale.domain([
    0,
    d3.max(
      commitsToShow,
      (d) =>
        d.totalLines
    ) || 1,
  ]);

  xAxis.call(
    d3.axisBottom(xScale)
  );

  yAxis.call(
    d3
      .axisLeft(yScale)
      .tickFormat((d) => {
        const hour =
          d % 24;

        const date =
          new Date(
            2024,
            0,
            1,
            hour
          );

        return date
          .toLocaleTimeString(
            'en',
            {
              hour: 'numeric',
            }
          );
      })
  );

  gridlines.call(
    d3
      .axisLeft(yScale)
      .tickSize(
        -(
          1000 -
          50 -
          10
        )
      )
      .tickFormat('')
  );

  dots
    .selectAll('circle')
    .data(
      commitsToShow,
      (d) => d.id
    )
    .join(
      (enter) =>
        enter
          .append('circle')
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
            0
          )
          .attr(
            'fill',
            'steelblue'
          )
          .attr(
            'fill-opacity',
            0.7
          )
          .call(
            (enter) =>
              enter
                .transition()
                .duration(200)
                .attr(
                  'r',
                  (d) =>
                    rScale(
                      d.totalLines
                    )
                )
          ),

      (update) =>
        update.call(
          (update) =>
            update
              .transition()
              .duration(200)
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
        ),

      (exit) =>
        exit
          .transition()
          .duration(200)
          .attr('r', 0)
          .remove()
    )
    .on(
      'mouseenter',
      showTooltip
    )
    .on(
      'mousemove',
      updateTooltipPosition
    )
    .on(
      'mouseleave',
      hideTooltip
    );
}


/* ============================================================
   FILE VISUALIZATION
   ============================================================ */

function renderFileVisualization(data) {
  const files =
    d3
      .groups(
        data,
        (d) => d.file
      )
      .map(
        ([name, lines]) => ({
          name,
          lines,
        })
      )
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

          div.append('dt');
          div.append('dd');

          return div;
        },

        (update) =>
          update,

        (exit) =>
          exit.remove()
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
   UPDATE VISUALIZATION TO A SPECIFIC TIME
   ============================================================ */

function updateToTime(maxTime) {
  filteredCommits =
    commits.filter(
      (d) =>
        d.datetime <=
        maxTime
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

  renderFileVisualization(
    filteredData
  );

  selectedCommits = [];

  document
    .getElementById(
      'selection-count'
    )
    .textContent =
      'No commits selected';

  document
    .getElementById(
      'language-breakdown'
    )
    .innerHTML = '';
}


/* ============================================================
   TIME SLIDER
   ============================================================ */

function onTimeSliderChange() {
  commitProgress =
    +document
      .getElementById(
        'commit-progress'
      )
      .value;

  commitMaxTime =
    timeScale.invert(
      commitProgress
    );

  document
    .getElementById(
      'commit-time-filter'
    )
    .textContent =
      commitMaxTime
        .toLocaleString(
          'en',
          {
            dateStyle: 'long',
            timeStyle: 'short',
          }
        );

  updateToTime(
    commitMaxTime
  );
}


/* ============================================================
   COMMIT STORY
   ============================================================ */

function renderCommitStory() {
  d3
    .select(
      '#scatter-story'
    )
    .selectAll(
      '.step'
    )
    .data(commits)
    .join('div')
    .attr(
      'class',
      'step'
    )
    .html(
      (d, i) => {
        const filesEdited =
          d3.rollups(
            d.lines,
            (lines) =>
              lines.length,
            (line) =>
              line.file
          ).length;

        const date =
          d.datetime
            .toLocaleString(
              'en',
              {
                dateStyle:
                  'full',
                timeStyle:
                  'short',
              }
            );

        return `
          <p>
            On
            <strong>${date}</strong>,
            I made
            <a
              href="${d.url}"
              target="_blank"
            >
              ${
                i === 0
                  ? 'my first commit'
                  : 'another commit'
              }
            </a>.
          </p>

          <p>
            I edited
            <strong>
              ${d.totalLines} lines
            </strong>
            across
            <strong>
              ${filesEdited}
              ${
                filesEdited === 1
                  ? 'file'
                  : 'files'
              }
            </strong>.
          </p>
        `;
      }
    );
}


/* ============================================================
   SCROLLYTELLING
   ============================================================ */

function onStepEnter(response) {
  const commit =
    response.element.__data__;

  if (!commit) {
    return;
  }

  d3
    .selectAll(
      '#scatter-story .step'
    )
    .classed(
      'is-active',
      false
    );

  d3
    .select(
      response.element
    )
    .classed(
      'is-active',
      true
    );

  /*
   * Scrolling updates the graph,
   * stats, and file visualization.
   *
   * IMPORTANT:
   * We intentionally DO NOT update
   * the slider here.
   */

  updateToTime(
    commit.datetime
  );
}


/* ============================================================
   INITIALIZE
   ============================================================ */

async function init() {
  data =
    await loadData();

  commits =
    processCommits(data);

  filteredCommits =
    commits;

  const firstCommit =
    commits[0];

  const lastCommit =
    commits[
      commits.length - 1
    ];

  timeScale =
    d3
      .scaleTime()
      .domain([
        firstCommit.datetime,
        lastCommit.datetime,
      ])
      .range([
        0,
        100,
      ]);

  commitMaxTime =
    lastCommit.datetime;

  document
    .getElementById(
      'commit-progress'
    )
    .value =
      100;

  document
    .getElementById(
      'commit-time-filter'
    )
    .textContent =
      lastCommit.datetime
        .toLocaleString(
          'en',
          {
            dateStyle: 'long',
            timeStyle: 'short',
          }
        );

  document
    .getElementById(
      'commit-progress'
    )
    .addEventListener(
      'input',
      onTimeSliderChange
    );

  renderScatterPlot();

  updateScatterPlot(
    data,
    commits
  );

  renderCommitInfo(
    data,
    commits
  );

  renderFileVisualization(
    data
  );

  renderCommitStory();

  const scroller =
    scrollama();

  scroller
    .setup({
      container:
        '#scrolly-1',
      step:
        '#scrolly-1 .step',
      offset:
        0.5,
    })
    .onStepEnter(
      onStepEnter
    );

  window.addEventListener(
    'resize',
    () => {
      scroller.resize();
    }
  );
}


init();