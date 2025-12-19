import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "src"))

from one_td.engine import GameEngine, SpawnPlan  # noqa: E402
from one_td.model import Tower  # noqa: E402


class GameEngineTest(unittest.TestCase):
    def test_enemy_defeated_before_reaching_base(self) -> None:
        tower = Tower(position=2, attack_range=2, damage=2)
        engine = GameEngine(track_length=10, towers=[tower], spawns=[SpawnPlan(tick=0, health=3, speed=1.0)])

        final_state = engine.run(max_ticks=15)

        self.assertEqual(final_state.defeated, 1)
        self.assertTrue(final_state.is_cleared())
        self.assertFalse(final_state.has_lost())

    def test_spawns_follow_schedule(self) -> None:
        tower = Tower(position=5, attack_range=5, damage=10)
        spawns = [
            SpawnPlan(tick=1, health=1, speed=1.0),
            SpawnPlan(tick=3, health=1, speed=1.0),
        ]
        engine = GameEngine(track_length=15, towers=[tower], spawns=spawns)

        engine.step()  # tick 0
        self.assertEqual(len(engine.state.enemies), 0)

        engine.step()  # tick 1, first spawn
        self.assertEqual(len(engine.state.enemies), 0)  # tower clears immediately
        self.assertEqual(engine.state.defeated, 1)

        engine.step()  # tick 2
        engine.step()  # tick 3, second spawn
        self.assertEqual(engine.state.defeated, 2)


if __name__ == "__main__":
    unittest.main()
