// 统一 API 请求封装

let onUnauthorizedHandler = null

export function setUnauthorizedHandler(handler) {
  onUnauthorizedHandler = handler
}

async function request(method, path, { query, body } = {}) {
  let url = path
  if (query && Object.keys(query).length > 0) {
    const qs = new URLSearchParams(
      Object.entries(query).filter(([, value]) => value !== undefined && value !== null),
    ).toString()
    if (qs) url += (path.includes('?') ? '&' : '?') + qs
  }

  let response
  try {
    response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    })
  } catch (error) {
    throw new ApiError('网络错误,请检查网络连接', 0, error)
  }

  if (response.status === 401) {
    if (onUnauthorizedHandler) {
      try {
        await onUnauthorizedHandler()
      } catch {
        // 重新登录失败由 App 统一展示，API 调用仍以 401 结束。
      }
    }
    throw new ApiError('登录已过期', 401)
  }

  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    const message = (
      typeof data?.error === 'string'
        ? data.error
        : data?.error?.message || data?.message
    ) || `请求失败(${response.status})`
    throw new ApiError(message, response.status, data)
  }

  return data
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

export const api = {
  get: (path, query) => request('GET', path, { query }),
  post: (path, body, query) => request('POST', path, { body, query }),
  patch: (path, body, query) => request('PATCH', path, { body, query }),
  delete: (path, query) => request('DELETE', path, { query }),
}

// 领域接口只描述后端能力，业务流程由页面负责。
export const tasksApi = {
  list: () => api.get('/api/tasks'),
  get: (id) => api.get('/api/tasks', { id }),
  create: (payload) => api.post('/api/tasks', payload),
  update: (id, patch) => api.patch('/api/tasks', patch, { id }),
  remove: (id) => api.delete('/api/tasks', { id }),
}

export const metaApi = {
  fetch: () => api.get('/api/meta'),
}
