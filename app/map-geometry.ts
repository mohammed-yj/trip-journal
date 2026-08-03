export type PolygonFeature = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  Record<string, unknown>
>;

type SegmentRow = {
  count: number;
  coordinates: [GeoJSON.Position, GeoJSON.Position];
};

function pointKey(point: GeoJSON.Position) {
  return JSON.stringify(point);
}

function segmentKey(left: GeoJSON.Position, right: GeoJSON.Position) {
  const leftKey = pointKey(left);
  const rightKey = pointKey(right);
  return leftKey < rightKey
    ? `${leftKey}|${rightKey}`
    : `${rightKey}|${leftKey}`;
}

function geometryRings(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
) {
  return geometry.type === "Polygon"
    ? geometry.coordinates
    : geometry.coordinates.flat();
}

/**
 * Dissolves adjacent ADM1 polygons into the exact exterior boundary represented
 * by their source geometry. Shared internal segments occur twice; exterior
 * segments occur once. The remaining segments are stitched into continuous
 * lines so SVG joins are smooth instead of drawing thousands of round-capped
 * two-point fragments on top of one another.
 */
export function adminOuterBoundary(
  features: PolygonFeature[],
): GeoJSON.Feature<GeoJSON.MultiLineString> | null {
  const segments = new Map<string, SegmentRow>();

  for (const feature of features) {
    for (const ring of geometryRings(feature.geometry)) {
      if (ring.length < 2) continue;
      const pairCount = ring.length - 1;
      for (let index = 0; index < pairCount; index += 1) {
        const left = ring[index];
        const right = ring[index + 1];
        if (pointKey(left) === pointKey(right)) continue;
        const key = segmentKey(left, right);
        const current = segments.get(key);
        if (current) current.count += 1;
        else segments.set(key, { count: 1, coordinates: [left, right] });
      }
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (pointKey(first) !== pointKey(last)) {
        const key = segmentKey(last, first);
        const current = segments.get(key);
        if (current) current.count += 1;
        else segments.set(key, { count: 1, coordinates: [last, first] });
      }
    }
  }

  const exterior = Array.from(segments.values())
    .filter((segment) => segment.count === 1)
    .map((segment) => segment.coordinates);
  if (!exterior.length) return null;

  const pointSegments = new Map<string, number[]>();
  exterior.forEach(([left, right], index) => {
    for (const point of [left, right]) {
      const key = pointKey(point);
      const indexes = pointSegments.get(key) || [];
      indexes.push(index);
      pointSegments.set(key, indexes);
    }
  });

  const unused = new Set(exterior.map((_, index) => index));
  const coordinates: GeoJSON.Position[][] = [];

  const adjacentUnused = (point: GeoJSON.Position) =>
    (pointSegments.get(pointKey(point)) || []).find((index) => unused.has(index));

  while (unused.size) {
    const firstIndex = unused.values().next().value as number;
    const [left, right] = exterior[firstIndex];
    const line: GeoJSON.Position[] = [left, right];
    unused.delete(firstIndex);

    while (true) {
      const tail = line[line.length - 1];
      const nextIndex = adjacentUnused(tail);
      if (nextIndex === undefined) break;
      const [nextLeft, nextRight] = exterior[nextIndex];
      line.push(pointKey(nextLeft) === pointKey(tail) ? nextRight : nextLeft);
      unused.delete(nextIndex);
    }

    while (true) {
      const head = line[0];
      const nextIndex = adjacentUnused(head);
      if (nextIndex === undefined) break;
      const [nextLeft, nextRight] = exterior[nextIndex];
      line.unshift(pointKey(nextLeft) === pointKey(head) ? nextRight : nextLeft);
      unused.delete(nextIndex);
    }

    coordinates.push(line);
  }

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "MultiLineString", coordinates },
  };
}
