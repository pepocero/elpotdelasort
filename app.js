const STORAGE_KEY = "elPotData";

const defaultData = () => ({
  classrooms: [],
  lastClassId: "",
  lastGroupSize: 3,
  lastGroups: [],
});

const GROUP_ANIMATION_DURATION = 6500;

const state = {
  data: defaultData(),
  editingId: "",
  lastTouchTime: 0,
  shuffleTimer: null,
  shuffleAnimating: false,
  shuffleTimeouts: [],
  celebrationFrame: null,
  turnPool: [],
  turnPicked: [],
  turnSourceKey: "",
};

const elements = {};

const loadData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    return { ...defaultData(), ...parsed };
  } catch (error) {
    return defaultData();
  }
};

const saveData = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
};

const $ = (id) => document.getElementById(id);

const addTapListener = (element, handler) => {
  if (!element) return;
  element.addEventListener("touchend", (event) => {
    event.preventDefault();
    state.lastTouchTime = Date.now();
    handler(event);
  });
  element.addEventListener("click", (event) => {
    if (Date.now() - state.lastTouchTime < 500) return;
    handler(event);
  });
};

const shuffle = (array) => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const parseList = (text) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const randomLetter = () => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return letters[Math.floor(Math.random() * letters.length)];
};

const setCardSizeFromGroups = (groups) => {
  const maxSize = groups.reduce((max, group) => Math.max(max, group.length), 0);
  const baseHeight = 140;
  const perStudent = 22;
  const height = Math.max(220, Math.min(320, baseHeight + maxSize * perStudent));
  const width = 200;
  elements.groupsResult.style.setProperty("--card-width", `${width}px`);
  elements.groupsResult.style.setProperty("--card-height", `${height}px`);
  document.documentElement.style.setProperty("--card-width", `${width}px`);
  document.documentElement.style.setProperty("--card-height", `${height}px`);
};

const createShuffleCard = (letter, index) => {
  const card = document.createElement("div");
  card.className = "shuffle-card";
  card.style.setProperty("--index", `${index}`);
  card.dataset.letter = letter;
  const letterSpan = document.createElement("span");
  letterSpan.className = "shuffle-letter";
  letterSpan.textContent = letter;
  card.appendChild(letterSpan);
  const face = document.createElement("div");
  face.className = "shuffle-face shuffle-back";
  const background = document.createElement("div");
  background.className = "shuffle-background";
  face.appendChild(background);
  card.appendChild(face);
  return card;
};

const updateShuffleStack = (cards, visibleLetters = 4) => {
  cards.forEach((card, index) => {
    card.style.setProperty("--index", `${index}`);
    card.style.zIndex = (cards.length - index).toString();
    const letterSpan = card.querySelector(".shuffle-letter");
    if (letterSpan) {
      letterSpan.textContent = index < visibleLetters ? card.dataset.letter : "";
    }
  });
};

const renderLanding = () => {
  elements.landing.classList.remove("hidden");
  elements.app.classList.add("hidden");
};

const renderApp = () => {
  elements.landing.classList.add("hidden");
  elements.app.classList.remove("hidden");
};

const setActiveTab = (target) => {
  document.querySelectorAll(".btn.tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.target === target);
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === target);
  });
};

const renderClassCards = () => {
  elements.classList.innerHTML = "";
  if (state.data.classrooms.length === 0) {
    elements.classList.innerHTML = "<p>No hi ha aules guardades encara.</p>";
    return;
  }

  state.data.classrooms.forEach((classroom) => {
    const card = document.createElement("div");
    card.className = "class-card";

    const title = document.createElement("h4");
    title.textContent = classroom.name;
    card.appendChild(title);

    const meta = document.createElement("p");
    meta.textContent = `${classroom.students.length} alumnes`;
    card.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "actions";

    const btnSelect = document.createElement("button");
    btnSelect.className = "btn";
    btnSelect.textContent = "Seleccionar";
    addTapListener(btnSelect, () => selectClassroom(classroom.id));

    const btnEdit = document.createElement("button");
    btnEdit.className = "btn";
    btnEdit.textContent = "Editar";
    addTapListener(btnEdit, () => startEditClassroom(classroom.id));

    const btnDelete = document.createElement("button");
    btnDelete.className = "btn";
    btnDelete.textContent = "Eliminar";
    addTapListener(btnDelete, () => deleteClassroom(classroom.id));

    actions.appendChild(btnSelect);
    actions.appendChild(btnEdit);
    actions.appendChild(btnDelete);
    card.appendChild(actions);
    elements.classList.appendChild(card);
  });
};

