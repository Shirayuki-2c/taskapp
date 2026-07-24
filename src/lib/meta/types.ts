import type { FieldKind } from './constants'

export type FieldOption = { value: string; label: string }

export type FieldSpec = {
  key: string
  label: string
  kind: FieldKind
  required: boolean
  showOnCard: boolean
  options?: FieldOption[]
  sortOrder: number
  metaId: string
  typeId: string
  rawFieldType: string
}

export type TaskTypeSpec = {
  id: string
  name: string
  icon?: string
  color?: string
  sortOrder: number
  isArchived: boolean
}

export type NormalizedMeta = {
  types: TaskTypeSpec[]
  activeTypes: TaskTypeSpec[]
  fieldsByTypeId: Record<string, FieldSpec[]>
}
