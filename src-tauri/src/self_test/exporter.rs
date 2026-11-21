use std::path::Path;

use rust_xlsxwriter::{Format, Workbook, XlsxError};

use super::*;

pub fn verdict_label(verdict: &str, zh: bool) -> &str {
    match (verdict, zh) {
        ("pass", true) => "通过",
        ("fail", true) => "不通过",
        ("pending", true) => "待确认",
        ("pass", false) => "Pass",
        ("fail", false) => "Fail",
        _ => {
            if zh {
                "待确认"
            } else {
                "Pending"
            }
        }
    }
}

pub fn render_markdown_report(rec: &SelfTestRecord, zh: bool) -> String {
    let model = rec.fields.get("model").map(String::as_str).unwrap_or("");
    let build = rec.fields.get("build").map(String::as_str).unwrap_or("");
    let (title, collected, serial, link, verdict, note, gms, field, value, drm, packages) = if zh {
        (
            "# 设备自测报告",
            "采集时间",
            "设备序列号",
            "关联机型 / OTA",
            "结论状态",
            "备注",
            "## GMS 与基线信息",
            "字段",
            "值",
            "## DRM 信息",
            "## 软件包与系统特性",
        )
    } else {
        (
            "# Device self-test report",
            "Collected",
            "Serial",
            "Model / OTA",
            "Verdict",
            "Note",
            "## GMS & build",
            "Field",
            "Value",
            "## DRM information",
            "## Packages & system features",
        )
    };

    let mut lines = vec![
        format!("{title} · {model} · {build}"),
        String::new(),
        format!("- **{collected}**: {}", rec.collected_at),
        format!("- **{serial}**: `{}`", rec.serial),
        format!(
            "- **{link}**: {} / {}",
            if rec.model_code.is_empty() {
                "-"
            } else {
                &rec.model_code
            },
            if rec.ota_version.is_empty() {
                "-"
            } else {
                &rec.ota_version
            }
        ),
        format!("- **{verdict}**: {}", verdict_label(&rec.verdict, zh)),
    ];
    if !rec.note.is_empty() {
        lines.push(format!("- **{note}**: {}", rec.note));
    }
    if !rec.review.updated_at.is_empty() {
        let confirmed = rec
            .review
            .decisions
            .values()
            .filter(|decision| decision.state == "confirmed")
            .count();
        let waived = rec
            .review
            .decisions
            .values()
            .filter(|decision| decision.state == "waived")
            .count();
        lines.push(format!(
            "- **{}**: {} · {} · {} confirmed / {} waived",
            if zh { "SPM 核对" } else { "SPM review" },
            rec.review.reviewer,
            rec.review.updated_at,
            confirmed,
            waived
        ));
    }
    let vendor_boot = &rec.artifacts.vendor_boot_debug;
    if !vendor_boot.path.is_empty() {
        lines.push(format!(
            "- **Vendor boot debug**: `{}`{}",
            vendor_boot.path.replace('`', "\\`"),
            if vendor_boot.sha256.is_empty() {
                String::new()
            } else {
                format!(" · SHA256 `{}`", vendor_boot.sha256)
            }
        ));
    }
    lines.extend([
        String::new(),
        gms.to_owned(),
        String::new(),
        format!("| {field} | {value} |"),
        "| --- | --- |".to_owned(),
    ]);
    for (k, v) in &rec.fields {
        lines.push(format!(
            "| `{k}` | `{}` |",
            v.replace('|', "\\|").replace('`', "\\`")
        ));
    }
    if !rec.drm_facts.is_empty() || !rec.drm_sections.is_empty() {
        lines.extend([String::new(), drm.to_owned(), String::new()]);
        for fact in &rec.drm_facts {
            lines.push(format!("- `{fact}`"));
        }
        for sec in &rec.drm_sections {
            lines.push(format!("\n### [{}]\n```text", sec.name));
            lines.extend(sec.lines.iter().cloned());
            lines.push("```".to_owned());
        }
    }
    lines.extend([
        String::new(),
        format!(
            "{packages}\n\n- {}: **{}**\n- {}: **{}**",
            if zh { "软件包总数" } else { "Packages" },
            rec.packages.len(),
            if zh { "系统特性总数" } else { "Features" },
            rec.features.len()
        ),
    ]);
    lines.join("\n")
}

pub fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') || s.contains('\r') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_owned()
    }
}

pub fn render_csv_ledger(summaries: &[SelfTestSummary]) -> String {
    let mut lines = vec![
        "id,collected_at,serial,model_code,ota_version,verdict,model,build,android,gms,patch,soc_vendor,soc_model,packages,features,note,review_status,reviewer,reviewed_at,vendor_boot_debug".to_owned(),
    ];
    for s in summaries {
        lines.push(
            [
                csv_escape(&s.id),
                csv_escape(&s.collected_at),
                csv_escape(&s.serial),
                csv_escape(&s.model_code),
                csv_escape(&s.ota_version),
                csv_escape(&s.verdict),
                csv_escape(&s.model),
                csv_escape(&s.build),
                csv_escape(&s.android),
                csv_escape(&s.gms),
                csv_escape(&s.patch),
                csv_escape(&s.soc_vendor),
                csv_escape(&s.soc_model),
                s.package_count.to_string(),
                s.feature_count.to_string(),
                csv_escape(&s.note),
                csv_escape(&s.review_status),
                csv_escape(&s.reviewer),
                csv_escape(&s.reviewed_at),
                csv_escape(&s.vendor_boot_debug),
            ]
            .join(","),
        );
    }
    lines.join("\r\n")
}

