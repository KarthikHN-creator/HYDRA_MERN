const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('Could not reach the HYDRA backend')
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.success === false) {
    throw new ApiError(payload?.error?.message || payload?.message || `Request failed (${response.status})`, {
      status: response.status,
      code: payload?.error?.code,
      details: payload?.error?.details,
    })
  }
  return payload
}

const query = (params = {}) => {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null))
  return search.size ? `?${search}` : ''
}

export const api = {
  health: (options) => request('/api/health', options),
  robotStatus: (options) => request('/api/robot/status', options),
  servos: (params, options) => request(`/api/servos${query(params)}`, options),
  servo: (servoNumber, params, options) => request(`/api/servos/${servoNumber}${query(params)}`, options),
  updateServo: (servoNumber, body, params) => request(`/api/servos/${servoNumber}${query(params)}`, { method: 'PATCH', body }),
  settings: (params, options) => request(`/api/settings${query(params)}`, options),
  updateSettings: (body, params) => request(`/api/settings${query(params)}`, { method: 'PATCH', body }),
  commands: (params, options) => request(`/api/commands${query(params)}`, options),
  saveCommand: (body) => request('/api/commands', { method: 'POST', body }),
}
