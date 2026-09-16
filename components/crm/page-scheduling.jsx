"use client";
/* ==========================================================================
   Page 2 — Scheduling: custom day/week/month calendar with drag/resize,
   plus the full "Create Job" form. Ported verbatim from the prototype's
   page-scheduling.js — only the top imports changed, and CreateJobModal
   now calls the Supabase-backed actions.createJobBundle from lib/crm/actions.js.
   ========================================================================== */
import React from "react";
import { Icon } from "./icons";
import { Modal, LineItemsEditor, TotalsBox, StatusPill } from "./ui";
import {
  setTime, addMinutes, findById, computeTotals, isSameDay, startOfDay,
  addDays, startOfWeek, fmtDate, fmtDateShort, fmtTime, JOB_STATUSES, TEAM_STATUSES
} from "@/lib/crm/helpers";

const CAL_START_HOUR = 7;
const CAL_END_HOUR = 19;
const PX_PER_HOUR = 56;
const PX_PER_MIN = PX_PER_HOUR / 60;

function snap15(min) { return Math.round(min / 15) * 15; }
function combineDateTime(date, time) {
  const [h, m] = time.split(":").map(Number);
  return setTime(date, h, m);
}

/* ---------------- Time grid (Day + Week share this) ---------------- */

function TimeGridCalendar(props) {
  const { columns, columnKind, eventsByCol, onSlotClick, onEventClick, onEventMove, resolveColDate } = props;
  const [dragging, setDragging] = React.useState(null);
  const hours = [];
  for (let h = CAL_START_HOUR; h < CAL_END_HOUR; h++) hours.push(h);

  React.useEffect(() => {
    if (!dragging) return;
    function onMove(e) {
      const deltaY = e.clientY - dragging.startY;
      const deltaMin = snap15(deltaY / PX_PER_MIN);
      let newStart, newEnd;
      if (dragging.mode === "resize") {
        newStart = dragging.origStart;
        const minDur = 15;
        const proposedEnd = addMinutes(dragging.origEnd, deltaMin);
        newEnd = proposedEnd > addMinutes(newStart, minDur) ? proposedEnd : addMinutes(newStart, minDur);
      } else {
        newStart = addMinutes(dragging.origStart, deltaMin);
        newEnd = addMinutes(dragging.origEnd, deltaMin);
      }
      let colKey = dragging.colKey;
      if (dragging.mode === "move") {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const colEl = el && el.closest && el.closest("[data-colkey]");
        if (colEl) colKey = colEl.getAttribute("data-colkey");
      }
      setDragging(prev => prev && ({ ...prev, preview: { start: newStart, end: newEnd, colKey } }));
    }
    function onUp() {
      setDragging(curr => {
        if (curr) {
          let finalStart = curr.preview.start, finalEnd = curr.preview.end;
          const colChanged = curr.preview.colKey !== curr.colKey;
          let techId;
          if (columnKind === "date" && colChanged && resolveColDate) {
            const d = resolveColDate(curr.preview.colKey);
            if (d) {
              finalStart = setTime(d, finalStart.getHours(), finalStart.getMinutes());
              finalEnd = addMinutes(finalStart, Math.round((curr.origEnd - curr.origStart) / 60000));
            }
          } else if (columnKind === "tech" && colChanged) {
            techId = curr.preview.colKey;
          }
          onEventMove(curr.apptId, finalStart, finalEnd, techId);
        }
        return null;
      });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, columnKind, onEventMove, resolveColDate]);

  function startDrag(e, appt, colKey, mode) {
    e.preventDefault(); e.stopPropagation();
    setDragging({ apptId: appt.id, mode, startY: e.clientY, colKey, origStart: new Date(appt.start), origEnd: new Date(appt.end), preview: { start: new Date(appt.start), end: new Date(appt.end), colKey } });
  }

  function eventStyle(appt, colKey) {
    const isDrag = dragging && dragging.apptId === appt.id;
    const useAppt = isDrag ? dragging.preview : { start: appt.start, end: appt.end };
    if (isDrag && dragging.preview.colKey !== colKey) return null;
    const startH = useAppt.start.getHours() + useAppt.start.getMinutes() / 60;
    const durMin = Math.max(15, (useAppt.end - useAppt.start) / 60000);
    const top = (startH - CAL_START_HOUR) * PX_PER_HOUR;
    const height = (durMin / 60) * PX_PER_HOUR;
    return { top: top + "px", height: Math.max(20, height) + "px" };
  }

  const now = new Date();

  return React.createElement("div", { className: "cal-timegrid " + (columnKind === "tech" ? "day-mode" : "week-mode"), style: columnKind === "tech" ? { "--tech-cols": columns.length } : undefined },
    React.createElement("div", { className: "cal-hours-col" },
      hours.map(h => React.createElement("div", { key: h, className: "cal-hour-label" }, (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? " AM" : " PM")))
    ),
    columns.map(col => {
      const evts = eventsByCol[col.key] || [];
      const isTodayCol = columnKind === "date" ? isSameDay(col.date, now) : isSameDay(new Date(), now);
      return React.createElement("div", { key: col.key, className: "cal-day-col", "data-colkey": col.key, style: { position: "relative" } },
        hours.map(h => React.createElement("div", {
          key: h, className: "cal-hour-line", onClick: (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const offsetY = e.clientY - rect.top;
            const min = snap15((offsetY / PX_PER_HOUR) * 60);
            onSlotClick(col, h, min);
          }
        })),
        isTodayCol && now.getHours() >= CAL_START_HOUR && now.getHours() < CAL_END_HOUR && React.createElement("div", {
          className: "cal-now-line", style: { top: ((now.getHours() + now.getMinutes() / 60 - CAL_START_HOUR) * PX_PER_HOUR) + "px" }
        }),
        evts.map(appt => {
          const style = eventStyle(appt, col.key);
          if (!style) return null;
          const isDrag = dragging && dragging.apptId === appt.id;
          return React.createElement("div", {
            key: appt.id,
            className: "cal-event" + (isDrag ? " dragging" : ""),
            style: Object.assign({ background: appt.color }, style),
            onMouseDown: (e) => startDrag(e, appt, col.key, "move"),
            onClick: (e) => { e.stopPropagation(); if (!isDrag) onEventClick(appt); }
          },
            React.createElement("div", { className: "cal-event-time" }, fmtTime(isDrag ? dragging.preview.start : appt.start)),
            React.createElement("div", { className: "cal-event-title" }, appt.title),
            React.createElement("div", { className: "cal-event-sub" }, appt.sub),
            React.createElement("div", { className: "cal-event-resize", onMouseDown: (e) => startDrag(e, appt, col.key, "resize") })
          );
        })
      );
    })
  );
}

/* ---------------- Month view ---------------- */

function MonthGrid(props) {
  const { cursorDate, appointmentsByDay, onDayClick, onEventClick } = props;
  const monthStart = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  const cells = [];
  for (let i = 0; i < 42; i++) cells.push(addDays(gridStart, i));
  const today = new Date();
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return React.createElement(React.Fragment, null,
    React.createElement("div", { className: "cal-month-header" },
      weekdayLabels.map(w => React.createElement("div", { key: w, className: "cal-month-header-cell" }, w))
    ),
    React.createElement("div", { className: "cal-month-grid" },
    cells.map((d, i) => {
      const key = d.toDateString();
      const evts = appointmentsByDay[key] || [];
      const inMonth = d.getMonth() === cursorDate.getMonth();
      return React.createElement("div", {
        key: i, className: "cal-month-cell" + (inMonth ? "" : " other-month"), onClick: () => onDayClick(d)
      },
        React.createElement("div", { className: "cal-month-daynum" + (isSameDay(d, today) ? " is-today" : "") }, d.getDate()),
        evts.slice(0, 3).map(a => React.createElement("div", {
          key: a.id, className: "cal-month-pill", style: { background: a.color },
          onClick: (e) => { e.stopPropagation(); onEventClick(a); }
        }, fmtTime(a.start) + " " + a.title)),
        evts.length > 3 && React.createElement("div", { className: "cal-month-more" }, "+" + (evts.length - 3) + " more")
      );
    })
    )
  );
}

/* ---------------- Create Job Modal ---------------- */

function emptyJobForm(prefill) {
  const now = prefill && prefill.date ? prefill.date : new Date();
  return Object.assign({
    customerMode: "existing", customerId: "", newCustomer: { name: "", phone: "", email: "", address: "" },
    vehicleMode: "existing", vehicleId: "",
    newVehicle: { year: new Date().getFullYear(), make: "", model: "", trim: "", vin: "", plate: "", color: "", mileage: "" },
    dateStr: startOfDay(now).toISOString().slice(0, 10),
    timeStr: (prefill && prefill.time) || "09:00",
    durationMin: 60,
    technicianId: (prefill && prefill.technicianId) || "",
    concern: "", diagnosis: "", notes: "",
    lineItems: [], approvalStatus: "pending", status: "scheduled"
  }, {});
}

function CreateJobModal(props) {
  const { db, actions, ui, onClose, onCreated, prefill } = props;
  const [form, setForm] = React.useState(() => emptyJobForm(prefill));
  const [custQuery, setCustQuery] = React.useState("");

  const custMatches = React.useMemo(() => {
    if (!custQuery.trim()) return [];
    const q = custQuery.toLowerCase();
    return db.customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 6);
  }, [custQuery, db.customers]);

  const custVehicles = form.customerId ? db.vehicles.filter(v => v.customerId === form.customerId) : [];
  const totals = computeTotals(form.lineItems, 0, "percent", db.settings.taxRate, []);

  function patch(p) { setForm(f => ({ ...f, ...p })); }

  function canSubmit() {
    const custOk = form.customerMode === "existing" ? !!form.customerId : (form.newCustomer.name.trim() && form.newCustomer.phone.trim());
    const vehOk = form.vehicleMode === "existing" ? !!form.vehicleId : (form.newVehicle.make.trim() && form.newVehicle.model.trim());
    return custOk && vehOk && form.concern.trim() && form.technicianId;
  }

  function submit() {
    if (!canSubmit()) { ui.toast("Fill in customer, vehicle, technician & concern first.", { danger: true }); return; }
    const start = combineDateTime(new Date(form.dateStr + "T00:00:00"), form.timeStr);
    const end = addMinutes(start, Number(form.durationMin));
    const result = actions.createJobBundle({
      customerId: form.customerMode === "existing" ? form.customerId : null,
      newCustomer: form.newCustomer,
      vehicleId: form.vehicleMode === "existing" ? form.vehicleId : null,
      newVehicle: form.newVehicle,
      technicianId: form.technicianId,
      concern: form.concern, diagnosis: form.diagnosis, notes: form.notes,
      lineItems: form.lineItems, approvalStatus: form.approvalStatus, status: form.status,
      start, end
    });
    ui.toast("Job created and added to the schedule.");
    onCreated(result, start);
  }

  return React.createElement(Modal, {
    title: "Create Job", subtitle: "Customer → Vehicle → Appointment → Job → Invoice, all linked automatically.",
    onClose, wide: true,
    footer: React.createElement(React.Fragment, null,
      React.createElement("button", { className: "btn btn-secondary", onClick: onClose }, "Cancel"),
      React.createElement("button", { className: "btn btn-primary", onClick: submit }, React.createElement(Icon, { name: "check", size: 15 }), "Create Job")
    )
  },
    React.createElement("fieldset", { className: "section" },
      React.createElement("legend", null, "Customer"),
      React.createElement("div", { className: "hstack", style: { gap: 16 } },
        React.createElement("label", { className: "checkbox-row" }, React.createElement("input", { type: "radio", checked: form.customerMode === "existing", onChange: () => patch({ customerMode: "existing" }) }), "Existing customer"),
        React.createElement("label", { className: "checkbox-row" }, React.createElement("input", { type: "radio", checked: form.customerMode === "new", onChange: () => patch({ customerMode: "new", vehicleMode: "new", vehicleId: "" }) }), "New customer")
      ),
      form.customerMode === "existing" ? React.createElement("div", { className: "field" },
        form.customerId ? React.createElement("div", { className: "list-item" },
          React.createElement("span", { style: { fontWeight: 700 } }, findById(db.customers, form.customerId).name),
          React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => patch({ customerId: "", vehicleId: "" }) }, "Change")
        ) : React.createElement("div", { style: { position: "relative" } },
          React.createElement("input", { className: "input", placeholder: "Search by name or phone…", value: custQuery, onChange: e => setCustQuery(e.target.value) }),
          custMatches.length > 0 && React.createElement("div", { className: "card", style: { position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, padding: 6, zIndex: 20 } },
            custMatches.map(c => React.createElement("div", { key: c.id, className: "list-item clickable", style: { marginBottom: 4 }, onClick: () => { patch({ customerId: c.id, vehicleId: "" }); setCustQuery(""); } },
              React.createElement("span", null, c.name), React.createElement("span", { className: "faint" }, c.phone)))
          )
        )
      ) : React.createElement("div", { className: "field-row" },
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Full name"), React.createElement("input", { className: "input", value: form.newCustomer.name, onChange: e => patch({ newCustomer: { ...form.newCustomer, name: e.target.value } }) })),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Phone"), React.createElement("input", { className: "input", value: form.newCustomer.phone, onChange: e => patch({ newCustomer: { ...form.newCustomer, phone: e.target.value } }) })),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Email"), React.createElement("input", { className: "input", value: form.newCustomer.email, onChange: e => patch({ newCustomer: { ...form.newCustomer, email: e.target.value } }) })),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Address"), React.createElement("input", { className: "input", value: form.newCustomer.address, onChange: e => patch({ newCustomer: { ...form.newCustomer, address: e.target.value } }) }))
      )
    ),

    React.createElement("fieldset", { className: "section" },
      React.createElement("legend", null, "Vehicle"),
      form.customerMode === "existing" && form.customerId && custVehicles.length > 0 && React.createElement("div", { className: "hstack", style: { gap: 16 } },
        React.createElement("label", { className: "checkbox-row" }, React.createElement("input", { type: "radio", checked: form.vehicleMode === "existing", onChange: () => patch({ vehicleMode: "existing" }) }), "Existing vehicle"),
        React.createElement("label", { className: "checkbox-row" }, React.createElement("input", { type: "radio", checked: form.vehicleMode === "new", onChange: () => patch({ vehicleMode: "new" }) }), "Add new vehicle")
      ),
      form.vehicleMode === "existing" && custVehicles.length > 0 ? React.createElement("select", { className: "input", value: form.vehicleId, onChange: e => patch({ vehicleId: e.target.value }) },
        React.createElement("option", { value: "" }, "Select a vehicle…"),
        custVehicles.map(v => React.createElement("option", { key: v.id, value: v.id }, v.year + " " + v.make + " " + v.model + " — " + (v.plate || v.vin)))
      ) : React.createElement("div", { className: "field-row" },
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Year"), React.createElement("input", { type: "number", className: "input", value: form.newVehicle.year, onChange: e => patch({ newVehicle: { ...form.newVehicle, year: e.target.value } }) })),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Make"), React.createElement("input", { className: "input", value: form.newVehicle.make, onChange: e => patch({ newVehicle: { ...form.newVehicle, make: e.target.value } }) })),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Model"), React.createElement("input", { className: "input", value: form.newVehicle.model, onChange: e => patch({ newVehicle: { ...form.newVehicle, model: e.target.value } }) })),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Plate"), React.createElement("input", { className: "input", value: form.newVehicle.plate, onChange: e => patch({ newVehicle: { ...form.newVehicle, plate: e.target.value } }) })),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "VIN"), React.createElement("input", { className: "input", value: form.newVehicle.vin, onChange: e => patch({ newVehicle: { ...form.newVehicle, vin: e.target.value } }) })),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Mileage (km)"), React.createElement("input", { type: "number", className: "input", value: form.newVehicle.mileage, onChange: e => patch({ newVehicle: { ...form.newVehicle, mileage: e.target.value } }) }))
      )
    ),

    React.createElement("fieldset", { className: "section" },
      React.createElement("legend", null, "Appointment"),
      React.createElement("div", { className: "field-row" },
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Date"), React.createElement("input", { type: "date", className: "input", value: form.dateStr, onChange: e => patch({ dateStr: e.target.value }) })),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Time"), React.createElement("input", { type: "time", className: "input", value: form.timeStr, onChange: e => patch({ timeStr: e.target.value }) })),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Duration"),
          React.createElement("select", { className: "input", value: form.durationMin, onChange: e => patch({ durationMin: e.target.value }) },
            [15, 30, 45, 60, 90, 120, 180, 240].map(m => React.createElement("option", { key: m, value: m }, m < 60 ? m + " min" : (m / 60) + " hr" + (m > 60 ? "s" : "")))
          )),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Technician"),
          React.createElement("select", { className: "input", value: form.technicianId, onChange: e => patch({ technicianId: e.target.value }) },
            React.createElement("option", { value: "" }, "Assign technician…"),
            db.team.filter(t => t.role === "Technician" || t.role === "Apprentice" || t.role === "Owner").map(t => React.createElement("option", { key: t.id, value: t.id }, t.name + " — " + t.role))
          ))
      )
    ),

    React.createElement("fieldset", { className: "section" },
      React.createElement("legend", null, "Job details"),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Customer concern"), React.createElement("textarea", { className: "input", rows: 2, value: form.concern, onChange: e => patch({ concern: e.target.value }) })),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Diagnosis (optional)"), React.createElement("textarea", { className: "input", rows: 2, value: form.diagnosis, onChange: e => patch({ diagnosis: e.target.value }) })),
      React.createElement("div", { className: "field-row" },
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Approval status"),
          React.createElement("select", { className: "input", value: form.approvalStatus, onChange: e => patch({ approvalStatus: e.target.value }) },
            React.createElement("option", { value: "pending" }, "Pending"), React.createElement("option", { value: "approved" }, "Approved"), React.createElement("option", { value: "declined" }, "Declined")
          )),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Job status"),
          React.createElement("select", { className: "input", value: form.status, onChange: e => patch({ status: e.target.value }) },
            JOB_STATUSES.filter(s => s.value !== "completed" && s.value !== "cancelled").map(s => React.createElement("option", { key: s.value, value: s.value }, s.label))
          ))
      )
    ),

    React.createElement("fieldset", { className: "section" },
      React.createElement("legend", null, "Line items & estimate"),
      React.createElement(LineItemsEditor, { items: form.lineItems, onChange: items => patch({ lineItems: items }), library: db.lineItemLibrary, taxRateDefault: db.settings.taxRate }),
      React.createElement(TotalsBox, { totals })
    ),

    React.createElement("div", { className: "field" }, React.createElement("label", null, "Notes"), React.createElement("textarea", { className: "input", rows: 2, value: form.notes, onChange: e => patch({ notes: e.target.value }) }))
  );
}

