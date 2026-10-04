// ==================== CONFIGURACIÓN DE SUPABASE ====================
// 1. Crea una cuenta/proyecto gratis en https://supabase.com
// 2. Ve a Project Settings > API y pega aquí tus dos valores:
const SUPABASE_URL = "TU_SUPABASE_URL_AQUI";
const SUPABASE_ANON_KEY = "TU_SUPABASE_ANON_KEY_AQUI";
let sb = null;
try {
  if (!SUPABASE_URL.startsWith("http")) throw new Error("Faltan configurar las claves de Supabase");
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) {
  console.error(err);
}
function requireSupabase() {
  if (!sb) { toast("⚠️ Configura tus claves de Supabase (líneas 4-5 del archivo) antes de continuar"); return false; }
  return true;
}
// ======================================================================

const state = { boards: [], tasks: [] };

const slides = [
  ["🚀", "¡Tú puedes con todo!", "Cada tarea completada es un paso más hacia tus objetivos."],
  ["📚", "Organiza, enseña y avanza", "Un buen plan convierte los proyectos grandes en pasos sencillos."],
  ["✨", "Haz que cada día cuente", "Tu trabajo de hoy construye los resultados de mañana."]
];
let slide = 0, selectedPriority = "medium", currentUser = null, currentBoardId = null, authMode = "login";

function toast(msg) { const t = document.getElementById("toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2400) }
function setMinTaskDate() {
  const input = document.getElementById("taskDate");
  if (!input) return;
  const now = new Date();
  const today = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  input.min = today;
  if (input.value && input.value < today) input.value = today;
}
function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active-view"));
  const el = document.getElementById(id); if (el) el.classList.add("active-view");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === id));
  if (id === "boards") renderBoards();
  if (id === "dashboard") renderRecent();
  if (id === "kanban") renderKanban();
  if (id === "create") { fillBoardSelect(); setMinTaskDate(); }
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.querySelectorAll("[data-view],[data-view-target]").forEach(el => {
  el.addEventListener("click", () => showView(el.dataset.view || el.dataset.viewTarget));
});

// ==================== AUTENTICACIÓN (Supabase Auth) ====================
async function checkSession() {
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (session) { currentUser = session.user; await enterApp(); }
}

async function enterApp() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");
  const emailName = currentUser.email.split("@")[0];
  const initials = emailName.slice(0, 2).toUpperCase();
  document.querySelectorAll(".avatar").forEach(a => a.textContent = initials);
  const nameEl = document.querySelector(".mini-profile b"); if (nameEl) nameEl.textContent = emailName;
  const greet = document.getElementById("dashboardGreeting"); if (greet) greet.textContent = `¡Hola, ${emailName}! 👋`;
  await loadUserData();
  renderRecent(); renderBoards(); fillBoardSelect(); renderStats();
  showView("dashboard");
}

async function loadUserData() {
  const [{ data: boards, error: be }, { data: tasks, error: te }] = await Promise.all([
    sb.from("boards").select("*").order("created_at", { ascending: false }),
    sb.from("tasks").select("*").order("created_at", { ascending: false })
  ]);
  if (be) { console.error(be); toast("Error cargando tableros: " + be.message); }
  if (te) { console.error(te); toast("Error cargando tareas: " + te.message); }
  const allTasks = tasks || [];
  state.boards = (boards || []).map(b => ({
    id: b.id, name: b.name, color: b.color, progress: b.progress,
    members: b.members, deadline: b.deadline, description: b.description,
    tasks: allTasks.filter(t => t.board_id === b.id).length
  }));
  state.tasks = allTasks.map(t => ({
    id: t.id, title: t.title, description: t.description, priority: t.priority,
    assignee: t.assignee, date: t.date, column: t.column_name, board_id: t.board_id
  }));
}

