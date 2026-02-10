const $ = (sel) => document.querySelector(sel);

// ---------- DOM ----------
const muscleSelect = $("#muscleSelect");
const workoutSizeEl = $("#workoutSize");
const onlyBodyweight = $("#onlyBodyweight");

const generateBtn = $("#generateBtn");
const clearBtn = $("#clearBtn");
const copyBtn = $("#copyBtn");

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
let lastWorkout = [];         

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
  lastWorkout = [];
  setStatus("Generating workout...");

  try {
    if (!cachedExercisesEN) {
      setStatus("Loading exercise library (first time)...");
      cachedExercisesEN = await fetchAll(`${API}/exerciseinfo/?language=${LANG_EN}`);
    }

    let pool = cachedExercisesEN.filter((ex) => {
      const primary = normalizeMuscleIds(ex.muscles);
      const secondary = normalizeMuscleIds(ex.muscles_secondary);
      return primary.includes(muscleId) || secondary.includes(muscleId);

    });

    pool = pool
      .map((ex) => {
        const text = pickEnglishText(ex);

        const eqArr = Array.isArray(ex.equipment) ? ex.equipment : [];
        const eqNames = eqArr
          .map((e) => String(e?.name ?? e).trim())
          .filter(Boolean)
          .filter((n) => {
             const low = n.toLowerCase();
             return !low.includes("none") && !low.includes("bodyweight");
          });

        return {
          id: ex.id,
          name: text.name,
          description: text.description,
          equipmentNames: eqNames,
          isBodyweight: eqNames.length === 0,
        };
      })
      .filter((ex) => ex.name && ex.description && looksEnglish(ex.name + " " + ex.description));

    if (bwOnly) {
      pool = pool.filter((ex) => ex.isBodyweight);
    }

    if (!pool.length) {
      setStatus(
        bwOnly
          ? "No bodyweight exercises found for this muscle. Turn off 'Bodyweight only' and try again."
          : "No exercises found for this selection."
      );
      emptyEl.style.display = "block";
      return;
    }

    const picked = shuffle(pool).slice(0, Math.min(n, pool.length));

    lastWorkout = picked;         
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
  lastWorkout = [];
  setStatus("");
});

copyBtn.addEventListener("click", async () => {
  if (!lastWorkout || lastWorkout.length === 0) {
    setStatus("Generate a workout first.");
    return;
  }

  const text =
    "Workout:\n" +
    lastWorkout.map((x, i) => `${i + 1}. ${x.name}`).join("\n");

  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied to clipboard ✅");
    return;
  } catch (err) {
    console.warn("Clipboard API failed, using fallback:", err);
  }

  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "-1000px";
  document.body.appendChild(ta);
  ta.select();

  try {
    document.execCommand("copy");
    setStatus("Copied to clipboard ✅");
  } catch (err) {
    console.error("Fallback copy failed:", err);
    setStatus("Copy failed (browser blocked it).");
  } finally {
    document.body.removeChild(ta);
  }
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

    const pres = buildPrescription(ex);
    const tags = buildTags(ex);

    li.innerHTML = `
      <strong>${escapeHtml(ex.name)}</strong>

      <div class="tags">
        ${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
      </div>

      <div class="small">${escapeHtml(desc || "No description available.")}</div>
      <div class="prescription">${escapeHtml(pres)}</div>
    `;



    workoutList.appendChild(li);
  });
}

// ---------- text selection ----------
function pickEnglishText(ex) {
  
  if (Array.isArray(ex.translations) && ex.translations.length) {
    const t = ex.translations.find((x) => String(x.language) === String(LANG_EN));
    return {
      name: t?.name || "",
      description: t?.description || "",
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
  
  return name;
}

function normalizeMuscleIds(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((m) => String(m?.id ?? m)).filter(Boolean);
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

function getCategory(ex) {
  const name = (ex.name || "").toLowerCase();

  if (name.includes("rowing") || name.includes("run") || name.includes("bike") || name.includes("jump")) {
    return "cardio";
  }

  if (name.includes("plank") || name.includes("hollow") || name.includes("crunch") || name.includes("leg raise") || name.includes("sit-up")) {
    return "core";
  }

  return "strength";
}

function buildPrescription(ex) {
  const cat = getCategory(ex);

  if (cat === "cardio") {
    const minutes = randPick(["6–8", "8–10", "10–12"]);
    return `Suggestion: ${minutes} minutes steady pace`;
  }

  if (cat === "core") {
    const seconds = randPick(["20–30", "30–45", "45–60"]);
    return `Suggestion: 3 sets × ${seconds} sec`;
  }

  const reps = randPick(["6–8", "8–12", "10–15"]);
  return `Suggestion: 3 sets × ${reps} reps`;
}

function buildTags(ex) {
  const tags = [];

  const hasEquipment =
    Array.isArray(ex.equipmentNames) && ex.equipmentNames.length > 0;

  if (!hasEquipment) tags.push("Bodyweight");
  else tags.push("Equipment");

  const cat = getCategory(ex);
  if (cat === "core") tags.push("Core");
  else if (cat === "cardio") tags.push("Cardio");
  else tags.push("Strength");

  if (hasEquipment) {
    ex.equipmentNames.slice(0, 2).forEach((n) => tags.push(n));
  }

  return tags;
}



function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");


}

function looksEnglish(text) {
  const t = (text || "").toLowerCase();


  const nonEnglishHints = ["respiración", "técnica", "consciente", "pierna", "ejercicio", "flexión", "schritt", "auf", "und", "mit", "para", "conectar", "mejorar"];
  if (nonEnglishHints.some(w => t.includes(w))) return false;


  const nonAscii = (text.match(/[^\x00-\x7F]/g) || []).length;
  if (nonAscii > 3) return false;

  return true;
}
