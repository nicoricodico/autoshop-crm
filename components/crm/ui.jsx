"use client";
/* ==========================================================================
   Shared UI kit: sidebar, topbar, modal/drawer, kpi tile, pills, toasts,
   confirm dialog, and the reusable line-items editor.
   Ported verbatim from the prototype's ui.js, now a real ES module.

   Change from the prototype: Sidebar no longer has an "isAdmin" prop or an
   Automations nav item at all — the Vendor/Automation Admin area is a
   completely separate route (/vendor-admin) that isn't part of this
   bundle, gated by a real database role rather than a hidden UI toggle.
   ========================================================================== */
import React from "react";
import { Icon } from "./icons";
import { uid, statusLabel, initials, fmtMoney, lineItemTotal, LINE_ITEM_CATEGORIES } from "@/lib/crm/helpers";

export const NAV_ITEMS = [
  { key: "dashboard", label: "Daily Operations", icon: "gauge" },
  { key: "scheduling", label: "Scheduling", icon: "calendar" },
  { key: "invoicing", label: "Invoicing & Line Items", icon: "receipt" },
  { key: "team", label: "Team Management", icon: "users" },
  { key: "customers", label: "Customer Management", icon: "user" },
  { key: "followups", label: "Follow-Ups", icon: "bell" },
  { key: "vehicles", label: "Vehicle History", icon: "car" },
  { key: "settings", label: "Settings", icon: "settings" }
];

/* ---------------- Sidebar ---------------- */

export function Sidebar(props) {
  const { collapsed, onToggle, active, onNavigate, followupsDue, shopName } = props;
  return React.createElement("aside", { className: "sidebar" + (collapsed ? " collapsed" : "") },
    React.createElement("div", { className: "sidebar-brand" },
      React.createElement("div", { className: "sidebar-brand-mark" }, React.createElement(Icon, { name: "wrench", size: 18 })),
      !collapsed && React.createElement("div", { className: "sidebar-brand-text" }, shopName || "Vamp Auto",
        React.createElement("small", null, "Shop Manager"))
    ),
    React.createElement("nav", { className: "sidebar-nav" },
      NAV_ITEMS.map(item => React.createElement("button", {
        key: item.key,
        className: "sidebar-item" + (active === item.key ? " active" : ""),
        onClick: () => onNavigate(item.key),
        title: collapsed ? item.label : undefined
      },
        React.createElement(Icon, { name: item.icon }),
        !collapsed && React.createElement("span", { className: "flex-1" }, item.label),
        !collapsed && item.key === "followups" && followupsDue > 0 && React.createElement("span", { className: "badge-count" }, followupsDue)
      ))
    ),
    React.createElement("div", { className: "sidebar-foot" },
      React.createElement("button", { className: "sidebar-collapse-btn", onClick: onToggle, title: collapsed ? "Expand" : "Collapse" },
        React.createElement(Icon, { name: "chevronsLeft", size: 16 }),
        !collapsed && React.createElement("span", null, "Collapse")
      )
    )
  );
}

/* ---------------- TopBar ---------------- */

