from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass
class Enemy:
    """A single enemy moving along a straight track."""

    position: float
    health: int
    speed: float

    def advance(self, dt: float = 1.0) -> None:
        """Move the enemy along the track."""
        self.position += self.speed * dt

    @property
    def alive(self) -> bool:
        return self.health > 0


@dataclass
class Tower:
    """Stationary tower that shoots enemies within range."""

    position: int
    attack_range: int
    damage: int

    def target(self, enemies: List[Enemy]) -> Enemy | None:
        """Return the closest enemy in range or ``None`` if there are none."""
        in_range = [enemy for enemy in enemies if self._in_range(enemy)]
        if not in_range:
            return None
        return min(in_range, key=lambda enemy: enemy.position)

    def _in_range(self, enemy: Enemy) -> bool:
        return abs(enemy.position - self.position) <= self.attack_range


@dataclass
class GameState:
    """Mutable state of a running match."""

    track_length: int
    enemies: List[Enemy] = field(default_factory=list)
    towers: List[Tower] = field(default_factory=list)
    tick: int = 0
    defeated: int = 0

    def active_enemies(self) -> List[Enemy]:
        return [enemy for enemy in self.enemies if enemy.alive]

    def has_lost(self) -> bool:
        return any(enemy.position >= self.track_length for enemy in self.active_enemies())

    def is_cleared(self) -> bool:
        return not self.active_enemies()
