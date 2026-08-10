// frontend/src/api/api.js
//
// REQUIREMENT 6: JWT expiry during scoring session must not lose landmark work.
//   401 interceptor saves current landmark state to localStorage before redirect.

import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 60000,
})

// ── Request: attach JWT ────────────────────────────────────────────────────
api.interceptors.request.use(config => {
  const token = localStorage.getItem('par_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response: 401 → save landmarks then redirect ───────────────────────────
//
// REQUIREMENT 6: PAR landmark placement takes 15–30 minutes.
// Session expiry must not lose work. On 401, save current landmark
// state to localStorage keyed by caseId before redirecting to login.
//
// getCurrentCaseId() and getCurrentLandmarkState() are module-level
// functions set by LandmarkPanel so the interceptor can read them.

let _currentCaseId       = null
let _currentLandmarkState = null

/** Called by LandmarkPanel to register current case context */
export function registerLandmarkContext(caseId, getLandmarkStateFn) {
  _currentCaseId        = caseId
  _currentLandmarkState = getLandmarkStateFn
}

/** Called by LandmarkPanel on unmount to clear context */
export function clearLandmarkContext() {
  _currentCaseId        = null
  _currentLandmarkState = null
}

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // REQUIREMENT 6: Save landmark state before redirect
      const caseId    = _currentCaseId
      const landmarks = _currentLandmarkState ? _currentLandmarkState() : null

      if (landmarks && caseId) {
        try {
          localStorage.setItem(
            'unsaved_landmarks_' + caseId,
            JSON.stringify({ data: landmarks, savedAt: new Date().toISOString() })
          )
        } catch (e) {
          console.warn('Could not save landmarks to localStorage:', e)
        }
      }

      localStorage.removeItem('par_token')
      localStorage.removeItem('par_user')

      alert('Your session expired. Landmark progress saved locally. Log in to continue.')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ── Auth ───────────────────────────────────────────────────────────────────
export const authApi = {
  register: data => api.post('/auth/register', data),
  login:    data => api.post('/auth/login', data),
  me:       ()   => api.get('/me'),
}

// ── Patients ───────────────────────────────────────────────────────────────
export const patientApi = {
  list:    ()           => api.get('/patients'),
  get:     id           => api.get(`/patients/${id}`),
  create:  data         => api.post('/patients', data),
  update:  (id, data)   => api.put(`/patients/${id}`, data),
  archive: id           => api.patch(`/patients/${id}/archive`),
  search:  query        => api.get('/patients/search', { params: { query } }),
}

// ── Cases ──────────────────────────────────────────────────────────────────
export const caseApi = {
  listByPatient: patientId => api.get(`/cases/patient/${patientId}`),
  get:           id        => api.get(`/cases/${id}`),
  create:        params    => api.post('/cases', null, { params }),

  // BUG FIX: do NOT set Content-Type manually for multipart/form-data.
  // The browser must generate this header itself so it can append the
  // `boundary=...` parameter. Setting it explicitly (as before) produced
  // a boundary-less header and the backend's @RequestPart parser rejected
  // every upload. Axios will set the correct header automatically because
  // the body is a FormData instance.
  uploadModels: (id, formData) =>
    api.post(`/cases/${id}/models`, formData, {
      timeout: 120000,
    }),

  // Relative path — no /api/v1/ prefix (baseURL handles it)
  getModelFileUrl: (caseId, slot) => `cases/${caseId}/models/${slot}`,

  calculate: (id, data) => api.post(`/cases/${id}/calculate`, data),

  // Apply the case's ML predicted score as the final PAR score
  calculateFromMl: id => api.post(`/cases/${id}/calculate/ml`),

  finalize:   id     => api.post(`/cases/${id}/finalize`),
  unfinalize: (id, reason) => api.put(`/cases/${id}/unfinalize`, null, { params: { reason } }),

  // REQUIREMENT 8: File integrity verification
  verifyModel: (caseId, slot) => api.get(`/cases/${caseId}/models/${slot}/verify`),
}

// ── Training Sets ──────────────────────────────────────────────────────────
export const trainingApi = {
  create:       params        => api.post('/training-sets', null, { params }),

  // BUG FIX: same as caseApi.uploadModels — let axios/the browser set
  // Content-Type so the multipart boundary is generated correctly.
  uploadModels: (id, formData) =>
    api.post(`/training-sets/${id}/models`, formData, {
      timeout: 120000,
    }),

  listMy:       ()           => api.get('/training-sets/my'),
  listAssigned: ()           => api.get('/training-sets/assigned'),
  listAll:      (status)     => api.get('/training-sets', { params: status ? { status } : {} }),
  getReviewers: ()           => api.get('/training-sets/reviewers'),
  review:       (id, params) => api.put(`/training-sets/${id}/review`, null, { params }),
  delete:       id           => api.delete(`/training-sets/${id}`),

  // Relative path — no /api/v1/ prefix
  getModelUrl: (setId, slot) => `training-sets/${setId}/models/${slot}`,
}

// ── Landmarks & Auto-Score ─────────────────────────────────────────────────
export const landmarkApi = {
  submit:        (caseId, data) => api.post(`/cases/${caseId}/landmarks`, data),
  get:           (caseId)       => api.get(`/cases/${caseId}/landmarks`),
  clear:         (caseId)       => api.delete(`/cases/${caseId}/landmarks`),
  predict:       (caseId)       => api.post(`/cases/${caseId}/predict-landmarks`),
  autoCalculate: (caseId)       => api.post(`/cases/${caseId}/auto-calculate`),
}

// ── Admin ──────────────────────────────────────────────────────────────────
export const adminApi = {
  users:      ()             => api.get('/admin/users'),
  setActive:  (id, active)   => api.patch(`/admin/users/${id}/active`, null, { params: { active } }),
  changeRole: (id, role)     => api.patch(`/admin/users/${id}/role`,   null, { params: { role } }),
  auditLog:   (page = 0)     => api.get('/admin/audit', { params: { page, size: 50 } }),
  // REQUIREMENT 11: Date range filter
  auditLogRange: (from, to, page = 0) => api.get('/ml/admin/audit-logs', {
    params: { from, to, page, size: 50 }
  }),
}

// ── ML ─────────────────────────────────────────────────────────────────────
export const mlApi = {
  status:           ()           => api.get('/ml/status'),
  metrics:          ()           => api.get('/ml/metrics'),
  metricsByVersion: version      => api.get(`/ml/metrics/${version}`),
  myRuns:           ()           => api.get('/ml/my-runs'),
  train:            data         => api.post('/ml/train', data),
  rollback:         version      => api.post(`/ml/rollback/${version}`),
}

export default api