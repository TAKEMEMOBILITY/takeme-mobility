'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { gsap } from 'gsap'

export default function SummerHero() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.4
    renderer.setClearColor('#E8DDD0')
    mount.appendChild(renderer.domElement)

    // SCENE
    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog('#E8DDD0', 200, 500)

    // CAMERA — top down aerial
    const camera = new THREE.PerspectiveCamera(
      45, mount.clientWidth / mount.clientHeight, 0.1, 1000
    )
    camera.position.set(0, 160, 0)
    camera.lookAt(0, 0, 0)

    // LIGHTING — golden Seattle summer afternoon
    const sun = new THREE.DirectionalLight('#FFF5E0', 3)
    sun.position.set(120, 80, 60)
    sun.castShadow = true
    sun.shadow.mapSize.width = 2048
    sun.shadow.mapSize.height = 2048
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far = 500
    sun.shadow.camera.left = -200
    sun.shadow.camera.right = 200
    sun.shadow.camera.top = 200
    sun.shadow.camera.bottom = -200
    scene.add(sun)

    const ambient = new THREE.AmbientLight('#87CEEB', 0.6)
    scene.add(ambient)

    const hemi = new THREE.HemisphereLight('#E8F4FD', '#C8B99A', 0.8)
    scene.add(hemi)

    // GROUND — asphalt roads
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: '#252525', roughness: 0.85, metalness: 0.05
    })
    const concreteMat = new THREE.MeshStandardMaterial({
      color: '#C8B99A', roughness: 0.95, metalness: 0
    })
    const stripeMat = new THREE.MeshStandardMaterial({
      color: '#F5F0E8', roughness: 0.8
    })

    // Roads
    const roadH = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 55), asphaltMat
    )
    roadH.rotation.x = -Math.PI / 2
    roadH.receiveShadow = true
    scene.add(roadH)

    const roadV = new THREE.Mesh(
      new THREE.PlaneGeometry(55, 400), asphaltMat
    )
    roadV.rotation.x = -Math.PI / 2
    roadV.receiveShadow = true
    scene.add(roadV)

    // Sidewalk corners
    const corners = [
      [120, 120], [-120, 120], [120, -120], [-120, -120]
    ]
    corners.forEach(([x, z]) => {
      const sw = new THREE.Mesh(
        new THREE.PlaneGeometry(170, 170), concreteMat
      )
      sw.rotation.x = -Math.PI / 2
      sw.position.set(x, 0, z)
      sw.receiveShadow = true
      scene.add(sw)
    })

    // Crosswalk stripes
    const crosswalkPositions = [
      { axis: 'x', offset: 30 },
      { axis: 'x', offset: -30 },
      { axis: 'z', offset: 30 },
      { axis: 'z', offset: -30 },
    ]
    crosswalkPositions.forEach(({ axis, offset }) => {
      for (let i = -4; i <= 4; i++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(
            axis === 'x' ? 3 : 12,
            0.05,
            axis === 'x' ? 12 : 3
          ),
          stripeMat
        )
        stripe.position.set(
          axis === 'x' ? i * 4 : offset,
          0.02,
          axis === 'x' ? offset : i * 4
        )
        stripe.receiveShadow = true
        scene.add(stripe)
      }
    })

    // Center yellow lines
    const yellowMat = new THREE.MeshStandardMaterial({ color: '#F5C842' })
    for (let i = -8; i <= 8; i++) {
      const dash = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 5), yellowMat
      )
      dash.rotation.x = -Math.PI / 2
      dash.position.set(i * 9, 0.03, 0)
      scene.add(dash)

      const dashV = new THREE.Mesh(
        new THREE.PlaneGeometry(5, 0.4), yellowMat
      )
      dashV.rotation.x = -Math.PI / 2
      dashV.position.set(0, 0.03, i * 9)
      scene.add(dashV)
    }

    // CAR — pearl white electric
    const carGroup = new THREE.Group()
    scene.add(carGroup)

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

    // Car body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(8, 1.4, 18), bodyMat
    )
    body.position.y = 1
    body.castShadow = true
    carGroup.add(body)

    // Roof
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(7, 0.8, 11), bodyMat
    )
    roof.position.set(0, 2.1, -0.5)
    roof.castShadow = true
    carGroup.add(roof)

    // Windshields
    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(6.5, 1.2, 0.15), glassMat
    )
    windshield.position.set(0, 1.8, 5)
    carGroup.add(windshield)

    const rear = new THREE.Mesh(
      new THREE.BoxGeometry(6.5, 1.2, 0.15), glassMat
    )
    rear.position.set(0, 1.8, -6)
    carGroup.add(rear)

    // Wheels
    const wheelPos = [
      [3.5, 0.5, 6], [-3.5, 0.5, 6],
      [3.5, 0.5, -6], [-3.5, 0.5, -6]
    ]
    wheelPos.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.4, 0.8, 16), tireMat
      )
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(x, y, z)
      wheel.castShadow = true
      carGroup.add(wheel)

      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 0.85, 8), rimMat
      )
      rim.rotation.z = Math.PI / 2
      rim.position.set(x, y, z)
      carGroup.add(rim)
    })

    // Roof sensor
    const sensor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 0.5, 16),
      new THREE.MeshStandardMaterial({ color: '#222222' })
    )
    sensor.position.set(0, 2.7, 0)
    carGroup.add(sensor)

    // Car shadow ellipse
    const shadowEllipse = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 22),
      new THREE.MeshBasicMaterial({
        color: '#000000', transparent: true, opacity: 0.2
      })
    )
    shadowEllipse.rotation.x = -Math.PI / 2
    shadowEllipse.position.y = 0.01
    carGroup.add(shadowEllipse)

    // Start car off screen, drive in
    carGroup.position.set(0, 0, -140)
    carGroup.rotation.y = Math.PI // facing correct direction

    // PEDESTRIAN SHADOWS (elongated ellipses like Waymo)
    const pedMat = new THREE.MeshBasicMaterial({
      color: '#000000', transparent: true, opacity: 0.18
    })
    const pedPositions: number[][] = []
    for (let i = 0; i < 35; i++) {
      const side = Math.random() > 0.5 ? 1 : -1
      const along = (Math.random() - 0.5) * 160
      pedPositions.push([
        Math.random() > 0.5
          ? side * (Math.random() * 60 + 40)
          : along,
        Math.random() > 0.5
          ? (Math.random() * 60 + 40) * (Math.random() > 0.5 ? 1 : -1)
          : along
      ])
    }
    const peds = pedPositions.map(([x, z]) => {
      const ped = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 4), pedMat
      )
      ped.rotation.x = -Math.PI / 2
      ped.rotation.z = Math.random() * Math.PI
      ped.position.set(x, 0.02, z)
      scene.add(ped)
      return ped
    })

    // TAKEME LETTERS flat on road
    const letters = ['T','A','K','E','M','E']
    const letterMeshes: THREE.Mesh[] = []
    letters.forEach((letter, i) => {
      const canvas = document.createElement('canvas')
      canvas.width = 256; canvas.height = 256
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = 'transparent'
      ctx.clearRect(0, 0, 256, 256)
      ctx.fillStyle = '#F0EBE0'
      ctx.font = 'bold 180px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(letter, 128, 128)
      const texture = new THREE.CanvasTexture(canvas)
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 8),
        new THREE.MeshBasicMaterial({
          map: texture, transparent: true, opacity: 0
        })
      )
      mesh.rotation.x = -Math.PI / 2
      const angle = (i / 6) * Math.PI * 2
      mesh.position.set(
        Math.cos(angle) * 20,
        0.05,
        Math.sin(angle) * 20
      )
      mesh.scale.set(0.01, 0.01, 0.01)
      scene.add(mesh)
      letterMeshes.push(mesh)
    })

    // PARTICLES
    const particleCount = 200
    const particleGeo = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const velocities: number[][] = []
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
    particleGeo.setAttribute('position',
      new THREE.BufferAttribute(positions, 3))
    const particleMat = new THREE.PointsMaterial({
      color: '#2563EB', size: 0.3,
      transparent: true, opacity: 0
    })
    const particles = new THREE.Points(particleGeo, particleMat)
    scene.add(particles)

    // ANIMATION SEQUENCE
    const tl = gsap.timeline()

    // 1. Camera descends
    tl.to(camera.position, {
      y: 65, duration: 3, ease: 'power2.out'
    }, 0)

    // 2. Car drives in
    tl.to(carGroup.position, {
      z: 0, duration: 3, ease: 'back.out(1.2)'
    }, 0.8)

    // 3. TAKEME letters appear around car
    letterMeshes.forEach((mesh, i) => {
      tl.to(mesh.scale, {
        x: 1, y: 1, z: 1,
        duration: 0.5, ease: 'elastic.out(1, 0.5)'
      }, 4 + i * 0.08)
      tl.to((mesh.material as THREE.MeshBasicMaterial), {
        opacity: 1, duration: 0.3
      }, 4 + i * 0.08)
    })

    // 4. Particle burst
    tl.call(() => {
      particleMat.opacity = 0.8
      particleMat.color.set(
        ['#2563EB','#FFFFFF','#F5C842'][Math.floor(Math.random()*3)]
      )
    }, [], 4.5)

    let particlesActive = false
    tl.call(() => { particlesActive = true }, [], 4.5)
    tl.to(particleMat, { opacity: 0, duration: 1.5 }, 5.5)

    // RENDER LOOP
    let animId: number
    const clock = new THREE.Clock()

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()

      // Car idle bob
      if (carGroup.position.z > -10) {
        carGroup.position.y = Math.sin(t * 1.5) * 0.05
      }

      // Pedestrian subtle drift
      peds.forEach((ped, i) => {
        ped.position.x += Math.sin(t * 0.3 + i) * 0.005
        ped.position.z += Math.cos(t * 0.3 + i * 1.3) * 0.005
      })

      // Particles gravity
      if (particlesActive) {
        const pos = particleGeo.attributes.position
        for (let i = 0; i < particleCount; i++) {
          pos.setY(i, pos.getY(i) + velocities[i][1])
          pos.setX(i, pos.getX(i) + velocities[i][0])
          pos.setZ(i, pos.getZ(i) + velocities[i][2])
          velocities[i][1] -= 0.01 // gravity
        }
        pos.needsUpdate = true
      }

      renderer.render(scene, camera)
    }
    animate()

    // RESIZE
    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
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
