
"use strict";

const LANGUAGE_NAMES = {
  bn: "বাংলা",
  en: "English",
  hi: "हिन्दी",
  es: "Español",
  fr: "Français",
  ar: "العربية",
  pt: "Português",
  id: "Bahasa Indonesia",
  ja: "日本語",
  ko: "한국어",
  other: "Others"
};

const getSelectedLanguage = () => {
  const select = document.getElementById("language");
  if (!select) return "bn";

  const selected = select.options[select.selectedIndex];
  if (!selected) return "bn";

  return selected.value || "bn";
};

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

    container.innerHTML = `
      <style>
        .ff-wrap{max-width:520px;margin:22px auto}
        .ff-card{
          background:linear-gradient(145deg,#17132d,#292044);
          color:#fff;border:1px solid #a66cff66;border-radius:24px;
          padding:25px 18px;box-shadow:0 0 25px #9b5cff30
        }
        .ff-title{text-align:center;color:#d7b4ff;font-size:24px}
        .ff-label{display:block;margin:18px 0 8px}
        .ff-input{
          width:100%;box-sizing:border-box;padding:13px;border-radius:12px;
          border:1px solid #a66cff88;background:#211b36;color:white
        }
        .ff-question{
          text-align:center;font-size:25px;font-weight:800;
          line-height:1.5;margin:28px 0
        }
        .ff-progress{
          height:7px;background:#403454;border-radius:10px;overflow:hidden
        }
        .ff-progress div{
          height:100%;background:linear-gradient(90deg,#a855f7,#ff55c8)
        }
        .ff-options{display:grid;gap:12px}
        .ff-option{
          width:100%;padding:15px 12px;border:1px solid #b879ff;
          border-radius:15px;color:white;font-size:16px;font-weight:700;
          background:linear-gradient(110deg,#6536a5,#922f8f);
          box-shadow:0 0 12px #a855f733;cursor:pointer
        }
        .ff-option:nth-child(2){background:linear-gradient(110deg,#175c9c,#287bc0)}
        .ff-option:nth-child(3){background:linear-gradient(110deg,#087d70,#20a58e)}
        .ff-option:nth-child(4){background:linear-gradient(110deg,#a34b18,#d47725)}
        .ff-option:active{transform:scale(.98)}
        .ff-actions{display:flex;justify-content:space-between;gap:12px;margin-top:24px}
        .ff-btn{
          flex:1;padding:13px;border:0;border-radius:13px;
          font-weight:700;font-size:15px;cursor:pointer
        }
        .ff-back{background:#3b3150;color:white}
        .ff-ignore{background:#33283f;color:#e2c9ff;border:1px solid #8f67b5}
        .ff-choice-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 18px;
}

.ff-choice {
  min-height: 54px;
  padding: 12px 8px;
  border: 1px solid #a66cff88;
  border-radius: 13px;
  background: #211b36;
  color: #e8d8ff;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
}

.ff-choice {
  background: #211b36 !important;
  color: #e8d8ff !important;
  border: 2px solid #a66cff !important;
  transition: background 0.2s, color 0.2s;
}

.ff-choice.selected {
  background: #00c853 !important;
  color: #ffffff !important;
  border: 2px solid #ffffff !important;
  box-shadow: 0 0 12px #00c853 !important;
}
        .ff-start,.ff-share{
          width:100%;padding:15px;border:0;border-radius:14px;
          background:linear-gradient(90deg,#913bdb,#e044b6);
          color:white;font-size:17px;font-weight:800;cursor:pointer
        }
      </style>

      <div class="ff-wrap">
        <div class="ff-card">
          <h2 class="ff-title">✨ Friend Quiz ✨</h2>

          <label class="ff-label" for="friendCreatorName">তোমার নাম</label>
          <input class="ff-input" id="friendCreatorName"
            maxlength="50" placeholder="নিজের নাম লেখো">

          <label class="ff-label">তোমার Gender বেছে নাও</label>
<div class="ff-choice-row">
  <button type="button" class="ff-choice" data-gender="Male">MALE</button>
  <button type="button" class="ff-choice" data-gender="Female">FEMALE</button>
</div>

<label class="ff-label">কতটি প্রশ্ন থাকবে?</label>
<div class="ff-choice-row">
  <button type="button" class="ff-choice" data-count="10">10 QUESTIONS</button>
  <button type="button" class="ff-choice" data-count="15">15 QUESTIONS</button>
</div>

          <button type="button" class="ff-start" id="ffStart"
            style="margin-top:22px">
            Next ➜
          </button>

          <div id="ffQuestionArea"></div>
        </div>
      </div>
    `;

    const startButton = $("ffStart");
