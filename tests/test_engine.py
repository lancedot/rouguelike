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
    assert "在现在离开医院" in choices


def test_hidden_ending_choice_hidden_when_broken_rule():
    g = GameEngine("story/night_clinic.json", rng_seed=1)
    g.state["queue_count"] = 3
    g.state["took_ticket"] = True
    g.current_id = "leave_or_stay"
    choices = [c.text for c in g.get_visible_choices()]
    assert "在现在离开医院" not in choices


def test_effects_applied_on_choice():
    g = GameEngine("story/night_clinic.json", rng_seed=1)
    g.current_id = "gap_event"
    g.choose(0)
    assert g.state["filled_gap"] is True
    assert g.current_id == "death_replace"


def test_hidden_ending_reachable_by_safe_path():
    g = GameEngine("story/night_clinic.json", rng_seed=1)

    # prologue -> entrance
    g.enter_current_node()
    g.input_name("林秋")
    g.choose(0)

    # entrance -> queue_intro
    g.enter_current_node()
    g.choose(0)

    # queue_intro -> observe_hall (wait queue advance)
    g.enter_current_node()
    g.choose(0)

    # observe_hall -> gap_event
    g.enter_current_node()
    g.choose(0)

    # gap_event -> steps_event (keep position)
    g.enter_current_node()
    g.choose(1)

    # steps_event -> window_event (step back)
    g.enter_current_node()
    g.choose(1)

    # window_event -> name_call (dark window)
    g.enter_current_node()
    g.choose(1)

    # name_call -> ticket_event (no response)
    g.enter_current_node()
    g.choose(1)

    # ticket_event -> leave_or_stay (reject ticket)
    g.enter_current_node()
    g.choose(1)

    # should have hidden ending choice and reach it
    g.enter_current_node()
    choices = g.get_visible_choices()
    assert any(c.text == "在现在离开医院" for c in choices)
    hidden_index = [i for i, c in enumerate(choices) if c.text == "在现在离开医院"][0]
    g.choose(hidden_index)
    assert g.current_id == "ending_hidden"