const renderClassSelects = () => {
  const options = state.data.classrooms.map((classroom) => {
    return `<option value="${classroom.id}">${classroom.name}</option>`;
  });
  const emptyOption = `<option value="">Selecciona una aula</option>`;

  elements.groupsClass.innerHTML = emptyOption + options.join("");
  elements.pickerClass.innerHTML = emptyOption + options.join("");
  if (elements.turnClass) {
    elements.turnClass.innerHTML = emptyOption + options.join("");
  }

  if (state.data.lastClassId) {
    elements.groupsClass.value = state.data.lastClassId;
    elements.pickerClass.value = state.data.lastClassId;
    if (elements.turnClass) {
      elements.turnClass.value = state.data.lastClassId;
    }
    loadClassroomStudents(state.data.lastClassId);
  }
};

const resetForm = () => {
  elements.className.value = "";
  elements.classStudents.value = "";
  state.editingId = "";
  elements.btnCancelEdit.classList.add("hidden");
};

const saveClassroom = () => {
  const name = elements.className.value.trim();
  const students = parseList(elements.classStudents.value);
  if (!name) {
    showAlert("Cal indicar el nom de la classe.");
    return;
  }
  if (students.length === 0) {
    showAlert("Cal afegir almenys un alumne.");
    return;
  }

  if (state.editingId) {
    const existing = state.data.classrooms.find((item) => item.id === state.editingId);
    if (existing) {
      existing.name = name;
      existing.students = students;
    }
  } else {
    state.data.classrooms.push({
      id: crypto.randomUUID(),
      name,
      students,
    });
  }

  saveData();
  renderClassCards();
  renderClassSelects();
  resetForm();
};

const startEditClassroom = (id) => {
  const classroom = state.data.classrooms.find((item) => item.id === id);
  if (!classroom) return;
  state.editingId = id;
  elements.className.value = classroom.name;
  elements.classStudents.value = classroom.students.join("\n");
  elements.btnCancelEdit.classList.remove("hidden");
  setActiveTab("config");
};

const deleteClassroom = (id) => {
  if (!confirm("Vols eliminar aquesta aula?")) return;
  state.data.classrooms = state.data.classrooms.filter((item) => item.id !== id);
  if (state.data.lastClassId === id) {
    state.data.lastClassId = "";
  }
  saveData();
  renderClassCards();
  renderClassSelects();
};

const selectClassroom = (id) => {
  state.data.lastClassId = id;
  saveData();
  renderClassSelects();
  setActiveTab("groups");
};

const loadClassroomStudents = (id) => {
  const classroom = state.data.classrooms.find((item) => item.id === id);
  if (!classroom) {
    elements.groupsStudents.value = "";
    return;
  }
  elements.groupsStudents.value = classroom.students.join("\n");
};

const createGroups = (students, groupSize) => {
  const normalizedSize = Math.max(2, groupSize);
  let groupCount = Math.ceil(students.length / normalizedSize);

  if (students.length % normalizedSize === 1 && groupCount > 1) {
    groupCount -= 1;
  }

  const groups = Array.from({ length: groupCount }, () => []);
  const shuffled = shuffle(students);

  shuffled.forEach((student, index) => {
    groups[index % groupCount].push(student);
  });

  return groups;
};

