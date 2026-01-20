import json
from datetime import datetime, timedelta
import pytz
from skyfield.api import load, Topos
from skyfield.searchlib import find_discrete, find_maxima
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
    
    # Date range: 2026
    t0 = ts.utc(2026, 1, 1)
    t1 = ts.utc(2027, 1, 1)
    
    # Timezone
    uruguay_tz = pytz.timezone('America/Montevideo')

    data = {
        'moon_phases': [],
        'alignments': []
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
    # ALIGNMENTS (Conjunctions)
    # We look for moments when the Moon and a Planet have the same apparent ecliptic longitude
    # We will also check if it's night time (Sun below horizon)
    
    f = almanac.sunrise_sunset(eph, topos_loc)
    
    for planet_name, planet_obj in planets.items():
        # Define a function that returns the longitude difference
        def longitude_diff_deg(t):
            observer = montevideo.at(t)
            _, lon_moon, _ = observer.observe(moon).apparent().ecliptic_latlon()
            _, lon_planet, _ = observer.observe(planet_obj).apparent().ecliptic_latlon()
            # Normalize to -180 to 180
            diff = (lon_moon.degrees - lon_planet.degrees + 180) % 360 - 180
            return diff

        longitude_diff_deg.step_period = 0.1 # Look every ~2.4 hours

        # We want to find where difference is 0. This corresponds to Maxima of -abs(diff).
        def neg_abs_diff(t):
            return -abs(longitude_diff_deg(t))
        neg_abs_diff.step_days = 0.1

        from skyfield.searchlib import find_maxima
        t_roots, y_roots = find_maxima(t0, t1, neg_abs_diff, epsilon=1.0/24/60)
        
        for time_val in t_roots:
            # Check if it is truly a conjunction (diff close to 0)
            diff_val = longitude_diff_deg(time_val)
            if abs(diff_val) > 1.0:
                continue # Skip local extrema that are not conjunctions

            # Check separation at conjunction
            obs = montevideo.at(time_val)
            sep = obs.observe(moon).separation_from(obs.observe(planet_obj)).degrees
            
            # Check if it is night time
            is_sun_up = almanac.sunrise_sunset(eph, topos_loc)
            
            # Check Sun altitude
            sun_obs = montevideo.at(time_val).observe(sun).apparent()
            alt, az, d = sun_obs.altaz()
            
            if alt.degrees < -6: # Astronomical twilight / Night
                dt_utc = time_val.utc_datetime()
                dt_local = dt_utc.astimezone(uruguay_tz)
                
                data['alignments'].append({
                    'date': dt_local.strftime('%Y-%m-%d'),
                    'time': dt_local.strftime('%H:%M'),
                    'planet': planet_name,
                    'degrees': round(sep, 2),
                    'description': f'Moon and {planet_name} aligned (sep: {sep:.1f}°)'
                })

    # Sort data
    data['moon_phases'].sort(key=lambda x: x['date'] + x['time'])
    data['alignments'].sort(key=lambda x: x['date'] + x['time'])

    with open('src/data.json', 'w') as f:
        json.dump(data, f, indent=2)
    print("Data generation complete.")

if __name__ == "__main__":
    generate_astronomical_data()
