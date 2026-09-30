from docker.errors import DockerException

from app.config import Settings
from app.docker_manager import DockerManager


def test_services_stay_visible_when_docker_is_unavailable(monkeypatch):
    settings = Settings(
        manager_allowed_services="jellyfin,sonarr,radarr",
        manager_api_token="test-token",
    )
    manager = DockerManager(settings)

    def broken_client():
        raise DockerException("docker unavailable")

    monkeypatch.setattr(manager, "_client", broken_client)

    services = manager.services()
    names = {service["name"] for service in services}

    assert {"jellyfin", "sonarr", "radarr", "docker"} <= names
    assert all(
        service["status"] == "docker-unavailable"
        for service in services
        if service["name"] != "docker"
    )


class FakeExecResult:
    exit_code = 0
    output = b'{"ip":"185.10.20.30","city":"Madrid","country":"ES","org":"AS123 Example VPN"}'


class FakeGluetun:
    attrs = {"State": {"Running": True}}

    def reload(self):
        return None

    def exec_run(self, command):
        assert "ipinfo.io/json" in command[-1]
        return FakeExecResult()


class FakeContainers:
    def get(self, name):
        assert name == "gluetun"
        return FakeGluetun()


class FakeClient:
    containers = FakeContainers()


def test_vpn_exit_info_is_read_from_inside_gluetun(monkeypatch):
    settings = Settings(manager_api_token="test-token")
    manager = DockerManager(settings)
    type(manager)._vpn_exit_cache = None
    monkeypatch.setattr(manager, "_client", lambda: FakeClient())

    info = manager.vpn_exit_info(force=True)

    assert info["verified"] is True
    assert info["ip"] == "185.10.20.30"
    assert info["country_code"] == "ES"
    assert info["city"] == "Madrid"
    assert info["organization"] == "AS123 Example VPN"


class FakePhotosContainer:
    name = "photos_app"
    status = "running"
    attrs = {
        "State": {
            "Status": "running",
            "Running": True,
            "StartedAt": "2026-09-30T10:00:00+00:00",
            "Health": {"Status": "healthy"},
        },
        "RestartCount": 0,
        "NetworkSettings": {"Ports": {"8765/tcp": [{"HostIp": "127.0.0.1", "HostPort": "8765"}]}},
        "HostConfig": {"NetworkMode": "bridge"},
        "Config": {"Image": "photos-sync:latest", "Env": [], "Hostname": "photos-app"},
    }


def test_photos_sync_payload_has_friendly_label_and_ui_url():
    settings = Settings(photos_sync_url="http://media-host:8765")
    manager = DockerManager(settings)

    payload = manager._container_payload(FakePhotosContainer())

    assert payload["name"] == "photos_app"
    assert payload["label"] == "Photos Sync"
    assert payload["health"] == "healthy"
    assert payload["ui_url"] == "http://media-host:8765"
