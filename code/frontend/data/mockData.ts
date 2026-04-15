export type PatientStatus = 'active' | 'awaiting-stl' | 'completed' | 'on-hold'

export interface Patient {
  id: string
  name: string
  status: PatientStatus
  parScore: number
  currentStep: number
  dateOfBirth: string
  startDate: string
  assignedDoctor: string
  avatar?: string
}

export interface DashboardMetrics {
  totalCases: number
  awaitingSTL: number
  avgPAR: number
  completedThisMonth: number
  parPending: number
  activeTrend: number
}

export interface ActivityItem {
  id: string
  type: 'stl-upload' | 'par-update' | 'status-change' | 'note' | 'appointment'
  message: string
  patientName: string
  timestamp: string
  icon: string
}

export interface STLFile {
  id: string
  patientId: string
  filename: string
  uploadDate: string
  status: 'pending' | 'approved' | 'rejected'
  fileSize: string
}

export interface MeasurementPoint {
  id: string
  patientId: string
  pointId: string
  location: string
  x: number
  y: number
  z: number
  measurement: number
  notes: string
}

export interface PARComponent {
  name: string
  score: number
  maxScore: number
}

export interface PARData {
  patientId: string
  components: PARComponent[]
  totalScore: number
  date: string
}

export const PROGRESS_STEPS = [
  'Initial Consultation',
  'Records & Imaging',
  'Treatment Planning',
  'Appliance Fitting',
  'Active Treatment',
  'Retention',
  'Completed',
]

export const STATUS_CONFIG: Record<
  PatientStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  active: {
    label: 'Active',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    dot: 'bg-emerald-500',
  },
  'awaiting-stl': {
    label: 'Awaiting STL',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    dot: 'bg-amber-500',
  },
  completed: {
    label: 'Completed',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    dot: 'bg-blue-500',
  },
  'on-hold': {
    label: 'On Hold',
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    dot: 'bg-gray-400',
  },
}

export const patients: Patient[] = [
  {
    id: 'p1',
    name: 'Sarah Mitchell',
    status: 'active',
    parScore: 18,
    currentStep: 4,
    dateOfBirth: '1998-03-15',
    startDate: '2025-09-12',
    assignedDoctor: 'Dr. Chen',
  },
  {
    id: 'p2',
    name: 'James Rodriguez',
    status: 'awaiting-stl',
    parScore: 24,
    currentStep: 2,
    dateOfBirth: '2001-07-22',
    startDate: '2025-11-03',
    assignedDoctor: 'Dr. Patel',
  },
  {
    id: 'p3',
    name: 'Emily Watson',
    status: 'active',
    parScore: 12,
    currentStep: 5,
    dateOfBirth: '1995-11-08',
    startDate: '2025-06-20',
    assignedDoctor: 'Dr. Chen',
  },
  {
    id: 'p4',
    name: 'Michael Park',
    status: 'completed',
    parScore: 4,
    currentStep: 6,
    dateOfBirth: '2003-01-30',
    startDate: '2024-12-15',
    assignedDoctor: 'Dr. Nakamura',
  },
  {
    id: 'p5',
    name: 'Olivia Thompson',
    status: 'on-hold',
    parScore: 31,
    currentStep: 3,
    dateOfBirth: '1999-05-14',
    startDate: '2025-08-01',
    assignedDoctor: 'Dr. Patel',
  },
  {
    id: 'p6',
    name: 'Daniel Kim',
    status: 'active',
    parScore: 15,
    currentStep: 3,
    dateOfBirth: '2000-09-25',
    startDate: '2025-10-18',
    assignedDoctor: 'Dr. Chen',
  },
  {
    id: 'p7',
    name: 'Ava Hernandez',
    status: 'awaiting-stl',
    parScore: 22,
    currentStep: 1,
    dateOfBirth: '1997-12-03',
    startDate: '2026-01-05',
    assignedDoctor: 'Dr. Nakamura',
  },
  {
    id: 'p8',
    name: "Liam O'Brien",
    status: 'active',
    parScore: 9,
    currentStep: 4,
    dateOfBirth: '2002-04-17',
    startDate: '2025-07-22',
    assignedDoctor: 'Dr. Patel',
  },
  {
    id: 'p9',
    name: 'Sophia Nguyen',
    status: 'completed',
    parScore: 3,
    currentStep: 6,
    dateOfBirth: '1996-08-11',
    startDate: '2024-11-30',
    assignedDoctor: 'Dr. Chen',
  },
  {
    id: 'p10',
    name: 'Noah Williams',
    status: 'active',
    parScore: 20,
    currentStep: 2,
    dateOfBirth: '2004-02-28',
    startDate: '2025-12-10',
    assignedDoctor: 'Dr. Nakamura',
  },
]

