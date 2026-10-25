# Readest Personal

适用于 SavingBigHead/readest 的自用构建，基于官方正式 Release，生成 Windows x64、Linux x64（AppImage / deb / Arch pacman 包）和 Android ARM64 安装包。

## 功能范围

- 保留主题、字体、布局等完整自定义；这些设置在当前上游源码中已可编辑。
- 解锁连接自己的 WebDAV、S3 等云存储，以及自备翻译和 TTS 接口。
- 解锁朗读音频预下载、Audiobookshelf 离线下载和 Nearby BookDrop 配对。
- 保留官方账号身份、真实购买记录和官方云空间额度。使用原账号登录即可尝试访问已有空间；修改版上的实际登录与同步仍需设备验证。
- Readest Voice、官方翻译服务、邮件收书和额外官方空间继续受官方服务器的资格与额度限制。连接自己的服务也需要有效的服务地址和凭据。
- 本补丁没有改变 WebDAV 书籍存储目录，也没有增加“直接复用原有 EPUB 路径”的功能。

普通构建保持上游授权行为；个人构建通过 NEXT_PUBLIC_PERSONAL_EDITION=true 开启本地功能。不会伪造 Pro 身份或将官方云标记为自托管。

## 自动更新流程

工作流：`.github/workflows/personal-release.yml`，名称 **Personal Readest releases**。

仅保留以下三个工作流：

- **Personal Readest releases**：检查官方正式版，验证并构建 Windows、Linux（含 Arch 包）和 Android 个人版。
- **PR checks**：保留代码检查与测试，移除不使用的 Nix 检查任务。
- **CodeQL Advanced**：保留代码安全扫描。

不使用的上游工作流已移至 `.github/disabled-workflows/`，GitHub 不再触发它们：

| 工作流 | 停用原因 |
| --- | --- |
| Nightly Readest | 个人版只跟随正式 Release，无需每日多平台构建和官方 R2 上传 |
| Release Readest | 已由个人版发布流程替代，且依赖官方发布配置 |
| Upload Release Assets to R2 | 不使用官方 Cloudflare R2 发布渠道 |
| Android E2E (CDP) | 不运行独立的每日 Android 模拟器测试 |
| Try Linux AppImage | 个人版流程已生成 Linux 安装包，无需独立的手动测试构建 |
| Build with Nix / Check Nix Dependency Hashes / Update Nix Dependencies | 使用安装包，无需维护 Nix 构建、缓存及依赖更新 |
| Scorecard supply-chain security | 不维护上游项目的治理评分；代码安全扫描由 CodeQL 保留 |
| Docker / Vercel | 不部署 Docker 镜像或 Vercel 网页，之前已停用 |

停用文件保留原内容，以后需要时可将其移回 `.github/workflows/` 并补齐配置。已有运行记录会继续显示在 Actions 历史中。

每 72 小时查询官方最新正式版（以 2026-10-25 08:00 北京时间为基准，每隔三天检查），也可在 Actions 手动运行。GitHub 每日唤醒轻量的时间判断任务，仅到期才查询上游；这样跨月也保持三天间隔。手动运行和代码推送不受定时间隔限制。GitHub 跨仓库 Release 事件不会直接触发 fork，因此新版本被发现会有检查间隔和构建耗时，定时任务也可能受 GitHub 调度延迟影响。

每一版固定到官方发布提交，严格应用补丁，然后运行个人回归测试、上游单元测试及类型与 lint 检查。通过后构建三端。所有平台成功才公开 Release；补丁冲突、测试或构建失败会停止发布，并保留上一版。

主分支保存构建控制代码，不自动合并官方开发分支。每个 Release 的 `_source.tar.gz` 包含实际构建的官方源码、子模块、补丁、构建脚本和来源提交。应用内更新使用此 fork 的更新地址和公钥。

更新只跟随正式版本，不跟随 Nightly。修改个人补丁后，将 `personal/revision.json` 中 revision 加一，即可为同一个官方版本生成新的个人版本，例如 `0.12.16-personal.2`。

## 首次签名配置

固定密钥保存在仓库外，生成命令：

    node personal/generate-keys.mjs ../.readest-personal-keys

