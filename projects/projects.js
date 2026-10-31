import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');

const projectsContainer = document.querySelector('.projects');
const searchInput = document.querySelector('.searchBar');

let query = '';
let selectedIndex = -1;
let currentProjects = projects;

const colors = d3.scaleOrdinal(d3.schemeTableau10);

function getFilteredProjects() {
    return projects.filter((project) => {
        const values = Object.values(project).join('\n').toLowerCase();
        return values.includes(query.toLowerCase());
    });
}

function renderPieChart(projectsGiven) {
    currentProjects = projectsGiven;

    const rolledData = d3.rollups(
        projectsGiven,
        (v) => v.length,
        (d) => d.year,
    );

    const data = rolledData.map(([year, count]) => {
        return {
            value: count,
            label: year,
        };
    });

    if (selectedIndex >= data.length) {
        selectedIndex = -1;
    }

    const sliceGenerator = d3.pie().value((d) => d.value);
    const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);

    const arcData = sliceGenerator(data);
    const arcs = arcData.map((d) => arcGenerator(d));

    const svg = d3.select('#projects-pie-plot');
    const legend = d3.select('.legend');

    // Clear old chart and legend before re-rendering
    svg.selectAll('path').remove();
    legend.selectAll('li').remove();

    arcs.forEach((arc, i) => {
        svg
            .append('path')
            .attr('d', arc)
            .attr('fill', colors(i))
            .attr('class', selectedIndex === i ? 'selected' : '')
            .on('click', () => {
                selectedIndex = selectedIndex === i ? -1 : i;

                svg
                    .selectAll('path')
                    .attr(
                        'class',
                        (_, idx) => (selectedIndex === idx ? 'selected' : ''),
                    );

                legend
                    .selectAll('li')
                    .attr(
                        'class',
                        (_, idx) =>
                            `legend-item ${
                                selectedIndex === idx ? 'selected' : ''
                            }`,
                    );

                if (selectedIndex === -1) {
                    renderProjects(
                        currentProjects,
                        projectsContainer,
                        'h2',
                    );
                } else {
                    const selectedYear = data[selectedIndex].label;

                    const filteredByYear = currentProjects.filter(
                        (project) => project.year === selectedYear,
                    );

                    renderProjects(
                        filteredByYear,
                        projectsContainer,
                        'h2',
                    );
                }
            });
    });

    data.forEach((d, idx) => {
        legend
            .append('li')
            .attr('style', `--color:${colors(idx)}`)
            .attr(
                'class',
                `legend-item ${selectedIndex === idx ? 'selected' : ''}`,
            )
            .html(
                `<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`,
            )
            .on('click', () => {
                selectedIndex = selectedIndex === idx ? -1 : idx;

                svg
                    .selectAll('path')
                    .attr(
                        'class',
                        (_, i) => (selectedIndex === i ? 'selected' : ''),
                    );

                legend
                    .selectAll('li')
                    .attr(
                        'class',
                        (_, i) =>
                            `legend-item ${
                                selectedIndex === i ? 'selected' : ''
                            }`,
                    );

                if (selectedIndex === -1) {
                    renderProjects(
                        currentProjects,
                        projectsContainer,
                        'h2',
                    );
                } else {
                    const selectedYear = data[selectedIndex].label;

                    const filteredByYear = currentProjects.filter(
                        (project) => project.year === selectedYear,
                    );

                    renderProjects(
                        filteredByYear,
                        projectsContainer,
                        'h2',
                    );
                }
            });
    });
}

// Initial render
renderProjects(projects, projectsContainer, 'h2');
renderPieChart(projects);

// Search functionality
searchInput.addEventListener('input', (event) => {
    query = event.target.value;

    selectedIndex = -1;

    const filteredProjects = getFilteredProjects();

    renderProjects(filteredProjects, projectsContainer, 'h2');
    renderPieChart(filteredProjects);
});