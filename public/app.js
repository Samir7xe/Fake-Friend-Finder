"use strict";

const $ = id => document.getElementById(id);

const state = {
  customQuestions: [],
  websiteQuestions: [],
  playQuestions: [],
  sessionId: null,
  links: [],
  musicUrl: null
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
  return data;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);
}

function show(id) {
  document.querySelectorAll(".view").forEach(el => {
    el.classList.toggle("hidden", el.id !== id);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function msg(id, text, error = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.classList.remove("hidden");
  el.style.color = error ? "#d93050" : "";
}

function fail(error) {
  return error?.message || "কাজটি করা যায়নি। আবার চেষ্টা করুন।";
}

/* NAVIGATION */

document.querySelectorAll("[data-home]").forEach(button => {
  button.addEventListener("click", () => show("home"));
});

$("websiteModeBtn")?.addEventListener("click", async () => {
  show("websiteMode");
  await loadWebsiteQuestions();
});

$("createBtn")?.addEventListener("click", () => show("create"));
$("howBtn")?.addEventListener("click", () => show("how"));

$("profileBubble")?.addEventListener("click", () => {
  show("profile");
  loadProfile();
});

$("closeProfile")?.addEventListener("click", () => show("home"));

/* CUSTOM QUIZ CREATION */

$("build")?.addEventListener("click", () => {
  if (!$("creatorName").value.trim()) {
    alert("আগে তোমার নাম লিখো।");
    $("creatorName").focus();
    return;
  }

  const count = Number($("count").value);
  state.customQuestions = Array.from({ length: count }, () => ({
    prompt: "",
    options: ["", "", "", ""],
    correctAnswer: ""
  }));

  renderEditor();
  show("editor");
});

function renderEditor() {
  const container = $("questionEditor");

  container.innerHTML = state.customQuestions.map((q, i) => `
    <div class="question-card">
      <h3>প্রশ্ন ${i + 1}</h3>

      <label>প্রশ্ন লিখো
        <textarea data-prompt="${i}" maxlength="300">${esc(q.prompt)}</textarea>
      </label>

      <div>
        ${q.options.map((option, j) => `
          <label>অপশন ${j + 1}
            <input data-option="${i}:${j}" maxlength="120"
              value="${esc(option)}" placeholder="অপশন লিখো">
          </label>
        `).join("")}
      </div>

      <button type="button" class="glow pale" data-add-option="${i}">
        ＋ অপশন যোগ
      </button>

      <label>সঠিক উত্তর
        <select data-correct="${i}">
          <option value="">সঠিক উত্তর বেছে নাও</option>
          ${q.options.filter(x => x.trim()).map(option => `
            <option value="${esc(option)}"
              ${q.correctAnswer === option ? "selected" : ""}>
              ${esc(option)}
            </option>
          `).join("")}
        </select>
      </label>
    </div>
  `).join("");

  container.querySelectorAll("[data-prompt]").forEach(el => {
    el.addEventListener("input", () => {
      state.customQuestions[+el.dataset.prompt].prompt = el.value;
    });
  });

  container.querySelectorAll("[data-option]").forEach(el => {
    el.addEventListener("input", () => {
      const [qi, oi] = el.dataset.option.split(":").map(Number);
      const q = state.customQuestions[qi];
      const old = q.options[oi];
      q.options[oi] = el.value;

      if (q.correctAnswer === old) q.correctAnswer = "";

      const select = container.querySelector(`[data-correct="${qi}"]`);
      select.innerHTML = `<option value="">সঠিক উত্তর বেছে নাও</option>` +
        q.options.filter(x => x.trim()).map(option => `
          <option value="${esc(option)}">${esc(option)}</option>
        `).join("");
      select.value = q.correctAnswer;
    });
  });

  container.querySelectorAll("[data-correct]").forEach(el => {
    el.addEventListener("change", () => {
      state.customQuestions[+el.dataset.correct].correctAnswer = el.value;
    });
  });

  container.querySelectorAll("[data-add-option]").forEach(button => {
    button.addEventListener("click", () => {
      const q = state.customQuestions[+button.dataset.addOption];
      if (q.options.length >= 12) return alert("সর্বোচ্চ ১২টি অপশন রাখা যাবে।");
      q.options.push("");
      renderEditor();
    });
  });
}

$("addQuestion")?.addEventListener("click", () => {
  if (state.customQuestions.length >= 30) {
    alert("সর্বোচ্চ ৩০টি প্রশ্ন রাখা যাবে।");
    return;
  }

  state.customQuestions.push({
    prompt: "",
    options: ["", "", "", ""],
    correctAnswer: ""
  });

  renderEditor();
});

$("saveQuiz")?.addEventListener("click", async () => {
  const questions = state.customQuestions.map(q => ({
    prompt: q.prompt.trim(),
    options: q.options.map(x => x.trim()).filter(Boolean),
    correctAnswer: q.correctAnswer.trim()
  }));

  if (questions.some(q =>
    !q.prompt ||
    q.options.length < 4 ||
    q.options.length > 12 ||
    new Set(q.options).size !== q.options.length ||
    !q.correctAnswer ||
    !q.options.includes(q.correctAnswer)
  )) {
    alert("প্রতিটি প্রশ্নে ৪–১২টি আলাদা অপশন ও সঠিক উত্তর দিন।");
    return;
  }

  const button = $("saveQuiz");
  button.disabled = true;

  try {
    const result = await api("/api/quizzes", {
      method: "POST",
      body: JSON.stringify({
        creatorName: $("creatorName").value.trim(),
        creatorGender: $("gender").value,
        questions
      })
    });

    const box = $("shareResult");
    box.classList.remove("hidden");
    box.innerHTML = `
      <p>🎉 তোমার কুইজ তৈরি হয়েছে!</p>
      <p><a href="${esc(result.shareUrl)}">${esc(result.shareUrl)}</a></p>
      <button type="button" id="copyQuizLink" class="glow">লিংক কপি করো</button>
    `;

    $("copyQuizLink").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(result.shareUrl);
        alert("লিংক কপি হয়েছে!");
      } catch {
        prompt("লিংক কপি করো:", result.shareUrl);
      }
    });
  } catch (error) {
    alert(fail(error));
  } finally {
    button.disabled = false;
  }
});

