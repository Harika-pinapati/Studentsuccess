
"use strict";

/* =========================
   SHARED STATE AND HELPERS
========================= */

const $ = (selector) => document.querySelector(selector);

const state = {
  user: null,
  token: localStorage.getItem("edusuccess_token"),
  students: [],
  activeView: "dashboard",
  role: "student"
};

const today = new Date().toISOString().slice(0, 10);

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, { ...options, headers });
  const type = response.headers.get("content-type") || "";
  const data = type.includes("application/json")
    ? await response.json()
    : await response.text();

  if (response.status === 401 && state.token) {
    signOut(false);
    throw new Error(
      typeof data === "object" ? data.detail || "Please sign in again" : "Please sign in again"
    );
  }

  if (!response.ok) {
    throw new Error(
      typeof data === "object" ? data.detail || "Something went wrong" : data
    );
  }

  return data;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
}

function showNotice(message, error = false) {
  const element = $("#notice");
  if (!element) {
    console[error ? "error" : "log"](message);
    return;
  }

  element.textContent = message;
  element.classList.toggle("error", error);
  element.classList.remove("hidden");

  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => {
    element.classList.add("hidden");
  }, 4500);
}

function riskClass(level) {
  return String(level || "Moderate").toLowerCase();
}

function riskBadge(level) {
  return `<span class="level ${esc(riskClass(level))}">${esc(level || "Moderate")} support</span>`;
}

function showLogin() {
  $("#login-screen")?.classList.remove("hidden");
  $("#app-shell")?.classList.add("hidden");
}

function showApp() {
  $("#login-screen")?.classList.add("hidden");
  $("#app-shell")?.classList.remove("hidden");
}

/* =========================
   LOGIN AND ROLE HANDLING
========================= */

function setRole(role) {
  state.role = role;

  const roleInput = $("#login-form [name=role]");
  if (roleInput) roleInput.value = role;

  document.querySelectorAll(".role-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.role === role);
  });

  const usernameLabel = $("#username-label");
  const usernameInput = $("#login-username");
  const passwordInput = $("#login-password");
  const errorBox = $("#login-error");

  if (usernameLabel) {
    usernameLabel.textContent =
      role === "student" ? "Student ID" : "Teacher email";
  }

  if (usernameInput) {
    usernameInput.placeholder =
      role === "student" ? "e.g. ES001" : "teacher@edusuccess.local";
    usernameInput.value = "";
  }

  if (passwordInput) passwordInput.value = "";
  errorBox?.classList.add("hidden");
}

function applyRoleUI() {
  if (!state.user) return;

  const isTeacher = state.user.role === "teacher";

  document.querySelectorAll(".teacher-only").forEach((element) => {
    element.classList.toggle("hidden", !isTeacher);
  });

  document.querySelectorAll(".student-only").forEach((element) => {
    element.classList.toggle("hidden", isTeacher);
  });

  $("#download-report")?.classList.remove("hidden");

  const displayName =
    state.user.name || state.user.username || state.user.student_code || "Student";

  if ($("#sidebar-name")) {
    $("#sidebar-name").textContent = isTeacher
      ? "Teacher workspace"
      : displayName;
  }

  if ($("#sidebar-role")) {
    $("#sidebar-role").textContent = isTeacher
      ? "Faculty account"
      : "Student account";
  }

  if ($("#sidebar-avatar")) {
    $("#sidebar-avatar").textContent = initials(
      isTeacher ? "Teacher" : displayName
    );
  }

  if ($("#welcome-title")) {
    $("#welcome-title").textContent = isTeacher
      ? "Small insights. Meaningful student progress."
      : `Welcome back, ${displayName.split(" ")[0]}.`;
  }

  if ($("#welcome-copy")) {
    $("#welcome-copy").textContent = isTeacher
      ? "A clearer view of academic engagement, performance and the support students may need."
      : "Your progress, attendance and next steps — all in one place.";
  }

  if ($("#welcome-eyebrow")) {
    $("#welcome-eyebrow").textContent = isTeacher
      ? "FACULTY OVERVIEW"
      : "YOUR LEARNING JOURNEY";
  }

  const labels = {
    "metric-one-label": isTeacher ? "Total students" : "Your student profile",
    "metric-one-foot": isTeacher ? "Learners in your workspace" : "Your personal learning record",
    "risk-metric-label": isTeacher ? "Need a check-in" : "Your support indicator",
    "risk-metric-foot": isTeacher ? "Students to review with care" : "A prompt for reflection, not a label",
    "performance-title": isTeacher ? "Department performance" : "Your academic snapshot",
    "performance-subtitle": isTeacher ? "Average marks across departments" : "Your current learning indicators",
    "recent-title": isTeacher ? "Recently added students" : "Your student summary",
    "recent-subtitle": isTeacher ? "A quick look at your learning community" : "Your latest progress indicators",
    "top-eyebrow": isTeacher ? "FACULTY SUCCESS CENTER" : "STUDENT SUCCESS CENTER"
  };

  Object.entries(labels).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });
}