let area = $("ffQuestionArea");
let selectedGender = "";
let selectedCount = null;
document.querySelectorAll("[data-gender]").forEach(button => {
  button.addEventListener("click", () => {
    selectedGender = button.dataset.gender;
    document.querySelectorAll("[data-gender]").forEach(b => {
      b.classList.toggle("selected", b === button);
    });
  });
});

document.querySelectorAll("[data-count]").forEach(button => {
  button.addEventListener("click", () => {
    selectedCount = Number(button.dataset.count);
    document.querySelectorAll("[data-count]").forEach(b => {
      b.classList.toggle("selected", b === button);
    });
  });
});

    startButton.addEventListener("click", () => {
      const name = $("friendCreatorName").value.trim();
      const count = selectedCount;
      if (!selectedGender) {
  alert("আগে Gender সিলেক্ট করো।");
  return;
}

if (selectedCount === null) {
  alert("আগে প্রশ্নের সংখ্যা সিলেক্ট করো।");
  return;
}
if (!allQuestions.length) {
  alert("প্রশ্নভান্ডারে কোনো প্রশ্ন নেই।");
  return;
}
      if (!name) {
        alert("আগে নিজের নাম লেখো।");
        return;
      }

      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
      const questions = shuffled;

      const answers = {};
      const ignored = new Set();
      let current = 0;
      let creating = false;

      const wrap = startButton.closest(".ff-wrap");

wrap.innerHTML = `
  <div class="ff-card">
    <h2 class="ff-title">🦥বন্ধুত্বের আসল পরীক্ষা!🐰</h2>
    <div id="ffQuestionArea"></div>
  </div>
`;

area = $("ffQuestionArea");

      
      function renderQuestion() {
        const q = questions[current];
        const options = q.options;
        const selectedCount = Object.values(answers).filter(
          answer => typeof answer === "string" && answer.trim() !== ""
        ).length;
        
        area.innerHTML = `
          <div style="margin-top:28px">
            <div class="ff-progress">
              <div style="width:${(selectedCount / count) * 100}%"></div>
            </div>

            <p style="text-align:center;color:#d9c4f4">
  বর্তমান প্রশ্ন: ${current + 1}
</p>

            <p style="text-align:center;color:#d9c4f4">
              প্রশ্ন সিলেক্ট করেছেন: ${selectedCount} / ${count}
            </p>

            <div class="ff-question">${esc(q.question)}</div>

            <div class="ff-options">
              ${options.map((option, i) => `
                <button type="button" class="ff-option ${answers[String(q.id)] === option ? "selected" : ""}"
                  data-ff-answer="${i}">
                  ${esc(option)}
                </button>
              `).join("")}
            </div>

            <div class="ff-actions">
              <button type="button" class="ff-btn ff-back"
                id="ffBack" ${current === 0 ? "disabled" : ""}>
                ← Back
              </button>

              <button type="button" class="ff-btn ff-ignore"
                id="ffIgnore">
                Ignore →
              </button>
            </div>
          </div>
        `;

        area.querySelectorAll("[data-ff-answer]").forEach(button => {
          button.addEventListener("click", async () => {
            answers[String(q.id)] =
              options[Number(button.dataset.ffAnswer)];

            await advance();
          });
        });

        $("ffIgnore").addEventListener("click", async () => {
  answers[String(q.id)] = "";
  ignored.add(String(q.id));
  await advance();
});

        $("ffBack").addEventListener("click", () => {
          if (current > 0) {
            current--;
            renderQuestion();
          }
        });
      }

async function advance() {
  const answeredIds = new Set(
    Object.entries(answers)
      .filter(([, answer]) =>
        typeof answer === "string" && answer.trim() !== ""
      )
      .map(([id]) => id)
  );

  if (answeredIds.size >= count) {
    await createQuiz();
    return;
  }

  for (let step = 1; step <= questions.length; step++) {
    const next = (current + step) % questions.length;
    const id = String(questions[next].id);

    if (!answeredIds.has(id) && !ignored.has(id)) {
      current = next;
      renderQuestion();
      return;
    }
  }

  for (let step = 1; step <= questions.length; step++) {
    const next = (current + step) % questions.length;
    const id = String(questions[next].id);

    if (!answeredIds.has(id)) {
      ignored.delete(id);
      current = next;
      renderQuestion();
      return;
    }
  }

  alert("প্রয়োজনীয় সংখ্যক উত্তর দেওয়ার মতো প্রশ্ন নেই।");
}
      async function createQuiz() {
        if (creating) return;
        creating = true;

        area.innerHTML = `
          <p style="text-align:center;margin:30px 0">
            তোমার কুইজ তৈরি হচ্ছে…
          </p>
        `;

        try {
          const result = await api("/api/friend-quizzes", {
            method: "POST",
            body: JSON.stringify({
              creatorName: name,
              creatorGender: selectedGender,
              questions: questions
  .filter(q => {
    const answer = answers[String(q.id)];
    return typeof answer === "string" && answer.trim() !== "";
  })
  .map(q => ({
                questionId: q.id,
                answer: answers[String(q.id)] ?? ""
              }))
            })
          });

          if (!result.shareUrl) {
            throw new Error("শেয়ার লিংক পাওয়া যায়নি।");
          }

          area.innerHTML = `
  <div style="margin-top:30px;text-align:center">
    <h3 style="color:#e0c5ff">🎉 তোমার বন্ধুদের শেয়ার করো..!! ☺️</h3>
    <div class="ff-share-layout">
      <div class="ff-share-side">🐻</div>
      <div class="ff-share-main">
        <button type="button" class="ff-share" id="ffShare" aria-label="Share">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <path d="M8.7 10.5 15.3 6.5M8.7 13.5l6.6 4"/>
          </svg>
        </button>
        <div class="ff-share-options">
          <button type="button" id="ffCopyLink">📋 Copy Link</button>
          <button type="button" id="ffWhatsApp">🟢 WhatsApp</button>
          <button type="button" id="ffFacebook">🔵 Facebook</button>
          <button type="button" id="ffMessenger">💬 Messenger</button>
          <button type="button" id="ffTelegram">✈️ Telegram</button>
          <button type="button" id="ffInstagram">📸 Instagram</button>
        </div>
      </div>
      <div class="ff-share-side">🐼</div>
    </div>
  </div>
`;
          const shareUrl = result.shareUrl;
          const shareTitle = `${name}-এর Friend Quiz`;
          const shareText = "আমার Friend Quiz খেলো!";

          $("ffCopyLink").addEventListener("click", async () => {
            try {
              await navigator.clipboard.writeText(shareUrl);
              alert("লিংক কপি হয়েছে!");
            } catch {
              prompt("লিংক কপি করো:", shareUrl);
            }
          });

          $("ffWhatsApp").addEventListener("click", () => {
            window.open(
              `https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`,
              "_blank"
            );
          });

          $("ffFacebook").addEventListener("click", () => {
            window.open(
              `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
              "_blank"
            );
          });

          $("ffMessenger").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(shareUrl);
  } catch {}

  window.location.href =
    "fb-messenger://share/?link=" + encodeURIComponent(shareUrl);
});

          $("ffTelegram").addEventListener("click", () => {
            window.open(
              `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
              "_blank"
            );
          });

          $("ffInstagram").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(shareUrl);
  } catch {
    prompt("লিংক কপি করো:", shareUrl);
  }

  window.location.href = "instagram://direct-inbox";
});

          $("ffShare").addEventListener("click", async () => {
            if (!navigator.share) {
              alert("নিচের অপশন থেকে শেয়ার করো।");
              return;
            }

            try {
              await navigator.share({
                title: shareTitle,
                text: shareText,
                url: shareUrl
              });
            } catch (error) {
              if (error.name !== "AbortError") {
                alert("শেয়ার করা যায়নি।");
              }
            }
          });
          
          score.classList.add("hidden");
          score.textContent = "";
          area.scrollIntoView({ behavior: "smooth", block: "center" });

        } catch (error) {
          creating = false;
          area.innerHTML = `
            <p style="color:#ffaaaa;text-align:center">
              ${esc(fail(error))}
            </p>
            <button type="button" class="ff-start" id="ffRetry">
              আবার চেষ্টা করো
            </button>
          `;

          $("ffRetry").addEventListener("click", createQuiz);
        }
      }

      renderQuestion();
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
    loadAdminWebsiteAnswers(),
    loadAdminVisitorNames()
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
  if (!container) return;
  try {
    const questions = await api("/api/admin/public-questions");
    container.innerHTML = questions.map(q => `
      <div class="question-card">
        <p>${esc(q.question)}</p>
        <p>প্রেরক: ${esc(q.submitter_name || "")}</p>
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
  if (!container) return;
  try {
    const questions = await api("/api/admin/website-questions");
    container.innerHTML = questions.map(q => `
      <div class="question-card" style="margin-bottom:14px">
        <p><strong>${esc(q.question)}</strong></p>
        <p>${(q.options || []).map(esc).join(" • ")}</p>
        <button type="button" data-edit-web="${q.id}">পরিবর্তন</button>
        <button type="button" data-delete-web="${q.id}">মুছুন</button>
        <div id="edit-web-${q.id}" hidden>
          <label>প্রশ্ন
            <textarea class="edit-web-question">${esc(q.question)}</textarea>
          </label>
          <div class="edit-web-options">
            ${(q.options || []).map((option, i) => `
              <label>অপশন ${i + 1}
                <input class="edit-web-option" value="${esc(option)}">
              </label>
            `).join("")}
          </div>
          <label>সঠিক উত্তর
            <select class="edit-web-correct">
              ${(q.options || []).map(option => `
                <option value="${esc(option)}" ${option === q.correct_answer ? "selected" : ""}>${esc(option)}</option>
              `).join("")}
            </select>
          </label>
          <button type="button" data-save-web="${q.id}">সেভ করুন</button>
          <button type="button" data-cancel-web="${q.id}">বাতিল</button>
          <p class="edit-web-message"></p>
        </div>
      </div>
    `).join("") || "<p>কোনো প্রশ্ন নেই।</p>";

    container.querySelectorAll("[data-edit-web]").forEach(button => {
      button.addEventListener("click", () => {
        const editor = container.querySelector(`#edit-web-${CSS.escape(button.dataset.editWeb)}`);
        if (editor) editor.hidden = !editor.hidden;
      });
    });

    container.querySelectorAll("[data-cancel-web]").forEach(button => {
      button.addEventListener("click", () => {
        const editor = container.querySelector(`#edit-web-${CSS.escape(button.dataset.cancelWeb)}`);
        if (editor) editor.hidden = true;
      });
    });

    container.querySelectorAll("[data-delete-web]").forEach(button => {
      button.addEventListener("click", async () => {
        if (!confirm("প্রশ্নটি মুছে ফেলবেন?")) return;
        try {
          await api(`/api/admin/website-questions/${button.dataset.deleteWeb}`, { method: "DELETE" });
          await loadAdminWebsiteQuestions();
        } catch (error) {
          alert(fail(error));
        }
      });
    });

    container.querySelectorAll("[data-save-web]").forEach(button => {
      button.addEventListener("click", async () => {
        const editor = container.querySelector(`#edit-web-${CSS.escape(button.dataset.saveWeb)}`);
        if (!editor) return;
        const question = editor.querySelector(".edit-web-question").value.trim();
        const options = [...editor.querySelectorAll(".edit-web-option")].map(input => input.value.trim());
        const correct_answer = editor.querySelector(".edit-web-correct").value;
        const message = editor.querySelector(".edit-web-message");
        try {
          await api(`/api/admin/website-questions/${button.dataset.saveWeb}`, {
            method: "PUT",
            body: JSON.stringify({ question, options, correctAnswer: correct_answer })
          });
          await loadAdminWebsiteQuestions();
        } catch (error) {
          message.textContent = fail(error);
        }
      });
    });
  } catch (error) {
    container.textContent = fail(error);
  }
}
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

