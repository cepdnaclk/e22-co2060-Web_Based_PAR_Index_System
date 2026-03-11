import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  RotateCcwIcon,
  DownloadIcon,
  MaximizeIcon,
  EyeIcon,
  EyeOffIcon,
  CrosshairIcon,
  ZapIcon,
  ChevronRightIcon,
  InfoIcon,
  XIcon,
} from 'lucide-react'
interface STLAnalysisToolProps {
  filename: string
  patientId: string
  onBack: () => void
}
type ViewMode = 'combined' | 'upper' | 'lower'
interface Landmark {
  id: string
  label: string
  position: THREE.Vector3
  group: 'upper' | 'lower' | 'midline'
  color: string
}
interface PARSection {
  id: string
  name: string
  score: number
  maxScore: number
  weight: number
  description: string
}
const LANDMARKS: Landmark[] = [
  {
    id: 'ur1',
    label: 'UR1',
    position: new THREE.Vector3(0.3, 0.8, 1.8),
    group: 'upper',
    color: '#3b82f6',
  },
  {
    id: 'ul1',
    label: 'UL1',
    position: new THREE.Vector3(-0.3, 0.8, 1.8),
    group: 'upper',
    color: '#3b82f6',
  },
  {
    id: 'ur3',
    label: 'UR3',
    position: new THREE.Vector3(1.2, 0.6, 1.4),
    group: 'upper',
    color: '#3b82f6',
  },
  {
    id: 'ul3',
    label: 'UL3',
    position: new THREE.Vector3(-1.2, 0.6, 1.4),
    group: 'upper',
    color: '#3b82f6',
  },
  {
    id: 'ur6',
    label: 'UR6',
    position: new THREE.Vector3(1.6, 0.4, 0.2),
    group: 'upper',
    color: '#8b5cf6',
  },
  {
    id: 'ul6',
    label: 'UL6',
    position: new THREE.Vector3(-1.6, 0.4, 0.2),
    group: 'upper',
    color: '#8b5cf6',
  },
  {
    id: 'lr1',
    label: 'LR1',
    position: new THREE.Vector3(0.25, -0.6, 1.7),
    group: 'lower',
    color: '#10b981',
  },
  {
    id: 'll1',
    label: 'LL1',
    position: new THREE.Vector3(-0.25, -0.6, 1.7),
    group: 'lower',
    color: '#10b981',
  },
  {
    id: 'lr3',
    label: 'LR3',
    position: new THREE.Vector3(1.1, -0.5, 1.3),
    group: 'lower',
    color: '#10b981',
  },
  {
    id: 'll3',
    label: 'LL3',
    position: new THREE.Vector3(-1.1, -0.5, 1.3),
    group: 'lower',
    color: '#10b981',
  },
  {
    id: 'lr6',
    label: 'LR6',
    position: new THREE.Vector3(1.5, -0.3, 0.1),
    group: 'lower',
    color: '#f59e0b',
  },
  {
    id: 'll6',
    label: 'LL6',
    position: new THREE.Vector3(-1.5, -0.3, 0.1),
    group: 'lower',
    color: '#f59e0b',
  },
  {
    id: 'midU',
    label: 'Upper Midline',
    position: new THREE.Vector3(0.05, 0.8, 1.85),
    group: 'midline',
    color: '#ef4444',
  },
  {
    id: 'midL',
    label: 'Lower Midline',
    position: new THREE.Vector3(-0.02, -0.6, 1.75),
    group: 'midline',
    color: '#ef4444',
  },
]
function createDentalArch(isUpper: boolean): THREE.Group {
  const group = new THREE.Group()
  const material = new THREE.MeshPhysicalMaterial({
    color: isUpper ? 0xf5e6d3 : 0xf0dcc8,
    roughness: 0.35,
    metalness: 0.0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
  })
  // Base arch shape using a curved path
  const archShape = new THREE.Shape()
  const yOff = isUpper ? 0.3 : -0.2
  archShape.moveTo(-1.8, -0.8 + yOff)
  archShape.quadraticCurveTo(-2.0, 0.6 + yOff, -1.2, 1.4 + yOff)
  archShape.quadraticCurveTo(0, 2.2 + yOff, 1.2, 1.4 + yOff)
  archShape.quadraticCurveTo(2.0, 0.6 + yOff, 1.8, -0.8 + yOff)
  archShape.lineTo(1.4, -0.6 + yOff)
  archShape.quadraticCurveTo(1.6, 0.4 + yOff, 0.9, 1.0 + yOff)
  archShape.quadraticCurveTo(0, 1.6 + yOff, -0.9, 1.0 + yOff)
  archShape.quadraticCurveTo(-1.6, 0.4 + yOff, -1.4, -0.6 + yOff)
  archShape.lineTo(-1.8, -0.8 + yOff)
  const extrudeSettings = {
    depth: 0.3,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 3,
  }
  const archGeo = new THREE.ExtrudeGeometry(archShape, extrudeSettings)
  const archMesh = new THREE.Mesh(archGeo, material)
  archMesh.rotation.x = isUpper ? -0.15 : 0.15
  archMesh.position.y = isUpper ? 0.3 : -0.3
  group.add(archMesh)
  // Add individual teeth as small rounded boxes
  const toothMat = new THREE.MeshPhysicalMaterial({
    color: 0xfaf5ef,
    roughness: 0.2,
    metalness: 0.0,
    clearcoat: 0.5,
  })
  const teethPositions = [
    {
      x: 0,
      z: 1.7,
      w: 0.35,
      h: 0.4,
      d: 0.25,
    },
    {
      x: 0.4,
      z: 1.65,
      w: 0.3,
      h: 0.38,
      d: 0.22,
    },
    {
      x: -0.4,
      z: 1.65,
      w: 0.3,
      h: 0.38,
      d: 0.22,
    },
    {
      x: 0.75,
      z: 1.5,
      w: 0.28,
      h: 0.35,
      d: 0.22,
    },
    {
      x: -0.75,
      z: 1.5,
      w: 0.28,
      h: 0.35,
      d: 0.22,
    },
    {
      x: 1.1,
      z: 1.25,
      w: 0.32,
      h: 0.42,
      d: 0.25,
    },
    {
      x: -1.1,
      z: 1.25,
      w: 0.32,
      h: 0.42,
      d: 0.25,
    },
    {
      x: 1.35,
      z: 0.9,
      w: 0.3,
      h: 0.35,
      d: 0.25,
    },
    {
      x: -1.35,
      z: 0.9,
      w: 0.3,
      h: 0.35,
      d: 0.25,
    },
    {
      x: 1.5,
      z: 0.5,
      w: 0.35,
      h: 0.35,
      d: 0.3,
    },
    {
      x: -1.5,
      z: 0.5,
      w: 0.35,
      h: 0.35,
      d: 0.3,
    },
    {
      x: 1.55,
      z: 0.1,
      w: 0.38,
      h: 0.35,
      d: 0.32,
    },
    {
      x: -1.55,
      z: 0.1,
      w: 0.38,
      h: 0.35,
      d: 0.32,
    },
    {
      x: 1.5,
      z: -0.3,
      w: 0.35,
      h: 0.32,
      d: 0.3,
    },
    {
      x: -1.5,
      z: -0.3,
      w: 0.35,
      h: 0.32,
      d: 0.3,
    },
  ]
  teethPositions.forEach((t) => {
    const geo = new THREE.BoxGeometry(t.w, t.h, t.d)
    geo.translate(0, 0, 0)
    const edges = new THREE.EdgesGeometry(geo)
    const tooth = new THREE.Mesh(geo, toothMat)
    tooth.position.set(t.x, isUpper ? 0.65 : -0.5, t.z)
    tooth.rotation.x = isUpper ? -0.1 : 0.1
    group.add(tooth)
  })
  return group
}
function getSeverityColor(score: number): string {
  if (score <= 10) return '#10b981'
  if (score <= 20) return '#f59e0b'
  if (score <= 30) return '#f97316'
  return '#ef4444'
}
function getSeverityLabel(score: number): string {
  if (score <= 10) return 'Mild'
  if (score <= 20) return 'Moderate'
  if (score <= 30) return 'Severe'
  return 'Very Severe'
}
export function STLAnalysisTool({
  filename,
  patientId,
  onBack,
}: STLAnalysisToolProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const landmarkSpheresRef = useRef<THREE.Mesh[]>([])
  const upperGroupRef = useRef<THREE.Group | null>(null)
  const lowerGroupRef = useRef<THREE.Group | null>(null)
  const frameRef = useRef<number>(0)
  const [viewMode, setViewMode] = useState<ViewMode>('combined')
  const [selectedLandmark, setSelectedLandmark] = useState<string | null>(null)
  const [showLandmarks, setShowLandmarks] = useState(true)
  const [showMeasurements, setShowMeasurements] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [parSections, setParSections] = useState<PARSection[]>([
    {
      id: 'upper-ant',
      name: 'Upper Anterior Alignment',
      score: 3,
      maxScore: 5,
      weight: 1,
      description: 'Contact point displacement of upper 6 anterior teeth',
    },
    {
      id: 'lower-ant',
      name: 'Lower Anterior Alignment',
      score: 2,
      maxScore: 5,
      weight: 1,
      description: 'Contact point displacement of lower 6 anterior teeth',
    },
    {
      id: 'buccal-r',
      name: 'Right Buccal Occlusion',
      score: 2,
      maxScore: 4,
      weight: 2,
      description: 'Antero-posterior, vertical, and transverse relationship',
    },
    {
      id: 'buccal-l',
      name: 'Left Buccal Occlusion',
      score: 2,
      maxScore: 4,
      weight: 2,
      description: 'Antero-posterior, vertical, and transverse relationship',
    },
    {
      id: 'overjet',
      name: 'Overjet',
      score: 3,
      maxScore: 4,
      weight: 6,
      description: 'Horizontal overlap of incisors',
    },
    {
      id: 'overbite',
      name: 'Overbite',
      score: 1,
      maxScore: 4,
      weight: 2,
      description: 'Vertical overlap of incisors',
    },
    {
      id: 'centreline',
      name: 'Centreline Displacement',
      score: 1,
      maxScore: 2,
      weight: 4,
      description: 'Deviation of dental midlines',
    },
  ])
  const totalWeightedScore = useMemo(() => {
    return parSections.reduce((sum, s) => sum + s.score * s.weight, 0)
  }, [parSections])
  const totalMaxWeighted = useMemo(() => {
    return parSections.reduce((sum, s) => sum + s.maxScore * s.weight, 0)
  }, [parSections])
  const updateScore = useCallback((id: string, newScore: number) => {
    setParSections((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              score: Math.max(0, Math.min(s.maxScore, newScore)),
            }
          : s,
      ),
    )
  }, [])
  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight
    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf8fafc)
    sceneRef.current = scene
    // Camera
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100)
    camera.position.set(0, 2.5, 5)
    camera.lookAt(0, 0, 0.5)
    cameraRef.current = camera
    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer
    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 2
    controls.maxDistance = 12
    controls.maxPolarAngle = Math.PI * 0.85
    controls.target.set(0, 0, 0.5)
    controlsRef.current = controls
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.9)
    mainLight.position.set(3, 5, 4)
    mainLight.castShadow = true
    scene.add(mainLight)
    const fillLight = new THREE.DirectionalLight(0xe8f0fe, 0.4)
    fillLight.position.set(-3, 2, -2)
    scene.add(fillLight)
    const rimLight = new THREE.DirectionalLight(0xfff5e6, 0.3)
    rimLight.position.set(0, -2, 4)
    scene.add(rimLight)
    // Ground plane (subtle)
    const groundGeo = new THREE.PlaneGeometry(20, 20)
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 1,
    })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -1.5
    ground.receiveShadow = true
    scene.add(ground)
    // Grid helper (very subtle)
    const gridHelper = new THREE.GridHelper(8, 16, 0xe2e8f0, 0xf1f5f9)
    gridHelper.position.y = -1.49
    scene.add(gridHelper)
    // Create dental arches
    const upperArch = createDentalArch(true)
    const lowerArch = createDentalArch(false)
    scene.add(upperArch)
    scene.add(lowerArch)
    upperGroupRef.current = upperArch
    lowerGroupRef.current = lowerArch
    // Add landmark spheres
    const spheres: THREE.Mesh[] = []
    LANDMARKS.forEach((lm) => {
      const sphereGeo = new THREE.SphereGeometry(0.06, 16, 16)
      const sphereMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(lm.color),
        transparent: true,
        opacity: 0.9,
      })
      const sphere = new THREE.Mesh(sphereGeo, sphereMat)
      sphere.position.copy(lm.position)
      sphere.userData = {
        landmarkId: lm.id,
      }
      scene.add(sphere)
      spheres.push(sphere)
      // Ring around landmark
      const ringGeo = new THREE.RingGeometry(0.08, 0.1, 24)
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(lm.color),
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.position.copy(lm.position)
      ring.lookAt(camera.position)
      sphere.add(ring)
    })
    landmarkSpheresRef.current = spheres
    // Animation loop
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      controls.update()
      // Make landmark rings face camera
      spheres.forEach((s) => {
        if (s.children[0]) {
          s.children[0].lookAt(camera.position)
        }
      })
      renderer.render(scene, camera)
    }
    animate()
    // Resize handler
    const handleResize = () => {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)
    return () => {
      cancelAnimationFrame(frameRef.current)
      resizeObserver.disconnect()
      controls.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])
  // Update view mode
  useEffect(() => {
    if (!upperGroupRef.current || !lowerGroupRef.current) return
    upperGroupRef.current.visible =
      viewMode === 'combined' || viewMode === 'upper'
    lowerGroupRef.current.visible =
      viewMode === 'combined' || viewMode === 'lower'
    landmarkSpheresRef.current.forEach((s) => {
      const lm = LANDMARKS.find((l) => l.id === s.userData.landmarkId)
      if (!lm) return
      if (viewMode === 'upper') s.visible = lm.group !== 'lower'
      else if (viewMode === 'lower') s.visible = lm.group !== 'upper'
      else s.visible = true
    })
  }, [viewMode])
  // Toggle landmarks visibility
  useEffect(() => {
    landmarkSpheresRef.current.forEach((s) => {
      s.visible = showLandmarks
    })
  }, [showLandmarks])
  // Click handler for landmarks
  useEffect(() => {
    const container = containerRef.current
    const camera = cameraRef.current
    if (!container || !camera) return
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    const handleClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(landmarkSpheresRef.current)
      if (intersects.length > 0) {
        const id = intersects[0].object.userData.landmarkId
        setSelectedLandmark((prev) => (prev === id ? null : id))
      } else {
        setSelectedLandmark(null)
      }
    }
    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [])
  const resetView = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return
    cameraRef.current.position.set(0, 2.5, 5)
    controlsRef.current.target.set(0, 0, 0.5)
    controlsRef.current.update()
  }, [])
  const selectedLandmarkData = selectedLandmark
    ? LANDMARKS.find((l) => l.id === selectedLandmark)
    : null
  const severityColor = getSeverityColor(totalWeightedScore)
  const severityLabel = getSeverityLabel(totalWeightedScore)
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            <XIcon size={15} />
            Close Analysis
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-gray-600">
              {filename}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* View toggles */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            {(['combined', 'upper', 'lower'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150 ${viewMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                {mode === 'combined'
                  ? 'Both'
                  : mode === 'upper'
                    ? 'Upper'
                    : 'Lower'}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <button
            onClick={() => setShowLandmarks(!showLandmarks)}
            className={`p-1.5 rounded-lg transition-colors ${showLandmarks ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            title={showLandmarks ? 'Hide landmarks' : 'Show landmarks'}
          >
            <CrosshairIcon size={15} />
          </button>
          <button
            onClick={() => setShowMeasurements(!showMeasurements)}
            className={`p-1.5 rounded-lg transition-colors ${showMeasurements ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            title={showMeasurements ? 'Hide measurements' : 'Show measurements'}
          >
            {showMeasurements ? (
              <EyeIcon size={15} />
            ) : (
              <EyeOffIcon size={15} />
            )}
          </button>
          <button
            onClick={resetView}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
            title="Reset view"
          >
            <RotateCcwIcon size={15} />
          </button>
          <button
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
            title="Export results"
          >
            <DownloadIcon size={15} />
          </button>
        </div>
      </div>

      {/* Main content: Viewer + Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* 3D Viewer */}
        <div className="flex-1 relative">
          <div ref={containerRef} className="w-full h-full" />

          {/* Selected landmark info overlay */}
          <AnimatePresence>
            {selectedLandmarkData && (
              <motion.div
                initial={{
                  opacity: 0,
                  y: 8,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: 8,
                }}
                className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl border border-gray-200 shadow-lg px-4 py-3 max-w-xs"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: selectedLandmarkData.color,
                    }}
                  />
                  <span className="text-sm font-semibold text-gray-900">
                    {selectedLandmarkData.label}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                    {selectedLandmarkData.id}
                  </span>
                </div>
                <div className="text-xs text-gray-500 font-mono tabular-nums">
                  x: {selectedLandmarkData.position.x.toFixed(2)} &nbsp; y:{' '}
                  {selectedLandmarkData.position.y.toFixed(2)} &nbsp; z:{' '}
                  {selectedLandmarkData.position.z.toFixed(2)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Viewer controls hint */}
          <div className="absolute bottom-4 right-4 text-[10px] text-gray-400 bg-white/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-gray-100">
            Drag to rotate · Scroll to zoom · Right-click to pan
          </div>

          {/* Landmark legend */}
          {showLandmarks && (
            <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-100 px-3 py-2">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                Landmarks
              </p>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-[10px] text-gray-600">
                    Upper Anterior
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                  <span className="text-[10px] text-gray-600">
                    Upper Posterior
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-gray-600">
                    Lower Anterior
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-[10px] text-gray-600">
                    Lower Posterior
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[10px] text-gray-600">Midline</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PAR Calculator Sidebar */}
        <motion.div
          animate={{
            width: sidebarCollapsed ? 40 : 340,
          }}
          transition={{
            duration: 0.25,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          className="bg-white border-l border-gray-200 flex-shrink-0 flex flex-col overflow-hidden"
        >
          {sidebarCollapsed ? (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="w-full h-full flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
              title="Expand PAR panel"
            >
              <ChevronRightIcon size={16} className="rotate-180" />
            </button>
          ) : (
            <>
              {/* Sidebar header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <ZapIcon size={14} className="text-blue-600" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    PAR Calculator
                  </span>
                </div>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <ChevronRightIcon size={14} />
                </button>
              </div>

              {/* Total score banner */}
              <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                    Weighted Total
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full`}
                    style={{
                      backgroundColor: severityColor + '20',
                      color: severityColor,
                    }}
                  >
                    {severityLabel}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <motion.span
                    key={totalWeightedScore}
                    initial={{
                      scale: 1.1,
                    }}
                    animate={{
                      scale: 1,
                    }}
                    className="text-3xl font-bold tabular-nums tracking-tight"
                    style={{
                      color: severityColor,
                    }}
                  >
                    {totalWeightedScore}
                  </motion.span>
                  <span className="text-sm text-gray-400 tabular-nums">
                    / {totalMaxWeighted}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: severityColor,
                    }}
                    animate={{
                      width: `${(totalWeightedScore / totalMaxWeighted) * 100}%`,
                    }}
                    transition={{
                      duration: 0.4,
                      ease: 'easeOut',
                    }}
                  />
                </div>
              </div>

              {/* Scoring sections */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-3 space-y-1">
                  {parSections.map((section, idx) => {
                    const weightedScore = section.score * section.weight
                    const maxWeighted = section.maxScore * section.weight
                    const pct = (section.score / section.maxScore) * 100
                    const barColor = getSeverityColor(
                      section.score * (40 / section.maxScore),
                    )
                    return (
                      <motion.div
                        key={section.id}
                        initial={{
                          opacity: 0,
                          x: 8,
                        }}
                        animate={{
                          opacity: 1,
                          x: 0,
                        }}
                        transition={{
                          delay: idx * 0.04,
                        }}
                        className="bg-gray-50/80 rounded-xl p-3"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 leading-tight">
                              {section.name}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
                              {section.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                            <span className="text-[9px] font-medium text-gray-400 bg-gray-200/60 px-1 py-0.5 rounded">
                              ×{section.weight}
                            </span>
                          </div>
                        </div>

                        {/* Score control */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() =>
                                updateScore(section.id, section.score - 1)
                              }
                              className="w-6 h-6 rounded-md bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors text-xs font-bold"
                            >
                              −
                            </button>
                            <div className="w-8 h-6 flex items-center justify-center">
                              <span className="text-sm font-bold tabular-nums text-gray-900">
                                {section.score}
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                updateScore(section.id, section.score + 1)
                              }
                              className="w-6 h-6 rounded-md bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors text-xs font-bold"
                            >
                              +
                            </button>
                            <span className="text-[10px] text-gray-400 ml-1 tabular-nums">
                              / {section.maxScore}
                            </span>
                          </div>

                          <div className="flex-1 h-1.5 bg-gray-200/60 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{
                                backgroundColor: barColor,
                              }}
                              animate={{
                                width: `${pct}%`,
                              }}
                              transition={{
                                duration: 0.3,
                              }}
                            />
                          </div>

                          <span className="text-xs font-semibold tabular-nums text-gray-700 w-8 text-right">
                            {weightedScore}
                          </span>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>

              {/* Severity scale footer */}
              <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[9px] text-gray-400">0-10</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="text-[9px] text-gray-400">11-20</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      <span className="text-[9px] text-gray-400">21-30</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      <span className="text-[9px] text-gray-400">31+</span>
                    </div>
                  </div>
                  <button className="flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-700 transition-colors">
                    <DownloadIcon size={10} />
                    Export
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
