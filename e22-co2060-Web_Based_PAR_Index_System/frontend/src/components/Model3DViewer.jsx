import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { STLLoader }      from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader }      from 'three/examples/jsm/loaders/OBJLoader.js'
import { OrbitControls }  from 'three/examples/jsm/controls/OrbitControls.js'

/**
 * Model3DViewer
 * Props:
 *   modelUrl       string  – URL of the STL/OBJ file
 *   modelType      string  – 'stl' | 'obj'
 *   placementMode  bool    – when true, clicks place a landmark
 *   activeLandmark string  – name currently being placed
 *   placedPoints   object  – { [name]: {x,y,z} }
 *   onPointPlaced  fn(name, {x,y,z})
 *   width / height number
 */
export default function Model3DViewer({
  modelUrl,
  modelType,
  placementMode  = false,
  activeLandmark = null,
  placedPoints   = {},
  onPointPlaced  = null,
  width          = 520,
  height         = 440,
}) {
  const mountRef = useRef(null)
  const stateRef = useRef({
    scene: null, camera: null, renderer: null,
    controls: null, meshes: [], markers: {}, labels: {}, animFrame: null,
  })

  // ── Build Three.js scene ─────────────────────────────────────────────
  useEffect(() => {
    if (!modelUrl) return
    const s = stateRef.current

    s.scene = new THREE.Scene()
    s.scene.background = new THREE.Color(0xf0f4f8)

    s.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 2000)
    s.camera.position.set(0, 0, 120)

    s.renderer = new THREE.WebGLRenderer({ antialias: true })
    s.renderer.setSize(width, height)
    s.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    s.renderer.shadowMap.enabled = true
    s.renderer.shadowMap.type    = THREE.PCFSoftShadowMap
    if (mountRef.current) mountRef.current.appendChild(s.renderer.domElement)

    s.controls = new OrbitControls(s.camera, s.renderer.domElement)
    s.controls.enableDamping = true
    s.controls.dampingFactor = 0.07
    s.controls.minDistance   = 5
    s.controls.maxDistance   = 500

    const ambient = new THREE.AmbientLight(0xffffff, 0.55)
    s.scene.add(ambient)
    const key = new THREE.DirectionalLight(0xffffff, 0.85)
    key.position.set(80, 120, 60)
    key.castShadow = true
    s.scene.add(key)
    const fill = new THREE.DirectionalLight(0xb0c8e8, 0.4)
    fill.position.set(-80, -40, -60)
    s.scene.add(fill)

    s.scene.add(new THREE.GridHelper(300, 30, 0xcccccc, 0xdddddd))
    s.scene.add(new THREE.AxesHelper(15))

    loadModel(modelUrl, modelType, s)

    const animate = () => {
      s.animFrame = requestAnimationFrame(animate)
      s.controls.update()
      s.renderer.render(s.scene, s.camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(s.animFrame)
      if (mountRef.current && s.renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(s.renderer.domElement)
      }
      s.renderer.dispose()
      s.controls.dispose()
      s.meshes  = []
      s.markers = {}
      s.labels  = {}
    }
  }, [modelUrl, modelType]) // eslint-disable-line

  // ── Sync marker spheres ──────────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    if (!s.scene) return
    syncMarkers(s, placedPoints)
  }, [placedPoints])

  // ── Raycasting click handler ─────────────────────────────────────────
  const handleClick = useCallback((e) => {
    if (!placementMode || !activeLandmark || !onPointPlaced) return
    const s = stateRef.current
    if (!s.renderer || !s.meshes.length) return

    const rect  = s.renderer.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, s.camera)
    const hits = raycaster.intersectObjects(s.meshes, true)
    if (hits.length > 0) {
      const { x, y, z } = hits[0].point
      onPointPlaced(activeLandmark, { x, y, z })
    }
  }, [placementMode, activeLandmark, onPointPlaced])

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {placementMode && activeLandmark && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          background: 'rgba(37,99,235,0.9)', color: '#fff',
          padding: '7px 14px', fontSize: 13, fontWeight: 600,
          borderRadius: '8px 8px 0 0', pointerEvents: 'none',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>📍</span>
          Click on model to place:&nbsp;
          <code style={{
            background: 'rgba(255,255,255,0.22)', borderRadius: 4,
            padding: '1px 8px', fontFamily: 'monospace',
          }}>{activeLandmark}</code>
        </div>
      )}
      <div
        ref={mountRef}
        onClick={handleClick}
        style={{
          width, height,
          border: placementMode ? '2.5px solid #2563eb' : '1.5px solid #d1d5db',
          borderRadius: 8,
          background: '#f0f4f8',
          cursor: placementMode ? 'crosshair' : 'grab',
          overflow: 'hidden',
        }}
      />
    </div>
  )
}