export const dashboardMetrics: DashboardMetrics = {
  totalCases: 47,
  awaitingSTL: 8,
  avgPAR: 16.2,
  completedThisMonth: 5,
  parPending: 12,
  activeTrend: 12,
}

export const activityFeed: ActivityItem[] = [
  {
    id: 'a1',
    type: 'stl-upload',
    message: 'New STL file uploaded for review',
    patientName: 'James Rodriguez',
    timestamp: '12 min ago',
    icon: 'upload',
  },
  {
    id: 'a2',
    type: 'par-update',
    message: 'PAR score updated — decreased from 22 to 18',
    patientName: 'Sarah Mitchell',
    timestamp: '1 hr ago',
    icon: 'trending-down',
  },
  {
    id: 'a3',
    type: 'status-change',
    message: 'Status changed to Completed',
    patientName: 'Sophia Nguyen',
    timestamp: '3 hrs ago',
    icon: 'check-circle',
  },
  {
    id: 'a4',
    type: 'appointment',
    message: 'Appointment scheduled for Feb 20',
    patientName: 'Daniel Kim',
    timestamp: '5 hrs ago',
    icon: 'calendar',
  },
  {
    id: 'a5',
    type: 'note',
    message: 'Treatment plan notes updated',
    patientName: 'Olivia Thompson',
    timestamp: '8 hrs ago',
    icon: 'file-text',
  },
  {
    id: 'a6',
    type: 'stl-upload',
    message: 'STL file approved by Dr. Nakamura',
    patientName: 'Ava Hernandez',
    timestamp: '1 day ago',
    icon: 'check',
  },
]

export const stlFiles: Record<string, STLFile[]> = {
  p1: [
    {
      id: 's1',
      patientId: 'p1',
      filename: 'upper_arch_v3.stl',
      uploadDate: '2026-01-15',
      status: 'approved',
      fileSize: '14.2 MB',
    },
    {
      id: 's2',
      patientId: 'p1',
      filename: 'lower_arch_v3.stl',
      uploadDate: '2026-01-15',
      status: 'approved',
      fileSize: '12.8 MB',
    },
    {
      id: 's3',
      patientId: 'p1',
      filename: 'upper_arch_v4.stl',
      uploadDate: '2026-02-10',
      status: 'pending',
      fileSize: '15.1 MB',
    },
  ],
  p2: [
    {
      id: 's4',
      patientId: 'p2',
      filename: 'initial_scan_upper.stl',
      uploadDate: '2026-01-20',
      status: 'pending',
      fileSize: '13.5 MB',
    },
    {
      id: 's5',
      patientId: 'p2',
      filename: 'initial_scan_lower.stl',
      uploadDate: '2026-01-20',
      status: 'pending',
      fileSize: '11.9 MB',
    },
  ],
  p3: [
    {
      id: 's6',
      patientId: 'p3',
      filename: 'mid_treatment_upper.stl',
      uploadDate: '2025-12-05',
      status: 'approved',
      fileSize: '14.7 MB',
    },
    {
      id: 's7',
      patientId: 'p3',
      filename: 'mid_treatment_lower.stl',
      uploadDate: '2025-12-05',
      status: 'approved',
      fileSize: '13.1 MB',
    },
  ],
  p5: [
    {
      id: 's8',
      patientId: 'p5',
      filename: 'planning_model.stl',
      uploadDate: '2025-10-12',
      status: 'rejected',
      fileSize: '16.3 MB',
    },
  ],
  p7: [
    {
      id: 's9',
      patientId: 'p7',
      filename: 'consultation_scan.stl',
      uploadDate: '2026-01-08',
      status: 'pending',
      fileSize: '12.4 MB',
    },
  ],
}

