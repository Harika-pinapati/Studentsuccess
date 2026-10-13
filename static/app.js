
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
    ...(options.body ? { "Content-Type": "application/json" } : {}),
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
    await signOut(false);
    throw new Error(
      typeof data === "object"
        ? data.detail || "Your session expired. Please sign in again."
        : "Your session expired. Please sign in again."
    );
  }

  if (!response.ok) {
    throw new Error(
      typeof data === "object"
        ? data.detail || "Something went wrong."
        : data || "Something went wrong."
    );
  }

  return data;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0] || "")
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

  clearTimeout(showNotice.timer);
  showNotice.timer = setTimeout(() => {
    element.classList.add("hidden");
  }, 4500);
}

function riskClass(level) {
  return String(level || "Moderate").toLowerCase();
}

function riskBadge(level) {
  return `<span class="level ${esc(riskClass(level))}">${esc(level)} support</span>`;
}

function showLogin() {
  $("#login-screen")?.classList.remove("hidden");
  $("#app-shell")?.classList.add("hidden");
}

function showApp() {
  $("#login-screen")?.classList.add("hidden");
  $("#app-shell")?.classList.remove("hidden");
}

function setRole(role) {
  state.role = role;

  const roleInput = $("#login-form [name=role]");
  if (roleInput) roleInput.value = role;

  document.querySelectorAll(".role-tab").forEach(button => {
    button.classList.toggle("active", button.dataset.role === role);
  });

  const label = $("#username-label");
  if (label) {
    label.textContent = role === "student" ? "Student ID" : "Teacher email";
  }

  const username = $("#login-username");
  if (username) {
    username.placeholder = role === "student"
      ? "e.g. ES001"
      : "teacher@edusuccess.local";
    username.value = "";
  }

  if ($("#login-password")) $("#login-password").value = "";
  $("#login-error")?.classList.add("hidden");
}

