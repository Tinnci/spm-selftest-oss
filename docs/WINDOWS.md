# Windows 运行说明

## 系统要求

- Windows 10 1809 及以上或 Windows 11，x64。
- Microsoft Edge WebView2 Runtime（Windows 11 与较新的 Windows 10 已预装）。
  未安装时从 https://developer.microsoft.com/microsoft-edge/webview2/ 安装 Evergreen Runtime。
- 采集设备需要 adb：安装 Android platform-tools 并加入 PATH，或在应用内填写 adb 路径。
  设备需开启 USB 调试并授权本机。

## 下载与启动

在 [GitHub Releases](https://github.com/Tinnci/spm-selftest-oss/releases/latest) 下载
Windows x64 安装包 `*-x64-setup.exe`。安装后可从开始菜单打开。Release 的 Windows
便携 ZIP 包含桌面程序和 CLI，解压后可直接运行。

首次启动会在
`%LOCALAPPDATA%\SPM-SelfTest` 建立记录目录，并把 Maon 旧目录中的自测记录导入一次。

## 数据位置

| 内容 | 路径 |
| --- | --- |
| 记录与索引 | `%LOCALAPPDATA%\SPM-SelfTest\index.json`、`records\`、`blobs\` |

设置对话框可以直接在资源管理器中打开该目录。备份时复制整个目录即可。

## 命令行

```bat
spm-selftest-cli.exe doctor
spm-selftest-cli.exe capture --serial <SN> --type mr --name "DEMO-A1_MR_DEMO-R5_20260101" --json
spm-selftest-cli.exe list --json
spm-selftest-cli.exe export <record-id> --format txt4 --out .\out --encoding gbk
```

退出码：0 成功；2 环境失败；3 采集失败；4 校验存在 ERROR（记录已保存）；5 参数/记录/导出失败。

## 卸载

通过 Windows「已安装的应用」卸载安装版。便携版可删除解压目录。
自测记录保存在独立的 `%LOCALAPPDATA%\SPM-SelfTest`，需要保留时请先备份。
