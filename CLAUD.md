# TaskDash 项目约定

## 项目一句话

飞书小程序(H5)任务面板。前端 React SPA + Vercel Serverless BFF，
数据存飞书多维表格(Bitable)，表 ID 等元信息存 Upstash Redis。

## 硬规则（违反会坏）

1. **schema.js 是唯一事实源**。所有表结构、字段定义只在
   api/\_lib/schema.js 里改，其他代码从它 import，禁止硬编码字段名。
2. **前端永不直连飞书 OpenAPI**，一律走 /api/\*。tenant\_access\_token
   只存在于后端，绝不下发给前端。
3. **api/\_lib/ 下的文件不是路由**，只是共享代码，新增路由放 api/ 根层。
4. **表 ID 不写死**，运行时从 KV 读（key 见下），找不到就走
   /api/bootstrap 自愈流程。

## API 约定

- 返回格式统一：成功 `{ ok: true, data: ... }`，
  失败 `{ ok: false, error: { code, message } }`
- 登录态失效返回 HTTP 401，前端 src/lib/api.js 捕获后自动重新免登
- 所有接口先过 session 校验（api/\_lib/session.js），bootstrap/auth 除外

## KV 键名约定

- `base:{openId}` → { appToken, tableIds: {meta,taskTypes,fieldDefs,tasks}, fieldIds, schemaVersion }
  （bootstrap.js 写入，context.js 读取，两处必须保持一致）

## 环境变量（.env.local，Vercel 后台同步配置）

FEISHU\_APP\_ID / FEISHU\_APP\_SECRET / SESSION\_SECRET /
KV\_REST\_API\_URL / KV\_REST\_API\_TOKEN
新增环境变量必须同时更新本清单。

## 代码风格

- 全项目用 ESM（import/export），不用 require
- 后端纯 JS 不用 TS；异步一律 async/await，不用 .then 链
- 前端组件文件名大驼峰 .jsx，工具库小驼峰 .js
- 中文注释，注释写"为什么"而不是"是什么"

## 部署

- push 到 main 自动部署 Vercel
- 免登只能在飞书客户端内验证，本地 vercel dev 无法测登录流程

<br />

项目架构图

taskdash/
├── api/ # BFF：Vercel Serverless Functions（自动成为 /api/\* 路由）
│ ├── auth.js # POST /api/auth 免登换 token
│ ├── bootstrap.js # POST /api/bootstrap 建表/体检/自愈
│ ├── tasks.js # /api/tasks 任务增删改查（下一轮）
│ ├── meta.js # /api/meta 类型与字段配置（下一轮）
│ └── \_lib/ # 下划线开头，不会被当成路由
│ ├── schema.js # ★ 标准 schema，全项目唯一事实源
│ ├── feishu.js # 飞书 OpenAPI 封装（即 DataAdapter 的飞书实现）
│ ├── session.js # token 加密进 cookie / 解密
│ └── kv.js # Upstash 读写
├── src/ # 前端 React SPA
│ ├── main.jsx
│ ├── App.jsx # 环境检测 + 路由
│ ├── lib/
│ │ ├── feishuAuth.js # JSSDK 免登封装
│ │ └── api.js # 后端请求封装（自动处理 401 重登）
│ ├── pages/
│ │ ├── Dashboard.jsx
│ │ ├── TaskEditor.jsx
│ │ ├── Settings.jsx # 类型/字段配置 + 数据导出
│ │ └── Guide.jsx # 非飞书环境引导页
│ └── components/
│ ├── DynamicForm.jsx # 元数据驱动的动态表单
│ └── TaskCard.jsx
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
├── .env.local # 本地环境变量，必须在 .gitignore 里
└── .gitignore

<br />

