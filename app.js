const $ = (sel) => document.querySelector(sel);

// ---------- DOM ----------
const muscleSelect = $("#muscleSelect");
const workoutSizeEl = $("#workoutSize");
const onlyBodyweight = $("#onlyBodyweight");

const generateBtn = $("#generateBtn");
const clearBtn = $("#clearBtn");

const statusEl = $("#status");
const workoutList = $("#workoutList");
const emptyEl = $("#empty");
const metaEl = $("#meta");

// ---------- API ----------
const API = "https://wger.de/api/v2";
const LANG_EN = 2;

// ---------- state ----------
let muscles = [];
let cachedExercisesEN = null; 

init();

// ---------- init ----------
async function init() {
  setStatus("Loading muscles…");
  try {
    muscles = await fetchAll(`${API}/muscle/?limit=200`);
    renderMuscleOptions(muscles);
    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus("Could not load muscles. Check internet and refresh.");
    muscleSelect.innerHTML = `<option value="">(failed to load)</option>`;
  }
}

// ---------- events ----------
generateBtn.addEventListener("click", async () => {
  const muscleId = String(muscleSelect.value).trim();
  const n = clampInt(Number(workoutSizeEl.value), 1, 12);
  const bwOnly = !!onlyBodyweight.checked;

  if (!muscleId) {
    setStatus("Pick a muscle group first.");
    return;
  }

  workoutList.innerHTML = "";
  emptyEl.style.display = "none";
  metaEl.textContent = "";
  setStatus("Generating workout...");

  try {
    if (!cachedExercisesEN) {
      setStatus("Loading exercise library (first time)...");

      cachedExercisesEN = await fetchAll(
        `${API}/exerciseinfo/?language=${LANG_EN}`
      );
    }

    let pool = cachedExercisesEN.filter((ex) => {
      const primary = normalizeMuscleIds(ex.muscles);
      const secondary = normalizeMuscleIds(ex.muscles_secondary);
      return primary.includes(muscleId) || secondary.includes(muscleId);

    });

    pool = pool
      .map((ex) => {
        const text = pickEnglishText(ex);
        return {
          id: ex.id,
          name: text.name,
          description: text.description,
          equipment: Array.isArray(ex.equipment) ? ex.equipment : [],
        };
      })
      .filter((ex) => ex.name && ex.description);

    if (bwOnly) {
      pool = pool.filter((ex) => ex.equipment.length === 0);
    }

    if (!pool.length) {
      setStatus(bwOnly
        ? "No bodyweight exercises found for this muscle. Turn off 'Bodyweight only' and try again."
        : "No exercises found for this selection."
      );
      emptyEl.style.display = "block";
      return;
    }

    const picked = shuffle(pool).slice(0, Math.min(n, pool.length));

    renderWorkout(picked);

    const muscleName = getMuscleName(muscleId);
    metaEl.textContent = `${picked.length} exercises • ${muscleName}${bwOnly ? " • bodyweight" : ""}`;
    setStatus("");

  } catch (err) {
    console.error(err);
    setStatus("Failed to load exercises. Try again.");
    emptyEl.style.display = "block";
  }
});

clearBtn.addEventListener("click", () => {
  workoutList.innerHTML = "";
  emptyEl.style.display = "block";
  metaEl.textContent = "";
  setStatus("");
});

// ---------- rendering ----------
function renderMuscleOptions(items) {
  const opts = items
    .map((m) => {
      const labelRaw = (m.name_en || m.name || `Muscle ${m.id}`).trim();
      const label = friendlyMuscleName(labelRaw);
      return `<option value="${m.id}">${escapeHtml(label)}</option>`;
    })
    .join("");

  muscleSelect.innerHTML = `<option value="">Select a muscle</option>${opts}`;
}

function renderWorkout(items) {
  workoutList.innerHTML = "";

  items.forEach((ex) => {
    const li = document.createElement("li");
    li.className = "item";

    const desc = stripHtml(ex.description).slice(0, 260);

    li.innerHTML = `
      <strong>${escapeHtml(ex.name)}</strong>
      <div class="small">${escapeHtml(desc || "No description available.")}</div>
    `;

    workoutList.appendChild(li);
  });
}

// ---------- text selection ----------
function pickEnglishText(ex) {

  if (Array.isArray(ex.translations) && ex.translations.length) {
    const t = ex.translations.find((x) => String(x.language) === String(LANG_EN)) || ex.translations[0];
    return {
      name: t?.name || ex.name || "",
      description: t?.description || ex.description || "",
    };
  }

  return {
    name: ex.name || "",
    description: ex.description || "",
  };
}

// ---------- helpers ----------
function setStatus(msg) {
  statusEl.textContent = msg;
}

function getMuscleName(id) {
  const m = muscles.find((x) => String(x.id) === String(id));
  const raw = (m?.name_en || m?.name || "muscle").trim();
  return friendlyMuscleName(raw);
}

function friendlyMuscleName(name) {
  const n = name.toLowerCase();

  if (n.includes("abdom")) return "Abs";
  if (n.includes("pectoral")) return "Chest";
  if (n.includes("latissimus") || n.includes("trapezius") || n.includes("back")) return "Back";
  if (n.includes("deltoid") || n.includes("shoulder")) return "Shoulders";
  if (n.includes("biceps") || n.includes("triceps") || n.includes("forearm")) return "Arms";
  if (n.includes("quadriceps") || n.includes("hamstring") || n.includes("glute") || n.includes("calf")) return "Legs";

  // fallback
  return name;
}

function clampInt(val, min, max) {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, Math.floor(val)));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function stripHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  return div.textContent || div.innerText || "";
}

async function fetchAll(url) {
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

function normalizeMuscleIds(arr){
  if (!Array.isArray(arr)) return [];
  return arr.map((m) => String(m?.id ?? m)).filter(Boolean);
}
