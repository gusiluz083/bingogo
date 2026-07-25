
const ROWS = 3;
const COLS = 9;
const CELL_COUNT = ROWS * COLS;

const state = {
  editing: true,
  cells: Array.from({ length: CELL_COUNT }, () => ({ value: "", marked: false })),
  called: [],
  savedCards: [],
  dark: false,
  scanFile: null
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  Object.assign(els, {
    grid: document.getElementById("bingoGrid"),
    editBtn: document.getElementById("editBtn"),
    modeHint: document.getElementById("modeHint"),
    clearMarksBtn: document.getElementById("clearMarksBtn"),
    newCardBtn: document.getElementById("newCardBtn"),
    themeBtn: document.getElementById("themeBtn"),
    voiceBtn: document.getElementById("voiceBtn"),
    voiceStatus: document.getElementById("voiceStatus"),
    cameraInput: document.getElementById("cameraInput"),
    scanPreviewWrap: document.getElementById("scanPreviewWrap"),
    scanPreview: document.getElementById("scanPreview"),
    scanBtn: document.getElementById("scanBtn"),
    scanStatus: document.getElementById("scanStatus"),
    scanResults: document.getElementById("scanResults"),
    numberPad: document.getElementById("numberPad"),
    resetCalledBtn: document.getElementById("resetCalledBtn"),
    statCalled: document.getElementById("statCalled"),
    statHits: document.getElementById("statHits"),
    statRemaining: document.getElementById("statRemaining"),
    lastNumbers: document.getElementById("lastNumbers"),
    cardNameInput: document.getElementById("cardNameInput"),
    saveCardBtn: document.getElementById("saveCardBtn"),
    savedCards: document.getElementById("savedCards"),
    toast: document.getElementById("toast")
  });

  loadState();
  bindEvents();
  renderAll();
  registerServiceWorker();
});

function bindEvents() {
  els.editBtn.addEventListener("click", () => {
    state.editing = !state.editing;
    renderGrid();
    saveState();
  });

  els.clearMarksBtn.addEventListener("click", () => {
    state.cells.forEach(c => c.marked = false);
    renderAll();
    saveState();
    toast("Tachados borrados");
  });

  els.newCardBtn.addEventListener("click", () => {
    if (!confirm("Se borrarán los números y marcas actuales. ¿Continuar?")) return;
    state.cells = Array.from({ length: CELL_COUNT }, () => ({ value: "", marked: false }));
    state.called = [];
    state.editing = true;
    renderAll();
    saveState();
  });

  els.themeBtn.addEventListener("click", () => {
    state.dark = !state.dark;
    renderTheme();
    saveState();
  });

  els.voiceBtn.addEventListener("click", startVoiceRecognition);

  els.cameraInput.addEventListener("change", e => {
    const file = e.target.files?.[0];
    if (!file) return;
    state.scanFile = file;
    els.scanPreview.src = URL.createObjectURL(file);
    els.scanPreviewWrap.classList.remove("hidden");
    els.scanBtn.disabled = false;
    els.scanStatus.textContent = "Foto lista";
  });

  els.scanBtn.addEventListener("click", scanImage);

  els.resetCalledBtn.addEventListener("click", () => {
    state.called = [];
    state.cells.forEach(c => c.marked = false);
    renderAll();
    saveState();
  });

  els.saveCardBtn.addEventListener("click", saveNamedCard);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem("miBingoState") || "{}");
    if (Array.isArray(saved.cells) && saved.cells.length === CELL_COUNT) state.cells = saved.cells;
    if (Array.isArray(saved.called)) state.called = saved.called;
    if (typeof saved.editing === "boolean") state.editing = saved.editing;
    if (typeof saved.dark === "boolean") state.dark = saved.dark;
    if (Array.isArray(saved.savedCards)) state.savedCards = saved.savedCards;
  } catch {}
}

function saveState() {
  localStorage.setItem("miBingoState", JSON.stringify({
    cells: state.cells,
    called: state.called,
    editing: state.editing,
    dark: state.dark,
    savedCards: state.savedCards
  }));
}

function renderAll() {
  renderTheme();
  renderGrid();
  renderNumberPad();
  renderStats();
  renderSavedCards();
}

function renderTheme() {
  document.body.classList.toggle("dark", state.dark);
  els.themeBtn.textContent = state.dark ? "☀️" : "🌙";
}

function renderGrid() {
  els.grid.innerHTML = "";
  els.editBtn.textContent = state.editing ? "Jugar" : "Editar";
  els.modeHint.textContent = state.editing
    ? "Introduce los números y deja vacías las casillas que no uses."
    : "Toca un número para tacharlo o destacharlo.";

  state.cells.forEach((cell, index) => {
    const div = document.createElement("div");
    div.className = "bingo-cell";
    if (!cell.value) div.classList.add("empty");
    if (cell.marked && !state.editing) div.classList.add("marked");

    if (state.editing) {
      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "numeric";
      input.maxLength = 2;
      input.value = cell.value;
      input.setAttribute("aria-label", `Casilla ${index + 1}`);
      input.addEventListener("input", e => {
        const cleaned = e.target.value.replace(/\D/g, "").slice(0, 2);
        e.target.value = cleaned;
        state.cells[index].value = cleaned;
        state.cells[index].marked = false;
        div.classList.toggle("empty", !cleaned);
        saveState();
        renderStats();
        renderNumberPad();
      });
      div.appendChild(input);
    } else {
      div.textContent = cell.value;
      div.addEventListener("click", () => {
        if (!cell.value) return;
        cell.marked = !cell.marked;
        renderGrid();
        renderStats();
        renderNumberPad();
        saveState();
      });
    }
    els.grid.appendChild(div);
  });
}

