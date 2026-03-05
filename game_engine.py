import json
import random
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class Choice:
    text: str
    next: str
    conditions: Optional[List[Dict[str, Any]]] = None
    effects: Optional[List[Dict[str, Any]]] = None


class GameEngine:
    def __init__(self, data_path: str, rng_seed: Optional[int] = None) -> None:
        self.data_path = Path(data_path)
        self.story = self._load_story(self.data_path)
        self.nodes = {node["id"]: node for node in self.story["nodes"]}
        self.rng = random.Random(rng_seed)
        self.state: Dict[str, Any] = {}
        self.reset_run(keep_progress=False)

    def reset_run(self, keep_progress: bool = True) -> None:
        death_count = self.state.get("death_count", 0) if keep_progress else 0
        unlocked_rules = self.state.get("unlocked_rules", []) if keep_progress else []
        self.state = {
            "player_ticket": str(self.rng.randint(11, 89)),
            "registered": False,
            "took_ticket": False,
            "filled_gap": False,
            "responded_number": False,
            "replaced": False,
            "danger": 0,
            "queue_count": 6,
            "death_count": death_count,
            "unlocked_rules": unlocked_rules,
            "rules": {},
        }
        self.current_id = self.story.get("start", "prologue_ticket")

    def _load_story(self, path: Path) -> Dict[str, Any]:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def get_node(self, node_id: Optional[str] = None) -> Dict[str, Any]:
        target = node_id or self.current_id
        if target not in self.nodes:
            raise KeyError(f"Unknown node: {target}")
        return self.nodes[target]

    def _read_var(self, name: str) -> Any:
        if name.startswith("rules."):
            _, rule_key = name.split(".", 1)
            return self.state["rules"].get(rule_key, False)
        return self.state.get(name)

    def _write_var(self, name: str, value: Any) -> None:
        if name.startswith("rules."):
            _, rule_key = name.split(".", 1)
            self.state["rules"][rule_key] = value
            return
        self.state[name] = value

    def check_condition(self, cond: Dict[str, Any]) -> bool:
        left = self._read_var(cond["var"])
        op = cond.get("op", "equals")
        right = cond.get("value")
        if op == "equals":
            return left == right
        if op == "not_equals":
            return left != right
        if op == "gte":
            return left >= right
        if op == "lte":
            return left <= right
        if op == "in":
            return left in right
        raise ValueError(f"Unsupported condition op: {op}")

    def _render_template(self, text: str) -> str:
        def replace(match: re.Match[str]) -> str:
            key = match.group(1).strip()
            value = self._read_var(key)
            return "" if value is None else str(value)

        return re.sub(r"\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}", replace, text)

    def apply_effect(self, effect: Dict[str, Any]) -> None:
        op = effect["op"]
        var = effect["var"]
        if op == "set":
            self._write_var(var, effect["value"])
        elif op == "inc":
            self._write_var(var, (self._read_var(var) or 0) + effect.get("value", 1))
        elif op == "dec":
            self._write_var(var, (self._read_var(var) or 0) - effect.get("value", 1))
        elif op == "copy":
            self._write_var(var, self._read_var(effect["from"]))
        else:
            raise ValueError(f"Unsupported effect op: {op}")

    def enter_current_node(self) -> None:
        node = self.get_node()
        for effect in node.get("on_enter", []):
            self.apply_effect(effect)

    def get_visible_choices(self) -> List[Choice]:
        node = self.get_node()
        visible: List[Choice] = []
        for raw in node.get("choices", []):
            conditions = raw.get("conditions", [])
            if all(self.check_condition(c) for c in conditions):
                visible.append(
                    Choice(
                        text=self._render_template(raw["text"]),
                        next=raw["next"],
                        conditions=conditions,
                        effects=raw.get("effects", []),
                    )
                )
        return visible

    def choose(self, choice_index: int) -> None:
        choices = self.get_visible_choices()
        if choice_index < 0 or choice_index >= len(choices):
            raise IndexError("Invalid choice index")
        choice = choices[choice_index]
        for effect in choice.effects or []:
            self.apply_effect(effect)
        self.current_id = choice.next

    def ambient_line(self) -> str:
        library = self.story.get("ambient", [])
        eligible = [x for x in library if self.state["danger"] >= x.get("min_danger", 0)]
        if not eligible:
            return ""
        return self._render_template(self.rng.choice(eligible)["text"])

    def render_node_text(self) -> str:
        node = self.get_node()
        lines = [self._render_template(line) for line in node.get("text", [])]
        if node.get("id") == self.story.get("start"):
            dc = self.state.get("death_count", 0)
            if dc == 0:
                lines.insert(0, "你第一次走进夜诊大厅。")
            elif dc <= 2:
                lines.insert(0, "你又一次回到同一条队伍。")
            else:
                lines.insert(0, "你已经记不清这是第几次重来。")
        amb = self.ambient_line()
        if amb:
            lines.extend(["", amb])
        return "\n".join(lines)

    def is_end(self) -> bool:
        return self.get_node().get("ending", False)

    def on_ending(self) -> None:
        node = self.get_node()
        if node.get("ending_type") == "death":
            self.state["death_count"] += 1
            unlock = node.get("unlock_rule")
            if unlock and unlock not in self.state["unlocked_rules"]:
                self.state["unlocked_rules"].append(unlock)


def run_cli(data_path: str = "story/night_clinic.json") -> None:
    game = GameEngine(data_path)
    while True:
        game.enter_current_node()
        print("\n" + "=" * 48)
        print(game.render_node_text())

        if game.is_end():
            game.on_ending()
            if game.state["unlocked_rules"]:
                print("\n你记住的禁忌：")
                for r in game.state["unlocked_rules"]:
                    print(f"- {r}")
            print(f"\n重复排队次数：{game.state['death_count']}")
            raw = input("\n--- 结局结束，输入 r 重开，其他键退出 ---\n> ").strip().lower()
            if raw == "r":
                game.reset_run(keep_progress=True)
                continue
            break

        choices = game.get_visible_choices()
        for idx, choice in enumerate(choices, 1):
            print(f"{idx}. {choice.text}")

        raw = input("\n请选择> ").strip()
        if not raw.isdigit():
            print("请输入数字。")
            continue
        try:
            game.choose(int(raw) - 1)
        except Exception as exc:
            print(f"选择无效: {exc}")


if __name__ == "__main__":
    run_cli()
