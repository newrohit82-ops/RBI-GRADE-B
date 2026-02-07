const levelButtons = document.getElementById("level-buttons");
const practiceForm = document.getElementById("practice-form");
const submitBtn = document.getElementById("submit-btn");
const refreshBtn = document.getElementById("refresh-btn");
const resultsSection = document.getElementById("results");
const resultsList = document.getElementById("results-list");
const scoreText = document.getElementById("score-text");
const unlockText = document.getElementById("unlock-text");
const progressText = document.getElementById("progress-text");
const levelTitle = document.getElementById("level-title");

const TOTAL_LEVELS = 3;
let currentLevel = 1;

const getUnlockedLevel = () => Number(localStorage.getItem("unlockedLevel") || 1);
const setUnlockedLevel = (level) => localStorage.setItem("unlockedLevel", level);

const updateLevelButtons = () => {
  levelButtons.innerHTML = "";
  const unlocked = getUnlockedLevel();
  for (let level = 1; level <= TOTAL_LEVELS; level += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "level-button";
    button.textContent = `Level ${level}`;
    button.disabled = level > unlocked;
    if (level === currentLevel) {
      button.classList.add("active");
    }
    button.addEventListener("click", () => {
      currentLevel = level;
      loadQuestions();
    });
    levelButtons.appendChild(button);
  }

  progressText.textContent =
    unlocked >= TOTAL_LEVELS
      ? "All levels unlocked. Keep practicing daily!"
      : `Complete Level ${unlocked} to unlock Level ${unlocked + 1}.`;
};

const loadQuestions = async () => {
  resultsSection.hidden = true;
  resultsList.innerHTML = "";
  levelTitle.textContent = `Level ${currentLevel}`;
  updateLevelButtons();

  const response = await fetch(`/api/questions?level=${currentLevel}`);
  const data = await response.json();
  practiceForm.innerHTML = "";

  data.questions.forEach((question, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "question";

    const label = document.createElement("label");
    label.textContent = `${index + 1}. ${question.prompt}`;

    const textarea = document.createElement("textarea");
    textarea.name = question.id;
    textarea.rows = 4;
    textarea.placeholder = "Type your answer here...";

    wrapper.appendChild(label);
    wrapper.appendChild(textarea);
    practiceForm.appendChild(wrapper);
  });
};

const renderResults = (payload) => {
  resultsSection.hidden = false;
  scoreText.textContent = `Score: ${payload.score.toFixed(2)} / ${payload.totalMarks} (${(payload.percentage * 100).toFixed(0)}%)`;

  if (payload.unlockedNext) {
    unlockText.textContent = "Level unlocked! Great job.";
    const nextLevel = Math.min(TOTAL_LEVELS, payload.level + 1);
    if (nextLevel > getUnlockedLevel()) {
      setUnlockedLevel(nextLevel);
    }
  } else {
    unlockText.textContent = "Keep going! Score 70% or more to unlock the next level.";
  }

  resultsList.innerHTML = "";
  payload.evaluations.forEach((item, index) => {
    const block = document.createElement("div");
    block.className = "result";
    block.innerHTML = `
      <h3>Question ${index + 1}</h3>
      <p><strong>Verdict:</strong> ${item.verdict}</p>
      <p><strong>Marks:</strong> ${item.awardedMarks} / ${item.maxMarks}</p>
      <p class="explanation">${item.explanation}</p>
    `;
    resultsList.appendChild(block);
  });

  updateLevelButtons();
};

submitBtn.addEventListener("click", async () => {
  const answers = Array.from(practiceForm.querySelectorAll("textarea")).map((textarea) => ({
    id: textarea.name,
    answer: textarea.value
  }));

  const response = await fetch("/api/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ level: currentLevel, answers })
  });

  const payload = await response.json();
  renderResults(payload);
});

refreshBtn.addEventListener("click", () => {
  loadQuestions();
});

loadQuestions();
