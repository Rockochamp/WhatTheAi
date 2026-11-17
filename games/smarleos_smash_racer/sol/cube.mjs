export const FACES = [
  { id: 'U', name: 'Oben', color: '#f1f5f1', axis: 1, side: 1, grid: [1, 2] },
  { id: 'L', name: 'Links', color: '#fda445', axis: 0, side: -1, grid: [2, 1] },
  { id: 'F', name: 'Vorne', color: '#61e881', axis: 2, side: 1, grid: [2, 2] },
  { id: 'R', name: 'Rechts', color: '#f25361', axis: 0, side: 1, grid: [2, 3] },
  { id: 'B', name: 'Hinten', color: '#4eaafa', axis: 2, side: -1, grid: [2, 4] },
  { id: 'D', name: 'Unten', color: '#fced60', axis: 1, side: -1, grid: [3, 2] },
];
export const MOVES = ['U','F','R'];

export function createCube(size) {
  const extent = size - 1;
  const stickers = [];
  for (const face of FACES) {
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
      const a = col * 2 - extent, b = extent - row * 2;
      const coord = [
        [face.side * extent,b,-a*face.side],
        [a,face.side * extent,-b*face.side],
        [a*face.side,b,face.side * extent],
      ][face.axis];
      const normal = [0,0,0];
      normal[face.axis] = face.side;
      stickers.push({ coord, normal, color: face.id });
    }
  }
  return { extent, size, stickers };
}

export function turn(cube, id, direction) {
  const face = FACES.find(f => f.id === id);
  const first = (face.axis+1)%3, second = (face.axis+2)%3;
  for (const s of cube.stickers) {
    if (s.coord[face.axis] !== face.side * cube.extent) continue;
    for (const vector of [s.coord,s.normal]) {
      const value = vector[first];
      vector[first] = -vector[second] * direction * face.side;
      vector[second] = value * direction * face.side;
    }
  }
}

export function faceColors(cube, face) {
  const list = Array(cube.size ** 2);
  for (const s of cube.stickers) {
    if (s.normal[face.axis] !== face.side) continue;
    const [x,y,z] = s.coord;
    const [a,b] = [[-z*face.side,y],[x,-z*face.side],[x*face.side,y]][face.axis];
    const row = (cube.extent - b) / 2, col = (a + cube.extent) / 2;
    list[row * cube.size + col] = s.color;
  }
  return list;
}

export function solved(cube) {
  return FACES.every(face => new Set(faceColors(cube,face)).size === 1);
}
