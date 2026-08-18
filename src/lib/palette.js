// Course colors: muted, earthy, desaturated tones that stay distinguishable
// without reading as a bright rainbow, neon, or pastel palette.
export const COURSE_COLORS = [
  "#9c7a25", // gold ochre
  "#4f6a4c", // forest
  "#3f5b70", // slate blue
  "#9c4a3a", // brick
  "#6a4a60", // plum
  "#a06a2a", // amber clay
  "#3d6663", // deep teal
  "#6a6437", // olive
];

// Pick the least-used color so new courses stay visually distinct.
export function nextColor(existingCourses = []) {
  const counts = new Map(COURSE_COLORS.map((c) => [c, 0]));
  for (const c of existingCourses) {
    if (counts.has(c.color)) counts.set(c.color, counts.get(c.color) + 1);
  }
  let best = COURSE_COLORS[0];
  let bestCount = Infinity;
  for (const color of COURSE_COLORS) {
    const n = counts.get(color) ?? 0;
    if (n < bestCount) {
      bestCount = n;
      best = color;
    }
  }
  return best;
}