async function signIn(event) {
  event.preventDefault();

  const username = $("#login-username")?.value.trim();
  const password = $("#login-password")?.value;
  const role = $("#login-form [name=role]")?.value || state.role;
  const errorBox = $("#login-error");

  errorBox?.classList.add("hidden");

  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password, role })
    });

    state.token = data.access_token || data.token;
    state.user = data.user || data;

    if (!state.token) {
      throw new Error("The login response did not include an access token.");
    }

    localStorage.setItem("edusuccess_token", state.token);
    applyRoleUI();
    showApp();
    switchView("dashboard");
  } catch (error) {
    if (errorBox) {
      errorBox.textContent = error.message;
      errorBox.classList.remove("hidden");
    } else {
      showNotice(error.message, true);
    }
  }
}

function signOut(showMessage = true) {
  state.token = null;
  state.user = null;
  localStorage.removeItem("edusuccess_token");
  showLogin();

  if ($("#login-form")) $("#login-form").reset();
  setRole("student");

  if (showMessage) showNotice("You have signed out.");
}

/* =========================
   NAVIGATION
========================= */

function switchView(view) {
  if (!state.user) return;
  if (view === "students" && state.user.role !== "teacher") return;
  if (view === "insights" && state.user.role !== "teacher") return;
  if (view === "skills" && state.user.role !== "student") return;

  const target = $(`#${view}-view`);
  if (!target) {
    showNotice(`The ${view} page was not found.`, true);
    return;
  }

  state.activeView = view;

  document.querySelectorAll(".view").forEach((element) => {
    element.classList.add("hidden");
  });

  target.classList.remove("hidden");

  document.querySelectorAll(".nav-item").forEach((element) => {
    element.classList.toggle("active", element.dataset.view === view);
  });

  const titles = {
    dashboard: "Overview",
    students: "Students",
    attendance: "Attendance",
    results: "Results",
    assignments: "Assignments",
    insights: "AI insights",
    skills: "Skill development"
  };

  const subtitles = {
    dashboard: "A clear view of progress, engagement and next steps.",
    students: "Manage profiles and review learning indicators.",
    attendance: "Track participation and build consistent habits.",
    results: "Keep academic outcomes clear and accessible.",
    assignments: "Stay aligned on briefs, deadlines and submissions.",
    insights: "Explainable indicators to support human review.",
    skills: "Build technical, communication and career skills."
  };

  if ($("#page-title")) $("#page-title").textContent = titles[view] || view;
  if ($("#page-subtitle")) $("#page-subtitle").textContent = subtitles[view] || "";

  const loaders = {
    dashboard: loadDashboard,
    students: () => loadStudents($("#search")?.value || ""),
    attendance: loadAttendance,
    results: loadResults,
    assignments: loadAssignments,
    insights: loadInsights,
    skills: loadSkills
  };

  if (loaders[view]) {
    Promise.resolve(loaders[view]()).catch((error) => {
      showNotice(error.message, true);
    });
  }
}

/* =========================
   DASHBOARD
========================= */

