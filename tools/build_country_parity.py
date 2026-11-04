"""Prepare local map geometry and published quarterly market series.

Uses xlrd, openpyxl, pyshp and shapely. See the generated provenance for sources.
"""
import csv
import hashlib
import io
import json
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from zipfile import ZipFile

import openpyxl
import shapefile
import xlrd
from shapely import orient_polygons
from shapely.geometry import MultiPolygon, mapping, shape

raw = Path(sys.argv[1])
repo = Path(__file__).resolve().parents[1]
UK_MAP = "https://www.arcgis.com/home/item.html?id=d97f44ea14554f949e764b08cb4ab0b0"
AU_MAP = "https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-4-july-2026-june-2031/access-and-downloads/digital-boundary-files"
UK_PAY = "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/averageweeklyearningsbyindustryearn03"
UK_CPI = "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7bt/mm23"
AU_PAY = "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/wage-price-index-australia/jun-2026"
AU_CPI = "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/jun-2026"

def feature(geometry, key, name, minimum_area):
    geometry = geometry.buffer(0).simplify(0.025, preserve_topology=True)
    def polygons(part):
        if part.geom_type == "Polygon":
            yield part
        elif hasattr(part, "geoms"):
            for member in part.geoms:
                yield from polygons(member)
    parts = [part for part in polygons(geometry) if part.area >= minimum_area]
    assert parts, key
    simple = orient_polygons(MultiPolygon(parts), exterior_cw=True)
    return {"type": "Feature", "properties": {"key": key, "name": name}, "geometry": mapping(simple)}

uk_shapes = []
for row in json.loads((raw / "GB.geojson").read_text())["features"]:
    name = row["properties"]["ITL125NM"].replace(" (England)", "").replace("and The", "and the")
    if name == "East":
        name = "East of England"
    uk_shapes.append(feature(shape(row["geometry"]), name, name, 0.001))
assert len(uk_shapes) == 12

au_shapes = []
au_keys = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]
with ZipFile(raw / "au-shape.zip") as z:
    prefix = "STE_2026_AUST_GDA2020"
    reader = shapefile.Reader(shp=io.BytesIO(z.read(prefix + ".shp")), dbf=io.BytesIO(z.read(prefix + ".dbf")))
    for row in reader.iterShapeRecords():
        code, name = row.record[:2]
        if code in "12345678":
            au_shapes.append(feature(shape(row.shape.__geo_interface__), au_keys[int(code)-1], name, 0.008))
assert len(au_shapes) == 8

def quarter(date):
    return date.year * 4 + (date.month - 1) // 3

def qdate(q):
    return f"{q//4:04d}-{3*(q%4)+1:02d}-01"

def aggregate_quarters(months):
    groups = defaultdict(list)
    for day, value in months:
        groups[quarter(day)].append(value)
    return {q: sum(values)/3 for q, values in groups.items() if len(values) == 3}

def yoy(index):
    return {q: round(100 * (value / index[q-4] - 1), 2) for q, value in index.items()
            if q >= 2023*4 and index.get(q-4, 0) > 0}

# Direct SIC section matches only. The ONS table's subdivisions of manufacturing
# and wholesale/retail remain separate rather than being joined to a broader LEO group.
uk_codes = {
  "A": ("Agriculture", "Agriculture, forestry and fishing"),
  "B": ("Mining", "Mining and quarrying"),
  "F": ("Construction", "Construction"),
  "H": ("Transport", "Transportation and storage"),
  "I": ("Hospitality", "Accommodation and food service activities"),
  "J": ("Information", "Information and communication"),
  "K": ("Finance", "Financial and insurance activities"),
  "L": ("Real estate", "Real estate activities"),
  "M": ("Prof. services", "Professional, scientific and technical activities"),
  "N": ("Admin. services", "Administrative and support service activities"),
  "O": ("Public admin.", "Public administration and defence - compulsory social security"),
  "P": ("Education", "Education"),
  "Q": ("Health care", "Human health and social work activities"),
  "R": ("Arts", "Arts, entertainment and recreation"),
  "S": ("Other services", "Other service activities"),
}
sheet = xlrd.open_workbook(raw / "earn-plain.xls").sheet_by_name("1. NSA ind monthly figs")
def monthly_date(value):
    match = re.match(r"^(\d{4})\s+([A-Za-z]{3})", str(value))
    return datetime.strptime(" ".join(match.groups()).title(), "%Y %b") if match else None

