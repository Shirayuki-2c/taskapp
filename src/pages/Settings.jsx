import { useNavigate } from 'react-router-dom'

export default function Settings() {
  const navigate = useNavigate()

  return (
    <div className="p-4">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 mb-4">← 返回</button>
      <h1 className="text-xl font-bold">设置</h1>
      <p className="text-gray-400 mt-4">设置页待实现(第 5 批)</p>
    </div>
  )
}
