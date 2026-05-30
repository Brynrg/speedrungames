"""Green Circle TD - Path generation for four-corner map."""
import math


def make_four_corner_paths(screen_w, screen_h):
    """Generate 4 spiral paths, one from each corner, converging at center.

    Args:
        screen_w: Screen width in pixels.
        screen_h: Screen height in pixels.

    Returns:
        List of 4 paths, each a list of (x, y) waypoints.
    """
    cx, cy = screen_w / 2, screen_h / 2
    paths = []

    for corner in [(0, 0), (screen_w, 0), (0, screen_h), (screen_w, screen_h)]:
        path = spiral_path(start=corner, end=(cx, cy), turns=1.5, samples=48)
        paths.append(path)

    return paths


def spiral_path(start, end, turns, samples):
    """Generate a log-spiral from start to end.

    Args:
        start: (x, y) tuple, starting point.
        end: (x, y) tuple, ending point.
        turns: Number of full rotations in the spiral.
        samples: Number of points to generate.

    Returns:
        List of (x, y) points along the spiral.
    """
    start_x, start_y = start
    end_x, end_y = end
    dx = end_x - start_x
    dy = end_y - start_y
    distance = math.sqrt(dx*dx + dy*dy)

    # Normalize direction vector
    if distance == 0:
        return [start]

    dir_x = dx / distance
    dir_y = dy / distance

    # Perpendicular vector (90° right)
    perp_x = -dir_y
    perp_y = dir_x

    points = []

    for i in range(samples):
        t = i / (samples - 1)  # 0 to 1
        angle = t * turns * 2 * math.pi
        radius = distance * t

        # Logarithmic spiral: expand outward as we progress
        # Adjust for tighter spiral near end
        scale = 1.0 - math.pow(t, 1.5)  # More curvature near end
        spiral_x = start_x + dir_x * radius + perp_x * math.sin(angle) * radius * scale
        spiral_y = start_y + dir_y * radius + perp_y * math.sin(angle) * radius * scale

        points.append((spiral_x, spiral_y))

    return points
