(function () {
  "use strict";

  const app = document.getElementById("app");
  let STATE = null; // full server state
  let TOKEN = null;
  let ROLE = null; // "athlete" | "coach"
  let TAB = "today";
  let SAVING = false;

  const WEEKDAY_TO_ID = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  // ---------- boot ----------
  function boot() {
    const params = new URLSearchParams(location.search);
    let token = params.get("token");
    let role = params.get("role");

    if (token) localStorage.setItem("kicker_token", token);
    if (role) localStorage.setItem("kicker_role", role);

    if (!token) token = localStorage.getItem("kicker_token");
    if (!role) role = localStorage.getItem("kicker_role");

    if (!token) {
      renderSetup();
      return;
    }
    TOKEN = token;
    ROLE = role === "coach" ? "coach" : "athlete";
    loadState();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }

  function randomToken() {
    return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
  }

  // ---------- API ----------
  async function apiGet(token) {
    const res = await fetch(`/api/data?token=${encodeURIComponent(token)}`);
    if (!res.ok) throw new Error("Failed to load");
    return res.json();
  }

  async function apiSave() {
    SAVING = true;
    updateSavingIndicator();
    try {
      await fetch(`/api/data?token=${encodeURIComponent(TOKEN)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(STATE),
      });
    } catch (e) {
      toast("Couldn't save — check connection");
    }
    SAVING = false;
    updateSavingIndicator();
  }

  function updateSavingIndicator() {
    const el = document.getElementById("saving-indicator");
    if (el) el.style.opacity = SAVING ? "1" : "0";
  }

  async function loadState() {
    app.innerHTML = `<div class="setup-screen"><div class="setup-box"><p>Loading plan…</p></div></div>`;
    try {
      STATE = await apiGet(TOKEN);
      render();
    } catch (e) {
      app.innerHTML = `<div class="setup-screen"><div class="setup-box"><h1>Couldn't load</h1><p>Check your connection and reload the page.</p></div></div>`;
    }
  }

  function save(mutator) {
    mutator();
    render();
    apiSave();
  }

  // ---------- setup screen (first run / no token) ----------
  function renderSetup() {
    app.innerHTML = `
      <div class="setup-screen">
        <div class="setup-box">
          <h1>🏈 Kicker Development Plan</h1>
          <p>Track workouts, notes, and progress — and share view/edit access with a coach.</p>
          <button class="btn btn-primary btn-block" id="create-btn">Create a New Plan</button>
          <hr class="divider" />
          <p style="margin-bottom:4px;">Already have a code from someone else?</p>
          <label>Family code</label>
          <input type="text" id="manual-token" placeholder="e.g. ab12cd34" />
          <label>I am the...</label>
          <select id="manual-role">
            <option value="athlete">Athlete</option>
            <option value="coach">Coach</option>
          </select>
          <button class="btn btn-outline btn-block" id="join-btn" style="margin-top:10px;">Continue</button>
        </div>
      </div>
    `;
    document.getElementById("create-btn").addEventListener("click", () => {
      const token = randomToken();
      localStorage.setItem("kicker_token", token);
      localStorage.setItem("kicker_role", "athlete");
      const url = new URL(location.href);
      url.searchParams.set("token", token);
      url.searchParams.set("role", "athlete");
      history.replaceState(null, "", url.toString());
      TOKEN = token;
      ROLE = "athlete";
      loadState().then(() => {
        TAB = "team";
        render();
      });
    });
    document.getElementById("join-btn").addEventListener("click", () => {
      const t = document.getElementById("manual-token").value.trim();
      const r = document.getElementById("manual-role").value;
      if (!t) { toast("Enter a family code"); return; }
      localStorage.setItem("kicker_token", t);
      localStorage.setItem("kicker_role", r);
      const url = new URL(location.href);
      url.searchParams.set("token", t);
      url.searchParams.set("role", r);
      history.replaceState(null, "", url.toString());
      TOKEN = t;
      ROLE = r;
      loadState();
    });
  }

  // ---------- helpers ----------
  function todayId() {
    return WEEKDAY_TO_ID[new Date().getDay()];
  }
  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }
  function findDay(id) {
    return STATE.days.find((d) => d.id === id);
  }
  function toast(msg) {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      t.className = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2200);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function toEmbedUrl(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      if (host === "youtube.com" || host === "m.youtube.com") {
        const id = u.searchParams.get("v");
        if (id) return `https://www.youtube.com/embed/${id}`;
        const shorts = u.pathname.match(/\/shorts\/([\w-]+)/);
        if (shorts) return `https://www.youtube.com/embed/${shorts[1]}`;
      }
      if (host === "youtu.be") {
        const id = u.pathname.slice(1);
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      if (host === "drive.google.com") {
        const m = u.pathname.match(/\/d\/([\w-]+)/);
        if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
      }
    } catch (e) { /* not a valid URL */ }
    return null;
  }

  function videoHtml(url) {
    if (!url) return "";
    const embed = toEmbedUrl(url);
    if (embed) {
      return `<div class="video-wrap"><iframe src="${esc(embed)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    }
    return `<a href="${esc(url)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="display:inline-block;margin-top:6px;">▶ Watch Video</a>`;
  }

  function pendingCount() {
    let n = 0;
    STATE.days.forEach((d) => d.exercises.forEach((e) => { if (e.status !== "approved") n++; }));
    return n;
  }

  // ---------- shell ----------
  function render() {
    const roleLabel = ROLE === "coach" ? "Coach view" : "Athlete view";
    const pc = pendingCount();
    app.innerHTML = `
      <div class="header">
        <h1>🐾 ${esc(STATE.meta.athleteName)}'s Kicking Plan <span class="role-badge">${roleLabel}</span></h1>
        <div class="sub">
          Plano Senior High Wildcats
          <span id="saving-indicator" style="opacity:0; transition:opacity .2s;"> · saving…</span>
        </div>
      </div>
      <div class="wildcat-stripe"></div>
      <div class="content" id="content"></div>
      <div class="tabs">
        ${tabBtn("today", "📋", "Today")}
        ${tabBtn("week", "📅", "Week")}
        ${tabBtn("progress", "📈", "Progress")}
        ${tabBtn("history", "🕓", "History")}
        ${tabBtn("team", "👥", "Team" + (ROLE === "athlete" && pc ? ` <span class="badge-count">${pc}</span>` : ""))}
      </div>
    `;
    document.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        TAB = btn.dataset.tab;
        render();
      });
    });
    const content = document.getElementById("content");
    if (TAB === "today") renderToday(content);
    else if (TAB === "week") renderWeek(content);
    else if (TAB === "progress") renderProgress(content);
    else if (TAB === "history") renderHistory(content);
    else if (TAB === "team") renderTeam(content);
  }

  function tabBtn(id, icon, label) {
    return `<button class="tab ${TAB === id ? "active" : ""}" data-tab="${id}"><span class="icon">${icon}</span>${label}</button>`;
  }

  // ---------- TODAY ----------
  function renderToday(el) {
    const dId = todayId();
    const day = findDay(dId);
    const dateKey = todayKey();
    const log = STATE.logs[dateKey] || { completed: {}, note: "" };

    let exHtml = "";
    if (!day.exercises.length) {
      exHtml = `<div class="empty-state">No exercises listed for today.</div>`;
    } else {
      exHtml = day.exercises
        .filter((e) => e.status !== "proposed-delete" || ROLE === "coach")
        .map((e) => exerciseRow(e, { showCheckbox: ROLE === "athlete", checked: !!log.completed[e.id] }))
        .join("");
    }

    el.innerHTML = `
      <div class="card today-card">
        <span class="focus-tag">Today · ${day.focus}</span>
        <h2>${day.name}</h2>
        ${exHtml}
      </div>
      ${ROLE === "athlete" ? `
      <div class="card">
        <h2>Today's Note</h2>
        <textarea id="today-note" placeholder="How did it feel? Any soreness, tightness, or wins to note?">${esc(log.note || "")}</textarea>
        <button class="btn btn-primary btn-block" id="save-note-btn" style="margin-top:8px;">Save Note</button>
      </div>
      <div class="card">
        <h2>Today's Video (optional)</h2>
        <p style="font-size:12px;color:var(--muted);margin-top:-2px;">Paste a link — an unlisted YouTube video or a Google Drive share link both work.</p>
        <input type="text" id="today-video" placeholder="https://youtu.be/..." value="${esc(log.videoUrl || "")}" />
        <button class="btn btn-outline btn-block" id="save-video-btn" style="margin-top:8px;">Save Video Link</button>
        ${log.videoUrl ? videoHtml(log.videoUrl) : ""}
      </div>` : `
      <div class="card">
        <h2>Athlete's Note Today</h2>
        <p style="font-size:13px; color:var(--muted);">${log.note ? esc(log.note) : "No note logged yet today."}</p>
        ${log.videoUrl ? videoHtml(log.videoUrl) : ""}
      </div>`}
    `;

    if (ROLE === "athlete") {
      el.querySelectorAll(".exercise-check").forEach((cb) => {
        cb.addEventListener("change", () => {
          save(() => {
            const l = STATE.logs[dateKey] || { completed: {}, note: "" };
            l.completed[cb.dataset.exId] = cb.checked;
            l.loggedBy = "athlete";
            l.date = dateKey;
            STATE.logs[dateKey] = l;
          });
        });
      });
      const saveNoteBtn = document.getElementById("save-note-btn");
      if (saveNoteBtn) {
        saveNoteBtn.addEventListener("click", () => {
          save(() => {
            const l = STATE.logs[dateKey] || { completed: {}, note: "" };
            l.note = document.getElementById("today-note").value;
            l.date = dateKey;
            STATE.logs[dateKey] = l;
          });
          toast("Note saved");
        });
      }
      const saveVideoBtn = document.getElementById("save-video-btn");
      if (saveVideoBtn) {
        saveVideoBtn.addEventListener("click", () => {
          const val = document.getElementById("today-video").value.trim();
          save(() => {
            const l = STATE.logs[dateKey] || { completed: {}, note: "" };
            l.videoUrl = val;
            l.date = dateKey;
            STATE.logs[dateKey] = l;
          });
          toast(val ? "Video link saved" : "Video link cleared");
        });
      }
    }
    bindPendingActions(el, dId);
  }

  function exerciseRow(e, opts) {
    opts = opts || {};
    const isPending = e.status && e.status !== "approved";
    const tagText = {
      "proposed-add": "Coach suggests adding",
      "proposed-edit": "Coach suggests a change",
      "proposed-delete": "Coach suggests removing",
    }[e.status];
    let checkboxHtml = "";
    if (opts.showCheckbox && !isPending) {
      checkboxHtml = `<input type="checkbox" class="exercise-check" data-ex-id="${e.id}" ${opts.checked ? "checked" : ""} />`;
    } else {
      checkboxHtml = `<span style="width:22px;flex-shrink:0;"></span>`;
    }
    const strike = e.status === "proposed-delete" ? "text-decoration:line-through;" : "";
    return `
      <div class="exercise ${isPending ? "pending" : ""} ${opts.checked ? "done" : ""}" data-ex-id="${e.id}">
        ${checkboxHtml}
        <div class="exercise-body">
          <div class="exercise-name" style="${strike}">${esc(e.name)} ${isPending ? `<span class="pending-tag">${tagText}</span>` : ""}</div>
          <div class="exercise-meta">${esc(e.sets)}</div>
          ${e.notes ? `<div class="exercise-notes">${esc(e.notes)}</div>` : ""}
          ${isPending ? pendingActionsHtml(e) : ""}
        </div>
      </div>
    `;
  }

  function pendingActionsHtml(e) {
    if (ROLE === "athlete") {
      return `<div class="pending-actions">
        <button class="btn btn-accept btn-sm" data-action="accept" data-ex-id="${e.id}">✓ Accept</button>
        <button class="btn btn-reject btn-sm" data-action="reject" data-ex-id="${e.id}">✗ Reject</button>
      </div>`;
    }
    return `<div class="pending-actions">
      <span style="font-size:12px;color:var(--muted);">Waiting for approval</span>
      <button class="btn btn-outline btn-sm" data-action="withdraw" data-ex-id="${e.id}">Withdraw</button>
    </div>`;
  }

  function bindPendingActions(el, dayId) {
    el.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        const exId = btn.dataset.exId;
        resolvePending(dayId, exId, action);
      });
    });
  }

  function resolvePending(dayId, exId, action) {
    save(() => {
      const day = findDay(dayId);
      const idx = day.exercises.findIndex((x) => x.id === exId);
      if (idx === -1) return;
      const e = day.exercises[idx];
      if (action === "accept") {
        if (e.status === "proposed-delete") {
          day.exercises.splice(idx, 1);
        } else {
          e.status = "approved";
          e.proposed = null;
        }
      } else if (action === "reject" || action === "withdraw") {
        if (e.status === "proposed-add") {
          day.exercises.splice(idx, 1);
        } else if (e.status === "proposed-edit" && e.proposed && e.proposed.previous) {
          Object.assign(e, e.proposed.previous);
          e.status = "approved";
          e.proposed = null;
        } else if (e.status === "proposed-delete") {
          e.status = "approved";
          e.proposed = null;
        }
      }
    });
    toast(action === "accept" ? "Change accepted" : action === "withdraw" ? "Suggestion withdrawn" : "Change rejected");
  }

  // ---------- WEEK (full plan, editable) ----------
  let EDIT_MODE = false;
  let ADD_FORM_OPEN = null; // day id currently showing add-exercise form
  let EDIT_FORM_OPEN = null; // exercise id currently being edited

  function renderWeek(el) {
    const editBtnLabel = EDIT_MODE ? "Done Editing" : (ROLE === "coach" ? "Suggest Changes" : "Edit Plan");
    let html = `
      <div class="card">
        <div class="day-header-row">
          <h2 style="margin:0;">Full Weekly Plan</h2>
          <button class="edit-toggle" id="toggle-edit">${editBtnLabel}</button>
        </div>
        ${ROLE === "coach" && EDIT_MODE ? `<p style="font-size:12px;color:var(--muted);margin:6px 0 0;">Your changes will show up as suggestions until ${esc(STATE.meta.athleteName)} accepts them.</p>` : ""}
      </div>
    `;

    STATE.days.forEach((day) => {
      html += `<div class="card" data-day="${day.id}">
        <span class="focus-tag">${day.id === todayId() ? "TODAY · " : ""}${esc(day.focus)}</span>
        <h2>${esc(day.name)}</h2>
        <div class="exercise-list">
          ${day.exercises.map((e) => EDIT_MODE ? editableExerciseRow(day.id, e) : exerciseRow(e, {})).join("") || `<div class="empty-state">No exercises.</div>`}
        </div>
        ${EDIT_MODE ? (ADD_FORM_OPEN === day.id ? addExerciseForm(day.id) : `<button class="btn btn-outline btn-block" data-add-day="${day.id}" style="margin-top:8px;">+ Add Exercise</button>`) : ""}
      </div>`;
    });

    el.innerHTML = html;

    document.getElementById("toggle-edit").addEventListener("click", () => {
      EDIT_MODE = !EDIT_MODE;
      ADD_FORM_OPEN = null;
      EDIT_FORM_OPEN = null;
      render();
    });

    el.querySelectorAll("[data-add-day]").forEach((btn) => {
      btn.addEventListener("click", () => {
        ADD_FORM_OPEN = btn.dataset.addDay;
        render();
      });
    });

    bindEditableExerciseHandlers(el);
    bindPendingActions(el, null); // day resolved via closest lookup below
    // override bindPendingActions to find correct day per-button since week view has multiple days
    el.querySelectorAll("[data-action]").forEach((btn) => {
      btn.onclick = () => {
        const dayEl = btn.closest("[data-day]");
        resolvePending(dayEl.dataset.day, btn.dataset.exId, btn.dataset.action);
      };
    });

    const addForm = el.querySelector(".add-exercise-form");
    if (addForm) bindAddForm(addForm);
  }

  function editableExerciseRow(dayId, e) {
    if (EDIT_FORM_OPEN === e.id) {
      return editExerciseForm(dayId, e);
    }
    const isPending = e.status && e.status !== "approved";
    const tagText = {
      "proposed-add": "Suggested add",
      "proposed-edit": "Suggested change",
      "proposed-delete": "Suggested removal",
    }[e.status];
    return `
      <div class="exercise ${isPending ? "pending" : ""}" data-ex-id="${e.id}">
        <div class="exercise-body">
          <div class="exercise-name">${esc(e.name)} ${isPending ? `<span class="pending-tag">${tagText}</span>` : ""}</div>
          <div class="exercise-meta">${esc(e.sets)}</div>
          ${e.notes ? `<div class="exercise-notes">${esc(e.notes)}</div>` : ""}
          ${isPending ? pendingActionsHtml(e) : `
          <div class="pending-actions">
            <button class="btn btn-outline btn-sm" data-edit-ex="${e.id}">Edit</button>
            <button class="btn btn-outline danger btn-sm" data-delete-ex="${e.id}">Delete</button>
          </div>`}
        </div>
      </div>
    `;
  }

  function editExerciseForm(dayId, e) {
    return `
      <div class="edit-exercise-form" data-day="${dayId}" data-ex-id="${e.id}">
        <label>Exercise name</label>
        <input type="text" class="f-name" value="${esc(e.name)}" />
        <div class="field-row">
          <div>
            <label>Sets / Reps</label>
            <input type="text" class="f-sets" value="${esc(e.sets)}" />
          </div>
        </div>
        <label>Notes</label>
        <textarea class="f-notes">${esc(e.notes || "")}</textarea>
        <div class="pending-actions">
          <button class="btn btn-primary btn-sm" data-save-edit="${e.id}">Save</button>
          <button class="btn btn-outline btn-sm" data-cancel-edit="${e.id}">Cancel</button>
        </div>
      </div>
    `;
  }

  function addExerciseForm(dayId) {
    return `
      <div class="add-exercise-form" data-day="${dayId}">
        <label>Exercise name</label>
        <input type="text" class="f-name" placeholder="e.g. Lateral band walks" />
        <label>Sets / Reps</label>
        <input type="text" class="f-sets" placeholder="e.g. 3 x 10 each side" />
        <label>Notes (optional)</label>
        <textarea class="f-notes" placeholder="Why this exercise / coaching cue"></textarea>
        <div class="pending-actions">
          <button class="btn btn-primary btn-sm" data-save-add="${dayId}">Add</button>
          <button class="btn btn-outline btn-sm" data-cancel-add="${dayId}">Cancel</button>
        </div>
      </div>
    `;
  }

  function bindAddForm(formEl) {
    const dayId = formEl.dataset.day;
    formEl.querySelector("[data-save-add]").addEventListener("click", () => {
      const name = formEl.querySelector(".f-name").value.trim();
      const sets = formEl.querySelector(".f-sets").value.trim();
      const notes = formEl.querySelector(".f-notes").value.trim();
      if (!name) { toast("Enter an exercise name"); return; }
      save(() => {
        const day = findDay(dayId);
        day.exercises.push({
          id: Math.random().toString(36).slice(2, 10),
          name, sets, notes,
          status: ROLE === "coach" ? "proposed-add" : "approved",
          proposed: null,
        });
      });
      ADD_FORM_OPEN = null;
      render();
      toast(ROLE === "coach" ? "Suggestion sent" : "Exercise added");
    });
    formEl.querySelector("[data-cancel-add]").addEventListener("click", () => {
      ADD_FORM_OPEN = null;
      render();
    });
  }

  function bindEditableExerciseHandlers(el) {
    el.querySelectorAll("[data-edit-ex]").forEach((btn) => {
      btn.addEventListener("click", () => {
        EDIT_FORM_OPEN = btn.dataset.editEx;
        render();
      });
    });
    el.querySelectorAll("[data-delete-ex]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const dayEl = btn.closest("[data-day]");
        const dayId = dayEl.dataset.day;
        const exId = btn.dataset.deleteEx;
        save(() => {
          const day = findDay(dayId);
          const idx = day.exercises.findIndex((x) => x.id === exId);
          if (idx === -1) return;
          if (ROLE === "coach") {
            day.exercises[idx].status = "proposed-delete";
          } else {
            day.exercises.splice(idx, 1);
          }
        });
        toast(ROLE === "coach" ? "Suggestion sent" : "Exercise removed");
      });
    });
    el.querySelectorAll("[data-save-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const formEl = btn.closest(".edit-exercise-form");
        const dayId = formEl.dataset.day;
        const exId = formEl.dataset.exId;
        const name = formEl.querySelector(".f-name").value.trim();
        const sets = formEl.querySelector(".f-sets").value.trim();
        const notes = formEl.querySelector(".f-notes").value.trim();
        save(() => {
          const day = findDay(dayId);
          const e = day.exercises.find((x) => x.id === exId);
          if (!e) return;
          if (ROLE === "coach") {
            const previous = { name: e.name, sets: e.sets, notes: e.notes };
            e.status = "proposed-edit";
            e.proposed = { previous };
            e.name = name; e.sets = sets; e.notes = notes;
          } else {
            e.name = name; e.sets = sets; e.notes = notes;
          }
        });
        EDIT_FORM_OPEN = null;
        render();
        toast(ROLE === "coach" ? "Suggestion sent" : "Saved");
      });
    });
    el.querySelectorAll("[data-cancel-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        EDIT_FORM_OPEN = null;
        render();
      });
    });
  }

  // ---------- PROGRESS ----------
  function renderProgress(el) {
    const weeks = last8WeeksCompletion();
    const streak = currentStreak();
    const kickLog = (STATE.kickLog || []).slice().sort((a, b) => a.date.localeCompare(b.date));

    el.innerHTML = `
      <div class="stat-row">
        <div class="stat-box"><div class="stat-num">${streak}</div><div class="stat-label">Day Streak</div></div>
        <div class="stat-box"><div class="stat-num">${weeks[weeks.length - 1]?.pct ?? 0}%</div><div class="stat-label">This Week</div></div>
        <div class="stat-box"><div class="stat-num">${kickLog.length}</div><div class="stat-label">Kicks Logged</div></div>
      </div>
      <div class="card">
        <h2>Weekly Completion (last 8 weeks)</h2>
        <canvas id="bar-chart" width="600" height="180"></canvas>
      </div>
      <div class="card">
        <h2>Kick Distance Log</h2>
        ${kickLog.length > 1 ? `<canvas id="line-chart" width="600" height="180"></canvas>` : `<p style="font-size:13px;color:var(--muted);">Log a few kicks to see the trend line.</p>`}
        ${ROLE === "athlete" ? `
        <div class="field-row" style="margin-top:10px;">
          <div>
            <label>Date</label>
            <input type="date" id="kick-date" value="${todayKey()}" />
          </div>
          <div>
            <label>Type</label>
            <select id="kick-type">
              <option>Field Goal</option>
              <option>Kickoff</option>
              <option>Punt</option>
            </select>
          </div>
        </div>
        <div class="field-row">
          <div>
            <label>Distance (yards)</label>
            <input type="number" id="kick-distance" placeholder="e.g. 42" />
          </div>
        </div>
        <label>Note (optional)</label>
        <input type="text" id="kick-note" placeholder="Wind, surface, how it felt..." />
        <button class="btn btn-primary btn-block" id="add-kick-btn" style="margin-top:8px;">Log Kick</button>
        ` : ""}
      </div>
      ${kickLog.length ? `<div class="card"><h2>Recent Kicks</h2>${kickLog.slice(-8).reverse().map((k) => `
        <div class="history-item">
          <div class="history-date">${k.date} — ${esc(k.type)}</div>
          <div class="history-progress">${k.distance} yards${k.note ? " · " + esc(k.note) : ""}</div>
        </div>`).join("")}</div>` : ""}
    `;

    drawBarChart(document.getElementById("bar-chart"), weeks);
    if (kickLog.length > 1) drawLineChart(document.getElementById("line-chart"), kickLog);

    const addKickBtn = document.getElementById("add-kick-btn");
    if (addKickBtn) {
      addKickBtn.addEventListener("click", () => {
        const date = document.getElementById("kick-date").value || todayKey();
        const type = document.getElementById("kick-type").value;
        const distance = parseFloat(document.getElementById("kick-distance").value);
        const note = document.getElementById("kick-note").value.trim();
        if (!distance || distance <= 0) { toast("Enter a distance"); return; }
        save(() => {
          STATE.kickLog = STATE.kickLog || [];
          STATE.kickLog.push({ date, type, distance, note });
        });
        toast("Kick logged");
      });
    }
  }

  function last8WeeksCompletion() {
    const result = [];
    const now = new Date();
    for (let w = 7; w >= 0; w--) {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() - w * 7); // start of that week (Sunday)
      let total = 0, done = 0;
      for (let d = 0; d < 7; d++) {
        const day = new Date(start);
        day.setDate(start.getDate() + d);
        const key = day.toISOString().slice(0, 10);
        const dayPlan = findDay(WEEKDAY_TO_ID[day.getDay()]);
        const log = STATE.logs[key];
        if (dayPlan && dayPlan.exercises.length) {
          dayPlan.exercises.forEach((e) => {
            if (e.status === "approved") {
              total++;
              if (log && log.completed && log.completed[e.id]) done++;
            }
          });
        }
      }
      result.push({ label: `W${8 - w}`, pct: total ? Math.round((done / total) * 100) : 0 });
    }
    return result;
  }

  function currentStreak() {
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const log = STATE.logs[key];
      const hasAny = log && log.completed && Object.values(log.completed).some(Boolean);
      if (hasAny) streak++;
      else if (i === 0) continue; // today might not be logged yet, don't break streak
      else break;
    }
    return streak;
  }

  function drawBarChart(canvas, weeks) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const padding = 24;
    const chartH = h - padding - 20;
    const barW = (w - padding * 2) / weeks.length - 8;
    ctx.strokeStyle = "#E2E5EA";
    ctx.beginPath();
    ctx.moveTo(padding, h - 20);
    ctx.lineTo(w - 8, h - 20);
    ctx.stroke();
    weeks.forEach((wk, i) => {
      const x = padding + i * ((w - padding * 2) / weeks.length) + 4;
      const barH = (wk.pct / 100) * chartH;
      ctx.fillStyle = "#1F3864";
      ctx.fillRect(x, h - 20 - barH, barW, barH);
      ctx.fillStyle = "#6B7280";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(wk.label, x + barW / 2, h - 6);
      if (wk.pct > 0) {
        ctx.fillStyle = "#1A1D23";
        ctx.fillText(wk.pct + "%", x + barW / 2, h - 24 - barH < 10 ? 10 : h - 24 - barH);
      }
    });
  }

  function drawLineChart(canvas, kickLog) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const padding = 30;
    const distances = kickLog.map((k) => k.distance);
    const min = Math.min(...distances) - 3;
    const max = Math.max(...distances) + 3;
    const range = max - min || 1;
    const stepX = (w - padding * 2) / (kickLog.length - 1 || 1);

    ctx.strokeStyle = "#E2E5EA";
    ctx.beginPath();
    ctx.moveTo(padding, 10);
    ctx.lineTo(padding, h - 20);
    ctx.lineTo(w - 8, h - 20);
    ctx.stroke();

    ctx.strokeStyle = "#B8860B";
    ctx.lineWidth = 2;
    ctx.beginPath();
    kickLog.forEach((k, i) => {
      const x = padding + i * stepX;
      const y = 10 + (1 - (k.distance - min) / range) * (h - 30);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = "#1F3864";
    kickLog.forEach((k, i) => {
      const x = padding + i * stepX;
      const y = 10 + (1 - (k.distance - min) / range) * (h - 30);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#6B7280";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(Math.round(max) + "y", 2, 14);
    ctx.fillText(Math.round(min) + "y", 2, h - 22);
  }

  // ---------- HISTORY ----------
  function renderHistory(el) {
    const entries = Object.values(STATE.logs || {}).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (!entries.length) {
      el.innerHTML = `<div class="card"><div class="empty-state">No workouts logged yet.</div></div>`;
      return;
    }
    el.innerHTML = `<div class="card">
      <h2>Workout History</h2>
      ${entries.map((log) => {
        const dayPlan = findDay(WEEKDAY_TO_ID[new Date(log.date + "T12:00:00").getDay()]);
        const totalEx = dayPlan ? dayPlan.exercises.filter((e) => e.status === "approved").length : 0;
        const doneCount = Object.values(log.completed || {}).filter(Boolean).length;
        return `<div class="history-item">
          <div class="history-date">${log.date}</div>
          <div class="history-progress">${doneCount}/${totalEx} exercises completed</div>
          ${log.note ? `<div class="history-note">"${esc(log.note)}"</div>` : ""}
          ${log.videoUrl ? videoHtml(log.videoUrl) : ""}
        </div>`;
      }).join("")}
    </div>`;
  }

  // ---------- TEAM / SETTINGS ----------
  function renderTeam(el) {
    const athleteUrl = shareUrl("athlete");
    const coachUrl = shareUrl("coach");
    el.innerHTML = `
      <div class="card">
        <h2>Athlete's Name</h2>
        <input type="text" id="athlete-name" value="${esc(STATE.meta.athleteName)}" />
        <button class="btn btn-primary btn-block" id="save-name-btn" style="margin-top:8px;">Save</button>
      </div>
      <div class="card">
        <h2>Share Access</h2>
        <p style="font-size:13px;color:var(--muted);">Open each link on the right device, then use "Add to Home Screen" so it installs like an app.</p>
        <span class="link-label">Athlete link (full edit + accept suggestions)</span>
        <div class="link-box">${esc(athleteUrl)}</div>
        <button class="btn btn-outline btn-sm" data-copy="${esc(athleteUrl)}">Copy Link</button>
        <span class="link-label">Coach link (can suggest changes, can't edit tracking)</span>
        <div class="link-box">${esc(coachUrl)}</div>
        <button class="btn btn-outline btn-sm" data-copy="${esc(coachUrl)}">Copy Link</button>
      </div>
      <div class="card">
        <h2>Pending Suggestions</h2>
        ${pendingCount() ? `<p style="font-size:13px;">Check the <strong>Week</strong> tab — items awaiting approval are highlighted in gold.</p>` : `<p style="font-size:13px;color:var(--muted);">No pending suggestions right now.</p>`}
      </div>
      <div class="card">
        <h2>About Video Links</h2>
        <p style="font-size:12px;color:var(--muted);">On the Today tab, paste a link to an unlisted YouTube video or a Google Drive video (set sharing to "Anyone with the link") and it'll play right in the app. Direct video uploads aren't supported — hosting platforms handle large video files far better than this app can.</p>
      </div>
      <div class="card">
        <h2>About this app</h2>
        <p style="font-size:12px;color:var(--muted);">Anyone with a link above can view and act on this plan — there's no password, so only share these links with your son and his coach. Data is stored under this family's private code (${esc(TOKEN)}), so other users of this app can't see it.</p>
      </div>
    `;
    document.getElementById("save-name-btn").addEventListener("click", () => {
      save(() => {
        STATE.meta.athleteName = document.getElementById("athlete-name").value.trim() || "Athlete";
      });
      toast("Saved");
    });
    el.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.copy);
          toast("Link copied");
        } catch {
          toast("Couldn't copy — long-press the link box to copy");
        }
      });
    });
  }

  function shareUrl(role) {
    const url = new URL(location.origin + location.pathname);
    url.searchParams.set("token", TOKEN);
    url.searchParams.set("role", role);
    return url.toString();
  }

  boot();
})();
