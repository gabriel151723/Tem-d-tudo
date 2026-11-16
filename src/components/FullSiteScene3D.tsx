import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createMechanicalAssembly } from '../three/mechanicalAssembly';
import {
  SubsystemId,
  computeScrollCameraKeyframe,
} from '../utils/catalogLogic';

export interface SceneTelemetry {
  fps: number;
  stageLabel: string;
  angleTitle: string;
  explosionPct: number;
  webglActive: boolean;
}

interface FullSiteScene3DProps {
  scrollProgress: number;
  focusedSubsystem: SubsystemId;
  explosionOverride: number | null;
  wireframe: boolean;
  manualOrbit: boolean;
  onExitManualOrbit: () => void;
  onTelemetryChange?: (telemetry: SceneTelemetry) => void;
}

// Pre-allocated math helpers outside render loop (zero GC per Three.js skill)
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3(0, 0, 0);
const _targetModelPos = new THREE.Vector3();

export const FullSiteScene3D: React.FC<FullSiteScene3DProps> = ({
  scrollProgress,
  focusedSubsystem,
  explosionOverride,
  wireframe,
  manualOrbit,
  onExitManualOrbit,
  onTelemetryChange,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  // Store mutable React props in ref so WebGLRenderer mounts once and never tears down on HUD updates
  const stateRef = useRef({
    scrollProgress,
    focusedSubsystem,
    explosionOverride,
    wireframe,
    manualOrbit,
    onExitManualOrbit,
    onTelemetryChange,
  });

  useEffect(() => {
    stateRef.current = {
      scrollProgress,
      focusedSubsystem,
      explosionOverride,
      wireframe,
      manualOrbit,
      onExitManualOrbit,
      onTelemetryChange,
    };
  }, [
    scrollProgress,
    focusedSubsystem,
    explosionOverride,
    wireframe,
    manualOrbit,
    onExitManualOrbit,
    onTelemetryChange,
  ]);

  const applyWireframeRef = useRef<((w: boolean) => void) | null>(null);
  const setOrbitEnabledRef = useRef<((enabled: boolean) => void) | null>(null);

  useEffect(() => {
    applyWireframeRef.current?.(wireframe);
  }, [wireframe]);

  useEffect(() => {
    setOrbitEnabledRef.current?.(manualOrbit);
  }, [manualOrbit]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let frameId = 0;
    let isDisposed = false;

    try {
      // Detect software WebGL (SwiftShader / llvmpipe) per threejs skill
      const isSoftwareGl = (() => {
        const testCanvas = document.createElement('canvas');
        const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      })();

      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.28;
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);

      const canvas = renderer.domElement;
      canvas.setAttribute('data-testid', 'fullsite-webgl-canvas');
      canvas.setAttribute('aria-label', 'Conjunto mecânico 3D interativo M-02 em tempo real');
      canvas.className = 'block w-full h-full';
      container.innerHTML = '';
      container.appendChild(canvas);

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x030614, 0.014);

      const camera = new THREE.PerspectiveCamera(
        35,
        window.innerWidth / Math.max(window.innerHeight, 1),
        0.1,
        100
      );

      // Studio reflection environment via RoomEnvironment + PMREMGenerator
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
      scene.environment = envTarget.texture;
      scene.environmentIntensity = 1.45;
      roomEnv.dispose();
      pmremGenerator.dispose();

      // 3-point warm/cool studio lighting rig
      const hemiLight = new THREE.HemisphereLight(0xbfd9ff, 0x0b1933, 1.25);
      scene.add(hemiLight);

      const keyLight = new THREE.DirectionalLight(0xfff4e6, 3.4);
      keyLight.position.set(-3.5, 5.5, 6.0);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0x93c5fd, 2.3);
      fillLight.position.set(4.5, 2.0, 4.5);
      scene.add(fillLight);

      const rimLight = new THREE.PointLight(0x3b82f6, 56, 22);
      rimLight.position.set(-4.2, 2.5, -3.2);
      scene.add(rimLight);

      const warmSpot = new THREE.SpotLight(0xea580c, 64, 25, Math.PI / 3.5, 0.75);
      warmSpot.position.set(4.0, 4.2, 2.5);
      scene.add(warmSpot, warmSpot.target);

      const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
      const assembly = createMechanicalAssembly(maxAnisotropy);
      scene.add(assembly.root);

      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }

      const controls = new OrbitControls(camera, canvas);
      controls.enabled = false;
      controls.enableDamping = !isSoftwareGl;
      controls.dampingFactor = 0.07;
      controls.enablePan = false;
      controls.minDistance = 2.8;
      controls.maxDistance = 12.5;
      controls.rotateSpeed = 0.75;
      controls.zoomSpeed = 0.8;

      applyWireframeRef.current = (enabled: boolean) => {
        assembly.setWireframe(enabled);
      };

      setOrbitEnabledRef.current = (enabled: boolean) => {
        controls.enabled = enabled;
        if (enabled) {
          controls.target.copy(_currentLookAt);
          controls.update();
        }
      };

      // Pointer parallax tracking for responsive interactive movement across the whole site
      let pointerX = 0;
      let pointerY = 0;
      let smoothPointerX = 0;
      let smoothPointerY = 0;

      const onPointerMove = (e: PointerEvent) => {
        pointerX = (e.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
        pointerY = (e.clientY / Math.max(window.innerHeight, 1)) * 2 - 1;
      };
      window.addEventListener('pointermove', onPointerMove, { passive: true });

      const onResize = () => {
        if (!renderer) return;
        const w = window.innerWidth;
        const h = Math.max(window.innerHeight, 1);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        renderer.render(scene, camera);
      };
      window.addEventListener('resize', onResize);

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && stateRef.current.manualOrbit) {
          stateRef.current.onExitManualOrbit();
        }
      };
      window.addEventListener('keydown', onKeyDown);

      // Initialize exact starting pose before first render so Frame 0 is immediately framed
      const initKf = computeScrollCameraKeyframe(
        stateRef.current.scrollProgress,
        stateRef.current.focusedSubsystem,
        stateRef.current.explosionOverride
      );
      const initMobileScale = window.innerWidth < 768 ? 0.18 : 1.0;
      let currentExplosion = initKf.explosion;
      let currentRotX = initKf.modelRot[0];
      let currentRotY = initKf.modelRot[1];
      let currentRotZ = initKf.modelRot[2];

      assembly.setExplosion(currentExplosion, stateRef.current.focusedSubsystem);
      assembly.root.position.set(
        initKf.modelPos[0] * initMobileScale,
        initKf.modelPos[1],
        initKf.modelPos[2]
      );
      assembly.root.rotation.set(currentRotX, currentRotY, currentRotZ);
      camera.position.set(
        initKf.cameraPos[0] * initMobileScale,
        initKf.cameraPos[1],
        initKf.cameraPos[2] + (window.innerWidth < 768 ? 1.8 : 0)
      );
      _currentLookAt.set(
        initKf.lookAt[0] * initMobileScale,
        initKf.lookAt[1],
        initKf.lookAt[2]
      );
      camera.lookAt(_currentLookAt);

      let lastTime = performance.now();
      let fpsWindowStart = lastTime;
      let frameCount = 0;
      let lastTelemetryPush = 0;

      function afterDraw(cb: () => void) {
        if (!renderer || isDisposed) return;
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (typeof gl.fenceSync === 'function') {
          const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
          const poll = () => {
            if (isDisposed) return;
            const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
            if (status === gl.UNSIGNALED) {
              frameId = window.setTimeout(poll, 5);
            } else {
              if (sync) gl.deleteSync(sync);
              frameId = window.setTimeout(cb, 80);
            }
          };
          frameId = window.setTimeout(poll, 5);
        } else {
          frameId = window.setTimeout(cb, 80);
        }
      }

      function tick() {
        if (isDisposed || !renderer) return;
        const now = performance.now();
        const dt = Math.min(Math.max((now - lastTime) / 1000, 0.016), 0.12);
        lastTime = now;
        const elapsed = now * 0.001;

        const {
          scrollProgress: sp,
          focusedSubsystem: sub,
          explosionOverride: expOver,
          manualOrbit: isManual,
          onTelemetryChange: reportTelemetry,
        } = stateRef.current;

        const isMobile = window.innerWidth < 768;
        const kf = computeScrollCameraKeyframe(sp, sub, expOver);

        // Smooth pointer and camera interpolation
        const dampRate = isSoftwareGl ? 16.0 : 9.0;
        const dampFactor = 1 - Math.exp(-dampRate * dt);
        smoothPointerX += (pointerX - smoothPointerX) * dampFactor;
        smoothPointerY += (pointerY - smoothPointerY) * dampFactor;

        // Smooth explosion interpolation
        currentExplosion += (kf.explosion - currentExplosion) * dampFactor;
        assembly.setExplosion(currentExplosion, sub);

        // Subtle continuous counter-rotation of telemetry rings
        assembly.energyRings.rotation.z = elapsed * 0.14;
        assembly.energyRings.rotation.x = Math.sin(elapsed * 0.3) * 0.15;

        // Individual micro-kinematics on mechanical sub-parts
        assembly.parts.brake.rotation.z = -0.18 + elapsed * 0.35;
        assembly.parts.transmission.rotation.z = 0.18 - elapsed * 0.55;
        assembly.parts.engine.position.y += Math.sin(elapsed * 2.2) * 0.03;

        if (!isManual) {
          // On mobile screens, center the model horizontally so it doesn't clip off-screen
          const mobileXScale = isMobile ? 0.18 : 1.0;
          _targetModelPos.set(
            kf.modelPos[0] * mobileXScale + smoothPointerX * 0.18,
            kf.modelPos[1] - smoothPointerY * 0.12 + Math.sin(elapsed * 0.9) * 0.05,
            kf.modelPos[2]
          );
          assembly.root.position.lerp(_targetModelPos, dampFactor);

          const targetRx = kf.modelRot[0] + smoothPointerY * 0.22;
          const targetRy = kf.modelRot[1] + smoothPointerX * 0.38 + Math.sin(elapsed * 0.35) * 0.12;
          const targetRz = kf.modelRot[2] - smoothPointerX * 0.08;

          currentRotX += (targetRx - currentRotX) * dampFactor;
          currentRotY += (targetRy - currentRotY) * dampFactor;
          currentRotZ += (targetRz - currentRotZ) * dampFactor;
          assembly.root.rotation.set(currentRotX, currentRotY, currentRotZ);

          _targetCamPos.set(
            kf.cameraPos[0] * mobileXScale + smoothPointerX * 0.25,
            kf.cameraPos[1] - smoothPointerY * 0.18,
            kf.cameraPos[2] + (isMobile ? 1.35 : 0)
          );
          camera.position.lerp(_targetCamPos, dampFactor);

          _targetLookAt.set(
            kf.lookAt[0] * mobileXScale,
            kf.lookAt[1],
            kf.lookAt[2]
          );
          _currentLookAt.lerp(_targetLookAt, dampFactor);
          camera.lookAt(_currentLookAt);

          if (Math.abs(camera.fov - kf.fov) > 0.05) {
            camera.fov += (kf.fov - camera.fov) * dampFactor;
            camera.updateProjectionMatrix();
          }
        } else {
          // In manual 360° Studio Orbit mode, center model smoothly and let OrbitControls drive camera
          _targetModelPos.set(0, 0.1, 0);
          assembly.root.position.lerp(_targetModelPos, dampFactor);
          controls.update();
        }

        renderer.render(scene, camera);

        frameCount++;
        if (now - lastTelemetryPush > 450) {
          const elapsedFps = Math.max(now - fpsWindowStart, 1);
          const fps = Math.min(60, Math.max(24, Math.round((frameCount * 1000) / elapsedFps)));
          if (now - fpsWindowStart > 2000) {
            frameCount = 0;
            fpsWindowStart = now;
          }
          lastTelemetryPush = now;
          reportTelemetry?.({
            fps,
            stageLabel: kf.stageLabel,
            angleTitle: isManual ? 'CONTROLE ORBITAL 360° ATIVO' : kf.angleTitle,
            explosionPct: Math.round(currentExplosion * 100),
            webglActive: true,
          });
        }

        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = window.requestAnimationFrame(tick);
        }
      }

      tick();

      return () => {
        isDisposed = true;
        window.cancelAnimationFrame(frameId);
        window.clearTimeout(frameId);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('keydown', onKeyDown);
        controls.dispose();
        assembly.dispose();
        envTarget.dispose();
        renderer?.dispose();
      };
    } catch {
      setWebglFailed(true);
      stateRef.current.onTelemetryChange?.({
        fps: 0,
        stageLabel: 'ILUSTRAÇÃO TÉCNICA VETORIAL',
        angleTitle: 'MODO DE COMPATIBILIDADE SEM WEBGL',
        explosionPct: 0,
        webglActive: false,
      });
      return undefined;
    }
  }, []);

  return (
    <div
      className={`fixed inset-0 z-0 overflow-hidden transition-opacity duration-300 ${
        manualOrbit ? 'pointer-events-auto cursor-grab active:cursor-grabbing z-20' : 'pointer-events-none'
      }`}
      data-testid="scene-3d-viewport"
      data-manual-orbit={manualOrbit ? 'true' : 'false'}
    >
      {/* Subtle atmospheric radial lighting behind the 3D model */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 72% 36%, rgba(37, 99, 235, 0.16), transparent 52%), radial-gradient(ellipse at 28% 72%, rgba(234, 88, 12, 0.10), transparent 48%), linear-gradient(135deg, #030614 0%, #071226 100%)',
        }}
        aria-hidden="true"
      />

      {/* Precision CAD coordinate grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
        aria-hidden="true"
      />

      {/* Dedicated empty mount ref for Three.js WebGLRenderer */}
      <div ref={mountRef} className="relative w-full h-full" />

      {/* Technical SVG Fallback Poster if WebGL fails */}
      {webglFailed && (
        <div className="absolute inset-0 flex items-center justify-center p-8 opacity-40 pointer-events-none">
          <svg
            viewBox="0 0 700 650"
            className="w-full max-w-2xl h-auto"
            role="img"
            aria-label="Ilustração técnica de freio, pistão, transmissão e suspensão"
          >
            <circle cx="350" cy="325" r="220" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="8 6" />
            <circle cx="350" cy="325" r="150" fill="#0a1931" stroke="#ea580c" strokeWidth="3" />
            <circle cx="350" cy="325" r="65" fill="#030614" stroke="#94a3b8" strokeWidth="4" />
          </svg>
        </div>
      )}

      {/* Floating Exit Button when 360° Manual Orbit is active */}
      {manualOrbit && (
        <div className="fixed top-24 right-6 z-40 pointer-events-auto">
          <button
            type="button"
            onClick={onExitManualOrbit}
            className="px-4 py-2.5 bg-[#0a1931]/95 hover:bg-[#ea580c] text-white font-mono text-xs tracking-wider border border-[#ea580c] transition-colors shadow-xl whitespace-nowrap"
          >
            SAIR DO CONTROLE 3D (ESC) ✕
          </button>
        </div>
      )}
    </div>
  );
};
