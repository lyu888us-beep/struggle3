# 蓉渝康养行：Cloudflare 双端部署说明

> 交给技术人员阅读。当前交付物是**可部署源码包，不是已经上线的网址**。两个包均为测试用途，未完成生产安全、医疗数据合规、备份恢复或真实手机推送验证；**不要录入真实证件、病历或其他真实个人资料**。

## 1. 架构和两个包的关系

- 顾客包与管理包各有 `frontend/`（Cloudflare Pages 页面、Pages Functions、PWA 资源及源码）和 `backend/`（同一份共享后台源码）。
- 正确部署是：**两个 Pages 项目 + 一个 Worker 后台 + 一个 SQLite Durable Object**。两个 Pages 都使用名为 `BACKEND` 的 Service Binding 指向同一个 Worker。
- 两包的后台源码只是备份副本，**只部署一次后台**。如果把后台部署成两个不同 Worker、或者绑定到两个不同后台，数据就不会共享。
- 管理站根地址会跳转 `/admin`；顾客站根地址是顾客首页。两站的登录 Cookie 按域名分别保存，管理权限仍由后台检查。顾客站上的 `/admin` 路径并非网络隔离边界。
- 数据存储在同一个 SQLite Durable Object 中：身份档案为加密的独立表，健康文字和图片也加密；**不是独立的安全系统**。图片密文分块存储，以避开 Cloudflare 的单行大小限制。这个版本不是 D1/R2 方案。
- 这是新数据库，不包含旧网站或 Windows 版本的数据。没有提供旧数据库自动迁移功能；不要直接复制旧 SQLite 文件，正式迁移须由技术人员单独制定、备份并验证方案。

## 2. 重要限制及上线前必读

1. 默认带有公知的演示账号 `demo@meditrip.cn` / `demo1234`，仅用于虚构资料；不适用于真实业务。管理员使用自设密码。
2. 手机/邮箱真实验证码、短信、邮件、微信、Google、Apple 登录均未接入。可按第 6 节仅为虚构身份开启**屏幕显示的模拟验证码**；默认关闭。
3. 图片仅检查类型标识和尺寸，不做原版 Sharp 的完整解码；文件名及用户确认不能可靠识别伪装的证件照片。不得以此承诺杜绝证件照或恶意文件。
4. 图片单张不超过 4 MiB；Cloudflare SQLite 单行限制 2 MB，因此实际分块保存。一个数据库只使用一个对象，单对象单线程，容量和吞吐有限。按 Cloudflare 文档的 FAQ，免费计划单对象 1 GB、账户总量 5 GB；付费计划单对象 10 GB。额度和计费可能变化，请核对账户实际限制。
5. 自动推送需要另配 Web Push 密钥、设备授权和可用的推送服务；发送不保证准时或到达。iOS/iPadOS 需支持该功能的版本（16.4 起）并添加到主屏幕。未配置时创建/查看提醒仍可用，但推送接口返回未配置。
6. 离线档案需用户**手动同步**、设置本机密码；手动导出的 ZIP 不加密，也不是完整的数据库、账号和密钥备份。手机丢失、清除浏览器数据或忘记本机密码可能导致离线副本无法访问。
7. 本包未提供自动异地备份、可验证的灾备恢复、运维告警、企业级访问控制或正式安全审计。先由技术人员与专业顾问完成适用的合规、安全和恢复方案，再评估正式使用。
8. Cloudflare 可能根据计划、请求量、存储、Alarm/推送产生费用；不要假定永久免费。各地区网络可达性、证书、生效时间及限制均须实测。

## 3. 解压、GitHub 与目录

把两个 ZIP 分别**完整解压**，不要仅把 ZIP 文件上传到 GitHub。推荐两个仓库，各自仓库根目录应直接包含：

```text
README_请先看.md
backend/
  package.json
  package-lock.json
  wrangler.toml
  src/
frontend/
  package.json
  package-lock.json
  wrangler.toml
  functions/
  client/
  public/
  snapshots/
  scripts/
  vite.config.mjs
```

