import json
from pathlib import Path

from game_engine import GameEngine


def test_random_ticket_template_present():
    g = GameEngine("story/night_clinic.json", rng_seed=1)
    g.current_id = "prologue_ticket"
    text = g.render_node_text()
    assert g.state["player_ticket"] in text


def test_hidden_ending_choice_visible_when_conditions_match():
    g = GameEngine("story/night_clinic.json", rng_seed=1)
    g.state["queue_count"] = 3
    g.current_id = "leave_or_stay"
    choices = [c.text for c in g.get_visible_choices()]
    assert "趁现在离开医院" in choices


def test_hidden_ending_choice_hidden_when_broken_rule():
    g = GameEngine("story/night_clinic.json", rng_seed=1)
    g.state["queue_count"] = 3
    g.state["took_ticket"] = True
    g.current_id = "leave_or_stay"
    choices = [c.text for c in g.get_visible_choices()]
    assert "趁现在离开医院" not in choices


def test_hidden_ending_reachable_by_safe_path():
    g = GameEngine("story/night_clinic.json", rng_seed=1)
    for idx in [0, 0, 0, 1, 1, 1, 1, 1]:
        g.enter_current_node()
        g.choose(idx)
    g.enter_current_node()
    assert g.current_id == "leave_or_stay"
    assert any(c.text == "趁现在离开医院" for c in g.get_visible_choices())


def test_death_endings_unlock_rules_in_engine():
    g = GameEngine("story/night_clinic.json", rng_seed=1)
    g.current_id = "ending_death_gap"
    g.on_ending()
    assert g.state["death_count"] == 1
    assert "不要补空位" in g.state["unlocked_rules"]


def test_story_has_multiple_death_endings_and_unlock_fields():
    data = json.loads(Path("story/night_clinic.json").read_text(encoding="utf-8"))
    death_endings = [n for n in data["nodes"] if n.get("ending_type") == "death"]
    assert len(death_endings) >= 4
    assert all("unlock_rule" in n for n in death_endings)


def test_web_ui_has_restart_and_progress_hooks():
    html = Path("index.html").read_text(encoding="utf-8")
    js = Path("app.js").read_text(encoding="utf-8")
    assert 'id="restartBtn"' in html
    assert 'id="endingBook"' in html
    assert "PROGRESS_STORAGE_KEY" in js
    assert "unlock_rule" in js
