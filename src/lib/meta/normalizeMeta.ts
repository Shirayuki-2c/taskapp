import type { FieldKind } from './constants'
import type { FieldOption, FieldSpec, NormalizedMeta, TaskTypeSpec } from './types'

type RawRecord = Record<string, unknown>

const SUPPORTED_KINDS = new Set<FieldKind>([
  'text',
  'textarea',
  'url',
  'number',
  'date',
  'select',
  'person',
])

function sortOrder(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Number(value) : 0
}

function optionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function normalizeOptions(value: unknown, fieldName: string): FieldOption[] | undefined {
  if (!Array.isArray(value)) {
    console.warn(`normalizeMeta: invalid options for select field "${fieldName}"`)
    return undefined
  }

  if (value.every((item) => typeof item === 'string')) {
    return value
      .filter((item) => item !== '')
      .map((item) => ({ value: item, label: item }))
  }

  if (value.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item))) {
    return value.flatMap((item) => {
      const option = item as RawRecord
      if (option.value === undefined || option.value === null) return []
      const optionValue = String(option.value)
      if (optionValue === '') return []
      return [{
        value: optionValue,
        label: option.label === undefined || option.label === null
          ? optionValue
          : String(option.label),
      }]
    })
  }

  console.warn(`normalizeMeta: invalid options for select field "${fieldName}"`)
  return undefined
}

export function normalizeMeta(rawMeta: unknown): NormalizedMeta {
  if (!rawMeta || typeof rawMeta !== 'object') {
    throw new Error('invalid meta contract: response must be an object')
  }

  const data = (rawMeta as RawRecord).data
  if (!data || typeof data !== 'object') {
    throw new Error('invalid meta contract: data must be an object')
  }

  const rawTypes = (data as RawRecord).types
  const rawFieldDefs = (data as RawRecord).fieldDefs
  if (!Array.isArray(rawTypes)) {
    throw new Error('invalid meta contract: data.types must be an array')
  }
  if (!Array.isArray(rawFieldDefs)) {
    throw new Error('invalid meta contract: data.fieldDefs must be an array')
  }

  const types: TaskTypeSpec[] = rawTypes.flatMap((entry) => {
    const record = entry as RawRecord
    const name = String(record.name ?? '')
    if (!name) {
      console.warn('normalizeMeta: skipped task type with empty name')
      return []
    }

    return [{
      id: String(record.id ?? ''),
      name,
      icon: optionalString(record.icon),
      color: optionalString(record.color),
      sortOrder: sortOrder(record.sort_order),
      isArchived: record.is_archived === true,
    }]
  }).sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))

  const fieldsByTypeId: Record<string, FieldSpec[]> = {}
  for (const entry of rawFieldDefs) {
    const record = entry as RawRecord
    const name = String(record.name ?? '')
    if (!name) {
      console.warn('normalizeMeta: skipped field definition with empty name')
      continue
    }

    const typeId = String(record.type_id ?? '')
    if (!typeId) {
      console.warn(`normalizeMeta: skipped field "${name}" with empty type_id`)
      continue
    }

    const rawFieldType = String(record.field_type ?? '')
    const kind = SUPPORTED_KINDS.has(rawFieldType as FieldKind)
      ? rawFieldType as FieldKind
      : 'unsupported'
    const field: FieldSpec = {
      key: name,
      label: name,
      kind,
      required: record.required === true,
      showOnCard: record.show_on_card === true,
      sortOrder: sortOrder(record.sort_order),
      metaId: String(record.id ?? ''),
      typeId,
      rawFieldType,
      options: kind === 'select' ? normalizeOptions(record.options, name) : undefined,
    }
    ;(fieldsByTypeId[typeId] ||= []).push(field)
  }

  for (const fields of Object.values(fieldsByTypeId)) {
    fields.sort((left, right) => left.sortOrder - right.sortOrder || left.key.localeCompare(right.key))
  }

  return {
    types,
    activeTypes: types.filter((type) => !type.isArchived),
    fieldsByTypeId,
  }
}
