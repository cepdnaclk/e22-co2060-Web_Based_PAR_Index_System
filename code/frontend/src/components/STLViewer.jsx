// frontend/src/components/STLViewer.jsx
//
// REQUIREMENT 5 — 3D Viewer Safety and Coordinate Standardisation
//   - Coordinate standardisation (center geometry to origin)
//   - File size check via HEAD request — warn if > 30MB, "Load anyway" button
//   - WebGL context loss handler — prevents silent black screen
//   - Memory disposal on unmount
//   - Geometry complexity cap: 500,000 vertices max (log warning, SimplifyModifier not in deps — cap shown in UI)
//   - Arch color coding: UPPER=#4A90D9, LOWER=#E8724A, BUCCAL=#5BAD6F
//   - Orientation indicators: text overlay, R/L/A/P axis labels
//   - View buttons: Occlusal / Buccal / Reset
//   - 10mm scale reference overlay from bounding box
//   - Progressive loading: onProgress callback shows percentage
//   - Empty geometry error: "STL file appears empty or corrupted — please re-upload"
//   - Vertex count display: "Mesh: 234,521 vertices"
//
// FIX (inherited from accepted): Bytes pre-fetched via axios (JWT interceptor),
//   wrapped in Blob, blob:// URL handed to STLLoader — no auth issue.

import { useEffect, useRef, useCallback, useState } from 'react'
import * as THREE from 'three'
import { STLLoader }     from 'three/examples/jsm/loaders/STLLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import api from '../api/api'

// REQUIREMENT 5: Arch color coding
const ARCH_COLOR = {
  UPPER:  0x4A90D9,  // blue
  LOWER:  0xE8724A,  // coral
  BUCCAL: 0x5BAD6F,  // green
}

const ARCH_LABEL = {
  UPPER:  'UPPER ARCH',
  LOWER:  'LOWER ARCH',
  BUCCAL: 'BUCCAL',
}

// Marker colors per landmark category
const CATEGORY_COLORS = {
  UPPER:  0x2563eb,
  LOWER:  0x16a34a,
  BUCCAL: 0xd97706,
}

const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024   // 30 MB
const MAX_VERTICES        = 500_000

/**
 * STLViewer — Three.js STL viewer with landmark placement and all REQUIREMENT 5 features.
 */
