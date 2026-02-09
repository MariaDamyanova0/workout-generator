const $ = (sel) => document.querySelector(sel);

const muscleSelect = $("#muscleSelect");
const workoutSize = $("#workoutSize");
const onlyBodyweight = $("#onlyBodyweight");

const generateBtn = $("#generateBtn");
const clearBtn = $("#clearBtn");

const statusEl = $("#status");
const workoutList = $("#workoutList");
const emptyEl = $("#empty");
const metaEl = $("#meta");

// wger endpoints (public)
const API = "https://wger.de/api/v2";
const LANG_EN = 2; // English translations show up as language=2 in exerciseinfo results

let muscles = [];

init();

async function init() {
  setStatus("Loading muscles…");
  try {
    muscles = await fetchAll(`${API}/muscle/?limit=200`);
    renderMuscleOptions(muscles);
    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus("Could not load muscles. Check your internet and try refresh.");
    muscleSelect.innerHTML = `<option value="">(failed to load)</option>`;
  }
}

generateBtn.addEventListener("click", async () => {
  const muscleId = muscleSelect.value;
  const n = Number(workoutSize.value);
  const bodyweightOnly = onlyBodyweight.checked;

  if (!muscleId) {
    setStatus("Pick a muscle group first.");
    return;
  }

  setStatus("");
  metaEl.textContent = "";
});

clearBtn.addEventListener("click", () => {
  workoutList.innerHTML = "";
  emptyEl.style.display = "block";
  metaEl.textContent = "";
  setStatus("");
});

function setStatus(msg) {
  statusEl.textContent = msg;
}

function renderMuscleOptions(items) {
  
  const opts = items
    .map((m) => {
      const label = (m.name_en || m.name || `Muscle ${m.id}`).trim();
      return `<option value="${m.id}">${escapeHtml(label)}</option>`;
    })
    .join("");

  muscleSelect.innerHTML = `<option value="">Select a muscle</option>${opts}`;
}

async function fetchAll(url) {
  // Handles wger's paginated results {count,next,previous,results}
  let results = [];
  let next = url;

  while (next) {
    const res = await fetch(next);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const data = await res.json();
    results = results.concat(data.results || []);
    next = data.next;
  }

  return results;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
