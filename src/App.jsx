import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { setUnauthorizedHandler } from './lib/api'
import { isInFeishu, login } from './lib/feishuAuth'
import Dashboard from './pages/Dashboard'
import Guide from './pages/Guide'
import Settings from './pages/Settings'
import TaskEditor from './pages/TaskEditor'

const DynamicFormPreview = import.meta.env.DEV
  ? lazy(() => import('./pages/DynamicFormPreview'))
  : null

export default function App() {
  const [status, setStatus] = useState('checking') // checking | notFeishu | ready | error
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    let active = true

    async function relogin() {
      if (active) {
        setErrMsg('')
        setStatus('checking')
      }

      try {
        await login()
        if (active) setStatus('ready')
      } catch (error) {
        if (active) {
          setErrMsg(error instanceof Error ? error.message : String(error))
          setStatus('error')
        }
        throw error
      }
    }

    setUnauthorizedHandler(relogin)

    if (!isInFeishu()) {
      setStatus('notFeishu')
    } else {
      relogin().catch(() => {})
    }

    return () => {
      active = false
      setUnauthorizedHandler(null)
    }
  }, [])

  let content
  if (status === 'checking') content = <p className="status-message">登录中…</p>
  if (status === 'notFeishu') {
    content = (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<Guide />} />
        </Routes>
      </BrowserRouter>
    )
  }
  if (status === 'error') {
    content = (
      <div className="login-error" role="alert">
        <p>登录失败：{errMsg}</p>
        <p>
          当前页面：<span className="login-error-url">{window.location.href}</span>
        </p>
      </div>
    )
  }
  if (status === 'ready') {
    content = (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks/new" element={<TaskEditor />} />
          <Route path="/tasks/:id/edit" element={<TaskEditor />} />
          <Route path="/settings" element={<Settings />} />
          {import.meta.env.DEV && DynamicFormPreview && (
            <Route
              path="/dev/dynamic-form-preview"
              element={<Suspense fallback={<p>预览页加载中…</p>}><DynamicFormPreview /></Suspense>}
            />
          )}
        </Routes>
      </BrowserRouter>
    )
  }

  return (
    <>
      <div className="build-version">构建版本：{import.meta.env.VITE_BUILD_VERSION}</div>
      {content}
    </>
  )
}
