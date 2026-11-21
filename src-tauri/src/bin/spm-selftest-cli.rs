use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Parser, Subcommand, ValueEnum};
use spm_selftest::self_test::{
    SelfTestError, SelfTestRecord, XlsxOptions, compute_diff, encode_text, render_csv_ledger,
    render_markdown_report, review_plan_for, self_test_env, self_test_get, self_test_list,
    self_test_rename, self_test_run, summary_of, write_txt4_bundle, write_xlsx_report,
    xlsx_file_name,
};

const EXIT_OK: u8 = 0;
const EXIT_ENV: u8 = 2;
const EXIT_CAPTURE: u8 = 3;
const EXIT_BLOCKED: u8 = 4;
const EXIT_USAGE: u8 = 5;

#[derive(Parser)]
#[command(
    name = "spm-selftest-cli",
    version,
    about = "SPM Android device self-test: capture, list, diff, rename and export"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Doctor {
        #[arg(long)]
        adb: Option<String>,
        #[arg(long)]
        json: bool,
    },
    Capture {
        #[arg(long)]
        serial: String,
        #[arg(long)]
        adb: Option<String>,
        #[arg(long)]
        name: Option<String>,
        #[arg(long)]
        note: Option<String>,
        #[arg(long, value_enum, default_value = "ir")]
        r#type: TypeArg,
        #[arg(long)]
        model_code: Option<String>,
        #[arg(long)]
        ota_version: Option<String>,
        #[arg(long)]
        patch_reference: Option<String>,
        #[arg(long)]
        patch_valid_days: Option<u32>,
        #[arg(long)]
        json: bool,
        #[arg(long)]
        no_pause: bool,
    },
    List {
        #[arg(long)]
        json: bool,
        #[arg(long)]
        r#type: Option<String>,
        #[arg(long)]
        result: Option<String>,
        #[arg(long)]
        model: Option<String>,
    },
    Diff {
        left: String,
        right: String,
        #[arg(long)]
        json: bool,
    },
    Rename {
        id: String,
        name: String,
        #[arg(long)]
        json: bool,
    },
    Review {
        id: String,
        #[arg(long)]
        baseline: Option<String>,
        #[arg(long)]
        json: bool,
    },
    Export {
        id: String,
        #[arg(long, value_enum, default_value = "md")]
        format: FormatArg,
        #[arg(long)]
        out: Option<PathBuf>,
        #[arg(long, value_enum, default_value = "bom")]
        encoding: EncodingArg,
        #[arg(long)]
        locale: Option<String>,
        #[arg(long)]
        force: bool,
        #[arg(long)]
        json: bool,
    },
}

#[derive(Clone, Copy, ValueEnum)]
enum TypeArg {
    Ir,
    Mr,
    Smr,
    Lr,
}

impl TypeArg {
    fn as_str(self) -> &'static str {
        match self {
            Self::Ir => "IR",
            Self::Mr => "MR",
            Self::Smr => "SMR",
            Self::Lr => "LR",
        }
    }
}

#[derive(Clone, Copy, ValueEnum)]
enum FormatArg {
    Md,
    Json,
    Csv,
    Xlsx,
    Txt4,
}

#[derive(Clone, Copy, ValueEnum)]
enum EncodingArg {
    Bom,
    Utf8,
    Gbk,
}

impl EncodingArg {
    fn as_str(self) -> &'static str {
        match self {
            Self::Bom => "bom",
            Self::Utf8 => "utf8",
            Self::Gbk => "gbk",
        }
    }
}

fn fail(error: SelfTestError, code: u8) -> ExitCode {
    eprintln!(
        "{}",
        serde_json::to_string_pretty(&error).unwrap_or_else(|_| error.code.clone())
    );
    ExitCode::from(code)
}

fn print_json<T: serde::Serialize>(value: &T) -> ExitCode {
    match serde_json::to_string_pretty(value) {
        Ok(json) => {
            println!("{json}");
            ExitCode::from(EXIT_OK)
        }
        Err(error) => fail(
            SelfTestError::with_message("export_failed", error.to_string()),
            EXIT_USAGE,
        ),
    }
}

fn record_line(record: &SelfTestRecord) -> String {
    format!(
        "{}  {}  [{}/{}]  {}  {}",
        record.id,
        record.name,
        record.test_type,
        record.verdict,
        record
            .fields
            .get("build")
            .map(String::as_str)
            .unwrap_or("-"),
        record
            .fields
            .get("patch")
            .map(String::as_str)
            .unwrap_or("-")
    )
}

