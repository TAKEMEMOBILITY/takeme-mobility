'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer, RenderPass, BloomEffect, EffectPass } from 'postprocessing';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ── Constants ────────────────────────────────────────────────────────────

const BG_COLOR = 0x03080f;
const BUILDING_COLORS = [0x0a1020, 0x0d1525, 0x111830, 0x0e1a2e];

interface QualityTier {
  buildings: number;
  rainPrimary: number;
  rainSecondary: number;
  bloom: boolean;
  lights: number;
  particles: number;
}

function getQuality(w: number): QualityTier {
  if (w < 768) return { buildings: 60, rainPrimary: 500, rainSecondary: 0, bloom: false, lights: 2, particles: 100 };
  if (w <= 1024) return { buildings: 150, rainPrimary: 1500, rainSecondary: 250, bloom: true, lights: 3, particles: 300 };
  return { buildings: 300, rainPrimary: 3000, rainSecondary: 500, bloom: true, lights: 3, particles: 500 };
}

// ── Window texture generation ────────────────────────────────────────────

function createWindowTexture(bw: number, bh: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const cols = Math.max(2, Math.floor(bw * 1.5));
  const rows = Math.max(3, Math.floor(bh * 0.5));
  canvas.width = cols * 8;
  canvas.height = rows * 8;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.random() < 0.15) {
        ctx.fillStyle = Math.random() > 0.4 ? '#FFD580' : '#E8F0FF';
        ctx.fillRect(c * 8 + 1, r * 8 + 1, 5, 5);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

// ── Building generation ──────────────────────────────────────────────────

function createBuildings(scene: THREE.Scene, count: number): { meshes: THREE.Mesh[]; textures: THREE.CanvasTexture[] } {
  const meshes: THREE.Mesh[] = [];
  const textures: THREE.CanvasTexture[] = [];
  const gridSize = Math.ceil(Math.sqrt(count));
  const spacing = 30;

  for (let i = 0; i < count; i++) {
    const gx = (i % gridSize) - gridSize / 2;
    const gz = Math.floor(i / gridSize) - gridSize / 2;

    const w = 6 + Math.random() * 14;
    const d = 6 + Math.random() * 14;
    const h = 8 + Math.random() * 112;

    const geo = new THREE.BoxGeometry(w, h, d);
    const colorIdx = Math.floor(Math.random() * BUILDING_COLORS.length);

    const winTex = createWindowTexture(w, h);
    textures.push(winTex);

    const mat = new THREE.MeshStandardMaterial({
      color: BUILDING_COLORS[colorIdx],
      roughness: 0.9,
      metalness: 0.1,
      emissiveMap: winTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.8,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      gx * spacing + (Math.random() - 0.5) * 15,
      h / 2,
      gz * spacing + (Math.random() - 0.5) * 15,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    meshes.push(mesh);
  }

  return { meshes, textures };
}

// ── Rain system ──────────────────────────────────────────────────────────

interface RainSystem {
  mesh: THREE.LineSegments;
  speeds: Float32Array;
  positions: Float32Array;
  count: number;
}

function createRain(scene: THREE.Scene, count: number, opacity: number, speedMin: number, speedMax: number): RainSystem {
  const positions = new Float32Array(count * 6);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 400;
    const y = Math.random() * 200;
    const z = (Math.random() - 0.5) * 400;
    const len = 3 + Math.random() * 3;

    const idx = i * 6;
    positions[idx] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;
    positions[idx + 3] = x + 0.15;
    positions[idx + 4] = y - len;
    positions[idx + 5] = z;

    speeds[i] = speedMin + Math.random() * (speedMax - speedMin);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.LineBasicMaterial({ color: 0x4488bb, opacity, transparent: true });
  const mesh = new THREE.LineSegments(geo, mat);
  scene.add(mesh);

  return { mesh, speeds, positions, count };
}

function updateRain(rain: RainSystem) {
  const pos = rain.positions;
  for (let i = 0; i < rain.count; i++) {
    const idx = i * 6;
    const speed = rain.speeds[i];

    pos[idx + 1] -= speed;
    pos[idx + 4] -= speed;
    pos[idx] += 0.15;
    pos[idx + 3] += 0.15;

    if (pos[idx + 4] < -10) {
      const x = (Math.random() - 0.5) * 400;
      const y = 180 + Math.random() * 20;
      const z = (Math.random() - 0.5) * 400;
      const len = 3 + Math.random() * 3;
      pos[idx] = x;
      pos[idx + 1] = y;
      pos[idx + 2] = z;
      pos[idx + 3] = x + 0.15;
      pos[idx + 4] = y - len;
      pos[idx + 5] = z;
    }
  }
  (rain.mesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
}

// ── Particles (mist/dust) ────────────────────────────────────────────────

function createParticles(scene: THREE.Scene, count: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 300;
    positions[i * 3 + 1] = Math.random() * 150;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 300;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.3,
    transparent: true,
    opacity: 0.15,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return points;
}

// ── God rays (cone light shafts) ─────────────────────────────────────────

function createGodRays(scene: THREE.Scene): THREE.Mesh[] {
  const rays: THREE.Mesh[] = [];
  const positions = [
    [-40, 100, -30],
    [40, 110, -50],
    [0, 90, 20],
    [-60, 105, 40],
    [70, 95, -20],
    [20, 100, 60],
  ];
  const colors = [0x1e40ff, 0x7c3aed, 0x06b6d4, 0x1e40ff, 0x7c3aed, 0x06b6d4];

  positions.forEach(([x, y, z], i) => {
    const geo = new THREE.ConeGeometry(15, 80, 8, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: colors[i],
      transparent: true,
      opacity: 0.03,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.x = Math.PI;
    scene.add(mesh);
    rays.push(mesh);
  });

  return rays;
}

// ── Main Component ───────────────────────────────────────────────────────

export default function HeroCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webglSupported, setWebglSupported] = useState(true);
  const [fontsReady, setFontsReady] = useState(false);

  // Wait for fonts
  useEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true));
  }, []);

  // ── Text animations (GSAP) ──────────────────────────────────────────
  useEffect(() => {
    if (!fontsReady) return;

    const ctx = gsap.context(() => {
      // Eyebrow
      gsap.from('.hero-eyebrow', {
        opacity: 0,
        y: 20,
        duration: 0.8,
        delay: 0.3,
        ease: 'power3.out',
      });

      // Word-by-word headline
      gsap.from('.hero-word', {
        y: 60,
        opacity: 0,
        duration: 0.9,
        stagger: 0.12,
        ease: 'power4.out',
        delay: 0.4,
      });

      // Subtitle
      gsap.from('.hero-subtitle', {
        opacity: 0,
        y: 20,
        duration: 0.8,
        delay: 0.8,
        ease: 'power3.out',
      });

      // CTA button
      gsap.from('.hero-cta', {
        opacity: 0,
        y: 30,
        duration: 0.8,
        delay: 1.1,
        ease: 'power3.out',
      });

      // Scroll indicator
      gsap.from('.hero-scroll-indicator', {
        opacity: 0,
        duration: 0.6,
        delay: 1.5,
      });

      // Fade overlay text on scroll
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: 'top top',
        end: '20% top',
        scrub: true,
        onUpdate: (self) => {
          const overlay = document.querySelector('.hero-overlay') as HTMLElement;
          if (overlay) overlay.style.opacity = String(1 - self.progress);
        },
      });

      // Fade scroll indicator on any scroll
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: 'top top',
        end: '5% top',
        scrub: true,
        onUpdate: (self) => {
          const el = document.querySelector('.hero-scroll-indicator') as HTMLElement;
          if (el) el.style.opacity = String(1 - self.progress);
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, [fontsReady]);

  // ── Three.js scene ──────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // WebGL check
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
    if (!gl) {
      setWebglSupported(false);
      return;
    }

    const quality = getQuality(window.innerWidth);
    const isMobile = window.innerWidth < 768;

    // ── Renderer ──────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(BG_COLOR);

    // ── Scene ─────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060d18, 0.006);

    // ── Camera ────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 120, 280);
    camera.lookAt(0, 10, 0);

    // ── Post-processing ───────────────────────────────────────────────
    let composer: EffectComposer | null = null;
    if (quality.bloom) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new BloomEffect({
        intensity: 0.8,
        radius: 0.6,
        luminanceThreshold: 0.2,
      });
      composer.addPass(new EffectPass(camera, bloom));
    }

    // ── Ground ────────────────────────────────────────────────────────
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1000, 1000),
      new THREE.MeshStandardMaterial({
        color: 0x060d18,
        roughness: 0.05,
        metalness: 0.95,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // ── Buildings ─────────────────────────────────────────────────────
    const { textures: buildingTextures } = createBuildings(scene, quality.buildings);

    // ── Lighting ──────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0x0a1428, 0.3);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x162040, 0x050a14, 0.5);
    scene.add(hemiLight);

    // Moving point lights
    const orbitLights: { light: THREE.PointLight; radius: number; height: number; speed: number; offset: number }[] = [];
    const lightConfigs = [
      { color: 0x1e40ff, intensity: 80, radius: 120, height: 60, speed: 0.0003 },
      { color: 0x7c3aed, intensity: 60, radius: 90, height: 80, speed: 0.0005 },
      { color: 0x06b6d4, intensity: 50, radius: 150, height: 40, speed: 0.0002 },
    ];

    lightConfigs.slice(0, quality.lights).forEach((cfg, i) => {
      const light = new THREE.PointLight(cfg.color, cfg.intensity, 300);
      light.position.set(0, cfg.height, 0);
      scene.add(light);
      orbitLights.push({ light, radius: cfg.radius, height: cfg.height, speed: cfg.speed, offset: (i * Math.PI * 2) / 3 });
    });

    // Street lights
    const streetLight1 = new THREE.PointLight(0xff8c00, 30, 100);
    streetLight1.position.set(-30, 8, 20);
    scene.add(streetLight1);

    const streetLight2 = new THREE.PointLight(0xff8c00, 30, 100);
    streetLight2.position.set(50, 8, -40);
    scene.add(streetLight2);

    // ── Rain ──────────────────────────────────────────────────────────
    const rainPrimary = createRain(scene, quality.rainPrimary, 0.35, 0.8, 2.5);
    const rainSecondary = quality.rainSecondary > 0 ? createRain(scene, quality.rainSecondary, 0.6, 2.0, 4.0) : null;

    // ── God rays ──────────────────────────────────────────────────────
    const godRays = createGodRays(scene);

    // ── Particles ─────────────────────────────────────────────────────
    const particles = createParticles(scene, quality.particles);

    // ── Scroll animation state ────────────────────────────────────────
    const scrollState = { progress: 0 };

    if (!isMobile) {
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: 1,
        pin: false,
        onUpdate: (self) => {
          scrollState.progress = self.progress;
        },
      });
    }

    // ── Window toggle timer ───────────────────────────────────────────
    let windowTimer = 0;

    // ── Animation loop ────────────────────────────────────────────────
    let animId: number;
    const clock = new THREE.Clock();

    function animate() {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime() * 1000;
      const p = scrollState.progress;

      // Camera animation
      camera.position.z = 280 - p * 200;
      camera.position.y = 120 - p * 90;
      camera.fov = 60 + p * 15;
      camera.position.y += Math.sin(elapsed * 0.0004) * 0.3;
      camera.rotation.z = Math.sin(elapsed * 0.0002) * 0.002;
      if (!isMobile) camera.position.z -= 0.04;
      camera.updateProjectionMatrix();
      camera.lookAt(0, 10, 0);

      // Fog density on scroll
      (scene.fog as THREE.FogExp2).density = 0.006 + p * 0.009;

      // Rain opacity on scroll
      (rainPrimary.mesh.material as THREE.LineBasicMaterial).opacity = 0.35 + p * 0.25;

      // Ambient intensity on scroll
      ambientLight.intensity = 0.3 + p * 0.3;

      // Update rain
      updateRain(rainPrimary);
      if (rainSecondary) updateRain(rainSecondary);

      // Orbit lights
      orbitLights.forEach((ol) => {
        const angle = elapsed * ol.speed + ol.offset;
        ol.light.position.x = Math.cos(angle) * ol.radius;
        ol.light.position.z = Math.sin(angle) * ol.radius;
        ol.light.position.y = ol.height;
      });

      // God ray pulse
      godRays.forEach((ray, i) => {
        const mat = ray.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.02 + Math.sin(elapsed * 0.001 + i * 1.5) * 0.015;
      });

      // Particle drift
      const pPos = particles.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pPos.count; i++) {
        pPos.setY(i, pPos.getY(i) + Math.sin(elapsed * 0.0005 + i) * 0.01);
        pPos.setX(i, pPos.getX(i) + Math.cos(elapsed * 0.0003 + i * 0.5) * 0.005);
      }
      pPos.needsUpdate = true;

      // Toggle windows every ~5 seconds
      windowTimer += clock.getDelta() * 1000;
      if (windowTimer > 5000) {
        windowTimer = 0;
        buildingTextures.forEach((tex) => {
          const ctx = tex.image.getContext('2d');
          if (!ctx) return;
          const w = tex.image.width;
          const h = tex.image.height;
          // Toggle a few random windows
          for (let j = 0; j < 3; j++) {
            const rx = Math.floor(Math.random() * (w / 8)) * 8;
            const ry = Math.floor(Math.random() * (h / 8)) * 8;
            const data = ctx.getImageData(rx + 2, ry + 2, 1, 1).data;
            if (data[0] > 100) {
              ctx.fillStyle = '#000000';
            } else {
              ctx.fillStyle = Math.random() > 0.4 ? '#FFD580' : '#E8F0FF';
            }
            ctx.fillRect(rx + 1, ry + 1, 5, 5);
          }
          tex.needsUpdate = true;
        });
      }

      // Render
      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    }

    animate();

    // ── Resize handler ────────────────────────────────────────────────
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (composer) composer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // ── Cleanup ───────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      ScrollTrigger.getAll().forEach((t) => t.kill());

      // Dispose everything
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Points) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });

      buildingTextures.forEach((t) => t.dispose());
      renderer.dispose();
      if (composer) composer.dispose();
    };
  }, []);

  if (!webglSupported) {
    return (
      <div className="relative h-screen w-full overflow-hidden bg-[#03080F]">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-4xl font-bold">TakeMe Mobility</h1>
            <p className="mt-4 text-[#7B9EC5]">Get anywhere in minutes.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: '300vh' }}>
      {/* Pinned canvas + overlay wrapper */}
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* WebGL Canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {/* Vignette overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(3,8,15,0.7) 100%)',
          }}
        />

        {/* Text overlay */}
        <div className="hero-overlay pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto text-center" style={{ marginTop: '-10vh' }}>
            {/* Eyebrow */}
            <p
              className="hero-eyebrow mb-6 text-[11px] uppercase tracking-[4px] text-[#4488BB]"
              style={{ letterSpacing: '4px' }}
            >
              Seattle &middot; Est. 2024
            </p>

            {/* Headline */}
            <h1
              className="overflow-hidden font-serif leading-[0.95]"
              style={{
                fontFamily: "var(--font-dm-serif), 'DM Serif Display', Georgia, serif",
                fontSize: 'clamp(52px, 8vw, 100px)',
                letterSpacing: '-2px',
                color: 'white',
              }}
            >
              <span className="inline-block overflow-hidden">
                <span className="hero-word inline-block">Get</span>{' '}
                <span className="hero-word inline-block">anywhere</span>
              </span>
              <br />
              <span className="inline-block overflow-hidden">
                <span className="hero-word inline-block">in</span>{' '}
                <span className="hero-word inline-block">minutes.</span>
              </span>
            </h1>

            {/* Subtitle */}
            <p
              className="hero-subtitle mx-auto mt-6 text-[#7B9EC5]"
              style={{ fontSize: 'clamp(16px, 2vw, 20px)' }}
            >
              Every ride, on your terms.
            </p>

            {/* CTA */}
            <div className="hero-cta mt-10">
              <a
                href="/auth/signup"
                className="inline-block rounded-[980px] bg-[#2563EB] px-9 py-[18px] text-[17px] font-semibold text-white transition-all duration-250"
                style={{
                  transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.transform = 'scale(1.04)';
                  el.style.background = '#1D4ED8';
                  el.style.boxShadow = '0 0 40px rgba(37,99,235,0.5)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.transform = 'scale(1)';
                  el.style.background = '#2563EB';
                  el.style.boxShadow = 'none';
                }}
              >
                Book your ride &rarr;
              </a>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="hero-scroll-indicator pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
          <p className="mb-2 text-[11px] uppercase tracking-[3px] text-[#4488BB]/60">
            Scroll to explore
          </p>
          <svg
            className="mx-auto h-5 w-5 animate-bounce text-[#4488BB]/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
