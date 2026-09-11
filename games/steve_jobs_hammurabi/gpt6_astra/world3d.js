import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  seededRandom,
  boundedPopulation,
  cameraBounds,
  makeRoadGraph,
  MAX_PEOPLE,
} from "./scene-model.js";

// A live game-state visualization: one animated villager per person. No game RNG
// is consumed here. Instanced actors/fields keep draw calls independent of score.
export function createWorld(canvas, { onContextLost = () => {} } = {}) {
  const random = seededRandom(1128),
    roads = makeRoadGraph();
  const coarse = matchMedia("(pointer: coarse)").matches;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !coarse,
    alpha: false,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.35 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x183847);
  scene.fog = new THREE.FogExp2(0x183847, 0.012);
  const camera = new THREE.OrthographicCamera(-22, 22, 18, -18, 0.1, 150);
  let width = 1,
    height = 1,
    time = 0,
    angle = 0.62,
    zoom = 1,
    cinematic = false,
    motion = true,
    lastFrame = 0,
    phase = null,
    phaseStarted = 0,
    currentState = { pawns: 100, land: 100, food: 4000 },
    cropRatio = 1;
  const target = new THREE.Vector3(0, 1, 0),
    desiredTarget = new THREE.Vector3(0, 1, 0);
  let desiredZoom = 1,
    raf = 0,
    active = false,
    destroyed = false,
    slowFrames = 0;
  scene.add(new THREE.HemisphereLight(0xcde9f3, 0xa47642, 2.0));
  const sun = new THREE.DirectionalLight(0xffdc9e, 3.0);
  sun.position.set(-14, 24, 17);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 512 : 1024, coarse ? 512 : 1024);
  Object.assign(sun.shadow.camera, {
    left: -25,
    right: 25,
    top: 25,
    bottom: -25,
    near: 1,
    far: 70,
  });
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.00025;
  scene.add(sun);
  const material = (color, other = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.84, ...other });
  const m = {
    sand: material(0xb69563),
    edge: material(0x7a674b),
    road: material(0xcbb07e),
    wall: material(0xdebb83),
    stone: material(0xc4a477),
    roof: material(0x936c4a),
    blue: material(0x277c8c),
    gold: material(0xdfab52, { metalness: 0.24, roughness: 0.5 }),
    wood: material(0x614937),
    dark: material(0x493b32),
    green: material(0x3f6c51),
    palm: material(0x557e46),
    earth: material(0x5b553b),
    glass: material(0xffbe57, { emissive: 0xff9d35, emissiveIntensity: 1.2 }),
    cloth: material(0xb8513f, { side: THREE.DoubleSide }),
  };
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 8),
    sphere: new THREE.SphereGeometry(1, 7, 5),
    cone: new THREE.ConeGeometry(1, 1, 6),
  };
  function mesh(geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, parent = scene) {
    const item = new THREE.Mesh(geo, mat);
    item.position.set(x, y, z);
    item.scale.set(sx, sy, sz);
    item.castShadow = true;
    item.receiveShadow = true;
    parent.add(item);
    return item;
  }
  const box = (mat, x, y, z, sx, sy, sz, parent) =>
    mesh(geometries.box, mat, x, y, z, sx, sy, sz, parent);
  box(m.edge, 0, -0.85, 0, 29, 1.3, 24);
  box(m.sand, 0, -0.14, 0, 28.5, 0.4, 23.5);
  // A shallow, animated river around the town, with docks and a gate bridge.
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vWater; uniform float uTime; void main(){vec3 p=position;vWater=p.xy;p.z+=sin(p.x*.5+uTime*.6)*.035+cos(p.y*.8+uTime*.5)*.02;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `varying vec2 vWater;uniform float uTime;void main(){vec2 p=vWater;float wave=sin(p.x*.27+sin(p.y*.31+uTime*.15)*2.+uTime*.18)*cos(p.y*.37-uTime*.12)*.5+.5;float ripple=sin(p.x*.8+sin(p.y*1.5+uTime*.3)*.7+uTime*.45);float glint=pow(max(0.,ripple),28.)*pow(max(0.,sin(p.y*1.9-p.x*.3)),12.);vec3 col=mix(vec3(.045,.19,.23),vec3(.06,.27,.30),wave);col+=glint*.055;gl_FragColor=vec4(col,1.);}`,
  });
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140, 55, 55),
    waterMaterial,
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.75;
  water.receiveShadow = false;
  scene.add(water);
  const paths = [];
  roads.forEach((node, i) =>
    node.neighbors
      .filter((j) => j > i)
      .forEach((j) => {
        const b = roads[j],
          dx = b.x - node.x,
          dz = b.z - node.z;
        box(
          m.road,
          (node.x + b.x) / 2,
          0.08,
          (node.z + b.z) / 2,
          Math.abs(dx) + 0.75,
          0.08,
          Math.abs(dz) + 0.75,
        );
        paths.push([i, j]);
      }),
  );
  // Granular road cobbles are an instanced batch, not one draw call each.
  const cobbles = new THREE.InstancedMesh(geometries.box, m.stone, 240);
  const tmp = new THREE.Object3D();
  for (let i = 0; i < 240; i++) {
    const [a, b] = paths[i % paths.length].map((j) => roads[j]),
      t = random();
    tmp.position.set(
      a.x + (b.x - a.x) * t + (random() - 0.5) * 0.6,
      0.13,
      a.z + (b.z - a.z) * t + (random() - 0.5) * 0.6,
    );
    tmp.scale.set(0.12 + random() * 0.13, 0.015, 0.13);
    tmp.rotation.set(0, random(), 0);
    tmp.updateMatrix();
    cobbles.setMatrixAt(i, tmp.matrix);
  }
  scene.add(cobbles);
  // Stepped sacred terrace, lapis bands, stairway, and the upper sanctuary.
  for (let tier = 0; tier < 4; tier++) {
    const size = 6.7 - tier * 1.3,
      y = 0.45 + tier * 0.74;
    box(tier === 3 ? m.blue : m.wall, 0, y, -4.7, size, 0.74, size * 0.73);
    box(m.gold, 0, y + 0.34, -4.7, size + 0.08, 0.07, size * 0.73 + 0.08);
  }
  box(m.blue, 0, 3.55, -4.7, 2.05, 1.25, 1.4);
  box(m.gold, 0, 4.23, -4.7, 2.4, 0.15, 1.7);
  box(m.dark, 0, 3.4, -3.985, 0.54, 0.92, 0.035);
  for (const x of [-0.85, 0.85])
    for (const z of [-5.3, -4.1])
      mesh(geometries.cylinder, m.gold, x, 3.55, z, 0.095, 1.3, 0.095);
  for (let i = 0; i < 16; i++)
    box(m.stone, 0, 0.1 + i * 0.15, -1.15 - i * 0.19, 1.45, 0.17, 0.28);
  // Courtyard fountain, visible water and an outer stone curb.
  const fountain = mesh(
    geometries.cylinder,
    m.stone,
    0,
    0.19,
    2.1,
    0.94,
    0.3,
    0.94,
  );
  fountain.receiveShadow = true;
  mesh(geometries.cylinder, m.blue, 0, 0.37, 2.1, 0.73, 0.08, 0.73);
  mesh(geometries.cylinder, m.gold, 0, 0.8, 2.1, 0.1, 0.9, 0.1);
  mesh(geometries.sphere, m.glass, 0, 1.3, 2.1, 0.13, 0.13, 0.13);
  const litWindows = [],
    flags = [],
    smokeOrigins = [];
  function house(x, z, size = 1, color = m.wall) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    scene.add(group);
    box(color, 0, 0.73 * size, 0, 2.45 * size, 1.45 * size, 2.0 * size, group);
    box(m.roof, 0, 1.5 * size, 0, 2.6 * size, 0.13, 2.14 * size, group);
    for (const side of [-1, 1]) {
      box(
        color,
        side * 1.22 * size,
        1.72 * size,
        0,
        0.15,
        0.36,
        2.04 * size,
        group,
      );
      box(
        color,
        0,
        1.72 * size,
        side * 0.96 * size,
        2.48 * size,
        0.36,
        0.15,
        group,
      );
    }
    box(
      m.dark,
      -0.42 * size,
      0.5 * size,
      1.013 * size,
      0.47 * size,
      1.0 * size,
      0.035,
      group,
    );
    const light = box(
      m.glass,
      0.58 * size,
      0.9 * size,
      1.02 * size,
      0.37 * size,
      0.43 * size,
      0.04,
      group,
    );
    litWindows.push(light);
    box(m.blue, -0.43 * size, 1.15 * size, 1.24 * size, 0.85, 0.1, 0.47, group);
    mesh(
      geometries.cylinder,
      m.earth,
      0.9 * size,
      0.33 * size,
      1.3 * size,
      0.19,
      0.57,
      0.19,
      group,
    );
    if (size > 0.88) {
      box(
        color,
        0.59 * size,
        1.93 * size,
        -0.46 * size,
        0.45,
        0.78,
        0.45,
        group,
      );
      smokeOrigins.push(
        new THREE.Vector3(x + 0.59 * size, 2.36 * size, z - 0.46 * size),
      );
    }
    return group;
  }
  for (const [x, z, s] of [
    [-7.5, -4.5, 1.1],
    [7.5, -5, 0.9],
    [-7.5, 1.7, 0.87],
    [-2.6, 1.5, 0.85],
    [2.7, 1.3, 0.77],
    [-2.5, 7, 0.63],
    [2.5, 7, 0.7],
    [7.5, 7, 0.72],
    [-12.5, -5, 0.61],
    [12.3, -5, 0.59],
  ])
    house(x, z, s);
  // Granary: storage cylinders and visible food stacks react to the budget.
  const granary = new THREE.Group();
  granary.position.set(11.8, 0.1, 0.9);
  scene.add(granary);
  for (const z of [-0.6, 0.6]) {
    mesh(geometries.cylinder, m.wall, 0, 0.72, z, 0.63, 1.42, 0.63, granary);
    mesh(geometries.cone, m.gold, 0, 1.56, z, 0.7, 0.37, 0.7, granary);
  }
  const sacks = [];
  for (let i = 0; i < 15; i++) {
    const sack = mesh(
      geometries.sphere,
      m.stone,
      10.8 + (i % 3) * 0.26,
      0.2 + Math.floor(i / 9) * 0.24,
      2.2 + Math.floor((i % 9) / 3) * 0.29,
      0.19,
      0.25,
      0.19,
    );
    sacks.push(sack);
  }
  // Two market awnings, a little orchard, and date palms along the banks.
  for (const [x, z, mat] of [
    [-7.4, 7, m.blue],
    [7.4, -9.8, m.cloth],
  ]) {
    for (const dx of [-1, 1])
      for (const dz of [-0.5, 0.5])
        box(m.wood, x + dx, 0.7, z + dz, 0.065, 1.4, 0.065);
    const awning = box(mat, x, 1.46, z, 2.5, 0.13, 1.4);
    awning.rotation.z = 0.05;
    box(m.wood, x, 0.48, z, 1.9, 0.1, 0.6);
    for (let i = 0; i < 6; i++)
      mesh(
        geometries.sphere,
        i % 2 ? m.gold : m.green,
        x - 0.8 + i * 0.3,
        0.6,
        z,
        0.12,
        0.12,
        0.12,
      );
  }
  function palm(x, z, scale = 1) {
    const trunk = mesh(
      geometries.cylinder,
      m.wood,
      x,
      1.1 * scale,
      z,
      0.1 * scale,
      2.2 * scale,
      0.1 * scale,
    );
    trunk.rotation.z = 0.12;
    for (let i = 0; i < 7; i++) {
      const leaf = mesh(
        geometries.cone,
        m.palm,
        x + Math.sin(i * 0.9) * 0.42 * scale,
        2.25 * scale,
        z + Math.cos(i * 0.9) * 0.42 * scale,
        0.18 * scale,
        1.7 * scale,
        0.1 * scale,
      );
      leaf.rotation.set(Math.cos(i * 0.9) * 1.1, 0, Math.sin(i * 0.9) * 1.1);
    }
  }
  for (const [x, z, s] of [
    [-12.7, 8, 1],
    [-12.8, 1, 1.15],
    [12.8, 8, 1.1],
    [-11.8, -10, 0.95],
    [5, -10, 1.1],
    [11, -10, 0.9],
    [3.7, 2.7, 0.65],
  ])
    palm(x, z, s);
  for (const x of [-2, 2]) {
    box(m.wood, x, 3.0, -4.7, 0.045, 2.2, 0.045);
    const flag = mesh(
      new THREE.PlaneGeometry(0.65, 0.4, 6, 1),
      new THREE.MeshStandardMaterial({
        color: x < 0 ? 0x1e8498 : 0xdba14b,
        side: THREE.DoubleSide,
      }),
      x + 0.31,
      3.8,
      -4.7,
    );
    flags.push(flag);
  }
  // The arrival gate is intentionally unobstructed, so new people are readable.
  for (const x of [-11, -9]) {
    box(m.wall, x, 1.2, 10.3, 0.65, 2.4, 0.8);
    box(m.gold, x, 2.47, 10.3, 0.77, 0.15, 0.92);
  }
  box(m.blue, -10, 2.33, 10.3, 1.9, 0.36, 0.7);
  box(m.wood, -10, -0.22, 13, 2.4, 0.27, 5.3);
  for (let z = 10.6; z < 15.6; z += 0.35)
    box(m.stone, -10, -0.065, z, 2.28, 0.045, 0.08);
  const boat = new THREE.Group();
  boat.position.set(16, -0.48, 4);
  scene.add(boat);
  const hull = box(m.wood, 0, 0, 0, 1.1, 0.32, 3.1, boat);
  hull.rotation.y = 0.05;
  box(m.wood, 0, 1.1, 0, 0.07, 2.2, 0.07, boat);
  const sail = mesh(
    new THREE.PlaneGeometry(1.2, 1.5),
    new THREE.MeshStandardMaterial({ color: 0xf2e4bc, side: THREE.DoubleSide }),
    0.55,
    1.2,
    0,
    1,
    1,
    1,
    boat,
  );
  sail.rotation.y = 0.3;
  // Living wheat. Per-instance scales animate harvest without rebuilding meshes.
  const wheatGeometry = new THREE.ConeGeometry(0.045, 0.52, 3);
  const wheatMaterial = material(0xc8b051);
  const wheat = new THREE.InstancedMesh(wheatGeometry, wheatMaterial, 384),
    stalks = [];
  wheat.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  wheat.frustumCulled = false;
  for (const [x, z] of [
    [7.45, 1.85],
    [-12.25, -1.7],
  ]) {
    box(m.earth, x, 0.065, z, 3.1, 0.07, 3.6);
    for (let row = 0; row < 16; row++)
      for (let col = 0; col < 12; col++)
        stalks.push({
          x: x - 1.4 + col * 0.25,
          z: z - 1.65 + row * 0.22,
          seed: random(),
        });
  }
  scene.add(wheat);
  // Batch the architecture by material. Hundreds of little building pieces
  // become a handful of static draw calls; animated/visible state stays separate.
  const dynamic = new Set([water, ...flags, ...litWindows, ...sacks]);
  boat.traverse((object) => dynamic.add(object));
  const batches = new Map(),
    staticMeshes = [];
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (object.isMesh && !object.isInstancedMesh && !dynamic.has(object))
      staticMeshes.push(object);
  });
  for (const object of staticMeshes) {
    const key = object.material;
    if (!batches.has(key)) batches.set(key, []);
    batches
      .get(key)
      .push(object.geometry.clone().applyMatrix4(object.matrixWorld));
    object.removeFromParent();
  }
  for (const [mat, parts] of batches) {
    const merged = new THREE.Mesh(mergeGeometries(parts), mat);
    merged.castShadow = true;
    merged.receiveShadow = true;
    scene.add(merged);
    parts.forEach((geometry) => geometry.dispose());
  }
  const peopleMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
  });
  const heads = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.105, 7, 5),
    peopleMaterial,
    MAX_PEOPLE,
  );
  const bodies = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.105, 0.16, 0.34, 6),
    peopleMaterial,
    MAX_PEOPLE,
  );
  const limbs = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.065, 0.25, 0.075),
    peopleMaterial,
    MAX_PEOPLE * 4,
  );
  const shadows = new THREE.InstancedMesh(
    new THREE.CircleGeometry(0.21, 7),
    new THREE.MeshBasicMaterial({
      color: 0x18323b,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    }),
    MAX_PEOPLE,
  );
  for (const batch of [heads, bodies, limbs, shadows]) {
    batch.frustumCulled = false;
    batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(batch);
  }
  const colors = [0xe6dac2, 0x247b8d, 0xb84d3f, 0xc49c56, 0x72866a, 0xdec29b];
  const skin = new THREE.Color(0xbb8862),
    color = new THREE.Color();
  let agents = [],
    nextId = 0;
  function villager(arriving = false) {
    const node = Math.floor(random() * roads.length),
      destination = roads[node];
    return {
      id: nextId++,
      x: arriving
        ? -10 + (random() - 0.5) * 0.8
        : destination.x + (random() - 0.5) * 0.5,
      z: arriving
        ? 12.5 + random() * 2
        : destination.z + (random() - 0.5) * 0.5,
      node: arriving ? 15 : node,
      target: arriving
        ? 15
        : destination.neighbors[
            Math.floor(random() * destination.neighbors.length)
          ],
      speed: 0.62 + random() * 0.52,
      stride: random() * 6.28,
      color: colors[Math.floor(random() * colors.length)],
      status: arriving ? "arriving" : "living",
      since: time,
      delay: arriving ? random() * 0.7 : 0,
    };
  }
  function setPopulation(count) {
    count = boundedPopulation(count);
    agents = agents.filter(
      (p) => p.status !== "dead" && p.status !== "departing",
    );
    while (agents.length < count) agents.push(villager());
    agents.length = count;
  }
  // Soft ambient chimney smoke and effect particles share one cheap point batch.
  const particleGeometry = new THREE.BufferGeometry(),
    particlePositions = new Float32Array(160 * 3),
    particleColors = new Float32Array(160 * 3);
  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(particlePositions, 3),
  );
  particleGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(particleColors, 3),
  );
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  particles.frustumCulled = false;
  scene.add(particles);
  function pose(
    batch,
    index,
    x,
    y,
    z,
    sx = 1,
    sy = 1,
    sz = 1,
    ry = 0,
    rx = 0,
    rz = 0,
  ) {
    tmp.position.set(x, y, z);
    tmp.scale.set(sx, sy, sz);
    tmp.rotation.set(rx, ry, rz);
    tmp.updateMatrix();
    batch.setMatrixAt(index, tmp.matrix);
  }
  function updatePeople(dt) {
    let index = 0;
    for (const p of agents) {
      const age = time - p.since;
      let scale = 1,
        tilt = 0;
      if (p.status === "dead") {
        const progress = THREE.MathUtils.clamp((age - 0.4) / 1.7, 0, 1);
        scale = Math.max(0.001, 1 - progress);
        tilt = progress * 1.4;
      } else if (motion) {
        let destination = roads[p.target];
        if (p.status === "departing") destination = { x: -10, z: 15.2 };
        let dx = destination.x - p.x,
          dz = destination.z - p.z,
          distance = Math.hypot(dx, dz),
          speed =
            p.status === "arriving"
              ? 2.8
              : p.status === "departing"
                ? 2.8
                : p.speed;
        if (age >= p.delay) {
          const step = Math.min(distance, speed * dt);
          p.x += (dx / Math.max(0.001, distance)) * step;
          p.z += (dz / Math.max(0.001, distance)) * step;
          p.angle = Math.atan2(dx, dz);
          p.stride += step * 11;
        }
        if (distance < 0.15 && p.status !== "departing") {
          p.node = p.target;
          const choices = roads[p.node].neighbors;
          p.target = choices[Math.floor(random() * choices.length)];
          if (p.status === "arriving" && age > 1) p.status = "living";
        }
        if (p.status === "departing") scale = Math.max(0.001, 1 - age / 2.0);
      }
      const walk = motion ? Math.sin(p.stride) * 0.43 : 0,
        bob = motion ? Math.abs(Math.sin(p.stride)) * 0.023 : 0,
        bodyY = 0.44 + bob;
      color.set(
        p.status === "arriving"
          ? 0xa7e5b2
          : p.status === "dead"
            ? 0xb3aabc
            : p.color,
      );
      pose(
        bodies,
        index,
        p.x,
        bodyY * scale,
        p.z,
        scale,
        scale,
        scale,
        p.angle || 0,
        tilt,
      );
      bodies.setColorAt(index, color);
      pose(heads, index, p.x, 0.735 * scale + bob, p.z, scale, scale, scale);
      heads.setColorAt(index, p.status === "dead" ? color : skin);
      const ca = Math.cos(p.angle || 0),
        sa = Math.sin(p.angle || 0);
      for (let side = 0; side < 2; side++) {
        const sign = side ? 1 : -1,
          lx = ca * 0.073 * sign,
          lz = -sa * 0.073 * sign;
        pose(
          limbs,
          index * 4 + side,
          p.x + lx,
          0.18 * scale,
          p.z + lz,
          scale,
          scale,
          scale,
          p.angle || 0,
          walk * sign,
        );
        limbs.setColorAt(index * 4 + side, skin);
        pose(
          limbs,
          index * 4 + 2 + side,
          p.x + lx * 2,
          0.43 * scale,
          p.z + lz * 2,
          scale,
          scale,
          scale,
          p.angle || 0,
          -walk * sign,
        );
        limbs.setColorAt(index * 4 + 2 + side, color);
      }
      pose(
        shadows,
        index,
        p.x,
        0.155,
        p.z,
        scale,
        scale,
        scale,
        0,
        -Math.PI / 2,
      );
      index++;
    }
    heads.count = bodies.count = shadows.count = index;
    limbs.count = index * 4;
    for (const batch of [heads, bodies, limbs, shadows]) {
      batch.instanceMatrix.needsUpdate = true;
      if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
    }
  }
  function updateEffects() {
    const age = time - phaseStarted,
      harvesting = phase?.kind === "harvest" || phase?.kind === "bonus";
    for (let i = 0; i < stalks.length; i++) {
      const p = stalks[i],
        cut = harvesting
          ? THREE.MathUtils.clamp((age * 3 - (p.z + 2)) / 3, 0, 1)
          : 0;
      const growth = Math.max(0.03, cropRatio * (1 - cut * 0.8));
      pose(
        wheat,
        i,
        p.x,
        0.16 + growth * 0.24,
        p.z,
        1,
        growth,
        1,
        0,
        Math.sin(time * 1.7 + p.seed * 10) * 0.06,
      );
    }
    wheat.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 160; i++) {
      const group = i % Math.max(1, smokeOrigins.length),
        source = smokeOrigins[group] || new THREE.Vector3(0, 3, -4),
        cycle = (time * 0.16 + i * 0.079) % 1;
      let x = source.x + Math.sin(i + time * 0.3) * cycle * 0.45,
        y = source.y + cycle * 1.9,
        z = source.z + cycle * 0.35,
        c = 0x9b9e97;
      if (i > 55 && phase && phase.kind !== "settled") {
        if (harvesting) {
          x = 7 + (i % 10) * 0.17;
          y = 0.2 + ((time * 0.65 + i * 0.071) % 1) * 2;
          z = -0.1 + Math.floor(i / 10) * 0.27;
          c = 0xf1c66c;
        } else if (["plague", "starvation"].includes(phase.kind)) {
          x = desiredTarget.x + Math.sin(i * 4.3) * 2.2;
          y = 0.3 + ((time * 0.45 + i * 0.069) % 1) * 3;
          z = desiredTarget.z + Math.cos(i * 6.1) * 2;
          c = phase.kind === "plague" ? 0xbc9ec8 : 0xd7ccb9;
        } else if (phase.kind === "arrivals") {
          x = -10 + Math.sin(i * 3.9) * 0.9;
          y = ((time * 0.55 + i * 0.033) % 1) * 1.8;
          z = 10.2 + Math.cos(i * 4.3) * 1.8;
          c = 0xb9efbb;
        } else if (phase.kind === "rats") {
          x = 10.5 + Math.sin(i * 3 + time * 6) * 1.1;
          y = 0.18;
          z = 1.3 + Math.cos(i * 4 + time * 7) * 1.2;
          c = 0x40372b;
        } else y = -10;
      } else if (i > 55 || currentState.pawns === 0) y = -10;
      particlePositions.set([x, y, z], i * 3);
      color.set(c);
      particleColors.set([color.r, color.g, color.b], i * 3);
    }
    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.color.needsUpdate = true;
    for (const flag of flags) {
      const pos = flag.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++)
        pos.setZ(i, Math.sin(time * 3 + pos.getX(i) * 6) * 0.075);
      pos.needsUpdate = true;
    }
    boat.position.z = 4 + Math.sin(time * 0.05) * 8;
    boat.rotation.y = Math.sin(time * 0.05) * 0.2;
    boat.rotation.z = Math.sin(time * 1.2) * 0.04;
    boat.position.y = -0.5 + Math.sin(time * 0.9) * 0.035;
    waterMaterial.uniforms.uTime.value = time;
  }
  function updateCamera(dt) {
    const k = cinematic && motion ? Math.min(1, dt * 2.6) : 1;
    target.lerp(desiredTarget, k);
    zoom += (desiredZoom - zoom) * k;
    const bounds = cameraBounds(width, height, zoom);
    Object.assign(camera, bounds);
    camera.position.set(
      target.x + Math.sin(angle) * 34,
      29,
      target.z + Math.cos(angle) * 34,
    );
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }
  function draw(dt = 0) {
    updateCamera(dt);
    updatePeople(dt);
    updateEffects();
    renderer.render(scene, camera);
  }
  function loop(now) {
    raf = 0;
    if (!active || destroyed || document.hidden) return;
    const elapsed = lastFrame ? (now - lastFrame) / 1000 : 0;
    lastFrame = now;
    const dt = Math.min(0.05, elapsed);
    if (motion) time += dt;
    if (elapsed > 0.045 && elapsed < 0.2) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 45 && renderer.getPixelRatio() > 1) {
      renderer.setPixelRatio(1);
      resize();
      slowFrames = 0;
    }
    draw(dt);
    if (motion) raf = requestAnimationFrame(loop);
  }
  function wake() {
    if (active && !destroyed && !document.hidden && !raf) {
      lastFrame = 0;
      raf = requestAnimationFrame(loop);
    }
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    width = r.width;
    height = r.height;
    renderer.setSize(width, height, false);
    draw();
    wake();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const intersection = new IntersectionObserver(
    (entries) => {
      active = entries[0].isIntersecting;
      if (active) wake();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    { rootMargin: "40px" },
  );
  intersection.observe(canvas);
  const visibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
      lastFrame = 0;
    } else wake();
  };
  document.addEventListener("visibilitychange", visibility);
  const lost = (event) => {
    event.preventDefault();
    cancelAnimationFrame(raf);
    raf = 0;
    onContextLost();
  };
  canvas.addEventListener("webglcontextlost", lost);
  let drag = null;
  const down = (event) => {
    if (cinematic || event.button > 0) return;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      angle,
      claimed: false,
    };
  };
  const move = (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y;
    if (!drag.claimed) {
      if (Math.abs(dy) > Math.abs(dx) + 6) {
        drag = null;
        return;
      }
      if (Math.abs(dx) < 7) return;
      drag.claimed = true;
      canvas.setPointerCapture(event.pointerId);
    }
    angle = drag.angle - dx * 0.008;
    draw();
    wake();
  };
  const up = () => {
    drag = null;
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  function control(action) {
    if (cinematic) return;
    if (action === "left") angle -= 0.28;
    if (action === "right") angle += 0.28;
    if (action === "in") desiredZoom = Math.min(2.4, desiredZoom + 0.25);
    if (action === "out") desiredZoom = Math.max(0.85, desiredZoom - 0.25);
    if (action === "reset") {
      angle = 0.62;
      desiredZoom = 1;
      desiredTarget.set(0, 1, 0);
    }
    draw();
    wake();
  }
  const keydown = (event) => {
    const action = {
      ArrowLeft: "left",
      ArrowRight: "right",
      "+": "in",
      "=": "in",
      "-": "out",
      Home: "reset",
    }[event.key];
    if (action) {
      event.preventDefault();
      control(action);
    }
  };
  canvas.addEventListener("keydown", keydown);
  function setState(state) {
    currentState = { ...state };
    setPopulation(state.pawns);
    phase = null;
    desiredTarget.set(0, 1, 0);
    desiredZoom = 1;
    cinematic = false;
    litWindows.forEach((w, i) => (w.visible = i < Math.ceil(state.pawns / 10)));
    sacks.forEach(
      (s, i) =>
        (s.visible =
          i < Math.ceil(Math.min(1, state.food / 4000) * sacks.length)),
    );
    renderer.shadowMap.needsUpdate = true;
    resize();
  }
  function showPhase(nextPhase) {
    // Remove only visual actors from the preceding phase, then match the actual
    // previous count. Simultaneous arrivals and losses remain separate events.
    agents = agents.filter(
      (p) => p.status !== "dead" && p.status !== "departing",
    );
    phase = nextPhase;
    phaseStarted = time;
    cinematic = true;
    if (nextPhase.kind === "arrivals") {
      while (agents.length < boundedPopulation(nextPhase.people))
        agents.push(villager(true));
      desiredTarget.set(-8.8, 1, 8.8);
      desiredZoom = 1.7;
    } else if (
      ["starvation", "plague", "emigration"].includes(nextPhase.kind)
    ) {
      const count = Math.max(
        0,
        agents.length - boundedPopulation(nextPhase.people),
      );
      const ordered = agents
        .slice()
        .sort((a, b) => Math.hypot(a.x, a.z - 5) - Math.hypot(b.x, b.z - 5));
      for (const p of ordered.slice(0, count)) {
        p.status = nextPhase.kind === "emigration" ? "departing" : "dead";
        p.since = time;
      }
      desiredTarget.set(ordered[0]?.x || 0, 0.8, ordered[0]?.z || 5);
      desiredZoom = 1.7;
    } else if (["harvest", "bonus"].includes(nextPhase.kind)) {
      desiredTarget.set(5.5, 0.5, 1.7);
      desiredZoom = 1.35;
    } else if (nextPhase.kind === "rats") {
      desiredTarget.set(10, 1, 1);
      desiredZoom = 1.7;
    } else {
      setPopulation(nextPhase.people);
      desiredTarget.set(0, 1, 0);
      desiredZoom = 1;
    }
    if (height < 260 && nextPhase.kind !== "settled") desiredZoom = 2.4;
    else if (width < height && nextPhase.kind !== "settled")
      desiredZoom = Math.min(2.4, desiredZoom * 1.4);
    currentState = {
      ...currentState,
      pawns: nextPhase.people,
      food: nextPhase.food,
      land: nextPhase.land,
    };
    sacks.forEach(
      (s, i) =>
        (s.visible =
          i < Math.ceil(Math.min(1, nextPhase.food / 4000) * sacks.length)),
    );
    wake();
  }
  setState(currentState);
  resize();
  return {
    setState,
    showPhase,
    control,
    resize,
    setPlan(plan) {
      cropRatio = Math.max(
        0,
        Math.min(1, (plan.plant || 0) / Math.max(1, currentState.land)),
      );
      if (!motion) draw();
    },
    setMotion(value) {
      motion = value;
      cancelAnimationFrame(raf);
      raf = 0;
      if (motion) wake();
      else draw();
    },
    dispose() {
      destroyed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("keydown", keydown);
      scene.traverse((object) => {
        object.geometry?.dispose();
        if (object.material) {
          for (const mat of Array.isArray(object.material)
            ? object.material
            : [object.material])
            mat.dispose();
        }
      });
      renderer.dispose();
    },
  };
}
