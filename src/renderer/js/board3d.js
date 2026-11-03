// 3D 陸軍棋盤（Three.js）：沙盤地形、鐵路、行營、大本營、山界群山、立體棋子與交戰動畫
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as J from './junqi.js';

const CX = 1.5;      // 行距（左右）
const RZ = 0.92;     // 列距（前後）
const GAP = 1.75;    // 山界寬度
const TOP = 0.22;    // 棋盤表面高度
const PW = 1.08, PD = 0.6, PH = 0.2; // 棋子寬、深、高
const FONT = '"Microsoft JhengHei","PingFang TC","Noto Sans TC","Heiti TC",sans-serif';
const KAI = '"DFKai-SB","BiauKai","標楷體","Kaiti TC","STKaiti","KaiTi",serif';
export const SIDE_COLOR = ['#c62828', '#1f5fbf'];
const SIDE_DARK = ['#8e1b1b', '#163f80'];

const X = (sq) => (J.colOf(sq) - 2) * CX;
const Z = (sq) => { const r = J.rowOf(sq); return (r - 5.5) * RZ + (r >= 6 ? GAP / 2 - RZ / 2 : -GAP / 2 + RZ / 2); };
const BW = 4 * CX + 2.1;                    // 棋盤寬
const BH = 10 * RZ + GAP + 1.5;             // 棋盤長

