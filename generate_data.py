import json
from datetime import datetime, timedelta
import pytz
from skyfield.api import load, Topos
from skyfield.searchlib import find_maxima
from skyfield import almanac

def generate_astronomical_data():
    # Load ephemeris
    eph = load('de421.bsp')
    sun = eph['sun']
    moon = eph['moon']
    earth = eph['earth']
    planets = {
        'Mercury': eph['mercury'],
        'Venus': eph['venus'],
        'Mars': eph['mars'],
        'Jupiter': eph['jupiter_barycenter'],
        'Saturn': eph['saturn_barycenter']
    }

    # Montevideo, Uruguay location
    topos_loc = Topos('34.9011 S', '56.1645 W')
    montevideo = earth + topos_loc
    ts = load.timescale()
    
    uruguay_tz = pytz.timezone('America/Montevideo')

    for year in range(2025, 2031):
        print(f"Generating data for {year}...")
        t0 = ts.utc(year, 1, 1)
        t1 = ts.utc(year + 1, 1, 1)

        data = {
            'moon_phases': [],
            'alignments': {}
        }

        print("Calculating Moon Phases...")
        # MOON PHASES
        t, y = almanac.find_discrete(t0, t1, almanac.moon_phases(eph))
        phase_names = ['New Moon', 'First Quarter', 'Full Moon', 'Last Quarter']
        
        for time, phase_code in zip(t, y):
            dt_utc = time.utc_datetime()
            dt_local = dt_utc.astimezone(uruguay_tz)
            data['moon_phases'].append({
                'date': dt_local.strftime('%Y-%m-%d'),
                'time': dt_local.strftime('%H:%M'),
                'phase': phase_names[phase_code]
            })

        print("Calculating Alignments...")
        alignments_geo = []
        alignments_topo = []

        def find_alignments(observer_context, label, result_list):
            print(f"  - {label}...")
            for planet_name, planet_obj in planets.items():
                
                def longitude_diff_deg(t):
                    if label == 'Geocentric':
                        observer = earth.at(t)
                    else:
                        observer = montevideo.at(t)
                    
                    _, lon_moon, _ = observer.observe(moon).apparent().ecliptic_latlon()
                    _, lon_planet, _ = observer.observe(planet_obj).apparent().ecliptic_latlon()
                    diff = (lon_moon.degrees - lon_planet.degrees + 180) % 360 - 180
                    return diff

                longitude_diff_deg.step_period = 0.1 

                def neg_abs_diff(t):
                    return -abs(longitude_diff_deg(t))
                neg_abs_diff.step_days = 0.1

                # Use skyfield searchlib
                t_roots, y_roots = find_maxima(t0, t1, neg_abs_diff, epsilon=1.0/24/60)
                
                for time_val in t_roots:
                    # Check for true conjunction
                    if abs(longitude_diff_deg(time_val)) > 1.0:
                        continue 

                    # Separation logic depends on context
                    if label == 'Geocentric':
                        obs = earth.at(time_val)
                    else:
                        obs = montevideo.at(time_val)
                    
                    try:
                        sep = obs.observe(moon).separation_from(obs.observe(planet_obj)).degrees
                    except Exception:
                        sep = 999.9

                    # Night-time filter is ALWAYS Topocentric (Montevideo)
                    sun_obs = montevideo.at(time_val).observe(sun).apparent()
                    alt, az, d = sun_obs.altaz()
                    
                    if alt.degrees < -6: # Astronomical twilight / Night
                        dt_utc = time_val.utc_datetime()
                        dt_local = dt_utc.astimezone(uruguay_tz)
                        
                        result_list.append({
                            'date': dt_local.strftime('%Y-%m-%d'),
                            'time': dt_local.strftime('%H:%M'),
                            'planet': planet_name,
                            'degrees': round(sep, 2),
                            'longitude_diff': round(abs(longitude_diff_deg(time_val)), 4),
                            'description': f'Moon and {planet_name} aligned (sep: {sep:.1f}°)'
                        })

        # Run for Geocentric
        find_alignments(earth, 'Geocentric', alignments_geo)
        
        # Run for Topocentric
        find_alignments(montevideo, 'Topocentric', alignments_topo)

        # Sort data
        data['moon_phases'].sort(key=lambda x: x['date'] + x['time'])
        alignments_geo.sort(key=lambda x: x['date'] + x['time'])
        alignments_topo.sort(key=lambda x: x['date'] + x['time'])
        
        data['alignments'] = {
            'geocentric': alignments_geo,
            'topocentric': alignments_topo
        }

        filename = f'src/data_{year}.json'
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"Saved {filename}")

    print("All years generation complete.")

if __name__ == "__main__":
    generate_astronomical_data()
