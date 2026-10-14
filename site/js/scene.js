/* ════════════════════════════════════════════════════════════════
   POWERBANK — real-time 3D scene
   Procedural power-bank model · scroll-driven exploded view
   drag-to-rotate · cinematic studio lighting
   ════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ───────────── Product dimensions (ratio-scaled) ───────────── */
const W = 8.6;   // width  (x)
const H = 4.6;   // height (y)
const D = 1.7;   // depth  (z)
const R = 0.34;  // corner radius

function rb(w, h, d, r, seg) {
  return new RoundedBoxGeometry(w, h, d, seg || 4, r);
}

/* ───────────── Textures (procedural) ───────────── */

function makeDisplayTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#06080a';
  g.fillRect(0, 0, 256, 128);
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0.045)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#e9edf1';
  g.font = '700 72px system-ui, sans-serif';
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  g.fillText('87%', 226, 66);
  g.font = '600 26px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillStyle = 'rgba(233,237,241,0.7)';
  g.fillText('READY', 180, 104);
  const bat = (x, y) => {
    g.fillStyle = 'rgba(233,237,241,0.9)';
    g.fillRect(x, y, 34, 18);
    g.clearRect(x + 2, y + 2, 30, 14);
    g.fillStyle = '#e9edf1';
    g.fillRect(x + 3, y + 3, 26, 12);
    g.fillRect(x + 36, y + 5, 4, 8);
  };
  bat(36, 92);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBraidTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#101014';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(255,255,255,0.10)';
  g.lineWidth = 5;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.stroke();
  g.beginPath(); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.05)';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 22); g.lineTo(64, 86); g.stroke();
  g.beginPath(); g.moveTo(0, 46); g.lineTo(64, 110); g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 2);
  return tex;
}

function makeSoftGlowTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(244,122,50,0.16)');
  grad.addColorStop(0.55, 'rgba(244,122,50,0.05)');
  grad.addColorStop(1, 'rgba(244,122,50,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ───────────── Materials ───────────── */

function makeMaterials() {
  return {
    orange: new THREE.MeshPhysicalMaterial({
      color: 0xf47a32, metalness: 0.05, roughness: 0.42,
      clearcoat: 0.6, clearcoatRoughness: 0.35,
    }),
    orangeHi: new THREE.MeshPhysicalMaterial({
      color: 0xff9a52, metalness: 0.05, roughness: 0.35,
      clearcoat: 0.7, clearcoatRoughness: 0.3,
    }),
    panel: new THREE.MeshPhysicalMaterial({
      color: 0x0f1013, metalness: 0.15, roughness: 0.14,
      clearcoat: 1, clearcoatRoughness: 0.05,
    }),
    board: new THREE.MeshPhysicalMaterial({
      color: 0x0b1a12, metalness: 0.25, roughness: 0.55,
    }),
    chip: new THREE.MeshStandardMaterial({
      color: 0x1d1e24, metalness: 0.35, roughness: 0.4,
    }),
    metal: new THREE.MeshPhysicalMaterial({
      color: 0xb9c1c9, metalness: 0.95, roughness: 0.28,
    }),
    metalDark: new THREE.MeshPhysicalMaterial({
      color: 0x5a6067, metalness: 0.9, roughness: 0.45,
    }),
    cell: new THREE.MeshPhysicalMaterial({
      color: 0x24272c, metalness: 0.55, roughness: 0.5,
    }),
    buttonLed: new THREE.MeshStandardMaterial({
      color: 0xff9a52, emissive: 0xff7a26, emissiveIntensity: 1.4,
    }),
  };
}

function makeDisplayMaterial(lcdTex) {
  return new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    emissiveMap: lcdTex,
    emissiveIntensity: 0.6,
    roughness: 0.2,
  });
}

/* ───────────── Model ───────────── */