const renderGroups = (groups) => {
  elements.groupsResult.innerHTML = "";
  setCardSizeFromGroups(groups);
  groups.forEach((group, index) => {
    const card = document.createElement("div");
    card.className = "group-card group-card-animated";
    card.style.setProperty("--delay", `${index * 0.9}s`);

    const inner = document.createElement("div");
    inner.className = "group-card-inner";

    const front = document.createElement("div");
    front.className = "group-card-face group-card-front";

    const back = document.createElement("div");
    back.className = "group-card-face group-card-back";
    const backTitle = document.createElement("h4");
    backTitle.textContent = `Grup ${index + 1}`;
    const list = document.createElement("ul");
    list.className = "group-list";
    group.forEach((student) => {
      const item = document.createElement("li");
      item.textContent = student;
      list.appendChild(item);
    });
    back.appendChild(backTitle);
    back.appendChild(list);

    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);
    elements.groupsResult.appendChild(card);
  });
};

const animateGroups = () => {
  elements.groupsResult.innerHTML = "";
  const area = document.createElement("div");
  area.className = "shuffle-area";

  const title = document.createElement("div");
  title.className = "shuffle-title";
  title.textContent = "Barrejant cartes...";

  const stack = document.createElement("div");
  stack.className = "shuffle-cards";

  const cards = [];
  const totalCards = 5;
  const visibleLetters = 3;
  for (let i = 0; i < totalCards; i += 1) {
    const letter = randomLetter();
    const card = createShuffleCard(letter, i);
    cards.push(card);
    stack.appendChild(card);
  }

  area.appendChild(title);
  area.appendChild(stack);
  elements.groupsResult.appendChild(area);

  if (state.shuffleTimer) {
    clearInterval(state.shuffleTimer);
  }
  state.shuffleTimeouts.forEach((timeout) => clearTimeout(timeout));
  state.shuffleTimeouts = [];
  updateShuffleStack(cards, visibleLetters);

  const runShuffleCycle = () => {
    if (state.shuffleAnimating) return;
    state.shuffleAnimating = true;

    const first = cards[1];
    const second = cards[2];
    const third = cards[3];
    const fourth = cards[4];
    const top = cards[0];

    if (!top) return;

    if (second) second.style.left = "-50px";
    if (third) third.style.left = "-100px";
    if (fourth) fourth.style.left = "-150px";

    const t1 = setTimeout(() => {
      top.style.left = "210px";
      if (first) first.style.left = "210px";
      if (second) second.style.left = "0px";
      if (third) third.style.left = "0px";
      if (fourth) fourth.style.left = "0px";
    }, 900);

    const t2 = setTimeout(() => {
      if (first) first.style.zIndex = "1";
      top.style.zIndex = "2";
      if (first) first.style.left = "0px";
      top.style.left = "0px";
    }, 1500);

    const t3 = setTimeout(() => {
      top.style.zIndex = "4";
      if (first) first.style.zIndex = "3";
      cards.push(cards.shift());
      updateShuffleStack(cards, visibleLetters);
      state.shuffleAnimating = false;
    }, 2200);

    state.shuffleTimeouts.push(t1, t2, t3);
  };

  const cycleDuration = 2400;
  runShuffleCycle();
  state.shuffleTimer = setInterval(runShuffleCycle, cycleDuration);
};

const stopShuffleAnimation = () => {
  if (state.shuffleTimer) {
    clearInterval(state.shuffleTimer);
    state.shuffleTimer = null;
  }
  state.shuffleTimeouts.forEach((timeout) => clearTimeout(timeout));
  state.shuffleTimeouts = [];
  state.shuffleAnimating = false;
};

const handleGenerateGroups = () => {
  const students = parseList(elements.groupsStudents.value);
  const size = Number(elements.groupSize.value) || 2;
  if (students.length < 2) {
    showAlert("Cal tenir almenys 2 alumnes per crear grups.");
    return;
  }

  const groups = createGroups(students, size);
  setCardSizeFromGroups(groups);
  animateGroups();
  state.data.lastGroupSize = size;

  setTimeout(() => {
    stopShuffleAnimation();
    state.data.lastGroups = groups;
    saveData();
    renderGroups(groups);
  }, GROUP_ANIMATION_DURATION);
};

