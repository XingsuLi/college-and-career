/* Shared exact school/CIP income lookup for the program panel. */
"use strict";
const EARNINGS = window.GRADUATE_EARNINGS;
function lookupEarnings(school, code, snapshot) {
  const [cohort,year]=snapshot.split(":");
  const record=EARNINGS.institutions[school]?.[cohort]?.[code]?.[year];
  return {values:record?.[3]===1?record.slice(0,3):[null,null,null], rawStatus:record?.[3]??null,
    status:Array(3).fill(record?.[3]===1?'available':record?.[3]===5?'suppressed':'unavailable')};
}
