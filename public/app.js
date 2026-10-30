
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

function updateLanguageVisibility() {
  const control = $("languageControl");
  if (!control) return;

  const homeVisible =
    $("home") && !$("home").classList.contains("hidden");

  const friendView = $("friendPlayView");
  const friendLandingVisible =
    friendView &&
    !friendView.classList.contains("hidden") &&
    $("friendPlayerName");

  control.classList.toggle(
    "hidden",
    !(homeVisible || friendLandingVisible)
  );
}

function show(id) {
  document.querySelectorAll(".view").forEach(el => {
    el.classList.toggle("hidden", el.id !== id);
  });

  updateLanguageVisibility();
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
  const intro = $("websiteModeIntro");
if (intro) intro.classList.remove("hidden");
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
  background: #ffffffed !important;
  color: #34345c !important;
  border: 2px solid #ffffff !important;
  border-radius: 16px !important;
  transition: background .2s, color .2s, transform .2s;
}

.ff-choice.selected {
  background: #f5b5d2 !important;
  color: #57344b !important;
  border: 2px solid #ffffff !important;
  box-shadow: 0 0 12px #f5b5d2 !important;
  transform: scale(1.03);
}
        .ff-start,.ff-share{
          width:100%;padding:15px;border:0;border-radius:14px;
          background:linear-gradient(90deg,#913bdb,#e044b6);
          color:white;font-size:17px;font-weight:800;cursor:pointer
        }
        
.ff-wrap {
  max-width: 480px;
  margin: 8px auto;
  padding: 8px;
}

.ff-card {
  position: relative;
  overflow: hidden;
  min-height: auto;
  padding: 12px 16px 20px;
  border: 1px solid #ffffff;
  border-radius: 28px;
  color: #34345c;
  background: linear-gradient(180deg, #83d9ff, #d9f3ff 55%, #fff0f8);
  box-shadow: 0 12px 30px #719bd633;
}

.ff-home {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 1000;
  display: block;
  width: fit-content;
  padding: 8px 16px;
  margin: 0;
  border: 2px solid white;
  border-radius: 14px;
  background: #ffffffdd;
  color: #34345c;
  font-weight: 800;
  cursor: pointer;
}

.ff-sky {
  position: relative;
  height: 150px;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.ff-cloud {
  position: absolute;
  width: 115px;
  height: 35px;
  border-radius: 40px;
  background: #ffffffcc;
  animation: ffCloudFloat 5s ease-in-out infinite alternate;
}

.ff-cloud:before,
.ff-cloud:after {
  content: "";
  position: absolute;
  bottom: 10px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: inherit;
}

.ff-cloud:before { left: 15px; }
.ff-cloud:after { right: 12px; width: 38px; height: 38px; }

.ff-cloud-one { left: 2px; top: 48px; }
.ff-cloud-two { right: 0; top: 115px; animation-delay: -2s; }

.ff-character {
  position: relative;
  z-index: 2;
  font-size: 112px;
  line-height: 1;
  transform-origin: center;
  animation: ffCharacterFloat 2.6s ease-in-out infinite;
  filter: drop-shadow(0 12px 8px #536aa533);
}

.ff-speech {
  position: relative;
  width: fit-content;
  max-width: 95%;
  margin: 0 auto 12px;
  padding: 12px 18px;
  border: 3px solid white;
  border-radius: 22px;
  background: #ffffffed;
  color: #34345c;
  text-align: center;
  font-size: 21px;
  font-weight: 900;
  box-shadow: 0 5px 0 #b6dfff;
  animation: ffDialogueIn .6s ease both;
}

.ff-label {
  color: #34345c;
  font-size: 15px;
}

.ff-input {
  background: #ffffffed;
  color: #34345c;
  border: 2px solid white;
}

@keyframes ffCharacterFloat {
  0%, 100% { transform: translateY(4px) rotate(-2deg); }
  50% { transform: translateY(-12px) rotate(2deg); }
}

@keyframes ffCloudFloat {
  from { transform: translateX(-5px); }
  to { transform: translateX(12px); }
}

@keyframes ffDialogueIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-height: 750px) {
  .ff-card { min-height: auto; }
  .ff-sky { height: 190px; }
  .ff-character { font-size: 92px; }
}

/* Question board — design only */
.ff-wrap:has(.ff-question-board-card) {
  width: 100%;
  max-width: 680px;
  margin: 0 auto;
  padding: 8px;
  box-sizing: border-box;
}

.ff-wrap .ff-question-board-card {
  height: calc(100dvh - 16px);
  min-height: 0;
  max-height: calc(100dvh - 16px);
  padding: 10px;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #eaf7ff, #fff3f8);
}

.ff-wrap .ff-question-board-card .ff-title {
  flex: 0 0 auto;
  margin: 2px 0 8px;
  font-size: clamp(16px, 4vw, 22px);
}

.ff-wrap .ff-question-board-card #ffQuestionArea {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ff-question-layout {
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

.ff-question-status {
  flex: 0 0 auto;
  text-align: center;
  color: #4b6680;
  font-size: 12px;
  line-height: 1.4;
}

.ff-board-stage {
  position: relative;
  flex: 0 0 auto;
  width: calc(100% - 14px);
  margin: 0 auto 4px;
  aspect-ratio: 16 / 9;
  overflow: visible;
}

.ff-paper-board {
  position: absolute;
  inset: 0;
  overflow: hidden;
  box-sizing: border-box;
  padding: 9% 8% 7% 13%;
  color: #51483f;
  background:
    radial-gradient(ellipse at 25% 30%, #ffffffb8 0 3%, transparent 27%),
    radial-gradient(ellipse at 80% 70%, #dbeeff80 0 3%, transparent 35%),
    #fffaf0;
  border: 1px solid #d5c5aa;
  filter: drop-shadow(0 4px 4px #617a9630);
  clip-path: polygon(
    2% 2%, 12% 3%, 21% 1%, 32% 3%, 43% 1%,
    55% 3%, 67% 1%, 79% 3%, 90% 1%, 98% 3%,
    97% 18%, 99% 31%, 97% 46%, 99% 60%,
    97% 74%, 99% 87%, 96% 98%, 83% 96%,
    71% 99%, 58% 97%, 44% 99%, 31% 97%,
    18% 99%, 3% 96%, 2% 82%, 4% 68%,
    2% 52%, 4% 37%, 2% 20%
  );
}

.ff-paper-board::before {
  content: "✦     ✧       ✦       ☁";
  position: absolute;
  inset: 15% 8% auto;
  color: #a9c9e6;
  font-size: clamp(10px, 2.5vw, 18px);
  letter-spacing: 7px;
  opacity: .65;
  pointer-events: none;
}

.ff-paper-board::after {
  content: "☁      ✧       ✦";
  position: absolute;
  right: 8%;
  bottom: 12%;
  color: #b9cce5;
  font-size: clamp(10px, 2.5vw, 17px);
  opacity: .7;
  pointer-events: none;
}

.ff-paper-holes {
  position: absolute;
  z-index: 3;
  top: 8%;
  bottom: 8%;
  left: 2%;
  width: 7%;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  align-items: center;
  pointer-events: none;
}

.ff-paper-holes span {
  width: clamp(5px, 1.5vw, 10px);
  aspect-ratio: 1;
  border-radius: 50%;
  background: #d4e5ed;
  border: 1px solid #c1b69f;
  box-shadow: inset 0 1px 2px #7b8a9740;
}

.ff-question-leaf {
  position: absolute;
  z-index: 4;
  top: -4%;
  left: 50%;
  transform: translateX(-50%) rotate(-3deg);
  width: 17%;
  height: 22%;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 900;
  font-size: clamp(11px, 3vw, 19px);
  background: #78a96b;
  border: 1px solid #5d8b51;
  border-radius: 4% 65% 4% 65%;
  box-shadow: 0 2px 4px #526d4730;
}

.ff-board-question {
  position: absolute;
  z-index: 2;
  inset: 25% 9% 17% 12%;
  display: grid;
  place-items: center;
  text-align: center;
  overflow: hidden;
  overflow-wrap: anywhere;
  word-break: normal;
  line-height: 1.22;
  font-weight: 800;
  color: #51483f;
  padding: 2px;
  box-sizing: border-box;
}

.ff-board-pen {
  position: absolute;
  z-index: 5;
  width: 5px;
  height: 37%;
  right: -1%;
  top: 39%;
  border-radius: 5px;
  transform: rotate(28deg);
  transform-origin: center;
  background: linear-gradient(
    90deg, #c58d53 0 20%, #f3d7a6 20% 65%,
    #8a5c36 65% 82%, #493b36 82%
  );
  box-shadow: 1px 2px 3px #443b3440;
  pointer-events: none;
}

.ff-board-pen::before {
  content: "";
  position: absolute;
  top: -8px;
  left: 0;
  border-left: 2.5px solid transparent;
  border-right: 2.5px solid transparent;
  border-bottom: 9px solid #6e6258;
}

.ff-options-scroll {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  touch-action: pan-y;
}

.ff-options-scroll::-webkit-scrollbar {
  display: none;
}

.ff-options-scroll .ff-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 2px 2px 8px;
}

.ff-options-scroll .ff-option {
  min-width: 0;
  min-height: 40px;
  padding: 9px 6px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.25;
  overflow-wrap: anywhere;
  white-space: normal;
}

.ff-question-layout .ff-actions {
  flex: 0 0 auto;
  margin-top: 0;
  gap: 8px;
}

.ff-question-layout .ff-btn {
  padding: 10px 8px;
  font-size: 14px;
}

@media (max-height: 650px) {
  .ff-wrap .ff-question-board-card {
    padding: 6px;
  }

  .ff-question-layout {
    gap: 5px;
  }

  .ff-board-question {
    line-height: 1.12;
  }

  .ff-options-scroll .ff-option {
    min-height: 34px;
    padding: 6px 4px;
    font-size: 12px;
  }

  .ff-question-layout .ff-btn {
    padding: 7px;
  }
}
/* Question board: single background and faint artwork */
.ff-wrap:has(.ff-question-board-card) {
  width: 100%;
  max-width: 680px;
  height: auto;
  max-height: none;
  margin: 0 auto;
  padding: 0;
  box-sizing: border-box;
}

.ff-wrap .ff-question-board-card {
  position: relative;
  isolation: isolate;
  width: 100%;
  height: auto;
  min-height: 0;
  max-height: none;
  margin: 0;
  padding: 8px;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  border: 0;
  border-radius: 0;
  background: #eaf5fb;
}

.ff-wrap .ff-question-board-card::before {
  content: "✦   ✧   ☁   ♡   ✧   ✦   ♡   ☁";
  position: absolute;
  inset: 0;
  z-index: -1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  overflow: hidden;
  color: #7da4c0;
  opacity: 0.13;
  font-size: clamp(28px, 9vw, 66px);
  line-height: 2.2;
  letter-spacing: 10px;
  overflow-wrap: anywhere;
  pointer-events: none;
}

.ff-wrap .ff-question-board-card .ff-title {
  flex: 0 0 auto;
  margin: 2px 0 5px;
}

.ff-wrap .ff-question-board-card #ffQuestionArea {
  flex: 0 0 auto;
  max-height: none;
  min-height: 0;
  overflow: visible;
}

.ff-question-layout {
  height: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: visible;
}

.ff-question-status {
  flex: 0 0 auto;
  text-align: center;
  color: #243746;
  font-size: 12px;
  line-height: 1.4;
}

/* Keep the question board within the available space */
.ff-board-stage {
  flex: 0 0 auto;
  width: 100%;
  max-height: 30dvh;
  margin: 0 auto 2px;
  aspect-ratio: 16 / 9;
  overflow: hidden;
}

.ff-board-question {
  position: absolute;
  z-index: 2;
  inset: 25% 9% 17% 12%;
  display: grid;
  place-items: center;
  text-align: center;
  overflow: hidden;
  overflow-wrap: anywhere;
  word-break: normal;
  line-height: 1.22;
  font-weight: 800;
  color: #51483f;
  padding: 2px;
  box-sizing: border-box;
}

/* Options scroll first; page scrolls after options reach the end */
.ff-options-scroll {
  flex: 0 1 auto;
  min-height: 0;
  max-height: 40dvh;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: #8a9ca8 transparent;
  border: 1px solid #9eb4c2;
  border-radius: 0;
  padding: 4px;
  box-sizing: border-box;
  touch-action: pan-y;
}

.ff-options-scroll .ff-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
  padding: 0 0 4px;
}

.ff-options-scroll .ff-option {
  min-width: 0;
  min-height: 40px;
  padding: 8px 5px;
  border-radius: 0;
  font-size: 14px;
  line-height: 1.25;
  overflow-wrap: anywhere;
  white-space: normal;
}

/* Back and Ignore: matching black, square-corner buttons */
.ff-question-layout .ff-actions {
  flex: 0 0 auto;
  display: flex;
  gap: 8px;
  margin: 0;
  padding-top: 2px;
}

.ff-question-layout .ff-actions .ff-btn {
  flex: 1 1 0;
  min-height: 42px;
  padding: 9px 8px;
  border: 1px solid #000;
  border-radius: 0;
  background: #000;
  color: #fff;
  font-size: 14px;
  box-shadow: none;
}

.ff-question-layout .ff-actions .ff-btn:disabled {
  opacity: 0.4;
}

.ff-question-layout .ff-actions .ff-btn:active {
  background: #292929;
}

@media (max-height: 650px) {
  .ff-wrap .ff-question-board-card {
    padding: 5px;
  }

  .ff-question-layout {
    gap: 4px;
  }

  .ff-board-stage {
    max-height: 25dvh;
  }

  .ff-options-scroll .ff-option {
    min-height: 34px;
    padding: 6px 4px;
    font-size: 12px;
  }

  .ff-question-layout .ff-actions .ff-btn {
    min-height: 36px;
    padding: 6px;
  }
}

/* Allow full-page scrolling while keeping options independently scrollable */
.ff-wrap:has(.ff-question-board-card),
.ff-wrap:has(.ff-question-board-card) .ff-card,
.ff-wrap:has(.ff-question-board-card) .ff-question-board-card {
  height: auto;
  max-height: none;
  overflow: visible;
}

.ff-wrap .ff-question-board-card #ffQuestionArea,
.ff-wrap .ff-question-board-card .ff-question-layout {
  height: auto;
  max-height: none;
  overflow: visible;
}

.ff-wrap .ff-question-board-card .ff-options-scroll {
  flex: 0 1 auto;
  max-height: 40dvh;
  overflow-y: auto;
  overscroll-behavior-y: auto;
  touch-action: pan-y;
}

.friend-landing-wrap {
  max-width: 520px;
  margin: 22px auto;
  padding: 0 8px;
  box-sizing: border-box;
}

.friend-landing-card {
  position: relative;
  overflow: hidden;
}

.friend-landing-card #friendPlayContent {
  position: relative;
}

.friend-landing-card .friendship-footer {
  text-align: center;
  width: 100%;
}

.friend-landing-card #friendPlayerName {
  display: block;
  width: 100%;
  margin-top: 8px;
}

.friendship-footer {
  text-align: center;
  font-size: 13px;
  color: #7185c5;
  margin: 10px 0;
  padding: 4px;
}
        </style>
      <div class="ff-wrap">
  <div class="ff-card">

<button type="button" class="ff-home" id="ffHome">← হোম</button>

<div class="ff-sky">
  <div class="ff-cloud ff-cloud-one"></div>
  <div class="ff-cloud ff-cloud-two"></div>
  <div class="ff-character" aria-label="ভাসমান কার্টুন চরিত্র">🐻</div>
</div>

          <div class="ff-speech" id="ffSpeech">
            তোমার নাম কী?
          </div>

          <div id="ffSetupStep">
            <label class="ff-label" for="friendCreatorName">তোমার নাম লেখো</label>
            <input class="ff-input" id="friendCreatorName"
              maxlength="50" placeholder="এখানে নাম লেখো">
          </div>

          <button type="button" class="ff-start" id="ffStart"
            style="margin-top:22px">Next ➜</button>

          <div id="ffQuestionArea"></div>
        </div>
      </div>
      `;

    $("ffHome").addEventListener("click", () => {
  show("home");
});
    const startButton = $("ffStart");
    let area = $("ffQuestionArea");
    let selectedGender = "";
    let selectedCount = null;
    let name = "";
    let setupStep = 0;

    function renderSetupStep() {
      const stepArea = $("ffSetupStep");
      const speech = $("ffSpeech");

      if (setupStep === 0) {
        speech.textContent = "তোমার নাম কী..?";
        stepArea.innerHTML = `
          <label class="ff-label" for="friendCreatorName">
            তোমার নাম লেখো ☺️
          </label>
          <input class="ff-input" id="friendCreatorName"
            maxlength="50" placeholder="এখানে নাম লেখো">
        `;
      } else if (setupStep === 1) {
        speech.textContent = "তোমার Gender কী..?";
        stepArea.innerHTML = `
          <div class="ff-choice-row">
            <button type="button" class="ff-choice"
              data-gender="Male">MALE</button>
            <button type="button" class="ff-choice"
              data-gender="Female">FEMALE</button>
          </div>
        `;

        stepArea.querySelectorAll("[data-gender]").forEach(button => {
          button.addEventListener("click", () => {
            selectedGender = button.dataset.gender;
            stepArea.querySelectorAll("[data-gender]").forEach(b => {
              b.classList.toggle("selected", b === button);
            });
          });
        });
      } else {
        speech.textContent = "কয়টি প্রশ্ন তৈরি করবে..?";
        stepArea.innerHTML = `
          <div class="ff-choice-row">
            <button type="button" class="ff-choice"
              data-count="10">১০টি প্রশ্ন</button>
            <button type="button" class="ff-choice"
              data-count="15">১৫টি প্রশ্ন</button>
          </div>
        `;

        stepArea.querySelectorAll("[data-count]").forEach(button => {
          button.addEventListener("click", () => {
            selectedCount = Number(button.dataset.count);
            stepArea.querySelectorAll("[data-count]").forEach(b => {
              b.classList.toggle("selected", b === button);
            });
          });
        });
      }

      startButton.textContent =
        setupStep === 2 ? "প্রশ্ন শুরু করো ♡" : "Next ➜";
    }

    renderSetupStep();

    startButton.addEventListener("click", () => {
      if (setupStep === 0) {
        name = $("friendCreatorName").value.trim();

        if (!name) {
          alert("আগে নিজের নাম লেখো।");
          return;
        }

        setupStep = 1;
        renderSetupStep();
        return;
      }

      if (setupStep === 1) {
        if (!selectedGender) {
          alert("আগে Gender সিলেক্ট করো।");
          return;
        }

        setupStep = 2;
        renderSetupStep();
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

      const count = selectedCount;
      console.log("Quiz start clicked");
console.log("Selected count:", selectedCount);
console.log("Available questions:", allQuestions.length);
console.log("Start button:", startButton);
console.log("Quiz wrapper:", startButton.closest(".ff-wrap"));

      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
      const questions = shuffled;

      const answers = {};
      const ignored = new Set();
      let current = 0;
      let creating = false;

     const intro = $("websiteModeIntro");
if (intro) intro.classList.add("hidden");
      const wrap = startButton.closest(".ff-wrap");

wrap.innerHTML = `
  <div class="ff-card ff-question-board-card">
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
        
        const questionFontSize = Math.max(
  10,
  Math.min(
    27,
    Math.floor(
      Math.min(
        27,
        360 / Math.max(1, q.question.length) * 1.8
      )
    )
  )
);

        area.innerHTML = `
          <div class="ff-question-layout">
            <div class="ff-question-status">
              <div>Selected ${selectedCount} / ${count}</div>
              <div class="ff-progress">
                <div style="width:${(selectedCount / count) * 100}%"></div>
              </div>
            </div>

            <div class="ff-board-stage">
              <div class="ff-paper-board">
                <div class="ff-board-question"
                     style="font-size:${questionFontSize}px">
                  ${esc(q.question)}
                </div>
              </div>

              <div class="ff-paper-holes" aria-hidden="true">
                <span></span><span></span><span></span>
                <span></span><span></span><span></span>
                <span></span>
              </div>

              <div class="ff-question-leaf">
                ${String(current + 1).padStart(2, "0")}
              </div>

              <div class="ff-board-pen" aria-hidden="true"></div>
            </div>

            <div class="ff-options-scroll">
              <div class="ff-options">
                ${options.map((option, i) => `
                  <button type="button"
                    class="ff-option ${answers[String(q.id)] === option ? "selected" : ""}"
                    data-ff-answer="${i}">
                    ${esc(option)}
                  </button>
                `).join("")}
              </div>
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

          wrap.querySelector(".ff-question-board-card > .ff-title")?.remove();
          area.innerHTML = `
          
<style>
  .ff-share-main {
    width: 100%;
    max-width: 330px;
    margin: 20px auto;
    text-align: center;
  }

  .ff-share-all {
    width: 76px !important;
    height: 76px !important;
    aspect-ratio: 1 / 1;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 18px;
    border: 0;
    border-radius: 12px;
    color: white;
    background: linear-gradient(135deg, #913bdb, #e044b6);
    box-shadow: 0 5px 16px #913bdb55;
  }

  .ff-share-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 13px;
    justify-items: center;
  }

  .ff-share-options button {
    width: 100%;
    aspect-ratio: 1 / 1;
    max-width: 88px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 14px;
    color: white;
    cursor: pointer;
    box-shadow: 0 5px 14px #0002;
    transition: transform .2s, box-shadow .2s;
  }

  .ff-share-options button:active {
    transform: scale(.92);
    box-shadow: 0 0 15px #ffffff99;
  }

  .ff-share-options svg {
    width: 35px;
    height: 35px;
  }

  #ffCopyLink { background: #526579; }
  #ffWhatsApp { background: #25D366; }
  #ffInstagram { background: linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5); }
  #ffFacebook { background: #1877F2; }
  #ffMessenger { background: #0084FF; }
  #ffTelegram { background: #229ED9; }

  .ff-share-cartoons {
    display: flex;
    justify-content: space-around;
    align-items: center;
    margin: 22px auto 10px;
    font-size: 48px;
  }
</style>

<div style="margin-top:30px;text-align:center">
  <h2 style="color:#ff4fd8;font-weight:900">
    Wah..!👏 তোমার কুইজ তৈরি ☺️
  </h2>

  <h3 style="color:#00eaff;font-weight:900">
    ☄️ বন্ধুদের পাঠাও আর দেখো কে সত্যিই তোমাকে চেনে 🎀
  </h3>

  <div class="ff-share-main">

    <button type="button" class="ff-share-all" id="ffShare" aria-label="All Share">
      <svg viewBox="0 0 24 24" width="36" height="36" fill="none"
        stroke="currentColor" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18" cy="5" r="3"/>
        <circle cx="6" cy="12" r="3"/>
        <circle cx="18" cy="19" r="3"/>
        <path d="M8.7 10.5 15.3 6.5M8.7 13.5l6.6 4"/>
      </svg>
    </button>

    <div class="ff-share-options">

      <button type="button" id="ffCopyLink" aria-label="Copy Link">
        <svg viewBox="0 0 24 24" fill="none" stroke="white"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="8" y="8" width="12" height="12" rx="2"/>
          <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>
        </svg>
      </button>

      <button type="button" id="ffWhatsApp" aria-label="WhatsApp">
        <svg viewBox="0 0 24 24" fill="white">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20zm4.4-5.9c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.8.9-.1.2-.3.2-.5.1-1.4-.7-2.3-1.3-3.2-2.9-.2-.3.2-.3.7-1.2.1-.2 0-.3 0-.5l-.7-1.7c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.8.8-1.1 1.8-.8 2.8.4 1.4 1.4 2.6 2.5 3.6 1.3 1.2 2.8 2 4.4 2.3 1 .2 1.8-.1 2.4-.7.3-.4.5-.9.6-1.4 0-.2-.1-.3-.3-.4z"/>
        </svg>
      </button>

      <button type="button" id="ffInstagram" aria-label="Instagram">
        <svg viewBox="0 0 24 24" fill="none" stroke="white"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="5"/>
          <circle cx="12" cy="12" r="4"/>
          <circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none"/>
        </svg>
      </button>

      <button type="button" id="ffFacebook" aria-label="Facebook">
        <svg viewBox="0 0 24 24" fill="white">
          <path d="M13.5 22v-9h3l.5-3.5h-3.5V7.3c0-1 .3-1.7 1.8-1.7H17V2.5c-.3 0-1.4-.1-2.7-.1-2.7 0-4.5 1.6-4.5 4.6v2.5H7V13h2.8v9z"/>
        </svg>
      </button>

      <button type="button" id="ffMessenger" aria-label="Messenger">
        <svg viewBox="0 0 24 24" fill="white">
          <path d="M12 2C6.4 2 2 6.1 2 11.2c0 2.9 1.4 5.4 3.7 7.1V22l3.4-1.9c.9.3 1.9.4 2.9.4 5.5 0 10-4.1 10-9.3S17.5 2 12 2zm1 12.5-2.5-2.7-4.8 2.7 5.3-5.6 2.6 2.7 4.7-2.7z"/>
        </svg>
      </button>

      <button type="button" id="ffTelegram" aria-label="Telegram">
        <svg viewBox="0 0 24 24" fill="white">
          <path d="M21.8 3.2 18.5 20c-.2 1.2-.9 1.5-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.3L6 13.4l-4.9-1.5c-1.1-.3-1.1-1.1.2-1.6L20.4 3c.9-.3 1.7.2 1.4 1.2z"/>
        </svg>
      </button>

    </div>

    <div class="ff-share-cartoons">
      <span>🐻</span>
      <span>🐼</span>
    </div>

    <p style="text-align:center;color:#e0c5ff;font-size:14px;line-height:1.7">
      তোমার বন্ধুদের স্কোর জানতে তোমার পাঠানো লিংকে ক্লিক করে স্কোরবোর্ডে জানতে পারো
    </p>

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
  const siteFooter = document.getElementById("siteFooter");
if (siteFooter) siteFooter.style.display = "none";
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
  <style>
    #friendPlayView {
      --sky-height: min(56.25vw, 100vh);
    }

    #friendPlayView .friend-landing-wrap {
      width: 100%;
      max-width: none;
      margin: 0 auto;
      padding: 0;
      box-sizing: border-box;
    }

    #friendPlayView .friend-landing-card {
      position: relative;
      overflow: hidden;
      width: 100%;
      padding: 0 16px 22px;
      box-sizing: border-box;
      border: 0;
      border-radius: 0;
      color: #34345c;
      background: linear-gradient(180deg, #fff0f8, #f8f5ff);
      box-shadow: none;
    }

    #friendPlayView .friend-landing-sky {
      position: relative;
      width: 100vw;
      max-width: none;
      aspect-ratio: 16 / 9;
      min-height: 210px;
      margin-left: calc(50% - 50vw);
      overflow: hidden;
      display: grid;
      place-items: center;
      isolation: isolate;
      background: linear-gradient(180deg, #72cfff 0%, #b8eaff 68%, #f8f5ff 100%);
    }

    #friendPlayView .friend-landing-sky::after {
      content: "";
      position: absolute;
      z-index: 3;
      inset: 60% 0 0;
      background: linear-gradient(180deg, transparent, #f8f5ff 100%);
      pointer-events: none;
    }

    #friendPlayView .friend-landing-cloud {
      position: absolute;
      width: 130px;
      height: 38px;
      border-radius: 40px;
      background: #ffffffd9;
      filter: drop-shadow(0 5px 8px #4a9ccc22);
    }

    #friendPlayView .friend-landing-cloud::before,
    #friendPlayView .friend-landing-cloud::after {
      content: "";
      position: absolute;
      bottom: 8px;
      width: 55px;
      height: 55px;
      border-radius: 50%;
      background: inherit;
    }

    #friendPlayView .friend-landing-cloud::before { left: 16px; }
    #friendPlayView .friend-landing-cloud::after {
      right: 12px;
      width: 42px;
      height: 42px;
    }

    #friendPlayView .landing-cloud-a {
      top: 20%;
      left: -160px;
      animation: landingCloudRight 13s linear infinite;
    }

    #friendPlayView .landing-cloud-b {
      top: 48%;
      right: -160px;
      transform: scale(.8);
      animation: landingCloudLeft 17s linear infinite;
    }

    #friendPlayView .landing-cloud-c {
      top: 12%;
      right: -160px;
      transform: scale(1.15);
      opacity: .8;
      animation: landingCloudLeft 22s linear infinite;
      animation-delay: -8s;
    }

    #friendPlayView .friend-landing-bear {
      position: relative;
      z-index: 2;
      align-self: end;
      margin-bottom: 7%;
      font-size: clamp(100px, 17vw, 190px);
      line-height: 1;
      filter: drop-shadow(0 12px 8px #536aa533);
      transform-origin: center bottom;
      animation: landingBearFloat 2.8s ease-in-out infinite;
    }

    #friendPlayView .friend-landing-speech {
      position: absolute;
      z-index: 4;
      top: 10%;
      left: 50%;
      width: max-content;
      max-width: min(82%, 460px);
      padding: 10px 17px;
      box-sizing: border-box;
      transform: translateX(-50%);
      border: 3px solid white;
      border-radius: 22px;
      background: #ffffffed;
      color: #34345c;
      text-align: center;
      font-size: clamp(16px, 3.5vw, 24px);
      font-weight: 900;
      box-shadow: 0 5px 0 #b6dfff;
      animation: landingSpeechIn .6s ease both;
    }

    #friendPlayView .friend-landing-speech::after {
      content: "";
      position: absolute;
      left: 50%;
      bottom: -12px;
      width: 18px;
      height: 18px;
      background: #ffffffed;
      border-right: 3px solid white;
      border-bottom: 3px solid white;
      transform: translateX(-50%) rotate(45deg);
    }

    #friendPlayView .ff-home {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 8;
    }

    #friendPlayView #friendPlayContent {
      position: relative;
      z-index: 5;
      width: 100%;
      max-width: 520px;
      margin: 0 auto;
    }

    #friendPlayView .ff-label {
      display: block;
      margin: 18px 0 8px;
      color: #34345c;
      font-size: 15px;
    }

    #friendPlayView .ff-input {
      display: block;
      width: 100%;
      box-sizing: border-box;
      padding: 13px;
      border: 2px solid white;
      border-radius: 12px;
      background: #ffffffed;
      color: #34345c;
    }

    #friendPlayView .ff-start {
      width: 100%;
      padding: 15px;
      border: 0;
      border-radius: 14px;
      background: linear-gradient(90deg, #913bdb, #e044b6);
      color: white;
      font-size: 17px;
      font-weight: 800;
      cursor: pointer;
    }

    #friendPlayView .friendship-footer {
      width: 100%;
      margin: 18px auto;
      text-align: center;
      color: #77728b;
      opacity: .58;
      font-size: 13px;
    }

    @keyframes landingCloudRight {
      from { left: -160px; }
      to { left: calc(100% + 160px); }
    }

    @keyframes landingCloudLeft {
      from { right: -160px; }
      to { right: calc(100% + 160px); }
    }

    @keyframes landingBearFloat {
      0%, 100% { transform: translateY(4px) rotate(-2deg); }
      50% { transform: translateY(-10px) rotate(2deg); }
    }

    @keyframes landingSpeechIn {
      from { opacity: 0; translate: 0 10px; }
      to { opacity: 1; translate: 0 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      #friendPlayView .friend-landing-cloud,
      #friendPlayView .friend-landing-bear,
      #friendPlayView .friend-landing-speech {
        animation: none !important;
      }
    }
  </style>
    `;
  
  view.innerHTML += `
  <div class="ff-wrap friend-landing-wrap">
    <div class="ff-card friend-landing-card">
      <div id="friendPlayContent"></div>
      <p id="friendPlayResult"></p>
    </div>
  </div>
