let globalData = { moon_phases: [], alignments: { geocentric: [], topocentric: [] } };
let currentMode = 'geo';

// Montevideo Observer
const OBSERVER = new Astronomy.Observer(-34.9011, -56.1645, 43); // Lat, Lon, Elevation (m)

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded.");
    if (typeof Astronomy === 'undefined') {
        console.error("CRITICAL: Astronomy library not loaded!");
        alert("Error: Librería de Astronomía no cargada.");
    } else {
        console.log("Astronomy library loaded:", Astronomy);
    }

    // Initial calculation for 2026
    const yearInput = document.getElementById('year-select');
    if (yearInput) {
        calculateAndRender(parseInt(yearInput.value));
    }

    setupControls();
});

function setupControls() {
    console.log("Setting up controls.");
    const toggle = document.getElementById('geo-toggle');
    const yearInput = document.getElementById('year-select');
    const calcBtn = document.getElementById('calc-btn');
    const infoText = document.getElementById('coord-info');

    toggle.addEventListener('change', (e) => {
        const isTopo = e.target.checked;
        currentMode = isTopo ? 'topo' : 'geo';
        infoText.textContent = isTopo ? "Vista desde Montevideo (Visual)" : "Centro de la Tierra (Astrológico)";
        renderAll();
    });

    // Trigger on Button Click
    calcBtn.addEventListener('click', () => {
        let year = parseInt(yearInput.value);
        if (isNaN(year) || year < 1) {
            year = 2026;
            yearInput.value = 2026;
        }
        document.querySelector('h1').textContent = `Calendario Mágico ${year}`;
        calculateAndRender(year);
    });

    // Also trigger on Enter key in input
    yearInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            calcBtn.click();
        }
    });
}

function calculateAndRender(year) {
    console.log(`Starting calculation for year ${year}...`);
    try {
        // Show loading state?
        // Calculate Data
        const phases = calculatePhases(year);
        console.log(`Phases calculated: ${phases.length}`);

        const alignments = calculateAlignments(year);
        console.log(`Alignments calculated: Geo=${alignments.geocentric.length}, Topo=${alignments.topocentric.length}`);

        globalData = {
            moon_phases: phases,
            alignments: alignments
        };

        renderAll();
        console.log("Render complete.");
    } catch (e) {
        console.error("Calculation Error:", e);
        alert(`Error al calcular datos: ${e.message}\nVer consola para más detalles.`);
    }
}

function renderAll() {
    try {
        const subset = currentMode === 'topo' ? globalData.alignments.topocentric : globalData.alignments.geocentric;
        renderAlignments(subset, currentMode);
        renderMoonPhases(globalData.moon_phases);
    } catch (e) {
        console.error("Render Error:", e);
        alert(`Error al renderizar: ${e.message}`);
    }
}

// --- ASTRONOMY CALCULATIONS ---

function calculatePhases(year) {
    try {
        const phases = [];
        const phaseNames = {
            0: 'New Moon',
            1: 'First Quarter',
            2: 'Full Moon',
            3: 'Last Quarter'
        };

        // Start searching from Dec 20 of previous year to catch early Jan phases
        let date = new Date(year - 1, 11, 20);
        // End searh at Jan 10 of next year
        const endDate = new Date(year + 1, 0, 10);

        if (typeof Astronomy === 'undefined') throw new Error("Library 'Astronomy' is missing.");

        let astroTime = Astronomy.MakeTime(date);
        let safetyCount = 0;

        while (safetyCount < 100) { // Limit phases to ~100 (enough for >2 years)
            const mq = Astronomy.SearchMoonQuarter(astroTime);
            if (!mq) break;

            astroTime = mq.time; // Next search starts here
            date = astroTime.date;

            if (date > endDate) break;
            if (date.getFullYear() === year) {
                // Local Time conversion
                // This date is UTC. We need Uruguay time (approx UTC-3)
                // Or simpler: Convert to ISO String and let the render logic handle formatting?
                // Wait, previous logic relied on 'YYYY-MM-DD' strings. Let's produce those.

                // Adjust to Uruguay Time (-3)
                // Since we are client side, we can just use the user's browser timezone IF they are in Uruguay.
                // But the requirements imply Uruguay context. Let's shift explicitly.
                const uruOffset = -3 * 60; // minutes
                const localDate = new Date(date.getTime() + uruOffset * 60000); // Shift manual or use Intl?

                // Actually, best way is to keep date string as local representation
                const yyyy = localDate.getUTCFullYear();
                const mm = String(localDate.getUTCMonth() + 1).padStart(2, '0');
                const dd = String(localDate.getUTCDate()).padStart(2, '0');
                const hh = String(localDate.getUTCHours()).padStart(2, '0');
                const min = String(localDate.getUTCMinutes()).padStart(2, '0');

                phases.push({
                    date: `${yyyy}-${mm}-${dd}`,
                    time: `${hh}:${min}`,
                    phase: phaseNames[mq.quarter]
                });
            }

            // Advance slightly to avoid finding same event
            astroTime = astroTime.AddDays(1);
            safetyCount++;
        }
        return phases;
    } catch (e) {
        throw new Error(`calculatePhases: ${e.message}`);
    }
}

