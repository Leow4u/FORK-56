"""Splash must not dump the skills catalog — that lives on /skills and /help."""

from unittest.mock import patch

from rich.console import Console

import work4you_cli.banner as banner


def _build_banner_with_skills(skills_by_category, term_width=160):
    with (
        patch.object(banner, "get_update_result", return_value=None),
        patch.object(banner, "get_latest_release_tag", return_value=None),
        patch("shutil.get_terminal_size", return_value=__import__("os").terminal_size((term_width, 50))),
    ):
        console = Console(
            record=True, force_terminal=False, color_system=None, width=term_width
        )
        banner.build_welcome_banner(
            console=console,
            model="anthropic/test-model",
            cwd="/tmp/project",
            skills_by_category=skills_by_category,
        )
        return console.export_text()


def test_splash_hides_skills_on_wide_terminal():
    skills = {"research": [f"skill-{i:02d}" for i in range(15)]}
    text = _build_banner_with_skills(skills, term_width=200)
    assert "Available Skills" not in text
    assert "skill-00" not in text
    assert "skill-08" not in text
    assert "test-model" in text
    assert "/tmp/project" in text


def test_splash_hides_skills_on_narrow_terminal():
    skills = {"security": ["auth", "vault"]}
    text = _build_banner_with_skills(skills, term_width=80)
    assert "auth" not in text
    assert "vault" not in text
    assert "Available Skills" not in text
    assert "test-model" in text


def test_long_category_names_do_not_leak_into_splash():
    skills = {"very-long-category-name": [f"skill-{i:02d}" for i in range(10)]}
    text = _build_banner_with_skills(skills, term_width=120)
    assert "very-long-category-name" not in text
    assert "skill-00" not in text
