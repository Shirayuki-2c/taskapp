export const TASK_STATUS = {
  TODO: '待开始',
  DOING: '进行中',
  DONE: '已完成',
  CANCELLED: '已取消',
} as const
export const STATUS_VALUES = [
  TASK_STATUS.TODO,
  TASK_STATUS.DOING,
  TASK_STATUS.DONE,
  TASK_STATUS.CANCELLED,
] as const
export type StatusValue = typeof STATUS_VALUES[number]

export const FIELD_KINDS = [
  'text',
  'textarea',
  'url',
  'number',
  'date',
  'select',
  'person',
  'unsupported',
] as const
export type FieldKind = typeof FIELD_KINDS[number]
