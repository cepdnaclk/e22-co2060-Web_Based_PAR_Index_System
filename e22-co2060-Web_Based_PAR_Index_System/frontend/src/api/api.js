import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 60000,
})

// Attach JWT to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('par_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirect to login on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('par_token')
      localStorage.removeItem('par_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  register: data => api.post('/auth/register', data),
  login:    data => api.post('/auth/login', data),
  me:       ()   => api.get('/me'),
}

// ── Patients ──────────────────────────────────────────────────────────────
export const patientApi = {
  list:    ()           => api.get('/patients'),
  get:     id           => api.get(`/patients/${id}`),
  create:  data         => api.post('/patients', data),
  update:  (id, data)   => api.put(`/patients/${id}`, data),
  archive: id           => api.patch(`/patients/${id}/archive`),
  search:  query        => api.get('/patients/search', { params: { query } }),
}

// ── Cases ─────────────────────────────────────────────────────────────────
export const caseApi = {
  listByPatient: patientId => api.get(`/cases/patient/${patientId}`),
  get:           id        => api.get(`/cases/${id}`),
  create:        params    => api.post('/cases', null, { params }),

  uploadModels: (id, formData) =>
    api.post(`/cases/${id}/models`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }),

  // Serve clinical model file for viewing
  getModelFileUrl: (caseId, slot) => `/api/v1/cases/${caseId}/models/${slot}`,

  calculate: (id, data) => api.post(`/cases/${id}/calculate`, data),
  finalize:  id         => api.post(`/cases/${id}/finalize`),
}

// ── Training Sets ─────────────────────────────────────────────────────────
export const trainingApi = {
  create:       params        => api.post('/training-sets', null, { params }),

  uploadModels: (id, formData) =>
    api.post(`/training-sets/${id}/models`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }),

  listMy:       ()           => api.get('/training-sets/my'),
  listAssigned: ()           => api.get('/training-sets/assigned'),
  listAll:      (status)     => api.get('/training-sets', { params: status ? { status } : {} }),
  // Returns only ORTHODONTIST users
  getReviewers: ()           => api.get('/training-sets/reviewers'),
  review:       (id, params) => api.put(`/training-sets/${id}/review`, null, { params }),
  delete:       id           => api.delete(`/training-sets/${id}`),
  getModelUrl:  (setId, slot) => `/api/v1/training-sets/${setId}/models/${slot}`,
}

// ── Landmarks & Auto-Score ────────────────────────────────────────────────
export const landmarkApi = {
  submit:       (caseId, data) => api.post(`/cases/${caseId}/landmarks`, data),
  get:          (caseId)       => api.get(`/cases/${caseId}/landmarks`),
  clear:        (caseId)       => api.delete(`/cases/${caseId}/landmarks`),
  autoCalculate:(caseId)       => api.post(`/cases/${caseId}/auto-calculate`),
}

// ── Admin ─────────────────────────────────────────────────────────────────
export const adminApi = {
  users:      ()             => api.get('/admin/users'),
  setActive:  (id, active)   => api.patch(`/admin/users/${id}/active`, null, { params: { active } }),
  changeRole: (id, role)     => api.patch(`/admin/users/${id}/role`,   null, { params: { role } }),
  auditLog:   (page = 0)     => api.get('/admin/audit', { params: { page, size: 50 } }),
}

export default api
