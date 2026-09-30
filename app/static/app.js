const state = { overview: null, token: localStorage.getItem("managerToken") || "" };

const $ = (id) => document.getElementById(id);

const SERVICE_LINKS = {
  deluge: {port: 8112, label: "Abrir Deluge"},
  sonarr: {port: 8989, label: "Abrir Sonarr"},
  radarr: {port: 7878, label: "Abrir Radarr"},
  prowlarr: {port: 9696, label: "Abrir Prowlarr"},
  bazarr: {port: 6767, label: "Abrir Bazarr"},
  jellyseerr: {port: 5055, label: "Abrir Jellyseerr"},
};
function serviceUrl(name, data) {
  if (name === "jellyfin") {
    const hostname = data?.connectivity?.remote_access?.hostname;
    return hostname ? `http://${hostname}:8096` : null;
  }
  if (name === "tailscale") return "https://login.tailscale.com/admin/machines";
  const config = SERVICE_LINKS[name];
  if (!config) return null;
  return `http://127.0.0.1:${config.port}`;
}
function serviceLinkLabel(name) {
  if (name === "jellyfin") return "Abrir Jellyfin";
  if (name === "tailscale") return "Abrir Tailscale";
  return SERVICE_LINKS[name]?.label || "Abrir interfaz";
}