export const measurementPoints: Record<string, MeasurementPoint[]> = {
  p1: [
    {
      id: 'mp1',
      patientId: 'p1',
      pointId: 'N',
      location: 'Nasion',
      x: 0.0,
      y: 82.3,
      z: -5.1,
      measurement: 82.3,
      notes: 'Reference point',
    },
    {
      id: 'mp2',
      patientId: 'p1',
      pointId: 'S',
      location: 'Sella',
      x: 0.0,
      y: 72.1,
      z: -32.4,
      measurement: 72.1,
      notes: '',
    },
    {
      id: 'mp3',
      patientId: 'p1',
      pointId: 'A',
      location: 'Point A',
      x: 0.0,
      y: 68.5,
      z: 2.3,
      measurement: 68.5,
      notes: 'Subspinale',
    },
    {
      id: 'mp4',
      patientId: 'p1',
      pointId: 'B',
      location: 'Point B',
      x: 0.0,
      y: 52.1,
      z: -1.8,
      measurement: 52.1,
      notes: 'Supramentale',
    },
    {
      id: 'mp5',
      patientId: 'p1',
      pointId: 'Pog',
      location: 'Pogonion',
      x: 0.0,
      y: 45.2,
      z: 3.7,
      measurement: 45.2,
      notes: '',
    },
    {
      id: 'mp6',
      patientId: 'p1',
      pointId: 'Me',
      location: 'Menton',
      x: 0.0,
      y: 38.9,
      z: -0.5,
      measurement: 38.9,
      notes: 'Lowest point',
    },
  ],
  p2: [
    {
      id: 'mp7',
      patientId: 'p2',
      pointId: 'N',
      location: 'Nasion',
      x: 0.0,
      y: 85.1,
      z: -4.8,
      measurement: 85.1,
      notes: '',
    },
    {
      id: 'mp8',
      patientId: 'p2',
      pointId: 'S',
      location: 'Sella',
      x: 0.0,
      y: 74.3,
      z: -30.1,
      measurement: 74.3,
      notes: '',
    },
    {
      id: 'mp9',
      patientId: 'p2',
      pointId: 'A',
      location: 'Point A',
      x: 0.0,
      y: 70.2,
      z: 3.1,
      measurement: 70.2,
      notes: '',
    },
  ],
  p3: [
    {
      id: 'mp10',
      patientId: 'p3',
      pointId: 'N',
      location: 'Nasion',
      x: 0.0,
      y: 80.7,
      z: -5.5,
      measurement: 80.7,
      notes: '',
    },
    {
      id: 'mp11',
      patientId: 'p3',
      pointId: 'S',
      location: 'Sella',
      x: 0.0,
      y: 70.9,
      z: -33.2,
      measurement: 70.9,
      notes: '',
    },
  ],
}

