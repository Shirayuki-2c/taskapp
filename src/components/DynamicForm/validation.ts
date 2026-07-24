import type { FieldSpec } from '../../lib/meta/types'

export type DynamicFormValidation = {
  ok: boolean
  errors: Record<string, string>
}

export function validateDynamicForm(
  fields: FieldSpec[],
  value: Record<string, unknown>,
): DynamicFormValidation {
  const errors: Record<string, string> = {}
  for (const field of fields) {
    const fieldValue = value[field.key]
    const empty = fieldValue === undefined
      || fieldValue === null
      || (typeof fieldValue === 'string' && fieldValue.trim() === '')
    if (field.required && empty) errors[field.key] = `${field.label}必填`
  }
  return { ok: Object.keys(errors).length === 0, errors }
}
