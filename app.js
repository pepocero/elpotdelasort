const STORAGE_KEY = "elPotData";

const defaultData = () => ({
  classrooms: [],
  lastClassId: "",
  lastGroupSize: 3,
  lastGroups: [],
  timerSound: "beep_long",
  timerSoundDurationSec: 2,
  rouletteSets: [],
  lastRouletteSetId: "",
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
  timer: {
    durationMs: 10 * 60 * 1000,
    remainingMs: 10 * 60 * 1000,
    running: false,
    intervalId: null,
    endAt: null,
  },
  timerSeconds: 10 * 60,
  timerHold: {
    timeoutId: null,
    intervalId: null,
    handledLong: false,
  },
  audioContext: null,
  diceCount: 1,
  diceRolling: false,
  rouletteRotation: 0,
  rouletteSpinning: false,
  rouletteLastIndex: null,
  rouletteEditingId: "",
  pickerExcluded: new Set(),
  turnExcluded: new Set(),
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
  if (!elements.landing || !elements.app) return;
  elements.landing.classList.remove("hidden");
  elements.app.classList.add("hidden");
};

const renderApp = () => {
  if (!elements.landing || !elements.app) return;
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

const renderRouletteSetCards = () => {
  if (!elements.rouletteSetList) return;
  elements.rouletteSetList.innerHTML = "";
  if (!state.data.rouletteSets || state.data.rouletteSets.length === 0) {
    elements.rouletteSetList.innerHTML = "<p>No hi ha conjunts guardats encara.</p>";
    return;
  }
  state.data.rouletteSets.forEach((setItem) => {
    const card = document.createElement("div");
    card.className = "class-card";

    const title = document.createElement("h4");
    title.textContent = setItem.name;
    card.appendChild(title);

    const meta = document.createElement("p");
    meta.textContent = `${setItem.options.length} opcions`;
    card.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "actions";

    const btnSelect = document.createElement("button");
    btnSelect.className = "btn";
    btnSelect.textContent = "Seleccionar";
    addTapListener(btnSelect, () => selectRouletteSet(setItem.id));

    const btnEdit = document.createElement("button");
    btnEdit.className = "btn";
    btnEdit.textContent = "Editar";
    addTapListener(btnEdit, () => startEditRouletteSet(setItem.id));

    const btnDelete = document.createElement("button");
    btnDelete.className = "btn";
    btnDelete.textContent = "Eliminar";
    addTapListener(btnDelete, () => deleteRouletteSet(setItem.id));

    actions.appendChild(btnSelect);
    actions.appendChild(btnEdit);
    actions.appendChild(btnDelete);
    card.appendChild(actions);
    elements.rouletteSetList.appendChild(card);
  });
};

const renderRouletteSetSelect = () => {
  if (!elements.rouletteSaved) return;
  const options = (state.data.rouletteSets || []).map((setItem) => {
    return `<option value="${setItem.id}">${setItem.name}</option>`;
  });
  const emptyOption = `<option value="">Selecciona un conjunt</option>`;
  elements.rouletteSaved.innerHTML = emptyOption + options.join("");
  if (state.data.lastRouletteSetId) {
    elements.rouletteSaved.value = state.data.lastRouletteSetId;
  }
};

const resetRouletteSetForm = () => {
  if (!elements.rouletteSetName || !elements.rouletteSetOptions) return;
  elements.rouletteSetName.value = "";
  elements.rouletteSetOptions.value = "";
  state.rouletteEditingId = "";
  if (elements.btnCancelRouletteEdit) {
    elements.btnCancelRouletteEdit.classList.add("hidden");
  }
};

const saveRouletteSet = () => {
  const name = elements.rouletteSetName.value.trim();
  const options = parseList(elements.rouletteSetOptions.value);
  if (!name) {
    showAlert("Cal indicar el nom del conjunt.");
    return;
  }
  if (options.length < 2) {
    showAlert("Cal afegir almenys 2 opcions.");
    return;
  }
  if (state.rouletteEditingId) {
    const existing = state.data.rouletteSets.find((item) => item.id === state.rouletteEditingId);
    if (existing) {
      existing.name = name;
      existing.options = options;
    }
  } else {
    state.data.rouletteSets.push({
      id: crypto.randomUUID(),
      name,
      options,
    });
  }
  saveData();
  renderRouletteSetCards();
  renderRouletteSetSelect();
  resetRouletteSetForm();
};

const startEditRouletteSet = (id) => {
  const setItem = state.data.rouletteSets.find((item) => item.id === id);
  if (!setItem) return;
  state.rouletteEditingId = id;
  elements.rouletteSetName.value = setItem.name;
  elements.rouletteSetOptions.value = setItem.options.join("\n");
  if (elements.btnCancelRouletteEdit) {
    elements.btnCancelRouletteEdit.classList.remove("hidden");
  }
  setActiveTab("settings");
};

const deleteRouletteSet = (id) => {
  if (!confirm("Vols eliminar aquest conjunt?")) return;
  state.data.rouletteSets = state.data.rouletteSets.filter((item) => item.id !== id);
  if (state.data.lastRouletteSetId === id) {
    state.data.lastRouletteSetId = "";
  }
  saveData();
  renderRouletteSetCards();
  renderRouletteSetSelect();
};

const selectRouletteSet = (id) => {
  state.data.lastRouletteSetId = id;
  saveData();
  renderRouletteSetSelect();
  loadRouletteSetOptions(id);
  setActiveTab("dice-wheel");
  if (elements.sidebar) {
    elements.sidebar.classList.remove("open");
  }
  if (elements.sidebarBackdrop) {
    elements.sidebarBackdrop.classList.remove("visible");
  }
};

const loadRouletteSetOptions = (id) => {
  if (!elements.rouletteOptions) return;
  const setItem = state.data.rouletteSets.find((item) => item.id === id);
  if (!setItem) {
    return;
  }
  elements.rouletteOptions.value = setItem.options.join("\n");
  buildRoulette(setItem.options);
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
    return manual.filter((name) => !state.pickerExcluded.has(name));
  }
  const classId = elements.pickerClass.value;
  const classroom = state.data.classrooms.find((item) => item.id === classId);
  const list = classroom ? classroom.students : [];
  return list.filter((name) => !state.pickerExcluded.has(name));
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
    if (state.pickerExcluded.has(name)) {
      chip.classList.add("excluded");
    }
    addTapListener(chip, () => {
      if (state.pickerExcluded.has(name)) {
        state.pickerExcluded.delete(name);
      } else {
        state.pickerExcluded.add(name);
      }
      renderPickerClassChips();
    });
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
    return {
      list: manual.filter((name) => !state.turnExcluded.has(name)),
      key: `manual:${manual.join("|")}`,
    };
  }
  const classId = elements.turnClass.value;
  const classroom = state.data.classrooms.find((item) => item.id === classId);
  const list = classroom ? classroom.students : [];
  return {
    list: list.filter((name) => !state.turnExcluded.has(name)),
    key: `class:${classId}`,
  };
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
    if (state.turnExcluded.has(name)) {
      chip.classList.add("excluded");
    }
    addTapListener(chip, () => {
      if (state.turnExcluded.has(name)) {
        state.turnExcluded.delete(name);
      } else {
        state.turnExcluded.add(name);
      }
      renderTurnClassChips();
    });
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

const formatTime = (ms) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const updateTimerUI = () => {
  if (!elements.timerCircle || !elements.timerDisplay || !elements.timerStatus) return;
  const progress =
    state.timer.durationMs > 0 ? state.timer.remainingMs / state.timer.durationMs : 0;
  const percent = Math.max(0, Math.min(100, progress * 100));
  elements.timerCircle.style.background = `conic-gradient(var(--primary) ${percent}%, #e3e9fb ${percent}%)`;
  elements.timerDisplay.textContent = formatTime(state.timer.remainingMs);
  elements.timerStatus.textContent = state.timer.running ? "En marxa" : "Preparat/da";
  if (elements.timerCustomDisplay) {
    if (state.timerSeconds >= 60) {
      const minutes = Math.round(state.timerSeconds / 60);
      elements.timerCustomDisplay.textContent = `${minutes} minuts`;
    } else {
      elements.timerCustomDisplay.textContent = `${state.timerSeconds} segons`;
    }
  }
  if (elements.timerSoundDurationDisplay) {
    elements.timerSoundDurationDisplay.textContent = `${state.data.timerSoundDurationSec} segons`;
  }
  if (elements.btnTimerSoundTest) {
    elements.btnTimerSoundTest.disabled = state.timer.running;
  }
  if (state.timer.remainingMs <= 0) {
    elements.timerCircle.classList.add("finished");
  } else {
    elements.timerCircle.classList.remove("finished");
  }
};

const stopTimer = () => {
  if (state.timer.intervalId) {
    clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
  }
  state.timer.running = false;
  state.timer.endAt = null;
};

const getAudioContext = () => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!state.audioContext || state.audioContext.state === "closed") {
    state.audioContext = new AudioContext();
  }
  return state.audioContext;
};