export function TopBar(props) {
  const { title, subtitle, children, search, onSearchChange, searchResults, onSelectResult, onMenuToggle } = props;
  const [focused, setFocused] = React.useState(false);
  return React.createElement("header", { className: "topbar" },
    React.createElement("div", { className: "topbar-title-wrap" },
      React.createElement("h1", { className: "topbar-title" }, title),
      subtitle && React.createElement("div", { className: "topbar-sub" }, subtitle)
    ),
    React.createElement("div", { className: "topbar-actions" },
      onSearchChange && React.createElement("div", { style: { position: "relative" } },
        React.createElement("div", { className: "topbar-search" },
          React.createElement(Icon, { name: "search", size: 15 }),
          React.createElement("input", {
            placeholder: "Search customers, vehicles, jobs…",
            value: search || "",
            onChange: e => onSearchChange(e.target.value),
            onFocus: () => setFocused(true),
            onBlur: () => setTimeout(() => setFocused(false), 150)
          })
        ),
        focused && search && searchResults && searchResults.length > 0 && React.createElement("div", {
          className: "card",
          style: { position: "absolute", top: "calc(100% + 6px)", right: 0, width: 320, padding: 8, zIndex: 60, maxHeight: 360, overflowY: "auto", boxShadow: "var(--shadow-md)" }
        },
          searchResults.map((r, i) => React.createElement("div", {
            key: i, className: "list-item clickable", style: { marginBottom: i === searchResults.length - 1 ? 0 : 6 },
            onMouseDown: () => onSelectResult(r)
          },
            React.createElement("div", { className: "vstack" },
              React.createElement("span", { style: { fontWeight: 700, fontSize: 13 } }, r.title),
              React.createElement("span", { className: "faint", style: { fontSize: 11.5 } }, r.sub)
            ),
            React.createElement("span", { className: "tag" }, r.kind)
          ))
        ),
        focused && search && (!searchResults || searchResults.length === 0) && React.createElement("div", {
          className: "card", style: { position: "absolute", top: "calc(100% + 6px)", right: 0, width: 280, padding: 14, zIndex: 60, textAlign: "center" }
        }, React.createElement("span", { className: "faint", style: { fontSize: 12.5 } }, "No matches"))
      ),
      children
    )
  );
}

/* ---------------- Modal / Drawer ---------------- */

export function Modal(props) {
  const { title, subtitle, onClose, children, footer, wide } = props;
  React.useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return React.createElement("div", { className: "overlay", onMouseDown: e => { if (e.target === e.currentTarget) onClose(); } },
    React.createElement("div", { className: "modal" + (wide ? " modal-wide" : "") },
      React.createElement("div", { className: "modal-head" },
        React.createElement("div", null,
          React.createElement("h3", null, title),
          subtitle && React.createElement("p", null, subtitle)
        ),
        React.createElement("button", { className: "close-btn", onClick: onClose }, React.createElement(Icon, { name: "x", size: 15 }))
      ),
      React.createElement("div", { className: "modal-body" }, children),
      footer && React.createElement("div", { className: "modal-foot" }, footer)
    )
  );
}

export function Drawer(props) {
  const { title, subtitle, onClose, children, wide, headerExtra, tabs, activeTab, onTab } = props;
  React.useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return React.createElement("div", { className: "drawer-overlay", onMouseDown: e => { if (e.target === e.currentTarget) onClose(); } },
    React.createElement("div", { className: "drawer" + (wide ? " drawer-wide" : "") },
      React.createElement("div", { className: "drawer-head" },
        React.createElement("div", { className: "drawer-head-top" },
          React.createElement("div", { className: "vstack" },
            React.createElement("h3", { style: { fontSize: 17, fontFamily: "var(--font-display)" } }, title),
            subtitle && React.createElement("span", { className: "faint", style: { fontSize: 12 } }, subtitle)
          ),
          React.createElement("button", { className: "close-btn", onClick: onClose }, React.createElement(Icon, { name: "x", size: 15 }))
        ),
        headerExtra
      ),
      tabs && React.createElement("div", { className: "drawer-tabs" },
        tabs.map(t => React.createElement("div", {
          key: t.key, className: "drawer-tab" + (activeTab === t.key ? " active" : ""), onClick: () => onTab(t.key)
        }, t.label))
      ),
      React.createElement("div", { className: "drawer-body" }, children)
    )
  );
}

/* ---------------- KPI Tile / Pills / Avatar ---------------- */

export function KPITile(props) {
  const { icon, label, value, sub, color, onClick } = props;
  return React.createElement("div", { className: "kpi-tile" + (onClick ? " clickable" : ""), onClick },
    React.createElement("div", { className: "kpi-tile-top" },
      React.createElement("span", { className: "kpi-tile-label" }, label),
      React.createElement("div", { className: "kpi-tile-icon", style: { color: color || "var(--accent)", background: "rgba(255,255,255,0.05)" } },
        React.createElement(Icon, { name: icon, size: 15 }))
    ),
    React.createElement("div", { className: "kpi-tile-value" }, value, sub && React.createElement("small", null, sub))
  );
}

