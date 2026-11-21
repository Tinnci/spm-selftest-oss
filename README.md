# SPM 自测 / SPM Self-Test

Android 设备送测自测工具。GUI 沿用 Maon 的视觉语言、交互与记录格式；
采集、合规校验、命名、Diff、导出和记录管理另有独立 CLI。
Tauri 2 + React 19，Windows / Linux。

![Application icon](src-tauri/icons/128x128.png)

## 功能

- **设备管理**：探测 PATH / SDK / 常见目录中的 adb；支持自定义路径、
  状态识别（unauthorized / offline / recovery）、重启 adb、等待设备接入；
  多台设备在线时必须手动选择；adb 状态每 5 秒静默刷新，窗口重新聚焦时立即刷新。
- **采集**：版本号、构建类型/标签、Android、SDK、FirstAPI、Modem、GMS、
  系统/厂商补丁、系统/厂商指纹、BaseOS、机型/代号/厂商/构建时间；
  软件包、系统特性、DRM 属性/特性/服务/动态库/dumpsys。
- **SoC 识别**：优先 `ro.soc.manufacturer` / `ro.soc.model`，回退
  `ro.board.platform` / `ro.hardware`，归类 Unisoc / MediaTek / Qualcomm /
  Other / Unknown；详情、列表、邮件、Markdown、CSV 都会展示。
- **送测校验**：ERROR / WARN / PASS 三级；必填字段、补丁格式与有效期、
  补丁递增、MR 沿用例外、userdebug/test-keys 防误送，以及 IR/MR/SMR/LR
  的 BaseOS 与 FirstAPI 专项规则。补丁基准日与有效期（默认 90 天）
  可在每条记录上调整。
- **SPM 核对与邮件门禁**：显示并确认全部校验结果、差异项、必填交付物和人工声明。
  允许标为「不适用」的条目须填写理由；记录、基线或 diff 变化会自动让旧核对失效。
- **全屏二次确认**：保存核对和生成提测邮件都会用覆盖整个应用视口的 blocking
  确认层，必须勾选声明后才能继续。
- **Vendor boot debug**：Unisoc 的 IR/MR 记录自动要求路径/可选 SHA256，作为
  交付物进入核对、Markdown/CSV/JSON 与提测邮件。
- **记录**：独立本地库、原子写入、自动语义化命名、手动重命名、重名递增、
  Windows 非法字符清洗、可配置的状态与自定义标签、按类型/结论筛选、搜索、删除确认。
- **Diff**：自动同机型基线或手动指定；关键字段并排；包/特性新增、移除、
  未变化明细；DRM 差异。
- **导出/提测**：Markdown、JSON、CSV、四工作表 XLSX、4 件套 txt（UTF-8 BOM / UTF-8 / GBK）。
  在「设置 → Excel 导出」可配置文件名、工作表名称、GMS 字段和 DRM 列的显示及顺序。
  一键生成内部 GMS 提测邮件，支持字段级快捷复制。
- **CLI**：doctor / capture / list / diff / rename / review / export，支持 --json、
  严格退出码、核对门禁和 --no-pause。
- 中文/English、浅色/深色、响应式侧栏。

## 数据位置

默认独立存放，不再与 Maon 共用：

| 平台    | 默认目录                                                    |
| ------- | ----------------------------------------------------------- |
| Windows | %LOCALAPPDATA%\SPM-SelfTest                                 |
| Linux   | $XDG_DATA_HOME/SPM-SelfTest，或 ~/.local/share/SPM-SelfTest |

首次启动且新目录为空时，会自动从 Maon 的旧目录（Tinnci/self-tests）
复制 index.json、records/、blobs/，并补算旧记录的命名与校验。
此后两边互不影响。

SPM_SELFTEST_HOME 可以直接指向一个隔离的数据目录（测试/批处理用）。

存储结构：index.json + records/<id>.json + 内容寻址 blobs/。
索引与记录文件使用临时文件 + rename 写入；旧版扁平 <id>.json 会在首次
读取时迁移到新结构。

## 补丁有效期

每条记录有 patch_reference（补丁基准日）和 patch_valid_days
（默认 90 天）。采集时基准日默认为当天；详情页可修改，保存后重新校验。