const SERVICE_ICONS = {
  jellyfin: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs><linearGradient id="jg" x1="0" x2="1"><stop stop-color="#7c4dff"/><stop offset="1" stop-color="#23c7ff"/></linearGradient></defs>
      <path fill="url(#jg)" d="M32 8c-3.2 0-5.6 2-7 4.5L10.8 38.6C8.9 42 11.4 46 15.2 46h33.6c3.8 0 6.3-4 4.4-7.4L39 12.5C37.6 10 35.2 8 32 8Z"/>
      <path fill="#07111f" d="m32 19 10.5 18H21.5L32 19Z"/>
      <path fill="#6ad9ff" d="m32 25 6.5 11h-13L32 25Z"/>
    </svg>`,
  gluetun: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path fill="#40d890" d="M14 22c0-7 5-12 12-12h12c7 0 12 5 12 12v8h4v24H10V30h4v-8Zm8 8h20v-8c0-2.8-2.2-5-5-5H27c-2.8 0-5 2.2-5 5v8Z"/>
      <circle cx="32" cy="42" r="5" fill="#07111f"/>
    </svg>`,
  deluge: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs><linearGradient id="dg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#5aa7ff"/><stop offset="1" stop-color="#1d6ed8"/></linearGradient></defs>
      <path fill="url(#dg)" d="M32 6C23 19 14 28 14 39a18 18 0 0 0 36 0C50 28 41 19 32 6Z"/>
      <path fill="none" stroke="#b9ddff" stroke-width="3" d="M32 15c-4 7-10 14-10 23 0 6 4 11 10 13"/>
    </svg>`,
  sonarr: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="25" fill="#fff"/>
      <circle cx="32" cy="32" r="14" fill="#1e9cd7"/>
      <path fill="#07111f" d="M32 9 38 23 55 32 38 41 32 55 26 41 9 32 26 23 32 9Z"/>
      <circle cx="32" cy="32" r="8" fill="#54d5ff"/>
    </svg>`,
  radarr: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="25" fill="#f3f4f6"/>
      <path fill="#f6a821" d="m27 18 19 14-19 14V18Z"/>
      <path fill="#111827" d="M18 15h8v34h-8z"/>
    </svg>`,
  prowlarr: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="28" cy="28" r="18" fill="#ff8a1f"/>
      <circle cx="28" cy="28" r="8" fill="none" stroke="#fff" stroke-width="4"/>
      <path stroke="#ff8a1f" stroke-width="8" stroke-linecap="round" d="m41 41 12 12"/>
    </svg>`,
  bazarr: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect x="8" y="10" width="48" height="38" rx="10" fill="#f8fafc"/>
      <rect x="14" y="16" width="36" height="26" rx="6" fill="#111827"/>
      <path d="M19 25h26M19 32h20" stroke="#d1d5db" stroke-width="3" stroke-linecap="round"/>
      <path fill="#f8fafc" d="M22 48h20l5 6H17l5-6Z"/>
    </svg>`,
  jellyseerr: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="24" fill="#9f7aea"/>
      <circle cx="32" cy="24" r="8" fill="#171127"/>
      <path fill="#171127" d="M18 48c2-10 9-15 14-15s12 5 14 15H18Z"/>
    </svg>`,
  tailscale: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <g fill="#f4f7fb">
        <circle cx="18" cy="18" r="5"/><circle cx="32" cy="18" r="5"/><circle cx="46" cy="18" r="5"/>
        <circle cx="18" cy="32" r="5"/><circle cx="32" cy="32" r="5"/><circle cx="46" cy="32" r="5"/>
        <circle cx="18" cy="46" r="5"/><circle cx="32" cy="46" r="5"/><circle cx="46" cy="46" r="5"/>
      </g>
    </svg>`,
  samba: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="24" cy="24" r="14" fill="#e74646"/>
      <circle cx="40" cy="40" r="14" fill="#f6b933"/>
      <path d="M18 42c7-12 15-18 28-20" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    </svg>`,
  docker: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path fill="#2496ed" d="M12 28h8v8h-8zm10 0h8v8h-8zm10 0h8v8h-8zm-10-10h8v8h-8zm10 0h8v8h-8zm10 10h8v8h-8z"/>
      <path fill="#2496ed" d="M8 38h45c-2 10-10 16-23 16-12 0-20-5-22-16Z"/>
      <path fill="#2496ed" d="M48 33c4-5 9-6 13-3-2 5-7 8-13 7Z"/>
    </svg>`
};
function serviceIcon(name) {
  return SERVICE_ICONS[name] || `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect x="10" y="10" width="44" height="44" rx="12" fill="#24405f"/>
      <path d="M21 24h22M21 32h22M21 40h14" stroke="#9ec7ff" stroke-width="4" stroke-linecap="round"/>
    </svg>`;
}

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
function countryFlag(country) {
  const normalized = String(country || "").trim().toLowerCase();
  if (normalized === "spain" || normalized === "españa") return "🇪🇸";
  return "🌐";
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

  const vpn = data.connectivity?.vpn || {};
  const remote = data.connectivity?.remote_access || {};
  $("vpn-status").textContent = vpn.connected ? "VPN conectada" : "VPN no conectada";
  $("vpn-status").className = `network-status ${vpn.connected ? "ok" : "bad"}`;
  $("vpn-country").textContent = vpn.country ? `${countryFlag(vpn.country)} ${vpn.country}` : "—";
  $("vpn-provider").textContent = vpn.provider || "—";
  $("vpn-protected").textContent = vpn.protected ? "Sí" : "No";
  $("vpn-protected").className = vpn.protected ? "value-ok" : "value-bad";
  $("vpn-exit-ip").textContent = vpn.exit_ip_verified && vpn.exit_ip ? vpn.exit_ip : "No verificada";

  $("remote-status").textContent = remote.active ? "Acceso remoto activo" : "Acceso remoto no disponible";
  $("remote-status").className = `network-status ${remote.active ? "ok" : "bad"}`;
  $("remote-tailscale").textContent = remote.active ? "Activo" : "Inactivo";
  $("remote-tailscale").className = remote.active ? "value-ok" : "value-bad";
  $("remote-private").textContent = remote.private ? "Privada y cifrada" : "No disponible";
  $("remote-private").className = remote.private ? "value-ok" : "value-bad";
  $("remote-hostname").textContent = remote.hostname || "—";

  $("services-grid").innerHTML = data.services.map(service => {
    const cls = serviceClass(service);
    const status = service.health || service.status;
    const canRestart = service.name !== "docker";
    const uiUrl = serviceUrl(service.name, data);
    return `
      <article class="service-card ${cls}">
        <div class="service-top">
          <div class="service-identity">
            <span class="service-icon service-icon-${escapeHtml(service.name)}">${serviceIcon(service.name)}</span>
            <div>
              <span class="service-name">${escapeHtml(service.label)}</span>
              <div class="status ${cls === "good" ? "good" : cls === "bad" ? "bad" : ""}">
                ● ${escapeHtml(String(status))}
              </div>
            </div>
          </div>
        </div>
        <div class="service-meta">${service.running ? `uptime ${fmtUptime(service.uptime_seconds)} · reinicios ${service.restart_count}` : escapeHtml(service.status)}</div>
        <div class="service-actions">
          ${uiUrl ? `<a class="open-ui" href="${escapeHtml(uiUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(serviceLinkLabel(service.name))} ↗</a>` : `<span class="no-ui">Sin interfaz web</span>`}
          ${canRestart ? `<button class="restart" data-restart="${escapeHtml(service.name)}">Reiniciar</button>` : ""}
        </div>
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

document.querySelectorAll(".nav[data-view]").forEach(button => {
  button.addEventListener("click", () => {
    const target = document.getElementById(button.dataset.view);
    if (!target) return;
    document.querySelectorAll(".nav").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    target.scrollIntoView({behavior: "smooth", block: "start"});
  });
});