/* PLAY A SHARED QUIZ */

async function loadQuiz(id) {
  try {
    const quiz = await api(`/api/quizzes/${encodeURIComponent(id)}`);
    $("playTitle").textContent = `${quiz.creatorName}-এর কুইজ 💙`;

    $("pickList").innerHTML = quiz.questions.map(q => `
      <label class="question-card">
        <input type="checkbox" data-pick value="${q.id}">
        ${esc(q.prompt)}
      </label>
    `).join("");

    $("pickList").classList.remove("hidden");
    $("startPlay").classList.remove("hidden");
    $("answers").innerHTML = "";
    $("score").textContent = "";
    show("play");
  } catch (error) {
    alert(fail(error));
    show("home");
  }
}

$("startPlay")?.addEventListener("click", async () => {
  const playerName = $("playerName").value.trim();
  const questionIds = [...document.querySelectorAll("[data-pick]:checked")]
    .map(el => Number(el.value));

  if (!playerName) return alert("তোমার নাম লিখো।");
  if (questionIds.length !== 10) return alert("ঠিক ১০টি প্রশ্ন বেছে নাও।");

  const match = location.pathname.match(/^\/play\/([^/]+)$/);
  if (!match) return alert("কুইজের লিংক সঠিক নয়।");

  try {
    const result = await api(`/api/quizzes/${encodeURIComponent(match[1])}/start`, {
      method: "POST",
      body: JSON.stringify({ playerName, questionIds })
    });

    state.sessionId = result.sessionId;
    state.playQuestions = result.questions;

    $("pickList").classList.add("hidden");
    $("startPlay").classList.add("hidden");

    $("answers").innerHTML = result.questions.map((q, i) => `
      <div class="question-card">
        <h3>${i + 1}. ${esc(q.prompt)}</h3>
        ${q.options.map(option => `
          <label>
            <input type="radio" name="answer-${q.id}" value="${esc(option)}">
            ${esc(option)}
          </label>
        `).join("")}
      </div>
    `).join("") + `<button type="button" id="submitPlay" class="glow">উত্তর জমা দাও</button>`;

    $("submitPlay").addEventListener("click", submitPlay);
  } catch (error) {
    alert(fail(error));
  }
});

