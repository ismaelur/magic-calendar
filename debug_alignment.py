from skyfield.api import load, Topos
import pytz
from datetime import datetime

def check_alignment():
    eph = load('de421.bsp')
    moon = eph['moon']
    jupiter = eph['jupiter_barycenter']
    sun = eph['sun']
    earth = eph['earth']
    
    topos_loc = Topos('34.9011 S', '56.1645 W')
    montevideo = earth + topos_loc
    ts = load.timescale()
    
    uruguay_tz = pytz.timezone('America/Montevideo')
    
    # Check around Jan 31, 00:18
    # 00:18 on Jan 31 local time
    local_time = uruguay_tz.localize(datetime(2026, 1, 31, 0, 18, 0))
    t = ts.from_datetime(local_time)
    
    obs = montevideo.at(t)
    sep = obs.observe(moon).separation_from(obs.observe(jupiter)).degrees
    
    sun_obs = montevideo.at(t).observe(sun).apparent()
    alt, az, d = sun_obs.altaz()
    
    print(f"Time (Local): {local_time}")
    print(f"Time (UTC): {t.utc_datetime()}")
    print(f"Moon-Jupiter Separation: {sep:.4f} degrees")
    print(f"Sun Altitude: {alt.degrees:.4f} degrees")
    
    # Check a range of times to find the minimum
    print("\nScanning surrounding hours...")
    for h in range(-5, 6):
        dt = uruguay_tz.localize(datetime(2026, 1, 31, 0, 18, 0))
        dt = dt.replace(hour=(dt.hour + h) % 24)
        if dt.day != 31 and h > 0: dt = dt.replace(day=31) # strict logic not needed for quick debug
        # simple hour shift
        from datetime import timedelta
        check_dt = local_time + timedelta(hours=h)
        t_check = ts.from_datetime(check_check := check_dt)
        
        obs_check = montevideo.at(t_check)
        sep_check = obs_check.observe(moon).separation_from(obs_check.observe(jupiter)).degrees
        
        # Check Longitude difference
        _, lon_m, _ = obs_check.observe(moon).apparent().ecliptic_latlon()
        _, lon_p, _ = obs_check.observe(jupiter).apparent().ecliptic_latlon()
        diff = (lon_m.degrees - lon_p.degrees + 180) % 360 - 180
        
        print(f"{check_check}: Sep={sep_check:.4f} deg, LonDiff={diff:.4f} deg")

if __name__ == "__main__":
    check_alignment()
