// A literal 4D graphic: a tesseract (4-dimensional hypercube) rotated in two
// independent 4D planes, projected 4D -> 3D each frame, then rendered by
// Three.js's normal 3D -> 2D camera. Mount into any <canvas id="..."> with
// initTesseract(canvasId, { fill: true }).
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

// ---- the 16 vertices of a tesseract: every combination of +-1 in 4D ----
function buildVertices4D() {
  const verts = [];
  for (let i = 0; i < 16; i++) {
    verts.push([
      (i & 1) ? 1 : -1,
      (i & 2) ? 1 : -1,
      (i & 4) ? 1 : -1,
      (i & 8) ? 1 : -1,
    ]);
  }
  return verts;
}

// ---- the 32 edges: vertices differing in exactly one coordinate ----
function buildEdges(verts) {
  const edges = [];
  for (let a = 0; a < verts.length; a++) {
    for (let b = a + 1; b < verts.length; b++) {
      let diff = 0;
      for (let k = 0; k < 4; k++) if (verts[a][k] !== verts[b][k]) diff++;
      if (diff === 1) edges.push([a, b]);
    }
  }
  return edges;
}

function rotate4D(p, angleXW, angleYZ, angleXY) {
  let [x, y, z, w] = p;
  // XW plane
  let x1 = x * Math.cos(angleXW) - w * Math.sin(angleXW);
  let w1 = x * Math.sin(angleXW) + w * Math.cos(angleXW);
  // YZ plane
  let y1 = y * Math.cos(angleYZ) - z * Math.sin(angleYZ);
  let z1 = y * Math.sin(angleYZ) + z * Math.cos(angleYZ);
  // XY plane (extra tumble so it never looks static)
  let x2 = x1 * Math.cos(angleXY) - y1 * Math.sin(angleXY);
  let y2 = x1 * Math.sin(angleXY) + y1 * Math.cos(angleXY);
  return [x2, y2, z1, w1];
}

function project4Dto3D(p, wDistance = 2.4) {
  const [x, y, z, w] = p;
  const scale = 1 / (wDistance - w);
  return [x * scale, y * scale, z * scale];
}

export function initTesseract(canvasId, opts = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const container = canvas.parentElement;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  scene.add(new THREE.AmbientLight(0x8fa8c9, 0.7));
  const gold = new THREE.PointLight(0xe8c88a, 3, 30);
  gold.position.set(4, 3, 5);
  scene.add(gold);
  const blue = new THREE.PointLight(0x3b6ea5, 2.2, 30);
  blue.position.set(-4, -2, 4);
  scene.add(blue);

  const verts4D = buildVertices4D();
  const edges = buildEdges(verts4D);

  const positions = new Float32Array(edges.length * 2 * 3);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0xe8c88a, transparent: true, opacity: 0.85 });
  const wireframe = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(wireframe);

  // small glowing spheres at each vertex for a "data points" feel
  const vertexGroup = new THREE.Group();
  const sphereGeo = new THREE.SphereGeometry(0.045, 12, 12);
  const sphereMat = new THREE.MeshStandardMaterial({ color: 0x7fc8f0, emissive: 0x2c5c8a, emissiveIntensity: 0.9 });
  const spheres = verts4D.map(() => {
    const s = new THREE.Mesh(sphereGeo, sphereMat);
    vertexGroup.add(s);
    return s;
  });
  scene.add(vertexGroup);

  function resize() {
    const w = container.clientWidth || 300;
    const h = opts.fill ? container.clientHeight : w;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  let rafId = null;
  let stopped = false;
  const clock = new THREE.Clock();
  function animate() {
    if (stopped) return;
    rafId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    const projected = verts4D.map(v => project4Dto3D(rotate4D(v, t * 0.35, t * 0.22, t * 0.13)));

    let p = 0;
    for (const [a, b] of edges) {
      positions[p++] = projected[a][0] * 1.6; positions[p++] = projected[a][1] * 1.6; positions[p++] = projected[a][2] * 1.6;
      positions[p++] = projected[b][0] * 1.6; positions[p++] = projected[b][1] * 1.6; positions[p++] = projected[b][2] * 1.6;
    }
    lineGeo.attributes.position.needsUpdate = true;

    projected.forEach((v, i) => spheres[i].position.set(v[0] * 1.6, v[1] * 1.6, v[2] * 1.6));

    wireframe.rotation.y = Math.sin(t * 0.1) * 0.15;
    vertexGroup.rotation.y = wireframe.rotation.y;

    renderer.render(scene, camera);
  }
  animate();

  function stop() {
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener("resize", resize);
    renderer.dispose();
    lineGeo.dispose();
    sphereGeo.dispose();
  }

  return { renderer, scene, camera, stop };
}