async function submitPlay() {
  const answers = {};

  for (const q of state.playQuestions) {
    const selected = document.querySelector(`input[name="answer-${q.id}"]:checked`);
    if (!selected) return alert("সব প্রশ্নের উত্তর দাও।");
    answers[q.id] = selected.value;
  }

  try {
    const result = await api(`/api/sessions/${encodeURIComponent(state.sessionId)}/submit`, {
      method: "POST",
      body: JSON.stringify({
        playerName: $("playerName").value.trim(),
        answers
      })
    });

    $("score").textContent = `তোমার স্কোর: ${result.score}/${result.total}`;
    $("submitPlay").disabled = true;
  } catch (error) {
    alert(fail(error));
  }
}

/* WEBSITE QUESTIONS */

async function loadWebsiteQuestions() {
  const container = $("websiteQuestionList");
  container.textContent = "প্রশ্ন লোড হচ্ছে…";

  try {
    state.websiteQuestions = await api("/api/website-questions");

    if (!state.websiteQuestions.length) {
      container.textContent = "এখনও কোনো প্রশ্ন যোগ করা হয়নি।";
      return;
    }

    container.innerHTML = state.websiteQuestions.map((q, i) => `
      <div class="question-card">
        <h3>${i + 1}. ${esc(q.question)}</h3>
        ${(Array.isArray(q.options) ? q.options : []).map(option => `
          <label>
            <input type="radio" name="web-${q.id}" value="${esc(option)}">
            ${esc(option)}
          </label>
        `).join("")}
      </div>
    `).join("");
  } catch (error) {
    container.textContent = fail(error);
  }
}

$("submitWebsiteAnswers")?.addEventListener("click", async () => {
  const playerName = $("websitePlayerName").value.trim();
  if (!playerName) return alert("তোমার নাম লিখো।");
  if (!state.websiteQuestions.length) return alert("প্রশ্ন উপলভ্য নেই।");

  const answers = {};

  for (const q of state.websiteQuestions) {
    const selected = document.querySelector(`input[name="web-${q.id}"]:checked`);
    if (!selected) return alert("সব প্রশ্নের উত্তর দাও।");
    answers[q.id] = selected.value;
  }

  try {
    const result = await api("/api/website-answers", {
      method: "POST",
      body: JSON.stringify({ playerName, answers })
    });
    msg("websiteScore", `তোমার স্কোর: ${result.score}/${result.total}`);
  } catch (error) {
    msg("websiteScore", fail(error), true);
  }
});

/* PUBLIC QUESTIONS */

async function loadPublicQuestions() {
  try {
    const questions = await api("/api/public-questions");
    $("publicQuestionList").innerHTML = questions.length
      ? questions.map(q => `<div class="question-card">${esc(q.question)}</div>`).join("")
      : "<p>এখনও কোনো অনুমোদিত প্রশ্ন নেই।</p>";
  } catch (error) {
    $("publicQuestionList").textContent = fail(error);
  }
}

$("submitPublicQuestion")?.addEventListener("click", async () => {
  try {
    await api("/api/public-questions", {
      method: "POST",
      body: JSON.stringify({
        name: $("publicName").value.trim(),
        question: $("publicQuestion").value.trim()
      })
    });

    $("publicQuestion").value = "";
    msg("publicMessage", "প্রশ্ন জমা হয়েছে। অনুমোদনের পর প্রকাশিত হবে।");
    await loadPublicQuestions();
  } catch (error) {
    msg("publicMessage", fail(error), true);
  }
});

/* PROFILE */