const playTone = (ctx, frequency, duration, gainValue, type, startAt) => {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type || "sine";
  oscillator.frequency.value = frequency;
  gain.gain.value = gainValue;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  const start = ctx.currentTime + startAt;
  oscillator.start(start);
  oscillator.stop(start + duration);
};

const playBell = (ctx, durationSec) => {
  const now = ctx.currentTime;
  const pulses = Math.max(1, Math.min(4, Math.round(durationSec / 1.4)));
  for (let i = 0; i < pulses; i += 1) {
    const start = now + i * 1.1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 1.6);
    gain.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 520;
    osc1.connect(gain);
    osc1.start(start);
    osc1.stop(start + 1.6);

    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 780;
    osc2.connect(gain);
    osc2.start(start);
    osc2.stop(start + 1.3);
  }
};

const playSiren = (ctx, durationSec) => {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(520, now);
  for (let t = 0; t <= durationSec; t += 1.4) {
    osc.frequency.linearRampToValueAtTime(920, now + t + 0.7);
    osc.frequency.linearRampToValueAtTime(520, now + t + 1.4);
  }
  gain.gain.value = 0.05;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationSec);
};

const playRadiation = (ctx, durationSec) => {
  const interval = 0.22;
  const count = Math.max(1, Math.floor(durationSec / interval));
  for (let i = 0; i < count; i += 1) {
    playTone(ctx, 780, 0.12, 0.05, "square", i * interval);
  }
};