function renderNumberPad() {
  els.numberPad.innerHTML = "";
  const cardValues = new Set(state.cells.map(c => Number(c.value)).filter(Boolean));

  for (let n = 1; n <= 90; n++) {
    const btn = document.createElement("button");
    btn.className = "number-btn";
    btn.textContent = n;
    if (state.called.includes(n)) btn.classList.add("called");
    if (state.called.includes(n) && cardValues.has(n)) btn.classList.add("hit");
    btn.addEventListener("click", () => callNumber(n));
    els.numberPad.appendChild(btn);
  }
}

function callNumber(number) {
  if (!Number.isInteger(number) || number < 1 || number > 90) {
    toast("Número no válido");
    return;
  }

  if (!state.called.includes(number)) {
    state.called.unshift(number);
  }

  let hit = false;
  state.cells.forEach(cell => {
    if (Number(cell.value) === number) {
      cell.marked = true;
      hit = true;
    }
  });

  if (navigator.vibrate) navigator.vibrate(hit ? [120, 60, 120] : 50);

  renderAll();
  saveState();
  toast(hit ? `${number}: está en tu cartón` : `${number}: no está en tu cartón`);
}

function renderStats() {
  const calledSet = new Set(state.called);
  const filled = state.cells.filter(c => c.value);
  const hits = filled.filter(c => calledSet.has(Number(c.value))).length;
  const remaining = filled.filter(c => !c.marked).length;

  els.statCalled.textContent = calledSet.size;
  els.statHits.textContent = hits;
  els.statRemaining.textContent = remaining;

  els.lastNumbers.textContent = state.called.length
    ? `Últimos números: ${state.called.slice(0, 12).join(", ")}`
    : "Todavía no hay números cantados.";

  checkLineOrBingo();
}

function checkLineOrBingo() {
  const filledCount = state.cells.filter(c => c.value).length;
  if (!filledCount) return;

  const allMarked = state.cells.filter(c => c.value).every(c => c.marked);
  if (allMarked && filledCount >= 15) {
    toast("¡BINGO! Todos los números están tachados");
    if (navigator.vibrate) navigator.vibrate([250,100,250,100,500]);
    return;
  }

  for (let row = 0; row < ROWS; row++) {
    const rowCells = state.cells.slice(row * COLS, (row + 1) * COLS).filter(c => c.value);
    if (rowCells.length && rowCells.every(c => c.marked)) {
      const key = `line-${row}`;
      if (sessionStorage.getItem(key) !== "1") {
        sessionStorage.setItem(key, "1");
        toast(`¡LÍNEA en la fila ${row + 1}!`);
        if (navigator.vibrate) navigator.vibrate([180,80,180]);
      }
    }
  }
}

function startVoiceRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    toast("El reconocimiento de voz no está disponible en este navegador");
    els.voiceStatus.textContent = "No compatible";
    return;
  }

  const recognition = new Recognition();
  recognition.lang = "es-ES";
  recognition.interimResults = false;
  recognition.maxAlternatives = 3;

  els.voiceStatus.textContent = "Escuchando…";
  els.voiceBtn.disabled = true;

  recognition.onresult = event => {
    const alternatives = Array.from(event.results[0]).map(r => r.transcript);
    let number = null;
    for (const text of alternatives) {
      number = parseSpanishNumber(text);
      if (number) break;
    }

    if (number) {
      els.voiceStatus.textContent = `Oído: ${number}`;
      callNumber(number);
    } else {
      els.voiceStatus.textContent = "No entendido";
      toast(`No he entendido el número: ${alternatives[0] || ""}`);
    }
  };

  recognition.onerror = () => {
    els.voiceStatus.textContent = "Error";
    toast("No se ha podido usar el micrófono");
  };

  recognition.onend = () => {
    els.voiceBtn.disabled = false;
    setTimeout(() => {
      if (els.voiceStatus.textContent === "Escuchando…") els.voiceStatus.textContent = "Preparado";
    }, 500);
  };

  recognition.start();
}