async function loadDashboard() {
  const data = await api("/api/dashboard");

  if ($("#total-students")) {
    $("#total-students").textContent =
      state.user.role === "student"
        ? (state.user.student_code || state.user.username || "—")
        : (data.total_students ?? "—");
  }

  if ($("#average-marks")) $("#average-marks").textContent = data.average_marks ?? "—";
  if ($("#average-attendance")) $("#average-attendance").textContent = data.average_attendance ?? "—";
  if ($("#support-flags")) $("#support-flags").textContent = data.support_flags ?? "—";

  if (state.user.role === "student") {
    if ($("#department-chart")) {
      $("#department-chart").innerHTML = `
        <div class="personal-progress">
          <div class="progress-line">
            <div><span>Attendance</span><strong>${esc(data.average_attendance ?? 0)}%</strong></div>
            <div class="progress-track"><i style="width:${Math.max(0, Math.min(100, Number(data.average_attendance) || 0))}%"></i></div>
          </div>
          <div class="progress-line">
            <div><span>Academic marks</span><strong>${esc(data.average_marks ?? 0)}%</strong></div>
            <div class="progress-track blue-track"><i style="width:${Math.max(0, Math.min(100, Number(data.average_marks) || 0))}%"></i></div>
          </div>
        </div>`;
    }

    const student = data.student;
    if ($("#recent-head")) {
      $("#recent-head").innerHTML =
        "<tr><th>STUDENT</th><th>DEPARTMENT</th><th>ATTENDANCE</th><th>MARKS</th><th>SUPPORT</th><th></th></tr>";
    }

    if (!student) {
      if ($("#recent-table")) {
        $("#recent-table").innerHTML =
          "<tr><td colspan='6'>No student profile found.</td></tr>";
      }
      return;
    }

    const prediction = await getRisk(student);
    if ($("#recent-table")) {
      $("#recent-table").innerHTML = `
        <tr>
          <td><div class="person-cell"><div class="avatar">${initials(student.name)}</div><div><strong>${esc(student.name)}</strong><small>${esc(student.student_code)}</small></div></div></td>
          <td>${esc(student.department)}</td>
          <td>${esc(student.attendance)}%</td>
          <td>${esc(student.marks)}/100</td>
          <td>${riskBadge(prediction.risk_category)}</td>
          <td><button class="text-button" data-detail="${esc(student.id)}">Review</button></td>
        </tr>`;
    }
    return;
  }

  if ($("#department-chart")) {
    $("#department-chart").innerHTML =
      (data.departments || []).map((department) => `
        <div class="bar-row">
          <span>${esc(department.department)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, Number(department.average_marks) || 0))}%"></div></div>
          <span class="bar-value">${esc(department.average_marks)}</span>
        </div>
      `).join("") || "<p>No department data available.</p>";
  }

  const recent = data.recent_students || [];
  if ($("#recent-head")) {
    $("#recent-head").innerHTML =
      "<tr><th>STUDENT</th><th>DEPARTMENT</th><th>ATTENDANCE</th><th>MARKS</th><th>SUPPORT</th><th></th></tr>";
  }

  const rows = await Promise.all(recent.map(async (student) => ({
    ...student,
    prediction: await getRisk(student)
  })));

  if ($("#recent-table")) {
    $("#recent-table").innerHTML = rows.map((student) => `
      <tr>
        <td><div class="person-cell"><div class="avatar">${initials(student.name)}</div><div><strong>${esc(student.name)}</strong><small>${esc(student.student_code)}</small></div></div></td>
        <td>${esc(student.department)}</td>
        <td>${esc(student.attendance)}%</td>
        <td>${esc(student.marks)}/100</td>
        <td>${riskBadge(student.prediction.risk_category)}</td>
        <td><button class="text-button" data-detail="${esc(student.id)}">Review</button></td>
      </tr>
    `).join("") || "<tr><td colspan='6'>No student records.</td></tr>";
  }
}

async function getRisk(student) {
  try {
    return await api(`/api/students/${encodeURIComponent(student.id)}/prediction`);
  } catch {
    return {
      risk_category: "Moderate",
      risk_probability: 0,
      factors: [],
      recommended_actions: []
    };
  }
}

/* =========================
   STUDENTS
========================= */

async function loadStudents(search = "") {
  const students = await api(`/api/students?search=${encodeURIComponent(search)}`);
  state.students = Array.isArray(students) ? students : [];

  const rows = await Promise.all(state.students.map(async (student) => ({
    ...student,
    prediction: await getRisk(student)
  })));

  if ($("#student-count")) {
    $("#student-count").textContent =
      `${rows.length} record${rows.length === 1 ? "" : "s"}`;
  }

  if ($("#students-table")) {
    $("#students-table").innerHTML = rows.map((student) => `
      <tr>
        <td><div class="person-cell"><div class="avatar">${initials(student.name)}</div><div><strong>${esc(student.name)}</strong><small>${esc(student.student_code)}</small></div></div></td>
        <td>${esc(student.department)} · Year ${esc(student.year)}</td>
        <td>${esc(student.attendance)}%</td>
        <td>${esc(student.marks)}/100</td>
        <td>${esc(student.assignments)}%</td>
        <td>${riskBadge(student.prediction.risk_category)}</td>
        <td><button class="text-button" data-detail="${esc(student.id)}">Analyze</button></td>
      </tr>
    `).join("") || "<tr><td colspan='7'>No matching records.</td></tr>";
  }

  fillStudentOptions();
}