function buildProduct(mat) {
  const group = new THREE.Group();

  const backShell = new THREE.Mesh(rb(W, H, D * 0.5, R), mat.orange);
  backShell.position.z = -D * 0.25;

  const logoPlate = new THREE.Mesh(rb(0.85, 0.26, 0.03, 0.03), mat.metalDark);
  logoPlate.position.set(0, 0, -D * 0.5 - 0.015);
  backShell.add(logoPlate);

  const frontShell = new THREE.Mesh(rb(W, H, D * 0.5, R), mat.orangeHi);
  frontShell.position.z = D * 0.25;

  const frontPanel = new THREE.Group();
  const panelMesh = new THREE.Mesh(rb(5.5, 3.3, 0.14, 0.05), mat.panel);
  panelMesh.position.z = 0.06;
  frontPanel.add(panelMesh);

  const display = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 1.85), mat.lcd);
  display.position.set(0.35, 0.25, 0.145);
  frontPanel.add(display);

  const button = new THREE.Group();
  const btnRing = new THREE.Mesh(rb(0.62, 0.62, 0.1, 0.06), mat.metalDark);
  button.add(btnRing);
  const btnLed = new THREE.Mesh(new THREE.CircleGeometry(0.14, 32), mat.buttonLed);
  btnLed.position.z = 0.06;
  button.add(btnLed);
  button.position.set(-2.05, -1.1, 0.145);
  frontPanel.add(button);

  frontPanel.position.z = D * 0.5 + 0.05;

  const battery = new THREE.Group();
  const cell1 = new THREE.Mesh(rb(3.3, 2.1, 0.26, 0.06), mat.cell);
  cell1.position.y = 0.35;
  const cell2 = new THREE.Mesh(rb(3.3, 2.1, 0.26, 0.06), mat.cell);
  cell2.position.y = -0.55;
  battery.add(cell1, cell2);
  battery.position.z = -0.38;

  const pcb = new THREE.Group();
  const board = new THREE.Mesh(rb(6.6, 3.6, 0.09, 0.02), mat.board);
  pcb.add(board);
  const addChip = (x, y, w, h) => {
    const c = new THREE.Mesh(rb(w, h, 0.14, 0.02), mat.chip);
    c.position.set(x, y, 0.1);
    pcb.add(c);
  };
  const addCap = (x, y, r, h) => {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), mat.metalDark);
    cap.position.set(x, y, 0.05 + h / 2);
    pcb.add(cap);
  };
  const addCoil = (x, y) => {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 16, 32), mat.metal);
    coil.rotation.x = Math.PI / 2;
    coil.position.set(x, y, 0.1);
    pcb.add(coil);
  };
  addChip(-1.5, 0.85, 1.15, 1.15);
  addChip(1.15, 0.7, 0.8, 0.8);
  addCoil(1.35, -0.85);
  addCap(-0.9, -1.05, 0.1, 0.28);
  addCap(-0.45, -1.05, 0.1, 0.28);
  pcb.position.z = 0.06;

  const port = new THREE.Mesh(rb(0.5, 0.95, 0.55, 0.05), mat.metal);
  port.position.set(W * 0.5 - 0.05, -0.6, 0.15);
  const portSlot = new THREE.Mesh(rb(0.34, 0.72, 0.4, 0.03), mat.metalDark);
  portSlot.position.set(W * 0.5 + 0.2, -0.6, 0.15);
  port.rotation.y = Math.PI / 2;
  portSlot.rotation.y = Math.PI / 2;

  const cable = buildCable(mat);
  cable.position.set(0, 0, 0);

  const standoffs = new THREE.Group();
  const soMat = mat.metalDark;
  const so = (x, y) => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.55, 16), soMat);
    s.position.set(x, y, 0);
    standoffs.add(s);
  };
  so(-2.7, 1.4); so(2.7, 1.4); so(-2.7, -1.4); so(2.7, -1.4);

  group.add(backShell, frontShell, frontPanel, battery, pcb, port, portSlot, cable, standoffs);

  const parts = [
    { g: backShell,  base: new THREE.Vector3(0, 0, -D * 0.25), off: new THREE.Vector3(0, 0, -1.15), t0: 0.05, t1: 0.55, rx: -0.10 },
    { g: frontShell, base: new THREE.Vector3(0, 0, D * 0.25), off: new THREE.Vector3(0, 0, 1.2),   t0: 0.05, t1: 0.55, rx: 0.16 },
    { g: frontPanel, base: new THREE.Vector3(0, 0, D * 0.5 + 0.05), off: new THREE.Vector3(0, 0, 0.95), t0: 0.12, t1: 0.62 },
    { g: battery,    base: new THREE.Vector3(0, -0.1, -0.38), off: new THREE.Vector3(0, -0.9, -0.7), t0: 0.34, t1: 0.78, rx: -0.12 },
    { g: pcb,        base: new THREE.Vector3(0, 0.2, 0.06),   off: new THREE.Vector3(0, 0.95, 0.5), t0: 0.28, t1: 0.74, rz: 0.04 },
    { g: port,       base: port.position.clone(),             off: new THREE.Vector3(1.1, 0, 0),    t0: 0.42, t1: 0.82 },
    { g: portSlot,   base: portSlot.position.clone(),         off: new THREE.Vector3(1.1, 0, 0),    t0: 0.42, t1: 0.82 },
    { g: cable,      base: new THREE.Vector3(0, 0, 0),        off: new THREE.Vector3(0.9, -0.35, 0.5), t0: 0.48, t1: 0.88 },
    { g: standoffs,  base: new THREE.Vector3(0, 0, 0),        off: new THREE.Vector3(0, 0, -0.55),  t0: 0.40, t1: 0.78 },
  ];

  return { group, parts };
}