// ---------------- 棋盤貼圖 ----------------
function makeBoardTexture() {
  const PX = 180; // 每單位像素
  const W = Math.round(BW * PX), H = Math.round(BH * PX);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const px = (x) => (x + BW / 2) * PX, pz = (z) => (z + BH / 2) * PX;
  // 沙盤底色：兩方各帶一點陣營色
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#c9c39a'); grd.addColorStop(0.5, '#d8d0a6'); grd.addColorStop(1, '#cdc69c');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  // 地形斑紋
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${90 + Math.random() * 40},${100 + Math.random() * 40},${50 + Math.random() * 30},${0.03 + Math.random() * 0.05})`;
    const r = 8 + Math.random() * 60;
    g.beginPath(); g.ellipse(Math.random() * W, Math.random() * H, r, r * (0.4 + Math.random() * 0.6), Math.random() * 3, 0, Math.PI * 2); g.fill();
  }
  // 等高線
  g.strokeStyle = 'rgba(110,95,60,0.13)'; g.lineWidth = 3;
  for (let i = 0; i < 26; i++) {
    g.beginPath();
    const y0 = Math.random() * H;
    g.moveTo(0, y0);
    for (let x = 0; x <= W; x += 40) g.lineTo(x, y0 + Math.sin(x / 140 + i) * 26 + Math.sin(x / 47) * 6);
    g.stroke();
  }
  // 陣營色帶
  g.fillStyle = 'rgba(198,40,40,0.07)'; g.fillRect(0, pz(GAP / 2), W, H);
  g.fillStyle = 'rgba(31,95,191,0.07)'; g.fillRect(0, 0, W, pz(-GAP / 2));
  // 山界
  const gy0 = pz(-GAP / 2 + 0.25), gy1 = pz(GAP / 2 - 0.25);
  g.fillStyle = 'rgba(120,140,80,0.35)';
  g.fillRect(0, gy0, W, gy1 - gy0);
  // 外框
  g.strokeStyle = '#4a3b20'; g.lineWidth = 14;
  g.strokeRect(14, 14, W - 28, H - 28);
  g.lineWidth = 4; g.strokeRect(34, 34, W - 68, H - 68);

  // 公路（細線）
  const sqs = [...Array(60).keys()];
  g.lineCap = 'round';
  for (const a of sqs) for (const b of J.ADJ[a]) {
    if (b < a) continue;
    if (J.RAILN[a].includes(b)) continue;
    g.strokeStyle = '#5c4a2c'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(px(X(a)), pz(Z(a))); g.lineTo(px(X(b)), pz(Z(b))); g.stroke();
  }
  // 鐵路（黑白相間的粗線）
  for (const a of sqs) for (const b of J.RAILN[a]) {
    if (b < a) continue;
    const x1 = px(X(a)), y1 = pz(Z(a)), x2 = px(X(b)), y2 = pz(Z(b));
    g.strokeStyle = '#1d1d1d'; g.lineWidth = 20; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = '#f4f1e6'; g.lineWidth = 10; g.setLineDash([22, 22]);
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.setLineDash([]);
  }
  // 兵站、行營、大本營
  for (const sq of sqs) {
    const x = px(X(sq)), y = pz(Z(sq));
    const side = J.halfOf(sq);
    if (J.isCamp(sq)) {
      g.fillStyle = '#efe6c4'; g.strokeStyle = '#5c4a2c'; g.lineWidth = 7;
      g.beginPath(); g.arc(x, y, 0.42 * PX, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = 'rgba(92,74,44,0.55)'; g.font = `bold ${Math.round(0.22 * PX)}px ${KAI}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.save(); g.translate(x, y); if (side === 1) g.rotate(Math.PI); g.fillText('行營', 0, 0); g.restore();
    } else if (J.isHQ(sq)) {
      const w = 0.66 * PX, h = 0.4 * PX;
      g.fillStyle = side === 0 ? '#f3d3c8' : '#cfdcf3'; g.strokeStyle = SIDE_DARK[side]; g.lineWidth = 8;
      g.beginPath(); g.roundRect(x - w, y - h, w * 2, h * 2, 0.22 * PX); g.fill(); g.stroke();
      g.fillStyle = SIDE_DARK[side]; g.font = `bold ${Math.round(0.24 * PX)}px ${KAI}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.save(); g.translate(x, y); if (side === 1) g.rotate(Math.PI); g.fillText('大本營', 0, 0); g.restore();
    } else {
      const w = 0.56 * PX, h = 0.32 * PX;
      g.fillStyle = J.isRail(sq) ? '#e8e2cc' : '#f2ecd6'; g.strokeStyle = '#5c4a2c'; g.lineWidth = 5;
      g.beginPath(); g.roundRect(x - w, y - h, w * 2, h * 2, 10); g.fill(); g.stroke();
    }
  }
  // 座標
  g.fillStyle = 'rgba(60,45,20,0.7)'; g.font = `bold ${Math.round(0.26 * PX)}px ${FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let c = 0; c < 5; c++) g.fillText('ABCDE'[c], px((c - 2) * CX), H - 0.28 * PX);
  for (let r = 0; r < 12; r++) g.fillText(String(12 - r), 0.32 * PX, pz(Z(J.SQ(r, 0))));
  // 山界文字
  g.fillStyle = 'rgba(70,60,30,0.65)'; g.font = `bold ${Math.round(0.34 * PX)}px ${KAI}`;
  g.fillText('山　　界', px(0), pz(0) - 0.02 * PX);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ---------------- 棋子貼圖 ----------------
const faceCache = new Map();
function roundRectPath(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function pieceFaceTexture(side, t) {
  const key = side * 16 + t;
  if (faceCache.has(key)) return faceCache.get(key);
  const W = 512, H = 284;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const ink = SIDE_COLOR[side];
  if (t === J.UNK) {
    // 暗子：只看得出陣營
    const grd = g.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, side === 0 ? '#d4473f' : '#3a78d4'); grd.addColorStop(1, SIDE_DARK[side]);
    g.fillStyle = grd; roundRectPath(g, 0, 0, W, H, 40); g.fill();
    g.strokeStyle = 'rgba(255,236,190,0.85)'; g.lineWidth = 10; roundRectPath(g, 22, 22, W - 44, H - 44, 28); g.stroke();
    g.fillStyle = 'rgba(255,236,190,0.92)';
    // 五角星
    const star = (cx, cy, R) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? R * 0.42 : R; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fill(); };
    star(W / 2 - 120, H / 2, 58);
    g.font = `900 ${Math.round(H * 0.36)}px ${FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('小柯', W / 2 + 50, H / 2 + 6);
  } else {
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#fffaf0'); grd.addColorStop(1, '#f1e4c4');
    g.fillStyle = grd; roundRectPath(g, 0, 0, W, H, 40); g.fill();
    g.strokeStyle = ink; g.lineWidth = 12; roundRectPath(g, 18, 18, W - 36, H - 36, 28); g.stroke();
    g.lineWidth = 4; roundRectPath(g, 34, 34, W - 68, H - 68, 20); g.stroke();
    const name = J.NAMES[t];
    g.fillStyle = ink;
    g.font = `900 ${Math.round(H * 0.5)}px ${KAI}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = 6; g.shadowOffsetY = 3;
    g.fillText(name, W / 2, H / 2 + 8);
    g.shadowColor = 'transparent';
    g.lineWidth = 5; g.strokeStyle = ink; g.strokeText(name, W / 2, H / 2 + 8);
    // 軍階小星
    if (t >= J.GONG && t <= J.SI) {
      const n = t >= 8 ? 3 : t >= 6 ? 2 : t >= 4 ? 1 : 0;
      for (let i = 0; i < n; i++) {
        const cx = 70 + i * 26, cy = 64, R = 12;
        g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5; const r = k % 2 ? R * 0.42 : R; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  faceCache.set(key, tex);
  return tex;
}

function labelTexture(text, color = '#fff8dc') {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 96;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(20,16,8,0.78)';
  g.beginPath(); g.roundRect(4, 8, 248, 80, 26); g.fill();
  g.strokeStyle = 'rgba(255,220,120,0.9)'; g.lineWidth = 4; g.stroke();
  g.fillStyle = color; g.font = `900 46px ${FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 50);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Board3D {
  constructor(container, { onSquareClick } = {}) {
    this.container = container;
    this.onSquareClick = onSquareClick || (() => {});
    this.orientation = 0;
    this.pieces = new Map(); // sq → Group
    this.allPieces = new Set();
    this.pendingMoves = new Set();
    this.interactive = true;
    this.anims = [];
    this.labels = new Map();
    this.particles = [];

    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    container.appendChild(r.domElement);

    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color('#18201a');
    scene.fog = new THREE.Fog('#18201a', 34, 70);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 34;
    this.controls.maxPolarAngle = Math.PI * 0.44;
    this.controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    this.controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };

    scene.add(new THREE.HemisphereLight('#fff6e4', '#2e3a26', 0.8));
    const key = new THREE.DirectionalLight('#ffeccc', 2.2);
    key.position.set(-7, 16, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 50 });
    key.shadow.bias = -0.0005;
    key.shadow.radius = 4;
    scene.add(key);
    const fill = new THREE.DirectionalLight('#cfe0ff', 0.5);
    fill.position.set(8, 7, -8);
    scene.add(fill);

    this.buildTable();
    this.buildBoard();
    this.buildMountains();
    this.buildFlags();
    this.buildPieceGeometry();
    this.buildMarkers();

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP);
    r.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    r.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
    r.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.viewName = 'tilt';
    this.resize();
    r.setAnimationLoop(() => this.frame());
  }

  buildTable() {
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 1024;
    const g = cv.getContext('2d');
    g.fillStyle = '#2b2418'; g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 420; i++) {
      g.strokeStyle = `rgba(${15 + Math.random() * 30},${10 + Math.random() * 15},5,${0.15 + Math.random() * 0.2})`;
      g.lineWidth = 1 + Math.random() * 3;
      const y = Math.random() * 1024;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= 1024; x += 32) g.lineTo(x, y + Math.sin(x / 90 + i) * 6);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 5);
    const table = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    table.rotation.x = -Math.PI / 2;
    table.receiveShadow = true;
    this.scene.add(table);
  }

  buildBoard() {
    const tex = makeBoardTexture();
    const side = new THREE.MeshStandardMaterial({ color: '#6b5a33', roughness: 0.7 });
    const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(BW, TOP, BH), [side, side, top, side, side, side]);
    box.position.y = TOP / 2;
    box.receiveShadow = true;
    box.castShadow = true;
    this.scene.add(box);
    // 木框
    const frameMat = new THREE.MeshStandardMaterial({ color: '#4a3820', roughness: 0.55 });
    const fw = 0.28;
    for (const [w, d, x, z] of [[BW + fw * 2, fw, 0, BH / 2 + fw / 2], [BW + fw * 2, fw, 0, -BH / 2 - fw / 2], [fw, BH, BW / 2 + fw / 2, 0], [fw, BH, -BW / 2 - fw / 2, 0]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, TOP + 0.12, d), frameMat);
      m.position.set(x, (TOP + 0.12) / 2, z);
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m);
    }
  }

  // 山界上的群山（避開左、中、右三條鐵路）
  buildMountains() {
    const grp = new THREE.Group();
    const rock = new THREE.MeshStandardMaterial({ color: '#6f7a4a', roughness: 0.95, flatShading: true });
    const rock2 = new THREE.MeshStandardMaterial({ color: '#56603a', roughness: 0.95, flatShading: true });
    const snow = new THREE.MeshStandardMaterial({ color: '#f2f0e6', roughness: 0.8, flatShading: true });
    const tree = new THREE.MeshStandardMaterial({ color: '#2f5a2a', roughness: 0.9, flatShading: true });
    const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    const peak = (x, z, h, r) => {
      const geo = new THREE.ConeGeometry(r, h, 6 + Math.floor(rnd() * 3), 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) < h / 2 - 0.01) { pos.setX(i, pos.getX(i) * (0.85 + rnd() * 0.3)); pos.setZ(i, pos.getZ(i) * (0.85 + rnd() * 0.3)); }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, rnd() < 0.5 ? rock : rock2);
      m.position.set(x, TOP + h / 2, z);
      m.rotation.y = rnd() * Math.PI;
      m.castShadow = true; m.receiveShadow = true;
      grp.add(m);
      if (h > 0.85) {
        const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.32, h * 0.3, 6), snow);
        cap.position.set(x, TOP + h - h * 0.15 + 0.01, z);
        cap.rotation.y = m.rotation.y;
        grp.add(cap);
      }
    };
    // 每兩條鐵路之間一串山
    for (const cx of [-1, 1]) {
      const x0 = cx * CX;
      peak(x0, 0, 1.15, 0.55);
      peak(x0 - 0.42, 0.18, 0.75, 0.38);
      peak(x0 + 0.4, -0.2, 0.82, 0.4);
      peak(x0 + 0.1, 0.42, 0.5, 0.28);
      peak(x0 - 0.2, -0.42, 0.55, 0.3);
    }
    for (const x0 of [-BW / 2 + 0.35, BW / 2 - 0.35]) { peak(x0, 0.05, 0.7, 0.35); peak(x0, -0.4, 0.45, 0.25); }
    // 小樹
    for (let i = 0; i < 22; i++) {
      const x = (rnd() - 0.5) * (BW - 0.8), z = (rnd() - 0.5) * (GAP - 0.6);
      if (Math.min(Math.abs(x), Math.abs(x - 2 * CX), Math.abs(x + 2 * CX)) < 0.45) continue;
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 5), tree);
      t.position.set(x, TOP + 0.17, z);
      t.castShadow = true;
      grp.add(t);
    }
    // 三條鐵路的橋墩
    const pier = new THREE.MeshStandardMaterial({ color: '#8a8a80', roughness: 0.7 });
    for (const c of [0, 2, 4]) {
      for (const sx of [-0.2, 0.2]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, GAP - 0.3), pier);
        p.position.set((c - 2) * CX + sx, TOP + 0.025, 0);
        grp.add(p);
      }
    }
    this.scene.add(grp);
  }

  // 雙方大本營後方的軍旗
  buildFlags() {
    const pole = new THREE.MeshStandardMaterial({ color: '#d8c890', metalness: 0.4, roughness: 0.4 });
    this.flagCloths = [];
    for (const side of [0, 1]) {
      for (const sx of [-1, 1]) {
        const z = side === 0 ? BH / 2 + 0.6 : -BH / 2 - 0.6;
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 10), pole);
        p.position.set(sx * (BW / 2 + 0.2), 1.1, z);
        p.castShadow = true;
        this.scene.add(p);
        const geo = new THREE.PlaneGeometry(0.9, 0.55, 12, 4);
        const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: SIDE_COLOR[side], side: THREE.DoubleSide, roughness: 0.7 }));
        cloth.position.set(sx * (BW / 2 + 0.2) + 0.47 * -sx, 1.9, z);
        cloth.castShadow = true;
        cloth.userData.base = geo.attributes.position.array.slice();
        cloth.userData.sx = sx;
        this.scene.add(cloth);
        this.flagCloths.push(cloth);
      }
    }
  }

  buildPieceGeometry() {
    const shape = new THREE.Shape();
    const w = PW / 2, d = PD / 2, rr = 0.1;
    shape.moveTo(-w + rr, -d);
    shape.lineTo(w - rr, -d); shape.quadraticCurveTo(w, -d, w, -d + rr);
    shape.lineTo(w, d - rr); shape.quadraticCurveTo(w, d, w - rr, d);
    shape.lineTo(-w + rr, d); shape.quadraticCurveTo(-w, d, -w, d - rr);
    shape.lineTo(-w, -d + rr); shape.quadraticCurveTo(-w, -d, -w + rr, -d);
    const bevel = 0.035;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: PH - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, bevel, 0);
    this.bodyGeo = geo;
    this.faceGeo = new THREE.PlaneGeometry(PW - 0.06, PD - 0.06);
    this.bodyMat = [0, 1].map((s) => new THREE.MeshStandardMaterial({ color: SIDE_COLOR[s], roughness: 0.42 }));
    this.faceMat = new Map();
  }

  faceMaterial(side, t) {
    const key = side * 16 + t;
    if (!this.faceMat.has(key)) this.faceMat.set(key, new THREE.MeshStandardMaterial({ map: pieceFaceTexture(side, t), roughness: 0.38 }));
    return this.faceMat.get(key);
  }

  makePiece(code) {
    const side = code >> 4, t = code & 15;
    const grp = new THREE.Group();
    const body = new THREE.Mesh(this.bodyGeo, this.bodyMat[side]);
    body.castShadow = true; body.receiveShadow = true;
    grp.add(body);
    const face = new THREE.Mesh(this.faceGeo, this.faceMaterial(side, t));
    face.rotation.x = -Math.PI / 2;
    face.rotation.z = this.yaw;
    face.position.y = PH + 0.002;
    face.receiveShadow = true;
    grp.add(face);
    grp.userData = { code, face, body };
    this.allPieces.add(grp);
    return grp;
  }

  setCode(g, code) {
    if (g.userData.code === code) return;
    g.userData.code = code;
    g.userData.face.material = this.faceMaterial(code >> 4, code & 15);
  }

  buildMarkers() {
    const mk = (color, opacity, geo) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.scene.add(m);
      return m;
    };
    const frame = (w, d, t) => {
      const s = new THREE.Shape();
      s.moveTo(-w, -d); s.lineTo(w, -d); s.lineTo(w, d); s.lineTo(-w, d); s.lineTo(-w, -d);
      const hole = new THREE.Path();
      hole.moveTo(-w + t, -d + t); hole.lineTo(-w + t, d - t); hole.lineTo(w - t, d - t); hole.lineTo(w - t, -d + t); hole.lineTo(-w + t, -d + t);
      s.holes.push(hole);
      return new THREE.ShapeGeometry(s);
    };
    this.selMarker = mk('#ffe066', 0.95, frame(PW / 2 + 0.1, PD / 2 + 0.1, 0.07));
    this.lastFrom = mk('#4fc3f7', 0.8, frame(0.3, 0.2, 0.05));
    this.lastTo = mk('#4fc3f7', 0.85, frame(PW / 2 + 0.08, PD / 2 + 0.08, 0.05));
    this.hintFrom = mk('#7CFC00', 0.9, frame(PW / 2 + 0.1, PD / 2 + 0.1, 0.07));
    this.hintTo = mk('#7CFC00', 0.9, frame(PW / 2 + 0.1, PD / 2 + 0.1, 0.07));
    this.swapMarker = mk('#ff9f1a', 0.95, frame(PW / 2 + 0.12, PD / 2 + 0.12, 0.08));
    this.targets = [];
    this.dotGeo = new THREE.CircleGeometry(0.15, 32);
    this.capGeo = frame(PW / 2 + 0.06, PD / 2 + 0.06, 0.08);
    this.dotMat = new THREE.MeshBasicMaterial({ color: '#2ecc71', transparent: true, opacity: 0.9, depthWrite: false });
    this.capMat = new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.95, depthWrite: false });
    this.zoneMat = new THREE.MeshBasicMaterial({ color: '#ffe9a0', transparent: true, opacity: 0.0, depthWrite: false });
    this.zone = new THREE.Mesh(new THREE.PlaneGeometry(BW - 0.4, 6 * RZ + 0.3), this.zoneMat);
    this.zone.rotation.x = -Math.PI / 2;
    this.zone.visible = false;
    this.scene.add(this.zone);
    this.hintArrow = null;
  }

  placeMarker(m, sq, y = TOP + 0.004) {
    if (sq == null || sq < 0) { m.visible = false; return; }
    m.position.set(X(sq), y, Z(sq));
    m.rotation.z = 0;
    m.visible = true;
  }

  resize() {
    const w = this.container.clientWidth || 800, h = this.container.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fitDistance();
  }

  get yaw() { return this.orientation === 0 ? 0 : Math.PI; }

  applyYaw() {
    const y = this.yaw;
    if (y === this.lastYaw) return;
    this.lastYaw = y;
    for (const g of this.allPieces) g.userData.face.rotation.z = y;
  }

  fitDistance() {
    if (!this.viewName) return;
    this.applyYaw();
    const yaw = this.yaw;
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const tanH = tanV * this.camera.aspect;
    const top = this.viewName === 'top';
    const needW = (BW / 2 + 0.5) / tanH;
    const needH = (top ? BH / 2 + 0.4 : BH / 2 * 0.86 + 0.6) / tanV;
    const dist = Math.max(needW, needH) * (this.viewName === 'low' ? 0.98 : 1);
    const sx = Math.sin(yaw), sz = Math.cos(yaw);
    const off = top ? 0 : 0.7;
    const target = new THREE.Vector3(sx * off, 0, sz * off);
    const [up, out] = top ? [1, 0.0001] : this.viewName === 'low' ? [0.6, 0.8] : [0.82, 0.57];
    const dir = new THREE.Vector3(sx * out, up, sz * out).normalize();
    this.camera.position.copy(target).addScaledVector(dir, dist);
    this.controls.target.copy(target);
    this.controls.maxDistance = Math.max(34, dist * 1.4);
    this.camera.lookAt(target);
    this.controls.update();
  }

  setView(name) { this.viewName = name; this.fitDistance(); }

  setOrientation(side) {
    this.orientation = side ? 1 : 0;
    this.lastYaw = null;
    this.fitDistance();
    this.refreshLabels();
  }

  // board：60 格棋子代碼（看不到的敵子用 UNK）
  setPosition(board) {
    for (const g of this.allPieces) this.scene.remove(g);
    this.allPieces.clear();
    this.pieces.clear();
    for (let sq = 0; sq < 60; sq++) {
      const p = board[sq];
      if (!p) continue;
      const g = this.makePiece(p);
      g.position.set(X(sq), TOP, Z(sq));
      this.scene.add(g);
      this.pieces.set(sq, g);
    }
    this.anims = [];
    for (const done of [...this.pendingMoves]) done();
    this.pendingMoves.clear();
    this.clearParticles();
    this.refreshLabels();
  }

  // 不重建場景，只更新棋子正反面（例如亮出軍旗、對局結束全部翻開）
  updateCodes(board) {
    for (const [sq, g] of this.pieces) if (board[sq]) this.setCode(g, board[sq]);
  }

  pendingPromise(fn) {
    return new Promise((res) => {
      const resolve = () => { this.pendingMoves.delete(resolve); res(); };
      this.pendingMoves.add(resolve);
      fn(resolve);
    });
  }

  tween(g, end, { duration = 420, lift = 0.6 } = {}) {
    return this.pendingPromise((resolve) => {
      const start = g.position.clone();
      const t0 = performance.now();
      this.anims.push((now) => {
        const k = Math.min(1, (now - t0) / duration);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        g.position.lerpVectors(start, end, e);
        g.position.y = end.y + Math.sin(Math.PI * e) * lift;
        if (k >= 1) { g.position.copy(end); resolve(); return false; }
        return true;
      });
    });
  }

  // 移動／交戰動畫。out：move｜win｜lose｜tie｜flag
  async animateMove(from, to, out = 'move', { attackerCode, defenderCode } = {}) {
    const g = this.pieces.get(from);
    if (!g) return;
    const victim = this.pieces.get(to);
    if (attackerCode) this.setCode(g, attackerCode);
    if (victim && defenderCode) this.setCode(victim, defenderCode);
    const end = new THREE.Vector3(X(to), TOP, Z(to));
    const dist = g.position.distanceTo(end);
    this.pieces.delete(from);
    if (out === 'move' || !victim) {
      this.pieces.set(to, g);
      await this.tween(g, end, { duration: 300 + Math.min(500, dist * 45), lift: 0.35 + Math.min(0.8, dist * 0.07) });
      return;
    }
    // 交戰：衝到對方旁邊、碰撞
    const dir = end.clone().sub(g.position).normalize();
    const hit = end.clone().addScaledVector(dir, -0.55);
    await this.tween(g, hit, { duration: 260 + Math.min(450, dist * 40), lift: 0.4 + Math.min(0.8, dist * 0.07) });
    this.spark(end, out === 'tie' ? '#ffb000' : '#ffffff', out === 'tie' ? 46 : 22);
    this.shake(0.12);
    if (out === 'win' || out === 'flag') {
      this.flyAway(victim, dir);
      this.pieces.set(to, g);
      await this.tween(g, end, { duration: 220, lift: 0.15 });
      if (out === 'flag') this.spark(end, '#ffd700', 90, 2.2);
    } else if (out === 'lose') {
      this.pieces.set(to, victim);
      this.flyAway(g, dir.clone().negate());
      await new Promise((r) => setTimeout(r, 300));
    } else {
      this.explode(g); this.explode(victim);
      await new Promise((r) => setTimeout(r, 420));
    }
  }

  // 布陣交換
  async animateSwap(a, b) {
    const ga = this.pieces.get(a), gb = this.pieces.get(b);
    if (!ga || !gb) return;
    this.pieces.set(a, gb); this.pieces.set(b, ga);
    await Promise.all([
      this.tween(ga, new THREE.Vector3(X(b), TOP, Z(b)), { duration: 380, lift: 0.55 }),
      this.tween(gb, new THREE.Vector3(X(a), TOP, Z(a)), { duration: 380, lift: 0.3 }),
    ]);
  }

  flyAway(g, dir) {
    const start = g.position.clone();
    const out = start.clone().add(new THREE.Vector3(dir.x * 1.6 + (Math.sign(start.x) || 1) * 1.4, 2.4, dir.z * 1.6));
    const t0 = performance.now();
    const dur = 620;
    this.anims.push((now) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      g.position.lerpVectors(start, out, e);
      g.scale.setScalar(Math.max(0.01, 1 - e));
      g.rotation.x = e * Math.PI * 1.5;
      g.rotation.z = e * 1.3;
      if (k >= 1) { this.scene.remove(g); this.allPieces.delete(g); return false; }
      return true;
    });
  }

  explode(g) {
    this.spark(g.position.clone().setY(TOP + 0.2), '#ff6a00', 40, 1.6);
    const t0 = performance.now();
    const v = new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2);
    const start = g.position.clone();
    this.anims.push((now) => {
      const k = Math.min(1, (now - t0) / 650);
      g.position.set(start.x + v.x * k, start.y + v.y * k - 4 * k * k, start.z + v.z * k);
      g.rotation.x += 0.25; g.rotation.y += 0.18;
      g.scale.setScalar(Math.max(0.01, 1 - k));
      if (k >= 1) { this.scene.remove(g); this.allPieces.delete(g); return false; }
      return true;
    });
  }

  // 火花粒子
  spark(pos, color = '#ffffff', n = 24, power = 1) {
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) {
      arr[i * 3] = pos.x; arr[i * 3 + 1] = pos.y + 0.25; arr[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2, s = (0.8 + Math.random() * 2.2) * power;
      vel.push(new THREE.Vector3(Math.cos(a) * s, (1 + Math.random() * 2.5) * power, Math.sin(a) * s));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.12, transparent: true, opacity: 1, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    const t0 = performance.now();
    const p = { pts };
    this.particles.push(p);
    this.anims.push((now) => {
      const k = Math.min(1, (now - t0) / 700);
      for (let i = 0; i < n; i++) {
        arr[i * 3] = pos.x + vel[i].x * k * 0.7;
        arr[i * 3 + 1] = pos.y + 0.25 + vel[i].y * k * 0.7 - 2.5 * k * k;
        arr[i * 3 + 2] = pos.z + vel[i].z * k * 0.7;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = 1 - k;
      if (k >= 1) { this.scene.remove(pts); geo.dispose(); mat.dispose(); this.particles = this.particles.filter((x) => x !== p); return false; }
      return true;
    });
  }
  clearParticles() { for (const p of this.particles) this.scene.remove(p.pts); this.particles = []; }

  shake(amount) {
    const t0 = performance.now();
    this.shakeAnim = (now) => {
      const k = (now - t0) / 260;
      if (k >= 1) { this.shakeAnim = null; return 0; }
      return amount * (1 - k) * Math.sin(k * 40);
    };
  }

  setSelected(sq) {
    this.selected = sq;
    this.placeMarker(this.selMarker, sq, TOP + 0.006);
    for (const [s, g] of this.pieces) if (!this.anims.length || s === sq) g.position.y = s === sq ? TOP + 0.16 : TOP;
  }

  setSwapMark(sq) { this.placeMarker(this.swapMarker, sq, TOP + 0.007); for (const [s, g] of this.pieces) g.position.y = s === sq ? TOP + 0.2 : TOP; }

  setTargets(list, board) {
    for (const m of this.targets) this.scene.remove(m);
    this.targets = [];
    for (const sq of list || []) {
      const cap = board && board[sq];
      const m = new THREE.Mesh(cap ? this.capGeo : this.dotGeo, cap ? this.capMat : this.dotMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(X(sq), TOP + 0.005, Z(sq));
      this.scene.add(m);
      this.targets.push(m);
    }
  }

  setLastMove(from, to) {
    this.placeMarker(this.lastFrom, from);
    this.placeMarker(this.lastTo, to);
  }

  setHint(from, to) {
    this.placeMarker(this.hintFrom, from, TOP + 0.008);
    this.placeMarker(this.hintTo, to, TOP + 0.008);
    if (this.hintArrow) { this.scene.remove(this.hintArrow); this.hintArrow = null; }
    if (from == null || from < 0 || from === to) return;
    const a = new THREE.Vector3(X(from), TOP + 0.9, Z(from));
    const b = new THREE.Vector3(X(to), TOP + 0.9, Z(to));
    const dir = b.clone().sub(a);
    const len = dir.length();
    this.hintArrow = new THREE.ArrowHelper(dir.normalize(), a, len, 0x39ff14, Math.min(0.6, len * 0.35), 0.35);
    this.scene.add(this.hintArrow);
  }

  // 布陣時標出自己的半邊
  setZone(side) {
    if (side == null) { this.zone.visible = false; return; }
    this.zone.position.set(0, TOP + 0.003, side === 0 ? Z(J.SQ(11, 0)) - 2.5 * RZ : Z(J.SQ(0, 0)) + 2.5 * RZ);
    this.zone.visible = true;
  }

  // 敵子推算標籤：Map sq → { text, color }
  setLabels(map) {
    this.labelData = map || new Map();
    this.refreshLabels();
  }
  refreshLabels() {
    for (const s of this.labels.values()) { s.parent && s.parent.remove(s); s.material.map.dispose(); s.material.dispose(); }
    this.labels.clear();
    if (!this.labelData) return;
    for (const [sq, { text, color }] of this.labelData) {
      const g = this.pieces.get(sq);
      if (!g) continue;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(text, color), depthTest: false, transparent: true }));
      sp.scale.set(0.95, 0.36, 1);
      sp.position.set(0, PH + 0.42, 0);
      sp.renderOrder = 10;
      g.add(sp);
      this.labels.set(sq, sp);
    }
  }

  setInteractive(on) {
    this.interactive = on;
    this.renderer.domElement.style.cursor = on ? 'default' : 'not-allowed';
  }

  pickSquare(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = [];
    for (const [sq, g] of this.pieces) g.traverse((c) => { if (c.isMesh) { c.userData.sq = sq; meshes.push(c); } });
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    if (hit) return hit.object.userData.sq;
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.boardPlane, p)) return -1;
    let best = -1, bd = 1e9;
    for (let sq = 0; sq < 60; sq++) {
      const dx = (p.x - X(sq)) / (PW * 0.6), dz = (p.z - Z(sq)) / (PD * 0.8);
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = sq; }
    }
    return bd <= 1.2 ? best : -1;
  }

  onPointerDown(e) {
    if (e.button !== 0) return;
    const sq = this.pickSquare(e);
    if (sq >= 0) this.onSquareClick(sq);
  }

  onPointerMove(e) {
    if (!this.interactive) return;
    const sq = this.pickSquare(e);
    this.renderer.domElement.style.cursor = sq >= 0 && (this.pieces.has(sq) || this.targets.length) ? 'pointer' : 'default';
  }

  frame() {
    const now = performance.now();
    const running = this.anims;
    this.anims = [];
    const keep = running.filter((fn) => fn(now) !== false);
    this.anims = keep.concat(this.anims);
    const t = now / 1000;
    if (this.selMarker.visible) this.selMarker.material.opacity = 0.65 + 0.3 * Math.sin(t * 5);
    if (this.swapMarker.visible) this.swapMarker.material.opacity = 0.6 + 0.35 * Math.sin(t * 6);
    if (this.zone.visible) this.zoneMat.opacity = 0.1 + 0.06 * Math.sin(t * 2.5);
    // 旗子飄動
    for (const c of this.flagCloths) {
      const pos = c.geometry.attributes.position, base = c.userData.base;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        const k = (x * -c.userData.sx + 0.45) / 0.9;
        pos.setZ(i, Math.sin(t * 4 + x * 6) * 0.08 * k);
      }
      pos.needsUpdate = true;
    }
    this.controls.update();
    if (this.shakeAnim) {
      const s = this.shakeAnim(now);
      this.camera.position.x += s;
      this.renderer.render(this.scene, this.camera);
      this.camera.position.x -= s;
    } else this.renderer.render(this.scene, this.camera);
  }

  snapshot() { return this.renderer.domElement.toDataURL('image/png'); }
}
