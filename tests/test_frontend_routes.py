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
