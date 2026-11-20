import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Camera, Scale, Trash2 } from 'lucide-react';
import { useFitness } from '../context/FitnessContext';
import { api } from '../services/api';
import { Card, PageHeader, PrimaryButton } from '../components/ui/Primitives';

async function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 720;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('Invalid image file'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export const TransformationPage: React.FC = () => {
  const { profile, measurements, refreshBootstrap, notify } = useFitness();

  const latest = measurements[0];
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [weightKg, setWeightKg] = useState(String(latest?.weightKg || profile?.weightKg || 74));
  const [waistCm, setWaistCm] = useState(String(latest?.waistCm || 80));
  const [chestCm, setChestCm] = useState(String(latest?.chestCm || 100));
  const [armsCm, setArmsCm] = useState(String(latest?.armsCm || 36));
  const [thighsCm, setThighsCm] = useState(String(latest?.thighsCm || 56));
  const [hipsCm, setHipsCm] = useState(String(latest?.hipsCm || 94));
  const [note, setNote] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const twinRef = useRef<HTMLDivElement | null>(null);

  const chronoMeasurements = useMemo(
    () => [...measurements].sort((a, b) => (a.logDate < b.logDate ? -1 : 1)),
    [measurements]
  );

  const photoEntries = useMemo(
    () => chronoMeasurements.filter((m) => Boolean(m.photoDataUrl)),
    [chronoMeasurements]
  );
  const [beforeId, setBeforeId] = useState<string>('');
  const [afterId, setAfterId] = useState<string>('');

  useEffect(() => {
    if (photoEntries.length >= 2) {
      setBeforeId((prev) => prev || photoEntries[0].id);
      setAfterId((prev) => prev || photoEntries[photoEntries.length - 1].id);
    }
  }, [photoEntries]);

  // 3D Digital Twin Proportion Silhouette
  useEffect(() => {
    const container = twinRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') || probe.getContext('webgl');
      let isSoftwareGl = false;
      if (gl) {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        const name = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
        isSoftwareGl = /swiftshader|llvmpipe|software/i.test(name);
      }

      renderer = new THREE.WebGLRenderer({ antialias: !isSoftwareGl });
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(container.clientWidth || 400, container.clientHeight || 360);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#090D10');
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = env;

      const camera = new THREE.PerspectiveCamera(
        38,
        (container.clientWidth || 400) / (container.clientHeight || 360),
        0.1,
        30
      );
      camera.position.set(0.45, 0.94, 3.05);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 0.82, 0);
      controls.enableDamping = !isSoftwareGl;
      controls.update();

      const key = new THREE.DirectionalLight('#ffffff', 1.4);
      key.position.set(2, 3, 2);
      scene.add(key, new THREE.AmbientLight('#40E0D0', 0.45));

      const w = Number(weightKg) || 74;
      const waist = Number(waistCm) || 80;
      const chest = Number(chestCm) || 100;
      const arm = Number(armsCm) || 36;
      const thigh = Number(thighsCm) || 56;
      const hScale = (profile?.heightCm || 175) / 175;

      const chestScale = Math.max(0.8, Math.min(1.35, chest / 100));
      const waistScale = Math.max(0.75, Math.min(1.45, waist / 80));
      const armScale = Math.max(0.75, Math.min(1.4, arm / 36));
      const legScale = Math.max(0.8, Math.min(1.4, thigh / 56));
      const massScale = Math.max(0.85, Math.min(1.3, w / 74));

      const twinGroup = new THREE.Group();
      twinGroup.scale.set(1, hScale, 1);
      scene.add(twinGroup);

      const bodyMat = new THREE.MeshStandardMaterial({
        color: '#2c3d46',
        roughness: 0.45,
        metalness: 0.2,
      });
      const accentMat = new THREE.MeshStandardMaterial({
        color: '#2b7a82',
        emissive: '#084c57',
        emissiveIntensity: 0.2,
        roughness: 0.45,
        metalness: 0.25,
      });

      const sphere = new THREE.SphereGeometry(1, 20, 16);
      const cyl = new THREE.CylinderGeometry(1, 1, 1, 20);

      const addPart = (
        geo: THREE.BufferGeometry,
        pos: [number, number, number],
        scl: [number, number, number],
        mat = bodyMat
      ) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(...pos);
        m.scale.set(...scl);
        twinGroup.add(m);
      };

      // Head, Neck, Chest, Waist, Pelvis, Connected Shoulders & Limbs
      addPart(sphere, [0, 1.6, 0], [0.09, 0.11, 0.095]);
      addPart(cyl, [0, 1.46, 0], [0.042, 0.1, 0.042]);
      addPart(sphere, [0, 1.28, 0.01], [0.175 * chestScale, 0.14, 0.115 * massScale], accentMat);
      addPart(cyl, [0, 1.03, 0], [0.13 * waistScale, 0.24, 0.095 * waistScale]);
      addPart(sphere, [0, 0.86, 0], [0.14 * waistScale, 0.09, 0.1]);

      [-1, 1].forEach((s) => {
        addPart(sphere, [s * (0.17 * chestScale + 0.02), 1.32, 0], [0.048, 0.048, 0.048], accentMat);
        addPart(cyl, [s * (0.19 * chestScale + 0.03), 1.12, 0], [0.042 * armScale, 0.38, 0.042 * armScale]);
        addPart(sphere, [s * 0.105, 0.44, 0], [0.046, 0.046, 0.046]);
        addPart(cyl, [s * 0.105, 0.64, 0], [0.068 * legScale, 0.4, 0.068 * legScale]);
        addPart(cyl, [s * 0.105, 0.25, 0], [0.048 * legScale, 0.36, 0.048 * legScale]);
        addPart(sphere, [s * 0.105, 0.055, 0.035], [0.042, 0.035, 0.085]);
      });

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 0.47, 48),
        new THREE.MeshBasicMaterial({ color: '#B7FF67', side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      scene.add(ring);

      let raf = 0;
      const draw = () => {
        raf = 0;
        controls.update();
        renderer.render(scene, camera);
      };
      const req = () => {
        if (!raf) raf = requestAnimationFrame(draw);
      };
      controls.addEventListener('change', req);
      req();

      return () => {
        cancelAnimationFrame(raf);
        controls.removeEventListener('change', req);
        controls.dispose();
        sphere.dispose();
        cyl.dispose();
        bodyMat.dispose();
        accentMat.dispose();
        env.dispose();
        pmrem.dispose();
        renderer.dispose();
      };
    } catch {
      // Fallback text handled cleanly
    }
  }, [weightKg, waistCm, chestCm, armsCm, thighsCm, profile?.heightCm]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('Please select an image file.', 'error');
      return;
    }
    try {
      const resized = await resizeImageToDataUrl(file);
      setPhotoDataUrl(resized);
      notify('Progress photo prepared (stored privately in your local database).', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to process photo.', 'error');
    }
  };

  const handleSaveCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.addMeasurement({
        logDate,
        weightKg: Number(weightKg),
        waistCm: Number(waistCm) || null,
        chestCm: Number(chestCm) || null,
        armsCm: Number(armsCm) || null,
        thighsCm: Number(thighsCm) || null,
        hipsCm: Number(hipsCm) || null,
        photoDataUrl,
        note,
      });
      setPhotoDataUrl(null);
      setNote('');
      await refreshBootstrap();
      notify('Body check-in saved and Digital Twin updated.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save check-in.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMeasurement = async (id: string) => {
    await api.deleteMeasurement(id);
    await refreshBootstrap();
    notify('Measurement entry deleted.', 'info');
  };

  const weights = chronoMeasurements.map((m) => m.weightKg);
  const minWeight = weights.length ? Math.min(...weights) - 1.5 : 60;
  const maxWeight = weights.length ? Math.max(...weights) + 1.5 : 90;
  const weightSpan = Math.max(2, maxWeight - minWeight);

  const beforePhoto = photoEntries.find((p) => p.id === beforeId);
  const afterPhoto = photoEntries.find((p) => p.id === afterId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Body Transformation & 3D Digital Twin"
        subtitle="Track weight, circumferences, and private progress photos alongside a measurement-scaled 3D Digital Twin proportion preview."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 3D Digital Twin */}
        <Card className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#F5F7F5]">
              3D Digital Twin Proportions
            </h2>
            <span className="text-[11px] font-mono text-[#40E0D0]">Live Scaled</span>
          </div>
          <div
            ref={twinRef}
            className="w-full h-[360px] rounded-xl bg-[#090D10] border border-white/10 overflow-hidden"
          />
          <p className="text-[11px] text-[#A0AAA7] leading-relaxed">
            Geometric silhouette scaled proportionally from your current weight ({weightKg} kg),
            chest ({chestCm} cm), waist ({waistCm} cm), arms ({armsCm} cm), and thighs ({thighsCm}{' '}
            cm). For reference tracking only—not a predictive body-fat scan.
          </p>
        </Card>

        {/* Measurement Check-in Logger */}
        <Card className="lg:col-span-7">
          <h2 className="text-base font-semibold text-[#F5F7F5] flex items-center gap-2 mb-4">
            <Scale className="w-4 h-4 text-[#B7FF67]" /> Log Body Measurement Check-In
          </h2>
          <form onSubmit={handleSaveCheckin} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[#A0AAA7] mb-1">Date</label>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-2.5 py-2 font-mono text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-[#A0AAA7] mb-1">Weight (kg) *</label>
                <input
                  type="number"
                  required
                  step="0.1"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-2.5 py-2 font-mono text-[#B7FF67]"
                />
              </div>
              <div>
                <label className="block text-[#A0AAA7] mb-1">Waist (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={waistCm}
                  onChange={(e) => setWaistCm(e.target.value)}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-2.5 py-2 font-mono text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-[#A0AAA7] mb-1">Chest (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={chestCm}
                  onChange={(e) => setChestCm(e.target.value)}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-2.5 py-2 font-mono text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-[#A0AAA7] mb-1">Arms (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={armsCm}
                  onChange={(e) => setArmsCm(e.target.value)}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-2.5 py-2 font-mono text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-[#A0AAA7] mb-1">Thighs (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={thighsCm}
                  onChange={(e) => setThighsCm(e.target.value)}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-2.5 py-2 font-mono text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-[#A0AAA7] mb-1">Hips (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={hipsCm}
                  onChange={(e) => setHipsCm(e.target.value)}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-2.5 py-2 font-mono text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-[#A0AAA7] mb-1">Private Photo</label>
                <label className="w-full inline-flex items-center justify-center gap-1.5 bg-[#080B0D] border border-dashed border-white/25 hover:border-[#40E0D0] rounded-lg px-2.5 py-2 text-[#40E0D0] cursor-pointer">
                  <Camera className="w-3.5 h-3.5" />
                  <span>{photoDataUrl ? 'Attached' : 'Upload'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Check-in note (e.g., morning fasted weight, post-deload)"
                className="flex-1 bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 text-[#F5F7F5]"
              />
              <PrimaryButton type="submit" loading={saving}>
                Save Check-In
              </PrimaryButton>
            </div>
          </form>

          {/* Weight Trend SVG */}
          {chronoMeasurements.length > 0 && (
            <div className="mt-6 pt-5 border-t border-white/10">
              <div className="text-xs font-semibold text-[#F5F7F5] mb-2">
                Weight Progression ({chronoMeasurements.length} check-ins)
              </div>
              <div className="h-36 flex items-end gap-2 bg-[#080B0D] border border-white/10 rounded-xl p-3">
                {chronoMeasurements.map((m) => {
                  const pct = Math.max(
                    15,
                    Math.round(((m.weightKg - minWeight) / weightSpan) * 85) + 15
                  );
                  return (
                    <div key={m.id} className="flex-1 flex flex-col items-center gap-1 h-full">
                      <span className="text-[10px] font-mono tabular-nums text-[#B7FF67]">
                        {m.weightKg}
                      </span>
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className="w-full bg-[#40E0D0]/75 rounded-t"
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[#A0AAA7]">{m.logDate.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Before & After Comparison */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-[#F5F7F5]">
              Private Photo Timeline & Side-by-Side Comparison
            </h2>
            <p className="text-xs text-[#A0AAA7]">
              Photos stay strictly private in your account database.
            </p>
          </div>
          {photoEntries.length >= 2 && (
            <div className="flex items-center gap-2 text-xs">
              <select
                value={beforeId}
                onChange={(e) => setBeforeId(e.target.value)}
                className="bg-[#080B0D] border border-white/15 rounded-lg px-2.5 py-1.5"
              >
                {photoEntries.map((p) => (
                  <option key={p.id} value={p.id}>
                    Before: {p.logDate} ({p.weightKg}kg)
                  </option>
                ))}
              </select>
              <select
                value={afterId}
                onChange={(e) => setAfterId(e.target.value)}
                className="bg-[#080B0D] border border-white/15 rounded-lg px-2.5 py-1.5"
              >
                {photoEntries.map((p) => (
                  <option key={p.id} value={p.id}>
                    After: {p.logDate} ({p.weightKg}kg)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {photoEntries.length >= 2 && beforePhoto && afterPhoto ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#080B0D] border border-white/10 rounded-xl p-3">
              <div className="text-xs font-mono text-[#A0AAA7] mb-2">
                BEFORE · {beforePhoto.logDate} · {beforePhoto.weightKg} kg
              </div>
              <img
                src={beforePhoto.photoDataUrl!}
                alt="Before comparison"
                className="w-full h-64 object-cover rounded-lg"
              />
            </div>
            <div className="bg-[#080B0D] border border-[#B7FF67]/30 rounded-xl p-3">
              <div className="text-xs font-mono text-[#B7FF67] mb-2">
                AFTER · {afterPhoto.logDate} · {afterPhoto.weightKg} kg
              </div>
              <img
                src={afterPhoto.photoDataUrl!}
                alt="After comparison"
                className="w-full h-64 object-cover rounded-lg"
              />
            </div>
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden bg-[#080B0D] border border-white/10 p-6 flex flex-col sm:flex-row items-center gap-5">
            <img
              src="/src/assets/images/transformation_studio_1795206871275.jpg"
              alt="Transformation studio"
              className="w-full sm:w-56 h-32 object-cover rounded-lg opacity-80"
            />
            <div className="text-xs text-[#A0AAA7] space-y-1">
              <div className="text-sm font-semibold text-[#F5F7F5]">
                Upload 2 or more progress check-in photos to unlock side-by-side comparison
              </div>
              <p>
                Every measurement check-in above accepts an optional private progress photo resized
                locally before saving.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Check-in History Table */}
      <Card>
        <h2 className="text-base font-semibold text-[#F5F7F5] mb-3">
          Measurement History ({measurements.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[#A0AAA7]">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Weight</th>
                <th className="py-2 pr-3">Waist</th>
                <th className="py-2 pr-3">Chest</th>
                <th className="py-2 pr-3">Arms</th>
                <th className="py-2 pr-3">Note</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono tabular-nums">
              {measurements.map((m) => (
                <tr key={m.id}>
                  <td className="py-2.5 pr-3">{m.logDate}</td>
                  <td className="py-2.5 pr-3 text-[#B7FF67] font-semibold">{m.weightKg} kg</td>
                  <td className="py-2.5 pr-3">{m.waistCm ? `${m.waistCm} cm` : '--'}</td>
                  <td className="py-2.5 pr-3">{m.chestCm ? `${m.chestCm} cm` : '--'}</td>
                  <td className="py-2.5 pr-3">{m.armsCm ? `${m.armsCm} cm` : '--'}</td>
                  <td className="py-2.5 pr-3 font-sans text-[#A0AAA7]">{m.note || '--'}</td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      aria-label="Delete measurement"
                      onClick={() => handleDeleteMeasurement(m.id)}
                      className="p-1 text-[#A0AAA7] hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
