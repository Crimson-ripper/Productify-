"""Rough coordinates for machine locations, and distances between them (no external services).

Locations arrive as free text ("Frankfurt, DE", "Mumbai, India", "US"). We resolve a known city
first, else the country's centre, which is precise enough to rank "nearest first".
"""
import math
import re

# ISO country code -> (lat, lon) of a central / main-population point.
COUNTRIES = {
    "IN": (21.0, 78.0), "PK": (30.4, 69.3), "BD": (23.7, 90.4), "LK": (7.9, 80.8), "NP": (28.4, 84.1),
    "AE": (24.4, 54.4), "SA": (24.7, 46.7), "QA": (25.3, 51.2), "OM": (23.6, 58.4), "KW": (29.4, 48.0), "BH": (26.2, 50.6), "IL": (31.5, 34.9), "TR": (39.0, 35.0),
    "SG": (1.35, 103.8), "MY": (3.1, 101.7), "TH": (13.8, 100.5), "VN": (16.0, 107.8), "ID": (-6.2, 106.8),
    "PH": (14.6, 121.0), "HK": (22.3, 114.2), "TW": (23.7, 121.0), "CN": (35.0, 105.0), "KR": (37.5, 127.0),
    "JP": (36.2, 138.3), "AU": (-33.9, 151.2), "NZ": (-41.3, 174.8),
    "GB": (52.5, -1.5), "IE": (53.3, -6.3), "FR": (46.6, 2.4), "DE": (51.0, 10.4), "NL": (52.2, 5.3),
    "BE": (50.6, 4.6), "LU": (49.6, 6.1), "CH": (46.8, 8.2), "AT": (47.6, 14.1), "IT": (42.8, 12.6),
    "ES": (40.4, -3.7), "PT": (39.5, -8.0), "DK": (56.0, 10.0), "NO": (60.5, 8.5), "SE": (60.1, 15.6),
    "FI": (61.9, 25.7), "IS": (64.1, -21.9), "EE": (58.6, 25.0), "LV": (56.9, 24.6), "LT": (55.2, 23.9),
    "PL": (52.1, 19.4), "CZ": (49.8, 15.5), "SK": (48.7, 19.7), "HU": (47.2, 19.5), "RO": (45.9, 24.9),
    "BG": (42.7, 25.5), "GR": (39.1, 21.8), "HR": (45.1, 15.2), "SI": (46.1, 14.8), "RS": (44.0, 20.9),
    "UA": (49.0, 31.4), "MD": (47.0, 28.9), "RU": (55.8, 37.6), "KZ": (48.0, 67.0),
    "US": (39.8, -98.6), "CA": (45.4, -75.7), "MX": (19.4, -99.1), "BR": (-23.5, -46.6), "AR": (-34.6, -58.4),
    "CL": (-33.4, -70.6), "CO": (4.7, -74.1), "PE": (-12.0, -77.0),
    "ZA": (-26.2, 28.0), "NG": (6.5, 3.4), "KE": (-1.3, 36.8), "EG": (30.0, 31.2), "MA": (33.6, -7.6),
}

COUNTRY_NAMES = {
    "india": "IN", "pakistan": "PK", "bangladesh": "BD", "united arab emirates": "AE", "uae": "AE",
    "singapore": "SG", "japan": "JP", "south korea": "KR", "korea": "KR", "australia": "AU",
    "united kingdom": "GB", "uk": "GB", "england": "GB", "germany": "DE", "france": "FR",
    "netherlands": "NL", "spain": "ES", "italy": "IT", "poland": "PL", "sweden": "SE", "norway": "NO",
    "finland": "FI", "czechia": "CZ", "czech republic": "CZ", "romania": "RO", "ukraine": "UA",
    "united states": "US", "usa": "US", "canada": "CA", "brazil": "BR", "mexico": "MX",
    "south africa": "ZA", "taiwan": "TW", "hong kong": "HK", "china": "CN", "thailand": "TH",
    "vietnam": "VN", "indonesia": "ID", "malaysia": "MY", "philippines": "PH", "turkey": "TR",
}

# Cities that host many machines, so ranking inside big countries (US, IN) is still sensible.
CITIES = {
    "mumbai": (19.08, 72.88), "delhi": (28.61, 77.21), "new delhi": (28.61, 77.21), "bangalore": (12.97, 77.59),
    "bengaluru": (12.97, 77.59), "chennai": (13.08, 80.27), "hyderabad": (17.39, 78.49), "pune": (18.52, 73.86),
    "kolkata": (22.57, 88.36), "noida": (28.54, 77.39), "gurgaon": (28.46, 77.03), "jaipur": (26.91, 75.79),
    "frankfurt": (50.11, 8.68), "falkenstein": (50.48, 12.37), "nuremberg": (49.45, 11.08), "berlin": (52.52, 13.40),
    "amsterdam": (52.37, 4.90), "london": (51.51, -0.13), "paris": (48.86, 2.35), "helsinki": (60.17, 24.94),
    "stockholm": (59.33, 18.07), "warsaw": (52.23, 21.01), "madrid": (40.42, -3.70), "milan": (45.46, 9.19),
    "dubai": (25.20, 55.27), "singapore": (1.35, 103.82), "tokyo": (35.68, 139.69), "seoul": (37.57, 126.98),
    "sydney": (-33.87, 151.21), "hong kong": (22.32, 114.17),
    "new york": (40.71, -74.01), "new jersey": (40.06, -74.41), "virginia": (37.43, -78.66),
    "ashburn": (39.04, -77.49), "chicago": (41.88, -87.63), "dallas": (32.78, -96.80), "texas": (31.0, -99.0),
    "atlanta": (33.75, -84.39), "miami": (25.76, -80.19), "denver": (39.74, -104.99), "utah": (39.32, -111.09),
    "los angeles": (34.05, -118.24), "california": (36.78, -119.42), "san jose": (37.34, -121.89),
    "seattle": (47.61, -122.33), "oregon": (43.80, -120.55), "toronto": (43.65, -79.38), "montreal": (45.50, -73.57),
    "sao paulo": (-23.55, -46.63),
}


def country_code(text: str) -> str:
    """Best-effort ISO code from "City, CC", "City, Country" or a bare code/name."""
    t = (text or "").strip()
    if not t:
        return ""
    last = re.split(r"[,/]", t)[-1].strip()
    if len(last) == 2 and last.upper() in COUNTRIES:
        return last.upper()
    return COUNTRY_NAMES.get(last.lower(), "")


def locate(text: str):
    """(lat, lon) for a free-text location, or None when it can't be placed."""
    t = (text or "").strip().lower()
    if not t:
        return None
    for part in re.split(r"[,/]", t):
        if part.strip() in CITIES:
            return CITIES[part.strip()]
    cc = country_code(text)
    return COUNTRIES.get(cc)


def km_between(a, b) -> float:
    """Great-circle distance in km."""
    (lat1, lon1), (lat2, lon2) = a, b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(h))
