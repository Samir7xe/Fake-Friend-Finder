/* ==========================================
   REAL FRIEND FINDER
   Complete public/app.js replacement
   ========================================== */

const $ = (id) => document.getElementById(id);

const ids = [
  "home",
  "create",
  "editor",
  "play",
  "how",
  "profile",
  "admin",
  "publicMode",
  "websiteMode"
];

let draft = [];
let quiz = null;
let sessionId = "";
let player = "";
let adminLinks = [
  { label: "Instagram", url: "" },
  { label: "Facebook", url: "" },
  { label: "YouTube", url: "" }
];

let selectedWebsiteAnswers = {};
let musicObjectUrl = null;

/* ---------- GENERAL HELPERS ---------- */

function on(id, event, callback) {
  const element = $(id);
  if (element) element.addEventListener(event, callback);
}

function message(id, text, isError = false) {
  const element = $(id);
  if (!element) return;

  element.textContent = text;
  element.style.color = isError ? "#ff7474" : "#76e6ad";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

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

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed (${response.status})`);
  }

  return data;
}

function show(id) {
  ids.forEach((sectionId) => {
    const section = $(sectionId);
    if (section) section.classList.toggle("hidden", sectionId !== id);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value ?? "";
}

function setHTML(id, value) {
  const element = $(id);
  if (element) element.innerHTML = value;
}

/* ---------- HOME NAVIGATION ---------- */

on("createBtn", "click", () => {
  draft = [];
  show("create");
  renderDraft();
});

on("howBtn", "click", () => show("how"));

on("websiteModeBtn", "click", async () => {
  show("websiteMode");
  await loadWebsiteQuestions();
});

on("publicModeBtn", "click", async () => {
  show("publicMode");
  await loadPublicQuestions();
});

on("profileBtn", "click", async () => {
  show("profile");
  await loadProfile();
});

on("homeBtn", "click", () => show("home"));

document.querySelectorAll("[data-show]").forEach((button) => {
  button.addEventListener("click", () => show(button.dataset.show));
});

/* ---------- CUSTOM QUIZ BUILDER ---------- */

function renderDraft() {
  const container = $("questionEditor");
  if (!container) return;

  container.innerHTML = "";

  draft.forEach((question, index) => {
    const card = document.createElement("div");
    card.className = "question-card";

    card.innerHTML = `
      <h3>প্রশ্ন ${index + 1}</h3>

      <label>প্রশ্ন লিখুন</label>
      <input class="draft-prompt" value="${escapeHTML(question.prompt)}"
        placeholder="প্রশ্ন লিখুন">

      <label>চারটি অপশন লিখুন</label>
      <div class="draft-options">
        ${question.options.map((option, optionIndex) => `
          <input class="draft-option" data-option="${optionIndex}"
            value="${escapeHTML(option)}"
            placeholder="অপশন ${optionIndex + 1}">
        `).join("")}
      </div>

      <label>সঠিক উত্তর নির্বাচন করুন</label>
      <select class="draft-correct">
        ${question.options.map((option, optionIndex) => `
          <option value="${optionIndex}"
            ${optionIndex === question.correctIndex ? "selected" : ""}>
            অপশন ${optionIndex + 1}
          </option>
        `).join("")}
      </select>

      <button type="button" class="remove-question">প্রশ্ন মুছুন</button>
    `;

    const promptInput = card.querySelector(".draft-prompt");
    promptInput.addEventListener("input", () => {
      question.prompt = promptInput.value;
    });

    card.querySelectorAll(".draft-option").forEach((input) => {
      input.addEventListener("input", () => {
        question.options[Number(input.dataset.option)] = input.value;
        updateCorrectOptions(card, question);
      });
    });

    card.querySelector(".draft-correct").addEventListener("change", (event) => {
      question.correctIndex = Number(event.target.value);
    });

    card.querySelector(".remove-question").addEventListener("click", () => {
      draft.splice(index, 1);
      renderDraft();
    });

    container.appendChild(card);
  });

  setText("draftCount", `মোট প্রশ্ন: ${draft.length}`);
}

function updateCorrectOptions(card, question) {
  const select = card.querySelector(".draft-correct");
  if (!select) return;

  const previousIndex = question.correctIndex;
  select.innerHTML = question.options.map((option, index) => `
    <option value="${index}" ${index === previousIndex ? "selected" : ""}>
      অপশন ${index + 1}
    </option>
  `).join("");
}

on("addQuestion", "click", () => {
  if (draft.length >= 30) {
    alert("সর্বোচ্চ ৩০টি প্রশ্ন যোগ করতে পারবেন।");
    return;
  }

  draft.push({
    prompt: "",
    options: ["", "", "", ""],
    correctIndex: 0
  });

  renderDraft();
});

on("generateQuestions", "click", () => {
  const countInput = $("questionCount");
  const count = Number(countInput?.value || 20);

  if (!Number.isInteger(count) || count < 20 || count > 30) {
    alert("২০ থেকে ৩০টির মধ্যে প্রশ্নের সংখ্যা নির্বাচন করুন।");
    return;
  }

  draft = Array.from({ length: count }, () => ({
    prompt: "",
    options: ["", "", "", ""],
    correctIndex: 0
  }));

  renderDraft();
});

on("saveQuiz", "click", async () => {
  const creatorName = $("creatorName")?.value.trim() || "";
  const creatorGender = $("creatorGender")?.value || "";

  if (!creatorName) {
    alert("আপনার নাম লিখুন।");
    return;
  }

  if (draft.length < 20 || draft.length > 30) {
    alert("কুইজে ২০–৩০টি প্রশ্ন রাখতে হবে।");
    return;
  }

  const questions = draft.map((question, index) => ({
    prompt: question.prompt.trim(),
    options: question.options.map((option) => option.trim()),
    correctAnswer: question.options[question.correctIndex]?.trim() || ""
  }));

  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];

    if (!question.prompt) {
      alert(`প্রশ্ন ${index + 1} লিখুন।`);
      return;
    }

    if (
      question.options.some((option) => !option) ||
      new Set(question.options).size !== question.options.length
    ) {
      alert(`প্রশ্ন ${index + 1}-এর চারটি আলাদা অপশন লিখুন।`);
      return;
    }

    if (!question.correctAnswer) {
      alert(`প্রশ্ন ${index + 1}-এর সঠিক উত্তর নির্বাচন করুন।`);
      return;
    }
  }

  const button = $("saveQuiz");
  if (button) button.disabled = true;

  try {
    const result = await api("/api/quizzes", {
      method: "POST",
      body: JSON.stringify({
        creatorName,
        creatorGender,
        questions
      })
    });

    const shareUrl = result.shareUrl
      ? new URL(result.shareUrl, location.origin).href
      : `${location.origin}/play/${encodeURIComponent(result.id)}`;

    setText("shareUrl", shareUrl);

    const output = $("shareResult");
    if (output) output.classList.remove("hidden");

    show("editor");
  } catch (error) {
    alert("কুইজ তৈরি করা যায়নি: " + error.message);
  } finally {
    if (button) button.disabled = false;
  }
});

on("copyShareUrl", "click", async () => {
  const url = $("shareUrl")?.textContent.trim();

  if (!url) {
    alert("আগে কুইজ তৈরি করুন।");
    return;
  }

  try {
    await navigator.clipboard.writeText(url);
    alert("কুইজের লিংক কপি হয়েছে!");
  } catch {
    prompt("এই লিংকটি কপি করুন:", url);
  }
});

/* ---------- PLAY A SHARED QUIZ ---------- */

async function loadQuiz(id) {
  show("play");

  try {
    quiz = await api(`/api/quizzes/${encodeURIComponent(id)}`);

    setText("playTitle", `${quiz.creatorName || "বন্ধু"}-র কুইজ`);
    setText("playDescription", "নিজের উত্তর বেছে নিয়ে কুইজ শুরু করুন।");

    const list = $("playQuestionList");
    if (!list) return;

    list.innerHTML = "";

    (quiz.questions || []).forEach((question) => {
      const label = document.createElement("label");
      label.className = "question-select";

      label.innerHTML = `
        <input type="checkbox" value="${escapeHTML(question.id)}">
        <span>${escapeHTML(question.prompt)}</span>
      `;

      list.appendChild(label);
    });

    setText("playQuestionCount", `মোট প্রশ্ন: ${(quiz.questions || []).length}`);
  } catch (error) {
    setText("playDescription", "কুইজটি লোড করা যায়নি: " + error.message);
  }
}

on("startQuiz", "click", async () => {
  if (!quiz) {
    alert("প্রথমে একটি কুইজ খুলুন।");
    return;
  }

  player = $("playerName")?.value.trim() || "";

  if (!player) {
    alert("আপনার নাম লিখুন।");
    return;
  }

  const questionIds = Array.from(
    document.querySelectorAll("#playQuestionList input:checked")
  ).map((input) => input.value);

  if (questionIds.length !== 10) {
    alert("ঠিক ১০টি প্রশ্ন নির্বাচন করুন।");
    return;
  }

  try {
    const result = await api(`/api/quizzes/${encodeURIComponent(quiz.id)}/start`, {
      method: "POST",
      body: JSON.stringify({ playerName: player, questionIds })
    });

    sessionId = result.sessionId;

    const container = $("answerQuestionList");
    if (!container) return;

    container.innerHTML = "";

    result.questions.forEach((question, index) => {
      const card = document.createElement("div");
      card.className = "question-card";

      card.innerHTML = `
        <h3>${index + 1}. ${escapeHTML(question.prompt)}</h3>
        ${(question.options || []).map((option) => `
          <label>
            <input type="radio" name="answer-${escapeHTML(question.id)}"
              value="${escapeHTML(option)}">
            ${escapeHTML(option)}
          </label>
        `).join("")}
      `;

      container.appendChild(card);
    });

    show("editor");
    const answerSection = $("quizAnswerSection");
    if (answerSection) answerSection.classList.remove("hidden");

    setText("answerMessage", "");
  } catch (error) {
    alert("কুইজ শুরু করা যায়নি: " + error.message);
  }
});

on("submitQuizAnswers", "click", async () => {
  if (!sessionId) {
    alert("প্রথমে কুইজ শুরু করুন।");
    return;
  }

  const answers = {};

  document.querySelectorAll("#answerQuestionList input:checked").forEach((input) => {
    const match = input.name.match(/^answer-(.+)$/);
    if (match) answers[match[1]] = input.value;
  });

  try {
    const result = await api(`/api/sessions/${encodeURIComponent(sessionId)}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers })
    });

    setText("answerMessage", `আপনার স্কোর: ${result.score} / ${result.total}`);
    sessionId = "";
  } catch (error) {
    setText("answerMessage", "উত্তর জমা হয়নি: " + error.message);
  }
});