function fillStudentOptions() {
  const selects = document.querySelectorAll(
    "select[name='student_id'], #student-select, #attendance-student, #result-student, #assignment-student"
  );

  selects.forEach((select) => {
    const previousValue = select.value;
    const firstOption = select.querySelector("option");
    const placeholder = firstOption?.value === "" ? firstOption.textContent : "Select student";

    select.innerHTML = `<option value="">${esc(placeholder)}</option>`;

    state.students.forEach((student) => {
      const option = document.createElement("option");
      option.value = student.id;
      option.textContent = `${student.name} (${student.student_code})`;
      select.appendChild(option);
    });

    if ([...select.options].some((option) => option.value === previousValue)) {
      select.value = previousValue;
    }
  });
}

/* =========================
   ATTENDANCE
========================= */

async function loadAttendance() {
  const rows = await api("/api/attendance");
  const list = Array.isArray(rows) ? rows : [];

  if ($("#attendance-total")) $("#attendance-total").textContent = list.length;
  if ($("#attendance-present")) {
    $("#attendance-present").textContent =
      list.filter((row) => row.status !== "absent").length;
  }
  if ($("#attendance-absent")) {
    $("#attendance-absent").textContent =
      list.filter((row) => row.status === "absent").length;
  }

  if ($("#attendance-table")) {
    $("#attendance-table").innerHTML = list.map((row) => `
      <tr>
        <td><div class="person-cell"><div class="avatar">${initials(row.name)}</div><div><strong>${esc(row.name)}</strong><small>${esc(row.student_code)}</small></div></div></td>
        <td>${esc(row.subject)}</td>
        <td>${esc(row.attendance_date)}</td>
        <td><span class="status-pill ${esc(row.status)}">${esc(row.status)}</span></td>
      </tr>
    `).join("") || "<tr><td colspan='4'>No attendance records yet.</td></tr>";
  }
}

/* =========================
   RESULTS
========================= */

async function loadResults() {
  const rows = await api("/api/results");
  const list = Array.isArray(rows) ? rows : [];

  if ($("#results-table")) {
    $("#results-table").innerHTML = list.map((row) => {
      const maxMarks = Number(row.max_marks) || 0;
      const percentage = maxMarks
        ? Math.round(Number(row.marks_obtained) / maxMarks * 100)
        : 0;

      return `
        <tr>
          <td><div class="person-cell"><div class="avatar">${initials(row.name)}</div><div><strong>${esc(row.name)}</strong><small>${esc(row.student_code)}</small></div></div></td>
          <td>${esc(row.subject)}</td>
          <td>${esc(row.exam_name)}</td>
          <td><strong>${esc(row.marks_obtained)}/${esc(row.max_marks)}</strong></td>
          <td><span class="score-pill">${percentage}%</span></td>
          <td>${esc(String(row.published_at || "").slice(0, 10))}</td>
        </tr>`;
    }).join("") || "<tr><td colspan='6'>No results published yet.</td></tr>";
  }
}

/* =========================
   ASSIGNMENTS
========================= */

async function loadAssignments() {
  const rows = await api("/api/assignments");
  const list = Array.isArray(rows) ? rows : [];

  if ($("#assignment-grid")) {
    $("#assignment-grid").innerHTML = list.map((assignment) => {
      const overdue = assignment.due_date && assignment.due_date < today;

      return `
        <article class="assignment-card">
          <div class="assignment-card-top">
            <span class="assignment-icon">▧</span>
            <span class="due-chip ${overdue ? "overdue" : ""}">
              ${overdue ? "Past due" : "Due " + esc(assignment.due_date || "Not set")}
            </span>
          </div>
          <div class="assignment-subject">${esc(assignment.subject)}</div>
          <h3>${esc(assignment.title)}</h3>
          <p>${esc(assignment.description || "No additional instructions provided.")}</p>
          ${state.user.role === "student"
          ? `<div class="submission-status ${assignment.submitted_at ? "submitted" : ""}">${assignment.submitted_at ? "✓ Submitted" : "Awaiting submission"}</div>
               <button class="btn btn-primary submit-assignment" data-assignment="${esc(assignment.id)}" data-title="${esc(assignment.title)}">${assignment.submitted_at ? "Update submission" : "Submit work"}</button>`
          : `<div class="assignment-meta">Created by ${esc(assignment.teacher_username || "faculty")}</div>`
        }
        </article>`;
    }).join("") || "<div class='empty-state'>No assignments available yet.</div>";
  }
}

