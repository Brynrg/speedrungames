"""Green Circle TD - Seeded RNG wrapper for deterministic gameplay."""
import random


class Rng:
    """Deterministic random number generator wrapper."""

    def __init__(self, seed: int):
        self._r = random.Random(seed)

    def randint(self, a, b):
        return self._r.randint(a, b)

    def choice(self, seq):
        return self._r.choice(seq)

    def uniform(self, a, b):
        return self._r.uniform(a, b)

    def random(self):
        return self._r.random()

    def shuffle(self, x):
        return self._r.shuffle(x)

    def randrange(self, start, stop=None, step=1):
        return self._r.randrange(start, stop, step)