function parseSpanishNumber(text) {
  const numeric = text.match(/\b([1-9]|[1-8]\d|90)\b/);
  if (numeric) return Number(numeric[1]);

  const normalized = text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();

  const units = {
    uno:1, una:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9,
    diez:10, once:11, doce:12, trece:13, catorce:14, quince:15,
    dieciseis:16, diecisiete:17, dieciocho:18, diecinueve:19,
    veinte:20, veintiuno:21, veintidos:22, veintitres:23, veinticuatro:24,
    veinticinco:25, veintiseis:26, veintisiete:27, veintiocho:28, veintinueve:29
  };
  if (units[normalized]) return units[normalized];

  const tens = { treinta:30, cuarenta:40, cincuenta:50, sesenta:60, setenta:70, ochenta:80, noventa:90 };
  for (const [word, value] of Object.entries(tens)) {
    if (normalized === word) return value;
    if (normalized.startsWith(word + " y ")) {
      const unitWord = normalized.slice((word + " y ").length);
      const u = units[unitWord];
      if (u && u < 10) return value + u;
    }
  }
  return null;
}

async function scanImage() {
  if (!state.scanFile) return;
  if (!window.Tesseract) {
    toast("No se ha podido cargar el reconocimiento de imagen");
    return;
  }

  els.scanBtn.disabled = true;
  els.scanStatus.textContent = "Analizando…";
  els.scanResults.classList.add("hidden");

  try {
    const result = await Tesseract.recognize(state.scanFile, "eng", {
      logger: m => {
        if (m.status === "recognizing text") {
          els.scanStatus.textContent = `${Math.round((m.progress || 0) * 100)}%`;
        }
      }
    });

    const raw = result.data.text || "";
    const numbers = [...new Set((raw.match(/\b(?:[1-9]|[1-8]\d|90)\b/g) || []).map(Number))]
      .filter(n => n >= 1 && n <= 90)
      .slice(0, 27);

    showScanResults(numbers);
    els.scanStatus.textContent = numbers.length ? `${numbers.length} detectados` : "Sin resultados";
  } catch (error) {
    els.scanStatus.textContent = "Error";
    toast("No se ha podido analizar la imagen");
  } finally {
    els.scanBtn.disabled = false;
  }
}

function showScanResults(numbers) {
  els.scanResults.innerHTML = "";
  els.scanResults.classList.remove("hidden");

  const p = document.createElement("p");
  p.textContent = numbers.length
    ? "Revisa los números detectados y pulsa “Usar estos números”."
    : "No se han detectado números con claridad. Prueba con mejor luz y la cámara recta.";
  els.scanResults.appendChild(p);

  if (!numbers.length) return;

  const list = document.createElement("div");
  list.className = "scan-number-list";
  numbers.forEach(n => {
    const chip = document.createElement("button");
    chip.className = "scan-number";
    chip.textContent = n;
    chip.dataset.selected = "1";
    chip.addEventListener("click", () => {
      const selected = chip.dataset.selected === "1";
      chip.dataset.selected = selected ? "0" : "1";
      chip.style.opacity = selected ? ".35" : "1";
    });
    list.appendChild(chip);
  });
  els.scanResults.appendChild(list);

  const useBtn = document.createElement("button");
  useBtn.className = "primary-btn";
  useBtn.textContent = "Usar estos números";
  useBtn.addEventListener("click", () => {
    const selected = [...list.children]
      .filter(el => el.dataset.selected === "1")
      .map(el => Number(el.textContent))
      .slice(0, 15);

    state.cells = Array.from({ length: CELL_COUNT }, () => ({ value: "", marked: false }));
    selected.forEach((n, i) => {
      state.cells[i].value = String(n);
    });
    state.editing = true;
    renderAll();
    saveState();
    toast("Números cargados. Colócalos en las casillas correctas.");
  });
  els.scanResults.appendChild(useBtn);
}

function saveNamedCard() {
  const name = els.cardNameInput.value.trim() || `Cartón ${state.savedCards.length + 1}`;
  const values = state.cells.map(c => c.value);
  if (!values.some(Boolean)) {
    toast("Introduce algún número antes de guardar");
    return;
  }

  state.savedCards.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name,
    values,
    createdAt: new Date().toISOString()
  });

  els.cardNameInput.value = "";
  renderSavedCards();
  saveState();
  toast("Cartón guardado");
}

function renderSavedCards() {
  els.savedCards.innerHTML = "";
  if (!state.savedCards.length) {
    els.savedCards.innerHTML = '<p class="small-note">Todavía no has guardado ningún cartón.</p>';
    return;
  }

  state.savedCards.forEach(card => {
    const item = document.createElement("div");
    item.className = "saved-item";

    const name = document.createElement("div");
    name.className = "saved-item-name";
    name.textContent = card.name;

    const load = document.createElement("button");
    load.textContent = "Abrir";
    load.addEventListener("click", () => {
      state.cells = card.values.map(v => ({ value: v, marked: false }));
      state.called = [];
      state.editing = false;
      renderAll();
      saveState();
      toast(`Cartón “${card.name}” abierto`);
    });

    const del = document.createElement("button");
    del.textContent = "Eliminar";
    del.addEventListener("click", () => {
      state.savedCards = state.savedCards.filter(c => c.id !== card.id);
      renderSavedCards();
      saveState();
    });

    item.append(name, load, del);
    els.savedCards.appendChild(item);
  });
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => els.toast.classList.add("hidden"), 2600);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}
