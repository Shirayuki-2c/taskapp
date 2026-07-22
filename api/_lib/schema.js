// 所有表结构、默认模板都定义在这里。改 schema 只改这个文件，
// bootstrap 的体检逻辑会自动把变更同步到用户表（只增不删）。
// 字段类型码（飞书多维表格）：1 文本 / 2 数字 / 3 单选 / 5 日期 / 7 复选框 / 15 超链接

export const SCHEMA_VERSION = 1;
export const BASE_NAME = "TaskDash-Data";
export const MARKER_TABLE = "_TaskDashMeta"; // 标记表：扫描自愈时靠它识别，请勿重命名

export const TABLES = {
  meta: {
    key: "meta",
    name: MARKER_TABLE,
    fields: [
      { name: "key", type: 1 },
      { name: "value", type: 1 },
    ],
  },
  taskTypes: {
    key: "taskTypes",
    name: "TaskTypes",
    fields: [
      { name: "name", type: 1 },
      { name: "icon", type: 1 },
      { name: "color", type: 1 },
      { name: "sort_order", type: 2 },
      { name: "is_archived", type: 7 },
    ],
  },
  fieldDefs: {
    key: "fieldDefs",
    name: "FieldDefs",
    fields: [
      { name: "type_id", type: 1 }, // 存 TaskTypes 的 record_id
      { name: "name", type: 1 },
      {
        name: "field_type",
        type: 3,
        property: {
          options: ["text", "textarea", "url", "date", "select", "number", "person"]
            .map((n) => ({ name: n })),
        },
      },
      { name: "options", type: 1 }, // select 用，存 JSON 数组
      { name: "required", type: 7 },
      { name: "sort_order", type: 2 },
    ],
  },
  tasks: {
    key: "tasks",
    name: "Tasks",
    fields: [
      { name: "title", type: 1 },
      { name: "type_id", type: 1 }, // 存 TaskTypes 的 record_id
      {
        name: "status",
        type: 3,
        property: {
          options: ["待开始", "进行中", "已完成", "已取消"].map((n) => ({ name: n })),
        },
      },
      { name: "due_date", type: 5 },
      { name: "notes", type: 1 },
      { name: "custom_fields", type: 1 }, // JSON，键用字段名，保证裸读可懂
      { name: "completed_at", type: 5 },
    ],
  },
};

// 新用户的预设模板
export const DEFAULT_TYPES = [
  {
    name: "文案需求", icon: "📝", color: "blue", sort_order: 1,
    fields: [
      { name: "需求方", field_type: "text", sort_order: 1 },
      { name: "优先级", field_type: "select", options: ["高", "中", "低"], sort_order: 2 },
    ],
  },
  {
    name: "笔译", icon: "🌐", color: "green", sort_order: 2,
    fields: [
      { name: "字数", field_type: "number", sort_order: 1 },
      { name: "Starling 链接", field_type: "url", sort_order: 2 },
    ],
  },
  {
    name: "1-1 教学", icon: "🎓", color: "orange", sort_order: 3,
    fields: [
      { name: "学员姓名", field_type: "text", sort_order: 1 },
      { name: "课程链接", field_type: "url", sort_order: 2 },
    ],
  },
];