uk_pay = {}
for c in range(1, sheet.ncols):
    key = str(sheet.cell_value(6, c)).strip(" ()")
    if key not in uk_codes:
        continue
    months = []
    for r in range(8, sheet.nrows):
        day, value = monthly_date(sheet.cell_value(r,0)), sheet.cell_value(r,c)
        if day and isinstance(value,(int,float)):
            months.append((day,value))
    uk_pay[key] = yoy(aggregate_quarters(months))
assert set(uk_pay) == set(uk_codes)
with (raw / "gb-cpi-index.csv").open() as f:
    uk_cpi = yoy(aggregate_quarters([(day, float(v)) for label,v in csv.reader(f) if (day := monthly_date(label))]))

def xlsx_rows(name):
    return list(openpyxl.load_workbook(raw / name, read_only=True, data_only=True)["Data1"].values)

au_wpi = xlsx_rows("au-wpi.xlsx")
au_labels = {"Health care and social assistance": "Health care",
             "Professional, scientific and technical services": "Prof. services",
             "Education and training": "Education", "Retail trade": "Retail",
             "Financial and insurance services": "Finance", "Construction": "Construction",
             "Manufacturing": "Manufacturing", "Information media and telecommunications": "Information"}
au_pay = {}
for c, header in enumerate(au_wpi[0]):
    if not header or not header.startswith("Quarterly Index"):
        continue
    _, _, _, sector, field = [x.strip() for x in header.strip(" ;").split(";")]
    if sector == "Private and Public" and field in au_labels:
        au_pay[field] = yoy({quarter(r[0]):r[c] for r in au_wpi[10:] if isinstance(r[0],datetime) and isinstance(r[c],(float,int))})
assert set(au_pay) == set(au_labels)
au_cpi_rows = xlsx_rows("au-cpi-q.xlsx")
cpi_col = next(i for i,h in enumerate(au_cpi_rows[0]) if h and h.startswith("Index Numbers") and "Australia" in h)
au_cpi = yoy({quarter(r[0]):r[cpi_col] for r in au_cpi_rows[10:] if isinstance(r[0],datetime) and isinstance(r[cpi_col],(int,float))})

def market(series, labels, cpi, basis, default):
    end = min(max(cpi), *(max(values) for values in series.values()))
    data = {key: {"label": labels[key][0], "industry": labels[key][1],
                  "points": [[qdate(q),v] for q,v in sorted(values.items()) if q <= end]}
            for key,values in series.items()}
    assert all(len(row["points"]) >= 12 for row in data.values())
    return {"series": data, "cpi": [[qdate(q),v] for q,v in sorted(cpi.items()) if q<=end],
            "basis": basis, "default": default, "last": f"{end//4} Q{end%4+1}"}

au_default = list(au_labels)[:5]
parity = {
 "GB": {"geometry":{"type":"FeatureCollection","features":uk_shapes},
        "pay":market(uk_pay,uk_codes,uk_cpi,"ONS weekly earnings",["Q","M","P","K","J"]),
        "sources":[["ONS / OS · ITL1 boundaries (OGL)",UK_MAP],["ONS · Average weekly earnings by industry",UK_PAY],["ONS · CPI, all items",UK_CPI]]},
 "AU": {"geometry":{"type":"FeatureCollection","features":au_shapes},
        "pay":market(au_pay,{k:(v,k) for k,v in au_labels.items()},au_cpi,"ABS Wage Price Index",au_default),
        "sources":[["ABS · State and territory boundaries",AU_MAP],["ABS · Wage Price Index, industry",AU_PAY],["ABS · Quarterly CPI, all groups",AU_CPI]]},
}
# Keep geometry small, with about 110 m coordinate precision at the equator.
def round_numbers(v):
    if isinstance(v,float):
        return round(v,3)
    if isinstance(v,(tuple,list)):
        return [round_numbers(x) for x in v]
    if isinstance(v,dict):
        return {k:round_numbers(x) for k,x in v.items()}
    return v

(repo/"docs/country-parity-data.js").write_text("/* Prepared official map boundaries, wage growth and CPI. */\nwindow.COUNTRY_PARITY = "
    +json.dumps(round_numbers(parity),ensure_ascii=False,separators=(",",":"))+";\n")
names = ("GB.geojson","au-shape.zip","earn-plain.xls","gb-cpi-index.csv","au-wpi.xlsx","au-cpi-q.xlsx")
report = {k:{"regions":len(v["geometry"]["features"]),"pay_series":len(v["pay"]["series"]),
             "end":v["pay"]["last"],"sources":v["sources"]} for k,v in parity.items()}
report["inputs"] = {name:hashlib.sha256((raw/name).read_bytes()).hexdigest() for name in names}
(repo/"provenance/country-map-market.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print(json.dumps(report,ensure_ascii=False,indent=2))
