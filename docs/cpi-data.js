window.CPI_DATA = {
  "series": "CUUR0000SA0",
  "label": "CPI-U, all items, U.S. city average",
  "frequency": "Annual average, not seasonally adjusted",
  "indexBase": "1982–84 = 100",
  "dollarBase": 2024,
  "annual": {
    "2015": 237.017,
    "2016": 240.007,
    "2017": 245.12,
    "2018": 251.107,
    "2019": 255.657,
    "2020": 258.811,
    "2021": 270.97,
    "2022": 292.655,
    "2023": 304.702,
    "2024": 313.689,
    "2025": 321.943
  },
  "source": "https://www.bls.gov/regions/mid-atlantic/data/consumerpriceindexannualandsemiannual_table.htm",
  "retrieved": "2026-10-30",
  "note": "The published 2025 average uses 11 months; October was not collected. No missing month is imputed here.",
  "missingMonthSource": "https://www.bls.gov/cpi/additional-resources/2025-federal-government-shutdown-impact-cpi.htm",
  "formulas": {
    "constantDollars": "nominalPay[t] * CPI[2024] / CPI[t]",
    "realGrowth": "100 * ((pay[t] / pay[base]) / (CPI[t] / CPI[base]) - 1)",
    "realYoY": "100 * ((pay[t] / pay[t-1]) / (CPI[t] / CPI[t-1]) - 1)"
  }
};
