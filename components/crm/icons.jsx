"use client";
/* ==========================================================================
   Inline SVG icon set (hand-drawn, stroke-based, 24x24 grid).
   Ported verbatim from the prototype's icons.js, now a real ES module.
   ========================================================================== */
import React from "react";

const ICON_PATHS = {
  gauge: React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M4 15a8 8 0 1 1 16 0" }),
    React.createElement("path", { d: "M12 15l4.2-5.4" }),
    React.createElement("circle", { cx: "12", cy: "15", r: "1.2", fill: "currentColor", stroke: "none" })
  ),
  calendar: React.createElement(React.Fragment, null,
    React.createElement("rect", { x: "3.5", y: "5", width: "17", height: "16", rx: "2.5" }),
    React.createElement("path", { d: "M3.5 10h17" }),
    React.createElement("path", { d: "M8 3v4M16 3v4" })
  ),
  receipt: React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M6 3h12v17.5l-2.5-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 20.5z" }),
    React.createElement("path", { d: "M8.5 8h7M8.5 11.5h7M8.5 15h4" })
  ),
  users: React.createElement(React.Fragment, null,
    React.createElement("circle", { cx: "9", cy: "8.5", r: "3" }),
    React.createElement("path", { d: "M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" }),
    React.createElement("path", { d: "M16 4.3c1.5.4 2.5 1.8 2.5 3.4 0 1.6-1 3-2.5 3.4" }),
    React.createElement("path", { d: "M17.5 14.7c2 .6 3.5 2.5 3.5 5.3" })
  ),
  user: React.createElement(React.Fragment, null,
    React.createElement("circle", { cx: "12", cy: "8", r: "3.4" }),
    React.createElement("path", { d: "M5 20.5c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" })
  ),
  bell: React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M6 10.5a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14.5 6 10.5z" }),
    React.createElement("path", { d: "M10 19a2 2 0 0 0 4 0" })
  ),
  car: React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M4 16V12l1.8-4.6A2 2 0 0 1 7.7 6h8.6a2 2 0 0 1 1.9 1.4L20 12v4" }),
    React.createElement("path", { d: "M3.5 16h17v2.5a1 1 0 0 1-1 1H16a1 1 0 0 1-1-1V17H9v1.5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1z" }),
    React.createElement("circle", { cx: "7.5", cy: "16", r: "1.4", fill: "currentColor", stroke: "none" }),
    React.createElement("circle", { cx: "16.5", cy: "16", r: "1.4", fill: "currentColor", stroke: "none" }),
    React.createElement("path", { d: "M4 12h16" })
  ),
  settings: React.createElement(React.Fragment, null,
    React.createElement("circle", { cx: "12", cy: "12", r: "3.2" }),
    React.createElement("path", { d: "M12 3.5v2.4M12 18.1v2.4M20.5 12h-2.4M5.9 12H3.5M17.7 6.3l-1.7 1.7M8 16l-1.7 1.7M17.7 17.7L16 16M8 8 6.3 6.3" })
  ),
  search: React.createElement(React.Fragment, null,
    React.createElement("circle", { cx: "10.5", cy: "10.5", r: "6.5" }),
    React.createElement("path", { d: "M20 20l-4.4-4.4" })
  ),
  plus: React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M12 5v14M5 12h14" })
  ),
  x: React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M6 6l12 12M18 6L6 18" })
  ),
  chevronLeft: React.createElement("path", { d: "M14.5 5l-7 7 7 7" }),
  chevronRight: React.createElement("path", { d: "M9.5 5l7 7-7 7" }),
  chevronDown: React.createElement("path", { d: "M5 8.5l7 7 7-7" }),
  chevronsLeft: React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M17 5l-7 7 7 7" }),
    React.createElement("path", { d: "M10.5 5l-7 7 7 7" })
  ),
  edit: React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M16.5 4.5l3 3L8 19l-4 1 1-4z" })
  ),
  trash: React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M4.5 7h15" }),
    React.createElement("path", { d: "M9 7V4.5h6V7" }),
    React.createElement("path", { d: "M6.5 7l1 13h9l1-13" }),
    React.createElement("path", { d: "M10 11v6M14 11v6" })
  ),
  check: React.createElement("path", { d: "M5 13l4.5 4.5L19.5 7" }),
  checkCircle: React.createElement(React.Fragment, null,
    React.createElement("circle", { cx: "12", cy: "12", r: "9" }),
    React.createElement("path", { d: "M8 12.5l2.5 2.5L16 9.5" })
  ),
  alertTriangle: React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M12 4l9.5 16.5h-19z" }),
    React.createElement("path", { d: "M12 10v4.2" }),
    React.createElement("circle", { cx: "12", cy: "17.2", r: "0.6", fill: "currentColor", stroke: "none" })
  ),
  phone: React.createElement("path", { d: "M6 3.5c1 0 2 2 2 3s-1 1.3-1 2.3S9 12 11.2 14.2s4 3.5 5 3.5 1.3-1 2.3-1 3 1 3 2c0 1.5-1.5 2.8-3 2.8-4 0-14-6-14-15 0-1.5 1.3-3 2.5-3z" }),
  mail: React.createElement(React.Fragment, null,
    React.createElement("rect", { x: "3", y: "5.5", width: "18", height: "13", rx: "2" }),
    React.createElement("path", { d: "M4 7l8 6.5L20 7" })
  ),
  mapPin: React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21z" }),
    React.createElement("circle", { cx: "12", cy: "9.5", r: "2.3" })
  ),
  dollar: React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M12 2.5v19" }),
    React.createElement("path", { d: "M16.5 6.7c0-1.5-1.8-2.7-4-2.7-2.5 0-4.5 1.4-4.5 3.5s2 3 4.5 3.5 4.5 1.6 4.5 3.7-2 3.5-4.5 3.5c-2.2 0-4-1.2-4-2.7" })
  ),
  clock: React.createElement(React.Fragment, null,
    React.createElement("circle", { cx: "12", cy: "12", r: "9" }),
    React.createElement("path", { d: "M12 7v5.3l3.5 2" })
  ),
  wrench: React.createElement("path", { d: "M20 6.5a4.5 4.5 0 0 1-5.9 4.3L7.5 17.4a2 2 0 1 1-2.9-2.9l6.6-6.6A4.5 4.5 0 0 1 17.5 2l-3 3 1.5 1.5 3-3c.6.9 1 2 1 3z" }),
  filter: React.createElement("path", { d: "M4 5h16l-6 7.5V19l-4 2v-8.5z" }),
  download: React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M12 3.5v12M8 12l4 4 4-4" }),
    React.createElement("path", { d: "M4.5 17.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" })
  ),
  moreVert: React.createElement(React.Fragment, null,
    React.createElement("circle", { cx: "12", cy: "6", r: "1.3", fill: "currentColor", stroke: "none" }),
    React.createElement("circle", { cx: "12", cy: "12", r: "1.3", fill: "currentColor", stroke: "none" }),
    React.createElement("circle", { cx: "12", cy: "18", r: "1.3", fill: "currentColor", stroke: "none" })
  ),
  arrowRight: React.createElement("path", { d: "M4.5 12h15M13 6l6 6-6 6" }),
  clipboard: React.createElement(React.Fragment, null,
    React.createElement("rect", { x: "5.5", y: "4.5", width: "13", height: "17", rx: "2" }),
    React.createElement("path", { d: "M9 4.5V3h6v1.5" }),
    React.createElement("path", { d: "M8.5 10.5h7M8.5 14h7M8.5 17.5h4" })
  ),
  wallet: React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M3.5 7.5A2 2 0 0 1 5.5 5.5H18a1.5 1.5 0 0 1 1.5 1.5v2" }),
    React.createElement("path", { d: "M3.5 7.5v10a2 2 0 0 0 2 2H19a1.5 1.5 0 0 0 1.5-1.5V11A1.5 1.5 0 0 0 19 9.5H6.5a2 2 0 0 1 0-4" }),
    React.createElement("circle", { cx: "16.5", cy: "14.5", r: "1.2", fill: "currentColor", stroke: "none" })
  ),
  key: React.createElement(React.Fragment, null,
    React.createElement("circle", { cx: "8", cy: "15", r: "3.5" }),
    React.createElement("path", { d: "M10.5 12.5L18 5M15.5 7.5l2 2M18.5 4.5l2 2" })
  ),
  building: React.createElement(React.Fragment, null,
    React.createElement("rect", { x: "5", y: "3.5", width: "14", height: "17", rx: "1" }),
    React.createElement("path", { d: "M8.5 7.5h1.2M14.3 7.5h1.2M8.5 11h1.2M14.3 11h1.2M8.5 14.5h1.2M14.3 14.5h1.2" }),
    React.createElement("path", { d: "M9.5 20.5V17h5v3.5" })
  ),
  layers: React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M12 3l8.5 4.5L12 12 3.5 7.5z" }),
    React.createElement("path", { d: "M3.5 12L12 16.5 20.5 12" }),
    React.createElement("path", { d: "M3.5 16.5L12 21l8.5-4.5" })
  ),
  history: React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M4 10.5a8 8 0 1 0 2.2-5.5" }),
    React.createElement("path", { d: "M4 3.5v4.5h4.5" }),
    React.createElement("path", { d: "M12 8v5l3.5 2" })
  ),
  drag: React.createElement(React.Fragment, null,
    React.createElement("circle", { cx: "9", cy: "6", r: "1.1", fill: "currentColor", stroke: "none" }),
    React.createElement("circle", { cx: "15", cy: "6", r: "1.1", fill: "currentColor", stroke: "none" }),
    React.createElement("circle", { cx: "9", cy: "12", r: "1.1", fill: "currentColor", stroke: "none" }),
    React.createElement("circle", { cx: "15", cy: "12", r: "1.1", fill: "currentColor", stroke: "none" }),
    React.createElement("circle", { cx: "9", cy: "18", r: "1.1", fill: "currentColor", stroke: "none" }),
    React.createElement("circle", { cx: "15", cy: "18", r: "1.1", fill: "currentColor", stroke: "none" })
  ),
  copy: React.createElement(React.Fragment, null,
    React.createElement("rect", { x: "8.5", y: "8.5", width: "12", height: "12", rx: "2" }),
    React.createElement("path", { d: "M15.5 8.5V5.5a2 2 0 0 0-2-2h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" })
  ),
  gasPump: React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M4 20.5V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v14.5" }),
    React.createElement("path", { d: "M3 20.5h11" }),
    React.createElement("path", { d: "M13 9h1.5L17 11v6a1.3 1.3 0 0 0 2.6 0V9.8a2 2 0 0 0-.6-1.4L17 6.5" })
  ),
  sun: React.createElement(React.Fragment, null,
    React.createElement("circle", { cx: "12", cy: "12", r: "4" }),
    React.createElement("path", { d: "M12 2.5v2.5M12 19v2.5M4.5 12H2M22 12h-2.5M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8" })
  ),
  bolt: React.createElement("path", { d: "M13 2.5 5 13.5h5.5L9.5 21.5l9-12.5H13z" }),
  logout: React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }),
    React.createElement("path", { d: "M16 17l5-5-5-5" }),
    React.createElement("path", { d: "M21 12H9" })
  ),
  lock: React.createElement(React.Fragment, null,
    React.createElement("rect", { x: "5", y: "11", width: "14", height: "10", rx: "2" }),
    React.createElement("path", { d: "M8 11V7a4 4 0 0 1 8 0v4" })
  )
};

export function Icon(props) {
  const name = props.name;
  const rest = Object.assign({}, props);
  delete rest.name;
  const size = rest.size || 20;
  delete rest.size;
  return React.createElement("svg", Object.assign({
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, rest), ICON_PATHS[name] || null);
}
