"""Pack published aggregates for the offline country views.

Input names correspond to the downloads in provenance/international-sources.json.
Run: python3 tools/build_countries.py /path/to/downloads
"""
import csv
import hashlib
import io
import json
import sys
import zipfile
from collections import defaultdict
from datetime import date
from pathlib import Path

raw = Path(sys.argv[1])
repo = Path(__file__).resolve().parents[1]
country = {}
manifest = {}
indeed = "https://github.com/hiring-lab/job_postings_tracker"
indeed_base = "https://raw.githubusercontent.com/hiring-lab/job_postings_tracker/master/"


def number(value):
    try:
        n = float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None
    return (int(n) if n.is_integer() else n) if n >= 0 else None


def read_json(name):
    return json.loads((raw / name).read_text())


def add(code, name, currency, basis, measure, count, release, default, sources, mode):
    view = dict(name=name, currency=currency, basis=basis, measure=measure, count=count,
                release=release, default=default, sources=sources, mode=mode,
                schools={}, fields={}, periods=[], rows={})
    country[code] = view
    return view


def evidence(code, files):
    manifest[code] = {
        "sources": country[code]["sources"],
        "source_files": {name: hashlib.sha256((raw / name).read_bytes()).hexdigest() for name in files},
        "institutions": len(country[code]["schools"]),
        "fields": len(country[code]["fields"]),
        "rows_by_period": {key: len(rows) for key, rows in country[code]["rows"].items()},
    }


def hiring(code, view):
    national = f"aggregate_job_postings_{code}.csv"
    regional = f"regional_{code.lower()}.csv"
    tracks = defaultdict(list)
    with (raw / national).open() as stream:
        for row in csv.DictReader(stream):
            day = row["date"]
            if row["variable"] == "total postings" and day >= "2023-01-01" and date.fromisoformat(day).weekday() == 4:
                tracks["National"].append([day, float(row["indeed_job_postings_index_SA"])])
    with (raw / regional).open() as stream:
        for row in csv.DictReader(stream):
            day = row["date"]
            if day >= "2023-01-01" and date.fromisoformat(day).weekday() == 4:
                label = row["region"].upper() if code == "AU" else row["region"].replace(" & ", " and ")
                tracks[label].append([day, float(row["indeed_job_postings_index"])])
    assert tracks["National"]
    view["hiring"] = dict(tracks)
    view["sources"].append(["Indeed Hiring Lab · job postings (CC BY 4.0)", indeed])
    return [national, regional]


uk_release = "https://explore-education-statistics.service.gov.uk/find-statistics/graduate-labour-market-outcomes-leo/2023-24/explore"
uk_industry = "https://explore-education-statistics.service.gov.uk/data-catalogue/data-set/a50ce128-d576-4f90-8cd2-b990d4d21a75"
gb = add("GB", "United Kingdom", "£", "annual earnings", "Sustained employment (%)", "Graduate count",
         "DfE LEO · 2023–24 tax year · Great Britain providers", "5",
         [["DfE · LEO provider data", uk_release], ["DfE · subject and industry outcomes", uk_industry]], "industry")
gb["periods"] = [[str(n), f"{n} year{'s' if n != 1 else ''} after graduation"] for n in (1, 3, 5)]
gb["rows"] = {key: [] for key, _ in gb["periods"]}
with zipfile.ZipFile(raw / "uk-leo.zip") as archive, archive.open("provider_data_by_sex.csv") as stream:
    for row in csv.DictReader(io.TextIOWrapper(stream, encoding="cp1252")):
        sid, period, field = row["ukprn"], row["YAG"], row["cah2_code"]
        if row["tax_year"] != "2023/2024" or row["sex"] != "Total" or not sid.isdigit() or period not in gb["rows"]:
            continue
        region = row["provider_region_name"].replace(" & ", " and ").replace("and The", "and the")
        if region == "Total":
            region = row["provider_country_name"]
        sid = sid + ":" + row["provider_region_code"]
        gb["schools"][sid] = [row["provider_name"], region]
        if field == "Total":
            field = ""
        else:
            gb["fields"][field] = row["cah2_subject_name"]
        gb["rows"][period].append([sid, field, *[number(row[key]) for key in
            ("grads", "earnings_LQ", "earnings_median", "earnings_UQ", "sust_emp_with_or_without_fs")]])
