import { useEffect, useState } from 'react'
import { isInFeishu, login } from './lib/feishuAuth'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [status, setStatus] = useState('checking') // checking | notFeishu | ready | error
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    if (!isInFeishu()) {
      setStatus('notFeishu')
      return
    }
    login()
      .then(() => setStatus('ready'))
      .catch((e) => {
        setErrMsg(e.message)
        setStatus('error')
      })
  }, [])

  let content
  if (status === 'checking') content = <p className="status-message">登录中…</p>
  if (status === 'notFeishu') content = <p className="status-message">请在飞书中打开</p>
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
  if (status === 'ready') content = <Dashboard />

  return (
    <>
      <div className="build-version">构建版本：{import.meta.env.VITE_BUILD_VERSION}</div>
      {content}
    </>
  )
}
