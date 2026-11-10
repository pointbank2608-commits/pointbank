type Vec3 = readonly [number, number, number];
type Face = { normal: Vec3; across: Vec3; down: Vec3; pips: number[] };

const faces: Face[] = [
  { normal: [0, 0, 1], across: [1, 0, 0], down: [0, 1, 0], pips: [4] },
  { normal: [0, -1, 0], across: [1, 0, 0], down: [0, 0, 1], pips: [0, 8] },
  { normal: [1, 0, 0], across: [0, 0, -1], down: [0, 1, 0], pips: [0, 4, 8] },
  { normal: [-1, 0, 0], across: [0, 0, 1], down: [0, 1, 0], pips: [0, 2, 6, 8] },
  { normal: [0, 1, 0], across: [1, 0, 0], down: [0, 0, -1], pips: [0, 2, 4, 6, 8] },
  { normal: [0, 0, -1], across: [-1, 0, 0], down: [0, 1, 0], pips: [0, 2, 3, 5, 6, 8] },
];
const radius = .19;
const flat = .5 - radius;
const camera = 4.6;

function pointOnFace({ normal, across, down }: Face, x: number, y: number, depth = .5): Vec3 {
  return [
    normal[0] * depth + across[0] * x + down[0] * y,
    normal[1] * depth + across[1] * x + down[1] * y,
    normal[2] * depth + across[2] * x + down[2] * y,
  ];
}

function roundedPoint(point: Vec3) {
  const [x, y, z] = point;
  const cx = Math.max(-flat, Math.min(flat, x));
  const cy = Math.max(-flat, Math.min(flat, y));
  const cz = Math.max(-flat, Math.min(flat, z));
  const length = Math.hypot(x - cx, y - cy, z - cz);
  const normal: Vec3 = [(x - cx) / length, (y - cy) / length, (z - cz) / length];
  const position: Vec3 = [cx + normal[0] * radius, cy + normal[1] * radius, cz + normal[2] * radius];
  return { position, normal };
}

// Project the surface of a cube onto the rounded shell around its smaller core.
const subdivisions = 6;
const band = Array.from({ length: subdivisions + 1 }, (_, i) => flat + i * radius / subdivisions);
const cuts = [...band.slice().reverse().map(value => -value), ...band];
const surface = faces.flatMap(face => cuts.slice(1).flatMap((right, col) => (
  cuts.slice(1).map((bottom, row) => {
    const left = cuts[col];
    const top = cuts[row];
    const { position, normal } = roundedPoint(pointOnFace(face, (left + right) / 2, (top + bottom) / 2));
    const points = [[left, top], [right, top], [right, bottom], [left, bottom]]
      .map(([x, y]) => roundedPoint(pointOnFace(face, x, y)).position);
    return { points, position, normal };
  })
)));

const dots = faces.map(face => ({
  normal: face.normal,
  position: pointOnFace(face, 0, 0),
  outlines: face.pips.map(index => Array.from({ length: 20 }, (_, i) => {
    const angle = i * Math.PI / 10;
    const x = (index % 3 - 1) * .211 + Math.cos(angle) * .063;
    const y = (Math.floor(index / 3) - 1) * .211 + Math.sin(angle) * .063;
    return pointOnFace(face, x, y, .501);
  })),
}));

export function drawRoundedDie(context: CanvasRenderingContext2D, rotation: DOMMatrixReadOnly, tint: 'blue' | 'red') {
  const size = context.canvas.width;
  const scale = size / 1.8;
  const rotate = ([x, y, z]: Vec3): Vec3 => [
    rotation.m11 * x + rotation.m21 * y + rotation.m31 * z,
    rotation.m12 * x + rotation.m22 * y + rotation.m32 * z,
    rotation.m13 * x + rotation.m23 * y + rotation.m33 * z,
  ];
  const visible = ([x, y, z]: Vec3, [nx, ny, nz]: Vec3) => -x * nx - y * ny + (camera - z) * nz > 0;
  function trace(points: Vec3[]) {
    context.beginPath();
    for (const [i, point] of points.entries()) {
      const [x, y, z] = rotate(point);
      const perspective = camera / (camera - z);
      const px = size / 2 + x * scale * perspective;
      const py = size / 2 + y * scale * perspective;
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
  }

  context.clearRect(0, 0, size, size);
  context.lineWidth = 1;
  context.lineJoin = 'round';
  const color = tint === 'blue' ? [44, 152, 244] : [252, 109, 103];
  for (const patch of surface) {
    const normal = rotate(patch.normal);
    if (!visible(rotate(patch.position), normal)) continue;
    const [nx, ny, nz] = normal;
    const light = .72 + .27 * Math.max(0, -.37 * nx - .57 * ny + .73 * nz);
    const shine = 26 * Math.max(0, -.25 * nx - .5 * ny + .83 * nz) ** 8;
    const shade = 'rgb(' + color.map(channel => Math.min(255, Math.round(channel * light + shine))).join(',') + ')';
    trace(patch.points);
    context.strokeStyle = context.fillStyle = shade;
    context.fill();
    context.stroke();
  }

  context.fillStyle = '#fffefa';
  for (const { normal, position, outlines } of dots) {
    if (!visible(rotate(position), rotate(normal))) continue;
    for (const outline of outlines) {
      trace(outline);
      context.fill();
    }
  }
}