可以使用 GitHub Desktop 或 git 将文件夹及隐藏配置文件一起提交；不要提交 `node_modules`、`.wrangler`、`.dev.vars`、密钥、SQLite 或任何真实用户数据。如果继续使用一个已有仓库，可将解压后的顾客内容放入 `customer/`、管理内容放入 `admin/`；对应 Pages 项目的根目录分别设为 `customer/frontend` 和 `admin/frontend`。仓库里仅有 ZIP 会导致 Pages 无法找到构建文件。

需要 Node.js 22（包中 `.nvmrc` 建议 22.23.4）、npm、GitHub 与 Cloudflare 账户。任何密码或 API 令牌都不要发给聊天助手或提交到 GitHub。

## 4. 先部署唯一的共享后台 Worker

**在自己电脑的终端**进入顾客包中的 `backend` 文件夹（不要在这里输入任何已有个人数据库的路径），执行：

```sh
npm ci
npx wrangler login
npx wrangler whoami
npx wrangler deploy --dry-run
npx wrangler deploy
```

登录授权只在您自己的浏览器中完成，检查账户正确。默认 Worker 名称是 `rongyu-shared-backend`。部署前检查自己账户是否已有同名 Worker；如已有，不要覆盖：在 `backend/wrangler.toml` 的 `name` 改成唯一名称，同时把**两包** `frontend/wrangler.toml` 中的 `service` 改为完全相同的新名称。`binding` 必须仍是 `BACKEND`。后台默认不公开 `workers.dev` 路由，供两个 Pages 通过内部绑定调用。

### 必须设置的两个 Worker Secret

在同一个 `backend` 目录操作，终端提示时输入对应值：

```sh
npx wrangler secret put DATA_ENCRYPTION_KEY
npx wrangler secret put ADMIN_PASSWORD
```

- `DATA_ENCRYPTION_KEY`：必须是随机 32 字节，表达为 64 位十六进制字符。可在本机执行 `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` 生成。**安全备份原值，绝不能随意改动或丢失**；数据与原密钥必须配对。更换或丢失密钥会导致原数据无法读取。代码发现密钥不匹配会拒绝启动，不会自动修复。
- `ADMIN_PASSWORD`：首次初始化管理员的自选强密码，12–128 个字符。首次管理员账号是 `admin@rongyu.local`。**该 Secret 只用于首次创建管理员；之后修改 Secret 不会重置已创建的账号密码**。应在管理端“管理设置”中更改密码，并安全保管恢复方案。
- 先设置好这两个 Secret，再首次访问部署好的网站。若出现 503，请检查 Worker 的密钥、管理员密码和日志；不要创建新密钥覆盖原密钥。

## 5. 部署两个 Cloudflare Pages 项目

分别连接顾客、管理源码仓库（或同一仓库不同根目录）。**两个项目都使用 Git integration，不能只在网页中拖入 `public/`，因为还需要编译 `functions/`**。

每个项目的建议构建设置：

| 设置 | 值 |
|---|---|
| 项目根目录 Root directory | `frontend`（同仓库时为各自的 `customer/frontend` 或 `admin/frontend`） |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `public` |
| Node 版本 | 22.23.4；必要时设构建环境变量 `NODE_VERSION=22.23.4` |
| 生产分支 | 实际使用的主分支，例如 `main` |

顾客包 `frontend/wrangler.toml` 默认 `name = "rongyu-customer"`，管理包默认 `name = "rongyu-admin"`。Pages 项目名称应与各自文件的 `name` 一致；如果名称不可用或沿用已有项目，请先在源码中改成实际项目名并提交。两者的 `[[services]]` 都要指向第 4 节的**同一 Worker**，例如：

```toml
[[services]]
binding = "BACKEND"
service = "rongyu-shared-backend"
```

Pages 的 Wrangler 配置文件是绑定配置的来源；更改后提交并重新部署。部分旧 Pages 项目需要切换到 V2 构建系统。默认预览分支也可能连接相同后台；如需真正隔离预览环境，必须另外配置独立 Worker/数据库，不能拿正式数据测试。