/* ---------- PUBLIC QUESTION SUGGESTIONS ---------- */

async function loadPublicQuestions() {
  const container = $("publicQuestionList");
  if (!container) return;

  container.innerHTML = "<p>প্রশ্ন লোড হচ্ছে...</p>";

  try {
    const result = await api("/api/public-questions");
    const questions = Array.isArray(result) ? result : result.questions || [];

    if (!questions.length) {
      container.innerHTML = "<p>এখনও কোনো অনুমোদিত প্রশ্ন নেই।</p>";
      return;
    }

    container.innerHTML = questions.map((item) => `
      <article class="question-card">
        <p>${escapeHTML(item.question)}</p>
        <small>প্রস্তাব করেছেন: ${escapeHTML(item.name || "একজন বন্ধু")}</small>
      </article>
    `).join("");
  } catch (error) {
    container.innerHTML =
      `<p>প্রশ্ন লোড করা যায়নি: ${escapeHTML(error.message)}</p>`;
  }
}

on("submitPublicQuestion", "click", async () => {
  const name = $("publicQuestionName")?.value.trim() || "";
  const question = $("publicQuestionText")?.value.trim() || "";

  if (!question) {
    alert("আপনার প্রশ্নটি লিখুন।");
    return;
  }

  try {
    await api("/api/public-questions", {
      method: "POST",
      body: JSON.stringify({ name, question })
    });

    message("publicQuestionMessage", "প্রশ্ন জমা হয়েছে। অনুমোদনের পর দেখা যাবে।");

    if ($("publicQuestionText")) $("publicQuestionText").value = "";
    await loadPublicQuestions();
  } catch (error) {
    message("publicQuestionMessage", error.message, true);
  }
});

