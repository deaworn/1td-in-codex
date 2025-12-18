from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List

from .model import Enemy, GameState, Tower


@dataclass(frozen=True)
class SpawnPlan:
    """Definition for when and how a new enemy appears."""

    tick: int
    health: int
    speed: float

    def spawn_enemy(self) -> Enemy:
        return Enemy(position=0, health=self.health, speed=self.speed)


class GameEngine:
    """Step-based simulation for a 1D tower defense game."""

    def __init__(self, track_length: int, towers: Iterable[Tower], spawns: Iterable[SpawnPlan]):
        self.state = GameState(track_length=track_length, towers=list(towers))
        self._schedule: List[SpawnPlan] = sorted(spawns, key=lambda plan: plan.tick)

    def step(self) -> List[str]:
        """Advance the simulation by one tick and return event messages."""
        events: List[str] = []
        self._spawn_ready(events)
        self._towers_fire(events)
        self._advance_enemies(events)
        self.state.tick += 1
        return events

    def run(self, max_ticks: int = 200) -> GameState:
        """Run the simulation until all enemies are cleared or the base is lost."""
        while self.state.tick < max_ticks and not self.state.has_lost():
            if self.state.is_cleared() and not self._schedule:
                break
            self.step()
        return self.state

    def _spawn_ready(self, events: List[str]) -> None:
        while self._schedule and self._schedule[0].tick <= self.state.tick:
            plan = self._schedule.pop(0)
            enemy = plan.spawn_enemy()
            self.state.enemies.append(enemy)
            events.append(f"Spawned enemy with {enemy.health} hp at tick {self.state.tick}.")

    def _towers_fire(self, events: List[str]) -> None:
        for tower in self.state.towers:
            target = tower.target(self.state.active_enemies())
            if target is None:
                continue
            target.health -= tower.damage
            events.append(
                f"Tower at {tower.position} hit enemy at {target.position:.1f} for {tower.damage} damage."
            )
            if not target.alive:
                self.state.defeated += 1
                events.append("Enemy defeated!")
        self.state.enemies = self.state.active_enemies()

    def _advance_enemies(self, events: List[str]) -> None:
        for enemy in self.state.active_enemies():
            enemy.advance()
            events.append(f"Enemy advanced to {enemy.position:.1f} with {enemy.health} hp remaining.")
