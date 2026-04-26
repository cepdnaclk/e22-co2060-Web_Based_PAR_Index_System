import { useEffect, useRef, useCallback, useState } from 'react'
import * as THREE from 'three'
import { STLLoader }     from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader }     from 'three/examples/jsm/loaders/OBJLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/**
 * Model3DViewer — responsive, enhanced Three.js viewer
 * Props:
 *   modelUrl       string
 *   modelType      string  'stl' | 'obj'
 *   placementMode  bool
 *   activeLandmark string
 *   placedPoints   object
 *   onPointPlaced  fn
 *   label          string  optional label shown above viewer
 */
export default function Model3DViewer({
  modelUrl,
  modelType,
  placementMode  = false,
  activeLandmark = null,
  placedPoints   = {},
  onPointPlaced  = null,
  label          = null,
  width          = null,   // if null, fills container
  height         = 380,
}) {
  const containerRef = useRef(null)
  const mountRef     = useRef(null)
  const stateRef     = useRef({
    scene: null, camera: null, renderer: null,
    controls: null, meshes: [], markers: {}, labels: {}, animFrame: null,
    loadedObject: null,
  })
  const [loadStatus, setLoadStatus] = useState('idle') // idle | loading | loaded | error
  const [loadPct, setLoadPct]       = useState(0)

  // ── Build / rebuild scene when URL changes ───────────────────────
  useEffect(() => {
    if (!modelUrl || !mountRef.current) return
    const s = stateRef.current
    setLoadStatus('loading')
    setLoadPct(0)

    // Compute actual pixel size
    const w = width  ?? mountRef.current.offsetWidth  ?? 400
    const h = height

    s.scene = new THREE.Scene()
    s.scene.background = new THREE.Color(0xecf2f8)

    s.camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 3000)
    s.camera.position.set(0, 30, 140)

    s.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    s.renderer.setSize(w, h)
    s.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    s.renderer.shadowMap.enabled = true
    s.renderer.shadowMap.type    = THREE.PCFSoftShadowMap
    s.renderer.outputColorSpace  = THREE.SRGBColorSpace
    mountRef.current.appendChild(s.renderer.domElement)

    s.controls = new OrbitControls(s.camera, s.renderer.domElement)
    s.controls.enableDamping = true
    s.controls.dampingFactor = 0.06
    s.controls.minDistance   = 3
    s.controls.maxDistance   = 800
    s.controls.enablePan     = true

    // Lighting rig
    s.scene.add(new THREE.AmbientLight(0xffffff, 0.7))
    const key = new THREE.DirectionalLight(0xffffff, 1.1)
    key.position.set(100, 150, 80); key.castShadow = true
    s.scene.add(key)
    const fill = new THREE.DirectionalLight(0xc5d8f0, 0.5)
    fill.position.set(-80, -50, -60)
    s.scene.add(fill)
    const rim = new THREE.DirectionalLight(0xfff4e0, 0.35)
    rim.position.set(0, -100, 100)
    s.scene.add(rim)

    // Grid
    const grid = new THREE.GridHelper(400, 40, 0xb8ccd8, 0xcddae3)
    grid.position.y = -40
    s.scene.add(grid)

    loadModel(modelUrl, modelType, s, setLoadPct, setLoadStatus)

    // Handle resize
    const ro = new ResizeObserver(() => {
      if (!mountRef.current || !s.renderer || !s.camera) return
      const nw = mountRef.current.offsetWidth
      s.camera.aspect = nw / height
      s.camera.updateProjectionMatrix()
      s.renderer.setSize(nw, height)
    })
    ro.observe(mountRef.current)

    const animate = () => {
      s.animFrame = requestAnimationFrame(animate)
      s.controls.update()
      s.renderer.render(s.scene, s.camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(s.animFrame)
      ro.disconnect()
      if (mountRef.current && s.renderer?.domElement?.parentNode === mountRef.current) {
        mountRef.current.removeChild(s.renderer.domElement)
      }
      s.renderer?.dispose()
      s.controls?.dispose()
      s.meshes  = []
      s.markers = {}
      s.labels  = {}
      s.loadedObject = null
    }
  }, [modelUrl, modelType]) // eslint-disable-line

  // ── Sync markers ────────────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    if (!s.scene) return
    syncMarkers(s, placedPoints)
  }, [placedPoints])

  // ── Click → raycasting ──────────────────────────────────────────
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

  // ── Reset camera ────────────────────────────────────────────────
  const resetView = () => {
    const s = stateRef.current
    if (!s.camera || !s.controls) return
    s.camera.position.set(0, 30, 140)
    s.controls.target.set(0, 0, 0)
    s.controls.update()
  }

  return (
    <div ref={containerRef} style={{ width: width ? `${width}px` : '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {label && (
        <div style={{
          background: 'var(--blue-dark)', color: '#fff',
          padding: '6px 12px', fontSize: 12, fontWeight: 700,
          borderRadius: '8px 8px 0 0', letterSpacing: '.05em', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          🦷 {label}
        </div>
      )}

      {placementMode && activeLandmark && (
        <div style={{
          background: 'rgba(37,99,235,0.92)', color: '#fff',
          padding: '7px 14px', fontSize: 13, fontWeight: 600,
          borderRadius: label ? 0 : '8px 8px 0 0',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>📍</span> Click model to place: <code style={{ background: 'rgba(255,255,255,.2)', borderRadius: 4, padding: '1px 8px' }}>{activeLandmark}</code>
        </div>
      )}

      <div style={{ position: 'relative' }}>
        {loadStatus === 'loading' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: '#ecf2f8', zIndex: 5, borderRadius: label ? 0 : 8,
            gap: 12,
          }}>
            <div className="spinner spinner-lg" />
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading 3D model… {loadPct}%</div>
          </div>
        )}
        {loadStatus === 'error' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: '#fff5f5', zIndex: 5, borderRadius: 8, gap: 8,
          }}>
            <span style={{ fontSize: 32 }}>⚠️</span>
            <div style={{ fontSize: 13, color: 'var(--coral)', fontWeight: 600 }}>Failed to load model</div>
          </div>
        )}

        <div
          ref={mountRef}
          onClick={handleClick}
          style={{
            width: '100%', height,
            border: placementMode ? '2.5px solid var(--blue-mid)' : '1.5px solid var(--border)',
            borderRadius: label || (placementMode && activeLandmark) ? '0 0 8px 8px' : 8,
            background: '#ecf2f8',
            cursor: placementMode ? 'crosshair' : 'grab',
            overflow: 'hidden',
          }}
        />

        {/* Controls overlay */}
        <div style={{
          position: 'absolute', bottom: 10, right: 10,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <button
            onClick={resetView}
            title="Reset view"
            style={{
              width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.92)', cursor: 'pointer', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,.15)',
            }}>⌂</button>
        </div>

        {loadStatus === 'loaded' && (
          <div style={{
            position: 'absolute', bottom: 10, left: 10,
            fontSize: 11, color: 'rgba(80,100,120,0.7)', background: 'rgba(255,255,255,0.7)',
            padding: '3px 8px', borderRadius: 4,
          }}>
            Drag to rotate • Scroll to zoom • Shift+drag to pan
          </div>
        )}
      </div>
    </div>
  )
}

