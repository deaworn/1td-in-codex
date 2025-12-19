from __future__ import annotations

from .engine import GameEngine, SpawnPlan
from .model import Tower


def format_state(engine: GameEngine) -> str:
    enemies = engine.state.active_enemies()
    enemy_status = ", ".join(f"pos {enemy.position:.1f} ({enemy.health} hp)" for enemy in enemies) or "none"
    return (
        f"Tick {engine.state.tick}: enemies [{enemy_status}], "
        f"defeated {engine.state.defeated}, lost: {engine.state.has_lost()}"
    )


def build_demo_engine() -> GameEngine:
    towers = [
        Tower(position=3, attack_range=2, damage=2),
        Tower(position=7, attack_range=3, damage=3),
    ]
    spawns = [
        SpawnPlan(tick=0, health=4, speed=1.0),
        SpawnPlan(tick=2, health=5, speed=1.2),
        SpawnPlan(tick=4, health=6, speed=1.1),
    ]
    return GameEngine(track_length=12, towers=towers, spawns=spawns)


def main() -> None:
    engine = build_demo_engine()
    print("Starting demo wave...")
    while not engine.state.has_lost():
        if engine.state.is_cleared() and not engine._schedule:  # noqa: SLF001 - simple demo
            break
        events = engine.step()
        print(format_state(engine))
        for event in events:
            print(f"  - {event}")
    result = "Base lost!" if engine.state.has_lost() else "Wave cleared!"
    print(result)


if __name__ == "__main__":
    main()
