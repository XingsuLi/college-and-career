/* Shared visual meanings. Category colors stay fixed when filters change. */
"use strict";
const COLORS = {
  ink: "#18332e",
  muted: "#5c6b63",
  secondary: "#627168",
  selected: "#b5701a",
  selectedFill: "#fbefdc",
  reference: "#56625c",
  missing: "#eef0ec",
  hatch: "#8f9c95",
  unpublished: "#aab4ae",
  public: "#2e876b",
  nonprofit: "#587fa9",
  profit: "#c48d43",
  map: ["#eef3e8", "#c3dbc6", "#8dbca3", "#4f9479", "#1f6650"],
  destinations: ["#f1edf6", "#d4c9e5", "#ab98cc", "#8066ad", "#593f86"],
  share: ["#eef2f5", "#cfdbe5", "#a7bed1", "#7a9cb8", "#4f7597"],
  income: ["#e8f2cf", "#bfe0b5", "#7cc2a9", "#3f97a6", "#255f86"],
};
const sequentialColor = (stops) => d3.piecewise(d3.interpolateLab, stops);

// Sample the very same scale used for the marks, including its interpolation.
function setColorLegend(selector, scale) {
  const [lo, hi] = scale.domain();
  const stops = d3.range(17).map((i) => `${scale(lo + (hi - lo) * i / 16)} ${i / 16 * 100}%`);
  d3.select(selector).style("background", `linear-gradient(90deg, ${stops.join(",")})`);
}
function luminance(fill) {
  const c = d3.rgb(fill);
  const linear = (v) => (v /= 255) <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
  return .2126 * linear(c.r) + .7152 * linear(c.g) + .0722 * linear(c.b);
}
function readableColor(fill) {
  const light = luminance(fill), dark = luminance(COLORS.ink);
  const whiteContrast = 1.05 / (light + .05);
  const inkContrast = (light + .05) / (dark + .05);
  if (whiteContrast >= 4.5) return "#ffffff";
  return inkContrast >= 4.5 ? COLORS.ink : "#000000";
}
// Keep numerical lightness intact when a map region is outside the selection.
function desaturateColor(fill) {
  const c = d3.lab(fill);
  return d3.lab(c.l, 0, 0).formatHex();
}

// NAICS identities, not ranks: an industry never changes color on filtering.
const INDUSTRY_COLORS = {
  "11": "#537346", "21": "#805858", "22": "#526e8c", "23": "#a84d3b",
  "31-33": "#5b54a0", "42": "#965b83", "44-45": "#c0653a", "48-49": "#317788",
  "51": "#285c58", "52": "#a5548b", "53": "#94624d", "54": "#3d6fa8",
  "55": "#645b8c", "56": "#7a6446", "61": "#6b5fa8", "62": "#2e8b72",
  "71": "#ab546a", "72": "#756a43", "81": "#536e68", "92": "#626b77",
};