/* ---------- WEBSITE QUESTION BANK ---------- */

async function loadWebsiteQuestions() {
  const container = $("websiteQuestionList");
  if (!container) return;

  container.innerHTML = "<p>প্রশ্ন লোড হচ্ছে...</p>";
  selectedWebsiteAnswers = {};

  try {
    const result = await api("/api/website-questions");
    const questions = Array.isArray(result) ? result : result.questions || [];

    if (!questions.length) {
      container.innerHTML = `
        <p>এখনও কোনো প্রশ্ন যোগ করা হয়নি।</p>
        <p>প্রশাসককে প্রশ্ন যোগ করতে হবে।</p>
      `;
      return;
    }

    container.innerHTML = "";

    questions.forEach((question, index) => {
      const card = document.createElement("div");
      card.className = "question-card";

      card.innerHTML = `
        <h3>${index + 1}. ${escapeHTML(question.question)}</h3>
        ${(question.options || []).map((option) => `
          <label>
            <input type="radio" name="website-${escapeHTML(question.id)}"
              value="${escapeHTML(option)}">
            ${escapeHTML(option)}
          </label>
        `).join("")}
      `;

      card.querySelectorAll("input").forEach((input) => {
        input.addEventListener("change", () => {
          selectedWebsiteAnswers[question.id] = input.value;
        });
      });

      container.appendChild(card);
    });

    setText("websiteQuestionCount", `মোট প্রশ্ন: ${questions.length}`);
  } catch (error) {
    container.innerHTML = `
      <p>ওয়েবসাইটের প্রশ্ন লোড করা যায়নি।</p>
      <p>${escapeHTML(error.message)}</p>
      <p>ডেটাবেস টেবিল ও সার্ভারের সেটিংস পরীক্ষা করতে হবে।</p>
    `;
  }
}

