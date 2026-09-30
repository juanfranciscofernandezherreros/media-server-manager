from app.config import Settings


def test_allowed_services_are_normalized():
    settings = Settings(manager_allowed_services=" jellyfin, sonarr ,,radarr ")
    assert settings.allowed_services == {"jellyfin", "sonarr", "radarr"}


def test_photos_sync_is_managed_by_default():
    settings = Settings()
    assert "photos_app" in settings.allowed_services
    assert settings.photos_sync_url == "http://127.0.0.1:8765"
