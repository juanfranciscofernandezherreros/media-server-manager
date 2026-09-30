from __future__ import annotations

from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import Settings, get_settings
from app.docker_manager import DockerManager
from app.system_metrics import get_system_metrics

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(
    title="Media Server Manager",
    version="0.1.0",
    description="Dashboard local para observar y operar de forma segura un media server.",
)


def manager(settings: Settings = Depends(get_settings)) -> DockerManager:
    return DockerManager(settings)


def require_action_token(
    x_manager_token: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    configured = settings.manager_api_token.strip()
    if not configured or configured == "change-me":
        raise HTTPException(
            status_code=503,
            detail="Actions are disabled until MANAGER_API_TOKEN is configured",
        )
    if x_manager_token != configured:
        raise HTTPException(status_code=401, detail="Invalid manager token")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/services")
def services(docker_manager: DockerManager = Depends(manager)):
    return {"services": docker_manager.services()}


@app.get("/api/system")
def system(settings: Settings = Depends(get_settings)):
    return get_system_metrics(settings)


@app.get("/api/diagnostics")
def diagnostics(
    docker_manager: DockerManager = Depends(manager),
    settings: Settings = Depends(get_settings),
):
    checks = docker_manager.diagnostics()
    system = get_system_metrics(settings)
    checks.append(
        {
            "id": "disk",
            "label": "Capacidad de disco dentro del umbral",
            "ok": not system["disk_warning"],
            "detail": f"Uso actual: {system['disk_percent']}%",
        }
    )
    return {"checks": checks, "healthy": all(check["ok"] for check in checks)}


@app.get("/api/overview")
def overview(
    docker_manager: DockerManager = Depends(manager),
    settings: Settings = Depends(get_settings),
):
    services_payload = docker_manager.services()
    checks = docker_manager.diagnostics()
    system = get_system_metrics(settings)

    running = sum(1 for service in services_payload if service.get("running"))
    unhealthy = sum(
        1
        for service in services_payload
        if service.get("running")
        and service.get("health") not in {"healthy", "running", None}
    )
    protected = next(
        (check["ok"] for check in checks if check["id"] == "vpn-isolation"),
        False,
    )
    services_by_name = {service["name"]: service for service in services_payload}
    gluetun = services_by_name.get("gluetun", {})
    tailscale = services_by_name.get("tailscale", {})

    connectivity = {
        "vpn": {
            "connected": bool(gluetun.get("running")),
            "protected": protected,
            "country": gluetun.get("vpn_country"),
            "provider": gluetun.get("vpn_provider"),
            "exit_ip": None,
            "exit_ip_verified": False,
        },
        "remote_access": {
            "active": bool(tailscale.get("running")),
            "private": bool(tailscale.get("running")),
            "provider": "Tailscale",
            "hostname": tailscale.get("hostname"),
        },
    }

    return {
        "summary": {
            "healthy": unhealthy == 0 and all(check["ok"] for check in checks),
            "running_services": running,
            "total_services": len(services_payload),
            "vpn_protected": protected,
        },
        "services": services_payload,
        "system": system,
        "diagnostics": checks,
        "connectivity": connectivity,
        "refresh_seconds": settings.manager_refresh_seconds,
    }


@app.post(
    "/api/services/{service}/restart",
    dependencies=[Depends(require_action_token)],
)
def restart_service(
    service: str,
    docker_manager: DockerManager = Depends(manager),
):
    try:
        return docker_manager.restart(service)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")