const playWhistle = (ctx, durationSec) => {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 1200;
  lfo.type = "sine";
  lfo.frequency.value = 6;
  lfoGain.gain.value = 25;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  gain.gain.value = 0.04;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  lfo.start(now);
  osc.stop(now + durationSec);
  lfo.stop(now + durationSec);
};

const playTimerSound = () => {
  const sound = state.data.timerSound || "beep_long";
  const durationSec = state.data.timerSoundDurationSec || 2;
  const fileMap = {
    bell: "audio/church-bell.mp3",
    police_siren: "audio/police-siren.mp3",
    air_raid_siren: "audio/air-raid-siren.mp3",
  };
  if (fileMap[sound]) {
    const audio = new Audio(fileMap[sound]);
    audio.currentTime = 0;
    audio.loop = durationSec > 1;
    audio.play().catch(() => {});
    if (durationSec > 0) {
      setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
      }, durationSec * 1000);
    }
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) return;
  if (sound === "beep_long") {
    playTone(ctx, 660, Math.max(0.6, durationSec), 0.05, "sine", 0);
    return;
  }
  if (sound === "whistle") {
    playWhistle(ctx, durationSec);
    return;
  }
  if (sound === "siren") {
    playSiren(ctx, durationSec);
  }
};

const startTimer = () => {
  if (state.timer.running) return;
  if (state.timer.remainingMs <= 0) {
    state.timer.remainingMs = state.timer.durationMs;
  }
  state.timer.running = true;
  state.timer.endAt = Date.now() + state.timer.remainingMs;
  updateTimerUI();
  state.timer.intervalId = setInterval(() => {
    const remaining = state.timer.endAt - Date.now();
    state.timer.remainingMs = Math.max(0, remaining);
    updateTimerUI();
    if (state.timer.remainingMs <= 0) {
      stopTimer();
      updateTimerUI();
      playTimerSound();
      showModal("Temps finalitzat", "El temps s'ha acabat.");
    }
  }, 200);
};

const pauseTimer = () => {
  if (!state.timer.running) return;
  stopTimer();
  updateTimerUI();
};

const resetTimer = () => {
  stopTimer();
  state.timer.remainingMs = state.timer.durationMs;
  updateTimerUI();
};

const setTimerDuration = (minutes) => {
  const clamped = Math.max(1, Math.min(60, minutes));
  const seconds = clamped * 60;
  state.timerSeconds = seconds;
  state.timer.durationMs = seconds * 1000;
  state.timer.remainingMs = seconds * 1000;
  updateTimerUI();
};