/* ---------------- Scheduling page ---------------- */

export function SchedulingPage(props) {
  const { db, actions, ui, onOpenJob } = props;
  const [view, setView] = React.useState("week");
  const [cursorDate, setCursorDate] = React.useState(startOfDay(new Date()));
  const [techFilter, setTechFilter] = React.useState("all");
  const [showCreate, setShowCreate] = React.useState(false);
  const [prefill, setPrefill] = React.useState(null);

  const techs = db.team.filter(t => t.role !== "Receptionist" && t.role !== "Manager" && t.role !== "Owner").concat(db.team.filter(t => t.role === "Owner"));

  function apptColor(appt) {
    const t = findById(db.team, appt.technicianId);
    return t ? t.color : "var(--surface-3)";
  }
  function apptSub(appt) {
    const c = findById(db.customers, appt.customerId);
    const v = findById(db.vehicles, appt.vehicleId);
    return (c ? c.name : "") + (v ? " · " + v.make + " " + v.model : "");
  }
  function decorate(appt) {
    return Object.assign({}, appt, { color: apptColor(appt), sub: apptSub(appt) });
  }

  function shiftCursor(delta) {
    if (view === "day") setCursorDate(d => addDays(d, delta));
    else if (view === "week") setCursorDate(d => addDays(d, delta * 7));
    else setCursorDate(d => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }

  function openCreateAt(date, hour, minute, technicianId) {
    const time = (hour != null ? String(hour).padStart(2, "0") : "09") + ":" + (minute != null ? String(minute).padStart(2, "0") : "00");
    setPrefill({ date, time, technicianId });
    setShowCreate(true);
  }

  function handleEventMove(apptId, newStart, newEnd, newTechId) {
    actions.moveAppointment(apptId, newStart, newEnd);
    if (newTechId) {
      actions.updateAppointment(apptId, { technicianId: newTechId });
      const appt = findById(db.appointments, apptId);
      if (appt && appt.jobId) actions.updateJob(appt.jobId, { technicianId: newTechId });
    }
    ui.toast("Appointment rescheduled.");
  }

  const filteredAppts = db.appointments.filter(a => a.status !== "cancelled" && (techFilter === "all" || a.technicianId === techFilter));

  let title = "";
  if (view === "day") title = fmtDate(cursorDate, { weekday: "long", month: "long", day: "numeric" });
  else if (view === "week") { const s = startOfWeek(cursorDate), e = addDays(s, 6); title = fmtDateShort(s) + " – " + fmtDate(e, { month: "short", day: "numeric", year: "numeric" }); }
  else title = fmtDate(cursorDate, { month: "long", year: "numeric" });

  let body;
  if (view === "week") {
    const weekStart = startOfWeek(cursorDate);
    const columns = [];
    for (let i = 0; i < 7; i++) { const d = addDays(weekStart, i); columns.push({ key: d.toDateString(), date: d, label: d }); }
    const eventsByCol = {};
    columns.forEach(c => { eventsByCol[c.key] = filteredAppts.filter(a => isSameDay(a.start, c.date)).map(decorate).sort((a, b) => a.start - b.start); });
    body = React.createElement(React.Fragment, null,
      React.createElement("div", { className: "cal-week-header" },
        React.createElement("div", { className: "cal-corner" }),
        columns.map(c => React.createElement("div", { key: c.key, className: "cal-col-head" + (isSameDay(c.date, new Date()) ? " is-today" : "") },
          React.createElement("div", { className: "dow" }, c.date.toLocaleDateString("en-CA", { weekday: "short" })),
          React.createElement("div", { className: "dnum" }, c.date.getDate())
        ))
      ),
      React.createElement(TimeGridCalendar, {
        columns, columnKind: "date", eventsByCol,
        resolveColDate: (key) => columns.find(c => c.key === key) && columns.find(c => c.key === key).date,
        onSlotClick: (col, hour, minute) => openCreateAt(col.date, hour, minute, null),
        onEventClick: (appt) => onOpenJob(appt.jobId),
        onEventMove: handleEventMove
      })
    );
  } else if (view === "day") {
    const activeTechs = techFilter === "all" ? techs : techs.filter(t => t.id === techFilter);
    const columns = activeTechs.map(t => ({ key: t.id, techId: t.id, label: t.name }));
    const eventsByCol = {};
    columns.forEach(c => { eventsByCol[c.key] = filteredAppts.filter(a => isSameDay(a.start, cursorDate) && a.technicianId === c.key).map(decorate).sort((a, b) => a.start - b.start); });
    body = React.createElement(React.Fragment, null,
      React.createElement("div", { className: "cal-day-header", style: { gridTemplateColumns: "62px repeat(" + columns.length + ", 1fr)" } },
        React.createElement("div", { className: "cal-corner" }),
        columns.map(c => { const t = findById(db.team, c.key); return React.createElement("div", { key: c.key, className: "cal-col-head" },
          React.createElement("div", { className: "hstack", style: { justifyContent: "center", gap: 6 } },
            React.createElement("span", { style: { width: 8, height: 8, borderRadius: 99, background: t.color, display: "inline-block" } }),
            React.createElement("span", { className: "dow", style: { textTransform: "none", fontSize: 12 } }, t.name.split(" ")[0])
          )
        ); })
      ),
      React.createElement(TimeGridCalendar, {
        columns, columnKind: "tech", eventsByCol,
        onSlotClick: (col) => openCreateAt(cursorDate, null, null, col.techId),
        onEventClick: (appt) => onOpenJob(appt.jobId),
        onEventMove: handleEventMove
      })
    );
  } else {
    const byDay = {};
    filteredAppts.forEach(a => { const k = startOfDay(a.start).toDateString(); (byDay[k] = byDay[k] || []).push(decorate(a)); });
    Object.values(byDay).forEach(list => list.sort((a, b) => a.start - b.start));
    body = React.createElement(MonthGrid, {
      cursorDate, appointmentsByDay: byDay,
      onDayClick: (d) => { setCursorDate(d); setView("day"); },
      onEventClick: (appt) => onOpenJob(appt.jobId)
    });
  }

  return React.createElement("div", { className: "section-stack" },
    React.createElement("div", { className: "cal-toolbar" },
      React.createElement("div", { className: "cal-toolbar-left" },
        React.createElement("button", { className: "btn btn-secondary btn-sm", onClick: () => setCursorDate(startOfDay(new Date())) }, "Today"),
        React.createElement("div", { className: "cal-nav-group" },
          React.createElement("button", { className: "cal-nav-btn", onClick: () => shiftCursor(-1) }, React.createElement(Icon, { name: "chevronLeft", size: 15 })),
          React.createElement("button", { className: "cal-nav-btn", onClick: () => shiftCursor(1) }, React.createElement(Icon, { name: "chevronRight", size: 15 }))
        ),
        React.createElement("div", { className: "cal-title" }, title)
      ),
      React.createElement("div", { className: "hstack" },
        React.createElement("div", { className: "view-switch" },
          ["day", "week", "month"].map(v => React.createElement("button", { key: v, className: view === v ? "active" : "", onClick: () => setView(v) }, v[0].toUpperCase() + v.slice(1)))
        ),
        React.createElement("button", { className: "btn btn-primary", onClick: () => { setPrefill(null); setShowCreate(true); } }, React.createElement(Icon, { name: "plus", size: 15 }), "Create Job")
      )
    ),

    React.createElement("div", { className: "card", style: { padding: 12 } },
      React.createElement("div", { className: "cal-legend" },
        React.createElement("span", { className: "faint", style: { fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" } }, "Team today:"),
        React.createElement("div", { className: "filter-chip", style: techFilter === "all" ? { background: "var(--accent-soft)", borderColor: "var(--accent-soft-border)", color: "#fff" } : undefined, onClick: () => setTechFilter("all") }, "All technicians"),
        techs.map(t => React.createElement("div", { key: t.id, className: "cal-legend-item", style: { cursor: "pointer", opacity: techFilter !== "all" && techFilter !== t.id ? 0.4 : 1 }, onClick: () => setTechFilter(techFilter === t.id ? "all" : t.id) },
          React.createElement("span", { className: "cal-legend-dot", style: { background: t.color } }),
          t.name, React.createElement(StatusPill, { status: t.status, list: TEAM_STATUSES })
        ))
      )
    ),

    React.createElement("div", { className: "cal-grid-wrap" },
      view === "month" ? body : React.createElement("div", { className: "cal-body-scroll" }, body)
    ),

    showCreate && React.createElement(CreateJobModal, {
      db, actions, ui, prefill,
      onClose: () => setShowCreate(false),
      onCreated: (result, start) => { setShowCreate(false); setCursorDate(startOfDay(start)); setView("day"); }
    })
  );
}
