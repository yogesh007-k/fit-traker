import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, RotateCcw, ShieldCheck } from 'lucide-react';
import { FilesetResolver, PoseLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { Card, PageHeader, PrimaryButton, SecondaryButton } from '../components/ui/Primitives';

type FormExercise = 'squat' | 'pushup' | 'plank' | 'lunge' | 'shoulder_press';

const FORM_GUIDES: Record<
  FormExercise,
  { label: string; cue: string; metricLabel: string }
> = {
  squat: {
    label: 'Bodyweight / Barbell Squat',
    cue: 'Tracks knee angle (hip-knee-ankle). Target below 100° at bottom, then stand tall above 158°.',
    metricLabel: 'Knee Angle',
  },
  pushup: {
    label: 'Push-up',
    cue: 'Tracks elbow angle (shoulder-elbow-wrist). Lower chest until elbow < 95°, press back above 155°.',
    metricLabel: 'Elbow Angle',
  },
  plank: {
    label: 'Forearm / High Plank',
    cue: 'Tracks torso alignment (shoulder-hip-ankle). Keep angle between 160° and 195° without hip sag.',
    metricLabel: 'Body Line Angle',
  },
  lunge: {
    label: 'Split Squat / Lunge',
    cue: 'Tracks lead knee flexion. Lower steadily toward ~95° with upright torso.',
    metricLabel: 'Lead Knee Angle',
  },
  shoulder_press: {
    label: 'Overhead Shoulder Press',
    cue: 'Tracks elbow & shoulder elevation. Press smoothly overhead above 155° without rib flare.',
    metricLabel: 'Press Angle',
  },
};

function calcAngleDeg(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag1 = Math.hypot(abx, aby);
  const mag2 = Math.hypot(cbx, cby);
  if (mag1 === 0 || mag2 === 0) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.round((Math.acos(cos) * 180) / Math.PI);
}

const POSE_LINKS: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

export const FormLabPage: React.FC = () => {
  const [exercise, setExercise] = useState<FormExercise>('squat');
  const [cameraActive, setCameraActive] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reps, setReps] = useState(0);
  const [liveAngle, setLiveAngle] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string>(
    'Camera is off. Click "Enable Camera Form Analysis" to start real-time pose tracking.'
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number>(0);
  const phaseRef = useRef<'up' | 'down'>('up');
  const exerciseRef = useRef<FormExercise>(exercise);
  exerciseRef.current = exercise;

  const stopCamera = () => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setLiveAngle(null);
  };

  useEffect(() => {
    return () => {
      stopCamera();
      landmarkerRef.current?.close();
    };
  }, []);

  const startCameraAnalysis = async () => {
    setErrorMsg(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg('Camera access is not supported in this browser or context.');
      return;
    }

    setInitializing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;

      if (!landmarkerRef.current) {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
      setFeedback('Pose model active. Position your full body clearly inside the frame.');

      let lastTime = -1;
      const tick = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const lm = landmarkerRef.current;
        if (!video || !canvas || !lm || !streamRef.current) return;

        if (video.readyState >= 2 && video.currentTime !== lastTime) {
          lastTime = video.currentTime;
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const result = lm.detectForVideo(video, performance.now());
            const pose = result.landmarks?.[0];

            if (pose && pose.length >= 29) {
              // Draw skeleton
              ctx.strokeStyle = '#40E0D0';
              ctx.lineWidth = 3;
              for (const [i, j] of POSE_LINKS) {
                const a = pose[i];
                const b = pose[j];
                if (a && b && (a.visibility ?? 1) > 0.4 && (b.visibility ?? 1) > 0.4) {
                  ctx.beginPath();
                  ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
                  ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
                  ctx.stroke();
                }
              }
              ctx.fillStyle = '#B7FF67';
              for (const idx of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
                const pt = pose[idx];
                if (pt && (pt.visibility ?? 1) > 0.4) {
                  ctx.beginPath();
                  ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 5, 0, Math.PI * 2);
                  ctx.fill();
                }
              }

              // Angle evaluation
              const mode = exerciseRef.current;
              let angle = 180;
              if (mode === 'squat' || mode === 'lunge') {
                angle = calcAngleDeg(pose[24], pose[26], pose[28]);
                if (angle < 105) {
                  phaseRef.current = 'down';
                  setFeedback('Good depth — drive cleanly back up through mid-foot.');
                } else if (angle > 158 && phaseRef.current === 'down') {
                  phaseRef.current = 'up';
                  setReps((r) => r + 1);
                  setFeedback('Rep counted. Maintain braced core for the next rep.');
                } else {
                  setFeedback('Control descent and keep knees tracking over toes.');
                }
              } else if (mode === 'pushup' || mode === 'shoulder_press') {
                angle = calcAngleDeg(pose[12], pose[14], pose[16]);
                if (mode === 'pushup') {
                  if (angle < 95) {
                    phaseRef.current = 'down';
                    setFeedback('Solid bottom position — press forcefully to lockout.');
                  } else if (angle > 155 && phaseRef.current === 'down') {
                    phaseRef.current = 'up';
                    setReps((r) => r + 1);
                    setFeedback('Rep counted. Keep ribcage and pelvis locked.');
                  }
                } else {
                  if (angle < 95) {
                    phaseRef.current = 'down';
                    setFeedback('Ready at rack position — press smoothly overhead.');
                  } else if (angle > 158 && phaseRef.current === 'down') {
                    phaseRef.current = 'up';
                    setReps((r) => r + 1);
                    setFeedback('Lockout rep counted. Avoid lower-back arch.');
                  }
                }
              } else if (mode === 'plank') {
                angle = calcAngleDeg(pose[12], pose[24], pose[28]);
                if (angle >= 160 && angle <= 195) {
                  setFeedback('Aligned plank posture — keep glutes and abs engaged.');
                } else if (angle < 160) {
                  setFeedback('Hips look piked or bent — lengthen your spine and brace.');
                } else {
                  setFeedback('Hips sagging slightly — squeeze glutes to level pelvis.');
                }
              }
              setLiveAngle(angle);
            } else {
              setFeedback('No full pose detected yet. Step back so shoulders and hips are visible.');
            }
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      stopCamera();
      setErrorMsg(
        err instanceof Error
          ? `Camera or Pose Model unavailable: ${err.message}`
          : 'Camera permission was denied or no webcam was detected.'
      );
    } finally {
      setInitializing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Form Check Lab"
        subtitle="Real-time browser-side MediaPipe PoseLandmarker joint angle analysis. Camera permission is only requested when you activate the feed."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {cameraActive ? (
              <SecondaryButton
                onClick={stopCamera}
                className="border-red-500/40 text-red-300 hover:border-red-400"
              >
                <CameraOff className="w-4 h-4" /> Stop Camera
              </SecondaryButton>
            ) : (
              <PrimaryButton onClick={startCameraAnalysis} loading={initializing}>
                <Camera className="w-4 h-4" /> Enable Camera Form Analysis
              </PrimaryButton>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(FORM_GUIDES) as FormExercise[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setExercise(key);
                  setReps(0);
                  phaseRef.current = 'up';
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  exercise === key
                    ? 'bg-[#B7FF67] text-[#080B0D] font-semibold'
                    : 'bg-[#080B0D] border border-white/10 text-[#A0AAA7] hover:text-white'
                }`}
              >
                {FORM_GUIDES[key].label}
              </button>
            ))}
          </div>

          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#080B0D] border border-white/10 flex items-center justify-center">
            {!cameraActive && (
              <div className="relative w-full h-full flex flex-col items-center justify-center text-center p-6">
                <img
                  src="/src/assets/images/form_lab_guide_1795206870775.jpg"
                  alt="AI Form Lab calibration guide"
                  className="absolute inset-0 w-full h-full object-cover opacity-25"
                />
                <div className="relative z-10 max-w-md space-y-3">
                  <Camera className="w-10 h-10 text-[#B7FF67] mx-auto" />
                  <h3 className="text-lg font-bold text-[#F5F7F5]">Camera Standby</h3>
                  <p className="text-xs text-[#A0AAA7] leading-relaxed">
                    Video frames are processed locally inside your browser using MediaPipe
                    PoseLandmarker. No video stream is uploaded or stored on the server.
                  </p>
                  {errorMsg && (
                    <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-xs text-red-200">
                      {errorMsg}
                    </div>
                  )}
                </div>
              </div>
            )}

            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
            />
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none ${
                cameraActive ? 'block' : 'hidden'
              }`}
            />
          </div>
        </Card>

        <div className="lg:col-span-4 space-y-4">
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-[#40E0D0]">
                Live Telemetry
              </span>
              <button
                type="button"
                onClick={() => setReps(0)}
                className="text-xs text-[#A0AAA7] hover:text-white inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Reps
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#080B0D] border border-white/10 rounded-xl p-3.5">
                <div className="text-xs text-[#A0AAA7]">Reps Counted</div>
                <div className="text-3xl font-bold font-mono tabular-nums text-[#B7FF67] mt-1">
                  {reps}
                </div>
              </div>
              <div className="bg-[#080B0D] border border-white/10 rounded-xl p-3.5">
                <div className="text-xs text-[#A0AAA7]">{FORM_GUIDES[exercise].metricLabel}</div>
                <div className="text-3xl font-bold font-mono tabular-nums text-[#40E0D0] mt-1">
                  {liveAngle !== null ? `${liveAngle}°` : '--'}
                </div>
              </div>
            </div>

            <div className="bg-[#080B0D] border border-white/10 rounded-xl p-3.5 text-xs">
              <div className="font-semibold text-[#F5F7F5] mb-1">Real-Time Form Cue</div>
              <p className="text-[#A0AAA7] leading-relaxed">{feedback}</p>
            </div>

            <div className="bg-[#080B0D] border border-white/10 rounded-xl p-3.5 text-xs">
              <div className="font-semibold text-[#40E0D0] mb-1">Calibration Guide</div>
              <p className="text-[#A0AAA7] leading-relaxed">{FORM_GUIDES[exercise].cue}</p>
            </div>

            <div className="flex items-start gap-2 text-[11px] text-[#A0AAA7] pt-1">
              <ShieldCheck className="w-4 h-4 text-[#B7FF67] shrink-0 mt-0.5" />
              <span>
                Form Lab provides geometric posture feedback only and is not a clinical or
                medical diagnostic tool.
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