/* =========================
   AI INSIGHTS
========================= */

async function loadInsights() {
  const response = await api("/api/students");
  const students = Array.isArray(response) ? response : [];

  const rows = await Promise.all(students.map(async (student) => ({
    student,
    prediction: await getRisk(student)
  })));

  const flagged = rows.filter(
    ({ prediction }) => prediction.risk_category !== "Low"
  );

  if ($("#insight-cards")) {
    $("#insight-cards").innerHTML = flagged.map(({ student, prediction }) => `
      <article class="insight-card">
        <div class="panel-heading">
          <div><h3>${esc(student.name)}</h3><p>${esc(student.student_code)} · ${esc(student.department)}</p></div>
          ${riskBadge(prediction.risk_category)}
        </div>
        <p>Model score: ${esc(prediction.risk_probability ?? "N/A")}%</p>
        <strong class="detail-title">Indicators to discuss</strong>
        <ul>${(prediction.factors || []).map((factor) => `<li>${esc(factor)}</li>`).join("")}</ul>
        <strong class="detail-title">Suggested support actions</strong>
        <ul>${(prediction.recommended_actions || []).map((action) => `<li>${esc(action)}</li>`).join("")}</ul>
      </article>
    `).join("") || `
      <article class="insight-card">
        <h3>No current flags</h3>
        <p>Continue regular student check-ins and monitor progress.</p>
      </article>`;
  }
}

/* =========================
   SKILL DEVELOPMENT
========================= */

function loadSkills() {
  const username =
    state.user?.username ||
    state.user?.student_code ||
    "student";

  const storageKey = `edusuccess_skills_${username}`;

  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
  } catch {
    saved = {};
  }

  const learnedBoxes = [...document.querySelectorAll("[data-skill]")];
  const nextBoxes = [...document.querySelectorAll("[data-next-skill]")];
  const planBoxes = [...document.querySelectorAll("[data-plan-day]")];
  const doneBoxes = [...document.querySelectorAll("[data-done-day]")];

  const goalSelect = $("#weekly-goal");
  const minutesSelect = $("#weekly-minutes");

  learnedBoxes.forEach((box) => {
    box.checked = (saved.learned || []).includes(box.dataset.skill);
  });

  nextBoxes.forEach((box) => {
    box.checked = (saved.next || []).includes(box.dataset.nextSkill);
  });

  planBoxes.forEach((box) => {
    box.checked = (saved.planned || []).includes(box.dataset.planDay);
  });

  doneBoxes.forEach((box) => {
    box.checked = (saved.done || []).includes(box.dataset.doneDay);
  });

  if (goalSelect && saved.goal) goalSelect.value = saved.goal;
  if (minutesSelect && saved.minutes) minutesSelect.value = saved.minutes;

  function updateProgress() {
    const learnedCount = learnedBoxes.filter((box) => box.checked).length;
    const learnedPercent = learnedBoxes.length
      ? Math.round(learnedCount / learnedBoxes.length * 100)
      : 0;

    const nextCount = nextBoxes.filter((box) => box.checked).length;
    const nextPercent = nextBoxes.length
      ? Math.round(nextCount / nextBoxes.length * 100)
      : 0;

    const planned = planBoxes.filter((box) => box.checked);
    const plannedDays = new Set(planned.map((box) => box.dataset.planDay));

    const completed = doneBoxes.filter((box) =>
      box.checked && plannedDays.has(box.dataset.doneDay)
    );

    const weeklyPercent = plannedDays.size
      ? Math.round(completed.length / plannedDays.size * 100)
      : 0;

    if ($("#learned-percent")) {
      $("#learned-percent").textContent = `${learnedPercent}%`;
    }
    if ($("#learned-progress")) {
      $("#learned-progress").style.width = `${learnedPercent}%`;
    }

    if ($("#next-percent")) {
      $("#next-percent").textContent = `${nextPercent}%`;
    }
    if ($("#next-progress")) {
      $("#next-progress").style.width = `${nextPercent}%`;
    }

    if ($("#weekly-percent")) {
      $("#weekly-percent").textContent = `${weeklyPercent}%`;
    }
    if ($("#weekly-progress")) {
      $("#weekly-progress").style.width = `${weeklyPercent}%`;
    }
    if ($("#weekly-summary")) {
      $("#weekly-summary").textContent =
        `${completed.length} of ${plannedDays.size} planned study days completed.`;
    }

    saved.learned = learnedBoxes
      .filter((box) => box.checked)
      .map((box) => box.dataset.skill);

    saved.next = nextBoxes
      .filter((box) => box.checked)
      .map((box) => box.dataset.nextSkill);

    saved.planned = planned.map((box) => box.dataset.planDay);

    saved.done = doneBoxes
      .filter((box) => box.checked)
      .map((box) => box.dataset.doneDay);

    if (goalSelect) saved.goal = goalSelect.value;
    if (minutesSelect) saved.minutes = minutesSelect.value;

    localStorage.setItem(storageKey, JSON.stringify(saved));
  }

  // Avoid registering duplicate listeners when revisiting the page.
  const view = $("#skills-view");
  if (view && view.dataset.progressListeners !== "attached") {
    view.addEventListener("change", (event) => {
      if (event.target.matches(
        "[data-skill], [data-next-skill], [data-plan-day], [data-done-day], #weekly-goal, #weekly-minutes"
      )) {
        updateProgress();
      }
    });
    view.dataset.progressListeners = "attached";
  }

  updateProgress();
}

