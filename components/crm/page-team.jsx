"use client";
/* ==========================================================================
   Page 4 — Team Management. Ported from the prototype's page-team.js.

   Changes from the prototype (both required by the multi-tenant auth
   model, everything else is untouched):
     - Adding a teammate now also collects an email + a 6-digit access
       PIN, because actions.addTeamMember creates a real Supabase Auth
       account + PIN for them (POST /api/team/invite) rather than just
       appending to an in-memory array. Owner/manager sets this PIN for
       them; the teammate can change it later.
     - "Owner" is not selectable as a role here — there is exactly one
       owner per shop, set at initial shop setup.
   ========================================================================== */
import React from "react";
import { Icon } from "./icons";
import { Modal, Drawer, Avatar, StatusPill } from "./ui";
import {
  findById, fmtTime, isSameDay, TEAM_ROLES, TEAM_ROLE_VALUES, TEAM_STATUSES, JOB_STATUSES
} from "@/lib/crm/helpers";

const DOW = [{ k: 0, l: "Sun" }, { k: 1, l: "Mon" }, { k: 2, l: "Tue" }, { k: 3, l: "Wed" }, { k: 4, l: "Thu" }, { k: 5, l: "Fri" }, { k: 6, l: "Sat" }];
const ASSIGNABLE_ROLES = TEAM_ROLES.filter(r => r !== "Owner");

function TeamMemberModal(props) {
  const { actions, ui, member, onClose } = props;
  const isNew = !member;
  const [form, setForm] = React.useState(() => member || { name: "", role: "Technician", email: "", phone: "", pin: "" });
  const [saving, setSaving] = React.useState(false);
  function patch(p) { setForm(f => ({ ...f, ...p })); }

  async function submit() {
    if (!form.name.trim()) { ui.toast("Enter a name.", { danger: true }); return; }
    if (isNew && !form.email.trim()) { ui.toast("Enter an email for their account.", { danger: true }); return; }
    if (isNew && !/^\d{6}$/.test(form.pin || "")) { ui.toast("Choose a 6-digit access code for them.", { danger: true }); return; }

    setSaving(true);
    if (isNew) {
      await actions.addTeamMember({
        name: form.name, role: TEAM_ROLE_VALUES[form.role] || "technician",
        email: form.email, phone: form.phone, pin: form.pin
      });
    } else {
      await actions.updateTeamMember(member.id, {
        name: form.name, phone: form.phone,
        role: member.role === "Owner" ? undefined : TEAM_ROLE_VALUES[form.role]
      });
      ui.toast("Team member updated.");
    }
    setSaving(false);
    onClose();
  }

  return React.createElement(Modal, {
    title: isNew ? "Add Team Member" : "Edit Team Member", onClose,
    footer: React.createElement(React.Fragment, null,
      React.createElement("button", { className: "btn btn-secondary", onClick: onClose }, "Cancel"),
      React.createElement("button", { className: "btn btn-primary", onClick: submit, disabled: saving }, saving ? "Saving…" : "Save")
    )
  },
    React.createElement("div", { className: "field" }, React.createElement("label", null, "Full name"), React.createElement("input", { className: "input", value: form.name, onChange: e => patch({ name: e.target.value }) })),
    member && member.role === "Owner"
      ? React.createElement("p", { className: "faint", style: { fontSize: 12.5 } }, "Role: Owner (the shop owner's role can't be changed here).")
      : React.createElement("div", { className: "field" }, React.createElement("label", null, "Role"),
          React.createElement("select", { className: "input", value: form.role, onChange: e => patch({ role: e.target.value }) }, ASSIGNABLE_ROLES.map(r => React.createElement("option", { key: r, value: r }, r)))),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Phone"), React.createElement("input", { className: "input", value: form.phone, onChange: e => patch({ phone: e.target.value }) })),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Email"),
        React.createElement("input", { className: "input", value: form.email, disabled: !isNew, onChange: e => patch({ email: e.target.value }) }))
    ),
    isNew && React.createElement("div", { className: "field" },
      React.createElement("label", null, "6-digit access code"),
      React.createElement("input", {
        className: "input", value: form.pin, maxLength: 6, placeholder: "e.g. 482913",
        onChange: e => patch({ pin: e.target.value.replace(/\D/g, "").slice(0, 6) })
      }),
      React.createElement("p", { className: "faint", style: { fontSize: 11.5, margin: "4px 0 0" } }, "They'll sign in with the shop name and this code — they can change it themselves later.")
    )
  );
}