export function StatusPill(props) {
  const { status, list } = props;
  const label = list ? statusLabel(list, status) : status;
  return React.createElement("span", { className: "pill pill-" + status }, label);
}

export function Avatar(props) {
  const { name, color, size } = props;
  const s = size || 30;
  return React.createElement("div", { className: "avatar", style: { width: s, height: s, fontSize: s * 0.4, background: color || "var(--surface-3)" } }, initials(name));
}

export function EmptyState(props) {
  return React.createElement("div", { className: "empty-state" },
    React.createElement(Icon, { name: props.icon || "clipboard", size: 28 }),
    React.createElement("strong", null, props.title),
    props.subtitle && React.createElement("span", null, props.subtitle)
  );
}

/* ---------------- Toast / Confirm ---------------- */

const UIContext = React.createContext(null);
export function useUI() { return React.useContext(UIContext); }

export function UIProvider(props) {
  const [toasts, setToasts] = React.useState([]);
  const [confirmState, setConfirmState] = React.useState(null);

  const toast = React.useCallback((message, opts) => {
    const id = uid("toast");
    setToasts(t => [...t, { id, message, danger: opts && opts.danger }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  const confirm = React.useCallback((opts) => {
    return new Promise(resolve => {
      setConfirmState({
        title: opts.title || "Are you sure?",
        message: opts.message || "",
        confirmLabel: opts.confirmLabel || "Confirm",
        danger: !!opts.danger,
        resolve
      });
    });
  }, []);

  const value = React.useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return React.createElement(UIContext.Provider, { value },
    props.children,
    React.createElement("div", { className: "toast-wrap" },
      toasts.map(t => React.createElement("div", { key: t.id, className: "toast", style: t.danger ? { borderLeftColor: "var(--accent)" } : undefined },
        React.createElement(Icon, { name: t.danger ? "alertTriangle" : "checkCircle", style: t.danger ? { stroke: "var(--accent)" } : undefined }),
        t.message
      ))
    ),
    confirmState && React.createElement(Modal, {
      title: confirmState.title,
      onClose: () => { confirmState.resolve(false); setConfirmState(null); },
      footer: React.createElement(React.Fragment, null,
        React.createElement("button", { className: "btn btn-secondary", onClick: () => { confirmState.resolve(false); setConfirmState(null); } }, "Cancel"),
        React.createElement("button", { className: "btn btn-primary", onClick: () => { confirmState.resolve(true); setConfirmState(null); } }, confirmState.confirmLabel)
      )
    }, React.createElement("p", { className: "muted", style: { margin: 0, fontSize: 13.5 } }, confirmState.message))
  );
}

/* ---------------- Global search ---------------- */

export function buildSearchIndex(db) {
  const rows = [];
  db.customers.forEach(c => rows.push({ kind: "Customer", title: c.name, sub: c.phone, id: c.id, entity: "customer" }));
  db.vehicles.forEach(v => {
    const c = db.customers.find(x => x.id === v.customerId);
    rows.push({ kind: "Vehicle", title: v.year + " " + v.make + " " + v.model, sub: (v.plate || v.vin || "") + (c ? " · " + c.name : ""), id: v.id, entity: "vehicle" });
  });
  db.jobs.forEach(j => {
    const c = db.customers.find(x => x.id === j.customerId);
    rows.push({ kind: "Job", title: j.concern, sub: c ? c.name : "", id: j.id, entity: "job" });
  });
  return rows;
}
export function searchRows(rows, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return rows.filter(r => (r.title + " " + r.sub).toLowerCase().includes(q)).slice(0, 8);
}

/* ---------------- Line items editor (shared: job form + invoices) ---------------- */

export function LineItemsEditor(props) {
  const { items, onChange, library, taxRateDefault } = props;

  // Every keystroke in a line item field used to call onChange() straight
  // away, which saves to Supabase and then refetches the whole shop's data
  // immediately. On a slow connection (or just normal typing speed), a
  // refetch from keystroke #1 can land *after* keystroke #3, overwriting
  // what's been typed since and scrambling the text. To fix that, typing
  // updates local state instantly (so the field never stutters) and is
  // debounced before it's actually sent up to onChange/Supabase, so a burst
  // of keystrokes becomes one save instead of one per character. Adding,
  // removing, or duplicating a row is still applied immediately — those
  // aren't per-keystroke, so there's no race to debounce.
  const [localItems, setLocalItems] = React.useState(items);
  const pendingRef = React.useRef(false);
  const debounceRef = React.useRef(null);

  React.useEffect(() => {
    if (!pendingRef.current) setLocalItems(items);
  }, [items]);

  React.useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  function commitImmediately(next) {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    pendingRef.current = false;
    setLocalItems(next);
    onChange(next);
  }

  function update(id, patch) {
    const next = localItems.map(li => li.id === id ? { ...li, ...patch } : li);
    setLocalItems(next);
    pendingRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pendingRef.current = false;
      debounceRef.current = null;
      onChange(next);
    }, 500);
  }
  function remove(id) {
    commitImmediately(localItems.filter(li => li.id !== id));
  }
  function duplicate(id) {
    const src = localItems.find(li => li.id === id);
    if (!src) return;
    commitImmediately([...localItems, { ...src, id: uid("li") }]);
  }
  function addBlank() {
    commitImmediately([...localItems, { id: uid("li"), name: "", description: "", category: "Custom", qty: 1, unitPrice: 0, laborHours: 0, laborRate: 0, discount: 0, taxRate: taxRateDefault != null ? taxRateDefault : 13 }]);
  }
  function addFromLibrary(tplId) {
    const tpl = library.find(l => l.id === tplId);
    if (!tpl) return;
    commitImmediately([...localItems, { id: uid("li"), name: tpl.name, description: tpl.description, category: tpl.category, qty: 1, unitPrice: tpl.unitPrice, laborHours: tpl.laborHours, laborRate: tpl.laborRate, discount: 0, taxRate: tpl.taxRate != null ? tpl.taxRate : 13 }]);
  }

  return React.createElement("div", { className: "vstack", style: { gap: 10 } },
    React.createElement("div", { className: "table-wrap", style: { border: "none", borderRadius: 0 } },
      React.createElement("table", { className: "li-table" },
        React.createElement("thead", null, React.createElement("tr", null,
          React.createElement("th", { style: { minWidth: 180 } }, "Item"),
          React.createElement("th", { style: { minWidth: 90 } }, "Category"),
          React.createElement("th", { style: { width: 64 } }, "Qty"),
          React.createElement("th", { style: { width: 90 } }, "Unit $"),
          React.createElement("th", { style: { width: 70 } }, "Labour hrs"),
          React.createElement("th", { style: { width: 90 } }, "Labour $/hr"),
          React.createElement("th", { style: { width: 80 } }, "Discount"),
          React.createElement("th", { style: { width: 60 } }, "Tax %"),
          React.createElement("th", { style: { width: 90 }, className: "text-right" }, "Total"),
          React.createElement("th", { style: { width: 68 } })
        )),
        React.createElement("tbody", null,
          localItems.length === 0 && React.createElement("tr", null, React.createElement("td", { colSpan: 10 },
            React.createElement("div", { className: "faint", style: { padding: "10px 2px", fontSize: 12.5 } }, "No line items yet. Add from the library or create a custom item.")
          )),
          localItems.map(li => React.createElement("tr", { key: li.id },
            React.createElement("td", null,
              React.createElement("input", { className: "input", value: li.name, placeholder: "Item name", onChange: e => update(li.id, { name: e.target.value }) })
            ),
            React.createElement("td", null,
              React.createElement("select", { className: "input", value: li.category, onChange: e => update(li.id, { category: e.target.value }) },
                LINE_ITEM_CATEGORIES.map(c => React.createElement("option", { key: c, value: c }, c)))
            ),
            React.createElement("td", null, React.createElement("input", { type: "number", min: 0, className: "input", value: li.qty, onChange: e => update(li.id, { qty: Number(e.target.value) }) })),
            React.createElement("td", null, React.createElement("input", { type: "number", min: 0, step: "0.01", className: "input", value: li.unitPrice, onChange: e => update(li.id, { unitPrice: Number(e.target.value) }) })),
            React.createElement("td", null, React.createElement("input", { type: "number", min: 0, step: "0.1", className: "input", value: li.laborHours, onChange: e => update(li.id, { laborHours: Number(e.target.value) }) })),
            React.createElement("td", null, React.createElement("input", { type: "number", min: 0, step: "1", className: "input", value: li.laborRate, onChange: e => update(li.id, { laborRate: Number(e.target.value) }) })),
            React.createElement("td", null, React.createElement("input", { type: "number", min: 0, step: "0.01", className: "input", value: li.discount, onChange: e => update(li.id, { discount: Number(e.target.value) }) })),
            React.createElement("td", null, React.createElement("input", { type: "number", min: 0, step: "1", className: "input", value: li.taxRate, onChange: e => update(li.id, { taxRate: Number(e.target.value) }) })),
            React.createElement("td", { className: "li-total-col" }, fmtMoney(lineItemTotal(li))),
            React.createElement("td", null,
              React.createElement("div", { className: "hstack", style: { gap: 4 } },
                React.createElement("button", { className: "btn btn-ghost btn-icon li-remove-btn", title: "Duplicate", onClick: () => duplicate(li.id) }, React.createElement(Icon, { name: "copy", size: 14 })),
                React.createElement("button", { className: "btn btn-ghost btn-icon li-remove-btn", title: "Remove", onClick: () => remove(li.id) }, React.createElement(Icon, { name: "trash", size: 14 }))
              )
            )
          ))
        )
      )
    ),
    React.createElement("div", { className: "hstack", style: { justifyContent: "space-between", flexWrap: "wrap", gap: 8 } },
      React.createElement("div", { className: "hstack" },
        React.createElement("select", {
          className: "input", style: { width: 220 }, value: "",
          onChange: e => { if (e.target.value) addFromLibrary(e.target.value); }
        },
          React.createElement("option", { value: "" }, "+ Add from library…"),
          library.map(l => React.createElement("option", { key: l.id, value: l.id }, l.name))
        ),
        React.createElement("button", { className: "btn btn-secondary btn-sm", onClick: addBlank },
          React.createElement(Icon, { name: "plus", size: 14 }), "Custom item")
      ),
      React.createElement("span", { className: "faint", style: { fontSize: 12 } }, localItems.length + " item" + (localItems.length === 1 ? "" : "s"))
    )
  );
}

export function TotalsBox(props) {
  const t = props.totals;
  return React.createElement("div", { className: "totals-box" },
    React.createElement("div", { className: "totals-row" }, React.createElement("span", null, "Subtotal"), React.createElement("span", { className: "val" }, fmtMoney(t.subtotal))),
    t.discAmt > 0 && React.createElement("div", { className: "totals-row" }, React.createElement("span", null, "Discount"), React.createElement("span", { className: "val" }, "-" + fmtMoney(t.discAmt))),
    React.createElement("div", { className: "totals-row" }, React.createElement("span", null, "Tax"), React.createElement("span", { className: "val" }, fmtMoney(t.taxAmt))),
    t.paid > 0 && React.createElement("div", { className: "totals-row" }, React.createElement("span", null, "Paid / deposits"), React.createElement("span", { className: "val" }, "-" + fmtMoney(t.paid))),
    React.createElement("div", { className: "totals-row grand" }, React.createElement("span", null, t.paid > 0 ? "Balance Due" : "Total"), React.createElement("span", { className: "val" }, fmtMoney(t.paid > 0 ? t.balance : t.total)))
  );
}
