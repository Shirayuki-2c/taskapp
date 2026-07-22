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

  if (status === 'checking') return <p style={{ padding: 16 }}>登录中…</p>
  if (status === 'notFeishu') return <p style={{ padding: 16 }}>请在飞书中打开</p>
  if (status === 'error') return <p style={{ padding: 16, color: 'red' }}>登录失败：{errMsg}</p>
  return <Dashboard />
}