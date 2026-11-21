use std::process::{Command, Output};

fn cli(args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_spm-selftest-cli"))
        .args(args)
        .env(
            "SPM_SELFTEST_HOME",
            std::env::temp_dir().join("spm-selftest-cli-test"),
        )
        .output()
        .expect("run spm-selftest-cli")
}

#[test]
fn unknown_subcommand_is_a_usage_error() {
    let output = cli(&["bogus"]);
    assert_eq!(
        output.status.code(),
        Some(5),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn missing_required_argument_is_a_usage_error() {
    let output = cli(&["capture"]);
    assert_eq!(
        output.status.code(),
        Some(5),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn help_and_version_succeed() {
    for flag in ["--help", "--version"] {
        let output = cli(&[flag]);
        assert_eq!(output.status.code(), Some(0), "{flag}");
    }
}

#[test]
fn missing_record_is_a_usage_error() {
    let output = cli(&["export", "missing-record", "--format", "md"]);
    assert_eq!(
        output.status.code(),
        Some(5),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}
