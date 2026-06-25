# 部署指南

## 整体架构

```
用户浏览器 ──→ Cloudflare Worker（API 后端 + KV 存储）
                  │
                  └── 管理后台（admin/index.html，可部署到 OSS 或 Cloudflare Pages）
```

---

## 第一步：部署 Cloudflare Worker（后端 API）

### 1.1 注册/登录 Cloudflare

访问 https://dash.cloudflare.com 注册账号（免费）。

### 1.2 创建 KV 命名空间

1. 左侧菜单 → **Workers & Pages** → **KV**
2. 点击 **创建命名空间**
3. 名称填写：`SUBMISSIONS_KV`
4. 点击 **添加**

### 1.3 创建 Worker

1. 左侧菜单 → **Workers & Pages** → **创建应用程序**
2. 选择 **创建 Worker**
3. 名称填写：`cinema-report-api`（或你喜欢的名字）
4. 点击 **部署**

### 1.4 绑定 KV 命名空间

1. 进入刚创建的 Worker 详情页
2. 点击 **设置** → **变量**
3. 在 **KV 命名空间绑定** 区域，点击 **添加绑定**
4. 变量名称：`SUBMISSIONS_KV`
5. KV 命名空间：选择刚才创建的 `SUBMISSIONS_KV`
6. 点击 **保存并部署**

### 1.5 设置环境变量

1. 在同一个 **设置** → **变量** 页面
2. 在 **环境变量** 区域，点击 **添加变量**
3. 变量名称：`ADMIN_PASSWORD`
4. 值：设置一个强密码（如 `MyAdmin123!`）
5. 点击 **加密**（确保密码安全）
6. 点击 **保存并部署**

### 1.6 上传 Worker 代码

1. 进入 Worker 详情页 → **代码**
2. 删除默认代码
3. 打开项目中的 [`worker/index.js`](worker/index.js)
4. 全选复制所有内容，粘贴到 Cloudflare 编辑器中
5. 点击 **保存并部署**

### 1.7 获取 Worker 域名

部署完成后，你会看到一个域名，格式如：
```
https://cinema-report-api.xxxx.workers.dev
```

**记下这个域名，下一步会用到。**

---

## 第二步：部署前端（用户填报页面）

### 2.1 修改 API 地址

打开 [`src/App.tsx`](src/App.tsx)，找到第 4 行：

```typescript
const API_BASE = ''; // 留空表示同域名
```

**如果你把前端和 Worker 部署在同一个域名下**（推荐方式，见下方说明），则保持 `API_BASE = ''` 即可。

**如果你分开部署**，改为你的 Worker 域名：

```typescript
const API_BASE = 'https://cinema-report-api.xxxx.workers.dev';
```

### 2.2 构建前端

在项目目录下执行：

```bash
npm run build
```

构建产物在 `dist/` 目录中。

### 2.3 部署前端（推荐方案）

#### 方案 A：部署到 Cloudflare Pages（推荐，免费）

1. 在 Cloudflare Dashboard → **Workers & Pages** → **创建应用程序**
2. 选择 **Pages** → **上传资产**
3. 项目名称：`cinema-report-frontend`
4. 将 `dist/` 目录下的所有文件拖入上传区域
5. 点击 **部署**
6. 部署完成后，你会得到一个域名如 `https://cinema-report-frontend.pages.dev`

#### 方案 B：部署到阿里云 OSS（静态网站托管）

1. 在阿里云 OSS 创建一个 Bucket
2. 开启 **静态网站托管**
3. 将 `dist/` 目录下所有文件上传到 Bucket
4. 访问 OSS 提供的域名即可

#### 方案 C：部署到 Vercel / Netlify

1. 将项目推送到 GitHub
2. 在 Vercel/Netlify 导入项目
3. 构建命令：`npm run build`
4. 输出目录：`dist`
5. 部署完成

---

## 第三步：部署管理后台

### 3.1 修改 API 地址

打开 [`admin/index.html`](admin/index.html)，找到第 2 行 JavaScript 中的：

```javascript
const API_BASE = ''; // 留空表示同域名
```

**如果管理后台和 Worker 同域名**（例如都部署在 Cloudflare Pages + Worker 路由），保持 `''` 即可。

**否则**，改为 Worker 域名：

```javascript
const API_BASE = 'https://cinema-report-api.xxxx.workers.dev';
```

### 3.2 部署管理后台

将 `admin/index.html` 部署到任意静态托管：

- **Cloudflare Pages**：新建一个 Pages 项目，上传 `admin/index.html`
- **阿里云 OSS**：上传到 Bucket
- **GitHub Pages**：上传到仓库的 `gh-pages` 分支

---

## 第四步：配置前端与 Worker 同域名（推荐）

为了让前端页面和 API 在同一个域名下（避免跨域问题），推荐使用 **Cloudflare Worker 路由**：

### 4.1 配置 Pages 自定义域名

1. 在 Cloudflare Pages 项目 → **自定义域** → 设置一个域名（如 `report.example.com`）
2. 在 Cloudflare DNS 中添加 CNAME 记录指向 Pages

### 4.2 配置 Worker 路由

1. 在 Worker 详情页 → **触发器** → **路由**
2. 点击 **添加路由**
3. 路由：`report.example.com/api/*`
4. 服务：选择你的 Worker
5. 环境：production

这样，前端页面在 `https://report.example.com`，API 在 `https://report.example.com/api/submit`，完全同域名，无需配置 CORS。

---

## 第五步：验证部署

### 5.1 测试 API

用浏览器或 curl 测试 Worker 是否正常工作：

```bash
# 测试提交接口（POST）
curl -X POST https://你的worker域名/api/submit \
  -H "Content-Type: application/json" \
  -d '{"reporterName":"测试","reporterPhone":"13800138000","selectedCity":"长沙市","cinemaName":"测试影院"}'

# 测试列表接口（GET，需密码）
curl "https://你的worker域名/api/list?password=你的管理密码"
```

### 5.2 测试管理后台

访问管理后台的 URL，输入你在 `ADMIN_PASSWORD` 中设置的密码，应该能看到数据统计和列表。

### 5.3 测试前端填报

访问前端页面，填写表单并提交，确认提交成功后能在管理后台看到新数据。

---

## 常见问题

### Q: 图片上传怎么办？

当前实现中，图片以 base64 格式随提交数据一起发送。如果图片较大，建议：

1. 在 Cloudflare Worker 中配置 OSS 环境变量（`OSS_ENDPOINT`、`OSS_ACCESS_KEY`、`OSS_SECRET_KEY`）
2. 前端会先调用 `/api/upload` 获取上传凭证
3. 直接上传到 OSS，提交时只传图片 URL

### Q: KV 存储有容量限制吗？

Cloudflare Free 计划：KV 最多 1000 个键，每个键 25MB。对于举报数据来说完全够用。

### Q: 如何修改管理密码？

在 Cloudflare Worker 的 **设置** → **变量** 中修改 `ADMIN_PASSWORD` 环境变量的值即可。