fn add_xlsx_sheet<'a>(
    workbook: &mut Workbook,
    name: &str,
    columns: &[(&str, u16)],
    rows: impl IntoIterator<Item = impl IntoIterator<Item = &'a str>>,
) -> Result<(), XlsxError> {
    let sheet = workbook.add_worksheet().set_name(name)?;
    sheet.set_freeze_panes(1, 0)?;
    let heading = Format::new().set_bold();
    for (col, &(label, width)) in columns.iter().enumerate() {
        sheet.set_column_width(col as u16, width)?;
        sheet.write_string_with_format(0, col as u16, label, &heading)?;
    }
    let mut last_row = 0;
    for (row, values) in (1..).zip(rows) {
        for (col, value) in values.into_iter().enumerate() {
            sheet.write_string(row, col as u16, value)?;
        }
        last_row = row;
    }
    if last_row > 0 {
        sheet.autofilter(0, 0, last_row, columns.len() as u16 - 1)?;
    }
    Ok(())
}

#[derive(Default, serde::Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct XlsxOptions {
    pub filename: String,
    pub sheet_names: [String; 4],
    pub fields: Option<Vec<String>>,
    pub drm_columns: Option<Vec<DrmColumn>>,
}

#[derive(Clone, Copy, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DrmColumn {
    Section,
    Content,
}

pub fn xlsx_file_name(base_name: &str, rec: &SelfTestRecord, template: &str) -> String {
    let template = template.trim();
    let name = if template.is_empty() {
        base_name.to_owned()
    } else {
        let model = rec.fields.get("model").map_or("device", String::as_str);
        template
            .split_inclusive('}')
            .map(|part| {
                if let Some(prefix) = part.strip_suffix("{model}") {
                    format!("{prefix}{model}")
                } else if let Some(prefix) = part.strip_suffix("{id}") {
                    format!("{prefix}{}", rec.id)
                } else {
                    part.to_owned()
                }
            })
            .collect::<String>()
    };
    let stem = name
        .rsplit_once('.')
        .filter(|(_, extension)| extension.eq_ignore_ascii_case("xlsx"))
        .map_or(name.as_str(), |(stem, _)| stem);
    format!("{}.xlsx", sanitize_name(stem))
}

pub fn write_xlsx_report(
    path: &Path,
    rec: &SelfTestRecord,
    zh: bool,
    options: &XlsxOptions,
) -> Result<(), SelfTestError> {
    let bytes = render_xlsx_report(rec, zh, options)
        .map_err(|error| SelfTestError::with_message("export_failed", error.to_string()))?;
    std::fs::write(path, bytes)
        .map_err(|error| SelfTestError::with_message("export_failed", error.to_string()))
}