// ── Load STL or OBJ ─────────────────────────────────────────────────
function loadModel(url, type, s, setLoadPct, setLoadStatus) {
  const ext = (type || url?.split('.').pop() || '').toLowerCase()
  let loader
  if (ext === 'stl')      loader = new STLLoader()
  else if (ext === 'obj') loader = new OBJLoader()
  else { setLoadStatus('error'); return }

  loader.load(url,
    (raw) => {
      let obj
      if (raw.isBufferGeometry) {
        if (!raw.hasAttribute('normal')) raw.computeVertexNormals()
        const mat = new THREE.MeshPhongMaterial({
          color: 0x8ecae6, specular: 0x334455, shininess: 65,
          side: THREE.DoubleSide,
        })
        obj = new THREE.Mesh(raw, mat)
        obj.castShadow = obj.receiveShadow = true
      } else {
        obj = raw
        obj.traverse(c => {
          if (c.isMesh) {
            c.material = new THREE.MeshPhongMaterial({ color: 0x8ecae6, specular: 0x334455, shininess: 65 })
            c.castShadow = c.receiveShadow = true
          }
        })
      }

      const box    = new THREE.Box3().setFromObject(obj)
      const centre = box.getCenter(new THREE.Vector3())
      const size   = box.getSize(new THREE.Vector3())
      const scale  = 90 / Math.max(size.x, size.y, size.z)
      obj.scale.setScalar(scale)
      obj.position.sub(centre.multiplyScalar(scale))
      s.scene.add(obj)
      s.loadedObject = obj

      obj.traverse(c => { if (c.isMesh) s.meshes.push(c) })
      setLoadStatus('loaded')
      setLoadPct(100)
    },
    (p) => {
      if (p.total) setLoadPct(Math.round(p.loaded / p.total * 100))
    },
    (e) => { console.error('3D load error:', e); setLoadStatus('error') }
  )
}

// ── Markers ──────────────────────────────────────────────────────────
const MARKER_MAT = new THREE.MeshStandardMaterial({
  color: 0xef4444, roughness: 0.3, metalness: 0.1, emissive: 0xcc0000, emissiveIntensity: 0.25,
})

function syncMarkers(s, placedPoints) {
  Object.keys(s.markers).forEach(name => {
    if (!placedPoints[name]) {
      s.scene.remove(s.markers[name])
      if (s.labels[name]) s.scene.remove(s.labels[name])
      delete s.markers[name]; delete s.labels[name]
    }
  })
  Object.entries(placedPoints).forEach(([name, { x, y, z }]) => {
    if (s.markers[name]) {
      s.markers[name].position.set(x, y, z)
      if (s.labels[name]) s.labels[name].position.set(x, y + 3.5, z)
    } else {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 16), MARKER_MAT)
      sphere.position.set(x, y, z); s.scene.add(sphere); s.markers[name] = sphere
      const label = makeLabel(name)
      label.position.set(x, y + 3.5, z); s.scene.add(label); s.labels[name] = label
    }
  })
}

function makeLabel(text) {
  const canvas = document.createElement('canvas')
  canvas.width = 140; canvas.height = 34
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'rgba(15,15,30,0.82)'
  ctx.beginPath(); ctx.roundRect(0, 0, 140, 34, 6); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px monospace'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, 70, 17)
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true })
  const spr = new THREE.Sprite(mat); spr.scale.set(10, 2.4, 1)
  return spr
}
