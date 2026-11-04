window.SOURCE_META = {
  "buildDate": "2026-10-30",
  "awardYear": "2024\u201325",
  "awardRelease": "C2025_A provisional",
  "defaultSnapshot": "2019:1",
  "pseoRelease": "2026Q2 / V4.14.1",
  "pseoDollarYear": 2023,
  "payDollarYear": 2024,
  "annualStart": 2023,
  "annualEnd": 2025,
  "quarterLatest": "2026-Q1",
  "mapPeriods": {
    "net_price": "Annual cost after aid · 2024–2025",
    "earnings_10yr": "Earnings 2022/23 \u00b7 2024 USD",
    "completion_rate": "Fall 2019 entrants \u00b7 150% time",
    "federal_debt": "Debt FY2024\u201325"
  },
  "sources": [
    {
      "source": "IPEDS",
      "file": "C2025_A.zip",
      "url": "https://nces.ed.gov/ipeds/complete-data-files/C2025_A.zip",
      "release": "2025\u201326 Fall provisional",
      "reference_period": "2024\u201325 awards",
      "sha256": "555c6522ccf011d54b06520b128badb8558aba3d0038c97f231f5efaa7161183"
    },
    {
      "source": "QCEW quarterly",
      "file": "qcew-2026-q1-us.csv",
      "url": "https://data.bls.gov/cew/data/api/2026/1/area/US000.csv",
      "release": "2026 Q1 preliminary",
      "reference_period": "2020 Q1\u20132026 Q1",
      "sha256": "01fcd2cdd86f66d70b569286c5a88bc8558b05dc66bdb7470963e59ac173c3a8"
    },
    {
      "source": "CPI-U",
      "file": "cpi-monthly-2020-2026.json",
      "url": "https://api.bls.gov/publicAPI/v2/timeseries/data/CUUR0000SA0?startyear=2020&endyear=2026",
      "reference_period": "2020\u20132026 monthly; quarter means require 3 months",
      "dollar_year": 2024,
      "sha256": "81b57df5f557121fc5c25192458eae4388ddb58f4f98420b1ba9f71cf65b6ce2"
    },
    {
      "source": "PSEO",
      "url": "https://lehd.ces.census.gov/data/pseo_documentation.html",
      "release": "2026Q2",
      "reference_period": "Three-year graduation cohorts through 2019\u201321",
      "dollar_year": 2023
    },
    {
      "source": "College Scorecard",
      "url": "https://collegescorecard.ed.gov/data/",
      "release": "2026-10-15",
      "reference_period": "Metric-specific; unchanged current release"
    },
    {
      "source": "Indeed Hiring Lab",
      "release": "Public snapshot retrieved 2026-10-30",
      "reference_period": "Observed Fridays, 2023-01-06 through 2026-10-23",
      "url": "https://github.com/hiring-lab/job_postings_tracker",
      "license": "CC BY 4.0",
      "source_hashes": "data-audit/hiring-downloads.json"
    },
    {
      "source": "CPI-U quarterly reference update",
      "series": "CUUR0000SA0",
      "file": "cpi-monthly-2022-2026.json",
      "url": "https://api.bls.gov/publicAPI/v2/timeseries/data/CUUR0000SA0?startyear=2022&endyear=2026",
      "reference_period": "2022-01 through 2026-09; complete three-month quarter averages",
      "retrieved": "2026-10-30",
      "sha256": "e13ca9e871424b09b609fd7e9b47eee488ed8504b5ad070272a8ee9f107f4c2d",
      "quarter_latest": "2026-Q3",
      "missing": "2025 Q4 remains null; visual line connects adjacent observed quarters without a missing-quarter node"
    },
    {
      "source": "BLS OEWS national industry wage medians",
      "url": "https://www.bls.gov/oes/2025/may/oessrci.htm",
      "api": "https://api.bls.gov/publicAPI/v2/timeseries/data/",
      "reference_period": "May 2025",
      "population": "U.S. private sector, all occupations in each published sector",
      "measure": "Published annual wage median (datatype 13)",
      "all_private_industries_series": "OEUN000000000000100000013",
      "series_by_naics": {
        "11": "OEUN000000011--1200000013",
        "21": "OEUN000000021--2200000013",
        "22": "OEUN000000022--2300000013",
        "23": "OEUN000000023--2400000013",
        "31-33": "OEUN000000031--3400000013",
        "42": "OEUN000000042--4300000013",
        "44-45": "OEUN000000044--4600000013",
        "48-49": "OEUN000000048--5000000013",
        "51": "OEUN000000051--5200000013",
        "52": "OEUN000000052--5300000013",
        "53": "OEUN000000053--5400000013",
        "54": "OEUN000000054--5500000013",
        "55": "OEUN000000055--5600000013",
        "56": "OEUN000000056--5700000013",
        "61": "OEUN000000061--6200000013",
        "62": "OEUN000000062--6300000013",
        "71": "OEUN000000071--7200000013",
        "72": "OEUN000000072--7300000013",
        "81": "OEUN000000081--8200000013"
      },
      "response_sha256": "ccaaa19533d033db699e6cee1d03953d6d7c90825e12cf5be12e951616063fca"
    },
    {
      "source": "Census ACS 2025 national field earnings",
      "table": "B15013",
      "url": "https://www2.census.gov/programs-surveys/acs/summary_file/2025/table-based-SF/data/1YRData/acsdt1y2025-b15013.dat",
      "reference_period": "2025 ACS 1-year",
      "population": "U.S. adults age 25\u201364 with earnings and a bachelor\u2019s degree or higher",
      "geography": "0100000US",
      "all_fields_variable": "B15013_001E",
      "sha256": "a3b138109bd430fee060d045898d439755a1e6bfd205634eb71db2a90e675a7e"
    }
  ],
  "rawAnnualStart": 2015,
  "displayWindow": "2023 Q1\u20132026 Q1",
  "hiringLatest": "2026-10-23",
  "cpiQuarterLatest": "2026-Q3",
  "cpiMonthlyLatest": "2026-09"
};
