"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

// Camera preset positions
const CAMERA_PRESETS = {
  default: { position: [0, 8.5, 26], target: [0, 0, 0], name: "Default" },
  overhead: { position: [0, 35, 0], target: [0, 0, 0], name: "Overhead" },
  side: { position: [30, 8, 0], target: [0, 0, 0], name: "Side View" },
  low: { position: [0, 2, 15], target: [0, 0, 0], name: "Low Angle" },
  diagonal: { position: [20, 15, 20], target: [0, 0, 0], name: "Diagonal" },
  close: { position: [0, 5, 10], target: [0, 0, 0], name: "Close Up" },
  bird: { position: [0, 50, 30], target: [0, 0, 0], name: "Bird's Eye" },
  ground: { position: [0, 0.5, 5], target: [0, 2, 0], name: "Ground Level" },
} as const;

type CameraPreset = keyof typeof CAMERA_PRESETS;

/**
 * Animated red dotted wave with interactive camera controls.
 * Drop this component anywhere in a Next.js (App Router) page.
 * Tailwind: the container is absolute and fills its parent.
 */
export default function RedDotWave({
  dotSpacing = 0.25, // distance between dots
  gridSize = 10, // number of dots per side (squared total)
  amplitude = 4, // wave height
  speed = 0.8, // animation speed
  color = "#ff2d20", // red tint
  background = "#000000",
  fov = 80,
  showControls = true, // show camera controls
  initialCameraPosition = [25, 8, 0], // initial camera position
  initialCameraTarget = [0, 0, 0], // what the camera looks at
}: {
  dotSpacing?: number;
  gridSize?: number;
  amplitude?: number;
  speed?: number;
  color?: string;
  background?: string;
  fov?: number;
  showControls?: boolean;
  initialCameraPosition?: [number, number, number];
  initialCameraTarget?: [number, number, number];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rafRef = useRef<number | null>(null);
  
  // Camera state
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>(initialCameraPosition);
  const [cameraTarget, setCameraTarget] = useState<[number, number, number]>(initialCameraTarget);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showControlPanel, setShowControlPanel] = useState(false);

  // Smooth camera transition
  const transitionToPosition = useCallback((newPosition: [number, number, number], newTarget: [number, number, number]) => {
    if (!cameraRef.current || isTransitioning) return;
    
    setIsTransitioning(true);
    const camera = cameraRef.current;
    const startPos = camera.position.clone();
    const endPos = new THREE.Vector3(...newPosition);
    const startTarget = new THREE.Vector3(...cameraTarget);
    const endTarget = new THREE.Vector3(...newTarget);
    
    const duration = 1500; // ms
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth transition
      const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
      const easedProgress = easeInOutCubic(progress);
      
      // Interpolate position
      camera.position.lerpVectors(startPos, endPos, easedProgress);
      
      // Interpolate target
      const currentTarget = new THREE.Vector3().lerpVectors(startTarget, endTarget, easedProgress);
      camera.lookAt(currentTarget);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCameraPosition(newPosition);
        setCameraTarget(newTarget);
        setIsTransitioning(false);
      }
    };
    
    animate();
  }, [cameraTarget, isTransitioning]);

  const selectPreset = useCallback((preset: CameraPreset) => {
    const { position, target } = CAMERA_PRESETS[preset];
    transitionToPosition(position as [number, number, number], target as [number, number, number]);
  }, [transitionToPosition]);

  useEffect(() => {
    const container = containerRef.current!;

    // Scene setup
    const scene = new THREE.Scene();
    const fog = new THREE.Fog(background, 18, 45);
    scene.fog = fog;

    const camera = new THREE.PerspectiveCamera(
      fov,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(...cameraPosition);
    camera.lookAt(...cameraTarget);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(new THREE.Color(background), 1);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Build a grid of points
    const half = (gridSize * dotSpacing) / 2;
    const positions = new Float32Array(gridSize * gridSize * 3);
    let i = 0;
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const px = x * dotSpacing - half;
        const py = 0; // vertical center; z will be height in shader
        const pz = y * dotSpacing - half;
        positions[i++] = px;
        positions[i++] = py;
        positions[i++] = pz;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    // Custom shader to animate the wave and soft-dot glow
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uAmp: { value: amplitude },
        uSpeed: { value: speed },
        uColor: { value: new THREE.Color(color) },
        uFogNear: { value: fog.near },
        uFogFar: { value: fog.far },
        uFogColor: { value: new THREE.Color(background) },
      },
      vertexShader: /* glsl */ `
        uniform float uTime; 
        uniform float uAmp; 
        uniform float uSpeed; 
        varying float vHeight; 
        void main() {
          vec3 p = position; 
          float d = length(p.xz) * 0.35; 
          // Two traveling sine waves to get the dune-like shape
          float h = sin(d - uTime * uSpeed) * 0.6 + 
                    sin(p.x * 0.45 + uTime * (uSpeed * 0.6)) * 0.4; 
          p.y += h * uAmp; 
          vHeight = p.y; 
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = 1.5 + (vHeight + 1.0) * 1.8; // size varies with height
          gl_Position = projectionMatrix * mvPosition; 
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; 
        uniform vec3 uFogColor; 
        uniform float uFogNear; 
        uniform float uFogFar; 
        varying float vHeight; 
        void main() {
          // circular point with soft edge
          vec2 uv = gl_PointCoord * 2.0 - 1.0; 
          float r = length(uv); 
          float alpha = smoothstep(1.0, 0.5, r); 
          vec3 col = uColor * (0.6 + 0.6 * smoothstep(-0.7, 1.1, vHeight));
          gl_FragColor = vec4(col, alpha);

          // fog
          #ifdef GL_ES
          float depth = gl_FragCoord.z / gl_FragCoord.w; 
          #else
          float depth = gl_FragCoord.z; 
          #endif
          float fogFactor = smoothstep(uFogNear, uFogFar, depth); 
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, fogFactor);
        }
      `,
    });

    const points = new THREE.Points(geometry, material);
    points.rotation.x = -0.3; // slight tilt like the reference image
    scene.add(points);

    // Light misty rim glow using post-like additive plane of particles at the back
    // (cheap trick for more mood without real postprocessing)
    const rimGeom = new THREE.PlaneGeometry(300, 80, 1, 1);
    const rimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending });
    const rim = new THREE.Mesh(rimGeom, rimMat);
    rim.position.z = -40;
    rim.position.y = -12;
    scene.add(rim);

    const clock = new THREE.Clock();
    const animate = () => {
      const t = clock.getElapsedTime();
      (material.uniforms.uTime.value as number) = t;
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      geometry.dispose();
      material.dispose();
      rimGeom.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [amplitude, background, color, dotSpacing, gridSize, speed, fov, cameraPosition, cameraTarget]);

  // Manual camera position controls
  const adjustCamera = (axis: 'x' | 'y' | 'z', delta: number, isPosition: boolean = true) => {
    if (isTransitioning) return;
    
    if (isPosition) {
      const newPosition = [...cameraPosition] as [number, number, number];
      const axisIndex = { x: 0, y: 1, z: 2 }[axis];
      newPosition[axisIndex] += delta;
      
      if (cameraRef.current) {
        cameraRef.current.position.set(...newPosition);
        cameraRef.current.lookAt(...cameraTarget);
        setCameraPosition(newPosition);
      }
    } else {
      const newTarget = [...cameraTarget] as [number, number, number];
      const axisIndex = { x: 0, y: 1, z: 2 }[axis];
      newTarget[axisIndex] += delta;
      
      if (cameraRef.current) {
        cameraRef.current.lookAt(...newTarget);
        setCameraTarget(newTarget);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-black">
      {/* Optional overlay gradient & vignette for drama */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      <div className="pointer-events-none absolute inset-0 [box-shadow:inset_0_0_200px_#000]" />
      
      {/* Camera Controls */}
      {showControls && (
        <>
          {/* Toggle Controls Button */}
          <button
            onClick={() => setShowControlPanel(!showControlPanel)}
            className="absolute top-4 right-4 z-10 rounded-lg bg-black/60 backdrop-blur-sm px-3 py-2 text-white/80 hover:bg-black/80 hover:text-white transition-all duration-200"
            disabled={isTransitioning}
          >
            🎥 {showControlPanel ? 'Hide' : 'Camera'}
          </button>

          {/* Preset Buttons */}
          <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2 max-w-xs">
            {Object.entries(CAMERA_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => selectPreset(key as CameraPreset)}
                disabled={isTransitioning}
                className="rounded-md bg-black/60 backdrop-blur-sm px-2 py-1 text-xs text-white/80 hover:bg-black/80 hover:text-white transition-all duration-200 disabled:opacity-50"
              >
                {preset.name}
              </button>
            ))}
          </div>

          {/* Manual Control Panel */}
          {showControlPanel && (
            <div className="absolute bottom-20 right-4 z-10 rounded-lg bg-black/80 backdrop-blur-sm p-4 text-white/90 space-y-4 max-w-xs">
              <div className="text-sm font-semibold text-center">Manual Controls</div>
              
              {/* Position Controls */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-white/70">Camera Position</div>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  {(['x', 'y', 'z'] as const).map((axis) => (
                    <div key={axis} className="space-y-1">
                      <div className="text-center text-white/60 uppercase">{axis}</div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => adjustCamera(axis, axis === 'y' ? 2 : 1, true)}
                          className="bg-white/10 hover:bg-white/20 rounded px-1 py-0.5"
                          disabled={isTransitioning}
                        >
                          +
                        </button>
                        <button
                          onClick={() => adjustCamera(axis, axis === 'y' ? -2 : -1, true)}
                          className="bg-white/10 hover:bg-white/20 rounded px-1 py-0.5"
                          disabled={isTransitioning}
                        >
                          -
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Target Controls */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-white/70">Look At Target</div>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  {(['x', 'y', 'z'] as const).map((axis) => (
                    <div key={axis} className="space-y-1">
                      <div className="text-center text-white/60 uppercase">{axis}</div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => adjustCamera(axis, 1, false)}
                          className="bg-white/10 hover:bg-white/20 rounded px-1 py-0.5"
                          disabled={isTransitioning}
                        >
                          +
                        </button>
                        <button
                          onClick={() => adjustCamera(axis, -1, false)}
                          className="bg-white/10 hover:bg-white/20 rounded px-1 py-0.5"
                          disabled={isTransitioning}
                        >
                          -
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Position Display */}
              <div className="text-xs text-white/60 space-y-1">
                <div>Pos: [{cameraPosition.map(v => v.toFixed(1)).join(', ')}]</div>
                <div>Target: [{cameraTarget.map(v => v.toFixed(1)).join(', ')}]</div>
              </div>
            </div>
          )}

          {/* Transition Indicator */}
          {isTransitioning && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 bg-black/80 backdrop-blur-sm rounded-lg px-4 py-2 text-white/90">
              🎬 Transitioning view...
            </div>
          )}
        </>
      )}
    </div>
  );
}
