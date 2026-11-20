import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { MUSCLE_BY_ID } from '../../data/muscles';
import { MuscleRecoveryStatus } from '../../types/fitness';

export type AnatomyViewPreset = 'front' | 'back' | 'left' | 'right' | 'reset';
export type BodySideSelection = 'both' | 'left' | 'right';
export type AnatomyColorMode = 'anatomy' | 'recovery';

interface Anatomy3DCanvasProps {
  selectedMuscleId: string;
  selectedSide: BodySideSelection;
  colorMode: AnatomyColorMode;
  recoveryMap: Record<string, MuscleRecoveryStatus>;
  viewPreset: AnatomyViewPreset;
  presetTrigger: number;
  onSelectMuscle: (muscleId: string, side: BodySideSelection) => void;
  onChangeViewPreset: (preset: AnatomyViewPreset) => void;
}

interface MusclePartSpec {
  muscleId: string;
  side: 'left' | 'right' | 'center';
  pos: [number, number, number];
  scale: [number, number, number];
  rot?: [number, number, number];
  shape?: 'sphere' | 'capsule' | 'box';
}

function buildBilateral(
  muscleId: string,
  pos: [number, number, number],
  scale: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
  shape: 'sphere' | 'capsule' | 'box' = 'sphere'
): MusclePartSpec[] {
  const [x, y, z] = pos;
  const [rx, ry, rz] = rot;
  return [
    { muscleId, side: 'right', pos: [-x, y, z], scale, rot: [rx, -ry, -rz], shape },
    { muscleId, side: 'left', pos: [x, y, z], scale, rot: [rx, ry, rz], shape },
  ];
}

