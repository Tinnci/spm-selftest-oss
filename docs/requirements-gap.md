# 设备自测需求覆盖情况

> 对照《GMS 送测工具 6 大核心功能模块》评审当前独立版 spm_selftest。
> 验证基线：2026-11-21；前端 42 项、Rust 43 项测试通过，CI 门禁见
> `.github/workflows/ci.yml`。GUI/CLI 已验证
> 采集、导入、校验与导出。

## 结论

核心清单已基本落地，当前约 **85%**。6 大模块中，合规校验、命名/标签、
独立存储、Diff、编码导出、提测邮件与 CLI 均已实现。剩余主要是
platform-tools 自动安装、设备实时轮询和双包关联。MADA 维护提醒明确不在范围。

| #   | 模块             | 状态 | 说明                                                                                    |
| --- | ---------------- | ---- | --------------------------------------------------------------------------------------- |
| 1   | 环境与设备管理   | ◐    | adb 探测、自定义路径、状态提示、重启 adb、等待设备、5 秒轮询/聚焦刷新；缺下载/离线安装/PATH 修改 |
| 2   | 设备信息采集     | ✅   | 含 FirstAPI、build type/tags、DRM 动态库、SoC 厂商/型号；缺“保留原始顺序”开关            |
| 3   | 送测合规校验     | ✅   | ERROR/WARN/PASS、必填、补丁格式/有效期/递增、MR 例外、3PL 警告、IR/MR/SMR/LR            |
| 4   | 持久化与记录管理 | ✅   | 独立目录 + 自动导入 Maon、原子写入、语义命名、重命名、防冲突、标签、筛选、删除          |
| 5   | 版本差异比对     | ✅   | 自动/手动基线、关键字段并排、包/特性增删与未变化明细、DRM 差异                          |
| 6   | 导出与提测提效   | ✅   | txt4 三种编码、Markdown/JSON/CSV、提测邮件、字段快捷复制、SPM 核对与邮件门禁              |
| —   | SPM 核对         | ✅   | 逐项确认/不适用、指纹失效、全屏二次确认、差异项自动识别、Unisoc vendor boot debug        |
| —   | CLI              | ✅   | doctor/capture/list/diff/rename/review/export、--json、--no-pause、退出码               |

图例：✅ 已满足　◐ 部分满足　✗ 未实现。

## 关键实现

### 1. 环境与设备

- 依次查找 PATH、ANDROID_SDK_ROOT、ANDROID_HOME、Windows Android 常见目录。
- 单台就绪设备自动选中；多台时保留空选择，强制用户指定。
- unauthorized / offline / recovery / 无设备给出行内提示。
- 一键 kill-server / start-server；等待设备默认 30 秒，超时给结构化错误。
- 未做：联网下载 platform-tools、离线 Zip 安装、写 PATH、后台实时轮询。

### 2. 采集

字段：build/buildtype/tags/android/sdk/firstapi/baseband/gms/patch/vpatch/
fingerprint/vfingerprint/baseos/vendor/model/device/manufacturer/builddate。
FirstAPI 优先 ro.product.first_api_level，回退 board / vendor SDK。
DRM 读取属性、features、service list、pm list libraries、dumpsys media.drm。

### 3. 合规校验

校验器在 src-tauri/src/checks.rs，GUI/CLI 共用；每条记录存储 checks 数组，
列表展示最严重级别并可按结论筛选。

- 必填：build、gms、patch、fingerprint、firstapi。
- 补丁：格式 YYYY-MM-DD；日期 + 有效天数 < 基准日 => ERROR；
  距过期 ≤ 30 天 => WARN。
- 基线：补丁倒退 => ERROR；相同 => WARN；MR 且基线补丁仍有效 => PASS。
- 3PL：userdebug => WARN；test-keys => WARN。
- IR/MR/LR：BaseOS 必须为空，否则 ERROR。
- SMR：BaseOS 必须非空；优先与基线 BaseOS 比较，旧记录回退指纹；不一致 ERROR。
- LR：FirstAPI 必须等于 SDK，否则 ERROR。
- 补丁基准日默认采集当天，有效期默认 90 天，可在记录详情中修改并重算。

> 说明：Google Partner 文档受权限限制，公开检索未拿到确定条款；当前默认
> 90 天且可配置。如果内部规定不同，直接调整记录的有效天数即可。

### 4. 记录管理

- 默认目录：Windows %LOCALAPPDATA%\SPM-SelfTest；Linux
  $XDG_DATA_HOME/SPM-SelfTest 或 ~/.local/share/SPM-SelfTest。
- 首次启动从 Maon 的 Tinnci/self-tests 自动复制 index/records/blobs。
- 索引和记录使用临时文件 + rename；旧扁平记录迁移到 records/blobs。
- 命名：{机型}_{类型}_{版本号}_{YYYYMMDD}；自定义名清洗 Windows 非法字符，
  保留名加下划线，重名追加 -2/-3；ID 不变，重命名不破坏基线。
- 标签自由文本（逗号分隔），按机型/类型/校验结论搜索筛选。

### 5. Diff

- 默认同机型最近记录（model_code → model），也可手动指定。
- key_fields：build/gms/patch/baseos/fingerprint 并排。
- 包/特性：新增、移除、未变化计数与可展开明细；DRM fact 差异。

### 6. 导出与提测

- GUI：Markdown、JSON、CSV、txt4（UTF-8 BOM / UTF-8 / GBK）。
- 提测邮件：主题、版本/GMS/补丁/BaseOS/FP/FirstAPI、校验结论、
  基线、包/特性差异、字段变化，一键复制。
- 每个字段右侧有复制按钮，右键菜单仍保留。
- CLI 导出支持同样格式与编码。

## CLI

    spm-selftest-cli doctor [--json]
    spm-selftest-cli capture --serial ... --type ir|mr|smr|lr [--name ...] [--json]
    spm-selftest-cli list [--type] [--result] [--model] [--json]
    spm-selftest-cli diff <A> <B> [--json]
    spm-selftest-cli rename <id> <name> [--json]
    spm-selftest-cli export <id> --format md|json|csv|txt4 --out ... [--encoding ...]

退出码：0 成功；2 环境失败；3 采集失败；4 校验阻断（记录已保存）；
5 参数/记录/导出失败。

## 仍需确认/后续

1. platform-tools 自动下载与 PATH 修改（涉及网络和系统权限，需要明确授权）。
2. 顶部设备“实时感知”是否要做后台轮询（当前手动扫描 + 等待）。
3. user + userdebug 双包关联：两条独立记录、主/辅关联或一条记录挂两个包。
4. 包/特性“保留原始顺序”开关。
5. Google 补丁有效期官方条款的最终确认（当前 90 天可配）。

## 明确不做

- MADA 定期维护提醒。