const setTimerSeconds = (seconds) => {
  const clamped = Math.max(10, Math.min(3600, seconds));
  state.timerSeconds = clamped;
  state.timer.durationMs = clamped * 1000;
  state.timer.remainingMs = clamped * 1000;
  updateTimerUI();
};

const adjustTimerStep = (delta) => {
  if (state.timer.running) return;
  if (state.timerSeconds > 60) {
    setTimerSeconds(state.timerSeconds + delta * 60);
    return;
  }
  setTimerSeconds(state.timerSeconds + delta * 5);
};

const adjustTimerStepLong = (delta) => {
  if (state.timer.running) return;
  if (state.timerSeconds > 60) {
    setTimerSeconds(state.timerSeconds + delta * 300);
    return;
  }
  setTimerSeconds(state.timerSeconds + delta * 5);
};

const updateDiceUI = () => {
  if (!elements.diceCount || !elements.diceSum || !elements.dieTwo) return;
  state.diceCount = Number(elements.diceCount.value) || 1;
  if (state.diceCount === 2) {
    elements.dieTwo.classList.remove("hidden");
    elements.diceSum.classList.remove("hidden");
  } else {
    elements.dieTwo.classList.add("hidden");
    elements.diceSum.classList.add("hidden");
  }
};

const rollSingleDie = (cube, finalFace) => {
  if (!cube) return;
  const rotations = {
    1: { x: 0, y: 0 },
    2: { x: 0, y: -90 },
    3: { x: 0, y: 180 },
    4: { x: 0, y: 90 },
    5: { x: -90, y: 0 },
    6: { x: 90, y: 0 },
  };
  const start = performance.now();
  const duration = 2600;
  const startX = Math.random() * 360;
  const startY = Math.random() * 360;
  const turnsX = 2 + Math.floor(Math.random() * 3);
  const turnsY = 2 + Math.floor(Math.random() * 3);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const target = rotations[finalFace];
  const totalX = target.x + turnsX * 360;
  const totalY = target.y + turnsY * 360;

  const animate = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = easeOut(progress);
    const x = startX + (totalX - startX) * eased;
    const y = startY + (totalY - startY) * eased;
    cube.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`;
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      cube.style.transform = `rotateX(${totalX}deg) rotateY(${totalY}deg)`;
    }
  };
  requestAnimationFrame(animate);
};

const rollDice = () => {
  if (state.diceRolling || !elements.dieOneCube) return;
  state.diceRolling = true;
  updateDiceUI();
  const face1 = Math.floor(Math.random() * 6) + 1;
  const face2 = Math.floor(Math.random() * 6) + 1;
  rollSingleDie(elements.dieOneCube, face1);
  if (state.diceCount === 2 && elements.dieTwoCube) {
    rollSingleDie(elements.dieTwoCube, face2);
  }
  setTimeout(() => {
    if (state.diceCount === 2 && elements.diceSum) {
      elements.diceSum.textContent = String(face1 + face2);
    }
    state.diceRolling = false;
  }, 2800);
};

const getRandomIndex = (max) => {
  if (max <= 1) return 0;
  if (window.crypto && window.crypto.getRandomValues) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] % max;
  }
  return Math.floor(Math.random() * max);
};

const buildRoulette = (options) => {
  if (!elements.rouletteWheel || !elements.rouletteResult) return;
  elements.rouletteWheel.innerHTML = "";
  if (options.length === 0) {
    elements.rouletteWheel.style.background =
      "conic-gradient(#e3e9fb 0deg, #f5f7ff 360deg)";
    elements.rouletteResult.textContent = "Afegeix opcions per començar";
    return;
  }
  const segment = 360 / options.length;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "roulette-svg");
  svg.setAttribute("viewBox", "0 0 320 320");
  svg.setAttribute("aria-hidden", "true");

  const cx = 160;
  const cy = 160;
  const outerRadius = 160;
  const textRadius = 95;

  options.forEach((option, index) => {
    const startAngle = -90 + index * segment;
    const endAngle = -90 + (index + 1) * segment;
    const midAngle = startAngle + segment / 2;
    const largeArc = segment > 180 ? 1 : 0;
    const hue = Math.round((360 / options.length) * index);
    const color = `hsl(${hue} 78% 58%)`;

    const start = (startAngle * Math.PI) / 180;
    const end = (endAngle * Math.PI) / 180;
    const x1 = cx + Math.cos(start) * outerRadius;
    const y1 = cy + Math.sin(start) * outerRadius;
    const x2 = cx + Math.cos(end) * outerRadius;
    const y2 = cy + Math.sin(end) * outerRadius;

    const slice = document.createElementNS("http://www.w3.org/2000/svg", "path");
    slice.setAttribute(
      "d",
      `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2.toFixed(
        2
      )} ${y2.toFixed(2)} Z`
    );
    slice.setAttribute("fill", color);
    slice.setAttribute("stroke", "#ffffff");
    slice.setAttribute("stroke-width", "2");
    svg.appendChild(slice);

    const pathId = `roulette-path-${index}`;
    const textStart = (startAngle * Math.PI) / 180;
    const textEnd = (endAngle * Math.PI) / 180;
    const tx1 = cx + Math.cos(textStart) * textRadius;
    const ty1 = cy + Math.sin(textStart) * textRadius;
    const tx2 = cx + Math.cos(textEnd) * textRadius;
    const ty2 = cy + Math.sin(textEnd) * textRadius;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("id", pathId);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "none");
    path.setAttribute(
      "d",
      `M ${tx1.toFixed(2)} ${ty1.toFixed(2)} A ${textRadius} ${textRadius} 0 ${largeArc} 1 ${tx2.toFixed(
        2
      )} ${ty2.toFixed(2)}`
    );
    svg.appendChild(path);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    const textPath = document.createElementNS("http://www.w3.org/2000/svg", "textPath");
    textPath.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", `#${pathId}`);
    textPath.setAttribute("startOffset", "50%");
    textPath.setAttribute("text-anchor", "middle");
    textPath.textContent = option;
    text.appendChild(textPath);
    svg.appendChild(text);
  });

  elements.rouletteWheel.appendChild(svg);
};