function calculateAlignments(year) {
    const geo = [];
    const topo = [];
    const planets = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    // Step size: 1 hour is decent for rough finding, then refine?
    // Efficient way: Find conjunction in Longitude.
    // Astronomy Engine doesn't have "SearchRelativeLongitude" built-in as friendly as Skyfield.
    // We will iterate day by day? Or 6-hour steps.

    // We can define a function f(t) = difference in longitude.
    // However, finding roots manually in JS loop is cleaner.

    let time = Astronomy.MakeTime(startDate);
    const endTime = Astronomy.MakeTime(endDate);

    // Rough search step: 0.5 days. If diff changes sign, refine.
    // BUT we need specific conjunctions (moon passes planet). 
    // Moon moves ~13 deg/day. Planet moves little. 
    // Step of 0.2 days (~5 hours) is safe.

    while (time.date < endTime.date) {
        const nextTime = time.AddDays(0.25); // 6 hours

        planets.forEach(planet => {
            checkConjunction(planet, time, nextTime, geo, topo);
        });

        time = nextTime;
    }

    return { geocentric: geo, topocentric: topo };
}

function checkConjunction(planet, t1, t2, geoList, topoList) {
    // 1. Check GEOCENTRIC Longitude crossing (0 degrees diff)
    const diff1 = getGeoLonDiff(t1, planet);
    const diff2 = getGeoLonDiff(t2, planet);

    // Check for crossing 0 (or 360->0 wrap)
    // Simplify: normalize diff to [-180, 180]
    // If sign change, root exists.

    if (Math.sign(diff1) !== Math.sign(diff2) && Math.abs(diff1 - diff2) < 180) {
        // Linear Interpolation for exact time
        const fraction = Math.abs(diff1) / Math.abs(diff1 - diff2);
        const calcTime = t1.AddDays(0.25 * fraction);

        processEvent(planet, calcTime, geoList, 'geo');
        processEvent(planet, calcTime, topoList, 'topo');
    }
}

function getGeoLonDiff(time, planet) {
    const moonPos = Astronomy.GeoVector('Moon', time, true); // true for aberration/nutation?
    const planetPos = Astronomy.GeoVector(planet, time, true);

    const moonEcl = Astronomy.Ecliptic(moonPos);
    const planetEcl = Astronomy.Ecliptic(planetPos);

    let diff = moonEcl.elon - planetEcl.elon;
    // Normalize to [-180, 180]
    while (diff <= -180) diff += 360;
    while (diff > 180) diff -= 360;
    return diff;
}

function processEvent(planet, time, list, context) {
    // 1. Calculate precise Separation and Diff at this time
    // For 'topo', we should ideally re-search for MINIMUM SEPARATION, 
    // but the conjunction time is usually close enough for the "Night" check and magnitude.
    // The user wants Topocentric Visual Separation < 1°.

    // Let's stick to the event time found by Geocentric Longitude Conjunction for simplicity first,
    // OR refine for Topo. Topo conjunction happens at different time due to parallax.
    // Detailed search is expensive. Let's calculate metrics at this Geo-time and see.
    // Actually, accurate Topo separation requires Topo coordinates.

    const date = time.date;

    // NIGHT FILTER (Topocentric always)
    // 1. Get Sun's Equator coordinates (RA, Dec)
    const sunEq = Astronomy.Equator('Sun', time, OBSERVER, true, true);
    // 2. Calculate Horizon coordinates from RA, Dec
    const sunPos = Astronomy.Horizon(time, OBSERVER, sunEq.ra, sunEq.dec, 'normal');

    if (sunPos.altitude > -6) return; // Day time / Civil Twilight

    let separation, lonDiff;

    if (context === 'geo') {
        const moonVec = Astronomy.GeoVector('Moon', time, true);
        const planetVec = Astronomy.GeoVector(planet, time, true);
        separation = Astronomy.AngleBetween(moonVec, planetVec);
        lonDiff = Math.abs(getGeoLonDiff(time, planet));
    } else {
        // Topo
        const moonVec = Astronomy.Equator('Moon', time, OBSERVER, true, true);
        const planetVec = Astronomy.Equator(planet, time, OBSERVER, true, true);
        separation = Astronomy.AngleBetween(moonVec, planetVec);

        // Topo Ecliptic Longitude? simpler to use just separation for filtering?
        // User logic: Topo filtered by separation < 1. 
        // Geo filtered by lonDiff < 1.

        // We assume conjunction time is roughly same. 
        // Parallax shits Moon ~1 deg. Time shift ~2 hours max.
        // Good enough for "Calendar" day.
    }

    // Format Data
    const uruOffset = -3 * 60;
    const localDate = new Date(date.getTime() + uruOffset * 60000);

    const yyyy = localDate.getUTCFullYear();
    const mm = String(localDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(localDate.getUTCDate()).padStart(2, '0');
    const hh = String(localDate.getUTCHours()).padStart(2, '0');
    const min = String(localDate.getUTCMinutes()).padStart(2, '0');

    list.push({
        date: `${yyyy}-${mm}-${dd}`,
        time: `${hh}:${min}`,
        planet: planet,
        degrees: parseFloat(separation.toFixed(2)),
        longitude_diff: context === 'geo' ? parseFloat(lonDiff.toFixed(4)) : 0
    });
}

// --- RENDERING (Copied & Adapted) ---

function parseLocalIdDate(dateString) {
    const [y, m, d] = dateString.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function getFilteredAlignments(mode) {
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

    const activeAlignments = getFilteredAlignments(currentMode);

    const phaseObjs = phases.map(p => ({
        ...p,
        dateObj: parseLocalIdDate(p.date)
    }));

    phaseObjs.forEach((phase, index) => {
        const nextPhase = phaseObjs[index + 1];
        const startDate = phase.dateObj;
        const endDate = nextPhase ? nextPhase.dateObj : new Date(startDate.getFullYear() + 1, 0, 1);

        const matches = activeAlignments.filter(a => {
            const alignDate = parseLocalIdDate(a.date);
            // Relaxed check: Since we calculate on the fly, dates match perfectly.
            return alignDate >= startDate && alignDate < endDate;
        });

        let hasGold = false;
        let hasSilver = false;

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

    // Filter logic
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

    // Sort by date/time
    filtered.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

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