on("submitWebsiteAnswers", "click", async () => {
  const playerName = $("websitePlayerName")?.value.trim() || "";

  if (!playerName) {
    alert("আপনার নাম লিখুন।");
    return;
  }

  if (!Object.keys(selectedWebsiteAnswers).length) {
    alert("অন্তত একটি প্রশ্নের উত্তর দিন।");
    return;
  }

  try {
    const result = await api("/api/website-answers", {
      method: "POST",
      body: JSON.stringify({
        playerName,
        answers: selectedWebsiteAnswers
      })
    });

    setText("websiteScore", `আপনার স্কোর: ${result.score} / ${result.total}`);

    const resultBox = $("websiteScoreResult");
    if (resultBox) resultBox.classList.remove("hidden");
  } catch (error) {
    message("websiteScore", "উত্তর জমা হয়নি: " + error.message, true);
  }
});

/* ---------- PROFILE AND SOCIAL LINKS ---------- */

function setAvatar(url) {
  const bubble = $("profileBubble");
  if (!bubble) return;

  if (url) {
    bubble.innerHTML = `
      <img src="${escapeHTML(url)}" alt="Profile photo"
        style="width:100%;height:100%;object-fit:cover;border-radius:50%">
    `;
  } else {
    bubble.textContent = "S";
  }
}

async function loadProfile() {
  try {
    const settings = await api("/api/settings");

    setText("profileName", settings.profileName || "Samir Akhtar");
    setText("displayName", settings.profileName || "Samir Akhtar");

    const avatarInput = $("avatarUrl");
    if (avatarInput) avatarInput.value = settings.avatarUrl || "";

    setAvatar(settings.avatarUrl || "");

    adminLinks = Array.isArray(settings.socialLinks)
      ? settings.socialLinks
      : adminLinks;

    const container = $("socialLinks");
    if (container) {
      container.innerHTML = adminLinks
        .filter((link) => link.url)
        .map((link) => `
          <a href="${escapeHTML(link.url)}" target="_blank"
            rel="noopener noreferrer">${escapeHTML(link.label)}</a>
        `).join("");
    }

    renderLinkEditor();
  } catch (error) {
    console.error("Profile loading failed:", error);
  }
}

