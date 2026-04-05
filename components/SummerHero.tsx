'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { gsap } from 'gsap'

// ── Quality tiers ────────────────────────────────────────────────────────

type Tier = 'mobile' | 'tablet' | 'desktop'

function getTier(w: number): Tier {
  if (w < 768) return 'mobile'
  if (w <= 1024) return 'tablet'
  return 'desktop'
}

function getPixelRatio(tier: Tier): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
  if (tier === 'mobile') return 1
  if (tier === 'tablet') return Math.min(dpr, 1.5)
  return Math.min(dpr, 2)
}

function getParticleCount(tier: Tier): number {
  if (tier === 'mobile') return 0
  if (tier === 'tablet') return 80
  return 200
}

// ── Component ────────────────────────────────────────────────────────────

export default function SummerHero() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let cancelled = false
    let cleanup: (() => void) | null = null

    // Track disposables so we can release them in cleanup
    const geometries: THREE.BufferGeometry[] = []
    const materials: THREE.Material[] = []
    const textures: THREE.Texture[] = []

    const init = async () => {
      // Preload fonts before starting animation so the overlay headline
      // doesn't FOUT-flash mid-sequence
      if (typeof document !== 'undefined' && document.fonts?.ready) {
        try { await document.fonts.ready } catch { /* noop */ }
      }
      if (cancelled) return

      const tier = getTier(mount.clientWidth)
      const shadowsEnabled = tier === 'desktop'
      const particleCount = getParticleCount(tier)

      // ── Renderer ────────────────────────────────────────────────────
      const renderer = new THREE.WebGLRenderer({ antialias: tier !== 'mobile' })
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      renderer.setPixelRatio(getPixelRatio(tier))
      renderer.shadowMap.enabled = shadowsEnabled
      if (shadowsEnabled) renderer.shadowMap.type = THREE.PCFSoftShadowMap
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.4
      renderer.setClearColor('#E8DDD0')
      mount.appendChild(renderer.domElement)

      // ── Scene ───────────────────────────────────────────────────────
      const scene = new THREE.Scene()
      // No fog on mobile to cut fragment shader cost
      scene.fog = tier === 'mobile' ? null : new THREE.Fog('#E8DDD0', 200, 500)

      // ── Camera ──────────────────────────────────────────────────────
      const camera = new THREE.PerspectiveCamera(
        45, mount.clientWidth / mount.clientHeight, 0.1, 1000
      )
      camera.position.set(0, 160, 0)
      camera.lookAt(0, 0, 0)

      // ── Lighting ────────────────────────────────────────────────────
      const sun = new THREE.DirectionalLight('#FFF5E0', 3)
      sun.position.set(120, 80, 60)
      sun.castShadow = shadowsEnabled
      if (shadowsEnabled) {
        sun.shadow.mapSize.width = 2048
        sun.shadow.mapSize.height = 2048
        sun.shadow.camera.near = 0.5
        sun.shadow.camera.far = 500
        sun.shadow.camera.left = -200
        sun.shadow.camera.right = 200
        sun.shadow.camera.top = 200
        sun.shadow.camera.bottom = -200
      }
      scene.add(sun)

      const ambient = new THREE.AmbientLight('#87CEEB', 0.6)
      scene.add(ambient)

      const hemi = new THREE.HemisphereLight('#E8F4FD', '#C8B99A', 0.8)
      scene.add(hemi)

      // ── Materials ───────────────────────────────────────────────────
      const asphaltMat = new THREE.MeshStandardMaterial({
        color: '#252525', roughness: 0.85, metalness: 0.05
      })
      const concreteMat = new THREE.MeshStandardMaterial({
        color: '#C8B99A', roughness: 0.95, metalness: 0
      })
      const stripeMat = new THREE.MeshStandardMaterial({
        color: '#F5F0E8', roughness: 0.8
      })
      const yellowMat = new THREE.MeshStandardMaterial({ color: '#F5C842' })
      const bodyMat = new THREE.MeshStandardMaterial({
        color: '#F8F8F6', roughness: 0.15, metalness: 0.7
      })
      const glassMat = new THREE.MeshStandardMaterial({
        color: '#1A2535', roughness: 0.05, metalness: 0.9,
        transparent: true, opacity: 0.75
      })
      const tireMat = new THREE.MeshStandardMaterial({
        color: '#111111', roughness: 0.9
      })
      const rimMat = new THREE.MeshStandardMaterial({
        color: '#888888', roughness: 0.3, metalness: 0.8
      })
      const sensorMat = new THREE.MeshStandardMaterial({ color: '#222222' })
      const shadowEllipseMat = new THREE.MeshBasicMaterial({
        color: '#000000', transparent: true, opacity: 0.2
      })
      const pedMat = new THREE.MeshBasicMaterial({
        color: '#000000', transparent: true, opacity: 0.18
      })
      materials.push(
        asphaltMat, concreteMat, stripeMat, yellowMat,
        bodyMat, glassMat, tireMat, rimMat, sensorMat,
        shadowEllipseMat, pedMat
      )

      // ── Roads ───────────────────────────────────────────────────────
      const roadHGeo = new THREE.PlaneGeometry(400, 55)
      const roadVGeo = new THREE.PlaneGeometry(55, 400)
      geometries.push(roadHGeo, roadVGeo)

      const roadH = new THREE.Mesh(roadHGeo, asphaltMat)
      roadH.rotation.x = -Math.PI / 2
      roadH.receiveShadow = shadowsEnabled
      scene.add(roadH)

      const roadV = new THREE.Mesh(roadVGeo, asphaltMat)
      roadV.rotation.x = -Math.PI / 2
      roadV.receiveShadow = shadowsEnabled
      scene.add(roadV)

      // ── Sidewalk corners (4 meshes, share geometry) ────────────────
      const sidewalkGeo = new THREE.PlaneGeometry(170, 170)
      geometries.push(sidewalkGeo)
      const corners: [number, number][] = [
        [120, 120], [-120, 120], [120, -120], [-120, -120]
      ]
      corners.forEach(([x, z]) => {
        const sw = new THREE.Mesh(sidewalkGeo, concreteMat)
        sw.rotation.x = -Math.PI / 2
        sw.position.set(x, 0, z)
        sw.receiveShadow = shadowsEnabled
        scene.add(sw)
      })

      // ── Crosswalk stripes (InstancedMesh — 36 → 1 draw call) ───────
      const crosswalkPositions: { axis: 'x' | 'z'; offset: number }[] = [
        { axis: 'x', offset: 30 },
        { axis: 'x', offset: -30 },
        { axis: 'z', offset: 30 },
        { axis: 'z', offset: -30 },
      ]
      const crosswalkCount = crosswalkPositions.length * 9
      const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1)
      geometries.push(unitBoxGeo)
      const crosswalkMesh = new THREE.InstancedMesh(unitBoxGeo, stripeMat, crosswalkCount)
      crosswalkMesh.receiveShadow = shadowsEnabled
      const dummy = new THREE.Object3D()
      let cwIdx = 0
      crosswalkPositions.forEach(({ axis, offset }) => {
        for (let i = -4; i <= 4; i++) {
          const sx = axis === 'x' ? 3 : 12
          const sz = axis === 'x' ? 12 : 3
          dummy.position.set(
            axis === 'x' ? i * 4 : offset,
            0.02,
            axis === 'x' ? offset : i * 4
          )
          dummy.scale.set(sx, 0.05, sz)
          dummy.rotation.set(0, 0, 0)
          dummy.updateMatrix()
          crosswalkMesh.setMatrixAt(cwIdx++, dummy.matrix)
        }
      })
      crosswalkMesh.instanceMatrix.needsUpdate = true
      scene.add(crosswalkMesh)

      // ── Center yellow dashes (InstancedMesh — 34 → 1 draw call) ────
      const dashCount = 17 * 2
      const unitPlaneGeo = new THREE.PlaneGeometry(1, 1)
      geometries.push(unitPlaneGeo)
      const dashMesh = new THREE.InstancedMesh(unitPlaneGeo, yellowMat, dashCount)
      let dIdx = 0
      for (let i = -8; i <= 8; i++) {
        // horizontal road dash (along x axis)
        dummy.position.set(i * 9, 0.03, 0)
        dummy.rotation.set(-Math.PI / 2, 0, 0)
        dummy.scale.set(0.4, 5, 1)
        dummy.updateMatrix()
        dashMesh.setMatrixAt(dIdx++, dummy.matrix)

        // vertical road dash (along z axis)
        dummy.position.set(0, 0.03, i * 9)
        dummy.rotation.set(-Math.PI / 2, 0, 0)
        dummy.scale.set(5, 0.4, 1)
        dummy.updateMatrix()
        dashMesh.setMatrixAt(dIdx++, dummy.matrix)
      }
      dashMesh.instanceMatrix.needsUpdate = true
      scene.add(dashMesh)

      // ── Car ─────────────────────────────────────────────────────────
      const carGroup = new THREE.Group()
      scene.add(carGroup)

      const carBodyGeo = new THREE.BoxGeometry(8, 1.4, 18)
      const carRoofGeo = new THREE.BoxGeometry(7, 0.8, 11)
      const windshieldGeo = new THREE.BoxGeometry(6.5, 1.2, 0.15)
      const tireGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.8, 16)
      const rimGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.85, 8)
      const sensorGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.5, 16)
      const carShadowGeo = new THREE.PlaneGeometry(10, 22)
      geometries.push(carBodyGeo, carRoofGeo, windshieldGeo, tireGeo, rimGeo, sensorGeo, carShadowGeo)

      const body = new THREE.Mesh(carBodyGeo, bodyMat)
      body.position.y = 1
      body.castShadow = shadowsEnabled
      carGroup.add(body)

      const roof = new THREE.Mesh(carRoofGeo, bodyMat)
      roof.position.set(0, 2.1, -0.5)
      roof.castShadow = shadowsEnabled
      carGroup.add(roof)

      const windshield = new THREE.Mesh(windshieldGeo, glassMat)
      windshield.position.set(0, 1.8, 5)
      carGroup.add(windshield)

      const rear = new THREE.Mesh(windshieldGeo, glassMat)
      rear.position.set(0, 1.8, -6)
      carGroup.add(rear)

      const wheelPos: [number, number, number][] = [
        [3.5, 0.5, 6], [-3.5, 0.5, 6],
        [3.5, 0.5, -6], [-3.5, 0.5, -6]
      ]
      wheelPos.forEach(([x, y, z]) => {
        const wheel = new THREE.Mesh(tireGeo, tireMat)
        wheel.rotation.z = Math.PI / 2
        wheel.position.set(x, y, z)
        wheel.castShadow = shadowsEnabled
        carGroup.add(wheel)

        const rim = new THREE.Mesh(rimGeo, rimMat)
        rim.rotation.z = Math.PI / 2
        rim.position.set(x, y, z)
        carGroup.add(rim)
      })

      const sensor = new THREE.Mesh(sensorGeo, sensorMat)
      sensor.position.set(0, 2.7, 0)
      carGroup.add(sensor)

      const shadowEllipse = new THREE.Mesh(carShadowGeo, shadowEllipseMat)
      shadowEllipse.rotation.x = -Math.PI / 2
      shadowEllipse.position.y = 0.01
      carGroup.add(shadowEllipse)

      carGroup.position.set(0, 0, -140)
      carGroup.rotation.y = Math.PI

      // ── Pedestrian shadows (InstancedMesh — 35 → 1 draw call) ──────
      const PED_COUNT = 35
      const pedGeo = new THREE.PlaneGeometry(1.2, 4)
      geometries.push(pedGeo)
      const pedMesh = new THREE.InstancedMesh(pedGeo, pedMat, PED_COUNT)
      const pedState: { x: number; z: number; rotZ: number }[] = []
      for (let i = 0; i < PED_COUNT; i++) {
        const side = Math.random() > 0.5 ? 1 : -1
        const along = (Math.random() - 0.5) * 160
        const x = Math.random() > 0.5 ? side * (Math.random() * 60 + 40) : along
        const z = Math.random() > 0.5
          ? (Math.random() * 60 + 40) * (Math.random() > 0.5 ? 1 : -1)
          : along
        const rotZ = Math.random() * Math.PI
        pedState.push({ x, z, rotZ })

        dummy.position.set(x, 0.02, z)
        dummy.rotation.set(-Math.PI / 2, 0, rotZ)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        pedMesh.setMatrixAt(i, dummy.matrix)
      }
      pedMesh.instanceMatrix.needsUpdate = true
      scene.add(pedMesh)

      // ── TAKEME letters ──────────────────────────────────────────────
      const letters = ['T', 'A', 'K', 'E', 'M', 'E']
      const letterGeo = new THREE.PlaneGeometry(8, 8)
      geometries.push(letterGeo)
      const letterMeshes: THREE.Mesh[] = []
      letters.forEach((letter, i) => {
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 256
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, 256, 256)
        ctx.fillStyle = '#F0EBE0'
        ctx.font = 'bold 180px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(letter, 128, 128)
        const texture = new THREE.CanvasTexture(canvas)
        textures.push(texture)
        const mat = new THREE.MeshBasicMaterial({
          map: texture, transparent: true, opacity: 0
        })
        materials.push(mat)
        const mesh = new THREE.Mesh(letterGeo, mat)
        mesh.rotation.x = -Math.PI / 2
        const angle = (i / 6) * Math.PI * 2
        mesh.position.set(Math.cos(angle) * 20, 0.05, Math.sin(angle) * 20)
        mesh.scale.set(0.01, 0.01, 0.01)
        scene.add(mesh)
        letterMeshes.push(mesh)
      })

      // ── Particles ───────────────────────────────────────────────────
      let particles: THREE.Points | null = null
      let particleGeo: THREE.BufferGeometry | null = null
      let particleMat: THREE.PointsMaterial | null = null
      const velocities: number[][] = []
      if (particleCount > 0) {
        particleGeo = new THREE.BufferGeometry()
        const positions = new Float32Array(particleCount * 3)
        for (let i = 0; i < particleCount; i++) {
          positions[i * 3] = 0
          positions[i * 3 + 1] = 2
          positions[i * 3 + 2] = 0
          velocities.push([
            (Math.random() - 0.5) * 0.4,
            Math.random() * 0.5 + 0.2,
            (Math.random() - 0.5) * 0.4
          ])
        }
        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        particleMat = new THREE.PointsMaterial({
          color: '#2563EB', size: 0.3, transparent: true, opacity: 0
        })
        particles = new THREE.Points(particleGeo, particleMat)
        scene.add(particles)
        geometries.push(particleGeo)
        materials.push(particleMat)
      }

      // ── Animation timeline ──────────────────────────────────────────
      const tl = gsap.timeline()

      tl.to(camera.position, { y: 65, duration: 3, ease: 'power2.out' }, 0)
      tl.to(carGroup.position, { z: 0, duration: 3, ease: 'back.out(1.2)' }, 0.8)

      letterMeshes.forEach((mesh, i) => {
        tl.to(mesh.scale, {
          x: 1, y: 1, z: 1,
          duration: 0.5, ease: 'elastic.out(1, 0.5)'
        }, 4 + i * 0.08)
        tl.to(mesh.material as THREE.MeshBasicMaterial, {
          opacity: 1, duration: 0.3
        }, 4 + i * 0.08)
      })

      if (particleMat) {
        const pm = particleMat
        tl.call(() => {
          pm.opacity = 0.8
          pm.color.set(
            ['#2563EB', '#FFFFFF', '#F5C842'][Math.floor(Math.random() * 3)]
          )
        }, [], 4.5)
      }

      let particlesActive = false
      tl.call(() => { particlesActive = true }, [], 4.5)
      if (particleMat) {
        tl.to(particleMat, { opacity: 0, duration: 1.5 }, 5.5)
      }

      // ── Render loop (30fps cap on mobile) ───────────────────────────
      let animId = 0
      const clock = new THREE.Clock()
      const minFrameMs = tier === 'mobile' ? 33 : 0
      let lastFrame = 0

      const animate = (now: number) => {
        animId = requestAnimationFrame(animate)

        if (minFrameMs > 0 && now - lastFrame < minFrameMs) return
        lastFrame = now

        const t = clock.getElapsedTime()

        // Car idle bob
        if (carGroup.position.z > -10) {
          carGroup.position.y = Math.sin(t * 1.5) * 0.05
        }

        // Pedestrian subtle drift (update instance matrices in place)
        for (let i = 0; i < PED_COUNT; i++) {
          const s = pedState[i]
          s.x += Math.sin(t * 0.3 + i) * 0.005
          s.z += Math.cos(t * 0.3 + i * 1.3) * 0.005
          dummy.position.set(s.x, 0.02, s.z)
          dummy.rotation.set(-Math.PI / 2, 0, s.rotZ)
          dummy.scale.set(1, 1, 1)
          dummy.updateMatrix()
          pedMesh.setMatrixAt(i, dummy.matrix)
        }
        pedMesh.instanceMatrix.needsUpdate = true

        // Particles
        if (particlesActive && particleGeo && particleCount > 0) {
          const pos = particleGeo.attributes.position as THREE.BufferAttribute
          for (let i = 0; i < particleCount; i++) {
            pos.setY(i, pos.getY(i) + velocities[i][1])
            pos.setX(i, pos.getX(i) + velocities[i][0])
            pos.setZ(i, pos.getZ(i) + velocities[i][2])
            velocities[i][1] -= 0.01
          }
          pos.needsUpdate = true
        }

        renderer.render(scene, camera)
      }
      animate(performance.now())

      // ── Resize ──────────────────────────────────────────────────────
      const onResize = () => {
        camera.aspect = mount.clientWidth / mount.clientHeight
        camera.updateProjectionMatrix()
        renderer.setSize(mount.clientWidth, mount.clientHeight)
      }
      window.addEventListener('resize', onResize)

      // ── Cleanup ─────────────────────────────────────────────────────
      cleanup = () => {
        cancelAnimationFrame(animId)
        window.removeEventListener('resize', onResize)
        tl.kill()

        geometries.forEach(g => g.dispose())
        materials.forEach(m => m.dispose())
        textures.forEach(t => t.dispose())

        renderer.dispose()
        if (renderer.domElement.parentNode === mount) {
          mount.removeChild(renderer.domElement)
        }
      }
    }

    init()

    return () => {
      cancelled = true
      if (cleanup) cleanup()
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* HTML overlay */}
      <div style={{
        position: 'absolute', bottom: '12%', left: '50%',
        transform: 'translateX(-50%)', textAlign: 'center',
        animation: 'fadeUp 1s ease 6s both'
      }}>
        <p style={{
          fontSize: 'clamp(11px,1.2vw,13px)',
          letterSpacing: '4px', color: '#888', marginBottom: 16,
          textTransform: 'uppercase'
        }}>
          Seattle · Summer 2025
        </p>
        <h1 style={{
          fontFamily: 'DM Serif Display, serif',
          fontSize: 'clamp(40px,6vw,80px)',
          color: '#0A0A0A', lineHeight: 1,
          letterSpacing: '-2px', marginBottom: 20
        }}>
          Get anywhere<br />in minutes.
        </h1>
        <button style={{
          background: '#2563EB', color: 'white',
          border: 'none', borderRadius: 980,
          padding: '18px 40px', fontSize: 17,
          fontWeight: 600, cursor: 'pointer'
        }}>
          Book your ride →
        </button>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform: translateX(-50%) translateY(20px) }
          to   { opacity:1; transform: translateX(-50%) translateY(0) }
        }
      `}</style>
    </div>
  )
}
