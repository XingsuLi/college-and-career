/* Shared visual meanings. Category colors stay fixed when filters change. */
"use strict";
const COLORS = {
  ink: "#21192b",
  muted: "#56505f",
  secondary: "#645d70",
  selected: "#a13878",
  selectedFill: "#f9eaf4",
  reference: "#655d70",
  missing: "#eeecf1",
  hatch: "#8b8397",
  unpublished: "#aba3b4",
  public: "#177b84",
  nonprofit: "#3d63ad",
  profit: "#b0732c",
  map: ["#f2ebfa", "#dec9f4", "#bf9ae8", "#9360cc", "#5e2d97"],
  destinations: ["#f1edf6", "#d4c9e5", "#ab98cc", "#8066ad", "#593f86"],
  share: ["#eef2f5", "#cfdbe5", "#a7bed1", "#7a9cb8", "#4f7597"],
  income: ["#f8edf9", "#eacbf0", "#ce97dc", "#a55bbb", "#64277b"],
  programMissing: "#dcd8e2",
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
  "31-33": "#3e6591", "42": "#8f5a34", "44-45": "#b0682d", "48-49": "#317788",
  "51": "#215e70", "52": "#a44439", "53": "#94624d", "54": "#315fa6",
  "55": "#526f7b", "56": "#7a6446", "61": "#4e7739", "62": "#177b84",
  "71": "#a4563c", "72": "#756a43", "81": "#536e68", "92": "#626b77",
};
