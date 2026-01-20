from skyfield.api import load, Topos
import pytz
from datetime import datetime

def check_geocentric():
    eph = load('de421.bsp')
    moon = eph['moon']
    jupiter = eph['jupiter_barycenter']
    earth = eph['earth']
    
    ts = load.timescale()
    uruguay_tz = pytz.timezone('America/Montevideo')
    
    # User Time: Jan 31, 00:18
    local_time = uruguay_tz.localize(datetime(2026, 1, 31, 0, 18, 0))
    t = ts.from_datetime(local_time)
    
    # 1. Topocentric (Montevideo)
    topos_loc = Topos('34.9011 S', '56.1645 W')
    montevideo = earth + topos_loc
    
    _, lon_m_topo, _ = montevideo.at(t).observe(moon).apparent().ecliptic_latlon()
    _, lon_j_topo, _ = montevideo.at(t).observe(jupiter).apparent().ecliptic_latlon()
    diff_topo = (lon_m_topo.degrees - lon_j_topo.degrees)
    
    # 2. Geocentric (Earth Center)
    _, lon_m_geo, _ = earth.at(t).observe(moon).apparent().ecliptic_latlon()
    _, lon_j_geo, _ = earth.at(t).observe(jupiter).apparent().ecliptic_latlon()
    diff_geo = (lon_m_geo.degrees - lon_j_geo.degrees)

    print(f"Time: {local_time}")
    print("-" * 30)
    print("TOPOCENTRIC (Montevideo View):")
    print(f"Moon Lon: {lon_m_topo.degrees:.4f}")
    print(f"Jup  Lon: {lon_j_topo.degrees:.4f}")
    print(f"Diff    : {diff_topo:.4f}")
    print("-" * 30)
    print("GEOCENTRIC (Earth Center / Astrological):")
    print(f"Moon Lon: {lon_m_geo.degrees:.4f}")
    print(f"Jup  Lon: {lon_j_geo.degrees:.4f}")
    print(f"Diff    : {diff_geo:.4f}")

if __name__ == "__main__":
    check_geocentric()
