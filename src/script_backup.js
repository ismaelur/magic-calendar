let globalData = null;
let currentMode = 'geo'; // 'geo' or 'topo'

document.addEventListener('DOMContentLoaded', () => {
    // Initial Load
    loadYearData('2026');
    setupControls();
});

function setupControls() {
    const toggle = document.getElementById('geo-toggle');
    const yearSelect = document.getElementById('year-select');
    const infoText = document.getElementById('coord-info');

    // Toggle Logic
    toggle.addEventListener('change', (e) => {
        const isTopo = e.target.checked;
        currentMode = isTopo ? 'topo' : 'geo';

        infoText.textContent = isTopo ? "Vista desde Montevideo (Visual)" : "Centro de la Tierra (Astrológico)";

        // Re-render everything with new mode
        if (globalData) {
            const alignments = isTopo ? globalData.alignments.topocentric : globalData.alignments.geocentric;
            renderAlignments(alignments, currentMode);
            renderMoonPhases(globalData.moon_phases); // Re-render to update highlights
        }
    });

    // Year Logic
    yearSelect.addEventListener('change', (e) => {
        const year = e.target.value;
        document.querySelector('h1').textContent = `Calendario Mágico ${year}`;
        loadYearData(year);
    });
}

function loadYearData(year) {
    fetch(`data_${year}.json`)
        .then(response => response.json())
        .then(data => {
            globalData = data;

            // Re-apply current mode
            const toggle = document.getElementById('geo-toggle');
            currentMode = toggle.checked ? 'topo' : 'geo';

            const alignments = currentMode === 'topo' ? globalData.alignments.topocentric : globalData.alignments.geocentric;

            renderAlignments(alignments, currentMode);
            renderMoonPhases(globalData.moon_phases);
        })
        .catch(error => {
            console.error('Error loading data:', error);
            alert('No hay datos para este año todavía o hubo un error cargándolos.');
        });
}

function parseLocalIdDate(dateString) {
    const [y, m, d] = dateString.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function getFilteredAlignments(mode) {
    if (!globalData) return [];
    const source = mode === 'topo' ? globalData.alignments.topocentric : globalData.alignments.geocentric;

    return source.filter(a => {
        if (mode === 'topo') {
            return a.degrees < 1.0;
        } else {
            return a.longitude_diff < 1.0;
        }
    });
}

function renderMoonPhases(phases) {
    const container = document.getElementById('moon-grid');
    container.innerHTML = '';

    // Get currently relevant alignments to highlighting
    const activeAlignments = getFilteredAlignments(currentMode);

    // Convert phases to objects with Date objects for comparison
    const phaseObjs = phases.map(p => ({
        ...p,
        dateObj: parseLocalIdDate(p.date)
    }));

    phaseObjs.forEach((phase, index) => {
        const nextPhase = phaseObjs[index + 1];

        // Define Phase Window: [Start Date, End Date)
        // End Date is the start of the next phase, or far future if last phase
        const startDate = phase.dateObj;
        const endDate = nextPhase ? nextPhase.dateObj : new Date(startDate.getFullYear() + 1, 0, 1);

        // Find alignments in this window
        const matches = activeAlignments.filter(a => {
            const alignDate = parseLocalIdDate(a.date);
            return alignDate >= startDate && alignDate < endDate;
        });

        let hasGold = false; // Exact match
        let hasSilver = false; // Range match

        matches.forEach(m => {
            if (m.date === phase.date) {
                hasGold = true;
            } else {
                hasSilver = true;
            }
        });

        let borderClass = '';
        if (hasGold && hasSilver) {
            borderClass = 'double-border';
        } else if (hasGold) {
            borderClass = 'gold-border';
        } else if (hasSilver) {
            borderClass = 'silver-border';
        }

        const formattedDate = phase.dateObj.toLocaleDateString('es-UY', { day: 'numeric', month: 'short' });

        const card = document.createElement('div');
        card.className = `moon-card ${borderClass}`;

        if (matches.length > 0) {
            // Build Tooltip content with visual indicator of type
            const tooltipContent = matches.map(m => {
                let val = currentMode === 'topo' ? `Sep: ${m.degrees}°` : `Dif. Long: ${m.longitude_diff}°`;
                const typeIcon = (m.date === phase.date) ? '🌟' : '🥈';
                return `${typeIcon} ${translatePlanet(m.planet)} (${parseLocalIdDate(m.date).toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })} ${m.time}hs)`;
            }).join('<br>');

            const tooltip = document.createElement('span');
            tooltip.className = 'tooltip-text';
            tooltip.innerHTML = tooltipContent;
            card.appendChild(tooltip);
        }

        let gradientStyle = 'radial-gradient(circle at 50% 50%, #333, #000)';
        if (phase.phase === 'Full Moon') {
            gradientStyle = 'radial-gradient(circle at 30% 30%, #fff, #e0e0e0 60%)';
        } else if (phase.phase === 'New Moon') {
            gradientStyle = 'radial-gradient(circle at 50% 50%, #222, #000)';
        } else if (phase.phase === 'First Quarter') {
            gradientStyle = 'linear-gradient(90deg, #000 50%, #fff 50%)';
        } else if (phase.phase === 'Last Quarter') {
            gradientStyle = 'linear-gradient(90deg, #fff 50%, #000 50%)';
        }

        const innerHTML = `
            <div class="moon-icon" style="background: ${gradientStyle}"></div>
            <div class="phase-name">${translatePhase(phase.phase)}</div>
            <div class="phase-date">${formattedDate}</div>
            <div class="phase-time">${phase.time}</div>
        `;

        card.insertAdjacentHTML('beforeend', innerHTML);
        container.appendChild(card);
    });
}

function renderAlignments(alignments, mode) {
    const container = document.getElementById('alignment-timeline');
    container.innerHTML = '';

    // Filter logic matches Highlight logic
    const filtered = alignments.filter(a => {
        if (mode === 'topo') {
            return a.degrees < 1.0;
        } else {
            return a.longitude_diff < 1.0;
        }
    });

    if (!filtered || filtered.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#777;">No hay alineaciones visibles con < 1° de diferencia.</p>';
        return;
    }

    filtered.forEach((alignment, index) => {
        const div = document.createElement('div');
        div.className = `alignment-card ${index % 2 === 0 ? 'left' : 'right'}`;

        const date = parseLocalIdDate(alignment.date);
        const formattedDate = date.toLocaleDateString('es-UY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        let valueText = '';
        if (mode === 'topo') {
            valueText = `Separación: ${alignment.degrees}°`;
        } else {
            const val = alignment.longitude_diff < 0.01 ? 0 : alignment.longitude_diff;
            valueText = `Dif. Longitud: ${val}°`;
        }

        div.innerHTML = `
            <div class="content">
                <div class="planet-name">Luna y ${translatePlanet(alignment.planet)}</div>
                <span class="alignment-time">${formattedDate} a las ${alignment.time}</span>
                <p>${valueText}</p>
            </div>
        `;
        container.appendChild(div);
    });
}

function translatePhase(phase) {
    const map = {
        'New Moon': 'Luna Nueva',
        'First Quarter': 'Cuarto Creciente',
        'Full Moon': 'Luna Llena',
        'Last Quarter': 'Cuarto Menguante'
    };
    return map[phase] || phase;
}

function translatePlanet(planet) {
    const map = {
        'Mercury': 'Mercurio',
        'Venus': 'Venus',
        'Mars': 'Marte',
        'Jupiter': 'Júpiter',
        'Saturn': 'Saturno'
    };
    return map[planet] || planet;
}
