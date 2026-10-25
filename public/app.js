
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

  if (!response.ok) {
    throw new Error(data.error || `Error ${response.status}`);
  }

  return data;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
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

function show(id) {
  document.querySelectorAll(".view").forEach(el => {
    el.classList.toggle("hidden", el.id !== id);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
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

$("profileBubble")?.addEventListener("click", async () => {
  show("profile");
  await loadProfile();
});

$("closeProfile")?.addEventListener("click", () => show("home"));

/* CUSTOM QUIZ */

$("build")?.addEventListener("click", () => {
  if (!$("creatorName").value.trim()) {
    alert("আগে তোমার নাম লিখো।");
    $("creatorName").focus();
    return;
  }

  const count = Number($("count").value);

  if (!Number.isInteger(count) || count < 1 || count > 100) {
    alert("১ থেকে ১০০টি প্রশ্ন বেছে নাও।");
    return;
  }

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
  if (!container) return;

  container.innerHTML = state.customQuestions.map((q, i) => `
    <div class="question-card">
      <h3>প্রশ্ন ${i + 1}</h3>

      <label>প্রশ্ন
        <textarea data-prompt="${i}" maxlength="300">${esc(q.prompt)}</textarea>
      </label>

      ${q.options.map((option, j) => `
        <label>অপশন ${j + 1}
          <input data-option="${i}:${j}"
            maxlength="120" value="${esc(option)}">
        </label>
      `).join("")}

      <button type="button" data-add-option="${i}">
        ＋ অপশন যোগ
      </button>

      <label>সঠিক উত্তর
        <select data-correct="${i}">
          <option value="">বেছে নাও</option>
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

      q.options[oi] = el.value;

      if (q.correctAnswer !== el.value &&
          !q.options.includes(q.correctAnswer)) {
        q.correctAnswer = "";
      }

      const select = container.querySelector(`[data-correct="${qi}"]`);
      const previous = q.correctAnswer;

      select.innerHTML = `<option value="">বেছে নাও</option>` +
        q.options.filter(x => x.trim()).map(option => `
          <option value="${esc(option)}">${esc(option)}</option>
        `).join("");

      select.value = previous;
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

      if (q.options.length >= 12) {
        alert("সর্বোচ্চ ১২টি অপশন রাখা যাবে।");
        return;
      }

      q.options.push("");
      renderEditor();
    });
  });
}

$("addQuestion")?.addEventListener("click", () => {
  if (state.customQuestions.length >= 100) {
    alert("সর্বোচ্চ ১০০টি প্রশ্ন রাখা যাবে।");
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
    box.textContent = "";

    const p = document.createElement("p");
    p.textContent = "🎉 কুইজ তৈরি হয়েছে!";
    box.appendChild(p);

    const link = document.createElement("a");
    link.href = result.shareUrl;
    link.textContent = result.shareUrl;
    box.appendChild(link);

    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "লিংক কপি করো";

    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(result.shareUrl);
        alert("লিংক কপি হয়েছে!");
      } catch {
        prompt("লিংক কপি করো:", result.shareUrl);
      }
    });

    box.appendChild(copy);
  } catch (error) {
    alert(fail(error));
  } finally {
    button.disabled = false;
  }
});

/* PLAY SHARED QUIZ */

async function loadQuiz(id) {
  try {
    const quiz = await api(`/api/quizzes/${encodeURIComponent(id)}`);

    $("playTitle").textContent = `${quiz.creatorName}-এর কুইজ`;

    $("pickList").innerHTML = quiz.questions.map(q => `
      <label class="question-card">
        <input type="checkbox" data-pick value="${esc(q.id)}">
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
  const questionIds = [
    ...document.querySelectorAll("[data-pick]:checked")
  ].map(el => Number(el.value));

  if (!playerName) return alert("তোমার নাম লিখো।");
  if (questionIds.length !== 10) {
    return alert("ঠিক ১০টি প্রশ্ন বেছে নাও।");
  }

  const match = location.pathname.match(/^\/play\/([^/]+)$/);
  if (!match) return alert("কুইজের লিংক সঠিক নয়।");

  try {
    const result = await api(
      `/api/quizzes/${encodeURIComponent(match[1])}/start`,
      {
        method: "POST",
        body: JSON.stringify({ playerName, questionIds })
      }
    );

    state.sessionId = result.sessionId;
    state.playQuestions = result.questions;

    $("pickList").classList.add("hidden");
    $("startPlay").classList.add("hidden");

    $("answers").innerHTML = result.questions.map((q, i) => `
      <div class="question-card">
        <h3>${i + 1}. ${esc(q.prompt)}</h3>
        ${q.options.map(option => `
          <label>
            <input type="radio" name="answer-${esc(q.id)}"
              value="${esc(option)}">
            ${esc(option)}
          </label>
        `).join("")}
      </div>
    `).join("") +
      `<button type="button" id="submitPlay">উত্তর জমা দাও</button>`;

    $("submitPlay").addEventListener("click", submitPlay);
  } catch (error) {
    alert(fail(error));
  }
});

async function submitPlay() {
  const answers = {};

  for (const q of state.playQuestions) {
    const selected = document.querySelector(
      `input[name="answer-${CSS.escape(String(q.id))}"]:checked`
    );

    if (!selected) return alert("সব প্রশ্নের উত্তর দাও।");
    answers[q.id] = selected.value;
  }

  try {
    const result = await api(
      `/api/sessions/${encodeURIComponent(state.sessionId)}/submit`,
      {
        method: "POST",
        body: JSON.stringify({
          playerName: $("playerName").value.trim(),
          answers
        })
      }
    );

    $("score").textContent = `তোমার স্কোর: ${result.score}/${result.total}`;
    $("submitPlay").disabled = true;
  } catch (error) {
    alert(fail(error));
  }
}

/* WEBSITE QUESTIONS — FRIEND QUIZ CREATOR */

async function loadWebsiteQuestions() {
  const container = $("websiteQuestionList");
  if (!container) return;

  const score = $("websiteScore");
  score.classList.add("hidden");
  score.textContent = "";
  container.textContent = "প্রশ্ন লোড হচ্ছে…";

  try {
    const data = await api("/api/website-questions");
    state.websiteQuestions = Array.isArray(data)
      ? data.filter(q =>
          q.active !== false &&
          Array.isArray(q.options) &&
          q.options.length >= 4
        )
      : [];

    const allQuestions = state.websiteQuestions;

    if (allQuestions.length < 10) {
      container.textContent =
        `কমপক্ষে ১০টি প্রশ্ন দরকার। এখন আছে ${allQuestions.length}টি।`;
      return;
    }

    container.innerHTML = `
      <style>
        .teddy-wrap{max-width:480px;margin:18px auto}
        .teddy-card{
          position:relative;background:linear-gradient(145deg,#fff1f6,#fff8e9);
          border:2px solid #efb9cb;border-radius:26px;padding:22px 17px;
          box-shadow:0 8px 22px #b66d8b22;overflow:hidden
        }
        .teddy-ears{font-size:34px;letter-spacing:35px}
        .teddy-face{font-size:52px;text-align:center;margin:0}
        .teddy-title{text-align:center;color:#a74d76}
        .teddy-progress{height:7px;background:#f4d9e4;border-radius:9px;overflow:hidden}
        .teddy-progress div{height:100%;background:#d879a2;transition:width .2s}
        .teddy-question{font-size:19px;text-align:center;font-weight:700;margin:20px 0}
        .teddy-option{
          display:flex;align-items:center;gap:10px;padding:12px;margin:9px 0;
          background:#fff;border:1px solid #f0cad8;border-radius:14px
        }
        .teddy-option:has(input:checked){background:#ffe4ef;border-color:#ce6591}
        .teddy-actions{display:flex;gap:10px;margin-top:18px}
        .teddy-actions button{flex:1;padding:12px;border:0;border-radius:13px;cursor:pointer}
        .teddy-next{background:#c65e8b;color:white}
        .teddy-back{background:#f5dce7;color:#813a5a}
      </style>

      <label>
        তোমার নাম
        <input id="friendCreatorName" maxlength="50" placeholder="নিজের নাম লেখো">
      </label>

      <label>
        কতটি প্রশ্ন থাকবে?
        <select id="friendQuestionCount">
          <option value="10">১০টি প্রশ্ন</option>
          <option value="15">১৫টি প্রশ্ন</option>
        </select>
      </label>

      <p>প্রথমে প্রশ্ন বেছে নাও।</p>
      <div id="friendQuestionPicker">
        ${allQuestions.map((q, i) => `
          <label class="question-card" style="display:block;margin:8px 0">
            <input type="checkbox" data-friend-pick value="${esc(q.id)}">
            ${i + 1}. ${esc(q.question)}
          </label>
        `).join("")}
      </div>

      <button type="button" id="friendChooseAnswers" class="glow">
        নিজের উত্তর বেছে নাও ➜
      </button>

      <div id="friendAnswerPicker"></div>
      <button type="button" id="friendCreateQuiz" class="glow hidden">
        কুইজ তৈরি করো ♡
      </button>
    `;

    const countSelect = $("friendQuestionCount");
    const picker = $("friendQuestionPicker");

    function updatePickerLimit() {
      const count = Number(countSelect.value);
      const checked = [...picker.querySelectorAll("[data-friend-pick]:checked")];

      picker.querySelectorAll("[data-friend-pick]").forEach(box => {
        box.disabled = !box.checked && checked.length >= count;
      });
    }

    picker.addEventListener("change", updatePickerLimit);
    countSelect.addEventListener("change", updatePickerLimit);

    $("friendChooseAnswers").addEventListener("click", () => {
      const name = $("friendCreatorName").value.trim();
      const count = Number(countSelect.value);
      const selected = [
        ...picker.querySelectorAll("[data-friend-pick]:checked")
      ];

      if (!name) return alert("আগে নিজের নাম লেখো।");

      if (selected.length !== count) {
        return alert(`ঠিক ${count}টি প্রশ্ন বেছে নাও।`);
      }

      const questions = selected.map(box =>
        allQuestions.find(q => String(q.id) === String(box.value))
      );

      if (questions.some(q => !q)) {
        return alert("প্রশ্ন খুঁজে পাওয়া যায়নি। আবার চেষ্টা করো।");
      }

      let current = 0;
      const answers = {};

      const answerPicker = $("friendAnswerPicker");
      const createButton = $("friendCreateQuiz");

      function renderAnswerQuestion() {
        const q = questions[current];

        answerPicker.innerHTML = `
          <div class="teddy-wrap">
            <div class="teddy-card">
              <div class="teddy-ears">🧸</div>
              <p class="teddy-face">🐻</p>
              <h3 class="teddy-title">তোমার কুইজ ♡</h3>
              <div class="teddy-progress">
                <div style="width:${((current + 1) / questions.length) * 100}%"></div>
              </div>
              <p style="text-align:center">প্রশ্ন ${current + 1} / ${questions.length}</p>
              <div class="teddy-question">${esc(q.question)}</div>
              ${q.options.map((option, j) => `
                <label class="teddy-option">
                  <input type="radio" name="teddy-answer" value="${j}"
                    ${answers[String(q.id)] === String(option) ? "checked" : ""}>
                  <span>${esc(option)}</span>
                </label>
              `).join("")}
              <div class="teddy-actions">
                <button type="button" class="teddy-back" id="teddyBack"
                  ${current === 0 ? "disabled" : ""}>← আগেরটি</button>
                <button type="button" class="teddy-next" id="teddyNext">
                  ${current === questions.length - 1 ? "শেষ ➜" : "পরেরটি ➜"}
                </button>
              </div>
            </div>
          </div>
        `;

        $("teddyBack").addEventListener("click", () => {
          const chosen = answerPicker.querySelector('input[name="teddy-answer"]:checked');
          if (chosen) answers[String(q.id)] = q.options[Number(chosen.value)];
          if (current > 0) {
            current--;
            renderAnswerQuestion();
          }
        });

        $("teddyNext").addEventListener("click", () => {
          const chosen = answerPicker.querySelector('input[name="teddy-answer"]:checked');

          if (!chosen) return alert("একটি উত্তর বেছে নাও।");

          answers[String(q.id)] = q.options[Number(chosen.value)];

          if (current < questions.length - 1) {
            current++;
            renderAnswerQuestion();
          } else {
            createButton.classList.remove("hidden");
            createButton.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        });
      }

      createButton.classList.add("hidden");
      renderAnswerQuestion();

      createButton.onclick = async () => {
        if (questions.some(q => answers[String(q.id)] === undefined)) {
          return alert("সব প্রশ্নের উত্তর বেছে নাও।");
        }

        createButton.disabled = true;

        try {
          const result = await api("/api/friend-quizzes", {
            method: "POST",
            body: JSON.stringify({
              creatorName: name,
              questions: questions.map(q => ({
                questionId: q.id,
                answer: answers[String(q.id)]
              }))
            })
          });

          score.classList.remove("hidden");
          score.textContent = "";

          const heading = document.createElement("p");
          heading.textContent = `🎉 ${name}, তোমার কুইজ তৈরি হয়েছে!`;
          score.appendChild(heading);

          const link = document.createElement("a");
          link.href = result.shareUrl;
          link.textContent = result.shareUrl;
          link.style.display = "block";
          link.style.overflowWrap = "anywhere";
          score.appendChild(link);

          const copy = document.createElement("button");
          copy.type = "button";
          copy.textContent = "লিংক কপি করো";

          copy.onclick = async () => {
            try {
              await navigator.clipboard.writeText(result.shareUrl);
              alert("লিংক কপি হয়েছে!");
            } catch {
              prompt("লিংক কপি করো:", result.shareUrl);
            }
          };

          score.appendChild(copy);
          score.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch (error) {
          alert(fail(error));
        } finally {
          createButton.disabled = false;
        }
      };
    });
  } catch (error) {
    container.textContent = fail(error);
  }
}

/* PUBLIC QUESTIONS */

async function loadPublicQuestions() {
  const container = $("publicQuestionList");
  if (!container) return;

  try {
    const questions = await api("/api/public-questions");

    container.innerHTML = questions.length
      ? questions.map(q =>
          `<div class="question-card">${esc(q.question)}</div>`
        ).join("")
      : "<p>এখনও কোনো অনুমোদিত প্রশ্ন নেই।</p>";
  } catch (error) {
    container.textContent = fail(error);
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

    if ($("profileName")) {
      $("profileName").textContent = profile.displayName || "Your Name";
    }

    if ($("largeAvatar")) {
      if (profile.avatar) {
        $("largeAvatar").innerHTML =
          `<img src="${esc(profile.avatar)}" alt="Avatar">`;
      } else {
        $("largeAvatar").textContent = "✧";
      }
    }

    if ($("socialLinks")) {
      $("socialLinks").innerHTML = (profile.links || [])
        .filter(x => x.label && /^https?:\/\//i.test(x.url || ""))
        .map(x =>
          `<p><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.label)}</a></p>`
        ).join("") || "<p>এখনও কোনো লিংক নেই।</p>";
    }
  } catch (error) {
    console.error(error);
  }
}

/* ADMIN */

async function checkAdmin() {
  try {
    await api("/api/admin/me");

    $("adminTools")?.classList.remove("hidden");
    await loadAdminData();
  } catch {
    $("adminTools")?.classList.add("hidden");
  }
}

$("adminLogin")?.addEventListener("submit", async event => {
  event.preventDefault();

  try {
    await api("/creator-room-7f3c/login", {
      method: "POST",
      body: JSON.stringify({
        password: $("adminPassword").value
      })
    });

    $("adminPassword").value = "";
    msg("adminMessage", "Login সফল হয়েছে।");
    await checkAdmin();
  } catch (error) {
    msg("adminMessage", fail(error), true);
  }
});

async function loadAdminData() {
  try {
    const profile = await api("/api/settings");

    if ($("displayName")) $("displayName").value = profile.displayName || "";
    if ($("avatarUrl")) $("avatarUrl").value = profile.avatar || "";

    renderLinks(profile.links || []);
  } catch (error) {
    msg("adminMessage", fail(error), true);
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

  const container = $("linkEditor");
  if (!container) return;

  container.innerHTML = state.links.map((x, i) => `
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

  container.querySelectorAll("[data-link-label]").forEach(el => {
    el.addEventListener("input", () => {
      state.links[+el.dataset.linkLabel].label = el.value;
    });
  });

  container.querySelectorAll("[data-link-url]").forEach(el => {
    el.addEventListener("input", () => {
      state.links[+el.dataset.linkUrl].url = el.value;
    });
  });

  container.querySelectorAll("[data-remove-link]").forEach(el => {
    el.addEventListener("click", () => {
      state.links.splice(+el.dataset.removeLink, 1);
      renderLinks(state.links);
    });
  });
}

$("addLink")?.addEventListener("click", () => {
  if (state.links.length >= 30) {
    alert("সর্বোচ্চ ৩০টি লিংক রাখা যাবে।");
    return;
  }

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
  if (!container) return;

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
  if (!container) return;

  try {
    const results = await api(
      `/api/admin/quizzes/${encodeURIComponent(id)}/results`
    );

    container.innerHTML = results.map(r =>
      `<p>${esc(r.player_name)}: ${r.score}/${r.total}</p>`
    ).join("") || "<p>কোনো ফলাফল নেই।</p>";
  } catch (error) {
    container.textContent = fail(error);
  }
}

async function loadAdminPublicQuestions() {
  const container = $("adminPublicQuestions");
  if (!container) return;

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
          await api(
            `/api/admin/public-questions/${button.dataset.review}`,
            {
              method: "PUT",
              body: JSON.stringify({ status: button.dataset.status })
            }
          );

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
  if (!container) return;

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
          await api(
            `/api/admin/website-questions/${button.dataset.deleteWeb}`,
            { method: "DELETE" }
          );

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

/* ADD WEBSITE QUESTION */

function renderWebsiteOptions(options = ["", "", "", ""]) {
  const container = $("newWebsiteOptions");
  if (!container) return;

  container.innerHTML = options.map((option, i) => `
    <label>অপশন ${i + 1}
      <input data-new-option="${i}"
        value="${esc(option)}" maxlength="120">
    </label>
  `).join("");
}

renderWebsiteOptions();

$("addWebsiteQuestion")?.addEventListener("click", () => {
  const options = [
    ...$("newWebsiteOptions").querySelectorAll("[data-new-option]")
  ].map(el => el.value);

  if (options.length >= 12) {
    alert("সর্বোচ্চ ১২টি অপশন রাখা যাবে।");
    return;
  }

  options.push("");
  renderWebsiteOptions(options);
});

$("saveWebsiteQuestion")?.addEventListener("click", async () => {
  const question = $("newWebsiteQuestion").value.trim();

  const options = [
    ...$("newWebsiteOptions").querySelectorAll("[data-new-option]")
  ].map(el => el.value.trim()).filter(Boolean);

  if (
    !question ||
    options.length < 4 ||
    new Set(options).size !== options.length
  ) {
    return msg(
      "websiteAdminMessage",
      "প্রশ্ন এবং অন্তত ৪টি আলাদা অপশন দিন।",
      true
    );
  }

  const button = $("saveWebsiteQuestion");
  button.disabled = true;

  try {
    await api("/api/admin/website-questions", {
      method: "POST",
      body: JSON.stringify({
        question,
        options,
        correctAnswer: options[0]
      })
    });

    $("newWebsiteQuestion").value = "";
    renderWebsiteOptions(["", "", "", ""]);

    msg("websiteAdminMessage", "প্রশ্ন সফলভাবে যোগ হয়েছে।");

    await loadAdminWebsiteQuestions();
    await loadWebsiteQuestions();
  } catch (error) {
    msg("websiteAdminMessage", fail(error), true);
  } finally {
    button.disabled = false;
  }
});

/* WEBSITE ANSWERS ADMIN */

async function loadAdminWebsiteAnswers() {
  const container = $("websiteAnswersAdmin");
  if (!container) return;

  try {
    const answers = await api("/api/admin/website-answers");

    container.innerHTML = answers.map(answer => `
      <div class="question-card">
        <p><strong>${esc(answer.player_name)}</strong></p>
        <p>স্কোর: ${Number(answer.score)}/${Number(answer.total)}</p>
      </div>
    `).join("") || "<p>এখনও কোনো উত্তর জমা পড়েনি।</p>";
  } catch (error) {
    container.textContent = fail(error);
  }
}

/* LOGOUT */

$("logout")?.addEventListener("click", async () => {
  try {
    await api("/creator-room-7f3c/logout", { method: "POST" });
    $("adminTools")?.classList.add("hidden");
    msg("adminMessage", "লগআউট হয়েছে।");
  } catch (error) {
    msg("adminMessage", fail(error), true);
  }
});

/* SOUND AND MUSIC */

$("soundToggle")?.addEventListener("change", () => {
  const button = $("soundToggle");
  button.setAttribute("aria-pressed", String(button.checked));
});

$("musicToggle")?.addEventListener("click", async () => {
  const music = $("bgMusic");
  if (!music) return;

  if (music.paused) {
    try {
      await music.play();
      $("musicToggle").textContent = "⏸ Music Pause";
    } catch {
      alert("মিউজিক চালানো যায়নি। আবার চেষ্টা করুন।");
    }
  } else {
    music.pause();
    $("musicToggle").textContent = "▶ Music Play";
  }
});

/* FRIEND QUIZ PLAY */

async function loadFriendQuiz(id) {
  let quiz;
  try {
    quiz = await api(`/api/friend-quizzes/${encodeURIComponent(id)}`);
  } catch (error) {
    alert(fail(error));
    show("home");
    return;
  }

  let view = $("friendPlayView");
  if (!view) {
    view = document.createElement("section");
    view.id = "friendPlayView";
    view.className = "view hidden";
    document.body.appendChild(view);
  }

  view.innerHTML = `
    <h2 id="friendPlayTitle"></h2>
    <div id="friendPlayContent"></div>
    <p id="friendPlayResult"></p>
    <button type="button" id="friendPlayHome">হোমে ফিরুন</button>
  `;

  $("friendPlayTitle").textContent = `তুমি ${quiz.creatorName}-কে কতটা চেনো?`;
  $("friendPlayHome").onclick = () => show("home");

  const content = $("friendPlayContent");
  const resultBox = $("friendPlayResult");

  content.innerHTML = `
    <label>তোমার নাম
      <input id="friendPlayerName" maxlength="50" placeholder="নিজের নাম লেখো">
    </label>
    <button type="button" id="friendStartButton">কুইজ শুরু করো</button>
  `;
  show("friendPlayView");

  $("friendStartButton").onclick = async () => {
    const playerName = $("friendPlayerName").value.trim();
    if (!playerName) return alert("আগে নিজের নাম লেখো।");

    const startButton = $("friendStartButton");
    startButton.disabled = true;

    try {
      const game = await api(
        `/api/friend-quizzes/${encodeURIComponent(id)}/start`,
        {
          method: "POST",
          body: JSON.stringify({ playerName })
        }
      );

      if (!game.questions || !game.questions.length) {
        alert("এই কুইজে কোনো প্রশ্ন পাওয়া যায়নি।");
        startButton.disabled = false;
        return;
      }

      const questions = game.questions;
      const answers = {};
      const history = [];
      let currentIndex = 0;
      let submitBusy = false;

      async function submitAnswers() {
        if (submitBusy) return;
        submitBusy = true;
        try {
          const score = await api(
            `/api/friend-quiz-sessions/${encodeURIComponent(game.sessionId)}/submit`,
            { method: "POST", body: JSON.stringify({ playerName, answers }) }
          );
          resultBox.textContent = `তোমার স্কোর: ${score.score}/${score.total}`;
          content.innerHTML = `<div class="question-card"><h3>কুইজ সম্পূর্ণ হয়েছে! ♡</h3><p>তোমার স্কোর: ${score.score}/${score.total}</p></div>`;
        } catch (error) {
          alert(fail(error));
          submitBusy = false;
          renderQuestion();
        }
      }

      function nextUnanswered(fromIndex = currentIndex) {
        for (let step = 1; step <= questions.length; step++) {
          const index = (fromIndex + step) % questions.length;
          if (answers[questions[index].id] === undefined) return index;
        }
        return -1;
      }

      function renderQuestion() {
        const q = questions[currentIndex];
        content.innerHTML = `
          <p class="muted">প্রশ্ন ${Object.keys(answers).length + 1} / ${questions.length}</p>
          <div class="question-card">
            <h3>${esc(q.prompt)}</h3>
            <div class="friend-answer-list">
              ${q.options.map((option, i) => `<button type="button" class="answer-choice ${answers[q.id] === option ? "selected" : ""}" data-answer-index="${i}">${esc(option)}</button>`).join("")}
            </div>
          </div>
          <div class="friend-nav">
            <button type="button" id="friendBackButton" class="back" ${history.length ? "" : "disabled"}>Back</button>
            <button type="button" id="friendIgnoreButton" class="glow pale">Ignore</button>
          </div>`;

        content.querySelectorAll("[data-answer-index]").forEach(button => {
          button.onclick = async () => {
            if (submitBusy) return;
            answers[q.id] = q.options[Number(button.dataset.answerIndex)];
            history.push(currentIndex);
            if (Object.keys(answers).length === questions.length) {
              await submitAnswers();
              return;
            }
            const next = nextUnanswered(currentIndex);
            if (next >= 0) currentIndex = next;
            renderQuestion();
          };
        });

        $("friendBackButton").onclick = () => {
          if (!history.length) return;
          currentIndex = history.pop();
          renderQuestion();
        };

        $("friendIgnoreButton").onclick = () => {
          history.push(currentIndex);
          const next = nextUnanswered(currentIndex);
          if (next >= 0) currentIndex = next;
          renderQuestion();
        };
      }

      renderQuestion();
    } catch (error) {
      alert(fail(error));
      startButton.disabled = false;
    }
  };
}

/* INITIALIZE */

async function initializeApp() {
  const friendMatch = location.pathname.match(
    /^\/friend-quiz\/([^/]+)$/
  );

  if (friendMatch) {
    await loadFriendQuiz(decodeURIComponent(friendMatch[1]));
    return;
  }

  await Promise.all([loadProfile(), loadPublicQuestions()]);

  if (location.pathname === "/creator-room-7f3c") {
    show("admin");
    await checkAdmin();
    return;
  }

  const match = location.pathname.match(/^\/play\/([^/]+)$/);

  if (match) {
    await loadQuiz(decodeURIComponent(match[1]));
  } else {
    show("home");
  }
}

initializeApp().catch(error => {
  console.error("App initialization error:", error);
});

/* GLOBAL CUTE MUSIC CONTROL */
(() => {
  function setupGlobalMusic() {
    const audio = document.getElementById("bgMusic");
    if (!audio) return;

    audio.loop = true;
    audio.preload = "auto";

    const oldToggle = document.getElementById("musicToggle");
    if (oldToggle) oldToggle.style.display = "none";

    let control = document.getElementById("globalMusicControl");
    if (!control) {
      control = document.createElement("button");
      control.id = "globalMusicControl";
      control.type = "button";
      control.setAttribute("aria-label", "Music on or off");
      control.textContent = "🎵 Music On";
      document.body.appendChild(control);
    }

    Object.assign(control.style, {
      position: "fixed",
      left: "14px",
      bottom: "18px",
      zIndex: "99999",
      minWidth: "125px",
      minHeight: "52px",
      padding: "12px 16px",
      borderRadius: "22px",
      border: "2px solid white",
      color: "#66364d",
      background: "linear-gradient(135deg,#fff2a6,#ffacd3,#9beaff)",
      boxShadow: "0 6px 0 #e77eaf,0 0 20px #ffacd3",
      fontSize: "15px",
      fontWeight: "800",
      cursor: "pointer",
      transition: "transform .16s, box-shadow .16s"
    });

    const refreshLabel = () => {
      control.textContent = audio.paused ? "🎵 Music On" : "🎵 Music Off";
    };

    control.addEventListener("click", async () => {
      if (audio.paused) {
        try {
          await audio.play();
        } catch (error) {
          control.textContent = "Tap to play 🎵";
        }
      } else {
        audio.pause();
      }
      refreshLabel();
    });

    audio.addEventListener("play", refreshLabel);
    audio.addEventListener("pause", refreshLabel);

    document.addEventListener("pointerdown", () => {
      if (audio.paused && !window.__musicUserPaused) {
        audio.play().then(refreshLabel).catch(() => {});
      }
    }, { once: true });

    audio.addEventListener("pause", () => {
      window.__musicUserPaused = true;
    });
    control.addEventListener("click", () => {
      window.__musicUserPaused = audio.paused;
    });

    audio.play().then(refreshLabel).catch(() => {
      control.textContent = "Tap to play 🎵";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupGlobalMusic, { once: true });
  } else {
    setupGlobalMusic();
  }
})();