构建成功后，Cloudflare 会为各项目提供各自的 `*.pages.dev` 地址。先测试这两个地址，再分别在 Pages 项目“自定义域名”中添加顾客和管理子域名，按 Cloudflare 提示配置 DNS、等待 HTTPS 证书显示有效。不要直接把一个静态 IP 当成后台服务地址。子域名、DNS 和证书设置由域名管理员操作。

为了使管理端的“打开用户端”链接指向正确站点，在后台目录运行：

```sh
npx wrangler secret put CUSTOMER_PUBLIC_URL
```

提示时输入顾客站的完整 HTTPS 根地址，例如 `https://顾客域名`（使用自己的真实域名，而不是示例）。改变它会创建新 Worker 版本；再从管理登录页检查链接。

### 验收检查

- 顾客首页非空；`/api/me` 返回 `{"user":null}` 而非 HTML/503；`/manifest.webmanifest` 是有效 JSON。
- 管理站 `/` 跳到 `/admin`，能使用自设管理员密码登录；创建一个虚构顾客账号，在管理站能看到该用户；再验证虚构预约、图片和双向消息。
- 测试顾客看不到管理 API、另一顾客的档案及图片；退出后旧会话失效。测试 Web Push 前完成第 6 节。
- 各自用真实电脑、Android、iPhone 的浏览器访问 HTTPS 地址，并分别尝试安装；此前本地浏览器模拟通过并不等于您的真实设备和网络已通过。
- 若首页正常但 API 返回“未连接共享后台”，检查两个 `BACKEND` 绑定、Worker 名称、构建根目录及重新部署。若后台 503，检查密钥、初始管理员 Secret 和 Worker 日志；不要随意换数据库密钥。

## 6. 可选：模拟验证码与推送

### 仅限虚构身份的模拟验证码

默认关闭。如确需测试，在后台目录分别执行：

```sh
npx wrangler secret put ENVIRONMENT
npx wrangler secret put ENABLE_TEST_OTP
```

提示时分别填 `demo` 和 `1`。测试手机号只接受 `000` 开头的 11 位虚构号码，测试邮箱只接受 `@example.invalid`；验证码直接显示在网页，不会发送短信或邮件，也不能给普通账号或管理员验证。停用时删除 `ENABLE_TEST_OTP` Secret 或将其改为 `0`。不要把这套测试机制用于正式身份认证。

### Web Push 密钥和提醒

在后台目录运行 `npx web-push generate-vapid-keys --json`，安全保存生成的 `publicKey` 和 `privateKey`，不要放进 GitHub。分别设置：

```sh
npx wrangler secret put WEB_PUSH_PUBLIC_KEY
npx wrangler secret put WEB_PUSH_PRIVATE_KEY
npx wrangler secret put WEB_PUSH_SUBJECT
```

第三项填写可联系运营方的 `mailto:真实联系邮箱`。密钥成对设置；改变 VAPID 密钥后设备需要重新订阅。之后各设备需登录、授权通知并在应用内开启，使用页面里的测试通知；仅创建提醒或授权浏览器本身并不保证送达。Alarm 定期检查上海时间的到期提醒和消息；设备、网络、系统省电、Cloudflare 额度或推送服务都可能造成延迟/失败，不能用于危急提醒。

## 7. 文档和参考

- [Cloudflare Pages Git 集成](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Pages Wrangler 配置与绑定](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
- [Pages Functions Service Bindings](https://developers.cloudflare.com/pages/functions/bindings/#service-bindings)
- [Durable Objects 额度](https://developers.cloudflare.com/durable-objects/platform/limits/)
- [Workers 和 Durable Objects 价格](https://developers.cloudflare.com/workers/platform/pricing/)
- [Apple Web Push](https://developer.apple.com/videos/play/wwdc2023/10120/)

供应商规则可能变化，以上信息以部署时 Cloudflare 和 Apple 的官方说明以及账户实际额度为准。