fn render_xlsx_report(
    rec: &SelfTestRecord,
    zh: bool,
    options: &XlsxOptions,
) -> Result<Vec<u8>, XlsxError> {
    let label = |chinese, english| if zh { chinese } else { english };
    let sheet_name = |index: usize, chinese, english| {
        let custom = options.sheet_names[index].trim();
        if custom.is_empty() {
            label(chinese, english)
        } else {
            custom
        }
    };
    let mut workbook = Workbook::new();
    let tags = rec.tags.join(", ");
    let patch_valid_days = rec.patch_valid_days.to_string();
    let metadata = [
        ("@id", label("记录 ID", "Record ID"), rec.id.as_str()),
        ("@name", label("记录名称", "Record name"), &rec.name),
        (
            "@collected_at",
            label("采集时间", "Collected"),
            &rec.collected_at,
        ),
        ("@serial", label("设备序列号", "Serial"), &rec.serial),
        ("@test_type", label("送测类型", "Test type"), &rec.test_type),
        (
            "@model_code",
            label("关联机型", "Model code"),
            &rec.model_code,
        ),
        (
            "@ota_version",
            label("OTA 版本", "OTA version"),
            &rec.ota_version,
        ),
        (
            "@baseline_id",
            label("基线记录 ID", "Baseline record ID"),
            &rec.baseline_id,
        ),
        (
            "@patch_reference",
            label("补丁基准日", "Patch reference date"),
            &rec.patch_reference,
        ),
        (
            "@patch_valid_days",
            label("补丁有效天数", "Patch validity (days)"),
            &patch_valid_days,
        ),
        (
            "@verdict",
            label("结论状态", "Verdict"),
            verdict_label(&rec.verdict, zh),
        ),
        ("@tags", label("标签", "Tags"), &tags),
        ("@note", label("备注", "Note"), &rec.note),
    ];
    let rows: Vec<_> = match &options.fields {
        Some(fields) => fields
            .iter()
            .map(|key| {
                metadata
                    .iter()
                    .find(|(id, _, _)| *id == key)
                    .map(|&(_, name, value)| [name, value])
                    .unwrap_or_else(|| [key, rec.fields.get(key).map_or("", String::as_str)])
            })
            .collect(),
        None => metadata
            .iter()
            .map(|&(_, name, value)| [name, value])
            .chain(
                rec.fields
                    .iter()
                    .map(|(key, value)| [key.as_str(), value.as_str()]),
            )
            .collect(),
    };
    add_xlsx_sheet(
        &mut workbook,
        sheet_name(0, "GMS 与基线", "GMS & Baseline"),
        &[(label("字段", "Field"), 30), (label("值", "Value"), 85)],
        rows,
    )?;

    let facts = rec
        .drm_facts
        .iter()
        .map(|fact| [label("关键项", "Key facts"), fact.as_str()]);
    let sections = rec.drm_sections.iter().flat_map(|section| {
        section
            .lines
            .iter()
            .map(|line| [section.name.as_str(), line.as_str()])
    });
    let drm_columns = options
        .drm_columns
        .as_deref()
        .filter(|columns| !columns.is_empty())
        .unwrap_or(&[DrmColumn::Section, DrmColumn::Content]);
    let columns: Vec<_> = drm_columns
        .iter()
        .map(|column| match column {
            DrmColumn::Section => (label("分组", "Section"), 30),
            DrmColumn::Content => (label("内容", "Content"), 100),
        })
        .collect();
    add_xlsx_sheet(
        &mut workbook,
        sheet_name(1, "DRM 信息", "DRM Information"),
        &columns,
        facts.chain(sections).map(|[section, content]| {
            drm_columns.iter().map(move |column| match column {
                DrmColumn::Section => section,
                DrmColumn::Content => content,
            })
        }),
    )?;
    add_xlsx_sheet(
        &mut workbook,
        sheet_name(2, "软件包", "Packages"),
        &[(label("包名", "Package name"), 70)],
        rec.packages.iter().map(|package| [package.as_str()]),
    )?;
    add_xlsx_sheet(
        &mut workbook,
        sheet_name(3, "系统特性", "System Features"),
        &[(label("特性", "Feature"), 70)],
        rec.features.iter().map(|feature| [feature.as_str()]),
    )?;
    workbook.save_to_buffer()
}

pub fn write_utf8_bom(path: &Path, content: &str) -> Result<(), SelfTestError> {
    let mut bytes = vec![0xEF, 0xBB, 0xBF];
    bytes.extend_from_slice(content.as_bytes());
    std::fs::write(path, bytes).map_err(|_| SelfTestError::new("export_failed"))
}

pub fn encode_text(content: &str, encoding: &str) -> Vec<u8> {
    match encoding {
        "utf8" | "utf-8" => content.as_bytes().to_vec(),
        "gbk" | "gb18030" => encoding_rs::GBK.encode(content).0.into_owned(),
        _ => {
            let mut bytes = vec![0xEF, 0xBB, 0xBF];
            bytes.extend_from_slice(content.as_bytes());
            bytes
        }
    }
}

pub fn write_encoded(path: &Path, content: &str, encoding: &str) -> Result<(), SelfTestError> {
    std::fs::write(path, encode_text(content, encoding))
        .map_err(|_| SelfTestError::new("export_failed"))
}

pub fn write_txt4_bundle(
    out_dir: &Path,
    rec: &SelfTestRecord,
    encoding: &str,
) -> Result<(), SelfTestError> {
    std::fs::create_dir_all(out_dir).map_err(|_| SelfTestError::new("export_failed"))?;
    let mut gms = vec![
        "SPM Self-Test - gms.txt".to_owned(),
        format!("Generated: {}", rec.collected_at),
        format!("Device:    {}", rec.serial),
        format!("adb:       {}", rec.adb_version),
        String::new(),
    ];
    for (k, v) in &rec.fields {
        gms.push(format!("{k:<14}: {v}"));
    }
    write_encoded(&out_dir.join("gms.txt"), &gms.join("\r\n"), encoding)?;

    let mut drm = vec![
        "SPM Self-Test - drm.txt".to_owned(),
        format!("Generated: {}", rec.collected_at),
        format!("Device:    {}", rec.serial),
        String::new(),
    ];
    if !rec.drm_facts.is_empty() {
        drm.push("[key facts]".to_owned());
        drm.extend(rec.drm_facts.iter().cloned());
        drm.push(String::new());
    }
    for sec in &rec.drm_sections {
        drm.push(format!("[{}]", sec.name));
        drm.extend(sec.lines.iter().cloned());
        drm.push(String::new());
    }
    write_encoded(&out_dir.join("drm.txt"), &drm.join("\r\n"), encoding)?;
    write_encoded(
        &out_dir.join("package.txt"),
        &rec.packages.join("\r\n"),
        encoding,
    )?;
    write_encoded(
        &out_dir.join("features.txt"),
        &rec.features.join("\r\n"),
        encoding,
    )?;
    Ok(())
}