- 补丁格式必须为 YYYY-MM-DD。
- 补丁日期 + 有效天数 < 基准日：ERROR。
- 距过期 ≤ 30 天：WARN。
- 相对基线倒退：ERROR。
- MR 且基线补丁在基准日仍有效：允许沿用；其他类型补丁相同：WARN。

> Google 的 GMS 合作方文档需要 Partner 权限，当前实现采用常见的
> **90 天可配置窗口**。如你们内部规定不同，直接改每条记录的“有效天数”，
> 不需要改代码。

## 环境要求

- Node.js 22.12+、npm（`.nvmrc` 固定为 22）。
- Rust 1.99（`rust-toolchain.toml` 固定，含 rustfmt/clippy）和 Tauri 系统依赖
  （Debian/Ubuntu：libwebkit2gtk-4.1-dev libgtk-3-dev 及常规构建工具）。
- Android platform-tools：adb 在 PATH、ANDROID_SDK_ROOT /
  ANDROID_HOME，或在应用里填写完整路径。
- 已授权、状态为 device 的 USB 设备。

## 开发与构建

    npm ci                 # 按 package-lock 安装
    npm run dev            # 浏览器预览（后端动作不可用）
    npm run tauri dev      # 桌面应用
    npm run build
    npm test               # 前端测试
    npm run test:rust      # Rust 测试
    npm run check          # 本地完整门禁，见下
    npm run desktop:build

Vite 使用 **1430** 端口。调试产物：

- GUI：src-tauri/target/debug/spm-selftest（Windows 为 .exe）
- CLI：src-tauri/target/debug/spm-selftest-cli

调试构建产出可执行文件。需要安装包时可用 `npm run desktop:package` 按当前平台生成 NSIS 或 AppImage。开发验证可追加
`-- --debug`。签名更新包用 `npm run desktop:package -- --signed`，并在环境中提供
发布签名密钥和密码。

`npm run check` 依次执行版本一致性、ESLint、Prettier、tsc + Vite、
Vitest、rustfmt、clippy（`-D warnings`）和 cargo test，与 CI 门禁一致。

## 持续集成

[CI](.github/workflows/ci.yml) 在推送 main、打开 PR 或手动触发时运行前端门禁，
并把同一份前端产物提供给 Ubuntu 和 Windows。两个平台各自在同一个 Rust job 中
复用 Cargo 构建目录，完成 Clippy 和桌面程序、CLI 的调试构建。Linux 还运行
Rust 测试与格式检查。Node 和 Rust 版本分别由 `.nvmrc` 和 `rust-toolchain.toml` 固定。

## 发布与桌面更新

GitHub Actions 在推送与应用版本一致的 `v*` 标签时构建 Windows x64 NSIS 安装包和
Linux x86_64 AppImage，签名后上传至草稿 Release。Windows 还提供包含 GUI 和 CLI 的
便携 ZIP 与 SHA-256。发布 workflow 会校验两个平台的更新清单，并写入公开下载地址。

