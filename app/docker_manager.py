from __future__ import annotations

from datetime import datetime, timezone
from ipaddress import ip_address
import json
from time import monotonic
from typing import Any

import docker
from docker.errors import DockerException, NotFound

from app.config import Settings


SERVICE_LABELS = {
    "jellyfin": "Jellyfin",
    "gluetun": "Gluetun / VPN",
    "deluge": "Deluge",
    "sonarr": "Sonarr",
    "radarr": "Radarr",
    "prowlarr": "Prowlarr",
    "bazarr": "Bazarr",
    "jellyseerr": "Jellyseerr",
    "tailscale": "Tailscale",
    "samba": "Samba",
    "photos_app": "Photos Sync",
}


class DockerManager:
    _vpn_exit_cache: dict[str, Any] | None = None
    _vpn_exit_cache_at: float = 0.0
    _vpn_exit_cache_ttl_seconds = 60.0
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _client(self):
        return docker.from_env(timeout=5)

    def _container_payload(self, container: Any) -> dict[str, Any]:
        attrs = container.attrs
        state = attrs.get("State", {})
        health = state.get("Health", {}).get("Status")
        started_at = state.get("StartedAt")
        uptime_seconds = None

        if started_at and state.get("Running"):
            try:
                normalized = started_at.replace("Z", "+00:00")
                started = datetime.fromisoformat(normalized)
                uptime_seconds = max(
                    0,
                    int((datetime.now(timezone.utc) - started).total_seconds()),
                )
            except ValueError:
                uptime_seconds = None

        ports: list[str] = []
        for binding_list in attrs.get("NetworkSettings", {}).get("Ports", {}).values():
            for binding in binding_list or []:
                host_ip = binding.get("HostIp", "")
                host_port = binding.get("HostPort", "")
                if host_port:
                    ports.append(f"{host_ip}:{host_port}")

        env = {}
        for item in attrs.get("Config", {}).get("Env", []) or []:
            key, separator, value = item.partition("=")
            if separator:
                env[key] = value

        return {
            "name": container.name,
            "label": SERVICE_LABELS.get(container.name, container.name.title()),
            "status": state.get("Status", container.status),
            "running": bool(state.get("Running")),
            "health": health or ("running" if state.get("Running") else state.get("Status")),
            "restart_count": attrs.get("RestartCount", 0),
            "uptime_seconds": uptime_seconds,
            "network_mode": attrs.get("HostConfig", {}).get("NetworkMode"),
            "published_ports": sorted(ports),
            "image": attrs.get("Config", {}).get("Image"),
            "vpn_country": env.get("SERVER_COUNTRIES") if container.name == "gluetun" else None,
            "vpn_provider": env.get("VPN_SERVICE_PROVIDER") if container.name == "gluetun" else None,
            "hostname": attrs.get("Config", {}).get("Hostname")
            if container.name == "tailscale"
            else None,
            "ui_url": self.settings.photos_sync_url if container.name == "photos_app" else None,
        }

    def services(self) -> list[dict[str, Any]]:
        try:
            client = self._client()
            containers = {c.name: c for c in client.containers.list(all=True)}
            result = []
            for name in sorted(self.settings.allowed_services):
                container = containers.get(name)
                if container:
                    result.append(self._container_payload(container))
                else:
                    result.append(
                        {
                            "name": name,
                            "label": SERVICE_LABELS.get(name, name.title()),
                            "status": "missing",
                            "running": False,
                            "health": "missing",
                            "restart_count": 0,
                            "uptime_seconds": None,
                            "network_mode": None,
                            "published_ports": [],
                            "image": None,
                            "vpn_country": None,
                            "vpn_provider": None,
                            "hostname": None,
                            "ui_url": self.settings.photos_sync_url if name == "photos_app" else None,
                        }
                    )
            return result
        except DockerException as exc:
            # Keep the complete service grid visible even when Docker is temporarily
            # unavailable. This avoids collapsing the UI to a single Docker card and
            # makes it obvious which services the manager expects to control.
            result: list[dict[str, Any]] = []
            for name in sorted(self.settings.allowed_services):
                result.append(
                    {
                        "name": name,
                        "label": SERVICE_LABELS.get(name, name.title()),
                        "status": "docker-unavailable",
                        "running": False,
                        "health": "unavailable",
                        "restart_count": 0,
                        "uptime_seconds": None,
                        "network_mode": None,
                        "published_ports": [],
                        "image": None,
                        "error": str(exc),
                    }
                )

            result.append(
                {
                    "name": "docker",
                    "label": "Docker Engine",
                    "status": "unavailable",
                    "running": False,
                    "health": "unavailable",
                    "restart_count": 0,
                    "uptime_seconds": None,
                    "network_mode": None,
                    "published_ports": [],
                    "image": None,
                    "vpn_country": None,
                    "vpn_provider": None,
                    "hostname": None,
                    "ui_url": None,
                    "error": str(exc),
                }
            )
            return result


    def vpn_exit_info(self, force: bool = False) -> dict[str, Any]:
        now = monotonic()
        cached = type(self)._vpn_exit_cache
        cache_age = now - type(self)._vpn_exit_cache_at
        if not force and cached is not None and cache_age < self._vpn_exit_cache_ttl_seconds:
            return cached.copy()

        info: dict[str, Any] = {
            "verified": False,
            "ip": None,
            "country_code": None,
            "city": None,
            "organization": None,
            "error": None,
        }

        try:
            container = self._client().containers.get("gluetun")
            container.reload()
            if not container.attrs.get("State", {}).get("Running"):
                info["error"] = "Gluetun no está en ejecución"
            else:
                command = [
                    "sh",
                    "-c",
                    (
                        "if command -v wget >/dev/null 2>&1; then "
                        "wget -qO- -T 8 https://ipinfo.io/json; "
                        "elif command -v curl >/dev/null 2>&1; then "
                        "curl -fsS --max-time 8 https://ipinfo.io/json; "
                        "else exit 127; fi"
                    ),
                ]
                result = container.exec_run(command)
                output = result.output.decode("utf-8", errors="replace").strip()

                if result.exit_code != 0:
                    info["error"] = "No se pudo consultar la IP pública desde Gluetun"
                else:
                    payload = json.loads(output)
                    public_ip = str(payload.get("ip") or "").strip()
                    if public_ip:
                        ip_address(public_ip)
                        info.update(
                            {
                                "verified": True,
                                "ip": public_ip,
                                "country_code": payload.get("country"),
                                "city": payload.get("city"),
                                "organization": payload.get("org"),
                            }
                        )
                    else:
                        info["error"] = "La respuesta no incluía una IP pública"
        except (DockerException, NotFound, ValueError, json.JSONDecodeError) as exc:
            info["error"] = str(exc)

        type(self)._vpn_exit_cache = info.copy()
        type(self)._vpn_exit_cache_at = now
        return info

    def restart(self, service: str) -> dict[str, str]:
        if service not in self.settings.allowed_services:
            raise ValueError("Service is not in the control allowlist")

        try:
            container = self._client().containers.get(service)
            container.restart(timeout=20)
            return {"service": service, "result": "restart-requested"}
        except NotFound as exc:
            raise ValueError(f"Container '{service}' was not found") from exc
        except DockerException as exc:
            raise RuntimeError(f"Docker restart failed: {exc}") from exc

    def diagnostics(self) -> list[dict[str, Any]]:
        services = {item["name"]: item for item in self.services()}
        checks: list[dict[str, Any]] = []

        docker_ok = "docker" not in services
        checks.append(
            {
                "id": "docker",
                "label": "Docker Engine accesible",
                "ok": docker_ok,
                "detail": "Docker API disponible" if docker_ok else "No se puede acceder a Docker",
            }
        )

        if not docker_ok:
            return checks

        dangerous_ports = {
            "5055",
            "6767",
            "7878",
            "8989",
            "9696",
            "8112",
            "58846",
            "6881",
        }
        exposed: list[str] = []
        for service in services.values():
            for binding in service.get("published_ports", []):
                host, _, port = binding.rpartition(":")
                if port in dangerous_ports and host in {"0.0.0.0", "::", ""}:
                    exposed.append(f"{service['name']}:{binding}")

        checks.append(
            {
                "id": "admin-ports",
                "label": "Paneles administrativos no expuestos",
                "ok": not exposed,
                "detail": "Sin binds públicos peligrosos"
                if not exposed
                else "Expuestos: " + ", ".join(exposed),
            }
        )

        gluetun = services.get("gluetun")
        deluge = services.get("deluge")
        vpn_isolation = False
        if gluetun and deluge and gluetun.get("running") and deluge.get("running"):
            network_mode = str(deluge.get("network_mode") or "")
            vpn_isolation = network_mode.startswith("container:")

        checks.append(
            {
                "id": "vpn-isolation",
                "label": "Deluge aislado detrás de Gluetun",
                "ok": vpn_isolation,
                "detail": "Deluge comparte namespace de red con Gluetun"
                if vpn_isolation
                else "No se pudo verificar network_mode=service:gluetun",
            }
        )

        tailscale = services.get("tailscale")
        checks.append(
            {
                "id": "tailscale",
                "label": "Tailscale activo",
                "ok": bool(tailscale and tailscale.get("running")),
                "detail": "Contenedor Tailscale en ejecución"
                if tailscale and tailscale.get("running")
                else "Tailscale no está en ejecución",
            }
        )

        unhealthy = [
            service["name"]
            for service in services.values()
            if service.get("running")
            and service.get("health") not in {"healthy", "running", None}
        ]
        checks.append(
            {
                "id": "container-health",
                "label": "Servicios sin estados unhealthy",
                "ok": not unhealthy,
                "detail": "Todos los servicios activos están sanos"
                if not unhealthy
                else "Revisar: " + ", ".join(unhealthy),
            }
        )

        return checks
