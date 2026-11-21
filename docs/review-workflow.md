# SPM 核对与提测邮件门禁

## 流程

1. 采集并自动校验记录。
2. 打开「SPM 核对」。系统从当前记录实时生成核对清单：
   - ERROR / WARN / PASS 的完整校验结果；
   - 相对基线的字段、软件包、特性、DRM 差异；
   - Vendor boot debug 交付物（Unisoc IR/MR 必填，LR 提示备份）；
   - 一条人工确认声明。
3. SPM 逐项选择「确认」。允许标为「不适用」的条目须填写理由；保存时记录核对时间。
4. 点击「保存核对」，在覆盖整个应用视口的二次确认中勾选声明并确认。
5. 核对完成后，「提测邮件」才可用；生成邮件前还会再弹出一次全屏二次确认。
6. 邮件正文包含核对时间、已确认/不适用数量、差异摘要和 Vendor boot debug。

## 失效规则

- 记录、基线、checks、diff、送测类型变化时，旧核对自动失效，必须重新核对。
- 重命名、备注、标签变化不会导致核对失效。
- ERROR 永远阻断邮件，即使人工确认也不能放行。

## 差异项自动识别

每个核对项有稳定 ID 和内容摘要。系统每次打开核对时重新生成清单，并与已保存的
decision 对比：

- 已确认且内容未变：显示「已确认」；
- 内容变化或基线变化：整份清单标记「已失效」，需要重新确认；
- 新增差异：显示为「待核对」。

## Vendor boot debug

- 采集 `ro.soc.manufacturer` / `ro.soc.model`，回退 `ro.board.platform`、
  `ro.hardware`、`ro.boot.hardware`、`ro.product.board`。
- 归类 Unisoc / MediaTek / Qualcomm / Other / Unknown；`soc_vendor`
  存在记录字段里，写入详情、列表、邮件和导出。
- Unisoc 的 IR/MR 记录将 vendor boot debug 设为必填；Unisoc LR 提示备份，路径与确认均为可选。
- 保存路径、可选 SHA256 和备注；路径变化会重新打开该交付物的核对。
- 输出到记录 JSON、Markdown、CSV 和提测邮件。

## CLI

```
spm-selftest-cli review <id> [--baseline <id>] [--json]
spm-selftest-cli export <id> --format md --out report.md          # 未核对时退出 4
spm-selftest-cli export <id> --format md --out report.md --force  # 强制导出
```

GUI 与 CLI 共用 `src-tauri/src/review.rs` 的规则。