gb["industry"] = {key: {} for key in gb["rows"]}
with (raw / "uk-industry.csv").open(encoding="utf-8-sig") as stream:
    for row in csv.DictReader(stream):
        period = row["YAG"].split()[0]
        if (period not in gb["industry"] or row["qualification_level"] != "First degree" or
                row["time_period"] != "202324" or any(row[k] != "Total" for k in
                ("group_number", "region_code_current", "sex", "ethnicity_major", "prior_attainment", "FSM", "current_region"))):
            continue
        if number(row["count"]) and row["section_name"] not in ("Total", "Not known"):
            gb["industry"][period].setdefault(row["subject_name"], []).append(
                [row["section_name"], number(row["count"]), number(row["earnings_median"])])
evidence("GB", ["uk-leo.zip", "uk-industry.csv", *hiring("GB", gb)])

au = add("AU", "Australia", "A$", "annual full-time salary", "Overall employment (%)", "Survey responses",
         "QILT ComparED · domestic undergraduate GOS 2023–25 pooled", "pooled",
         [["QILT · Graduate Outcomes Survey", "https://www.qilt.edu.au/surveys/graduate-outcomes-survey-%28gos%29"],
          ["ComparED · institution and study-area results", "https://www.compared.edu.au/"]], "field-employment")
au["periods"] = [["pooled", "2023–25 pooled survey"]]
au["rows"] = {"pooled": []}


def australian_row(record, field):
    undergraduate = record.get("undergraduate") or {}
    highlights = {r["alias"]: r for r in undergraduate.get("highlights") or []}
    employment_data = highlights.get("employment", {})
    salary_data = highlights.get("median-salary", {})
    count = number(employment_data.get("size")) or None
    median = number(salary_data.get("score")) if (number(salary_data.get("size")) or 0) > 0 else None
    median = median or None
    employment = number(employment_data.get("score")) if count else None
    if count is None and median is None and employment is None:
        return
    sid = record["alias"]
    regions = sorted(set(record["location"] or []))
    region = regions[0] if len(regions) == 1 else "Multi-state / unspecified"
    au["schools"][sid] = [record["title"], region]
    au["rows"]["pooled"].append([sid, field, count, None, median, None, employment])


for row in read_json("au-inst.json"):
    australian_row(row, "")
au_files = ["au-inst.json", "au-areas.json"]
for area in read_json("au-areas.json"):
    field = area["alias"]
    filename = f"au-area-{field}.json"
    au_files.append(filename)
    batch = read_json(filename)
    assert batch["alias"] == field
    au["fields"][field] = area["title"]
    for row in batch["institutions"]:
        australian_row(row, field)
evidence("AU", [*au_files, *hiring("AU", au)])

for code, view in country.items():
    for period, rows in view["rows"].items():
        unique = {}
        for row in rows:
            key = tuple(row[:2])
            if key in unique:
                assert unique[key] == row, (code, period, key)
            unique[key] = row
        view["rows"][period] = list(unique.values())
    manifest[code]["rows_by_period"] = {key: len(rows) for key, rows in view["rows"].items()}
    default = view["rows"][view["default"]]
    manifest[code]["default_scope"] = {
        "campuses": len({r[0] for r in default}),
        "program_cells": sum(bool(r[1]) for r in default),
        "program_medians": sum(bool(r[1]) and r[4] is not None for r in default),
        "institution_medians": sum(not r[1] and r[4] is not None for r in default),
    }

(repo / "docs/country-data.js").write_text("/* Published public aggregates, generated by tools/build_countries.py. */\nwindow.COUNTRY_VIEWS = "
    + json.dumps(country, ensure_ascii=False, separators=(",", ":")) + ";\n")
(repo / "provenance/international-sources.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({code: item["default_scope"] for code, item in manifest.items()}, indent=2))