async function loadProfile() {
  try {
    const profile = await api("/api/settings");
    $("profileName").textContent = profile.displayName || "Your Name";

    if (profile.avatar) {
      $("largeAvatar").innerHTML =
        `<img src="${esc(profile.avatar)}" alt="Avatar">`;
    } else {
      $("largeAvatar").textContent = "✧";
    }

    $("socialLinks").innerHTML = (profile.links || [])
      .filter(x => x.label && /^https?:\/\//i.test(x.url || ""))
      .map(x => `<p><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.label)}</a></p>`)
      .join("") || "<p>এখনও কোনো লিংক নেই।</p>";
  } catch (error) {
    console.error(error);
  }
}

/* ADMIN */

async function checkAdmin() {
  try {
    await api("/api/admin/me");
    $("adminTools").classList.remove("hidden");
    await loadAdminData();
  } catch {
    $("adminTools").classList.add("hidden");
  }
}

$("adminLogin")?.addEventListener("submit", async event => {
  event.preventDefault();

  try {
    await api("/creator-room-7f3c/login", {
      method: "POST",
      body: JSON.stringify({ password: $("adminPassword").value })
    });

    $("adminPassword").value = "";
    $("adminMessage").textContent = "Login সফল হয়েছে।";
    await checkAdmin();
  } catch (error) {
    $("adminMessage").textContent = fail(error);
  }
});

async function loadAdminData() {
  try {
    const profile = await api("/api/settings");
    $("displayName").value = profile.displayName || "";
    $("avatarUrl").value = profile.avatar || "";
    renderLinks(profile.links || []);
  } catch (error) {
    $("adminMessage").textContent = fail(error);
  }

  await Promise.all([
    loadAdminQuizzes(),
    loadAdminPublicQuestions(),
    loadAdminWebsiteQuestions(),
    loadAdminWebsiteAnswers()
  ]);
}

function renderLinks(links) {
  state.links = links.map(x => ({
    label: x.label || "",
    url: x.url || ""
  }));

  $("linkEditor").innerHTML = state.links.map((x, i) => `
    <div class="question-card">
      <label>Link name
        <input data-link-label="${i}" value="${esc(x.label)}">
      </label>
      <label>URL
        <input data-link-url="${i}" value="${esc(x.url)}">
      </label>
      <button type="button" data-remove-link="${i}">মুছুন</button>
    </div>
  `).join("");

  $("linkEditor").querySelectorAll("[data-link-label]").forEach(el => {
    el.addEventListener("input", () => state.links[+el.dataset.linkLabel].label = el.value);
  });

  $("linkEditor").querySelectorAll("[data-link-url]").forEach(el => {
    el.addEventListener("input", () => state.links[+el.dataset.linkUrl].url = el.value);
  });

  $("linkEditor").querySelectorAll("[data-remove-link]").forEach(el => {
    el.addEventListener("click", () => {
      state.links.splice(+el.dataset.removeLink, 1);
      renderLinks(state.links);
    });
  });
}

$("addLink")?.addEventListener("click", () => {
  if (state.links.length >= 30) return alert("সর্বোচ্চ ৩০টি লিংক রাখা যাবে।");
  state.links.push({ label: "", url: "" });
  renderLinks(state.links);
});

$("saveProfile")?.addEventListener("click", async () => {
  try {
    await api("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify({
        displayName: $("displayName").value.trim(),
        avatar: $("avatarUrl").value.trim(),
        links: state.links
      })
    });

    alert("Profile সেভ হয়েছে।");
    await loadProfile();
  } catch (error) {
    alert(fail(error));
  }
});

async function loadAdminQuizzes() {
  const container = $("quizAdmin");

  try {
    const quizzes = await api("/api/admin/quizzes");
    container.innerHTML = quizzes.map(q => `
      <div class="question-card">
        <p>${esc(q.creator_name)} — ${q.question_count} প্রশ্ন</p>
        <p>জমা উত্তর: ${q.submission_count}</p>
        <button type="button" data-results="${esc(q.id)}">ফলাফল দেখুন</button>
        <div id="results-${esc(q.id)}"></div>
      </div>
    `).join("") || "<p>কোনো কুইজ নেই।</p>";

    container.querySelectorAll("[data-results]").forEach(button => {
      button.addEventListener("click", () => loadResults(button.dataset.results));
    });
  } catch (error) {
    container.textContent = fail(error);
  }
}

async function loadResults(id) {
  const container = $(`results-${id}`);
  try {
    const results = await api(`/api/admin/quizzes/${encodeURIComponent(id)}/results`);
    container.innerHTML = results.map(r =>
      `<p>${esc(r.player_name)}: ${r.score}/${r.total}</p>`
    ).join("") || "<p>কোনো ফলাফল নেই।</p>";
  } catch (error) {
    container.textContent = fail(error);
  }
}