// Complete 40-muscle anatomical sculpt coordinates around Y-up human figure (height ~ 1.76m, center waist ~ 0.92m)
const MUSCLE_SPECS: MusclePartSpec[] = [
  // NECK
  { muscleId: 'neck', side: 'right', pos: [-0.036, 1.46, 0.015], scale: [0.024, 0.068, 0.028], rot: [0.12, 0, -0.18], shape: 'capsule' },
  { muscleId: 'neck', side: 'left', pos: [0.036, 1.46, 0.015], scale: [0.024, 0.068, 0.028], rot: [0.12, 0, 0.18], shape: 'capsule' },

  // CHEST (Upper, Middle, Lower)
  ...buildBilateral('upper_chest', [0.088, 1.32, 0.088], [0.072, 0.04, 0.034], [-0.25, 0.25, 0.18]),
  ...buildBilateral('middle_chest', [0.095, 1.255, 0.098], [0.084, 0.048, 0.036], [0, 0.22, 0.05]),
  ...buildBilateral('lower_chest', [0.092, 1.195, 0.092], [0.078, 0.032, 0.032], [0.22, 0.22, -0.08]),

  // SHOULDERS (Front, Side, Rear)
  ...buildBilateral('front_delts', [0.215, 1.325, 0.042], [0.048, 0.058, 0.046], [-0.15, 0.2, -0.22]),
  ...buildBilateral('side_delts', [0.242, 1.325, 0.0], [0.046, 0.064, 0.048], [0, 0, -0.24]),
  ...buildBilateral('rear_delts', [0.215, 1.325, -0.044], [0.046, 0.055, 0.044], [0.15, -0.2, -0.2]),

  // BICEPS & BRACHIALIS
  ...buildBilateral('biceps_short', [0.255, 1.155, 0.026], [0.032, 0.082, 0.032], [0, 0, -0.1]),
  ...buildBilateral('biceps_long', [0.278, 1.155, 0.014], [0.031, 0.086, 0.032], [0, 0, -0.1]),
  ...buildBilateral('brachialis', [0.285, 1.11, -0.006], [0.028, 0.064, 0.028], [0, 0, -0.1]),

  // TRICEPS (Long, Lateral, Medial)
  ...buildBilateral('triceps_long', [0.258, 1.165, -0.028], [0.033, 0.086, 0.033], [0, 0, -0.1]),
  ...buildBilateral('triceps_lateral', [0.284, 1.175, -0.018], [0.03, 0.074, 0.03], [0, 0, -0.1]),
  ...buildBilateral('triceps_medial', [0.268, 1.09, -0.024], [0.026, 0.05, 0.026], [0, 0, -0.1]),

  // FOREARMS
  ...buildBilateral('forearms_flexors', [0.295, 0.94, 0.022], [0.031, 0.105, 0.029], [0, 0, -0.06], 'capsule'),
  ...buildBilateral('forearms_extensors', [0.305, 0.94, -0.016], [0.029, 0.102, 0.027], [0, 0, -0.06], 'capsule'),

  // ABS & OBLIQUES
  ...buildBilateral('upper_abs', [0.038, 1.11, 0.086], [0.034, 0.036, 0.025], [0, 0.1, 0]),
  ...buildBilateral('middle_abs', [0.038, 1.03, 0.088], [0.035, 0.038, 0.025], [0, 0.1, 0]),
  ...buildBilateral('lower_abs', [0.034, 0.945, 0.084], [0.033, 0.044, 0.024], [0.1, 0.1, 0]),
  ...buildBilateral('external_obliques', [0.108, 1.01, 0.045], [0.04, 0.095, 0.042], [0, 0.35, -0.14]),
  ...buildBilateral('internal_obliques', [0.092, 0.935, 0.056], [0.036, 0.052, 0.034], [0.1, 0.3, 0.15]),

  // BACK (Traps, Lats, Rhomboids, Teres, Rotator Cuff, Erectors)
  ...buildBilateral('traps_upper', [0.082, 1.395, -0.036], [0.072, 0.044, 0.038], [0.15, -0.2, 0.42]),
  ...buildBilateral('traps_middle', [0.062, 1.315, -0.068], [0.058, 0.048, 0.032], [0, -0.12, 0]),
  ...buildBilateral('traps_lower', [0.042, 1.225, -0.07], [0.045, 0.064, 0.026], [0, -0.1, -0.22]),
  ...buildBilateral('rhomboids', [0.085, 1.275, -0.074], [0.048, 0.052, 0.024], [0, -0.2, 0.1]),
  ...buildBilateral('rotator_cuff', [0.145, 1.28, -0.072], [0.044, 0.044, 0.028], [0, -0.35, 0]),
  ...buildBilateral('teres_major', [0.155, 1.22, -0.062], [0.042, 0.038, 0.03], [0, -0.3, 0.3]),
  ...buildBilateral('lats', [0.128, 1.13, -0.055], [0.07, 0.125, 0.042], [0, -0.35, -0.18]),
  ...buildBilateral('erector_spinae', [0.036, 1.03, -0.068], [0.032, 0.14, 0.03], [0, 0, 0], 'capsule'),

  // GLUTES & HIPS
  ...buildBilateral('gluteus_maximus', [0.086, 0.825, -0.075], [0.078, 0.086, 0.062], [0.12, -0.15, 0]),
  ...buildBilateral('gluteus_medius', [0.135, 0.875, -0.035], [0.046, 0.058, 0.048], [0, -0.45, -0.15]),
  ...buildBilateral('abductors', [0.145, 0.82, 0.015], [0.036, 0.074, 0.042], [0, 0.25, -0.1]),
  ...buildBilateral('adductors', [0.052, 0.695, 0.018], [0.042, 0.13, 0.044], [0, 0, 0.14]),

  // QUADS
  ...buildBilateral('rectus_femoris', [0.102, 0.65, 0.054], [0.044, 0.155, 0.042], [-0.04, 0, 0.02]),
  ...buildBilateral('vastus_lateralis', [0.142, 0.64, 0.022], [0.046, 0.15, 0.046], [0, 0.2, 0.04]),
  ...buildBilateral('vastus_medialis', [0.074, 0.54, 0.048], [0.036, 0.076, 0.036], [0, -0.15, -0.1]),

  // HAMSTRINGS
  ...buildBilateral('biceps_femoris', [0.128, 0.635, -0.048], [0.044, 0.15, 0.044], [0, -0.15, 0.02]),
  ...buildBilateral('semitendinosus', [0.08, 0.64, -0.052], [0.04, 0.15, 0.042], [0, 0.1, 0.03]),

  // LOWER LEGS (Calves & Shins)
  ...buildBilateral('gastrocnemius', [0.105, 0.34, -0.044], [0.044, 0.095, 0.042], [0.05, 0, 0]),
  ...buildBilateral('soleus', [0.105, 0.245, -0.032], [0.036, 0.088, 0.035], [0, 0, 0], 'capsule'),
  ...buildBilateral('tibialis_anterior', [0.114, 0.295, 0.032], [0.026, 0.105, 0.026], [0, 0.15, 0], 'capsule'),
];