/* =========================
   STUDENT DETAILS
========================= */

async function openDetail(studentId) {
  const student = state.students.find(
    (item) => String(item.id) === String(studentId)
  );

  if (!student) {
    showNotice("Student details are not available in the current list.", true);
    return;
  }

  const prediction = await getRisk(student);
  const dialog = $("#detail-dialog");

  const content =
    $("#detail-content") ||
    $("#detail-body") ||
    $("#detail-dialog .dialog-content");

  if (content) {
    content.innerHTML = `
      <h2>${esc(student.name)}</h2>
      <p>${esc(student.student_code)} · ${esc(student.department)}</p>
      <p>Attendance: ${esc(student.attendance)}%</p>
      <p>Marks: ${esc(student.marks)}/100</p>
      <p>Assignments: ${esc(student.assignments)}%</p>
      <p>Support level: ${riskBadge(prediction.risk_category)}</p>
      <h3>Indicators to discuss</h3>
      <ul>${(prediction.factors || []).map((item) => `<li>${esc(item)}</li>`).join("") || "<li>No indicators returned.</li>"}</ul>
      <h3>Suggested support actions</h3>
      <ul>${(prediction.recommended_actions || []).map((item) => `<li>${esc(item)}</li>`).join("") || "<li>Continue regular check-ins.</li>"}</ul>`;
  }

  if (dialog && typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    showNotice(`${student.name}: ${prediction.risk_category} support level.`);
  }
}

/* =========================
   INITIALIZE APP
========================= */

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".role-tab").forEach((button) => {
    button.addEventListener("click", () => setRole(button.dataset.role));
  });

  $("#login-form")?.addEventListener("submit", signIn);

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  document.addEventListener("click", (event) => {
    const detailButton = event.target.closest("[data-detail]");
    if (detailButton) {
      openDetail(detailButton.dataset.detail).catch((error) => {
        showNotice(error.message, true);
      });
    }

    const submitButton = event.target.closest(".submit-assignment");
    if (submitButton) {
      showNotice("Assignment submission needs to be connected to your backend.");
    }
  });

  $("#close-detail")?.addEventListener("click", () => {
    $("#detail-dialog")?.close();
  });

  $("#logout-btn")?.addEventListener("click", () => signOut());

  $("#search")?.addEventListener("input", () => {
    if (state.user?.role === "teacher" && state.activeView === "students") {
      loadStudents($("#search").value).catch((error) => {
        showNotice(error.message, true);
      });
    }
  });

  setRole("student");

  // The login screen is shown until the user signs in again.
  showLogin();
});