async function loadAdminPublicQuestions() {
  const container = $("adminPublicQuestions");

  try {
    const questions = await api("/api/admin/public-questions");
    container.innerHTML = questions.map(q => `
      <div class="question-card">
        <p>${esc(q.question)}</p>
        <p>প্রেরক: ${esc(q.submitter_name)}</p>
        <button type="button" data-review="${q.id}" data-status="approved">অনুমোদন</button>
        <button type="button" data-review="${q.id}" data-status="rejected">বাতিল</button>
      </div>
    `).join("") || "<p>পর্যালোচনার জন্য কোনো প্রশ্ন নেই।</p>";

    container.querySelectorAll("[data-review]").forEach(button => {
      button.addEventListener("click", async () => {
        try {
          await api(`/api/admin/public-questions/${button.dataset.review}`, {
            method: "PUT",
            body: JSON.stringify({ status: button.dataset.status })
          });
          await loadAdminPublicQuestions();
          await loadPublicQuestions();
        } catch (error) {
          alert(fail(error));
        }
      });
    });
  } catch (error) {
    container.textContent = fail(error);
  }
}

async function loadAdminWebsiteQuestions() {
  const container = $("adminWebsiteQuestions");

  try {
    const questions = await api("/api/website-questions");
    container.innerHTML = questions.map(q => `
      <div class="question-card">
        <p>${esc(q.question)}</p>
        <p>${(q.options || []).map(esc).join(" · ")}</p>
        <button type="button" data-delete-web="${q.id}">মুছুন</button>
      </div>
    `).join("") || "<p>কোনো সক্রিয় প্রশ্ন নেই।</p>";

    container.querySelectorAll("[data-delete-web]").forEach(button => {
      button.addEventListener("click", async () => {
        if (!confirm("এই প্রশ্নটি মুছে ফেলবেন?")) return;

        try {
          await api(`/api/admin/website-questions/${button.dataset.deleteWeb}`, {
            method: "DELETE"
          });
          await loadAdminWebsiteQuestions();
          await loadWebsiteQuestions();
        } catch (error) {
          alert(fail(error));
        }
      });
    });
  } catch (error) {
    container.textContent = fail(error);
  }
}

/* ADMIN: ADD WEBSITE QUESTION */

function renderWebsiteOptions(options = ["", ""]) {
  $("newWebsiteOptions").innerHTML = `
    ${options.map((option, i) => `
      <label>অপশন ${i + 1}
        <input data-new-option="${i}" value="${esc(option)}" maxlength="120">
      </label>
    `).join("")}
    <label>সঠিক উত্তর
      <select id="newCorrect">
        <option value="">সঠিক উত্তর বেছে নাও</option>
        ${options.filter(x => x.trim()).map(x =>
          `<option value="${esc(x)}">${esc(x)}</option>`
        ).join("")}
      </select>
    </label>
  `;
}

renderWebsiteOptions();

$("addWebsiteQuestion")?.addEventListener("click", () => {
  const options = [...$("newWebsiteOptions").querySelectorAll("[data-new-option]")]
    .map(el => el.value);

  if (options.length >= 12) return alert("সর্বোচ্চ ১২টি অপশন রাখা যাবে।");
  options.push("");
  renderWebsiteOptions(options);
});

$("saveWebsiteQuestion")?.addEventListener("click", async () => {
  const question = $("newWebsiteQuestion").value.trim();
  const options = [...$("newWebsiteOptions").querySelectorAll("[data-new-option]")]
    .map(el => el.value.trim()).filter(Boolean);
  const correctAnswer = $("newCorrect")?.value || "";

  if (!question || options.length < 2 ||
      new Set(options).size !== options.length ||
      !correctAnswer || !options.includes(correctAnswer)) {
    return msg("websiteAdminMessage", "প্রশ্ন, আলাদা অপশন ও সঠিক উত্তর দিন।", true);
  }

  try {
    await api("/api/admin/website-questions", {
      method: "POST",
 