// ── Load STL or OBJ ──────────────────────────────────────────────────────
function loadModel(url, type, s) {
  const ext = (type || '').toLowerCase()
  let loader
  if (ext === 'stl')      loader = new STLLoader()
  else if (ext === 'obj') loader = new OBJLoader()
  else { console.error('Unsupported type:', type); return }

  loader.load(url, (raw) => {
    let obj
    if (raw.isBufferGeometry) {
      const mat = new THREE.MeshPhongMaterial({
        color: 0x7ec8e3, specular: 0x333333, shininess: 60, side: THREE.DoubleSide,
      })
      obj = new THREE.Mesh(raw, mat)
      obj.castShadow = obj.receiveShadow = true
    } else {
      obj = raw
      obj.traverse(c => {
        if (c.isMesh) {
          c.material = new THREE.MeshPhongMaterial({ color: 0x7ec8e3, specular: 0x333333, shininess: 60 })
          c.castShadow = c.receiveShadow = true
        }
      })
    }

    const box    = new THREE.Box3().setFromObject(obj)
    const centre = box.getCenter(new THREE.Vector3())
    const size   = box.getSize(new THREE.Vector3())
    const scale  = 80 / Math.max(size.x, size.y, size.z)
    obj.scale.setScalar(scale)
    obj.position.sub(centre.multiplyScalar(scale))
    s.scene.add(obj)

    obj.traverse(c => { if (c.isMesh) s.meshes.push(c) })
  },
  (p) => { if (p.total) console.debug('Load:', Math.round(p.loaded / p.total * 100) + '%') },
  (e) => console.error('Load error:', e))
}

// ── Marker / label management ────────────────────────────────────────────
const MARKER_MAT = new THREE.MeshStandardMaterial({
  color: 0xef4444, roughness: 0.3, metalness: 0.1,
  emissive: 0xcc0000, emissiveIntensity: 0.2,
})

function syncMarkers(s, placedPoints) {
  // Remove stale
  Object.keys(s.markers).forEach(name => {
    if (!placedPoints[name]) {
      s.scene.remove(s.markers[name])
      if (s.labels[name]) s.scene.remove(s.labels[name])
      delete s.markers[name]
      delete s.labels[name]
    }
  })
  // Add / update
  Object.entries(placedPoints).forEach(([name, { x, y, z }]) => {
    if (s.markers[name]) {
      s.markers[name].position.set(x, y, z)
      if (s.labels[name]) s.labels[name].position.set(x, y + 3.5, z)
    } else {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 14), MARKER_MAT)
      sphere.position.set(x, y, z)
      s.scene.add(sphere)
      s.markers[name] = sphere

      const label = makeLabel(name)
      label.position.set(x, y + 3.5, z)
      s.scene.add(label)
      s.labels[name] = label
    }
  })
}

function makeLabel(text) {
  const canvas = document.createElement('canvas')
  canvas.width = 128; canvas.height = 32
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'rgba(15,15,30,0.78)'
  ctx.beginPath(); ctx.roundRect(0, 0, 128, 32, 6); ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 13px monospace'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, 64, 16)
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true })
  const spr = new THREE.Sprite(mat)
  spr.scale.set(9, 2.2, 1)
  return spr
}