/* VISITOR LIST ADMIN */

async function loadAdminVisitorNames() {
  const container = $("visitorNamesAdmin");
  const count = $("visitorNamesCount");
  if (!container) return;

  try {
    const visitors = await api("/api/admin/visitor-names");

    if (count) count.textContent = `মোট: ${visitors.length}`;

    container.innerHTML = visitors.map((visitor, index) => `
      <div class="question-card">
        <p><strong>${index + 1}.</strong> ${esc(visitor.name)}</p>
      </div>
    `).join("") || "<p>এখনও কেউ কুইজে নাম জমা দেয়নি।</p>";
  } catch (error) {
    container.textContent = fail(error);
  }
}

/* ADMIN BUTTON WIRING */

$("loadQuizzes")?.addEventListener("click", async () => {
  await loadAdminQuizzes();
});

$("loadWebsiteAnswers")?.addEventListener("click", async () => {
  await loadAdminWebsiteAnswers();
});

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
    <section class="question-card" id="friendLandingScoreboard">
      <h3>🏆 এই কুইজের স্কোরবোর্ড</h3>
      <p>স্কোর লোড হচ্ছে...</p>
    </section>
  `;

  show("friendPlayView");

  async function loadLandingScoreboard() {
    const box = $("friendLandingScoreboard");
    if (!box) return;

    try {
      const board = await api(
        `/api/friend-quizzes/${encodeURIComponent(id)}/scoreboard`
      );

      box.innerHTML = `
        <h3>🏆 এই কুইজের স্কোরবোর্ড</h3>
        ${(board.scoreboard || []).map((item, index) => `
          <p>${index + 1}. ${esc(item.player_name)} — ${esc(item.score)}</p>
        `).join("") || "<p>এখনও কেউ এই কুইজ খেলেনি।</p>"}
      `;
    } catch (error) {
      box.innerHTML = `
        <h3>🏆 এই কুইজের স্কোরবোর্ড</h3>
        <p>স্কোরবোর্ড এখন লোড করা যাচ্ছে না।</p>
      `;
    }
  }

  loadLandingScoreboard();

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
          resultBox.textContent = `আমার স্কোর: ${score.score}/${score.total}`;
                content.innerHTML = `
            <button type="button" id="friendResultHome"
              style="display:block;width:100%;min-height:64px;margin:0 0 20px;padding:16px;font-size:22px;font-weight:800;border-radius:14px;">
              এবার তোমার কুইজ তৈরি করো🐶
            </button>
            <div class="question-card">
              <h3>কুইজ সম্পূর্ণ হয়েছে! ♡</h3>
              <h2>আমার স্কোর: ${score.score}/${score.total}</h2>
              ${(score.review || []).map((item, i) => `
                <div style="border:2px solid ${item.isCorrect ? '#16a34a' : '#dc2626'};background:${item.isCorrect ? '#dcfce2' : '#fee2e2'};color:#222;padding:14px;border-radius:12px;margin:12px 0">
                  <h4>${i + 1}. ${esc(item.question)}</h4>
                  <p>আপনার উত্তর: ${esc(item.playerAnswer || "উত্তর দেননি")}</p>
                  <p>সঠিক উত্তর: ${esc(item.correctAnswer)}</p>
                  <b>${item.isCorrect ? "সঠিক উত্তর ✓" : "ভুল উত্তর ✗"}</b>
                </div>
              `).join("")}
            </div>
          `;

          try {
            const board = await api(
              `/api/friend-quizzes/${encodeURIComponent(id)}/scoreboard`
            );

            content.innerHTML += `
              <section class="question-card">
                <h3>🏆 স্কোরবোর্ড</h3>
                ${(board.scoreboard || []).map((item, i) =>
                  `<p>${i + 1}. ${esc(item.player_name)} — ${esc(item.score)}</p>`
                ).join("") || "<p>এখনও কোনো স্কোর নেই।</p>"}
              </section>
            `;
          } catch (error) {
            console.log("Scoreboard could not load");
          }

          $("friendResultHome").onclick = async () => {
  show("websiteMode");
  await loadWebsiteQuestions();
};
        } catch (error) {
          alert(fail(error));
          submitBusy = false;
          renderQuestion();
        }
      }

      function nextUnanswered(fromIndex = currentIndex) {
  for (let step = 1; step <= questions.length; step++) {
    const index = (fromIndex + step) % questions.length;
    const answer = answers[questions[index].id];

    if (answer === undefined || answer === "") {
      return index;
    }
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
          </div>`;

        content.querySelectorAll("[data-answer-index]").forEach(button => {
  button.onclick = async () => {
    if (submitBusy) return;

    answers[q.id] = q.options[Number(button.dataset.answerIndex)];
    history.push(currentIndex);

    const next = nextUnanswered(currentIndex);

    if (next === -1) {
      await submitAnswers();
      return;
    }

    currentIndex = next;
    renderQuestion();
  };
});

$("friendBackButton").onclick = () => {
  if (!history.length) return;
  currentIndex = history.pop();
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

const languageSelect = document.getElementById("language");

if (languageSelect) {
  languageSelect.addEventListener("change", function () {
    const lang = this.value === "other"
      ? (navigator.language || "en").split("-")[0]
      : this.value;

    const tryTranslate = () => {
      const combo = document.querySelector(".goog-te-combo");

      if (combo) {
        combo.value = lang;
        combo.dispatchEvent(new Event("change"));
      }
    };

    tryTranslate();
    setTimeout(tryTranslate, 1000);
    setTimeout(tryTranslate, 2500);
  });
}
