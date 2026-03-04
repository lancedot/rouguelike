from game_engine import GameEngine


def test_name_input_and_template():
    g = GameEngine("story/night_clinic.json", rng_seed=1)
    g.input_name("Alex")
    g.current_id = "name_call"
    text = g.render_node_text()
    assert "Alex" in text


def test_hidden_ending_choice_visible_when_conditions_match():
    g = GameEngine("story/night_clinic.json", rng_seed=1)
    g.state["queue_count"] = 3
    g.current_id = "leave_or_stay"
    choices = [c.text for c in g.get_visible_choices()]
    assert "现在离开医院" in choices


def test_hidden_ending_choice_hidden_when_broken_rule():
    g = GameEngine("story/night_clinic.json", rng_seed=1)
    g.state["queue_count"] = 3
    g.state["took_ticket"] = True
    g.current_id = "leave_or_stay"
    choices = [c.text for c in g.get_visible_choices()]
    assert "现在离开医院" not in choices


def test_effects_applied_on_choice():
    g = GameEngine("story/night_clinic.json", rng_seed=1)
    g.current_id = "gap_event"
    g.choose(0)
    assert g.state["filled_gap"] is True
    assert g.current_id == "death_replace"