const CAMERA_PRESETS: Record<AnatomyViewPreset, [number, number, number]> = {
  front: [0, 0.88, 3.25],
  back: [0, 0.88, -3.25],
  left: [3.25, 0.88, 0],
  right: [-3.25, 0.88, 0],
  reset: [0.65, 0.96, 3.15],
};

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 120);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const Anatomy3DCanvas: React.FC<Anatomy3DCanvasProps> = ({
  selectedMuscleId,
  selectedSide,
  colorMode,
  recoveryMap,
  viewPreset,
  presetTrigger,
  onSelectMuscle,
  onChangeViewPreset,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredInfo, setHoveredInfo] = useState<{
    name: string;
    side: string;
    recoveryPct?: number;
    x: number;
    y: number;
  } | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  const sceneRefs = useRef<{
    camera?: THREE.PerspectiveCamera;
    controls?: OrbitControls;
    requestRender?: () => void;
    muscleMeshes: Array<{
      mesh: THREE.Mesh;
      material: THREE.MeshStandardMaterial;
      muscleId: string;
      side: 'left' | 'right' | 'center';
    }>;
  }>({ muscleMeshes: [] });

  const latestPropsRef = useRef({
    selectedMuscleId,
    selectedSide,
    colorMode,
    recoveryMap,
    onSelectMuscle,
  });
  latestPropsRef.current = {
    selectedMuscleId,
    selectedSide,
    colorMode,
    recoveryMap,
    onSelectMuscle,
  };

  // Initialize Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      const probeCanvas = document.createElement('canvas');
      const probeGl =
        probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      let isSoftwareGl = false;
      if (probeGl) {
        const dbg = probeGl.getExtension('WEBGL_debug_renderer_info');
        const glRendererName = String(
          probeGl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : probeGl.RENDERER) || ''
        );
        isSoftwareGl = /swiftshader|llvmpipe|software/i.test(glRendererName);
      }

      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(container.clientWidth || 640, container.clientHeight || 520);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.touchAction = 'none';

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#090D10');

      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;

      const camera = new THREE.PerspectiveCamera(
        38,
        (container.clientWidth || 640) / (container.clientHeight || 520),
        0.1,
        50
      );
      camera.position.set(...CAMERA_PRESETS.front);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 0.78, 0);
      controls.enableDamping = !isSoftwareGl;
      controls.dampingFactor = 0.08;
      controls.minDistance = 1.45;
      controls.maxDistance = 4.8;
      controls.minPolarAngle = 0.25;
      controls.maxPolarAngle = Math.PI - 0.25;
      controls.update();

      // 3-Point Studio Lighting
      const hemi = new THREE.HemisphereLight('#d4f5ff', '#162026', 0.55);
      scene.add(hemi);

      const keyLight = new THREE.DirectionalLight('#fff5eb', 1.65);
      keyLight.position.set(2.4, 3.2, 2.8);
      if (!isSoftwareGl) {
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
      }
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight('#40E0D0', 1.1);
      rimLight.position.set(-2.5, 2.2, -2.5);
      scene.add(rimLight);

      const fillLight = new THREE.DirectionalLight('#B7FF67', 0.4);
      fillLight.position.set(0, 1.0, -2.8);
      scene.add(fillLight);

      // Floor Plinth & Calibration Ring
      const shadowTex = createContactShadowTexture();
      const shadowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 1.4),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
      );
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.y = 0.01;
      scene.add(shadowPlane);

      const ringGeo = new THREE.RingGeometry(0.48, 0.5, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: '#40E0D0',
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.012;
      scene.add(ringMesh);

      // Core mannequin frame (non-selectable structural head/spine/pelvis/hands/feet)
      const bodyGroup = new THREE.Group();
      scene.add(bodyGroup);

      const coreMat = new THREE.MeshStandardMaterial({
        color: '#1b2429',
        roughness: 0.62,
        metalness: 0.24,
      });
      const jointMat = new THREE.MeshStandardMaterial({
        color: '#26333a',
        roughness: 0.45,
        metalness: 0.4,
      });

      const addCore = (
        geo: THREE.BufferGeometry,
        pos: [number, number, number],
        scale: [number, number, number] = [1, 1, 1],
        mat: THREE.Material = coreMat
      ) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(...pos);
        m.scale.set(...scale);
        bodyGroup.add(m);
      };

      const sphereGeo = new THREE.SphereGeometry(1, 20, 16);
      const capsuleGeo = new THREE.CapsuleGeometry(0.5, 1, 10, 16);

      // Head + Cranium + Jaw + Cervical Spine Core
      addCore(sphereGeo, [0, 1.62, 0.01], [0.088, 0.11, 0.098]);
      addCore(sphereGeo, [0, 1.56, 0.025], [0.066, 0.055, 0.072]);
      addCore(capsuleGeo, [0, 1.45, 0], [0.076, 0.07, 0.076]);
      // Torso Core + Clavicle Bridge + Pelvis
      addCore(capsuleGeo, [0, 1.18, 0], [0.22, 0.2, 0.12]);
      addCore(sphereGeo, [0, 1.33, 0.01], [0.18, 0.065, 0.085]);
      addCore(sphereGeo, [0, 0.87, 0], [0.135, 0.078, 0.092]);
      // Shoulder, Elbow, Forearm, Thigh, Knee, Shin, Foot & Hand Connectors
      [-1, 1].forEach((s) => {
        addCore(sphereGeo, [s * 0.21, 1.32, 0], [0.048, 0.048, 0.048], jointMat);
        addCore(capsuleGeo, [s * 0.26, 1.16, 0], [0.07, 0.12, 0.07], coreMat);
        addCore(sphereGeo, [s * 0.275, 1.03, 0], [0.036, 0.036, 0.036], jointMat);
        addCore(capsuleGeo, [s * 0.295, 0.91, 0.005], [0.055, 0.11, 0.055], coreMat);
        addCore(sphereGeo, [s * 0.315, 0.77, 0.015], [0.032, 0.052, 0.025], jointMat);
        addCore(capsuleGeo, [s * 0.105, 0.65, 0], [0.105, 0.18, 0.105], coreMat);
        addCore(sphereGeo, [s * 0.105, 0.46, 0.015], [0.046, 0.046, 0.046], jointMat);
        addCore(capsuleGeo, [s * 0.105, 0.27, -0.005], [0.072, 0.17, 0.072], coreMat);
        addCore(sphereGeo, [s * 0.105, 0.055, 0.04], [0.045, 0.038, 0.095], jointMat);
      });

      // Build all selectable Muscle Meshes
      const createdMuscleMeshes: typeof sceneRefs.current.muscleMeshes = [];
      const boxGeo = new THREE.BoxGeometry(1, 1, 1);

      for (const spec of MUSCLE_SPECS) {
        const geo =
          spec.shape === 'capsule'
            ? capsuleGeo
            : spec.shape === 'box'
              ? boxGeo
              : sphereGeo;
        const mat = new THREE.MeshStandardMaterial({
          color: '#5a2d38',
          roughness: 0.44,
          metalness: 0.12,
          emissive: new THREE.Color('#000000'),
          emissiveIntensity: 0.0,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(...spec.pos);
        mesh.scale.set(...spec.scale);
        if (spec.rot) {
          mesh.rotation.set(...spec.rot);
        }
        mesh.userData = { muscleId: spec.muscleId, side: spec.side };
        bodyGroup.add(mesh);
        createdMuscleMeshes.push({
          mesh,
          material: mat,
          muscleId: spec.muscleId,
          side: spec.side,
        });
      }

      sceneRefs.current = {
        camera,
        controls,
        muscleMeshes: createdMuscleMeshes,
      };

      // On-demand rendering with frame pacing
      let rafId = 0;
      let dirty = true;
      let hoveredMesh: THREE.Mesh | null = null;

      const updateMaterials = () => {
        const {
          selectedMuscleId: selId,
          selectedSide: selSide,
          colorMode: mode,
          recoveryMap: recMap,
        } = latestPropsRef.current;

        for (const item of createdMuscleMeshes) {
          const isMuscleMatch = item.muscleId === selId;
          const isSideMatch =
            selSide === 'both' || item.side === 'center' || item.side === selSide;
          const isSelected = isMuscleMatch && isSideMatch;
          const isHovered = hoveredMesh === item.mesh;

          if (mode === 'recovery') {
            const status = recMap[item.muscleId];
            const pct = status?.recoveryPct ?? 90;
            const recColor =
              pct >= 78 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171';
            item.material.color.set(isSelected ? '#B7FF67' : recColor);
            item.material.emissive.set(
              isSelected ? '#B7FF67' : isHovered ? '#40E0D0' : '#000000'
            );
            item.material.emissiveIntensity = isSelected ? 0.5 : isHovered ? 0.35 : 0.05;
          } else {
            if (isSelected) {
              item.material.color.set('#B7FF67');
              item.material.emissive.set('#84cc16');
              item.material.emissiveIntensity = 0.45;
            } else if (isHovered) {
              item.material.color.set('#40E0D0');
              item.material.emissive.set('#0891b2');
              item.material.emissiveIntensity = 0.35;
            } else if (isMuscleMatch && !isSideMatch) {
              item.material.color.set('#445238');
              item.material.emissive.set('#000000');
              item.material.emissiveIntensity = 0;
            } else {
              item.material.color.set('#68303d');
              item.material.emissive.set('#1a080d');
              item.material.emissiveIntensity = 0.08;
            }
          }
        }
      };

      const renderFrame = () => {
        rafId = 0;
        if (!dirty) return;
        dirty = false;
        updateMaterials();
        const needsDamping = controls.update();
        renderer.render(scene, camera);
        if (needsDamping) {
          dirty = true;
          rafId = requestAnimationFrame(renderFrame);
        }
      };

      const requestRender = () => {
        dirty = true;
        if (!rafId) {
          rafId = requestAnimationFrame(renderFrame);
        }
      };
      sceneRefs.current.requestRender = requestRender;
      controls.addEventListener('change', requestRender);

      // Raycasting for Click & Throttled Hover
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const selectableMeshes = createdMuscleMeshes.map((m) => m.mesh);
      let downPos = { x: 0, y: 0 };
      let lastHoverCheck = 0;

      const getHit = (clientX: number, clientY: number) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(selectableMeshes, false);
        return hits[0] || null;
      };

      const onPointerDown = (e: PointerEvent) => {
        downPos = { x: e.clientX, y: e.clientY };
      };

      const onPointerUp = (e: PointerEvent) => {
        const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
        if (dist > 6) return;
        const hit = getHit(e.clientX, e.clientY);
        if (hit && hit.object.userData?.muscleId) {
          const { muscleId, side } = hit.object.userData as {
            muscleId: string;
            side: 'left' | 'right' | 'center';
          };
          const nextSide: BodySideSelection =
            side === 'left' || side === 'right' ? side : 'both';
          latestPropsRef.current.onSelectMuscle(muscleId, nextSide);
          requestRender();
        }
      };

      const onPointerMove = (e: PointerEvent) => {
        const now = performance.now();
        if (now - lastHoverCheck < 50) return;
        lastHoverCheck = now;
        const hit = getHit(e.clientX, e.clientY);
        if (hit && hit.object instanceof THREE.Mesh && hit.object.userData?.muscleId) {
          const { muscleId, side } = hit.object.userData as {
            muscleId: string;
            side: string;
          };
          const def = MUSCLE_BY_ID[muscleId];
          const rec = latestPropsRef.current.recoveryMap[muscleId];
          if (hoveredMesh !== hit.object) {
            hoveredMesh = hit.object;
            requestRender();
          }
          renderer.domElement.style.cursor = 'pointer';
          const rect = renderer.domElement.getBoundingClientRect();
          setHoveredInfo({
            name: def?.name || muscleId,
            side: side === 'center' ? 'Center' : side === 'left' ? 'Left Side' : 'Right Side',
            recoveryPct: rec?.recoveryPct,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
        } else {
          if (hoveredMesh) {
            hoveredMesh = null;
            requestRender();
          }
          renderer.domElement.style.cursor = 'grab';
          setHoveredInfo(null);
        }
      };

      const onPointerLeave = () => {
        if (hoveredMesh) {
          hoveredMesh = null;
          requestRender();
        }
        setHoveredInfo(null);
      };

      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      renderer.domElement.addEventListener('pointerup', onPointerUp);
      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerleave', onPointerLeave);

      // Resize observer
      const ro = new ResizeObserver(() => {
        const w = container.clientWidth || 640;
        const h = container.clientHeight || 520;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        requestRender();
      });
      ro.observe(container);

      requestRender();

      return () => {
        cancelAnimationFrame(rafId);
        ro.disconnect();
        controls.removeEventListener('change', requestRender);
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
        controls.dispose();
        sphereGeo.dispose();
        capsuleGeo.dispose();
        boxGeo.dispose();
        ringGeo.dispose();
        ringMat.dispose();
        coreMat.dispose();
        jointMat.dispose();
        shadowTex.dispose();
        envTex.dispose();
        pmrem.dispose();
        createdMuscleMeshes.forEach((m) => m.material.dispose());
        renderer.dispose();
      };
    } catch (err) {
      setWebglError(
        err instanceof Error
          ? `3D WebGL viewport could not initialize: ${err.message}`
          : '3D WebGL viewport is unavailable in this browser.'
      );
    }
  }, []);

  // Sync external selection/color mode changes
  useEffect(() => {
    sceneRefs.current.requestRender?.();
  }, [selectedMuscleId, selectedSide, colorMode, recoveryMap]);

  // Camera view preset updates
  useEffect(() => {
    const { camera, controls, requestRender } = sceneRefs.current;
    if (!camera || !controls || !requestRender) return;
    const targetPos = CAMERA_PRESETS[viewPreset] || CAMERA_PRESETS.front;
    camera.position.set(...targetPos);
    controls.target.set(0, 0.78, 0);
    controls.update();
    requestRender();
  }, [viewPreset, presetTrigger]);

  const handleZoom = (factor: number) => {
    const { camera, controls, requestRender } = sceneRefs.current;
    if (!camera || !controls || !requestRender) return;
    const offset = camera.position.clone().sub(controls.target);
    const nextDist = Math.max(1.35, Math.min(4.4, offset.length() * factor));
    offset.setLength(nextDist);
    camera.position.copy(controls.target).add(offset);
    controls.update();
    requestRender();
  };

  return (
    <div
      className="relative w-full h-[460px] sm:h-[540px] rounded-2xl bg-[#090D10] border border-white/10 overflow-hidden select-none"
      data-selected-muscle={selectedMuscleId}
      data-selected-side={selectedSide}
    >
      {webglError ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
          <p className="text-sm text-amber-300 font-medium">{webglError}</p>
          <p className="text-xs text-[#A0AAA7] mt-2 max-w-md">
            Use the 40-muscle region selector below to inspect anatomy details, recovery, and
            matched exercises.
          </p>
        </div>
      ) : (
        <div ref={containerRef} className="w-full h-full" />
      )}

      {/* Hover Tooltip (no backdrop-blur over canvas) */}
      {hoveredInfo && (
        <div
          className="pointer-events-none absolute z-20 px-3 py-2 rounded-lg bg-[#080B0D]/95 border border-[#40E0D0]/50 text-xs shadow-xl"
          style={{
            left: Math.min(hoveredInfo.x + 14, 420),
            top: Math.max(12, hoveredInfo.y - 44),
          }}
        >
          <div className="font-semibold text-[#F5F7F5]">{hoveredInfo.name}</div>
          <div className="text-[11px] text-[#40E0D0] flex items-center gap-2 mt-0.5">
            <span>{hoveredInfo.side}</span>
            {hoveredInfo.recoveryPct !== undefined && (
              <span className="font-mono text-[#B7FF67] tabular-nums">
                Est. Recovery: {hoveredInfo.recoveryPct}%
              </span>
            )}
          </div>
        </div>
      )}

      {/* Top Left Camera Angle Indicator */}
      <div className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-lg bg-[#080B0D]/90 border border-white/10 text-[11px] text-[#A0AAA7]">
        Drag to orbit · Scroll to zoom · Click muscle
      </div>

      {/* Bottom Camera Controls Dock (solid dark surface, zero backdrop-blur) */}
      <div className="absolute bottom-3 inset-x-3 z-10 flex flex-wrap items-center justify-between gap-2 bg-[#080B0D]/95 border border-white/15 rounded-xl px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'front', label: 'Front' },
              { id: 'back', label: 'Back' },
              { id: 'left', label: 'Left Side' },
              { id: 'right', label: 'Right Side' },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onChangeViewPreset(v.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                viewPreset === v.id
                  ? 'bg-[#B7FF67] text-[#080B0D] font-semibold'
                  : 'bg-[#151D20] text-[#A0AAA7] hover:text-white border border-white/10'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Zoom in 3D anatomy"
            onClick={() => handleZoom(0.84)}
            className="p-1.5 rounded-lg bg-[#151D20] text-[#F5F7F5] border border-white/10 hover:border-[#40E0D0] cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Zoom out 3D anatomy"
            onClick={() => handleZoom(1.18)}
            className="p-1.5 rounded-lg bg-[#151D20] text-[#F5F7F5] border border-white/10 hover:border-[#40E0D0] cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Reset 3D camera"
            onClick={() => onChangeViewPreset('reset')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#151D20] text-[#A0AAA7] hover:text-white border border-white/10 text-xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>
    </div>
  );
};
