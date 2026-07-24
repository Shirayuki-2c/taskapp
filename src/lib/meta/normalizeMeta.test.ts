import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeMeta } from './normalizeMeta'

function response(types: unknown[] = [], fieldDefs: unknown[] = []) {
  return { ok: true, data: { types, fieldDefs } }
}

describe('normalizeMeta', () => {
  afterEach(() => vi.restoreAllMocks())

  it('normalizes and sorts a type with text, select, and date fields', () => {
    const result = normalizeMeta(response(
      [{ id: 'type-1', name: '文案', sort_order: 2, is_archived: false }],
      [
        { id: 'date', type_id: 'type-1', name: '日期', field_type: 'date', sort_order: 3 },
        { id: 'select', type_id: 'type-1', name: '优先级', field_type: 'select', options: ['高', '', '低'], sort_order: 2 },
        {
          id: 'text', type_id: 'type-1', name: '需求方', field_type: 'text',
          required: true, show_on_card: true, sort_order: 1,
        },
      ],
    ))

    expect(result.activeTypes).toHaveLength(1)
    expect(result.fieldsByTypeId['type-1'].map((field) => field.kind)).toEqual(['text', 'select', 'date'])
    expect(result.fieldsByTypeId['type-1'][0].showOnCard).toBe(true)
    expect(result.fieldsByTypeId['type-1'][1].showOnCard).toBe(false)
    expect(result.fieldsByTypeId['type-1'][1].options).toEqual([
      { value: '高', label: '高' },
      { value: '低', label: '低' },
    ])
  })

  it('maps an unknown field_type to unsupported', () => {
    const result = normalizeMeta(response([], [
      { id: 'rating', type_id: 'type-1', name: '评分', field_type: 'rating' },
    ]))
    expect(result.fieldsByTypeId['type-1'][0]).toMatchObject({ kind: 'unsupported', rawFieldType: 'rating' })
  })

  it('normalizes object options and falls back missing labels to values', () => {
    const result = normalizeMeta(response([], [
      {
        id: 'select', type_id: 'type-1', name: '渠道', field_type: 'select',
        options: [{ value: 'email', label: '邮件' }, { value: 2 }, { value: '' }],
      },
    ]))
    expect(result.fieldsByTypeId['type-1'][0].options).toEqual([
      { value: 'email', label: '邮件' },
      { value: '2', label: '2' },
    ])
  })

  it('warns and leaves options undefined for an invalid options value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = normalizeMeta(response([], [
      { id: 'select', type_id: 'type-1', name: '渠道', field_type: 'select', options: 42 },
    ]))
    expect(result.fieldsByTypeId['type-1'][0].options).toBeUndefined()
    expect(warn).toHaveBeenCalledOnce()
  })

  it('uses strict booleans for required and falls invalid sort_order back to zero', () => {
    const result = normalizeMeta(response([], [
      { id: 'field', type_id: 'type-1', name: '字段', field_type: 'text', required: 'true', sort_order: '3' },
    ]))
    expect(result.fieldsByTypeId['type-1'][0]).toMatchObject({ required: false, sortOrder: 0 })
  })

  it('skips empty names and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = normalizeMeta(response(
      [{ id: 'empty-type', name: '' }],
      [{ id: 'empty-field', type_id: 'type-1', name: '', field_type: 'text' }],
    ))
    expect(result.types).toEqual([])
    expect(result.fieldsByTypeId).toEqual({})
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('skips a field with an empty type_id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = normalizeMeta(response([], [
      { id: 'field', type_id: '', name: '字段', field_type: 'text' },
    ]))
    expect(result.fieldsByTypeId).toEqual({})
    expect(warn).toHaveBeenCalledOnce()
  })

  it('keeps archived types in types but excludes them from activeTypes', () => {
    const result = normalizeMeta(response([
      { id: 'archived', name: '旧类型', is_archived: true },
      { id: 'active', name: '新类型', is_archived: false },
    ]))
    expect(result.types).toHaveLength(2)
    expect(result.activeTypes.map((type) => type.id)).toEqual(['active'])
  })

  it('throws for a missing data.types contract', () => {
    expect(() => normalizeMeta({ ok: true, data: { fieldDefs: [] } }))
      .toThrow('invalid meta contract: data.types must be an array')
  })
})
