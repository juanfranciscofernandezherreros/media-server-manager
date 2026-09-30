const state = { overview: null, token: localStorage.getItem("managerToken") || "" };

const $ = (id) => document.getElementById(id);
const fmtBytes = (value) => {
  if (!Number.isFinite(value)) return "—";
  const units = ["B","KB","MB","GB","TB"];
  let n = value, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i >= 3 ? 2 : 1)} ${units[i]}`;
};
const fmtUptime = (seconds) => {
  if (!Number.isFinite(seconds)) return "sin uptime";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return d ? `${d}d ${h}h` : `${h}h`;
};
function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}
async function api(path, options = {}) {
  const headers = {...(options.headers || {})};
  if (state.token) headers["X-Manager-Token"] = state.token;
  const response = await fetch(path, {...options, headers});
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `HTTP ${response.status}`);
  }
  return response.json();
}
function serviceClass(service) {
  if (!service.running) return "bad";
  if (service.health === "healthy" || service.health === "running") return "good";
  return "warn";
}
function render(data) {
  state.overview = data;
  const healthy = data.summary.healthy;
  $("global-health").textContent = healthy ? "● Sistema saludable" : "● Requiere atención";
  $("global-health").className = `pill ${healthy ? "ok" : "bad"}`;
  $("hero-status").textContent = healthy ? "SALUDABLE" : "REVISAR";
  $("hero-services").textContent = `${data.summary.running_services}/${data.summary.total_services} servicios activos`;
  $("hero-vpn").textContent = data.summary.vpn_protected ? "PROTEGIDO" : "REVISAR";
  $("hero-disk").textContent = `${data.system.disk_percent.toFixed(0)}% USADO`;
  $("hero-disk-note").textContent = `${fmtBytes(data.system.disk_used_bytes)} de ${fmtBytes(data.system.disk_total_bytes)}`;
  $("hero-cpu").textContent = `CPU ${data.system.cpu_percent.toFixed(0)}%`;
  $("hero-ram").textContent = `RAM ${data.system.memory_percent.toFixed(0)}%`;

  $("metric-cpu").textContent = `${data.system.cpu_percent.toFixed(1)}%`;
  $("metric-ram").textContent = `${data.system.memory_percent.toFixed(1)}%`;
  $("metric-disk").textContent = `${data.system.disk_percent.toFixed(1)}%`;
  $("bar-cpu").style.width = `${data.system.cpu_percent}%`;
  $("bar-ram").style.width = `${data.system.memory_percent}%`;
  $("bar-disk").style.width = `${data.system.disk_percent}%`;

  $("services-grid").innerHTML = data.services.map(service => {
    const cls = serviceClass(service);
    const status = service.health || service.status;
    const canRestart = service.name !== "docker";
    return `
      <article class="service-card ${cls}">
        <div class="service-top">
          <span class="service-name">${escapeHtml(service.label)}</span>
          <span>●</span>
        </div>
        <div class="status ${cls === "good" ? "good" : cls === "bad" ? "bad" : ""}">
          ${escapeHtml(String(status))}
        </div>
        <div class="service-meta">${service.running ? `uptime ${fmtUptime(service.uptime_seconds)} · reinicios ${service.restart_count}` : escapeHtml(service.status)}</div>
        ${canRestart ? `<button class="restart" data-restart="${escapeHtml(service.name)}">Reiniciar</button>` : ""}
      </article>`;
  }).join("");

  renderChecks(data.diagnostics);
  $("connection-dot").className = "dot ok";
  $("connection-label").textContent = "Conectado";
  $("updated-at").textContent = `Actualizado ${new Date().toLocaleTimeString()}`;
}
function renderChecks(checks) {
  $("diagnostics").innerHTML = checks.map(check => `
    <div class="check ${check.ok ? "ok" : ""}">
      <span class="check-icon">${check.ok ? "✓" : "!"}</span>
      <div><strong>${escapeHtml(check.label)}</strong><small>${escapeHtml(check.detail)}</small></div>
    </div>
  `).join("");
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
async function refresh() {
  try {
    render(await api("/api/overview"));
  } catch (error) {
    $("connection-dot").className = "dot";
    $("connection-label").textContent = "Sin conexión";
    $("global-health").textContent = "● API no disponible";
    $("global-health").className = "pill bad";
    toast(error.message);
  }
}
document.addEventListener("click", async (event) => {
  const restart = event.target.closest("[data-restart]");
  if (restart) {
    const service = restart.dataset.restart;
    if (!state.token) return toast("Configura primero el token de acciones");
    restart.disabled = true;
    restart.textContent = "Reiniciando…";
    try {
      await api(`/api/services/${encodeURIComponent(service)}/restart`, {method:"POST"});
      toast(`${service}: reinicio solicitado`);
      setTimeout(refresh, 1500);
    } catch (error) {
      toast(error.message);
    } finally {
      restart.disabled = false;
      restart.textContent = "Reiniciar";
    }
  }
});
$("refresh-btn").addEventListener("click", refresh);
$("diagnose-btn").addEventListener("click", async () => {
  try {
    const data = await api("/api/diagnostics");
    renderChecks(data.checks);
    toast(data.healthy ? "Diagnóstico correcto" : "Diagnóstico con avisos");
  } catch (error) { toast(error.message); }
});
$("token-btn").addEventListener("click", () => {
  const value = prompt("Token local para acciones (se guarda solo en este navegador):", state.token);
  if (value !== null) {
    state.token = value.trim();
    if (state.token) localStorage.setItem("managerToken", state.token);
    else localStorage.removeItem("managerToken");
    toast(state.token ? "Token guardado localmente" : "Token eliminado");
  }
});
refresh();
setInterval(refresh, 10000);