function applyRoleUI() {
  if (!state.user) return;

  const isTeacher = state.user.role === "teacher";

  document.querySelectorAll(".teacher-only").forEach(element => {
    element.classList.toggle("hidden", !isTeacher);
  });

  document.querySelectorAll(".student-only").forEach(element => {
    element.classList.toggle("hidden", isTeacher);
  });

  const reportButton = $("#download-report");
  if (reportButton) reportButton.classList.toggle("hidden", !isTeacher);

  const name = state.user.name || state.user.username || "Student";

  if ($("#sidebar-name")) {
    $("#sidebar-name").textContent = isTeacher ? "Teacher workspace" : name;
  }

  if ($("#sidebar-role")) {
    $("#sidebar-role").textContent = isTeacher
      ? "Faculty account"
      : "Student account";
  }

  if ($("#sidebar-avatar")) {
    $("#sidebar-avatar").textContent = initials(isTeacher ? "Teacher" : name);
  }

  if ($("#welcome-title")) {
    $("#welcome-title").textContent = isTeacher
      ? "Small insights. Meaningful student progress."
      : `Welcome back, ${name.split(" ")[0]}.`;
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

  if ($("#metric-one-label")) {
    $("#metric-one-label").textContent = isTeacher
      ? "Total students"
      : "Your student profile";
  }

  if ($("#metric-one-foot")) {
    $("#metric-one-foot").textContent = isTeacher
      ? "Learners in your workspace"
      : "Your personal learning record";
  }

  if ($("#risk-metric-label")) {
    $("#risk-metric-label").textContent = isTeacher
      ? "Need a check-in"
      : "Your support indicator";
  }

  if ($("#risk-metric-foot")) {
    $("#risk-metric-foot").textContent = isTeacher
      ? "Students to review with care"
      : "A prompt for reflection, not a label";
  }

  if ($("#performance-title")) {
    $("#performance-title").textContent = isTeacher
      ? "Department performance"
      : "Your academic snapshot";
  }

  if ($("#performance-subtitle")) {
    $("#performance-subtitle").textContent = isTeacher
      ? "Average marks across departments"
      : "Your current learning indicators";
  }

  if ($("#recent-title")) {
    $("#recent-title").textContent = isTeacher
      ? "Recently added students"
      : "Your student summary";
  }

  if ($("#recent-subtitle")) {
    $("#recent-subtitle").textContent = isTeacher
      ? "A quick look at your learning community"
      : "Your latest progress indicators";
  }

  if ($("#top-eyebrow")) {
    $("#top-eyebrow").textContent = isTeacher
      ? "FACULTY SUCCESS CENTER"
      : "STUDENT SUCCESS CENTER";
  }
}

function switchView(view) {
  if (!state.user) return;

  if (view === "students" && state.user.role !== "teacher") return;
  if (view === "insights" && state.user.role !== "teacher") return;
  if (view === "skills" && state.user.role !== "student") return;

  const target = $(`#${view}-view`);
  if (!target) {
    showNotice(`The ${view} page was not found in index.html.`, true);
    return;
  }

  state.activeView = view;

  document.querySelectorAll(".view").forEach(element => {
    element.classList.add("hidden");
  });

  target.classList.remove("hidden");

  document.querySelectorAll(".nav-item").forEach(element => {
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
  if ($("#page-subtitle")) {
    $("#page-subtitle").textContent = subtitles[view] || "";
  }

  const loaders = {
    dashboard: loadDashboard,
    students: () => loadStudents($("#search")?.value || ""),
    attendance: loadAttendance,
    results: loadResults,
    assignments: loadAssignments,
    insights: loadInsights,
    skills: loadSkills
  };

  Promise.resolve(loaders[view]?.()).catch(error => {
    showNotice(error.message, true);
  });
}

async function getRisk(student) {
  try {
    return await api(`/api/students/${student.id}/prediction`);
  } catch (error) {
    return {
      risk_category: "Moderate",
      risk_probability: 0,
      factors: [],
      recommended_actions: [],
      model_note: "Prediction unavailable."
    };
  }
}

async function loadDashboard() {
  const dashboard = await api("/api/dashboard");

  if ($("#total-students")) {
    $("#total-students").textContent =
      state.user.role === "student"
        ? state.user.student_code || "—"
        : dashboard.total_students ?? 0;
  }

  if ($("#average-marks")) {
    $("#average-marks").textContent = dashboard.average_marks ?? 0;
  }

  if ($("#average-attendance")) {
    $("#average-attendance").textContent = dashboard.average_attendance ?? 0;
  }

  if ($("#support-flags")) {
    $("#support-flags").textContent = dashboard.support_flags ?? 0;
  }

  const chart = $("#department-chart");

  if (chart) {
    if (state.user.role === "student") {
      chart.innerHTML = `
        <div class="personal-progress">
          <div class="progress-line">
            <div><span>Attendance</span><strong>${esc(dashboard.average_attendance ?? 0)}%</strong></div>
            <div class="progress-track"><i style="width:${Math.min(100, Math.max(0, Number(dashboard.average_attendance) || 0))}%"></i></div>
          </div>
          <div class="progress-line">
            <div><span>Academic marks</span><strong>${esc(dashboard.average_marks ?? 0)}%</strong></div>
            <div class="progress-track blue-track"><i style="width:${Math.min(100, Math.max(0, Number(dashboard.average_marks) || 0))}%"></i></div>
          </div>
          <div class="progress-line">
            <div><span>Assignments completed</span><strong>${esc(dashboard.student?.assignments ?? 0)}%</strong></div>
            <div class="progress-track green-track"><i style="width:${Math.min(100, Math.max(0, Number(dashboard.student?.assignments) || 0))}%"></i></div>
          </div>
        </div>`;
    } else {
      const departments = dashboard.departments || [];

      chart.innerHTML = departments.length
        ? departments.map(item => `
          <div class="bar-row">
            <span>${esc(item.department)}</span>
            <div class="bar-track">
              <div class="bar-fill" style="width:${Math.min(100, Math.max(0, Number(item.average_marks) || 0))}%"></div>
            </div>
            <span class="bar-value">${esc(item.average_marks)}</span>
          </div>`).join("")
        : `<p class="muted">No student records yet.</p>`;
    }
  }

  const riskChart = $("#risk-chart");
  if (riskChart) {
    const colors = {
      High: "#d95d68",
      Moderate: "#e8a34a",
      Low: "#25a982"
    };

    riskChart.innerHTML = Object.entries(dashboard.risk_counts || {})
      .map(([name, count]) => `
        <div class="risk-row">
          <span class="risk-dot" style="background:${colors[name] || "#999"}"></span>
          <span>${esc(name)} support</span>
          <strong>${esc(count)}</strong>
        </div>`).join("");
  }

  const recent = dashboard.recent_students || [];
  const tableHead = $("#recent-head");
  const tableBody = $("#recent-table");

  if (!tableHead || !tableBody) return;

  if (state.user.role === "student") {
    const student = dashboard.student;

    tableHead.innerHTML = `
      <tr>
        <th>MY PROFILE</th><th>DEPARTMENT</th><th>ATTENDANCE</th>
        <th>MARKS</th><th>SUPPORT LEVEL</th><th></th>
      </tr>`;

    if (!student) {
      tableBody.innerHTML =
        "<tr><td colspan='6'>No student profile found.</td></tr>";
      return;
    }

    const prediction = await getRisk(student);

    tableBody.innerHTML = `
      <tr>
        <td><div class="person-cell"><div class="avatar">${initials(student.name)}</div>
          <div><strong>${esc(student.name)}</strong><small>${esc(student.student_code)}</small></div></div></td>
        <td>${esc(student.department)}</td>
        <td>${esc(student.attendance)}%</td>
        <td>${esc(student.marks)}/100</td>
        <td>${riskBadge(prediction.risk_category)}</td>
        <td><button class="text-button" data-detail="${esc(student.id)}">Review</button></td>
      </tr>`;
    return;
  }

  tableHead.innerHTML = `
    <tr>
      <th>STUDENT</th><th>DEPARTMENT</th><th>ATTENDANCE</th>
      <th>MARKS</th><th>SUPPORT LEVEL</th><th></th>
    </tr>`;

  const rows = await Promise.all(recent.map(async student => ({
    ...student,
    prediction: await getRisk(student)
  })));

  tableBody.innerHTML = rows.map(student => `
    <tr>
      <td><div class="person-cell"><div class="avatar">${initials(student.name)}</div>
        <div><strong>${esc(student.name)}</strong><small>${esc(student.student_code)}</small></div></div></td>
      <td>${esc(student.department)}</td>
      <td>${esc(student.attendance)}%</td>
      <td>${esc(student.marks)}/100</td>
      <td>${riskBadge(student.prediction.risk_category)}</td>
      <td><button class="text-button" data-detail="${esc(student.id)}">Review</button></td>
    </tr>`).join("") || "<tr><td colspan='6'>No student records.</td></tr>";
}

async function loadStudents(search = "") {
  const students = await api(`/api/students?search=${encodeURIComponent(search)}`);
  state.students = students;

  const rows = await Promise.all(students.map(async student => ({
    ...student,
    prediction: await getRisk(student)
  })));

  if ($("#student-count")) {
    $("#student-count").textContent =
      `${rows.length} record${rows.length === 1 ? "" : "s"}`;
  }

  if ($("#students-table")) {
    $("#students-table").innerHTML = rows.map(student => `
      <tr>
        <td><div class="person-cell"><div class="avatar">${initials(student.name)}</div>
          <div><strong>${esc(student.name)}</strong><small>${esc(student.student_code)}</small></div></div></td>
        <td>${esc(student.department)} · Year ${esc(student.year)}</td>
        <td>${esc(student.attendance)}%</td>
        <td>${esc(student.marks)}/100</td>
        <td>${esc(student.assignments)}%</td>
        <td>${riskBadge(student.prediction.risk_category)}</td>
        <td><button class="text-button" data-detail="${esc(student.id)}">Analyze</button></td>
      </tr>`).join("") || "<tr><td colspan='7'>No matching records.</td></tr>";
  }

  fillStudentOptions();
}

async function loadAttendance() {
  const rows = await api("/api/attendance");

  if ($("#attendance-total")) $("#attendance-total").textContent = rows.length;
  if ($("#attendance-present")) {
    $("#attendance-present").textContent =
      rows.filter(row => row.status !== "absent").length;
  }
  if ($("#attendance-absent")) {
    $("#attendance-absent").textContent =
      rows.filter(row => row.status === "absent").length;
  }

  if ($("#attendance-table")) {
    $("#attendance-table").innerHTML = rows.map(row => `
      <tr>
        <td><div class="person-cell"><div class="avatar">${initials(row.name)}</div>
          <div><strong>${esc(row.name)}</strong><small>${esc(row.student_code)}</small></div></div></td>
        <td>${esc(row.subject)}</td>
        <td>${esc(row.attendance_date)}</td>
        <td><span class="status-pill ${esc(row.status)}">${esc(row.status)}</span></td>
      </tr>`).join("") || "<tr><td colspan='4'>No attendance records yet.</td></tr>";
  }
}

async function loadResults() {
  const rows = await api("/api/results");

  if ($("#results-table")) {
    $("#results-table").innerHTML = rows.map(row => {
      const maxMarks = Number(row.max_marks) || 0;
      const percentage = maxMarks > 0
        ? Math.round(Number(row.marks_obtained) / maxMarks * 100)
        : 0;

      return `
        <tr>
          <td><div class="person-cell"><div class="avatar">${initials(row.name)}</div>
            <div><strong>${esc(row.name)}</strong><small>${esc(row.student_code)}</small></div></div></td>
          <td>${esc(row.subject)}</td>
          <td>${esc(row.exam_name)}</td>
          <td><strong>${esc(row.marks_obtained)}/${esc(row.max_marks)}</strong></td>
          <td><span class="score-pill">${percentage}%</span></td>
          <td>${esc(String(row.published_at || "").slice(0, 10))}</td>
        </tr>`;
    }).join("") || "<tr><td colspan='6'>No results published yet.</td></tr>";
  }
}

async function loadAssignments() {
  const rows = await api("/api/assignments");
  const grid = $("#assignment-grid");
  if (!grid) return;

  grid.innerHTML = rows.map(assignment => {
    const overdue = assignment.due_date < today;

    return `
      <article class="assignment-card">
        <div class="assignment-card-top">
          <span class="assignment-icon">▧</span>
          <span class="due-chip ${overdue ? "overdue" : ""}">
            ${overdue ? "Past due" : "Due " + esc(assignment.due_date)}
          </span>
        </div>
        <div class="assignment-subject">${esc(assignment.subject)}</div>
        <h3>${esc(assignment.title)}</h3>
        <p>${esc(assignment.description || "No additional instructions provided.")}</p>
        ${state.user.role === "student"
        ? `<div class="submission-status ${assignment.submitted_at ? "submitted" : ""}">
              ${assignment.submitted_at ? "✓ Submitted" : "Awaiting submission"}
            </div>
            <button class="btn ${assignment.submitted_at ? "btn-outline" : "btn-primary"} submit-assignment"
              data-assignment="${esc(assignment.id)}" data-title="${esc(assignment.title)}">
              ${assignment.submitted_at ? "Update submission" : "Submit work"}
            </button>`
        : `<div class="assignment-meta">Created by ${esc(assignment.teacher_username || "faculty")}</div>`
      }
      </article>`;
  }).join("") || "<div class='empty-state'>No assignments available yet.</div>";
}

async function loadInsights() {
  const students = await api("/api/students");

  const rows = await Promise.all(students.map(async student => ({
    student,
    prediction: await getRisk(student)
  })));

  const flagged = rows
    .filter(row => row.prediction.risk_category !== "Low")
    .sort((a, b) =>
      (b.prediction.risk_probability || 0) -
      (a.prediction.risk_probability || 0)
    );

  if ($("#insight-cards")) {
    $("#insight-cards").innerHTML = flagged.slice(0, 8).map(({ student, prediction }) => `
      <article class="insight-card">
        <div class="panel-heading">
          <div><h3>${esc(student.name)}</h3>
            <p>${esc(student.student_code)} · ${esc(student.department)} · Year ${esc(student.year)}</p>
          </div>
          ${riskBadge(prediction.risk_category)}
        </div>
        <p>Model score: ${esc(prediction.risk_probability ?? "—")}% · For staff review only.</p>
        <strong class="detail-title">Indicators to discuss</strong>
        <ul>${(prediction.factors || []).map(factor => `<li>${esc(factor)}</li>`).join("")}</ul>
        <strong class="detail-title">Possible support actions</strong>
        <ul>${(prediction.recommended_actions || []).map(action => `<li>${esc(action)}</li>`).join("")}</ul>
      </article>`).join("") ||
      "<article class='insight-card'><h3>No current flags</h3><p>Continue regular student check-ins and monitor progress.</p></article>";
  }
}

async function openDetail(id) {
  try {
    const result = await api(`/api/students/${encodeURIComponent(id)}/prediction`);
    const student = result.student;
    if (!student || !$("#detail-content") || !$("#detail-dialog")) {
      throw new Error("Student detail elements are missing from index.html.");
    }

    $("#detail-content").innerHTML = `
      <div class="dialog-head">
        <div class="detail-person">
          <div class="avatar">${initials(student.name)}</div>
          <div><h2>${esc(student.name)}</h2>
            <p>${esc(student.student_code)} · ${esc(student.department)} · Year ${esc(student.year)}</p>
          </div>
        </div>
        <button type="button" class="close-btn" id="close-detail-x" aria-label="Close">×</button>
      </div>
      <div>${riskBadge(result.risk_category)}
        <span class="muted">Model score: ${esc(result.risk_probability)}%</span>
      </div>
      <div class="detail-stats">
        <div class="detail-stat"><span>Attendance</span><strong>${esc(student.attendance)}%</strong></div>
        <div class="detail-stat"><span>Marks</span><strong>${esc(student.marks)}</strong></div>
        <div class="detail-stat"><span>Assignments</span><strong>${esc(student.assignments)}%</strong></div>
      </div>
      <h3 class="detail-title">Indicators to review</h3>
      <ul class="detail-section">${(result.factors || []).map(factor => `<li>${esc(factor)}</li>`).join("")}</ul>
      <h3 class="detail-title">Suggested support actions</h3>
      <ul class="detail-section">${(result.recommended_actions || []).map(action => `<li>${esc(action)}</li>`).join("")}</ul>
      <p class="small-note">${esc(result.model_note || "")}</p>`;

    $("#detail-dialog").showModal();
  } catch (error) {
    showNotice(error.message, true);
  }
}

function updateSkillProgress(selector, labelId, barId) {
  const inputs = [...document.querySelectorAll(selector)];
  const checked = inputs.filter(input => input.checked).length;
  const percentage = inputs.length
    ? Math.round(checked / inputs.length * 100)
    : 0;

  const label = document.getElementById(labelId);
  const bar = document.getElementById(barId);

  if (label) label.textContent = percentage + "%";
  if (bar) bar.style.width = percentage + "%";
}

function loadSkills() {
  document.querySelectorAll("[data-skill], [data-next-skill]").forEach(input => {
    const isNext = input.hasAttribute("data-next-skill");
    const key = isNext ? input.dataset.nextSkill : input.dataset.skill;
    const prefix = isNext ? "edusuccess_next_skill_" : "edusuccess_skill_";
    input.checked = localStorage.getItem(prefix + key) === "1";
  });

  updateSkillProgress("[data-skill]", "learned-percent", "learned-progress");
  updateSkillProgress("[data-next-skill]", "next-percent", "next-progress");
  loadWeeklyPlan();
}

document.addEventListener("change", event => {
  const input = event.target.closest("[data-skill], [data-next-skill]");
  if (!input) return;

  const isNext = input.hasAttribute("data-next-skill");
  const key = isNext ? input.dataset.nextSkill : input.dataset.skill;
  const prefix = isNext ? "edusuccess_next_skill_" : "edusuccess_skill_";

  localStorage.setItem(prefix + key, input.checked ? "1" : "0");

  updateSkillProgress("[data-skill]", "learned-percent", "learned-progress");
  updateSkillProgress("[data-next-skill]", "next-percent", "next-progress");
});

function updateWeeklyProgress() {
  const planned = [...document.querySelectorAll("[data-plan-day]:checked")]
    .map(input => input.dataset.planDay);
  const completed = [...document.querySelectorAll("[data-done-day]:checked")]
    .map(input => input.dataset.doneDay);

  const count = planned.filter(day => completed.includes(day)).length;
  const percentage = planned.length
    ? Math.round(count / planned.length * 100)
    : 0;

  if ($("#weekly-percent")) $("#weekly-percent").textContent = percentage + "%";
  if ($("#weekly-progress")) $("#weekly-progress").style.width = percentage + "%";
  if ($("#weekly-summary")) {
    $("#weekly-summary").textContent =
      `${count} of ${planned.length} planned study days completed.`;
  }
}

function loadWeeklyPlan() {
  const goal = $("#weekly-goal");
  const minutes = $("#weekly-minutes");
  if (!goal || !minutes) return;

  try {
    const saved = JSON.parse(localStorage.getItem("edusuccess_weekly_plan") || "{}");

    if (saved.goal) goal.value = saved.goal;
    if (saved.minutes) minutes.value = String(saved.minutes);

    document.querySelectorAll("[data-plan-day]").forEach(input => {
      input.checked = Array.isArray(saved.days) &&
        saved.days.includes(input.dataset.planDay);
    });

    document.querySelectorAll("[data-done-day]").forEach(input => {
      input.checked = Array.isArray(saved.completed) &&
        saved.completed.includes(input.dataset.doneDay);
    });
  } catch (error) {
    console.warn("Could not load weekly plan.", error);
  }

  updateWeeklyProgress();
}

function saveWeeklyPlan() {
  const goal = $("#weekly-goal");
  const minutes = $("#weekly-minutes");
  if (!goal || !minutes) return;

  const plan = {
    goal: goal.value,
    minutes: minutes.value,
    days: [...document.querySelectorAll("[data-plan-day]:checked")]
      .map(input => input.dataset.planDay),
    completed: [...document.querySelectorAll("[data-done-day]:checked")]
      .map(input => input.dataset.doneDay)
  };

  try {
    localStorage.setItem("edusuccess_weekly_plan", JSON.stringify(plan));
    updateWeeklyProgress();
  } catch (error) {
    console.warn("Could not save weekly plan.", error);
  }
}

document.addEventListener("change", event => {
  if (event.target.matches("#weekly-goal, #weekly-minutes, [data-plan-day], [data-done-day]")) {
    saveWeeklyPlan();
  }
});

async function downloadReport() {
  try {
    if (!state.user || state.user.role !== "teacher") {
      showNotice("Please sign in to the Teacher Portal to download reports.", true);
      return;
    }

    const response = await fetch("/api/export.csv", {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!response.ok) {
      let message = "Could not download the report.";
      try {
        const data = await response.json();
        message = data.detail || message;
      } catch {
        // Keep the default message.
      }

      if (response.status === 401) await signOut(false);
      throw new Error(message);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "edusuccess_students.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showNotice("Student report downloaded.");
  } catch (error) {
    showNotice(error.message || "Download failed.", true);
  }
}

function openDialog(id) {
  const dialog = $("#" + id);
  if (!dialog) {
    showNotice(`Dialog "${id}" was not found.`, true);
    return;
  }

  if (typeof dialog.showModal === "function") {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function closeDialog(id) {
  const dialog = $("#" + id);
  if (!dialog) return;

  if (typeof dialog.close === "function") {
    if (dialog.open) dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

function fillStudentOptions() {
  const options = state.students.map(student =>
    `<option value="${esc(student.id)}">${esc(student.student_code)} — ${esc(student.name)}</option>`
  ).join("");

  ["#attendance-student", "#result-student"].forEach(selector => {
    const element = $(selector);
    if (element) element.innerHTML = options;
  });
}

async function signOut(callApi = true) {
  const token = state.token;

  state.token = null;
  state.user = null;
  localStorage.removeItem("edusuccess_token");

  if (callApi && token) {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.warn("Logout request failed.", error);
    }
  }

  showLogin();
}

async function enterApp() {
  const user = await api("/api/auth/me");
  state.user = user;

  applyRoleUI();
  showApp();

  if ($("#today-label")) {
    $("#today-label").textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric"
    }).format(new Date());
  }

  if (user.role === "teacher") {
    await loadStudents();
  }

  switchView("dashboard");
}

function bindClick(selector, handler) {
  const element = $(selector);
  if (!element) {
    console.warn(`Button or element not found: ${selector}`);
    return;
  }
  element.addEventListener("click", handler);
}

function bindSubmit(selector, handler) {
  const element = $(selector);
  if (!element) {
    console.warn(`Form not found: ${selector}`);
    return;
  }
  element.addEventListener("submit", handler);
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".role-tab").forEach(button => {
    button.addEventListener("click", () => setRole(button.dataset.role));
  });

  document.querySelectorAll("[data-demo]").forEach(button => {
    button.addEventListener("click", () => {
      const role = button.dataset.demo;
      setRole(role);

      if ($("#login-username")) {
        $("#login-username").value =
          role === "student" ? "ES001" : "teacher@edusuccess.local";
      }

      if ($("#login-password")) {
        $("#login-password").value =
          role === "student" ? "Student@123" : "Teacher@123";
      }
    });
  });

  bindClick("#toggle-password", () => {
    const password = $("#login-password");
    if (!password) return;

    password.type = password.type === "password" ? "text" : "password";
    $("#toggle-password").textContent =
      password.type === "password" ? "Show" : "Hide";
  });

  bindSubmit("#login-form", async event => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const errorElement = $("#login-error");
    const button = form.querySelector('button[type="submit"]');

    if (button) {
      button.disabled = true;
      const label = button.querySelector("span");
      if (label) label.textContent = "Signing in…";
    }

    errorElement?.classList.add("hidden");

    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(formData.entries()))
      });

      state.token = data.token;
      localStorage.setItem("edusuccess_token", data.token);
      state.user = data.user;

      await enterApp();
    } catch (error) {
      if (errorElement) {
        errorElement.textContent = error.message;
        errorElement.classList.remove("hidden");
      } else {
        showNotice(error.message, true);
      }
    } finally {
      if (button) {
        button.disabled = false;
        const label = button.querySelector("span");
        if (label) label.textContent = "Sign in securely";
      }
    }
  });

  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => switchView(button.dataset.go));
  });

  bindClick("#add-top", () => {
    $("#student-form")?.reset();
    openDialog("student-dialog");
  });

  // Fix Cancel and × in Add Student dialog.
  bindClick("#cancel-dialog", () => closeDialog("student-dialog"));
  bindClick("#close-dialog", () => closeDialog("student-dialog"));

  bindClick("#close-detail", () => closeDialog("detail-dialog"));
  bindClick("#logout-btn", () => signOut());
  bindClick("#download-report", downloadReport);

  bindClick("#export-link", async event => {
    event.preventDefault();

    try {
      if (!state.user || state.user.role !== "teacher") {
        showNotice("Only teachers can export student records.", true);
        return;
      }

      const response = await fetch("/api/export.csv", {
        headers: { Authorization: `Bearer ${state.token}` }
      });

      if (!response.ok) {
        let message = "Export failed.";
        try {
          const data = await response.json();
          message = data.detail || message;
        } catch {
          // Keep default message.
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "edusuccess_students.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      showNotice(error.message, true);
    }
  });

  bindClick("#search", event => {
    if (state.user?.role === "teacher") {
      loadStudents(event.target.value).catch(error =>
        showNotice(error.message, true)
      );
    }
  });

  bindSubmit("#student-form", async event => {
    event.preventDefault();

    if (state.user?.role !== "teacher") {
      showNotice("Only teachers can add students.", true);
      return;
    }

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));

    ["year", "attendance", "marks", "assignments"].forEach(key => {
      if (payload[key] !== undefined && payload[key] !== "") {
        payload[key] = Number(payload[key]);
      }
    });

    try {
      await api("/api/students", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      closeDialog("student-dialog");
      form.reset();

      showNotice("Student saved successfully.");
      await loadStudents($("#search")?.value || "");
      await loadDashboard();
    } catch (error) {
      showNotice(error.message, true);
    }
  });

  bindClick("#mark-attendance-btn", async () => {
    try {
      await loadStudents();
      const dateInput = $("#attendance-form [name=attendance_date]");
      if (dateInput) dateInput.value = today;
      openDialog("attendance-dialog");
    } catch (error) {
      showNotice(error.message, true);
    }
  });

  bindSubmit("#attendance-form", async event => {
    event.preventDefault();

    const payload = Object.fromEntries(new FormData(event.currentTarget));
    payload.student_id = Number(payload.student_id);

    try {
      await api("/api/attendance", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      closeDialog("attendance-dialog");
      showNotice("Attendance saved successfully.");
      await loadAttendance();
      await loadDashboard();
    } catch (error) {
      showNotice(error.message, true);
    }
  });

  bindClick("#add-result-btn", async () => {
    try {
      await loadStudents();
      openDialog("result-dialog");
    } catch (error) {
      showNotice(error.message, true);
    }
  });

  bindSubmit("#result-form", async event => {
    event.preventDefault();

    const payload = Object.fromEntries(new FormData(event.currentTarget));
    ["student_id", "marks_obtained", "max_marks"].forEach(key => {
      payload[key] = Number(payload[key]);
    });

    try {
      await api("/api/results", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      closeDialog("result-dialog");
      showNotice("Result published successfully.");
      await loadResults();
      await loadDashboard();
    } catch (error) {
      showNotice(error.message, true);
    }
  });

  bindClick("#add-assignment-btn", () => {
    const dateInput = $("#assignment-form [name=due_date]");
    if (dateInput) dateInput.value = today;
    openDialog("assignment-dialog");
  });

  bindSubmit("#assignment-form", async event => {
    event.preventDefault();

    const payload = Object.fromEntries(new FormData(event.currentTarget));

    try {
      await api("/api/assignments", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      closeDialog("assignment-dialog");
      showNotice("Assignment published successfully.");
      await loadAssignments();
    } catch (error) {
      showNotice(error.message, true);
    }
  });

  bindSubmit("#submit-form", async event => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const assignmentId = formData.get("assignment_id");
    const submissionText = formData.get("submission_text");

    try {
      await api(`/api/assignments/${encodeURIComponent(assignmentId)}/submit`, {
        method: "POST",
        body: JSON.stringify({ submission_text: submissionText })
      });

      closeDialog("submit-dialog");
      showNotice("Your work has been submitted.");
      await loadAssignments();
    } catch (error) {
      showNotice(error.message, true);
    }
  });

  // Delegated events for dynamically generated buttons.
  document.addEventListener("click", event => {
    const detailButton = event.target.closest("[data-detail]");
    if (detailButton) {
      openDetail(detailButton.dataset.detail);
      return;
    }

    const closeButton = event.target.closest("[data-close]");
    if (closeButton) {
      closeDialog(closeButton.dataset.close);
      return;
    }

    if (event.target.closest("#close-detail-x")) {
      closeDialog("detail-dialog");
      return;
    }

    const submitButton = event.target.closest(".submit-assignment");
    if (submitButton) {
      const assignmentInput = $("#submit-form [name=assignment_id]");
      const titleElement = $("#submit-title");
      const textInput = $("#submit-form [name=submission_text]");

      if (assignmentInput) assignmentInput.value = submitButton.dataset.assignment;
      if (titleElement) titleElement.textContent = submitButton.dataset.title || "Submit work";
      if (textInput) textInput.value = "";

      openDialog("submit-dialog");
    }
  });

  // Allow clicking a dialog backdrop to close it.
  document.querySelectorAll("dialog").forEach(dialog => {
    dialog.addEventListener("click", event => {
      if (event.target === dialog) {
        closeDialog(dialog.id);
      }
    });
  });

  // Restore the saved session or show the login screen.
  (async () => {
    try {
      await api("/api/health");

      if (state.token) {
        await enterApp();
      } else {
        showLogin();
      }
    } catch (error) {
      showLogin();

      if (state.token) {
        showNotice("Could not restore session. Please sign in again.", true);
      } else {
        console.error("Application initialization failed:", error);
      }
    }
  })();
});