const getPickerList = () => {
  const manual = parseList(elements.pickerList.value);
  if (manual.length > 0) {
    return manual;
  }
  const classId = elements.pickerClass.value;
  const classroom = state.data.classrooms.find((item) => item.id === classId);
  return classroom ? classroom.students : [];
};

const renderPickerClassChips = () => {
  if (!elements.pickerClassStudents) return;
  elements.pickerClassStudents.innerHTML = "";
  const classId = elements.pickerClass.value;
  const classroom = state.data.classrooms.find((item) => item.id === classId);
  const list = classroom ? classroom.students : [];
  if (list.length === 0) {
    return;
  }
  list.forEach((name) => {
    const chip = document.createElement("span");
    chip.className = "turn-chip";
    chip.textContent = name;
    elements.pickerClassStudents.appendChild(chip);
  });
};

const animatePicker = (list) => {
  let index = 0;
  const intervalMs = 360;
  const minFlips = 20;
  const totalFlips = list.length >= minFlips ? list.length : minFlips;
  const sequence = [];
  if (list.length >= minFlips) {
    sequence.push(...shuffle(list));
  } else {
    for (let i = 0; i < totalFlips; i += 1) {
      sequence.push(list[Math.floor(Math.random() * list.length)]);
    }
  }

  elements.pickerResult.textContent = "";

  const interval = setInterval(() => {
    if (index >= sequence.length) {
      clearInterval(interval);
      const finalPick = sequence[sequence.length - 1];
      setTimeout(() => {
        elements.pickerAnimation.textContent = finalPick;
        launchCelebration();
      }, 260);
      elements.pickerResult.textContent = "";
      return;
    }
    const current = sequence[index];
    elements.pickerAnimation.classList.remove("flip");
    void elements.pickerAnimation.offsetWidth;
    elements.pickerAnimation.classList.add("flip");
    setTimeout(() => {
      elements.pickerAnimation.textContent = current;
    }, 220);
    index += 1;
  }, intervalMs);
};

const resizeCelebrationCanvas = () => {
  if (!elements.celebrationCanvas) return;
  const rect = elements.celebrationCanvas.getBoundingClientRect();
  elements.celebrationCanvas.width = Math.max(1, Math.floor(rect.width));
  elements.celebrationCanvas.height = Math.max(1, Math.floor(rect.height));
};

const launchCelebration = () => {
  if (!elements.celebrationCanvas) return;
  const ctx = elements.celebrationCanvas.getContext("2d");
  if (!ctx) return;
  resizeCelebrationCanvas();

  if (state.celebrationFrame) {
    cancelAnimationFrame(state.celebrationFrame);
    state.celebrationFrame = null;
  }

  const width = elements.celebrationCanvas.width;
  const height = elements.celebrationCanvas.height;
  const particles = [];
  const colors = ["#ffb703", "#3b6ef5", "#e63946", "#2a9d8f", "#8338ec"];

  const createConfetti = () => {
    for (let i = 0; i < 80; i += 1) {
      particles.push({
        x: Math.random() * width,
        y: -20,
        vx: (Math.random() - 0.5) * 1.8,
        vy: 1 + Math.random() * 2.2,
        size: 4 + Math.random() * 4,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 200 + Math.random() * 80,
      });
    }
  };

  const createFireworks = () => {
    const centerX = width * (0.3 + Math.random() * 0.4);
    const centerY = height * (0.2 + Math.random() * 0.3);
    for (let i = 0; i < 40; i += 1) {
      const angle = (Math.PI * 2 * i) / 40;
      const speed = 1.2 + Math.random() * 1.6;
      particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 2,
        rotation: 0,
        spin: 0,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 80 + Math.random() * 40,
      });
    }
  };

  createConfetti();
  createFireworks();

  const start = Date.now();
  const duration = 2400;

  const tick = () => {
    const elapsed = Date.now() - start;
    ctx.clearRect(0, 0, width, height);

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.015;
      p.rotation += p.spin;
      p.life -= 1;
    });

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      if (particles[i].life <= 0) {
        particles.splice(i, 1);
      }
    }

    particles.forEach((p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 120));
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    if (elapsed < duration || particles.length > 0) {
      state.celebrationFrame = requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, width, height);
      state.celebrationFrame = null;
    }
  };

  state.celebrationFrame = requestAnimationFrame(tick);
};