const spinRoulette = () => {
  if (state.rouletteSpinning) return;
  const options = parseList(elements.rouletteOptions.value);
  if (options.length < 2) {
    showAlert("Introdueix almenys 2 opcions per girar la ruleta.");
    return;
  }
  buildRoulette(options);
  state.rouletteSpinning = true;
  const segment = 360 / options.length;
  let targetIndex = getRandomIndex(options.length);
  if (options.length > 1 && state.rouletteLastIndex === targetIndex) {
    targetIndex = (targetIndex + 1) % options.length;
  }
  state.rouletteLastIndex = targetIndex;
  const spins = 4 + Math.floor(Math.random() * 3);
  const totalRotation = spins * 360 - (targetIndex * segment + segment / 2);
  state.rouletteRotation = totalRotation;
  elements.rouletteWheel.style.transform = `rotate(${totalRotation}deg)`;
  setTimeout(() => {
    elements.rouletteResult.textContent = options[targetIndex];
    state.rouletteSpinning = false;
  }, 3600);
};

const startTimerHold = (delta) => {
  if (state.timer.running) return;
  clearTimeout(state.timerHold.timeoutId);
  clearInterval(state.timerHold.intervalId);
  state.timerHold.handledLong = false;
  state.timerHold.timeoutId = setTimeout(() => {
    state.timerHold.handledLong = true;
    adjustTimerStepLong(delta);
    state.timerHold.intervalId = setInterval(() => {
      adjustTimerStepLong(delta);
    }, 450);
  }, 500);
};