export default function STLViewer({
  url,
  slot             = 'UPPER',
  caseId,
  height           = 400,
  placementMode    = false,
  activeLandmark = null,
  placedPoints     = {},
  landmarkCategory = 'UPPER',
  onPointPlaced    = null,
}) {
  const mountRef = useRef(null)
  const stateRef = useRef({
    scene: null, camera: null, renderer: null,
    controls: null, meshes: [], markers: {}, animId: null,
    geometry: null, material: null,
  })

  const [loadProgress, setLoadProgress]   = useState(0)          // 0–100
  const [loadingMsg,   setLoadingMsg]     = useState('')
  const [viewerError,  setViewerError]    = useState('')
  const [vertexCount,  setVertexCount]    = useState(null)
  const [scaleMm,      setScaleMm]        = useState(null)        // bounding box mm estimate
  const [largeFile,    setLargeFile]      = useState(false)       // > 30MB warning
  const [loadAnyway,   setLoadAnyway]     = useState(false)       // user override
  const [readyToLoad,  setReadyToLoad]    = useState(false)

  // ── Check file size before loading ───────────────────────────────────
  useEffect(() => {
    if (!url) return
    let isCurrentCheck = true

    setLargeFile(false)
    setLoadAnyway(false)
    setReadyToLoad(false)
    setViewerError('')
    setLoadProgress(0)
    setLoadingMsg('')
    setVertexCount(null)
    setScaleMm(null)

    // REQUIREMENT 5: HEAD request to check file size
    api.request({ method: 'HEAD', url })
      .then(res => {
        if (!isCurrentCheck) return
        const contentLength = res.headers['content-length']
        if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE_BYTES) {
          setLargeFile(true)
        } else {
          setReadyToLoad(true)
        }
      })
      .catch(() => {
        if (!isCurrentCheck) return
        // HEAD failed — proceed with load attempt safely
        setReadyToLoad(true)
      })

    return () => {
      isCurrentCheck = false
    }
  }, [url])

  // Trigger load when ready or overridden by user
  useEffect(() => {
    let isCurrentLoad = true
    let blobUrl = null

    if ((readyToLoad || loadAnyway) && url && mountRef.current) {
      if (loadAnyway) {
        setLargeFile(false)
      }
      buildScene(isCurrentLoad, (url) => { blobUrl = url })
    }

    return () => {
      isCurrentLoad = false
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
      }
      // Safe component unmount cleanup trigger
      if (stateRef.current._cleanup) {
        stateRef.current._cleanup()
      }
    }
  }, [readyToLoad, loadAnyway, url]) // eslint-disable-line

  function buildScene(isCurrentLoad, setTrackedBlobUrl) {
    const el = mountRef.current
    if (!el) return
    const s  = stateRef.current
    const w  = el.offsetWidth || 500

    // Clean up any previous scene instance safely before building a new one
    if (s.renderer) {
      if (s.animId) cancelAnimationFrame(s.animId)
      if (s.renderer.domElement && el.contains(s.renderer.domElement)) {
        el.removeChild(s.renderer.domElement)
      }
      s.renderer.forceContextLoss()
      s.geometry?.dispose()
      s.material?.dispose()
      s.renderer.dispose()
      s.controls?.dispose()
      Object.values(s.markers).forEach(m => {
        m.geometry?.dispose()
        m.material?.dispose()
      })
      s.markers = {}
      s.meshes = []
    }

    s.scene = new THREE.Scene()
    s.scene.background = new THREE.Color(0xf0f4f8)

    s.camera = new THREE.PerspectiveCamera(50, w / height, 0.01, 5000)
    s.camera.position.set(0, 20, 120)

    s.renderer = new THREE.WebGLRenderer({ antialias: true })
    s.renderer.setSize(w, height)
    s.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    s.renderer.shadowMap.enabled = true
    el.appendChild(s.renderer.domElement)

    // REQUIREMENT 5: WebGL context loss handler
    s.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      setViewerError('3D viewer lost GPU context. Please refresh the page.')
    })

    s.controls = new OrbitControls(s.camera, s.renderer.domElement)
    s.controls.enableDamping = true
    s.controls.dampingFactor = 0.07

    // Lighting
    s.scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const dir = new THREE.DirectionalLight(0xffffff, 1.2)
    dir.position.set(80, 120, 60)
    dir.castShadow = true
    s.scene.add(dir)
    const fill = new THREE.DirectionalLight(0xc8d8f0, 0.4)
    fill.position.set(-60, -40, -50)
    s.scene.add(fill)

    // Animate loop
    const animate = () => {
      s.animId = requestAnimationFrame(animate)
      s.controls.update()
      s.renderer?.render(s.scene, s.camera)
    }
    animate()

    // Resize observer
    const ro = new ResizeObserver(() => {
      const nw = el.offsetWidth
      if (!nw || !s.camera || !s.renderer) return
      s.camera.aspect = nw / height
      s.camera.updateProjectionMatrix()
      s.renderer.setSize(nw, height)
    })
    ro.observe(el)

    setLoadingMsg('Fetching model…')
    setLoadProgress(5)

    // REQUIREMENT 5 + inherited FIX: fetch via axios (JWT header), then blob URL
    api.get(url, {
      responseType: 'arraybuffer',
      timeout: 180_000,
    })
    .then(response => {
      if (!isCurrentLoad || !mountRef.current) return

      const blob = new Blob([response.data], { type: 'application/octet-stream' })
      const bUrl = URL.createObjectURL(blob)
      setTrackedBlobUrl(bUrl)
      setLoadProgress(30)
      setLoadingMsg('Parsing mesh…')

      new STLLoader().load(
        bUrl,
        (geo) => {
          if (!isCurrentLoad || !mountRef.current) {
            geo.dispose()
            return
          }

          // REQUIREMENT 5: Check for empty geometry
          const faceCount = geo.attributes.position
            ? geo.attributes.position.count / 3
            : 0

          if (faceCount === 0) {
            setViewerError('STL file appears empty or corrupted — please re-upload')
            setLoadingMsg('')
            geo.dispose()
            return
          }

          // REQUIREMENT 5: Vertex count display
          const vCount = geo.attributes.position.count
          setVertexCount(vCount)

          if (vCount > MAX_VERTICES) {
            console.warn(`STL vertex count ${vCount} exceeds ${MAX_VERTICES}. Performance may be reduced.`)
          }

          if (!geo.hasAttribute('normal')) geo.computeVertexNormals()

          // REQUIREMENT 5: Coordinate standardisation — center geometry at origin
          geo.computeBoundingBox()
          const center = new THREE.Vector3()
          geo.boundingBox.getCenter(center)
          geo.translate(-center.x, -center.y, -center.z)

          // REQUIREMENT 5: 10mm scale reference from bounding box
          geo.computeBoundingBox()
          const size = new THREE.Vector3()
          geo.boundingBox.getSize(size)
          const maxDim = Math.max(size.x, size.y, size.z)
          setScaleMm(Math.round(maxDim))

          // REQUIREMENT 5: Arch color coding
          const archColor = ARCH_COLOR[slot] ?? 0x93c5fd

          // REQUIREMENT 5: Memory disposal — store references
          s.geometry = geo
          s.material = new THREE.MeshPhongMaterial({
            color:     archColor,
            specular:  0x223344,
            shininess: 60,
            side:      THREE.DoubleSide,
          })

          const mesh = new THREE.Mesh(s.geometry, s.material)
          mesh.castShadow = mesh.receiveShadow = true

          // Auto-scale to fit view natively inside box
          const scale = 80 / Math.max(size.x, size.y, size.z)
          mesh.scale.setScalar(scale)

          s.scene.add(mesh)
          s.meshes = [mesh]

          // Trigger immediate marker re-sync for existing data coordinates
          syncPlacedMarkers()

          setLoadProgress(100)
          setLoadingMsg('')
        },
        (progressEvent) => {
          if (!isCurrentLoad) return
          if (progressEvent.total > 0) {
            const pct = Math.round(30 + (progressEvent.loaded / progressEvent.total) * 65)
            setLoadProgress(pct)
            setLoadingMsg(`Loading mesh… ${pct}%`)
          }
        },
        (err) => {
          if (!isCurrentLoad) return
          console.error('STL parse error:', err)
          setViewerError('Failed to parse STL file. The file may be corrupted.')
          setLoadingMsg('')
        }
      )
    })
    .catch(err => {
      if (!isCurrentLoad) return
      console.error('STL fetch error:', err)
      setViewerError('Failed to load 3D model. Check your connection or re-upload the file.')
      setLoadingMsg('')
    })

    // REQUIREMENT 5: Unified Memory disposal cleanup closure
    s._cleanup = () => {
      cancelAnimationFrame(s.animId)
      s.animId = null
      ro.disconnect()
      if (s.renderer?.domElement && el.contains(s.renderer.domElement)) {
        el.removeChild(s.renderer.domElement)
      }
      s.renderer?.forceContextLoss()
      
      s.geometry?.dispose()
      s.material?.dispose()
      s.renderer?.dispose()
      s.controls?.dispose()
      
      Object.values(s.markers).forEach(m => {
        m.geometry?.dispose()
        m.material?.dispose()
      })

      s.meshes    = []
      s.markers   = {}
      s.scene     = null
      s.renderer  = null
      s.controls  = null
      s.geometry  = null
      s.material  = null
    }
  }

  // Camera view preset bindings
  function setOcclusalView() {
    const s = stateRef.current
    if (!s.camera || !s.controls) return
    s.camera.position.set(0, 200, 0)
    s.camera.lookAt(0, 0, 0)
    s.controls.target.set(0, 0, 0)
    s.controls.update()
  }

  function setBuccalView() {
    const s = stateRef.current
    if (!s.camera || !s.controls) return
    s.camera.position.set(150, 0, 0)
    s.camera.lookAt(0, 0, 0)
    s.controls.target.set(0, 0, 0)
    s.controls.update()
  }

  function resetView() {
    const s = stateRef.current
    if (!s.camera || !s.controls) return
    s.camera.position.set(0, 20, 120)
    s.camera.lookAt(0, 0, 0)
    s.controls.target.set(0, 0, 0)
    s.controls.update()
  }

  // Encapsulated sync action for reuse on lazy scene allocations
  const syncPlacedMarkers = useCallback(() => {
    const s = stateRef.current
    if (!s.scene) return
    const color = CATEGORY_COLORS[landmarkCategory] ?? 0xef4444

    Object.keys(s.markers).forEach(name => {
      if (!placedPoints[name]) {
        s.scene.remove(s.markers[name])
        s.markers[name].geometry?.dispose()
        s.markers[name].material?.dispose()
        delete s.markers[name]
      }
    })
    Object.entries(placedPoints).forEach(([name, pt]) => {
      if (!pt) return
      const { x, y, z } = pt
      if (s.markers[name]) {
        s.markers[name].position.set(x, y, z)
      } else {
        const mat = new THREE.MeshStandardMaterial({
          color, emissive: color, emissiveIntensity: 0.3,
          roughness: 0.2, metalness: 0.1,
        })
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 14), mat)
        sphere.position.set(x, y, z)
        s.scene.add(sphere)
        s.markers[name] = sphere
      }
    })
  }, [placedPoints, landmarkCategory])

  // Sync variations dynamically
  useEffect(() => {
    syncPlacedMarkers()
  }, [syncPlacedMarkers])

  // Click → raycast for landmark placement
  const handleClick = useCallback((e) => {
    if (!placementMode || !activeLandmark || !onPointPlaced) return
    const s = stateRef.current
    if (!s.renderer || !s.meshes.length) return
    const rect  = s.renderer.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left)  / rect.width)  * 2 - 1,
      -((e.clientY - rect.top)  / rect.height) * 2 + 1,
    )
    const rc = new THREE.Raycaster()
    rc.setFromCamera(mouse, s.camera)
    const hits = rc.intersectObjects(s.meshes, true)
    if (hits.length) {
      const { x, y, z } = hits[0].point
      onPointPlaced(activeLandmark, { x, y, z })
    }
  }, [placementMode, activeLandmark, onPointPlaced])

  return (
    <div style={{ position: 'relative', width: '100%' }}>

      {/* REQUIREMENT 5: Large file warning banner */}
      {largeFile && !loadAnyway && (
        <div style={{
          background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8,
          padding: '10px 16px', marginBottom: 8, fontSize: 13, color: '#92400e',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>⚠️ <strong>Large file — loading may be slow</strong></span>
          <button
            onClick={() => setLoadAnyway(true)}
            style={{
              background: '#d97706', color: '#fff', border: 'none',
              borderRadius: 6, padding: '5px 14px', cursor: 'pointer',
              fontWeight: 600, fontSize: 12,
            }}
          >
            Load anyway
          </button>
        </div>
      )}

      {/* REQUIREMENT 5: Error display */}
      {viewerError && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8,
          padding: '12px 16px', marginBottom: 8, fontSize: 13, color: '#dc2626',
          fontWeight: 500,
        }}>
          ❌ {viewerError}
        </div>
      )}

      {/* 3D canvas container */}
      <div style={{ position: 'relative' }}>
        <div
          ref={mountRef}
          onClick={handleClick}
          style={{
            width: '100%', height,
            borderRadius: 8, overflow: 'hidden',
            cursor: placementMode ? 'crosshair' : 'grab',
            border: placementMode ? '2px solid #2563eb' : '1px solid #e2e8f0',
            background: '#f0f4f8',
            display: largeFile && !loadAnyway ? 'none' : 'block',
          }}
        />

        {/* REQUIREMENT 5: Loading progress overlay */}
        {loadingMsg && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(240,244,248,0.85)', flexDirection: 'column', gap: 10,
            borderRadius: 8,
          }}>
            <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{loadingMsg}</div>
            <div style={{
              width: 200, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden',
            }}>
              <div style={{
                width: `${loadProgress}%`, height: '100%',
                background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
                borderRadius: 3, transition: 'width 0.3s',
              }} />
            </div>
          </div>
        )}

        {/* REQUIREMENT 5: Arch label overlay */}
        {!loadingMsg && !viewerError && (largeFile ? loadAnyway : true) && (
          <div style={{
            position: 'absolute', top: 8, left: 8,
            background: 'rgba(0,0,0,0.55)', color: '#fff',
            borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600,
            pointerEvents: 'none',
          }}>
            Viewing: {ARCH_LABEL[slot] ?? slot}
          </div>
        )}

        {/* REQUIREMENT 5: Vertex count */}
        {vertexCount != null && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(0,0,0,0.55)', color: '#fff',
            borderRadius: 6, padding: '4px 10px', fontSize: 11,
            pointerEvents: 'none',
          }}>
            Mesh: {vertexCount.toLocaleString()} vertices
            {vertexCount > MAX_VERTICES && (
              <span style={{ color: '#fbbf24', marginLeft: 6 }}>⚠️ High complexity</span>
            )}
          </div>
        )}

        {/* REQUIREMENT 5: Scale reference overlay */}
        {scaleMm != null && !loadingMsg && !viewerError && (largeFile ? loadAnyway : true) && (
          <div style={{
            position: 'absolute', bottom: 40, left: 8,
            background: 'rgba(0,0,0,0.5)', color: '#fff',
            borderRadius: 6, padding: '3px 8px', fontSize: 11,
            pointerEvents: 'none',
          }}>
            ↔ ~{scaleMm}mm
          </div>
        )}

        {/* REQUIREMENT 5: R/L/A/P axis indicator */}
        {!loadingMsg && !viewerError && (largeFile ? loadAnyway : true) && (
          <div style={{
            position: 'absolute', bottom: 8, left: 8,
            background: 'rgba(0,0,0,0.45)', color: '#fff',
            borderRadius: 6, padding: '4px 8px', fontSize: 10, lineHeight: 1.4,
            pointerEvents: 'none',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px 8px',
          }}>
            <span style={{ color: '#93c5fd' }}>R</span><span>Right</span>
            <span style={{ color: '#93c5fd' }}>L</span><span>Left</span>
            <span style={{ color: '#86efac' }}>A</span><span>Anterior</span>
            <span style={{ color: '#86efac' }}>P</span><span>Posterior</span>
          </div>
        )}
      </div>

      {/* REQUIREMENT 5: View control buttons */}
      {!loadingMsg && !viewerError && (largeFile ? loadAnyway : true) && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {[
            { label: '⬇ Occlusal', fn: setOcclusalView, title: 'Camera looking straight down at teeth' },
            { label: '◀ Buccal',   fn: setBuccalView,    title: 'Camera from the side' },
            { label: '↺ Reset',    fn: resetView,        title: 'Return to default orbital position' },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.fn}
              title={btn.title}
              style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db',
                background: '#fff', color: '#374151', cursor: 'pointer',
                fontSize: 12, fontWeight: 500,
                transition: 'all 0.15s',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}