const getTurnCandidates = () => {
  const manual = parseList(elements.turnList.value);
  if (manual.length > 0) {
    return { list: manual, key: `manual:${manual.join("|")}` };
  }
  const classId = elements.turnClass.value;
  const classroom = state.data.classrooms.find((item) => item.id === classId);
  const list = classroom ? classroom.students : [];
  return { list, key: `class:${classId}` };
};

const renderTurnClassChips = () => {
  if (!elements.turnClassStudents) return;
  elements.turnClassStudents.innerHTML = "";
  const classId = elements.turnClass.value;
  const classroom = state.data.classrooms.find((item) => item.id === classId);
  const list = classroom ? classroom.students : [];
  if (list.length === 0) {
    return;
  }
  list.forEach((name) => {
    const chip = document.createElement("span");
    chip.className = "turn-chip";
    chip.textContent = name;
    elements.turnClassStudents.appendChild(chip);
  });
};

const renderTurnList = () => {
  elements.turnListDisplay.innerHTML = "";
  if (state.turnPicked.length === 0) {
    elements.turnListDisplay.innerHTML = "<p>Encara no s'han iniciat els torns.</p>";
    return;
  }
  state.turnPicked.forEach((name, index) => {
    const item = document.createElement("div");
    item.className = "turn-item";
    item.classList.add("picked");
    const label = document.createElement("span");
    label.textContent = name;
    const order = document.createElement("span");
    order.className = "turn-order";
    order.textContent = `#${index + 1}`;
    item.appendChild(label);
    item.appendChild(order);
    elements.turnListDisplay.appendChild(item);
  });
};

const resetTurnState = (list, key) => {
  state.turnPool = shuffle(list);
  state.turnPicked = [];
  state.turnSourceKey = key;
  elements.turnCurrent.textContent = "Preparat/da per començar?";
  renderTurnList();
};

const startTurns = () => {
  const { list, key } = getTurnCandidates();
  if (list.length === 0) {
    showAlert("Introdueix una llista o selecciona una aula.");
    return;
  }
  resetTurnState(list, key);
  handleTurnNext();
};

const handleTurnNext = () => {
  const { list, key } = getTurnCandidates();
  if (list.length === 0) {
    showAlert("Introdueix una llista o selecciona una aula.");
    return;
  }
  if (!state.turnSourceKey || state.turnSourceKey !== key) {
    resetTurnState(list, key);
  }
  const next = state.turnPool.shift();
  if (!next) {
    showModal("Torns completats", "Ja han sortit tots els alumnes.");
    return;
  }
  state.turnPicked.push(next);
  elements.turnCurrent.textContent = next;
  renderTurnList();
};

const handleTurnReset = () => {
  const { list, key } = getTurnCandidates();
  if (list.length === 0) {
    showAlert("Introdueix una llista o selecciona una aula.");
    return;
  }
  resetTurnState(list, key);
};

const handlePick = () => {
  const list = getPickerList();
  if (list.length === 0) {
    showAlert("Introdueix una llista o selecciona una aula.");
    return;
  }
  elements.pickerResult.textContent = "";
  animatePicker(list);
};

const showModal = (title, message) => {
  if (!elements.alertModal || !elements.alertModalMessage || !elements.alertModalTitle) return;
  elements.alertModalTitle.textContent = title;
  elements.alertModalMessage.textContent = message;
  elements.alertModal.classList.remove("hidden");
};

const showAlert = (message) => {
  showModal("Avís", message);
};