function TeamMemberDrawer(props) {
  const { db, actions, ui, memberId, onClose, onOpenJob } = props;
  const t = findById(db.team, memberId);
  const [showEdit, setShowEdit] = React.useState(false);
  if (!t) return null;

  const today = new Date();
  const todaysAppts = db.appointments.filter(a => a.technicianId === t.id && isSameDay(a.start, today) && a.status !== "cancelled").sort((a, b) => a.start - b.start);
  const assignedJobs = db.jobs.filter(j => j.technicianId === t.id && j.status !== "completed" && j.status !== "cancelled");
  const otherTechs = db.team.filter(m => m.id !== t.id && (m.role === "Technician" || m.role === "Apprentice" || m.role === "Owner"));

  function toggleDay(day) {
    const days = t.workDays.includes(day) ? t.workDays.filter(d => d !== day) : [...t.workDays, day].sort();
    actions.updateTeamMember(t.id, { workDays: days });
  }

  async function handleRemove() {
    const ok = await ui.confirm({ title: "Remove team member?", message: "This removes " + t.name + " from the team. Assigned jobs will keep their history but should be reassigned.", confirmLabel: "Remove", danger: true });
    if (ok) { await actions.removeTeamMember(t.id); ui.toast(t.name + " removed from the team."); onClose(); }
  }

  return React.createElement(Drawer, {
    title: t.name, subtitle: t.role, onClose,
    headerExtra: React.createElement("div", { className: "hstack", style: { marginTop: 10 } },
      React.createElement(Avatar, { name: t.name, color: t.color, size: 34 }),
      React.createElement("select", { className: "input", style: { width: 150 }, value: t.status, onChange: e => actions.updateTeamMember(t.id, { status: e.target.value }) },
        TEAM_STATUSES.map(s => React.createElement("option", { key: s.value, value: s.value }, s.label)))
    )
  },
    React.createElement("fieldset", { className: "section" },
      React.createElement("legend", null, "Contact"),
      React.createElement("div", { className: "detail-row" }, React.createElement("span", { className: "k" }, "Phone"), React.createElement("span", { className: "v" }, t.phone)),
      React.createElement("div", { className: "detail-row" }, React.createElement("span", { className: "k" }, "Email"), React.createElement("span", { className: "v" }, t.email))
    ),

    React.createElement("fieldset", { className: "section" },
      React.createElement("legend", null, "Availability"),
      React.createElement("div", { className: "filter-chip-row" },
        DOW.map(d => React.createElement("div", { key: d.k, className: "filter-chip" + (t.workDays.includes(d.k) ? " active" : ""), onClick: () => toggleDay(d.k) }, d.l))
      ),
      React.createElement("div", { className: "field-row" },
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Start"),
          React.createElement("select", { className: "input", value: t.startHour, onChange: e => actions.updateTeamMember(t.id, { startHour: Number(e.target.value) }) },
            Array.from({ length: 14 }, (_, i) => i + 6).map(h => React.createElement("option", { key: h, value: h }, (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? " AM" : " PM"))))),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "End"),
          React.createElement("select", { className: "input", value: t.endHour, onChange: e => actions.updateTeamMember(t.id, { endHour: Number(e.target.value) }) },
            Array.from({ length: 14 }, (_, i) => i + 6).map(h => React.createElement("option", { key: h, value: h }, (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? " AM" : " PM")))))
      )
    ),

    React.createElement("fieldset", { className: "section" },
      React.createElement("legend", null, "Today's schedule"),
      todaysAppts.length === 0 ? React.createElement("p", { className: "faint", style: { fontSize: 12.5, margin: 0 } }, "Nothing scheduled today.") :
      React.createElement("div", { className: "list-plain" },
        todaysAppts.map(a => React.createElement("div", { key: a.id, className: "list-item clickable", onClick: () => onOpenJob(a.jobId) },
          React.createElement("div", { className: "vstack" }, React.createElement("span", { style: { fontWeight: 700, fontSize: 13 } }, a.title), React.createElement("span", { className: "faint", style: { fontSize: 11.5 } }, fmtTime(a.start) + " – " + fmtTime(a.end))),
          React.createElement(StatusPill, { status: findById(db.jobs, a.jobId) ? findById(db.jobs, a.jobId).status : "scheduled", list: JOB_STATUSES })
        ))
      )
    ),

    React.createElement("fieldset", { className: "section" },
      React.createElement("legend", null, "Assigned jobs (" + assignedJobs.length + ")"),
      assignedJobs.length === 0 ? React.createElement("p", { className: "faint", style: { fontSize: 12.5, margin: 0 } }, "No active jobs assigned.") :
      React.createElement("div", { className: "list-plain" },
        assignedJobs.map(j => { const c = findById(db.customers, j.customerId); return React.createElement("div", { key: j.id, className: "list-item" },
          React.createElement("div", { className: "vstack clickable", onClick: () => onOpenJob(j.id) }, React.createElement("span", { style: { fontWeight: 700, fontSize: 13 } }, j.concern), React.createElement("span", { className: "faint", style: { fontSize: 11.5 } }, c ? c.name : "")),
          React.createElement("select", { className: "input", style: { width: 140 }, value: j.technicianId, onChange: e => { actions.updateJob(j.id, { technicianId: e.target.value }); if (j.appointmentId) actions.updateAppointment(j.appointmentId, { technicianId: e.target.value }); ui.toast("Job reassigned."); } },
            React.createElement("option", { value: t.id }, t.name),
            otherTechs.map(o => React.createElement("option", { key: o.id, value: o.id }, o.name)))
        ); })
      )
    ),

    React.createElement("div", { className: "hstack" },
      React.createElement("button", { className: "btn btn-secondary btn-block", onClick: () => setShowEdit(true) }, React.createElement(Icon, { name: "edit", size: 14 }), "Edit details"),
      t.role !== "Owner" && React.createElement("button", { className: "btn btn-danger btn-block", onClick: handleRemove }, React.createElement(Icon, { name: "trash", size: 14 }), "Remove")
    ),

    showEdit && React.createElement(TeamMemberModal, { actions, ui, member: t, onClose: () => setShowEdit(false) })
  );
}

