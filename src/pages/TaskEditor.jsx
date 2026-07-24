import { useEffect, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import TaskEditorForm from '../components/TaskEditor/TaskEditor'

export default function TaskEditor() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const routeTaskRef = useRef(location.state?.task)
  const routeStateConsumedRef = useRef(false)

  useEffect(() => {
    if (!id || !location.state?.task || routeStateConsumedRef.current) return
    routeStateConsumedRef.current = true
    navigate(location.pathname, { replace: true, state: null })
  }, [id, location.pathname, location.state, navigate])

  if (!id) {
    return (
      <TaskEditorForm
        mode="create"
        onSuccess={(task) => navigate('/', { state: { createdTask: task } })}
        onCancel={() => navigate('/')}
      />
    )
  }

  return (
    <TaskEditorForm
      mode="edit"
      taskId={id}
      initialTask={routeTaskRef.current}
      onSuccess={(task) => navigate('/', { state: { updatedTask: task } })}
      onCancel={() => navigate('/')}
    />
  )
}