function buildCable(mat) {
  const group = new THREE.Group();
  const exitX = W * 0.5 + 0.05;
  const pts = [
    new THREE.Vector3(exitX, -0.95, 0.1),
    new THREE.Vector3(exitX + 1.1, -1.55, 0.3),
    new THREE.Vector3(exitX + 2.2, -1.2, 0.7),
    new THREE.Vector3(exitX + 3.05, -0.72, 1.05),
  ];
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 48, 0.12, 12, false),
    mat.cable
  );
  group.add(tube);

  const conn = new THREE.Group();
  const body = new THREE.Mesh(rb(0.85, 0.3, 0.42, 0.05), mat.metal);
  conn.add(body);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.35, 16), mat.metalDark);
  collar.rotation.x = Math.PI / 2;
  conn.add(collar);
  conn.position.copy(pts[3]);
  const dir = new THREE.Vector3().subVectors(pts[3], pts[2]).normalize();
  conn.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
  group.add(conn);

  return group;
}

/* ───────────── Scene core ───────────── */

export const PowerScene = (() => {
  let renderer = null;
  let scene = null;
  let camera = null;
  let product = null;
  let parts = [];
  let canvas = null;
  let glow = null;

  let explode = 0;
  let explodeTarget = 0;
  let yaw = 0.4;
  let pitch = 0.16;
  let yawV = 0;
  let pitchV = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastMove = 0;
  let lastFrame = performance.now();

  let ready = false;
  let readyCb = null;
  let interiorLight = null;

  function resize() {
    if (!renderer) return;
    const r = renderer.domElement.getBoundingClientRect();
    const vw = r.width > 0 ? r.width : window.innerWidth;
    const vh = window.innerHeight;
    const s = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4.2e6 / (vw * vh)));
    renderer.setPixelRatio(Math.max(1, s));
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
  }

  function explodeCurve(p) {
    if (p < 0.14) return 0;
    if (p < 0.55) return (p - 0.14) / 0.41;
    if (p < 0.72) return 1;
    if (p < 0.90) return 1 - (p - 0.72) / 0.18;
    return 0;
  }

  function setProgress(p) {
    explodeTarget = explodeCurve(p);
  }

  function explodeValue() {
    return explode;
  }

  function updateExplode() {
    for (const pt of parts) {
      const k = clamp((explode - pt.t0) / (pt.t1 - pt.t0), 0, 1);
      const e = k * k * (3 - 2 * k);
      pt.g.position.copy(pt.base).addScaledVector(pt.off, e);
      if (pt.rx !== undefined) pt.g.rotation.x = pt.rx * e;
      if (pt.rz !== undefined) pt.g.rotation.z = pt.rz * e;
    }
  }

  function updateRotate(dt) {
    const auto = dragging || reduced ? 0 : explode < 0.05 ? 0.18 : 0.07;
    yaw += (yawV + auto) * dt;
    pitch += pitchV * dt;
    pitch = clamp(pitch, -1.15, 1.15);
    const decay = Math.exp(-dt * 2.8);
    yawV *= decay;
    pitchV *= decay;
    product.rotation.y = yaw;
    product.rotation.x = pitch;
  }

  function frame(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;

    explode += (explodeTarget - explode) * (1 - Math.exp(-dt * 6));
    if (Math.abs(explodeTarget - explode) < 0.002) explode = explodeTarget;

    updateExplode();
    updateRotate(dt);

    camera.position.z = 12.5 - explode * 1.6;
    camera.position.y = 0.5 - explode * 0.2;
    camera.lookAt(0, 0, 0);
    interiorLight.intensity = explode * 1.15;
    if (glow) glow.material.opacity = 0.35 + explode * 0.25;

    renderer.render(scene, camera);

    if (window.__pwDebug || window.__pwGrid) {
      try {
        const w = renderer.domElement.width;
        const h = renderer.domElement.height;
        const gl = renderer.getContext();
        if (window.__pwDebug) {
          const px = new Uint8Array(4);
          gl.readPixels(w >> 1, h >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          window.__pwDebug = false;
          window.__pwPixel = Array.from(px);
          window.__pwTris = renderer.info.render.triangles;
        }
        if (window.__pwGrid && !window.__pwGridDone) {
          const gw = window.__pwGrid.w || 48;
          const gh = window.__pwGrid.h || 30;
          const px = new Uint8Array(w * h * 4);
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const cells = [];
          for (let y = 0; y < gh; y++) {
            const row = [];
            for (let x = 0; x < gw; x++) {
              const cx = Math.min(w - 1, Math.floor(((x + 0.5) / gw) * w));
              const cy = Math.min(h - 1, Math.floor(((y + 0.5) / gh) * h));
              const i = (cy * w + cx) * 4;
              row.push(px[i], px[i + 1], px[i + 2], px[i + 3]);
            }
            cells.push(row);
          }
          window.__pwGridDone = true;
          window.__pwGridData = cells;
        }
      } catch (e) { window.__pwDebugErr = String(e && e.message || e); }
    }

    if (readyCb) {
      const cb = readyCb;
      readyCb = null;
      cb();
    }
    requestAnimationFrame(frame);
  }

  function makeEnvironment() {
    const room = new THREE.Scene();
    const geo = new THREE.BoxGeometry(2, 2, 2);
    const faces = [
      new THREE.MeshBasicMaterial({ color: 0xfff5ea }), // +x warm
      new THREE.MeshBasicMaterial({ color: 0x1a1c20 }), // -x neutral
      new THREE.MeshBasicMaterial({ color: 0xf47a32 }), // +y orange top
      new THREE.MeshBasicMaterial({ color: 0x0b0c0e }), // -y dark bottom
      new THREE.MeshBasicMaterial({ color: 0x33373d }), // +z key
      new THREE.MeshBasicMaterial({ color: 0x141619 }), // -z rim
    ];
    const box = new THREE.Mesh(geo, faces);
    box.scale.setScalar(12);
    room.add(box);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const rt = pmrem.fromScene(room, 0.04);
    scene.environment = rt.texture;
    pmrem.dispose();
  }

  function create(sticky) {
    if (!sticky) return false;
    canvas = document.createElement('canvas');
    canvas.className = 'webgl-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    sticky.appendChild(canvas);

    try {
      renderer = new THREE.WebGLRenderer({
        canvas, alpha: true, antialias: true, powerPreference: 'high-performance',
      });
    } catch (e) {
      canvas.remove();
      canvas = null;
      return false;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setClearColor(0x000000, 0);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.5, 12.5);
    camera.lookAt(0, 0, 0);

    makeEnvironment();

    scene.add(new THREE.HemisphereLight(0x3a414b, 0x0b0c0e, 0.5));
    const key = new THREE.DirectionalLight(0xfff2e6, 1.05);
    key.position.set(6, 8, 9);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xf47a32, 1.5);
    rim.position.set(-7, 3, -6);
    scene.add(rim);
    interiorLight = new THREE.PointLight(0xffb06a, 0, 7, 2);
    interiorLight.position.set(0, 0, 0);
    scene.add(interiorLight);

    const mat = makeMaterials();
    mat.lcd = makeDisplayMaterial(makeDisplayTexture());
    mat.cable = new THREE.MeshPhysicalMaterial({
      color: 0x101014,
      metalness: 0.15,
      roughness: 0.72,
      clearcoat: 0.5,
      clearcoatRoughness: 0.5,
      map: makeBraidTexture(),
    });

    const built = buildProduct(mat);
    product = built.group;
    parts = built.parts;
    scene.add(product);

    glow = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 26),
      new THREE.MeshBasicMaterial({
        map: makeSoftGlowTexture(),
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      })
    );
    glow.position.z = -3;
    scene.add(glow);

    resize();
    ready = true;
    requestAnimationFrame(frame);
    return true;
  }

  function onReady(cb) {
    readyCb = cb;
  }

  function activate() {
    if (!canvas || !ready) return;
    canvas.style.display = '';
  }

  function isReady() {
    return ready;
  }

  /* ───────────── Interaction ───────────── */

  function bindPointer() {
    if (!canvas) return;
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      lastMove = performance.now();
      yawV = 0;
      pitchV = 0;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const now = performance.now();
      const dt = Math.max(now - lastMove, 1) / 1000;
      yaw += dx * 0.0055;
      pitch = clamp(pitch + dy * 0.0045, -1.15, 1.15);
      yawV = (dx * 0.0055) / dt;
      pitchV = (dy * 0.0045) / dt;
      lastX = e.clientX;
      lastY = e.clientY;
      lastMove = now;
    });
    const up = () => { dragging = false; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  return {
    create,
    onReady,
    activate,
    resize,
    setProgress,
    explodeValue,
    isReady,
    bindPointer,
  };
})();
