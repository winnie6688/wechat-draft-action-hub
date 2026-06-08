# WeChat Article Action Server

> 供 ChatGPT Action 调用的中间层服务，用于管理公众号文章草稿并同步到飞书多维表格和微信公众号

## 功能特性

- **飞书草稿管理**：通过飞书多维表格存储和管理文章草稿
- **字段完整性检查**：自动检测必填字段是否完整
- **微信公众号同步**：当字段完整后，一键上传到微信公众号草稿箱
- **安全鉴权**：所有 API 接口支持 Bearer Token 验证
- **选项值约束**：自动校验 column 和 status 的合法选项值

## 技术栈

- **Node.js** + **Express** - Web 服务器
- **dotenv** - 环境变量管理
- **axios** - HTTP 客户端

## 项目结构

```
.
├── src/
│   ├── server.js                 # 主服务入口
│   ├── middleware/
│   │   └── auth.js              # API Key 认证中间件
│   ├── services/
│   │   ├── feishuService.js      # 飞书 API 服务
│   │   └── wechatService.js      # 微信 API 服务
│   └── routes/
│       └── articles.js           # 文章相关路由
├── .env.example                  # 环境变量示例
├── .gitignore                   # Git 忽略配置
├── package.json                 # 项目依赖配置
└── README.md                    # 项目说明
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填入真实值：

```bash
cp .env.example .env
```

编辑 `.env` 配置：

```
ACTION_API_KEY=your_action_api_key_here

# 飞书配置
FEISHU_APP_ID=your_feishu_app_id_here
FEISHU_APP_SECRET=your_feishu_app_secret_here
FEISHU_APP_TOKEN=your_feishu_app_token_here
FEISHU_TABLE_ID=your_feishu_table_id_here

# 微信公众号配置
WECHAT_APP_ID=your_wechat_app_id_here
WECHAT_APP_SECRET=your_wechat_app_secret_here

# 服务端口
PORT=3000
```

### 3. 飞书多维表格配置

确保飞书多维表格包含以下字段：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| article_id | 自动编号 | 记录 ID（飞书自动生成） |
| title | 文本 | 文章标题 |
| author | 文本 | 作者（默认 Lyra Wang） |
| digest | 文本 | 文章摘要 |
| column | 单选 | 栏目（AI 产品落地指南 / 边走边想 / 书籍推荐 / 热钱之外 / AI 简报） |
| content_markdown | 文本 | Markdown 内容 |
| content_html | 文本 | HTML 内容 |
| cover_image_url | URL | 封面图链接 |
| content_source_url | URL | 原文链接 |
| status | 单选 | 状态（content_gen / ready_to_upload / uploaded_to_wechat / failed） |
| wechat_draft_media_id | 文本 | 微信草稿 media_id |
| wechat_upload_result | 多行文本 | 上传结果（成功：已上传到微信草稿箱，media_id=xxx；失败：上传失败：具体错误信息） |
| missing_fields | 文本 | 缺失的必填字段 |
| warning_fields | 文本 | 建议补充的字段 |
| created_at | 创建时间 | 飞书自动维护 |
| updated_at | 修改时间 | 飞书自动维护 |

### 4. 启动服务

开发模式（带热重载）：

```bash
npm run dev
```

生产模式：

```bash
npm start
```

## API 接口

所有 `/api` 接口需在 Header 中添加：

```
Authorization: Bearer {ACTION_API_KEY}
```

### 1. 创建文章草稿

```
POST /api/articles
Content-Type: application/json

{
  "title": "文章标题",
  "column": "AI 产品落地指南",
  "digest": "文章摘要（可选）",
  "content_html": "<p>文章 HTML 内容（可选）</p>",
  "content_markdown": "文章 Markdown 内容（可选）",
  "cover_image_url": "https://example.com/cover.jpg"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "record_id": "recXXXXXX",
    "article_id": "1",
    "status": "content_gen"
  },
  "message": "已在飞书创建文章草稿"
}
```

### 2. 更新文章草稿

```
PATCH /api/articles/{record_id}
Content-Type: application/json

{
  "title": "更新后的标题",
  "content_html": "<p>更新后的 HTML 内容</p>",
  "digest": "更新后的摘要",
  "cover_image_url": "https://example.com/new-cover.jpg",
  "column": "边走边想"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "record_id": "recXXXXXX",
    "updated_fields": ["title", "content_html", "digest", "cover_image_url", "column"],
    "status": "content_gen"
  },
  "message": "已更新飞书文章草稿"
}
```

### 3. 检查字段完整性

```
GET /api/articles/{record_id}/check
```

响应：

```json
{
  "success": true,
  "data": {
    "ready": true,
    "missing_fields": [],
    "warning_fields": []
  },
  "message": "文章字段完整，可以上传到微信公众号"
}
```

### 4. 上传到微信公众号

```
POST /api/articles/{record_id}/upload-to-wechat
```

成功响应：

```json
{
  "success": true,
  "data": {
    "ready": true,
    "wechat_draft_media_id": "xxxxx"
  },
  "message": "已成功创建微信公众号草稿，请到公众号后台审核"
}
```

失败响应（字段不完整）：

```json
{
  "success": false,
  "error_code": "INCOMPLETE_FIELDS",
  "data": {
    "missing_fields": ["content_html", "cover_image_url"]
  },
  "message": "缺少必填字段: content_html, cover_image_url"
}
```

## 前置条件

### 飞书应用配置

1. 在 [飞书开放平台](https://open.feishu.cn) 创建企业自建应用
2. 申请权限：`bitable:app`, `base:record:retrieve`, `base:record:update`, `base:record:create`
3. 创建并发布应用
4. 将应用添加为多维表格的协作者（可编辑）

### 微信公众号配置

1. 在 [微信公众平台](https://mp.weixin.qq.com) 登录管理后台
2. 获取 AppID 和 AppSecret
3. 在 **开发 → 基本配置 → IP 白名单** 中添加服务器出口 IP

> ⚠️ **注意**：微信的 IP 白名单需要添加服务器的真实出口 IP。如果是家庭宽带，IP 可能会波动，建议使用云服务器部署。

## 开发和测试

### 本地测试

推荐使用 [Apifox](https://www.apifox.cn/) 或 Postman 进行接口测试。

也可以使用命令行工具测试：

```bash
# 健康检查
curl http://localhost:3000/health

# 创建文章
curl -X POST http://localhost:3000/api/articles \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"title":"测试文章","column":"AI 产品落地指南"}'
```

### 测试流程建议

1. **POST 创建** → 获取 record_id
2. **PATCH 更新** → 补充 HTML 内容和封面图
3. **GET check** → 验证字段完整
4. **POST upload-to-wechat** → 上传到微信草稿箱

## 安全说明

- **切勿将 `.env` 提交到 Git 仓库**（已在 `.gitignore` 中排除）
- 所有 API 接口通过 `ACTION_API_KEY` 做鉴权
- 飞书和微信的 AppSecret 仅在服务器端使用，不会暴露在接口响应中
- 建议将 `ACTION_API_KEY` 设置为足够长的随机字符串

## License

MIT