export const parData: Record<string, PARData> = {
  p1: {
    patientId: 'p1',
    totalScore: 18,
    date: '2026-02-10',
    components: [
      { name: 'Upper Anterior', score: 3, maxScore: 10 },
      { name: 'Lower Anterior', score: 2, maxScore: 10 },
      { name: 'Buccal Occlusion R', score: 3, maxScore: 10 },
      { name: 'Buccal Occlusion L', score: 2, maxScore: 10 },
      { name: 'Overjet', score: 4, maxScore: 10 },
      { name: 'Overbite', score: 2, maxScore: 10 },
      { name: 'Centerline', score: 2, maxScore: 4 },
    ],
  },
  p2: {
    patientId: 'p2',
    totalScore: 24,
    date: '2026-01-22',
    components: [
      { name: 'Upper Anterior', score: 5, maxScore: 10 },
      { name: 'Lower Anterior', score: 4, maxScore: 10 },
      { name: 'Buccal Occlusion R', score: 3, maxScore: 10 },
      { name: 'Buccal Occlusion L', score: 4, maxScore: 10 },
      { name: 'Overjet', score: 3, maxScore: 10 },
      { name: 'Overbite', score: 3, maxScore: 10 },
      { name: 'Centerline', score: 2, maxScore: 4 },
    ],
  },
  p3: {
    patientId: 'p3',
    totalScore: 12,
    date: '2026-02-05',
    components: [
      { name: 'Upper Anterior', score: 2, maxScore: 10 },
      { name: 'Lower Anterior', score: 1, maxScore: 10 },
      { name: 'Buccal Occlusion R', score: 2, maxScore: 10 },
      { name: 'Buccal Occlusion L', score: 2, maxScore: 10 },
      { name: 'Overjet', score: 2, maxScore: 10 },
      { name: 'Overbite', score: 1, maxScore: 10 },
      { name: 'Centerline', score: 2, maxScore: 4 },
    ],
  },
  p5: {
    patientId: 'p5',
    totalScore: 31,
    date: '2025-10-15',
    components: [
      { name: 'Upper Anterior', score: 6, maxScore: 10 },
      { name: 'Lower Anterior', score: 5, maxScore: 10 },
      { name: 'Buccal Occlusion R', score: 5, maxScore: 10 },
      { name: 'Buccal Occlusion L', score: 4, maxScore: 10 },
      { name: 'Overjet', score: 5, maxScore: 10 },
      { name: 'Overbite', score: 3, maxScore: 10 },
      { name: 'Centerline', score: 3, maxScore: 4 },
    ],
  },
  p6: {
    patientId: 'p6',
    totalScore: 15,
    date: '2026-02-01',
    components: [
      { name: 'Upper Anterior', score: 3, maxScore: 10 },
      { name: 'Lower Anterior', score: 2, maxScore: 10 },
      { name: 'Buccal Occlusion R', score: 2, maxScore: 10 },
      { name: 'Buccal Occlusion L', score: 2, maxScore: 10 },
      { name: 'Overjet', score: 3, maxScore: 10 },
      { name: 'Overbite', score: 2, maxScore: 10 },
      { name: 'Centerline', score: 1, maxScore: 4 },
    ],
  },
  p8: {
    patientId: 'p8',
    totalScore: 9,
    date: '2026-01-28',
    components: [
      { name: 'Upper Anterior', score: 1, maxScore: 10 },
      { name: 'Lower Anterior', score: 1, maxScore: 10 },
      { name: 'Buccal Occlusion R', score: 2, maxScore: 10 },
      { name: 'Buccal Occlusion L', score: 1, maxScore: 10 },
      { name: 'Overjet', score: 2, maxScore: 10 },
      { name: 'Overbite', score: 1, maxScore: 10 },
      { name: 'Centerline', score: 1, maxScore: 4 },
    ],
  },
  p10: {
    patientId: 'p10',
    totalScore: 20,
    date: '2026-02-12',
    components: [
      { name: 'Upper Anterior', score: 4, maxScore: 10 },
      { name: 'Lower Anterior', score: 3, maxScore: 10 },
      { name: 'Buccal Occlusion R', score: 3, maxScore: 10 },
      { name: 'Buccal Occlusion L', score: 2, maxScore: 10 },
      { name: 'Overjet', score: 4, maxScore: 10 },
      { name: 'Overbite', score: 2, maxScore: 10 },
      { name: 'Centerline', score: 2, maxScore: 4 },
    ],
  },
}