document.getElementById("toggleAuthMode").onclick = () => {
  authMode = authMode === "login" ? "register" : "login";
  document.getElementById("authTitle").textContent = authMode === "login" ? "Inicia sesión" : "Crear cuenta";
  document.getElementById("authSubtitle").textContent = authMode === "login" ? "Accede a tu espacio de trabajo." : "Regístrate para empezar a organizar tus proyectos.";
  document.getElementById("authSubmitText").textContent = authMode === "login" ? "Entrar a mi espacio" : "Crear mi cuenta";
  document.getElementById("toggleAuthMode").textContent = authMode === "login" ? "Regístrate aquí" : "Inicia sesión aquí";
};

document.getElementById("loginForm").onsubmit = async (e) => {
  e.preventDefault();
  if (!requireSupabase()) return;
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (authMode === "register") {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) { toast(error.message); return; }
    if (!data.session) { toast("¡Cuenta creada! Revisa tu correo para confirmarla."); return; }
    currentUser = data.user;
    await enterApp();
    toast("¡Cuenta creada correctamente! 🎉");
  } else {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { toast("Revisa tu correo y contraseña."); return; }
    currentUser = data.user;
    await enterApp();
    toast("¡Bienvenido de nuevo!");
  }
  e.target.reset();
};

document.getElementById("logoutBtn").onclick = async () => {
  await sb.auth.signOut();
  currentUser = null; currentBoardId = null;
  document.getElementById("appShell").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("loginForm").reset();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

document.getElementById("forgotBtn").onclick = async () => {
  if (!requireSupabase()) return;
  const email = document.getElementById("loginEmail").value.trim();
  if (!email) { toast("Escribe tu correo primero"); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email);
  toast(error ? error.message : "Te enviamos un correo para recuperar tu acceso.");
};

document.getElementById("togglePassword").onclick = () => {
  const input = document.getElementById("loginPassword"), visible = input.type === "text"; input.type = visible ? "password" : "text";
  document.getElementById("togglePassword").setAttribute("aria-label", visible ? "Mostrar contraseña" : "Ocultar contraseña");
};

// ==================== TABLEROS Y TAREAS ====================
function boardCard(b) {
  return `<article class="board-card">
  <div class="accent" style="background:${b.color};box-shadow:0 0 15px ${b.color}"></div>
  <div class="board-top"><div class="folder" style="color:${b.color}">▣</div><small style="color:#74788d">${b.tasks} tareas</small></div>
  <h3>${b.name}</h3><p>${b.description || ""}</p>
  <div class="meta"><span>♟ ${b.members}</span><span>◷ ${b.deadline}</span><span>▣ ${b.tasks}</span></div>
  <div class="progress-label"><span>Progreso</span><b>${b.progress}%</b></div>
  <div class="progress"><i style="width:${b.progress}%;background:${b.color}"></i></div>
  <button class="open-board" data-board="${b.id}">Abrir tablero</button>
 </article>`;
}
function renderRecent() {
  const el = document.getElementById("recentBoards");
  el.innerHTML = state.boards.length ? state.boards.slice(0, 3).map(boardCard).join("") : `<p style="color:#8589a0">Aún no tienes tableros. Crea el primero en "Mis Tableros".</p>`;
  bindBoardButtons();
}
function renderBoards() {
  const el = document.getElementById("allBoards");
  el.innerHTML = state.boards.length ? state.boards.map(boardCard).join("") : `<p style="color:#8589a0">Aún no tienes tableros. ¡Crea uno para empezar!</p>`;
  bindBoardButtons();
}
function bindBoardButtons() {
  document.querySelectorAll(".open-board").forEach(b => b.onclick = () => {
    const board = state.boards.find(x => x.id == b.dataset.board);
    currentBoardId = board.id;
    document.getElementById("kanbanTitle").textContent = board.name;
    showView("kanban");
  });
}
function fillBoardSelect() {
  document.getElementById("taskBoard").innerHTML = '<option value="">Seleccionar tablero</option>' + state.boards.map(b => `<option value="${b.id}">${b.name}</option>`).join("");
}

function renderStats() {
  document.getElementById("totalTasks").textContent = state.tasks.length;
  document.getElementById("doneTasks").textContent = state.tasks.filter(t => t.column === "completed").length;
  document.getElementById("progressTasks").textContent = state.tasks.filter(t => t.column === "inProgress").length;
  document.getElementById("highTasks").textContent = state.tasks.filter(t => t.priority === "high").length;
}
const columns = [["pending", "Pendiente", "!", "#ffd60a"], ["inProgress", "En Proceso", "◷", "#00d9ff"], ["reviewed", "Revisado", "♟", "#7c3aed"], ["completed", "Finalizado", "✓", "#00ff88"]];
function renderKanban() {
  const boardTasks = currentBoardId ? state.tasks.filter(t => t.board_id === currentBoardId) : state.tasks;
  document.getElementById("kanban").innerHTML = columns.map(([id, title, icon, color]) => {
    const tasks = boardTasks.filter(t => t.column === id);
    return `<div class="column" data-column="${id}"><div class="column-head"><div><h3>${icon} ${title}</h3><small>${tasks.length} tareas</small></div><span style="color:${color}">＋</span></div>${tasks.map(taskCard).join("")}</div>`
  }).join("");
  document.querySelectorAll(".task").forEach(t => {
    t.draggable = true; t.addEventListener("dragstart", e => e.dataTransfer.setData("task", t.dataset.id));
  });
  document.querySelectorAll(".column").forEach(c => {
    c.addEventListener("dragover", e => { e.preventDefault(); c.classList.add("drag-over") });
    c.addEventListener("dragleave", () => c.classList.remove("drag-over"));
    c.addEventListener("drop", async e => {
      e.preventDefault(); c.classList.remove("drag-over");
      const id = e.dataTransfer.getData("task");
      const task = state.tasks.find(x => String(x.id) === String(id));
      if (task) {
        task.column = c.dataset.column;
        renderKanban(); renderStats();
        const { error } = await sb.from("tasks").update({ column_name: c.dataset.column }).eq("id", task.id);
        toast(error ? "No se pudo guardar el cambio: " + error.message : "Tarea movida correctamente ✓");
      }
    })
  });
}
function taskCard(t) {
  const colors = { high: "#ff006e", medium: "#ffd60a", low: "#00ff88" };
  return `<div class="task" data-id="${t.id}"><i class="bar" style="background:${colors[t.priority]}"></i><h4>${t.title}</h4><p>${t.description}</p><div class="task-foot"><span>◷ ${t.date}</span><span class="task-avatar">${t.assignee}</span></div></div>`
}

document.querySelectorAll(".priority").forEach((p, i) => p.onclick = () => {
  document.querySelectorAll(".priority").forEach(x => x.classList.remove("selected")); p.classList.add("selected");
  selectedPriority = i === 0 ? "low" : i === 1 ? "medium" : "high";
});

document.getElementById("taskForm").onsubmit = async e => {
  e.preventDefault();
  if (!requireSupabase()) return;
  const title = document.getElementById("taskTitle").value, desc = document.getElementById("taskDescription").value;
  const date = document.getElementById("taskDate").value, boardId = document.getElementById("taskBoard").value;
  if (!boardId) { toast("Selecciona un tablero"); return }
  const d = date ? new Date(date + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "Sin fecha";
  const assignee = currentUser.email.slice(0, 2).toUpperCase();
  const { error } = await sb.from("tasks").insert({
    user_id: currentUser.id, board_id: boardId, title, description: desc,
    priority: selectedPriority, assignee, date: d, column_name: "pending"
  });
  if (error) { toast("Error al crear la tarea: " + error.message); return }
  await loadUserData();
  e.target.reset(); selectedPriority = "medium";
  document.querySelectorAll(".priority").forEach(x => x.classList.remove("selected"));
  document.querySelectorAll(".priority")[1].classList.add("selected");
  renderStats(); renderRecent();
  currentBoardId = boardId;
  const board = state.boards.find(b => b.id === boardId);
  document.getElementById("kanbanTitle").textContent = board ? board.name : "";
  showView("kanban");
  toast("¡Tarea creada correctamente! 🎉");
};

const modal = document.getElementById("modal");
document.getElementById("createBoardBtn").onclick = () => modal.classList.remove("hidden");
document.getElementById("modalClose").onclick = () => modal.classList.add("hidden");
modal.onclick = e => { if (e.target === modal) modal.classList.add("hidden") };
document.getElementById("boardForm").onsubmit = async e => {
  e.preventDefault();
  if (!requireSupabase()) return;
  const name = document.getElementById("boardName").value, desc = document.getElementById("boardDescription").value || "Nuevo proyecto académico", color = document.getElementById("boardColor").value;
  const { error } = await sb.from("boards").insert({
    user_id: currentUser.id, name, color, progress: 0, members: 1, deadline: "Sin fecha", description: desc
  });
  if (error) { toast("Error al crear el tablero: " + error.message); return }
  await loadUserData();
  e.target.reset(); document.getElementById("boardColor").value = "#00d9ff"; modal.classList.add("hidden");
  renderBoards(); fillBoardSelect();
  toast("¡Tablero creado!"); showView("boards");
};

// ==================== EXTRAS (sin cambios: slides, chat) ====================
function renderSlide() {
  const s = slides[slide]; document.getElementById("slideEmoji").textContent = s[0]; document.getElementById("slideTitle").textContent = s[1]; document.getElementById("slideText").textContent = s[2];
  document.getElementById("slideDots").innerHTML = slides.map((_, i) => `<i class="dot ${i === slide ? "active" : ""}" data-slide="${i}"></i>`).join("");
  document.querySelectorAll(".dot").forEach(d => d.onclick = () => { slide = +d.dataset.slide; renderSlide() });
}
document.getElementById("nextSlide").onclick = () => { slide = (slide + 1) % slides.length; renderSlide() };
document.getElementById("prevSlide").onclick = () => { slide = (slide - 1 + slides.length) % slides.length; renderSlide() };

const initialMessages = [
  ["support", "¡Hola! Bienvenido al soporte de EduKanbanPro. ¿En qué puedo ayudarte hoy?", "10:30"],
  ["user", "Hola, necesito ayuda para mover tareas entre columnas.", "10:32"],
  ["support", "Claro. Arrastra una tarea y suéltala en la columna destino. También puedes usar este tablero desde cualquier dispositivo.", "10:33"]
];
function renderMessages() {
  document.getElementById("messages").innerHTML = initialMessages.map(m => `<div class="message ${m[0]}"><div class="${m[0] === "user" ? "avatar" : "bot-avatar"}">${m[0] === "user" ? "YO" : "✦"}</div><div><div class="bubble">${m[1]}</div><span class="time">${m[2]}</span></div></div>`).join("");
}
document.getElementById("chatForm").onsubmit = e => {
  e.preventDefault(); const input = document.getElementById("chatInput"), txt = input.value.trim(); if (!txt) return;
  const now = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }); initialMessages.push(["user", txt, now]); renderMessages(); input.value = "";
  setTimeout(() => { initialMessages.push(["support", "Gracias por tu mensaje. Un miembro de nuestro equipo te responderá pronto. 💙", new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })]); renderMessages(); document.getElementById("messages").scrollTop = 99999 }, 700);
};
document.querySelectorAll(".quick-help button").forEach(b => b.onclick = () => { document.getElementById("chatInput").value = b.textContent; document.getElementById("chatInput").focus() });
document.getElementById("notifyBtn").onclick = () => toast("No tienes notificaciones nuevas.");

// ==================== INICIO ====================
setMinTaskDate();
renderSlide();
renderMessages();
checkSession();
