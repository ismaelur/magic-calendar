from skyfield.api import load, Topos
import pytz
from datetime import datetime

def check_geo_sep():
    eph = load('de421.bsp')
    moon = eph['moon']
    jupiter = eph['jupiter_barycenter']
    earth = eph['earth']
    
    ts = load.timescale()
    uruguay_tz = pytz.timezone('America/Montevideo')
    
    # User Time: Jan 31, 00:18 roughly
    local_time = uruguay_tz.localize(datetime(2026, 1, 31, 0, 18, 0))
    t = ts.from_datetime(local_time)
    
    # Geocentric Separation
    obs = earth.at(t)
    sep = obs.observe(moon).separation_from(obs.observe(jupiter)).degrees
    
    print(f"Time: {local_time}")
    print(f"Geocentric Separation: {sep:.4f} degrees")

if __name__ == "__main__":
    check_geo_sep()
