import json
from pathlib import Path

from game_engine import GameEngine


def test_random_ticket_template_present():
    g = GameEngine("story/night_clinic.json", rng_seed=1)
    g.current_id = "prologue_ticket"
    text = g.render_node_text()
    assert g.state["player_ticket"] in text


def test_no_name_input_node_anymore():
    g = GameEngine("story/night_clinic.json", rng_seed=1)
    for node in g.story["nodes"]:
        assert "input" not in node


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
    choices = g.get_visible_choices()
    assert any(c.text == "趁现在离开医院" for c in choices)


def test_web_ui_has_restart_and_ending_collection_hooks():
    html = Path("index.html").read_text(encoding="utf-8")
    js = Path("app.js").read_text(encoding="utf-8")
    assert 'id="restartBtn"' in html
    assert 'id="endingBook"' in html
    assert 'localStorage' in js


def test_all_endings_have_titles_for_collection_view():
    data = json.loads(Path("story/night_clinic.json").read_text(encoding="utf-8"))
    endings = [n for n in data["nodes"] if n.get("ending")]
    assert endings
    assert all("ending_title" in n for n in endings)
