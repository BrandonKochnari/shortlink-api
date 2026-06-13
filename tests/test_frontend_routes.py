import json
from pathlib import Path


def test_guest_spa_route_rewrite_precedes_short_code_rewrite():
    vercel_config_path = Path(__file__).resolve().parent.parent / "frontend" / "vercel.json"
    vercel_config = json.loads(vercel_config_path.read_text())
    rewrite_sources = [rewrite["source"] for rewrite in vercel_config["rewrites"]]

    guest_index = rewrite_sources.index("/guest")
    guest_nested_index = rewrite_sources.index("/guest/(.*)")
    short_code_index = rewrite_sources.index("/:shortCode")

    assert guest_index < short_code_index
    assert guest_nested_index < short_code_index


def test_logged_in_dashboard_exposes_custom_alias_and_random_generation():
    dashboard_path = Path(__file__).resolve().parent.parent / "frontend" / "src" / "pages" / "Dashboard.tsx"
    dashboard_source = dashboard_path.read_text()

    assert "Custom short code" in dashboard_source
    assert "Generate random" in dashboard_source
    assert "generateClientShortCode" in dashboard_source
    assert "custom_alias" in dashboard_source


def test_guest_dashboard_displays_link_limit_message():
    guest_dashboard_path = Path(__file__).resolve().parent.parent / "frontend" / "src" / "pages" / "GuestDashboard.tsx"
    guest_dashboard_source = guest_dashboard_path.read_text()

    assert (
        "Guest links expire after 7 days and are limited to 10 links. "
        "Sign in for unlimited links, custom short codes, custom expiration, "
        "permanent links, and activate/deactivate controls."
    ) in guest_dashboard_source
    assert "Guest accounts can create up to 10 links. Sign in for unlimited links." in guest_dashboard_source