function renderLinkEditor() {
  const container = $("linkEditor");
  if (!container) return;

  container.innerHTML = adminLinks.map((link, index) => `
    <div class="social-edit-row">
      <input data-link-label="${index}" value="${escapeHTML(link.label)}"
        placeholder="Social platform">
      <input data-link-url="${index}" value="${escapeHTML(link.url)}"
        placeholder="https://...">
    </div>
  `).join("");
}

on("addLink", "click", () => {
  adminLinks.push({ label: "", url: "" });
  renderLinkEditor();
});

on("saveProfile", "click", async () => {
  adminLinks = adminLinks.map((link, index) => ({
    label: $(`linkLabel${index}`)?.value || link.label,
    url: $(`linkUrl${index}`)?.value || link.url
  }));

  const container = $("linkEditor");

  if (container) {
    container.querySelectorAll("[data-link-label]").forEach((input) => {
      const index = Number(input.dataset.linkLabel);
      if (adminLinks[index]) adminLinks[index].label = input.value.trim();
    });

    container.querySelectorAll("[data-link-url]").forEach((input) => {
      const index = Number(input.dataset.linkUrl);
      if (adminLinks[index]) adminLinks[index].url = input.value.trim();
    });
  }

  try {
    await api("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify({
        profileName: $("profileNameInput")?.value.trim() || "Samir Akhtar",
        avatarUrl: $("avatarUrl")?.value.trim() || "",
        socialLinks: adminLinks
      })
    });

    message("profileMessage", "প্রোফাইল সংরক্ষণ হয়েছে।");
    await loadProfile();
  } catch (error) {
    message("profileMessage", error.message, true);
  }
});

/* ---------- ADMIN LOGIN ---------- */

async function checkAdmin() {
  try {
    const result = await api("/api/admin/me");
    if (result.authenticated) showAdminTools();
  } catch {
    // Not logged in.
  }
}

function showAdminTools() {
  const login = $("adminLogin");
  const tools = $("adminTools");

  if (login) login.classList.add("hidden");
  if (tools) tools.classList.remove("hidden");

  loadAdminQuizzes();
  loadAdminPublicQuestions();
  loadAdminWebsiteAnswers();
  loadWebsiteAdminQuestions();
}

on("adminLogin", "submit", async (event) => {
  event.preventDefault();

  const password = $("adminPassword")?.value || "";

  try {
    await api("/creator-room-7f3c/login", {
      method: "POST",
      body: JSON.stringify({ password })
    });

    message("adminMessage", "লগইন সফল হয়েছে।");
    showAdminTools();
  } catch (error) {
    message("adminMessage", error.message, true);
  }
});

on("logout", "click", async () => {
  try {
    await api("/creator-room-7f3c/logout", { method: "POST" });
  } catch {
    // Continue to hide admin tools.
  }

  const tools = $("adminTools");
  const login = $("adminLogin");

  if (tools) tools.classList.add("hidden");
  if (login) login.classList.remove("hidden");

  show("home");
});

/* ---------- ADMIN: QUIZ RESULTS ---------- */

async function loadAdminQuizzes() {
  const container = $("quizAdmin");
  if (!container) return;

  try {
    const result = await api("/api/admin/quizzes");
    const quizzes = Array.isArray(result) ? result : result.quizzes || [];

    container.innerHTML = quizzes.map((item) => `
      <div class="question-card">
        <p>${escapeHTML(item.creator_name || item.creatorName || "কুইজ")}</p>
        <button type="button" data-results="${escapeHTML(item.id)}">
          ফলাফল দেখুন
        </button>
        <div id="results-${escapeHTML(item.id)}"></div>
      </div>
    `).join("");

    container.querySelectorAll("[data-results]").forEach((button) => {
      button.addEventListener("click", () => loadQuizResults(button.dataset.results));
    });
  } catch (error) {
    contain
