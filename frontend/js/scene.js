import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 16);

// ---- lighting ----
scene.add(new THREE.AmbientLight(0x8fa8c9, 0.9));
const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(6, 8, 10);
scene.add(key);
const gold = new THREE.PointLight(0xc9973d, 2.2, 40);
gold.position.set(-8, 4, 6);
scene.add(gold);
const blue = new THREE.PointLight(0x3b6ea5, 1.6, 40);
blue.position.set(8, -4, 4);
scene.add(blue);

// ---- floating "books": thin boxes with a lighter spine face ----
const PALETTE = [0x14314f, 0x1c4166, 0x2c5c8a, 0xc9973d, 0xa67725, 0x3b6ea5];
const books = [];
const bookGroup = new THREE.Group();
scene.add(bookGroup);

function makeBook(color) {
  const w = 0.24 + Math.random() * 0.12;
  const h = 1.5 + Math.random() * 0.9;
  const d = 1.0 + Math.random() * 0.5;
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.25 });
  const spineMat = new THREE.MeshStandardMaterial({ color: 0xf4e7c9, roughness: 0.6, metalness: 0.05 });
  const mats = [mat, mat, mat, mat, spineMat, mat]; // +x -x +y -y +z -z (spine faces +z-ish)
  return new THREE.Mesh(geo, mats);
}

const RADIUS = 8;
const COUNT = 26;
for (let i = 0; i < COUNT; i++) {
  const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
  const book = makeBook(color);
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = RADIUS * (0.55 + Math.random() * 0.7);
  book.position.set(
    r * Math.sin(phi) * Math.cos(theta) * 0.9,
    r * Math.cos(phi) * 0.55,
    r * Math.sin(phi) * Math.sin(theta) * 0.6 - 4
  );
  book.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  book.userData = {
    spin: (Math.random() - 0.5) * 0.006,
    floatSpeed: 0.4 + Math.random() * 0.6,
    floatOffset: Math.random() * Math.PI * 2,
    baseY: book.position.y,
  };
  bookGroup.add(book);
  books.push(book);
}

// ---- soft particle field for depth ----
const particleCount = 260;
const positions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
  positions[i * 3] = (Math.random() - 0.5) * 40;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 26;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 30 - 10;
}
const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
const particleMat = new THREE.PointsMaterial({ color: 0x9fb8d4, size: 0.045, transparent: true, opacity: 0.55 });
scene.add(new THREE.Points(particleGeo, particleMat));

// ---- mouse parallax ----
let mouseX = 0, mouseY = 0;
window.addEventListener("mousemove", (e) => {
  mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  bookGroup.rotation.y = t * 0.045;
  for (const b of books) {
    b.rotation.x += b.userData.spin;
    b.rotation.y += b.userData.spin * 1.4;
    b.position.y = b.userData.baseY + Math.sin(t * b.userData.floatSpeed + b.userData.floatOffset) * 0.35;
  }

  camera.position.x += (mouseX * 1.4 - camera.position.x) * 0.03;
  camera.position.y += (-mouseY * 1.0 - camera.position.y) * 0.03;
  camera.lookAt(0, 0, -4);

  renderer.render(scene, camera);
}
animate();
