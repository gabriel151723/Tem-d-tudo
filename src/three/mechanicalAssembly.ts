import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SubsystemId } from '../utils/catalogLogic';

export interface MechanicalAssembly {
  root: THREE.Group;
  parts: Record<Exclude<SubsystemId, 'all'>, THREE.Group>;
  pedestal: THREE.Group;
  energyRings: THREE.Group;
  setExplosion: (amount: number, focusedSubsystem?: SubsystemId) => void;
  setWireframe: (enabled: boolean) => void;
  dispose: () => void;
}

class HelixCurve extends THREE.Curve<THREE.Vector3> {
  constructor() {
    super();
  }

  getPoint(t: number, optionalTarget = new THREE.Vector3()): THREE.Vector3 {
    const angle = t * Math.PI * 17;
    return optionalTarget.set(
      0.43 * Math.cos(angle),
      t * 2.37 - 1.185,
      0.43 * Math.sin(angle)
    );
  }
}

export function createMechanicalAssembly(maxAnisotropy: number = 4): MechanicalAssembly {
  const root = new THREE.Group();

  // Calibrated PBR studio materials with distinct roughness/metalness contrast (>= 0.25 delta)
  const steel = new THREE.MeshPhysicalMaterial({
    color: 0xb8c4d0,
    metalness: 0.92,
    roughness: 0.22,
    clearcoat: 0.45,
    clearcoatRoughness: 0.16,
  });

  const chromeEdge = new THREE.MeshPhysicalMaterial({
    color: 0xdce6f2,
    metalness: 0.98,
    roughness: 0.12,
    clearcoat: 0.6,
  });

  const castDark = new THREE.MeshStandardMaterial({
    color: 0x1e2b3c,
    metalness: 0.78,
    roughness: 0.48,
  });

  const matteRubber = new THREE.MeshStandardMaterial({
    color: 0x0b1017,
    metalness: 0.12,
    roughness: 0.76,
  });

  const anodizedOrange = new THREE.MeshPhysicalMaterial({
    color: 0xea580c,
    metalness: 0.55,
    roughness: 0.24,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
  });

  const machinedBrass = new THREE.MeshStandardMaterial({
    color: 0xc89d4c,
    metalness: 0.9,
    roughness: 0.28,
  });

  const cobaltGlow = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    emissive: 0x2563eb,
    emissiveIntensity: 1.4,
    metalness: 0.3,
    roughness: 0.3,
  });

  const emberGlow = new THREE.MeshStandardMaterial({
    color: 0xff6c23,
    emissive: 0xea580c,
    emissiveIntensity: 1.6,
    metalness: 0.4,
    roughness: 0.3,
  });

  const parts: Record<Exclude<SubsystemId, 'all'>, THREE.Group> = {
    brake: new THREE.Group(),
    engine: new THREE.Group(),
    spring: new THREE.Group(),
    transmission: new THREE.Group(),
  };

  Object.values(parts).forEach((group) => root.add(group));
  const { brake, engine, spring, transmission } = parts;

  function addMesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    parent: THREE.Object3D,
    position: [number, number, number] = [0, 0, 0],
    rotation: [number, number, number] = [0, 0, 0]
  ): THREE.Mesh {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(...position);
    m.rotation.set(...rotation);
    parent.add(m);
    return m;
  }

  const addRing = (
    r: number,
    tube: number,
    mat: THREE.Material,
    parent: THREE.Object3D,
    pos: [number, number, number] = [0, 0, 0],
    rot: [number, number, number] = [0, 0, 0]
  ) => addMesh(new THREE.TorusGeometry(r, tube, 10, 64), mat, parent, pos, rot);

  const addCylinder = (
    r: number,
    h: number,
    mat: THREE.Material,
    parent: THREE.Object3D,
    pos: [number, number, number] = [0, 0, 0],
    rot: [number, number, number] = [0, 0, 0],
    radialSegments = 48
  ) => addMesh(new THREE.CylinderGeometry(r, r, h, radialSegments), mat, parent, pos, rot);

  const addRoundedBox = (
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    parent: THREE.Object3D,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0]
  ) => addMesh(new RoundedBoxGeometry(w, h, d, 3, 0.06), mat, parent, pos, rot);

  function createRingShape(outerR: number, innerR: number): THREE.Shape {
    const shape = new THREE.Shape();
    shape.moveTo(outerR, 0);
    for (let i = 1; i <= 96; i++) {
      const a = (i * Math.PI) / 48;
      shape.lineTo(outerR * Math.cos(a), outerR * Math.sin(a));
    }
    shape.closePath();

    const hole = new THREE.Path();
    hole.moveTo(innerR, 0);
    for (let i = 1; i <= 48; i++) {
      const a = (-i * Math.PI) / 24;
      hole.lineTo(innerR * Math.cos(a), innerR * Math.sin(a));
    }
    hole.closePath();
    shape.holes.push(hole);
    return shape;
  }

  function extrudeShape(shape: THREE.Shape, depth: number, bevel = 0.012): THREE.ExtrudeGeometry {
    return new THREE.ExtrudeGeometry(shape, {
      depth,
      steps: 1,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: 16,
    });
  }

  function addBoltCircle(
    parent: THREE.Object3D,
    count: number,
    radius: number,
    z: number,
    size = 0.07,
    phase = 0
  ): THREE.InstancedMesh {
    const geometry = new THREE.CylinderGeometry(size, size, 0.095, 6);
    geometry.rotateX(Math.PI / 2);
    const bolts = new THREE.InstancedMesh(geometry, chromeEdge, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count + phase;
      dummy.position.set(radius * Math.cos(a), radius * Math.sin(a), z);
      dummy.rotation.set(0, 0, a);
      dummy.updateMatrix();
      bolts.setMatrixAt(i, dummy.matrix);
    }
    bolts.instanceMatrix.needsUpdate = true;
    bolts.computeBoundingSphere();
    parent.add(bolts);
    return bolts;
  }

  // 1. BRAKE SUBSYSTEM: Drilled Ventilated Disc + 6-Piston MANGUEIRAS Caliper
  const discShape = createRingShape(1.72, 0.72);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 20; i++) {
      const a = (i * Math.PI) / 10 + row * 0.11;
      const r = 0.98 + row * 0.245;
      const hole = new THREE.Path();
      hole.absarc(r * Math.cos(a), r * Math.sin(a), 0.048, 0, Math.PI * 2, true);
      discShape.holes.push(hole);
    }
  }
  const faceGeo = extrudeShape(discShape, 0.085);
  addMesh(faceGeo, steel, brake, [0, 0, 0.21]);
  addMesh(faceGeo, steel, brake, [0, 0, -0.31]);

  const vaneGeo = new THREE.BoxGeometry(0.86, 0.048, 0.43);
  const vanes = new THREE.InstancedMesh(vaneGeo, castDark, 44);
  const vaneDummy = new THREE.Object3D();
  for (let i = 0; i < 44; i++) {
    const a = (i * Math.PI * 2) / 44;
    vaneDummy.position.set(1.22 * Math.cos(a), 1.22 * Math.sin(a), -0.005);
    vaneDummy.rotation.set(0, 0, a + 0.19);
    vaneDummy.updateMatrix();
    vanes.setMatrixAt(i, vaneDummy.matrix);
  }
  vanes.instanceMatrix.needsUpdate = true;
  vanes.computeBoundingSphere();
  brake.add(vanes);

  addMesh(extrudeShape(createRingShape(0.74, 0.24), 0.63), castDark, brake, [0, 0, -0.3]);
  addMesh(extrudeShape(createRingShape(0.59, 0.24), 0.055), steel, brake, [0, 0, 0.34]);
  for (const r of [0.78, 0.81, 1.62, 1.66, 1.69]) {
    addRing(r, 0.0045, chromeEdge, brake, [0, 0, 0.309]);
  }
  addRing(0.25, 0.025, chromeEdge, brake, [0, 0, 0.41]);
  addBoltCircle(brake, 8, 0.46, 0.44);
  addBoltCircle(brake, 12, 0.69, 0.355, 0.035, Math.PI / 12);

  for (const z of [-0.48, 0.4]) {
    addRoundedBox(0.57, 1.6, 0.25, anodizedOrange, brake, [1.5, 0, z], [0, 0, 0.07]);
    addRoundedBox(0.25, 1.31, 0.11, matteRubber, brake, [1.28, 0, z > 0 ? 0.29 : -0.29]);
  }
  addRoundedBox(0.24, 1.38, 1.05, anodizedOrange, brake, [1.77, 0, 0.02]);
  for (const y of [-0.48, 0, 0.48]) {
    addCylinder(0.145, 0.11, castDark, brake, [1.48, y, 0.57], [Math.PI / 2, 0, 0], 32);
  }
  for (const y of [-0.62, 0.62]) {
    addCylinder(0.058, 0.12, chromeEdge, brake, [1.68, y, 0.63], [Math.PI / 2, 0, 0], 6);
  }
  for (let i = 0; i < 5; i++) {
    addRoundedBox(0.027, 0.91, 0.035, castDark, brake, [1.68 + i * 0.042, 0, 0.568]);
  }
  addCylinder(0.04, 0.15, machinedBrass, brake, [1.48, 0.87, 0.27], [0, 0, -0.15], 12);

  if (typeof document !== 'undefined') {
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 128;
    const ctx = labelCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = '#ff9e66';
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, 496, 112);
      ctx.fillStyle = '#fff7ed';
      ctx.font = '700 48px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MANGUEIRAS', 256, 66);
      const texture = new THREE.CanvasTexture(labelCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = maxAnisotropy;
      const labelMat = new THREE.MeshStandardMaterial({
        map: texture,
        metalness: 0.35,
        roughness: 0.32,
      });
      addMesh(
        new THREE.PlaneGeometry(0.99, 0.247),
        labelMat,
        brake,
        [1.51, 0, 0.638],
        [0, 0, Math.PI / 2]
      );
    }
  }

  // 2. ENGINE SUBSYSTEM: Heavy-Duty Diesel Piston + Forged Connecting Rod
  const pistonProfile = [
    new THREE.Vector2(0.46, -0.4),
    new THREE.Vector2(0.56, -0.36),
    new THREE.Vector2(0.58, 0.27),
    new THREE.Vector2(0.57, 0.42),
    new THREE.Vector2(0.46, 0.44),
    new THREE.Vector2(0.4, 0.36),
    new THREE.Vector2(0, 0.36),
  ];
  addMesh(new THREE.LatheGeometry(pistonProfile, 64), steel, engine, [0, 1.15, 0]);
  for (const y of [1.36, 1.44, 1.51]) {
    addRing(0.579, 0.021, castDark, engine, [0, y, 0], [Math.PI / 2, 0, 0]);
  }
  addRing(0.45, 0.008, chromeEdge, engine, [0, 1.592, 0], [Math.PI / 2, 0, 0]);
  addCylinder(0.13, 1.31, chromeEdge, engine, [0, 0.98, 0], [0, 0, Math.PI / 2]);

  const rodShape = new THREE.Shape();
  rodShape.moveTo(-0.13, 1.05);
  rodShape.lineTo(0.13, 1.05);
  rodShape.lineTo(0.22, -0.38);
  rodShape.lineTo(-0.22, -0.38);
  rodShape.closePath();

  const rodSlot = new THREE.Path();
  rodSlot.moveTo(-0.052, 0.74);
  rodSlot.lineTo(-0.095, -0.16);
  rodSlot.lineTo(0.095, -0.16);
  rodSlot.lineTo(0.052, 0.74);
  rodSlot.closePath();
  rodShape.holes.push(rodSlot);

  addMesh(extrudeShape(rodShape, 0.18), steel, engine, [0, 0, -0.09]);
  addMesh(extrudeShape(createRingShape(0.34, 0.2), 0.25), chromeEdge, engine, [0, -0.52, -0.125]);
  addMesh(extrudeShape(createRingShape(0.21, 0.115), 0.24), castDark, engine, [0, 0.95, -0.12]);
  for (const x of [-0.26, 0.26]) {
    addCylinder(0.055, 0.22, machinedBrass, engine, [x, -0.57, 0], [0, 0, 0], 6);
  }

  // 3. TRANSMISSION SUBSYSTEM: Helical Spur Gear + Splined Output Shaft
  const gearShape = createRingShape(1, 0.24);
  gearShape.curves = [];
  gearShape.currentPoint.set(0, 0);
  for (let i = 0; i < 144; i++) {
    const a = (i * Math.PI * 2) / 144;
    const r = i % 4 === 1 || i % 4 === 2 ? 1.08 : 0.95;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) gearShape.moveTo(x, y);
    else gearShape.lineTo(x, y);
  }
  gearShape.closePath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const hole = new THREE.Path();
    hole.absarc(0.61 * Math.cos(a), 0.61 * Math.sin(a), 0.17, 0, Math.PI * 2, true);
    gearShape.holes.push(hole);
  }
  addMesh(extrudeShape(gearShape, 0.3), steel, transmission, [0, 0, -0.15]);
  addRing(0.34, 0.055, chromeEdge, transmission, [0, 0, 0.21]);
  addRing(0.26, 0.024, castDark, transmission, [0, 0, 0.25]);
  addCylinder(0.19, 1.32, chromeEdge, transmission, [0, 0, 0.45], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    addMesh(
      new THREE.BoxGeometry(0.045, 0.045, 0.65),
      castDark,
      transmission,
      [0.2 * Math.cos(a), 0.2 * Math.sin(a), 0.65],
      [0, 0, a]
    );
  }

  // 4. SUSPENSION & HYDRAULIC HOSE SUBSYSTEM: Helical Coilover + 2SN Braided Hose
  addCylinder(0.14, 3.08, chromeEdge, spring);
  addCylinder(0.255, 1.55, castDark, spring, [0, -0.5, 0]);
  for (const y of [-1.26, 1.22]) {
    addCylinder(0.51, 0.1, steel, spring, [0, y, 0]);
    addCylinder(0.35, 0.17, anodizedOrange, spring, [0, y + (y < 0 ? -0.1 : 0.1), 0]);
  }
  for (let i = 0; i < 7; i++) {
    addRing(0.263, 0.014, chromeEdge, spring, [0, -1.05 + i * 0.065, 0], [Math.PI / 2, 0, 0]);
  }
  for (const y of [-1.65, 1.65]) {
    addRing(0.22, 0.085, castDark, spring, [0, y, 0]);
    addRing(0.135, 0.03, chromeEdge, spring, [0, y, 0.055]);
  }
  addMesh(new THREE.TubeGeometry(new HelixCurve(), 220, 0.068, 10, false), anodizedOrange, spring);

  const hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.2, 1.4, 0),
    new THREE.Vector3(0.68, 1.18, -0.32),
    new THREE.Vector3(0.58, -0.35, -0.32),
    new THREE.Vector3(0.25, -0.5, 0),
  ]);
  addMesh(new THREE.TubeGeometry(hoseCurve, 44, 0.058, 10, false), matteRubber, spring);
  for (const pos of [
    [0.2, 1.4, 0],
    [0.25, -0.5, 0],
  ] as [number, number, number][]) {
    addCylinder(0.098, 0.18, machinedBrass, spring, pos, [0, 0, Math.PI / 2], 6);
  }

  // 5. STUDIO PEDESTAL & ORBITAL TELEMETRY RINGS
  const pedestal = new THREE.Group();
  root.add(pedestal);
  pedestal.position.y = -2.55;

  const baseMat = castDark.clone();
  baseMat.transparent = true;
  const ringMat = emberGlow.clone();
  ringMat.transparent = true;
  const outerCobaltMat = cobaltGlow.clone();
  outerCobaltMat.transparent = true;

  addCylinder(2.38, 0.12, baseMat, pedestal, [0, 0, 0], [0, 0, 0], 96);
  addRing(2.32, 0.014, ringMat, pedestal, [0, 0.075, 0], [Math.PI / 2, 0, 0]);
  addRing(2.08, 0.008, outerCobaltMat, pedestal, [0, 0.078, 0], [Math.PI / 2, 0, 0]);

  // Subtle orbital calibration rings that surround the assembly in 3D space
  const energyRings = new THREE.Group();
  root.add(energyRings);
  const orbitRingMat = new THREE.MeshBasicMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.14,
  });
  const orbitAccentMat = new THREE.MeshBasicMaterial({
    color: 0xea580c,
    transparent: true,
    opacity: 0.22,
  });
  addRing(3.15, 0.005, orbitRingMat, energyRings, [0, 0, 0], [Math.PI / 2.4, 0.2, 0]);
  addRing(3.55, 0.004, orbitAccentMat, energyRings, [0, 0, 0], [-Math.PI / 3, -0.35, 0.1]);

  const homePositions: Record<Exclude<SubsystemId, 'all'>, THREE.Vector3> = {
    brake: new THREE.Vector3(-0.58, -0.2, 0.73),
    engine: new THREE.Vector3(1.01, 1.0, -0.43),
    spring: new THREE.Vector3(-2.1, 0.8, -0.6),
    transmission: new THREE.Vector3(0.94, -1.15, -0.57),
  };

  const spreadVectors: Record<Exclude<SubsystemId, 'all'>, THREE.Vector3> = {
    brake: new THREE.Vector3(-1.15, -0.08, 0.92),
    engine: new THREE.Vector3(0.88, 1.18, 0.15),
    spring: new THREE.Vector3(-1.08, 0.72, -0.72),
    transmission: new THREE.Vector3(1.18, -0.82, -0.32),
  };

  brake.rotation.set(0, -0.1, -0.18);
  engine.rotation.z = -0.22;
  spring.rotation.z = -0.2;
  transmission.rotation.set(0.05, -0.17, 0.18);

  function setExplosion(amount: number, focusedSubsystem: SubsystemId = 'all') {
    const clamped = Math.max(0, Math.min(1, amount));
    (Object.keys(parts) as Array<Exclude<SubsystemId, 'all'>>).forEach((name) => {
      const partGroup = parts[name];
      partGroup.position.copy(homePositions[name]).addScaledVector(spreadVectors[name], clamped);

      // Subtle scale emphasis when a specific subsystem is focused
      const targetScale =
        focusedSubsystem === 'all' ? 1.0 : focusedSubsystem === name ? 1.12 : 0.86;
      partGroup.scale.setScalar(targetScale);
    });

    baseMat.opacity = Math.max(0, 1 - clamped * 1.1);
    ringMat.opacity = Math.max(0.15, 1 - clamped * 0.85);
    outerCobaltMat.opacity = Math.max(0.15, 1 - clamped * 0.85);
    pedestal.visible = clamped < 0.95 && focusedSubsystem === 'all';
    root.updateMatrixWorld(true);
  }

  function setWireframe(enabled: boolean) {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          if ('wireframe' in m) {
            (m as THREE.MeshStandardMaterial).wireframe = enabled;
          }
        });
      }
    });
  }

  function dispose() {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          materials.add(m);
          Object.values(m).forEach((val) => {
            if (val && (val as THREE.Texture).isTexture) {
              textures.add(val as THREE.Texture);
            }
          });
        });
      }
    });

    textures.forEach((t) => t.dispose());
    materials.forEach((m) => m.dispose());
    geometries.forEach((g) => g.dispose());
  }

  setExplosion(0);
  root.rotation.set(0.12, -0.28, -0.06);

  return {
    root,
    parts,
    pedestal,
    energyRings,
    setExplosion,
    setWireframe,
    dispose,
  };
}
