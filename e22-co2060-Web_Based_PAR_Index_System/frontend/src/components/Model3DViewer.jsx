// frontend/src/components/Model3DViewer.jsx
import { useEffect, useRef, useCallback, useState } from 'react'
import * as THREE from 'three'
import { STLLoader }     from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader }     from 'three/examples/jsm/loaders/OBJLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import api from '../api/api'

/**
 * Model3DViewer — professional dental STL/OBJ viewer
 *
 * ── FIXES & IMPROVEMENTS ─────────────────────────────────────────────────────
 *
 * FIX 1 — Blank / broken canvas (0×0 renderer)
 *   mountRef.current.offsetWidth returns 0 before CSS layout completes on the
 *   first paint.  Creating WebGLRenderer at 0×0 produces a degenerate canvas
 *   that shows the browser's broken-image placeholder icon.
 *   Fix: defer scene creation by one rAF tick; use getBoundingClientRect()
 *   which returns the real width even before offsetWidth settles.
 *
 * FIX 2 — WebGL context loss (CONTEXT_LOST_WEBGL)
 *   Correct teardown order:
 *     1. cancelAnimationFrame
 *     2. ro.disconnect()
 *     3. removeChild(domElement)    ← before destroying context
 *     4. renderer.forceContextLoss()  ← release GPU slot now, not at GC
 *     5. renderer.dispose()
 *
 * FIX 3 — Module-level MARKER_MAT singleton removed
 *   Shared material across renderer instances caused GPU corruption on dispose.
 *   Now created per-marker inside syncMarkers().
 *
 * FIX 4 — Professional visual quality (matches ViewSTL)
 *   • Pure white background
 *   • Dental stone / plaster grey material (MeshStandardMaterial)
 *   • 5-point light rig: ambient + key + fill + rim + bottom bounce
 *   • PCF soft shadows on a transparent receiver plane
 *   • ACES filmic tone mapping
 *   • Polished progress bar + clean overlays
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function Model3DViewer({
  modelUrl,
  modelType,
  placementMode  = false,
  activeLandmark = null,
  placedPoints   = {},
  onPointPlaced  = null,
  label          = null,
  width          = null,
  height         = 400,
}) {
  const containerRef = useRef(null)
  const mountRef     = useRef(null)
  const stateRef     = useRef({
    scene: null, camera: null, renderer: null,
    controls: null, meshes: [], markers: {}, labels: [],
    animFrame: null, loadedObject: null, _ro: null,
  })
  const [loadStatus, setLoadStatus] = useState('idle')
  const [loadPct, setLoadPct]       = useState(0)

  useEffect(() => {
    if (!modelUrl || !mountRef.current) return

    const s = stateRef.current
    setLoadStatus('loading')
    setLoadPct(0)

    let blobUrl   = null
    let rafId     = null
    let cleanedUp = false

    // ── FIX 1: wait one rAF so CSS layout has settled ───────────────────
    rafId = requestAnimationFrame(() => {
      if (cleanedUp || !mountRef.current) return

      const el   = mountRef.current
      const rect = el.getBoundingClientRect()
      const w    = width ?? (rect.width > 4 ? rect.width : 520)
      const h    = height

      // Scene
      s.scene = new THREE.Scene()
      s.scene.background = new THREE.Color(0xffffff)   // white — matches ViewSTL

      // Camera
      s.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 5000)
      s.camera.position.set(0, 50, 165)
      s.camera.lookAt(0, 0, 0)

      // Renderer
      s.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      })
      s.renderer.setSize(w, h)
      s.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      s.renderer.shadowMap.enabled   = true
      s.renderer.shadowMap.type      = THREE.PCFSoftShadowMap
      s.renderer.outputColorSpace    = THREE.SRGBColorSpace
      s.renderer.toneMapping         = THREE.ACESFilmicToneMapping
      s.renderer.toneMappingExposure = 1.1
      el.appendChild(s.renderer.domElement)

      // OrbitControls
      s.controls = new OrbitControls(s.camera, s.renderer.domElement)
      s.controls.enableDamping = true
      s.controls.dampingFactor = 0.07
      s.controls.minDistance   = 5
      s.controls.maxDistance   = 900
      s.controls.enablePan     = true
      s.controls.target.set(0, 0, 0)
      s.controls.update()

      // ── 5-point lighting rig ────────────────────────────────────────
      // 1. Ambient — no pure-black shadows
      s.scene.add(new THREE.AmbientLight(0xffffff, 0.55))

      // 2. Key light — primary detail, casts soft shadows
      const key = new THREE.DirectionalLight(0xffffff, 1.4)
      key.position.set(120, 200, 100)
      key.castShadow              = true
      key.shadow.mapSize.set(2048, 2048)
      key.shadow.camera.near      = 1
      key.shadow.camera.far       = 800
      key.shadow.camera.left      = -160
      key.shadow.camera.right     =  160
      key.shadow.camera.top       =  160
      key.shadow.camera.bottom    = -160
      key.shadow.bias             = -0.001
      s.scene.add(key)

      // 3. Fill — soften the shadow side, slight cool tint
      const fill = new THREE.DirectionalLight(0xdae6f5, 0.65)
      fill.position.set(-100, 60, -90)
      s.scene.add(fill)

      // 4. Rim — back-light edge highlight
      const rim = new THREE.DirectionalLight(0xfff6ee, 0.4)
      rim.position.set(0, -80, -150)
      s.scene.add(rim)

      // 5. Bottom bounce — simulates reflected light from a bright surface
      const bounce = new THREE.DirectionalLight(0xffffff, 0.2)
      bounce.position.set(0, -200, 60)
      s.scene.add(bounce)

      // Shadow catcher plane (transparent, only shows shadow)
      const shadowMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(700, 700),
        new THREE.ShadowMaterial({ opacity: 0.13 }),
      )
      shadowMesh.rotation.x    = -Math.PI / 2
      shadowMesh.position.y    = -58
      shadowMesh.receiveShadow = true
      s.scene.add(shadowMesh)

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (!el || !s.renderer || !s.camera) return
        const nw = el.getBoundingClientRect().width
        if (!nw) return
        s.camera.aspect = nw / height
        s.camera.updateProjectionMatrix()
        s.renderer.setSize(nw, height)
      })
      ro.observe(el)
      s._ro = ro

      // Render loop
      const animate = () => {
        s.animFrame = requestAnimationFrame(animate)
        s.controls.update()
        s.renderer.render(s.scene, s.camera)
      }
      animate()

      // Fetch bytes via axios → blob URL → Three.js loader
      api.get(modelUrl, {
        responseType: 'arraybuffer',
        timeout: 300_000,
        onDownloadProgress: (evt) => {
          if (evt.total) {
            setLoadPct(Math.round((evt.loaded / evt.total) * 100))
          } else {
            setLoadPct(prev => Math.min(prev + 3, 88))
          }
        },
      })
      .then(response => {
        if (cleanedUp || !mountRef.current) return
        const mimeHint = (modelType || modelUrl.split('.').pop() || '').toLowerCase()
        const mime     = mimeHint === 'obj' ? 'text/plain' : 'application/octet-stream'
        const blob     = new Blob([response.data], { type: mime })
        blobUrl        = URL.createObjectURL(blob)
        loadModelFromBlobUrl(blobUrl, mimeHint, s, setLoadPct, setLoadStatus)
      })
      .catch(err => {
        if (cleanedUp) return
        console.error('3D model fetch error:', err)
        setLoadStatus('error')
      })
    })

    // ── FIX 2: correct teardown sequence ─────────────────────────────────
    return () => {
      cleanedUp = true
      cancelAnimationFrame(rafId)         // cancel layout-wait if still pending

      cancelAnimationFrame(s.animFrame)
      s.animFrame = null
      s._ro?.disconnect()
      s._ro = null

      if (mountRef.current && s.renderer?.domElement?.parentNode === mountRef.current) {
        mountRef.current.removeChild(s.renderer.domElement)
      }
      s.renderer?.forceContextLoss()      // release GPU context slot immediately
      s.renderer?.dispose()
      s.controls?.dispose()

      s.meshes       = []
      s.markers      = {}
      s.labels       = []
      s.loadedObject = null
      s.renderer     = null
      s.controls     = null
      s.scene        = null

      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [modelUrl, modelType]) // eslint-disable-line

  // Sync markers
  useEffect(() => {
    const s = stateRef.current
    if (!s.scene) return
    syncMarkers(s, placedPoints)
  }, [placedPoints])

  // Raycast on click
  const handleClick = useCallback((e) => {
    if (!placementMode || !activeLandmark || !onPointPlaced) return
    const s = stateRef.current
    if (!s.renderer || !s.meshes.length) return
    const rect  = s.renderer.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    const rc = new THREE.Raycaster()
    rc.setFromCamera(mouse, s.camera)
    const hits = rc.intersectObjects(s.meshes, true)
    if (hits.length > 0) {
      const { x, y, z } = hits[0].point
      onPointPlaced(activeLandmark, { x, y, z })
    }
  }, [placementMode, activeLandmark, onPointPlaced])

  const resetView = () => {
    const s = stateRef.current
    if (!s.camera || !s.controls) return
    s.camera.position.set(0, 50, 165)
    s.controls.target.set(0, 0, 0)
    s.controls.update()
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: width ? `${width}px` : '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 2px 18px rgba(0,0,0,0.10)',
        border: '1.5px solid #e2e8f0',
      }}
    >
      {/* Label */}
      {label && (
        <div style={{
          background: '#1e3a5f', color: '#fff',
          padding: '8px 14px', fontSize: 12, fontWeight: 700,
          letterSpacing: '.06em', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          🦷 {label}
        </div>
      )}

      {/* Placement hint */}
      {placementMode && activeLandmark && (
        <div style={{
          background: 'rgba(37,99,235,0.93)', color: '#fff',
          padding: '7px 14px', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>📍</span>
          Click model to place:{' '}
          <code style={{
            background: 'rgba(255,255,255,.18)',
            borderRadius: 4, padding: '1px 8px',
          }}>
            {activeLandmark}
          </code>
        </div>
      )}

      {/* Canvas area */}
      <div style={{ position: 'relative', background: '#fff', flex: 1 }}>

        {/* Loading overlay */}
        {loadStatus === 'loading' && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 6,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: '#fff', gap: 14,
          }}>
            <div style={{
              width: 46, height: 46, borderRadius: '50%',
              border: '4px solid #e5e7eb',
              borderTop: '4px solid #2563eb',
              animation: 'mdv-spin 0.75s linear infinite',
            }} />
            <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>
              {loadPct > 0 ? `Loading 3D model… ${loadPct}%` : 'Downloading model…'}
            </div>
            {loadPct > 0 && (
              <div style={{
                width: 210, height: 5, background: '#e5e7eb',
                borderRadius: 3, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${loadPct}%`, height: '100%',
                  background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
                  borderRadius: 3,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            )}
          </div>
        )}

        {/* Error overlay */}
        {loadStatus === 'error' && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 6,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: '#fffbfb', gap: 10,
          }}>
            <span style={{ fontSize: 38 }}>⚠️</span>
            <div style={{ fontSize: 14, color: '#dc2626', fontWeight: 700 }}>
              Failed to load 3D model
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              Check network or file permissions
            </div>
          </div>
        )}

        {/* Three.js canvas mount */}
        <div
          ref={mountRef}
          onClick={handleClick}
          style={{
            width: '100%',
            height,
            background: '#fff',
            cursor: placementMode ? 'crosshair' : 'grab',
            display: 'block',
            minWidth: 1,   // prevents 0-width collapse
          }}
        />

        {/* Reset button */}
        <button
          onClick={resetView}
          title="Reset camera"
          style={{
            position: 'absolute', bottom: 12, right: 12,
            width: 34, height: 34, borderRadius: 7,
            border: '1.5px solid #d1d5db',
            background: 'rgba(255,255,255,0.95)',
            cursor: 'pointer', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 8px rgba(0,0,0,0.11)',
          }}
        >
          ⌂
        </button>

        {/* Hint strip */}
        {loadStatus === 'loaded' && (
          <div style={{
            position: 'absolute', bottom: 14, left: 14,
            fontSize: 11, color: 'rgba(100,116,139,0.9)',
            background: 'rgba(255,255,255,0.85)',
            padding: '3px 10px', borderRadius: 5,
            userSelect: 'none',
          }}>
            Drag to rotate&nbsp;•&nbsp;Scroll to zoom&nbsp;•&nbsp;Shift+drag to pan
          </div>
        )}
      </div>

      <style>{`@keyframes mdv-spin { to { transform:rotate(360deg) } }`}</style>
    </div>
  )
}

// ── Load model + apply dental stone material ──────────────────────────────
function loadModelFromBlobUrl(blobUrl, typeHint, s, setLoadPct, setLoadStatus) {
  const ext = typeHint.toLowerCase()
  let loader

  if (ext === 'stl')       loader = new STLLoader()
  else if (ext === 'obj')  loader = new OBJLoader()
  else { setLoadStatus('error'); return }

  loader.load(
    blobUrl,
    (raw) => {
      let obj

      if (raw.isBufferGeometry) {
        if (!raw.hasAttribute('normal')) raw.computeVertexNormals()

        // Dental stone / plaster cast — same neutral grey as ViewSTL
        const mat = new THREE.MeshStandardMaterial({
          color:     0xc6c6c6,  // mid-grey plaster / dental stone
          roughness: 0.58,
          metalness: 0.0,
        })
        obj = new THREE.Mesh(raw, mat)
        obj.castShadow    = true
        obj.receiveShadow = true

      } else {
        obj = raw
        obj.traverse(c => {
          if (!c.isMesh) return
          c.material = new THREE.MeshStandardMaterial({
            color: 0xc6c6c6, roughness: 0.58, metalness: 0.0,
          })
          c.castShadow    = true
          c.receiveShadow = true
        })
      }

      // Centre + scale
      const box    = new THREE.Box3().setFromObject(obj)
      const centre = box.getCenter(new THREE.Vector3())
      const size   = box.getSize(new THREE.Vector3())
      const scale  = 100 / Math.max(size.x, size.y, size.z)

      obj.scale.setScalar(scale)
      obj.position.set(
        -centre.x * scale,
        -centre.y * scale + 6,   // lift slightly above shadow plane
        -centre.z * scale,
      )

      s.scene.add(obj)
      s.loadedObject = obj
      obj.traverse(c => { if (c.isMesh) s.meshes.push(c) })

      setLoadStatus('loaded')
      setLoadPct(100)
    },
    (p) => { if (p?.total) setLoadPct(Math.round(p.loaded / p.total * 100)) },
    (err) => { console.error('Three.js parse error:', err); setLoadStatus('error') },
  )
}

// ── Marker sync (FIX 3 — no shared singleton material) ───────────────────
function syncMarkers(s, placedPoints) {
  Object.keys(s.markers).forEach(name => {
    if (!placedPoints[name]) {
      s.scene.remove(s.markers[name])
      s.markers[name].geometry?.dispose()
      s.markers[name].material?.dispose()
      if (s.labels[name]) {
        s.scene.remove(s.labels[name])
        s.labels[name].material?.map?.dispose()
        s.labels[name].material?.dispose()
      }
      delete s.markers[name]; delete s.labels[name]
    }
  })

  Object.entries(placedPoints).forEach(([name, { x, y, z }]) => {
    if (s.markers[name]) {
      s.markers[name].position.set(x, y, z)
      if (s.labels[name]) s.labels[name].position.set(x, y + 4, z)
    } else {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xef4444, roughness: 0.3, metalness: 0.15,
        emissive: 0xcc0000, emissiveIntensity: 0.3,
      })
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.7, 20, 20), mat)
      sphere.position.set(x, y, z)
      s.scene.add(sphere)
      s.markers[name] = sphere

      const label = makeLabel(name)
      label.position.set(x, y + 4, z)
      s.scene.add(label)
      s.labels[name] = label
    }
  })
}

function makeLabel(text) {
  const canvas = document.createElement('canvas')
  canvas.width = 148; canvas.height = 36
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'rgba(15,23,42,0.87)'
  ctx.beginPath(); ctx.roundRect(0, 0, 148, 36, 7); ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 13px ui-monospace,monospace'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, 74, 18)
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true })
  const spr = new THREE.Sprite(mat); spr.scale.set(11, 2.7, 1)
  return spr
}