export function TeamPage(props) {
  const { db, actions, ui, onOpenJob } = props;
  const [openMember, setOpenMember] = React.useState(null);
  const [showAdd, setShowAdd] = React.useState(false);
  const today = new Date();

  return React.createElement("div", { className: "section-stack" },
    React.createElement("div", { className: "hstack", style: { justifyContent: "flex-end" } },
      React.createElement("button", { className: "btn btn-primary", onClick: () => setShowAdd(true) }, React.createElement(Icon, { name: "plus", size: 15 }), "Add Team Member")
    ),
    React.createElement("div", { className: "card", style: { padding: 0 } },
      React.createElement("div", { className: "table-wrap", style: { border: "none" } },
        React.createElement("table", { className: "data-table" },
          React.createElement("thead", null, React.createElement("tr", null,
            React.createElement("th", null, "Name"), React.createElement("th", null, "Role"), React.createElement("th", null, "Contact"),
            React.createElement("th", null, "Status"), React.createElement("th", null, "Today"), React.createElement("th", null, "Active Jobs")
          )),
          React.createElement("tbody", null,
            db.team.map(t => {
              const todaysCount = db.appointments.filter(a => a.technicianId === t.id && isSameDay(a.start, today) && a.status !== "cancelled").length;
              const activeCount = db.jobs.filter(j => j.technicianId === t.id && j.status !== "completed" && j.status !== "cancelled").length;
              return React.createElement("tr", { key: t.id, className: "row-click", onClick: () => setOpenMember(t.id) },
                React.createElement("td", null, React.createElement("div", { className: "hstack" }, React.createElement(Avatar, { name: t.name, color: t.color, size: 28 }), React.createElement("span", { style: { fontWeight: 700 } }, t.name))),
                React.createElement("td", null, React.createElement("span", { className: "tag" }, t.role)),
                React.createElement("td", null, React.createElement("div", { className: "vstack" }, React.createElement("span", { style: { fontSize: 12.5 } }, t.phone), React.createElement("span", { className: "cell-sub" }, t.email))),
                React.createElement("td", null, React.createElement(StatusPill, { status: t.status, list: TEAM_STATUSES })),
                React.createElement("td", null, todaysCount + " job" + (todaysCount === 1 ? "" : "s")),
                React.createElement("td", null, activeCount)
              );
            })
          )
        )
      )
    ),
    openMember && React.createElement(TeamMemberDrawer, { db, actions, ui, memberId: openMember, onClose: () => setOpenMember(null), onOpenJob }),
    showAdd && React.createElement(TeamMemberModal, { actions, ui, onClose: () => setShowAdd(false) })
  );
}