const hideModal = () => {
  if (!elements.alertModal) return;
  elements.alertModal.classList.add("hidden");
};

const exportToPDF = () => {
  if (!state.data.lastGroups || state.data.lastGroups.length === 0) {
    showAlert("Primer cal generar els grups.");
    return;
  }
  const classId = elements.groupsClass.value || state.data.lastClassId;
  const classroom = state.data.classrooms.find((item) => item.id === classId);
  const className = classroom ? classroom.name : "Aula sense nom";
  const date = new Date().toLocaleDateString("ca-ES");

  const content = `
    <html>
      <head>
        <title>El Pot de la Sort - ${className}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          h1 { margin-top: 0; }
          .group { margin-bottom: 16px; }
          .group h3 { margin-bottom: 6px; }
        </style>
      </head>
      <body>
        <h1>El Pot de la Sort</h1>
        <p><strong>Classe:</strong> ${className}</p>
        <p><strong>Data:</strong> ${date}</p>
        ${state.data.lastGroups
          .map(
            (group, index) => `
              <div class="group">
                <h3>Grup ${index + 1}</h3>
                <p>${group.join(", ")}</p>
              </div>
            `
          )
          .join("")}
      </body>
    </html>
  `;

  const pdfWindow = window.open("", "_blank");
  if (!pdfWindow) {
    showAlert("El navegador ha bloquejat l'exportació. Permet finestres emergents.");
    return;
  }
  pdfWindow.document.write(content);
  pdfWindow.document.close();
  pdfWindow.focus();
  pdfWindow.print();
};

const exportData = () => {
  const payload = {
    ...state.data,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "el-pot-de-la-sort-dades.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const isValidImport = (data) => {
  if (!data || typeof data !== "object") return false;
  if (!Array.isArray(data.classrooms)) return false;
  return data.classrooms.every((classroom) => {
    return (
      classroom &&
      typeof classroom.id === "string" &&
      typeof classroom.name === "string" &&
      Array.isArray(classroom.students) &&
      classroom.students.every((student) => typeof student === "string")
    );
  });
};

const importData = (file) => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!isValidImport(parsed)) {
        showAlert("El fitxer no té un format vàlid d'El Pot de la Sort.");
        return;
      }
      state.data = {
        ...defaultData(),
        ...parsed,
      };
      saveData();
      renderClassCards();
      renderClassSelects();
      elements.groupSize.value = state.data.lastGroupSize || 3;
      elements.groupsResult.innerHTML = "";
      elements.pickerResult.textContent = "";
      elements.pickerAnimation.textContent = "Preparat/da?";
      showAlert("Dades importades correctament.");
    } catch (error) {
      showAlert("No s'ha pogut llegir el fitxer. Revisa que sigui un JSON vàlid.");
    }
  };
  reader.readAsText(file);
};

const handleReset = () => {
  const message =
    "Estàs segur/a que vols esborrar totes les dades? Aquesta acció no es pot desfer.";
  if (!confirm(message)) return;
  localStorage.clear();
  state.data = defaultData();
  renderClassCards();
  renderClassSelects();
  resetForm();
  elements.groupsStudents.value = "";
  elements.groupsResult.innerHTML = "";
  elements.pickerList.value = "";
  elements.pickerAnimation.textContent = "Preparat/da?";
  elements.pickerResult.textContent = "";
  renderLanding();
};