fn parse_cli() -> Result<Cli, ExitCode> {
    match Cli::try_parse() {
        Ok(cli) => Ok(cli),
        Err(error) => {
            let code = match error.kind() {
                clap::error::ErrorKind::DisplayHelp | clap::error::ErrorKind::DisplayVersion => {
                    EXIT_OK
                }
                _ => EXIT_USAGE,
            };
            let _ = error.print();
            Err(ExitCode::from(code))
        }
    }
}

fn run() -> ExitCode {
    let cli = match parse_cli() {
        Ok(cli) => cli,
        Err(code) => return code,
    };
    let runtime = match tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
    {
        Ok(runtime) => runtime,
        Err(error) => {
            return fail(
                SelfTestError::with_message("io_failed", error.to_string()),
                EXIT_ENV,
            );
        }
    };

    match cli.command {
        Commands::Doctor { adb, json } => {
            let env = runtime.block_on(self_test_env(adb));
            if json {
                let code = if env.adb_found { EXIT_OK } else { EXIT_ENV };
                println!("{}", serde_json::to_string_pretty(&env).unwrap_or_default());
                ExitCode::from(code)
            } else {
                println!(
                    "adb: {}",
                    if env.adb_found {
                        &env.adb_path
                    } else {
                        "not found"
                    }
                );
                if !env.adb_version.is_empty() {
                    println!("version: {}", env.adb_version);
                }
                if env.devices.is_empty() {
                    println!("devices: none");
                } else {
                    for device in &env.devices {
                        println!(
                            "device: {}  {}  {}",
                            device.serial, device.state, device.model
                        );
                    }
                }
                if env.adb_found {
                    ExitCode::from(EXIT_OK)
                } else {
                    ExitCode::from(EXIT_ENV)
                }
            }
        }
        Commands::Capture {
            serial,
            adb,
            name,
            note,
            r#type,
            model_code,
            ota_version,
            patch_reference,
            patch_valid_days,
            json,
            no_pause: _,
        } => {
            let result = runtime.block_on(self_test_run(
                adb,
                serial,
                note,
                name,
                Some(r#type.as_str().to_owned()),
                None,
                model_code,
                ota_version,
                patch_reference,
                patch_valid_days,
            ));
            match result {
                Ok(record) => {
                    let blocked = spm_selftest::checks::has_blocking(&record.checks);
                    if json {
                        println!(
                            "{}",
                            serde_json::to_string_pretty(&record).unwrap_or_default()
                        );
                    } else {
                        println!("{}", record_line(&record));
                        for check in &record.checks {
                            if check.level != "pass" {
                                println!("  [{}] {}", check.level.to_uppercase(), check.code);
                            }
                        }
                    }
                    if blocked {
                        ExitCode::from(EXIT_BLOCKED)
                    } else {
                        ExitCode::from(EXIT_OK)
                    }
                }
                Err(error) => fail(error, EXIT_CAPTURE),
            }
        }
        Commands::List {
            json,
            r#type,
            result,
            model,
        } => match self_test_list() {
            Ok(items) => {
                let filtered: Vec<_> = items
                    .into_iter()
                    .filter(|item| {
                        r#type
                            .as_deref()
                            .map(|value| item.test_type.eq_ignore_ascii_case(value))
                            .unwrap_or(true)
                            && result
                                .as_deref()
                                .map(|value| item.check_status.eq_ignore_ascii_case(value))
                                .unwrap_or(true)
                            && model
                                .as_deref()
                                .map(|value| {
                                    item.model
                                        .to_ascii_lowercase()
                                        .contains(&value.to_ascii_lowercase())
                                        || item
                                            .model_code
                                            .to_ascii_lowercase()
                                            .contains(&value.to_ascii_lowercase())
                                })
                                .unwrap_or(true)
                    })
                    .collect();
                if json {
                    print_json(&filtered)
                } else {
                    for item in filtered {
                        println!(
                            "{}  {}  [{}/{}]  {}  {}",
                            item.id,
                            item.name,
                            item.test_type,
                            item.check_status,
                            item.build,
                            item.patch
                        );
                    }
                    ExitCode::from(EXIT_OK)
                }
            }
            Err(error) => fail(error, EXIT_USAGE),
        },
        Commands::Diff { left, right, json } => match (self_test_get(left), self_test_get(right)) {
            (Ok(a), Ok(b)) => {
                let diff = compute_diff(&a, &b);
                if json {
                    print_json(&diff)
                } else {
                    println!(
                        "fields {}  packages +{} / -{} / ={}  features +{} / -{} / ={}",
                        diff.field_changes.len(),
                        diff.packages_added.len(),
                        diff.packages_removed.len(),
                        diff.packages_unchanged,
                        diff.features_added.len(),
                        diff.features_removed.len(),
                        diff.features_unchanged
                    );
                    for change in &diff.field_changes {
                        println!("  {}: {} -> {}", change.key, change.left, change.right);
                    }
                    ExitCode::from(EXIT_OK)
                }
            }
            (Err(error), _) | (_, Err(error)) => fail(error, EXIT_USAGE),
        },
        Commands::Rename { id, name, json } => match self_test_rename(id, name) {
            Ok(record) => {
                if json {
                    print_json(&record)
                } else {
                    println!("{}", record_line(&record));
                    ExitCode::from(EXIT_OK)
                }
            }
            Err(error) => fail(error, EXIT_USAGE),
        },
        Commands::Review { id, baseline, json } => {
            let record = match self_test_get(id) {
                Ok(record) => record,
                Err(error) => return fail(error, EXIT_USAGE),
            };
            let list = match self_test_list() {
                Ok(list) => list,
                Err(error) => return fail(error, EXIT_USAGE),
            };
            let plan = review_plan_for(&record, baseline.as_deref(), &list);
            if json {
                let _ = print_json(&plan);
            } else {
                println!(
                    "ready: {}  stale: {}  required: {}  pending: {}",
                    plan.ready, plan.stale, plan.counts.required, plan.counts.pending
                );
                println!(
                    "reviewer: {}",
                    if plan.reviewer.is_empty() {
                        "-"
                    } else {
                        &plan.reviewer
                    }
                );
                for item in &plan.items {
                    println!("  [{}] {}  {}", item.state, item.group, item.id);
                }
            }
            ExitCode::from(if plan.ready { EXIT_OK } else { EXIT_BLOCKED })
        }
        Commands::Export {
            id,
            format,
            out,
            encoding,
            locale,
            force,
            json,
        } => {
            let record = match self_test_get(id) {
                Ok(record) => record,
                Err(error) => return fail(error, EXIT_USAGE),
            };
            if !force {
                let list = self_test_list().unwrap_or_default();
                let plan = review_plan_for(&record, None, &list);
                if !plan.ready {
                    return fail(SelfTestError::new("review_incomplete"), EXIT_BLOCKED);
                }
            }
            let zh = locale.as_deref() != Some("en");
            let out = out.unwrap_or_else(|| {
                let base_name = format!(
                    "self-test-{}-{}",
                    record
                        .fields
                        .get("model")
                        .map(String::as_str)
                        .unwrap_or("device")
                        .replace(' ', "_"),
                    record.id
                );
                PathBuf::from(match format {
                    FormatArg::Xlsx => xlsx_file_name(&base_name, &record, ""),
                    _ => base_name,
                })
            });
            let result = match format {
                FormatArg::Txt4 => write_txt4_bundle(&out, &record, encoding.as_str()),
                FormatArg::Xlsx => write_xlsx_report(&out, &record, zh, &XlsxOptions::default()),
                FormatArg::Md => std::fs::write(
                    &out,
                    encode_text(&render_markdown_report(&record, zh), encoding.as_str()),
                )
                .map_err(|error| SelfTestError::with_message("export_failed", error.to_string())),
                FormatArg::Json => {
                    std::fs::write(&out, serde_json::to_vec_pretty(&record).unwrap_or_default())
                        .map_err(|error| {
                            SelfTestError::with_message("export_failed", error.to_string())
                        })
                }
                FormatArg::Csv => std::fs::write(
                    &out,
                    encode_text(
                        &render_csv_ledger(&[summary_of(&record)]),
                        encoding.as_str(),
                    ),
                )
                .map_err(|error| SelfTestError::with_message("export_failed", error.to_string())),
            };
            match result {
                Ok(()) => {
                    if json {
                        print_json(&serde_json::json!({ "path": out }))
                    } else {
                        println!("{}", out.display());
                        ExitCode::from(EXIT_OK)
                    }
                }
                Err(error) => fail(error, EXIT_USAGE),
            }
        }
    }
}

fn main() -> ExitCode {
    run()
}