安装发布包后，应用会在启动时检查更新，也可以在「设置 → 关于」手动检查。发现新版本后，
需要确认安装并重启。应用优先直连公开的 GitHub Release，检查或下载失败时从
[AKAMS](https://github.akams.cn/) 获取镜像节点并尝试可用线路。更新请求仅包含公开 Release
地址。应用用内置公钥验证安装包和签名所绑定的版本。普通开发构建继续使用默认配置。

发布签名私钥和密码通过 GitHub Actions Secrets `TAURI_SIGNING_PRIVATE_KEY` 与
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 提供。发布配置保存对应公钥。后续版本沿用同一密钥，
否则此前安装的版本无法验证签名。

## CLI

    BIN=./src-tauri/target/debug/spm-selftest-cli

    # 环境与设备
    $BIN doctor
    $BIN doctor --json

    # 采集（IR/MR/SMR/LR）
    $BIN capture --serial DEMO-SERIAL-001 --type ir \
      --name "DEMO-A1_IR_V14_20261119" --note "演示记录" --json

    # 记录
    $BIN list
    $BIN list --type smr --result error --model DEMO-A --json
    $BIN rename 20260101-000000-000 "DEMO-A1_IR_V14_20261119"

    # 对比
    $BIN diff <baseline-id> <target-id> --json

    # SPM 核对状态与清单
    $BIN review <id> --json
    $BIN review <id> --baseline <baseline-id>

    # 导出（未核对时默认拒绝；--force 才放行）
    $BIN export <id> --format md --out report.md
    $BIN export <id> --format csv --out ledger.csv
    $BIN export <id> --format xlsx --out report.xlsx
    $BIN export <id> --format txt4 --out ./txt --encoding gbk
    $BIN export <id> --format md --out report.md --force

退出码：

| 码  | 含义                                 |
| --- | ------------------------------------ |
| 0   | 成功                                 |
| 2   | 环境失败（adb 不存在等）             |
| 3   | 采集失败                             |
| 4   | 采集成功但校验存在 ERROR；或核对未完成导致导出被拦截 |
| 5   | 参数/记录/导出失败（含 CLI 用法错误） |

CLI 与 GUI 共用 src-tauri/src/lib.rs 的核心，避免两套逻辑漂移。

## 目录

    docs/review-workflow.md  核对、失效规则与 Vendor boot debug
    docs/adr/                架构与注释策略决策记录
    docs/comment-audit-2026-11-21.md 注释审计结果
    .agents/skills/delete-comment/SKILL.md 可重复的删除注释流程
    src/
      SelfTestPage.tsx       页面编排与采集/详情状态
      hooks/useAdbEnv.ts     ADB 轮询、设备选择、重启/等待
      hooks/useRecordBrowser.ts 记录搜索、筛选、分组、多选
      components/self-test/  DeviceBar / RecordSidebar / ChecksPanel / DiffPanel
      components/review-dialog.tsx  SPM 逐项核对
      components/elevated-confirm.tsx 全屏 blocking 二次确认
      selftest/review.ts     核对分组的展示辅助
      SettingsDialog.tsx     主题、语言、数据目录、版本
      App.tsx                Maon 风格 appbar + rail
      api/                   Tauri 传输与强类型命令
      selftest/report.ts     字段顺序、基线选择、Markdown
      selftest/checks.ts     校验文案、提测邮件
      selftest/errors.ts     结构化错误本地化
      components/            Base UI 组件与 Maon 共享 UI
      styles.css             全局入口
      styles/                base / selftest / review 分层样式
    src-tauri/
      src/self_test.rs       稳定 facade + Tauri 命令
      src/self_test/         adb / collector / storage / diff / exporter
      src/checks.rs          IR/MR/SMR/LR 校验引擎
      src/review.rs          SPM 核对计划、指纹与门禁规则
      src/soc.rs             SoC 厂商识别与回退规则
      src/lib.rs             GUI/CLI 共享核心
      src/main.rs            Tauri 外壳
      src/bin/spm-selftest-cli.rs  CLI
      build.rs               生成命令权限
      capabilities/main.json 最小权限
    scripts/check-versions.mjs 版本一致性检查
    scripts/comment-ratchet.mjs 注释棘轮检查
    eslint-rules/no-comments.mjs 禁止新增注释的 ESLint 规则
    .github/workflows/ci.yml   CI：前端、Rust、桌面构建
    docs/requirements-gap.md 需求覆盖与剩余项

## 需求覆盖

见 [docs/requirements-gap.md](docs/requirements-gap.md)。当前已覆盖采集、
合规校验、命名/标签、Diff、可选导出、提测邮件与 CLI；仍可继续补：
platform-tools 自动下载/PATH 修改、设备实时轮询、user+userdebug
双包关联。MADA 维护提醒明确不在范围。

## 注释策略

源码注释默认禁止，工具指令（ESLint / TypeScript / Prettier / Vitest / YAML /
shebang）除外。非显然的决定记录在 `docs/adr/`，不再写在代码旁边。

```bash
npm run lint:comments          # 检查是否新增注释
npm run lint:comments:update   # 审计后只降不升地更新基线
```

完整审计结果见 [docs/comment-audit-2026-11-21.md](docs/comment-audit-2026-11-21.md)，
重复流程见 [.agents/skills/delete-comment/SKILL.md](.agents/skills/delete-comment/SKILL.md)。

## 与 Maon 的关系

UI 与大部分行为来自 Maon 的 SelfTestPage；独立版保留 Maon 的 appbar、
rail、排版、令牌、右键菜单和对话框。独立版额外具备跨平台导出、删除确认、
结构化错误、独立数据目录与旧记录导入、合规校验和 CLI。

## License

Derived from Maon and distributed under the Apache License 2.0. See
[LICENSE](LICENSE) and [NOTICE](NOTICE).