document.addEventListener("DOMContentLoaded", () => {
  elements.landing = $("landing");
  elements.app = $("app");
  elements.btnEnter = $("btn-enter");
  elements.btnGoLanding = $("btn-go-landing");
  elements.className = $("class-name");
  elements.classStudents = $("class-students");
  elements.btnSaveClass = $("btn-save-class");
  elements.btnCancelEdit = $("btn-cancel-edit");
  elements.classList = $("class-list");
  elements.groupsClass = $("groups-class");
  elements.groupsStudents = $("groups-students");
  elements.groupSize = $("group-size");
  elements.btnGenerateGroups = $("btn-generate-groups");
  elements.groupsResult = $("groups-result");
  elements.btnExportPDF = $("btn-export-pdf");
  elements.btnExportData = $("btn-export-data");
  elements.btnImportData = $("btn-import-data");
  elements.importFile = $("import-file");
  elements.pickerClass = $("picker-class");
  elements.pickerList = $("picker-list");
  elements.btnPick = $("btn-pick");
  elements.pickerAnimation = $("picker-animation");
  elements.pickerResult = $("picker-result");
  elements.pickerClassStudents = $("picker-class-students");
  elements.celebrationCanvas = $("picker-celebration");
  elements.turnClass = $("turn-class");
  elements.turnList = $("turn-list");
  elements.btnTurnStart = $("btn-turn-start");
  elements.btnTurnNext = $("btn-turn-next");
  elements.btnTurnReset = $("btn-turn-reset");
  elements.turnCurrent = $("turn-current");
  elements.turnListDisplay = $("turn-list-display");
  elements.turnClassStudents = $("turn-class-students");
  elements.alertModal = $("alert-modal");
  elements.alertModalTitle = $("alert-modal-title");
  elements.alertModalMessage = $("alert-modal-message");
  elements.alertModalClose = $("alert-modal-close");
  elements.btnReset = $("btn-reset");

  state.data = loadData();

  renderClassCards();
  renderClassSelects();
  elements.groupSize.value = state.data.lastGroupSize || 3;

  addTapListener(elements.btnEnter, () => renderApp());
  addTapListener(elements.btnGoLanding, () => renderLanding());
  addTapListener(elements.btnSaveClass, saveClassroom);
  addTapListener(elements.btnCancelEdit, resetForm);
  addTapListener(elements.btnGenerateGroups, handleGenerateGroups);
  addTapListener(elements.btnPick, handlePick);
  addTapListener(elements.btnTurnStart, startTurns);
  addTapListener(elements.btnTurnNext, handleTurnNext);
  addTapListener(elements.btnTurnReset, handleTurnReset);
  addTapListener(elements.btnExportPDF, exportToPDF);
  addTapListener(elements.btnExportData, exportData);
  addTapListener(elements.btnImportData, () => elements.importFile.click());
  addTapListener(elements.btnReset, handleReset);

  elements.groupsClass.addEventListener("change", (event) => {
    state.data.lastClassId = event.target.value;
    saveData();
    loadClassroomStudents(event.target.value);
  });

  elements.pickerClass.addEventListener("change", (event) => {
    state.data.lastClassId = event.target.value;
    saveData();
    renderPickerClassChips();
  });

  elements.turnClass.addEventListener("change", (event) => {
    state.data.lastClassId = event.target.value;
    saveData();
    renderTurnClassChips();
  });

  document.querySelectorAll(".btn.tab").forEach((btn) => {
    addTapListener(btn, () => {
      setActiveTab(btn.dataset.target);
      if (elements.groupsClass) {
        elements.groupsClass.value = "";
        elements.groupsStudents.value = "";
      }
      if (elements.pickerClass) {
        elements.pickerClass.value = "";
        renderPickerClassChips();
      }
      if (elements.turnClass) {
        elements.turnClass.value = "";
        renderTurnClassChips();
      }
    });
  });

  if (elements.alertModalClose) {
    addTapListener(elements.alertModalClose, hideModal);
    elements.alertModalClose.addEventListener("click", (event) => {
      event.preventDefault();
      hideModal();
    });
    elements.alertModalClose.addEventListener("touchend", (event) => {
      event.preventDefault();
      hideModal();
    });
  }
  if (elements.alertModal) {
    addTapListener(elements.alertModal, (event) => {
      if (event.target === elements.alertModal) {
        hideModal();
      }
    });
  }

  elements.importFile.addEventListener("change", (event) => {
    const file = event.target.files[0];
    importData(file);
    event.target.value = "";
  });

  window.addEventListener("resize", resizeCelebrationCanvas);
  resizeCelebrationCanvas();
  hideModal();
});