`;

  const content = $("friendPlayContent");
  const resultBox = $("friendPlayResult");

  content.innerHTML = `
    <div class="friend-landing-sky">
      <div class="friend-landing-cloud landing-cloud-a"></div>
      <div class="friend-landing-cloud landing-cloud-b"></div>
      <div class="friend-landing-cloud landing-cloud-c"></div>
      <div class="friend-landing-bear" aria-label="কার্টুন ভালুক">🐻</div>
      <div class="friend-landing-speech" id="friendPlayTitle"></div>
    </div>

    <div id="ffSetupStep">
      <label class="ff-label" for="friendPlayerName">
        নিজের নাম লেখো ☺️
      </label>
      <input class="ff-input" id="friendPlayerName"
        maxlength="50" placeholder="এখানে নাম লেখো">
    </div>

    <button type="button" class="ff-start" id="friendStartButton"
      style="margin-top:22px">কুইজ শুরু করো</button>

    <p class="friendship-footer">Made with ✦ for real friendships</p>

    <section class="question-card" id="friendLandingScoreboard">
      <h3>🏆 এই কুইজের স্কোরবোর্ড</h3>
      <p>স্কোর লোড হচ্ছে...</p>
    </section>
  `;

  $("friendPlayTitle").textContent =
    `তুমি ${quiz.creatorName}-কে কতটা চেনো?`;

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

          const percentage = score.total > 0
            ? Math.round((score.score / score.total) * 100)
            : 0;

          let scoreColor = "#E77EBB";

          if (percentage === 0) {
            scoreColor = "#F04444";
          } else if (percentage <= 30) {
            scoreColor = "#F39A35";
          } else if (percentage <= 60) {
            scoreColor = "#E5C52D";
          } else if (percentage <= 99) {
            scoreColor = "#E77EBB";
          } else if (percentage === 100) {
            scoreColor = "#D6A52B";
          }

          const celebration = percentage === 100;

          const confetti = celebration
            ? Array.from({ length: 65 }, (_, i) => `
                <span class="score-confetti"
                  style="
                    --x:${(i * 37) % 100}%;
                    --delay:${-((i * 13) % 80) / 10}s;
                    --duration:${5 + (i % 6)}s;
                    --rotate:${(i * 47) % 360}deg;
                  ">${["🎉", "🎊", "✨", "🎉", "🎊"][i % 5]}</span>
              `).join("")
            : "";

          content.innerHTML = `
            <style>
              #friendPlayView .friend-landing-card {
                min-height: 100dvh;
                padding: 0 12px 24px;
                box-sizing: border-box;
                background: linear-gradient(
                  180deg,
                  #91dfff 0%,
                  #c8edff 48%,
                  #edf8ff 100%
                );
              }

              #friendPlayView .score-result-screen {
                position: relative;
                isolation: isolate;
                min-height: 100dvh;
                overflow: hidden;
                padding: 18px 0 30px;
                box-sizing: border-box;
              }

              #friendPlayView .score-cloud {
                position: fixed;
                z-index: -1;
                width: 150px;
                height: 48px;
                border-radius: 50px;
                background: #ffffffd9;
                filter: drop-shadow(0 5px 8px #5c9fc522);
                pointer-events: none;
              }

              #friendPlayView .score-cloud::before,
              #friendPlayView .score-cloud::after {
                content: "";
                position: absolute;
                bottom: 10px;
                width: 65px;
                height: 65px;
                border-radius: 50%;
                background: inherit;
              }

              #friendPlayView .score-cloud::before {
                left: 18px;
              }

              #friendPlayView .score-cloud::after {
                right: 15px;
                width: 48px;
                height: 48px;
              }

              #friendPlayView .score-cloud-one {
                top: 12%;
                left: -180px;
                animation: scoreCloudRight 24s linear infinite;
              }

              #friendPlayView .score-cloud-two {
                top: 42%;
                right: -180px;
                transform: scale(1.2);
                animation: scoreCloudLeft 30s linear infinite;
              }

              #friendPlayView .score-cloud-three {
                top: 72%;
                left: -180px;
                transform: scale(.8);
                animation: scoreCloudRight 32s linear infinite;
              }

              @keyframes scoreCloudRight {
                from { left: -180px; }
                to { left: calc(100% + 180px); }
              }

              @keyframes scoreCloudLeft {
                from { right: -180px; }
                to { right: calc(100% + 180px); }
              }

              #friendPlayView .score-paper-wrap {
                position: relative;
                width: min(82%, 340px);
                margin: 0 auto 28px;
                padding-top: 55px;
              }

              #friendPlayView .score-rope {
                position: absolute;
                z-index: 3;
                top: 0;
                width: 3px;
                height: 55px;
                border-radius: 5px;
                background: repeating-linear-gradient(
                  180deg,
                  #98704d 0 5px,
                  #d8b58a 5px 9px
                );
                transform-origin: top center;
              }

              #friendPlayView .score-rope::before {
                content: "";
                position: absolute;
                top: 47px;
                left: -5px;
                width: 11px;
                height: 11px;
                border: 2px solid #98704d;
                border-radius: 50%;
                background: #e6c79e;
              }

              #friendPlayView .score-rope-left {
                left: 28%;
                transform: rotate(-5deg);
              }

              #friendPlayView .score-rope-right {
                right: 28%;
                transform: rotate(5deg);
              }

              #friendPlayView .score-paper {
                position: relative;
                z-index: 2;
                width: 100%;
                aspect-ratio: 16 / 9;
                box-sizing: border-box;
                overflow: visible;
                padding: 55px 22px 35px 42px;
                color: #51483f;
                background:
                  repeating-linear-gradient(
                    to bottom,
                    transparent 0 31px,
                    #a9c8e8 32px,
                    transparent 33px
                  ),
                  #fffaf0;
                border: 1px solid #d7c9b3;
                filter: drop-shadow(0 8px 10px #456b8b44);
                clip-path: polygon(
                  2% 0%, 98% 0%, 99% 20%,
                  97% 40%, 99% 60%, 97% 80%,
                  98% 94%, 94% 96%, 90% 94%,
                  86% 98%, 82% 95%, 78% 98%,
                  74% 95%, 70% 98%, 66% 95%,
                  62% 98%, 58% 95%, 54% 98%,
                  50% 95%, 46% 98%, 42% 95%,
                  38% 98%, 34% 95%, 30% 98%,
                  26% 95%, 22% 98%, 18% 95%,
                  14% 98%, 10% 95%, 6% 98%,
                  2% 95%, 3% 75%, 1% 55%,
                  3% 35%
                );
              }

              #friendPlayView .score-paper-holes {
                position: absolute;
                top: 10%;
                bottom: 12%;
                left: 12px;
                display: flex;
                flex-direction: column;
                justify-content: space-around;
              }

              #friendPlayView .score-paper-holes span {
                width: 9px;
                height: 9px;
                border-radius: 50%;
                background: #b9d0df;
                border: 1px solid #9eb5c6;
                box-shadow: inset 0 1px 2px #718b9b88;
              }

              #friendPlayView .score-paper-art {
                position: absolute;
                inset: 0;
                pointer-events: none;
                color: #d58ab7;
                font-size: 20px;
                opacity: .8;
              }

              #friendPlayView .score-art-one {
                position: absolute;
                top: 17%;
                right: 10%;
                transform: rotate(15deg);
              }

              #friendPlayView .score-art-two {
                position: absolute;
                bottom: 19%;
                left: 18%;
                color: #6eacd4;
                transform: rotate(-12deg);
              }

              #friendPlayView .score-art-three {
                position: absolute;
                top: 48%;
                right: 9%;
                color: #d8ad45;
                transform: rotate(20deg);
              }

              #friendPlayView .score-cover {
  position: absolute;
  z-index: 5;
  top: 55px;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-2deg);
  width: fit-content;
  max-width: 90%;
  padding: 10px 18px;
  color: #70465e;
  background: #f4c7d9;
  font-size: clamp(17px, 5vw, 23px);
  font-weight: 900;
  text-align: center;
  white-space: nowrap;
  clip-path: polygon(3% 0%, 96% 3%, 100% 16%, 97% 85%, 94% 100%, 5% 96%, 0% 82%, 3% 15%);
}

              #friendPlayView .score-number {
                position: relative;
                z-index: 2;
                margin-top: 10px;
                text-align: center;
                white-space: nowrap;
                font-size: clamp(43px, 13vw, 68px);
                line-height: 1.2;
                font-weight: 1000;
                letter-spacing: -2px;
                color: ${scoreColor};
                text-shadow: 2px 3px 0 #ffffff;
              }

              #friendPlayView .score-total {
                color: #5487a7;
                font-size: .65em;
                letter-spacing: 0;
              }

              #friendPlayView .score-crown {
                display: block;
                margin-bottom: -22px;
                font-size: 34px;
                text-align: center;
              }

              #friendPlayView .score-percent {
                position: absolute;
                right: 12%;
                bottom: 9%;
                color: #5487a7;
                font-size: 16px;
                font-weight: 900;
                transform: rotate(-5deg);
              }

              #friendPlayView .score-confetti {
                position: fixed;
                z-index: 20;
                top: -50px;
                left: var(--x);
                font-size: 25px;
                pointer-events: none;
                animation: scoreConfettiFall var(--duration) linear var(--delay) infinite;
              }

              @keyframes scoreConfettiFall {
                0% {
                  transform: translate3d(0, -5vh, 0) rotate(0deg);
                  opacity: 0;
                }
                10% { opacity: 1; }
                50% {
                  transform: translate3d(35px, 55vh, 0) rotate(180deg);
                }
                100% {
                  transform: translate3d(-25px, 115vh, 0) rotate(360deg);
                  opacity: 0;
                }
              }

              #friendPlayView .score-complete-title {
                margin: 24px 0 12px;
                text-align: center;
                color: #694b83;
                font-size: 23px;
                font-weight: 900;
              }

              #friendPlayView .score-create-button {
                display: block;
                width: 100%;
                min-height: 58px;
                margin: 0 0 20px;
                padding: 14px;
                border: 0;
                border-radius: 16px;
                background: linear-gradient(90deg, #913bdb, #e044b6);
                color: white;
                font-size: 19px;
                font-weight: 900;
              }

              @media (prefers-reduced-motion: reduce) {
                #friendPlayView .score-cloud,
                #friendPlayView .score-confetti {
                  animation: none !important;
                }
              }
            </style>

            <div class="score-result-screen">
              <div class="score-cloud score-cloud-one"></div>
              <div class="score-cloud score-cloud-two"></div>
              <div class="score-cloud score-cloud-three"></div>
              ${confetti}

              <div class="score-paper-wrap">
                <div class="score-rope score-rope-left"></div>
                <div class="score-rope score-rope-right"></div>
                <div class="score-cover">ツতোমার স্কোর彡</div>
                
                <div class="score-paper">
                  <div class="score-paper-holes">
                    ${Array.from({ length: 8 }, () => "<span></span>").join("")}
                  </div>

                  <div class="score-paper-art">
                    <span class="score-art-one">✦ ✧ ★</span>
                    <span class="score-art-two">〰 ✿ 〰</span>
                    <span class="score-art-three">✧ ★</span>
                  </div>

                  ${celebration ? '<div class="score-crown">👑</div>' : ""}

                  <div class="score-number">
                    ${score.score}<span class="score-total"> / ${score.total}</span>
                  </div>

                  <div class="score-percent">${percentage}%</div>
                </div>
              </div>

              <h3 class="score-complete-title">কুইজ সম্পূর্ণ হয়েছে! ♡</h3>

              <button type="button" id="friendResultHome"
                class="score-create-button">
                এবার তোমার কুইজ তৈরি করো🐶
              </button>

              <p class="friendship-footer">Made with ✦ for real friendships</p>

              <div class="question-card">
                ${(score.review || []).map((item, i) => `
                  <div style="border:2px solid ${item.isCorrect ? '#16a34a' : '#dc2626'};background:${item.isCorrect ? '#dcfce2' : '#fee2e2'};color:#222;padding:14px;border-radius:12px;margin:12px 0">
                    <h4>${i + 1}. ${esc(item.question)}</h4>
                    <p>আপনার উত্তর: ${esc(item.playerAnswer || "উত্তর দেননি")}</p>
                    <p>সঠিক উত্তর: ${esc(item.correctAnswer)}</p>
                    <b>${item.isCorrect ? "সঠিক উত্তর ✓" : "ভুল উত্তর ✗"}</b>
                  </div>
                `).join("")}
              </div>
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
        const questionFontSize = Math.max(15, Math.min(34, Math.floor(520 / Math.max(1, q.prompt.length) * 1.25)));
        content.innerHTML = `
        
<style>
  .ff-question-board-card {
    width: 100%;
    min-height: 0;
    box-sizing: border-box;
    padding: 12px;
    border: 1px solid white;
    border-radius: 24px;
    color: #34345c;
    background: linear-gradient(180deg, #eaf7ff, #fff3f8);
    box-shadow: 0 12px 30px #719bd633;
  }

  .ff-question-layout {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

.ff-board-stage {
  position: relative;
  flex: 0 0 auto;
  width: 100%;
  margin: 8px auto 12px;
  aspect-ratio: 16 / 9;
  overflow: visible;
}
  
.ff-paper-board {
  position: absolute;
  inset: 0;
  overflow: hidden;
  box-sizing: border-box;
  padding: 12% 8% 8% 15%;
  color: #3d526e;
    background:
    repeating-linear-gradient(
      to bottom,
      #fffef8 0px,
      #fffef8 22px,
      #b9d9f5 23px,
      #b9d9f5 24px
    );
  border: 1px solid #d5c5aa;
  box-shadow: 0 6px 14px #617a9630;
    clip-path: polygon(
    1% 1%, 98% 1%, 99% 94%,
    95% 96%, 91% 94%, 87% 97%, 83% 95%,
    79% 97%, 75% 94%, 71% 97%, 67% 95%,
    63% 98%, 59% 95%, 55% 97%, 51% 94%,
    47% 97%, 43% 95%, 39% 98%, 35% 95%,
    31% 97%, 27% 94%, 23% 97%, 19% 95%,
    15% 98%, 11% 95%, 7% 97%, 2% 95%
  );
}

  .ff-board-question {
    position: absolute;
    inset: 12% 8% 12% 12%;
    display: grid;
    place-items: center;
    text-align: center;
    overflow: hidden;
    overflow-wrap: anywhere;
    line-height: 1.2;
    font-weight: 800;
    font-size: var(--question-font-size, 22px);
    padding: 4px;
    box-sizing: border-box;
  }

  .ff-paper-holes {
    position: absolute;
    z-index: 3;
    top: 8%;
    bottom: 8%;
    left: 2%;
    width: 7%;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;
    pointer-events: none;
  }

  .ff-paper-holes span {
    width: 8px;
    aspect-ratio: 1;
    border-radius: 50%;
    background: #d4e5ed;
    border: 1px solid #c1b69f;
  }

  .ff-question-leaf {
    position: absolute;
    z-index: 4;
    top: -4%;
    left: 50%;
    transform: translateX(-50%) rotate(-3deg);
    padding: 6px 12px;
    color: white;
    background: #78a96b;
    border-radius: 4px 14px;
    font-weight: 900;
  }

  .ff-options-scroll {
    max-height: 40dvh;
    overflow-y: auto;
  }

  .ff-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .ff-options .ff-option {
    min-width: 0;
    min-height: 40px;
    padding: 9px 6px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .ff-question-layout .friendship-footer {
    margin: 10px auto 0;
    text-align: center;
    color: #77728b;
    opacity: .58;
    font-size: 13px;
  }
</style>

  <div class="ff-wrap">
    <div class="ff-card ff-question-board-card">
      <div class="ff-question-layout">
        <p class="muted" style="text-align:center">
          প্রশ্ন ${Object.keys(answers).filter(k => answers[k] !== "").length + 1} / ${questions.length}
        </p>

        <div class="ff-board-stage">
          <div class="ff-paper-board">
             <div class="ff-board-question" style="--question-font-size:${questionFontSize}px">
              ${esc(q.prompt)}
            </div>
          </div>
          <div class="ff-paper-holes" aria-hidden="true">
            <span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span>
          </div>
          <div class="ff-question-leaf">
            ${String(currentIndex + 1).padStart(2, "0")}
          </div>
          <div class="ff-board-pen" aria-hidden="true"></div>
        </div>

        <div class="ff-options-scroll">
          <div class="ff-options">
            ${q.options.map((option, i) => `
              <button type="button"
                class="ff-option answer-choice ${answers[q.id] === option ? "selected" : ""}"
                data-answer-index="${i}">
                ${esc(option)}
              </button>
            `).join("")}
          </div>
        </div>

        <div style="text-align:center;margin-top:8px">
           <button type="button" id="friendBackButton" class="back"
            style="display:block;width:100%;min-height:42px;padding:8px 12px;font-size:16px;line-height:1.2;"
            ${history.length ? "" : "disabled"}>Back</button>
          <p class="friendship-footer">Made with ✦ for real friendships</p>
        </div>
      </div>
    </div>
  </div>
`;
        
           updateLanguageVisibility();

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