const stopTimerHold = (delta) => {
  clearTimeout(state.timerHold.timeoutId);
  clearInterval(state.timerHold.intervalId);
  state.timerHold.timeoutId = null;
  state.timerHold.intervalId = null;
  if (!state.timerHold.handledLong) {
    adjustTimerStep(delta);
  }
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
      renderRouletteSetCards();
      renderRouletteSetSelect();
      if (state.data.lastRouletteSetId) {
        loadRouletteSetOptions(state.data.lastRouletteSetId);
      }
      elements.groupSize.value = state.data.lastGroupSize || 3;
      if (elements.timerSound) {
        elements.timerSound.value = state.data.timerSound || "beep_long";
      }
      state.data.timerSoundDurationSec = state.data.timerSoundDurationSec || 2;
      updateTimerUI();
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
  renderRouletteSetCards();
  renderRouletteSetSelect();
  resetForm();
  elements.groupsStudents.value = "";
  elements.groupsResult.innerHTML = "";
  elements.pickerList.value = "";
  elements.pickerAnimation.textContent = "Preparat/da?";
  elements.pickerResult.textContent = "";
  if (elements.rouletteOptions) {
    elements.rouletteOptions.value = "";
    buildRoulette([]);
  }
  if (elements.timerSound) {
    elements.timerSound.value = state.data.timerSound;
  }
  state.data.timerSoundDurationSec = state.data.timerSoundDurationSec || 2;
  updateTimerUI();
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
  elements.btnBurger = $("btn-burger");
  elements.btnCloseSidebar = $("btn-close-sidebar");
  elements.sidebar = $("sidebar");
  elements.sidebarBackdrop = $("sidebar-backdrop");
  elements.btnTimerSoundTest = $("btn-timer-sound-test");
  elements.timerSound = $("timer-sound");
  elements.btnSoundMinus = $("btn-sound-minus");
  elements.btnSoundPlus = $("btn-sound-plus");
  elements.timerSoundDurationDisplay = $("timer-sound-duration");
  elements.timerCircle = $("timer-circle");
  elements.timerDisplay = $("timer-display");
  elements.timerStatus = $("timer-status");
  elements.btnTimerStart = $("btn-timer-start");
  elements.btnTimerPause = $("btn-timer-pause");
  elements.btnTimerReset = $("btn-timer-reset");
  elements.btnTimerMinus = $("btn-timer-minus");
  elements.btnTimerPlus = $("btn-timer-plus");
  elements.timerCustomDisplay = $("timer-custom-display");
  elements.diceCount = $("dice-count");
  elements.btnRollDice = $("btn-roll-dice");
  elements.dieOne = document.querySelector(".die-1");
  elements.dieTwo = document.querySelector(".die-2");
  elements.dieOneCube = elements.dieOne ? elements.dieOne.querySelector(".cube") : null;
  elements.dieTwoCube = elements.dieTwo ? elements.dieTwo.querySelector(".cube") : null;
  elements.diceSum = $("dice-sum");
  elements.rouletteSaved = $("roulette-saved");
  elements.rouletteOptions = $("roulette-options");
  elements.btnSpinRoulette = $("btn-spin-roulette");
  elements.rouletteWheel = $("roulette-wheel");
  elements.rouletteResult = $("roulette-result");
  elements.rouletteSetName = $("roulette-set-name");
  elements.rouletteSetOptions = $("roulette-set-options");
  elements.btnSaveRouletteSet = $("btn-save-roulette-set");
  elements.btnCancelRouletteEdit = $("btn-cancel-roulette-edit");
  elements.rouletteSetList = $("roulette-set-list");
  elements.btnReset = $("btn-reset");

  state.data = loadData();
  state.data.timerSound = state.data.timerSound || "beep_long";
  state.data.timerSoundDurationSec = state.data.timerSoundDurationSec || 2;

  renderClassCards();
  renderClassSelects();
  renderRouletteSetCards();
  renderRouletteSetSelect();
  if (state.data.lastRouletteSetId) {
    loadRouletteSetOptions(state.data.lastRouletteSetId);
  }
  elements.groupSize.value = state.data.lastGroupSize || 3;

  if (elements.btnEnter) {
    addTapListener(elements.btnEnter, () => renderApp());
  }
  if (elements.btnGoLanding) {
    addTapListener(elements.btnGoLanding, () => renderLanding());
  }
  addTapListener(elements.btnSaveClass, saveClassroom);
  addTapListener(elements.btnCancelEdit, resetForm);
  addTapListener(elements.btnGenerateGroups, handleGenerateGroups);
  addTapListener(elements.btnPick, handlePick);
  addTapListener(elements.btnTurnStart, startTurns);
  addTapListener(elements.btnTurnNext, handleTurnNext);
  addTapListener(elements.btnTurnReset, handleTurnReset);
  addTapListener(elements.btnTimerStart, startTimer);
  addTapListener(elements.btnTimerPause, pauseTimer);
  addTapListener(elements.btnTimerReset, resetTimer);
  const attachTimerStepper = (element, delta) => {
    if (!element) return;
    element.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      startTimerHold(delta);
    });
    element.addEventListener("pointerup", (event) => {
      event.preventDefault();
      stopTimerHold(delta);
    });
    element.addEventListener("pointercancel", () => stopTimerHold(delta));
    element.addEventListener("pointerleave", () => stopTimerHold(delta));
  };

  attachTimerStepper(elements.btnTimerMinus, -1);
  attachTimerStepper(elements.btnTimerPlus, 1);
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
    state.pickerExcluded.clear();
    renderPickerClassChips();
  });

  elements.turnClass.addEventListener("change", (event) => {
    state.data.lastClassId = event.target.value;
    saveData();
    state.turnExcluded.clear();
    renderTurnClassChips();
  });

  if (elements.timerSound) {
    elements.timerSound.value = state.data.timerSound || "beep_long";
    elements.timerSound.addEventListener("change", (event) => {
      state.data.timerSound = event.target.value;
      saveData();
    });
  }
  if (elements.btnSoundMinus) {
    addTapListener(elements.btnSoundMinus, () => {
      const next = Math.max(1, Math.min(15, state.data.timerSoundDurationSec - 1));
      state.data.timerSoundDurationSec = next;
      saveData();
      updateTimerUI();
    });
  }
  if (elements.btnSoundPlus) {
    addTapListener(elements.btnSoundPlus, () => {
      const next = Math.max(1, Math.min(15, state.data.timerSoundDurationSec + 1));
      state.data.timerSoundDurationSec = next;
      saveData();
      updateTimerUI();
    });
  }
  if (elements.btnTimerSoundTest) {
    addTapListener(elements.btnTimerSoundTest, playTimerSound);
  }

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
        state.pickerExcluded.clear();
      }
      if (elements.turnClass) {
        elements.turnClass.value = "";
        renderTurnClassChips();
        state.turnExcluded.clear();
      }
      if (elements.rouletteSaved) {
        elements.rouletteSaved.value = "";
      }
      if (elements.sidebar) {
        elements.sidebar.classList.remove("open");
      }
      if (elements.sidebarBackdrop) {
        elements.sidebarBackdrop.classList.remove("visible");
      }
    });
  });

  const openSidebar = () => {
    if (elements.sidebar) elements.sidebar.classList.add("open");
    if (elements.sidebarBackdrop) elements.sidebarBackdrop.classList.add("visible");
  };
  const closeSidebar = () => {
    if (elements.sidebar) elements.sidebar.classList.remove("open");
    if (elements.sidebarBackdrop) elements.sidebarBackdrop.classList.remove("visible");
  };
  if (elements.btnBurger) {
    addTapListener(elements.btnBurger, openSidebar);
  }
  if (elements.btnCloseSidebar) {
    addTapListener(elements.btnCloseSidebar, closeSidebar);
  }
  if (elements.sidebarBackdrop) {
    addTapListener(elements.sidebarBackdrop, closeSidebar);
  }

  document.querySelectorAll(".timer-preset").forEach((btn) => {
    addTapListener(btn, () => {
      const minutes = Number(btn.dataset.minutes) || 10;
      setTimerDuration(minutes);
      resetTimer();
    });
  });

  if (elements.btnRollDice) {
    addTapListener(elements.btnRollDice, rollDice);
  }
  if (elements.diceCount) {
    elements.diceCount.addEventListener("change", updateDiceUI);
  }
  if (elements.rouletteOptions) {
    elements.rouletteOptions.addEventListener("input", (event) => {
      const options = parseList(event.target.value);
      buildRoulette(options);
    });
  }
  if (elements.btnSpinRoulette) {
    addTapListener(elements.btnSpinRoulette, spinRoulette);
  }
  if (elements.rouletteSaved) {
    elements.rouletteSaved.addEventListener("change", (event) => {
      state.data.lastRouletteSetId = event.target.value;
      saveData();
      if (event.target.value) {
        loadRouletteSetOptions(event.target.value);
      }
    });
  }
  if (elements.btnSaveRouletteSet) {
    addTapListener(elements.btnSaveRouletteSet, saveRouletteSet);
  }
  if (elements.btnCancelRouletteEdit) {
    addTapListener(elements.btnCancelRouletteEdit, resetRouletteSetForm);
  }

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
  updateTimerUI();
  updateDiceUI();
  if (elements.rouletteOptions) {
    buildRoulette(parseList(elements.rouletteOptions.value));
  }
});
