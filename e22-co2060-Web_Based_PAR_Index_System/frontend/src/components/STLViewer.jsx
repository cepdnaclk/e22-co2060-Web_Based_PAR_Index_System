// frontend/src/components/STLViewer.jsx
// STL-only viewer with landmark category coloring
//
// ── FIXES APPLIED ─────────────────────────────────────────────────────────────
// FIX 1 (WebGL context loss): Disposal order was wrong.
//   OLD order: dispose() → remove canvas from DOM
//   NEW order: cancel animation frame → remove canvas from DOM →
//              forceContextLoss() → dispose()
//   Without forceContextLoss() the GPU context is not immediately released.
//   When a new renderer mounts before GC runs, the browser sees 2+ live contexts
//   and forcibly evicts the old one → CONTEXT_LOST_WEBGL.
//
// FIX 2 (JWT / 403): STLLoader.load() uses native XHR — no JWT header.
//   Bytes are pre-fetched via axios (JWT interceptor included), wrapped in a
//   Blob, and a blob:// URL is handed to STLLoader. No network call is made
//   by Three.js, so auth is irrelevant.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { STLLoader }     from 'three/examples/jsm/loaders/STLLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import api from '../api/api'   // axios instance with JWT interceptor

// Marker colors per landmark category
const CATEGORY_COLORS = {
  UPPER:  0x2563eb,
  LOWER:  0x16a34a,
  BUCCAL: 0xd97706,
}

/**
 * STLViewer — focused STL viewer with raycaster click detection
 * Props:
 *   url              string        — relative API path (e.g. cases/4/models/UPPER)
 *   height           number        — canvas height (default 400)
 *   placementMode    bool
 *   activeLandmark   string|null
 *   placedPoints     {[name]:{x,y,z}}
 *   landmarkCategory 'UPPER'|'LOWER'|'BUCCAL'
 *   onPointPlaced    fn(name, {x,y,z})
 */
export default function STLViewer({
  url,
  height = 400,
  placementMode = false,
  activeLandmark = null,
  placedPoints = {},
  landmarkCategory = 'UPPER',
  onPointPlaced = null,
}) {
  const mountRef = useRef(null)
  const stateRef = useRef({
    scene: null, camera: null, renderer: null,
    controls: null, meshes: [], markers: {}, animId: null,
  })

  // Build scene + load model
  useEffect(() => {
    if (!url || !mountRef.current) return
    const el = mountRef.current
    const s  = stateRef.current
    const w  = el.offsetWidth || 500
    let blobUrl = null

    s.scene = new THREE.Scene()
    s.scene.background = new THREE.Color(0xf0f4f8)

    s.camera = new THREE.PerspectiveCamera(50, w / height, 0.01, 5000)
    s.camera.position.set(0, 20, 120)

    s.renderer = new THREE.WebGLRenderer({ antialias: true })
    s.renderer.setSize(w, height)
    s.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    s.renderer.shadowMap.enabled = true
    el.appendChild(s.renderer.domElement)

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
      s.renderer.render(s.scene, s.camera)
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

    // ── KEY FIX: fetch via axios (JWT header included), then give blob URL ──
    api.get(url, {
      responseType: 'arraybuffer',
      timeout: 180000,  // 3 min for large STL files
    })
    .then(response => {
      if (!mountRef.current) return  // unmounted during fetch

      const blob = new Blob([response.data], { type: 'application/octet-stream' })
      blobUrl = URL.createObjectURL(blob)

      new STLLoader().load(
        blobUrl,
        (geo) => {
          if (!geo.hasAttribute('normal')) geo.computeVertexNormals()
          const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
            color: 0x93c5fd, specular: 0x223344, shininess: 60,
            side: THREE.DoubleSide,
          }))
          mesh.castShadow = mesh.receiveShadow = true

          // Auto-center and scale
          const box    = new THREE.Box3().setFromObject(mesh)
          const center = box.getCenter(new THREE.Vector3())
          const size   = box.getSize(new THREE.Vector3())
          const scale  = 80 / Math.max(size.x, size.y, size.z)
          mesh.scale.setScalar(scale)
          mesh.position.sub(center.multiplyScalar(scale))

          s.scene.add(mesh)
          s.meshes = [mesh]
        },
        null,
        (err) => console.error('STL parse error:', err)
      )
    })
    .catch(err => {
      console.error('STL fetch error:', err)
    })
    // ── end fix ──────────────────────────────────────────────────────────────

    // ── FIX 1: Correct cleanup / disposal order ───────────────────────────
    // WRONG (old): dispose() first, then try to remove already-orphaned canvas
    // RIGHT (new): 1) stop loop  2) disconnect observer  3) remove canvas from
    //              DOM  4) forceContextLoss()  5) dispose()
    // forceContextLoss() is critical — without it the GPU context lingers until
    // the next GC, so the browser counts it as still "live".  If a second
    // renderer is created before GC fires (e.g. slot switch) you exceed the
    // browser's WebGL context limit (~8–16) and get CONTEXT_LOST_WEBGL.
    return () => {
      // 1. Stop the render loop immediately
      cancelAnimationFrame(s.animId)
      s.animId = null

      // 2. Stop watching for resize events
      ro.disconnect()

      // 3. Remove the canvas from the DOM before destroying the context
      if (s.renderer?.domElement && el.contains(s.renderer.domElement)) {
        el.removeChild(s.renderer.domElement)
      }

      // 4. Explicitly release the WebGL context so the browser reclaims the
      //    GPU slot right now (not at the next GC cycle)
      s.renderer?.forceContextLoss()

      // 5. Free all GPU-side Three.js resources (geometries, textures, etc.)
      s.renderer?.dispose()
      s.controls?.dispose()

      // 6. Clear JS-side references
      s.meshes    = []
      s.markers   = {}
      s.scene     = null
      s.renderer  = null
      s.controls  = null

      // 7. Release the in-memory blob URL
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [url, height]) // eslint-disable-line

  // Sync markers when placedPoints changes
  useEffect(() => {
    const s = stateRef.current
    if (!s.scene) return
    const color = CATEGORY_COLORS[landmarkCategory] ?? 0xef4444

    Object.keys(s.markers).forEach(name => {
      if (!placedPoints[name]) {
        s.scene.remove(s.markers[name])
        // Dispose marker geometry + material to avoid GPU leaks
        s.markers[name].geometry?.dispose()
        s.markers[name].material?.dispose()
        delete s.markers[name]
      }
    })
    Object.entries(placedPoints).forEach(([name, { x, y, z }]) => {
      if (s.markers[name]) {
        s.markers[name].position.set(x, y, z)
      } else {
        // Create a fresh material per marker — never share materials across
        // renderers or instances (shared materials cause disposal conflicts)
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

  // Click → raycast
  const handleClick = useCallback((e) => {
    if (!placementMode || !activeLandmark || !onPointPlaced) return
    const s = stateRef.current
    if (!s.renderer || !s.meshes.length) return
    const rect  = s.renderer.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
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
    <div
      ref={mountRef}
      onClick={handleClick}
      style={{
        width: '100%',
        height,
        borderRadius: 8,
        overflow: 'hidden',
        cursor: placementMode ? 'crosshair' : 'grab',
        border: placementMode ? '2px solid #2563eb' : '1px solid #e2e8f0',
        background: '#f0f4f8',
      }}
    />
  )
}