已有密钥时请复用，不要重新生成。生成器会拒绝覆盖现有密钥。
`github-secrets.json` 含私钥和密码，只能保留在本地私密备份中，不可提交到 Git 或 Release。

在本 fork 的 **Settings → Secrets and variables → Actions → Repository secrets** 添加：

| Secret 名称 | 对应值 |
| --- | --- |
| PERSONAL_TAURI_KEY | github-secrets.json 中同名值 |
| PERSONAL_TAURI_PASSWORD | github-secrets.json 中同名值 |
| PERSONAL_ANDROID_KEYSTORE | github-secrets.json 中同名值 |
| PERSONAL_ANDROID_PASSWORD | github-secrets.json 中同名值 |

公钥保存在 `personal/updater.pub`，可以公开；不需要再配置 Repository variable。
若已安装 GitHub CLI 并登录，可一次上传这四项：

    node personal/upload-secrets.mjs ../.readest-personal-keys/github-secrets.json SavingBigHead/readest

随后在 Actions 启用 **Personal Readest releases** 并运行一次。不要为本流程启用上游的 Nightly、商店发布或部署工作流。公开仓库的 GitHub 托管标准构建通常不计费，仍以 GitHub 当时的额度和政策为准。

## 安装与账号

应用名为 **Readest Personal**，Android 包名为 `com.bilingify.readest.personal`，可与官方版分开安装，不能直接覆盖官方签名安装包。桌面构建使用独立标识 `com.bilingify.readest.personal`。首次迁移先在官方版完成同步或导出备份，再在个人版导入或下载书籍。

登录官方账号连接的是原来的官方服务。OAuth 和应用链接会受到应用签名、回调地址和系统默认处理程序影响，修改版尚需实际设备验证；可先使用邮箱密码登录。原版和个人版同时安装时，`readest://` 回调可能需要系统选择应用。

自动生成新安装包不等于设备会静默安装。Android 通常仍需确认安装；桌面更新要通过此 fork 的签名验证。Windows 安装包没有商业代码签名，可能显示发布者未知。

## Arch Linux 安装

Linux 构建会复用同一版 deb 中的原生程序和 CEF，额外生成 `readest-personal-bin-版本-1-x86_64.pkg.tar.zst`。Arch 版本号将 `-personal.` 转为 `.personal.`，例如应用 `0.12.16-personal.2` 对应包版本 `0.12.16.personal.2-1`。

从 Release 下载后，安装和升级都使用：

    sudo pacman -U ./readest-personal-bin-0.12.16.personal.2-1-x86_64.pkg.tar.zst

菜单中启动 **Readest Personal**，或运行 `readest-personal`。程序、菜单和图标使用独立路径，包名为 `readest-personal-bin`；卸载可使用 `sudo pacman -Rns readest-personal-bin`。

此包使用 pacman 管理更新，请下载新版包后再次运行 `pacman -U`，不要使用应用内安装更新功能。目前未提供 pacman 软件源或 AUR 包，因此 `pacman -Syu` 不会自动下载本 fork 的新版。文件选择器需要与你的桌面匹配的 XDG portal 后端；系统朗读可按需安装 `speech-dispatcher`。

CI 在隔离 Arch 容器中实际构建、安装并卸载该包，检查共享库、菜单入口及文件完整性，再将安装包加入 Release 和 SHA256SUMS。这些检查不等于真实桌面中的阅读、账号或同步测试。

## 维护与验证

本地最小回归测试，无需安装应用依赖：

    node --experimental-vm-modules --test personal/tests/*.test.mjs

完整验证在 CI 运行上游单元测试与 lint，再编译三端。主题、真实 WebDAV、原账号空间、语音与翻译端点需要在实际设备上验证，不应仅凭单元测试宣称可用。

上游重构授权函数或构建工具链后，自动化可能失败，需要更新补丁或工作流。GitHub 也可能暂停长期无仓库活动的定时任务，届时需在 Actions 重新启用。密钥丢失会影响已安装版本的后续升级，务必私密备份。

许可证：GNU AGPL-3.0，随安装包公开对应构建源码和许可证；本 fork 不是官方发行版。
