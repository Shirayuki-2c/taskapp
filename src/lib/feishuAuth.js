// 飞书鉴权:检测环境、加载SDK、拿授权码、换session
const SDK_URL = 'https://lf-scm-cn.feishucdn.com/lark/op/h5-js-sdk-1.5.35.js'

export function isInFeishu() {
  return /Lark|Feishu/i.test(navigator.userAgent)
}

function loadSdk() {
  return new Promise((resolve, reject) => {
    if (window.h5sdk) return resolve()
    const s = document.createElement('script')
    s.src = SDK_URL
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('飞书SDK加载失败'))
    document.head.appendChild(s)
  })
}

export async function login() {
  await loadSdk()
  const code = await new Promise((resolve, reject) => {
    window.h5sdk.ready(() => {
      window.tt.requestAuthCode({
        appId: import.meta.env.VITE_FEISHU_APP_ID,
        success: (res) => resolve(res.code),
        fail: (err) => reject(new Error('获取授权码失败: ' + JSON.stringify(err))),
      })
    })
  })
  const resp = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  if (!resp.ok) throw new Error('登录接口失败: ' + (await resp.text()))
  return resp.json()
}
