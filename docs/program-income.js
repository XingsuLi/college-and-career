/* Shared exact school/CIP income lookup for the program panel. */
"use strict";
const EARNINGS = window.GRADUATE_EARNINGS;
function lookupEarnings(school, code, snapshot) {
  const [cohort,year]=snapshot.split(":");
  const record=EARNINGS.institutions[school]?.[cohort]?.[code]?.[year];
  return {values:record?.[3]===1?record.slice(0,3):[null,null,null], rawStatus:record?.[3]??null,
    status:Array(3).fill(record?.[3]===1?'available':record?.[3]===5?'suppressed':'unavailable')};
}

// ACS 2025, B15013. U.S. ages 25–64 with earnings and a bachelor’s degree or higher.
const NATIONAL_FIELD_EARNINGS = {
  "allFields": 81203,
  "groups": {
    "2": {
      "median": 102383,
      "label": "Computers, Mathematics, and Statistics",
      "variable": "B15013_002E"
    },
    "3": {
      "median": 83302,
      "label": "Biological, Agricultural, and Environmental Sciences",
      "variable": "B15013_003E"
    },
    "4": {
      "median": 91790,
      "label": "Physical and Related Sciences",
      "variable": "B15013_004E"
    },
    "5": {
      "median": 69702,
      "label": "Psychology",
      "variable": "B15013_005E"
    },
    "6": {
      "median": 89238,
      "label": "Social Sciences",
      "variable": "B15013_006E"
    },
    "7": {
      "median": 117170,
      "label": "Engineering",
      "variable": "B15013_007E"
    },
    "8": {
      "median": 71988,
      "label": "Multidisciplinary Studies",
      "variable": "B15013_008E"
    },
    "9": {
      "median": 81773,
      "label": "Science and Engineering Related Fields",
      "variable": "B15013_009E"
    },
    "10": {
      "median": 86987,
      "label": "Business",
      "variable": "B15013_010E"
    },
    "11": {
      "median": 62222,
      "label": "Education",
      "variable": "B15013_011E"
    },
    "12": {
      "median": 71894,
      "label": "Literature and Languages",
      "variable": "B15013_012E"
    },
    "13": {
      "median": 73138,
      "label": "Liberal Arts and History",
      "variable": "B15013_013E"
    },
    "14": {
      "median": 61132,
      "label": "Visual and Performing Arts",
      "variable": "B15013_014E"
    },
    "15": {
      "median": 74460,
      "label": "Communications",
      "variable": "B15013_015E"
    }
  },
  "familyGroup": {
    "01": 3,
    "03": 3,
    "04": 9,
    "09": 15,
    "11": 2,
    "13": 11,
    "14": 7,
    "15": 9,
    "16": 12,
    "23": 12,
    "24": 13,
    "26": 3,
    "27": 2,
    "30": 8,
    "40": 4,
    "42": 5,
    "45": 6,
    "50": 14,
    "51": 9,
    "52": 10,
    "54": 13
  }
};
