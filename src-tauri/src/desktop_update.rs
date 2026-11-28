use std::{
    collections::HashSet,
    fs::{self, File},
    io::Write,
    net::{IpAddr, SocketAddr},
    path::{Path, PathBuf},
    process::Command,
    sync::LazyLock,
    time::Duration,
};

use futures_util::{StreamExt, stream};
use regex::Regex;
use reqwest::{Client, ClientBuilder, Response, redirect::Policy};
use serde::Serialize;
use tauri::{Emitter, Manager, Resource, ResourceId, Url, Webview};
use tauri_plugin_updater::{Update, Updater, UpdaterExt};
use tokio::{net::lookup_host, sync::Mutex, time::timeout};

const DIRECTORY: &str = "https://github.akams.cn";
const RELEASES: &str = "/Tinnci/spm-selftest-oss/releases";
const MANIFEST: &str =
    "https://github.com/Tinnci/spm-selftest-oss/releases/latest/download/latest.json";
const CHECK_TIMEOUT: Duration = Duration::from_secs(4);
const READ_TIMEOUT: Duration = Duration::from_secs(12);
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(300);
const MAX_SCRIPT_BYTES: usize = 2_000_000;
const MAX_MANIFEST_BYTES: usize = 128 * 1024;
const MAX_PACKAGE_BYTES: usize = 256 * 1024 * 1024;
const MAX_NODES: usize = 10;
const PROBE_CONCURRENCY: usize = 5;
const DOWNLOAD_ATTEMPTS: usize = 4;
const PROGRESS_STEP_BYTES: u64 = 128 * 1024;
const PROGRESS_EVENT: &str = "desktop-update-progress";
const DEFAULT_MIRRORS: [&str; 2] = ["ghproxy.net", "gh-proxy.com"];

static CHUNK: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"/_next/static/chunks/[a-zA-Z0-9_.~-]+\.js").unwrap());
static NODE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"label:\s*"(?:contribute|search)",\s*value:\s*"([a-zA-Z0-9.-]+)""#).unwrap()
});

struct PendingUpdate {
    update: Update,
    mirror: Option<Mirror>,
    portable: bool,
    portable_replace: bool,
    install_lock: Mutex<()>,
}

impl Resource for PendingUpdate {}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailableUpdate {
    id: ResourceId,
    version: String,
    portable: bool,
    portable_replace: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallOutcome {
    mode: String,
    installer_path: Option<String>,
    launched: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateProgressEvent {
    stage: &'static str,
    downloaded: u64,
    total: Option<u64>,
}

#[derive(Clone)]
struct Mirror {
    host: String,
    addresses: Vec<SocketAddr>,
}

impl Mirror {
    fn url(&self, github_url: &str) -> Result<Url, String> {
        Url::parse(&format!("https://{}/{github_url}", self.host))
            .map_err(|error| error.to_string())
    }

    fn configure(&self, builder: ClientBuilder) -> ClientBuilder {
        let host = self.host.clone();
        http_client(builder)
            .resolve_to_addrs(&self.host, &self.addresses)
            .redirect(Policy::custom(move |attempt| {
                if attempt.previous().len() >= 5 {
                    return attempt.error("too many redirects");
                }
                if attempt.url().scheme() == "https"
                    && matches!(attempt.url().port(), None | Some(443))
                    && attempt.url().username().is_empty()
                    && attempt.url().password().is_none()
                    && attempt.url().host_str().is_some_and(|target| {
                        target == host
                            || matches!(
                                target,
                                "github.com"
                                    | "release-assets.githubusercontent.com"
                                    | "objects.githubusercontent.com"
                            )
                    })
                {
                    attempt.follow()
                } else {
                    attempt.error("unexpected update redirect")
                }
            }))
    }
}

fn http_client(builder: ClientBuilder) -> ClientBuilder {
    builder
        .https_only(true)
        .connect_timeout(CHECK_TIMEOUT)
        .read_timeout(READ_TIMEOUT)
}

fn unique_matches<'a>(matches: impl Iterator<Item = &'a str>, limit: usize) -> Vec<String> {
    let mut seen = HashSet::new();
    matches
        .filter(|value| seen.insert(*value))
        .take(limit)
        .map(str::to_owned)
        .collect()
}

fn chunk_paths(html: &str) -> Vec<String> {
    unique_matches(CHUNK.find_iter(html).map(|value| value.as_str()), 16)
}

fn mirror_names(source: &str) -> Vec<String> {
    unique_matches(
        NODE.captures_iter(source)
            .map(|entry| entry.get(1).unwrap().as_str())
            .filter(|host| {
                host.contains('.')
                    && host.as_bytes().first().is_some_and(u8::is_ascii_alphabetic)
                    && !host.ends_with('.')
                    && !host.ends_with(".localhost")
                    && !host.ends_with(".local")
            }),
        100,
    )
}

fn emit_progress(webview: &Webview, stage: &'static str, downloaded: u64, total: Option<u64>) {
    let _ = webview.emit(
        PROGRESS_EVENT,
        UpdateProgressEvent {
            stage,
            downloaded,
            total,
        },
    );
}

async fn bounded_body_with_progress(
    mut response: Response,
    limit: usize,
    mut on_progress: impl FnMut(u64, Option<u64>),
) -> Result<Vec<u8>, String> {
    if response
        .content_length()
        .is_some_and(|length| length > limit as u64)
    {
        return Err("update response is too large".to_owned());
    }
    let total = response
        .content_length()
        .filter(|length| *length <= limit as u64);
    let mut bytes = Vec::new();
    let mut last_reported: u64 = 0;
    on_progress(0, total);
    while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
        if chunk.len() > limit - bytes.len() {
            return Err("update response is too large".to_owned());
        }
        bytes.extend_from_slice(&chunk);
        let downloaded = bytes.len() as u64;
        if downloaded.saturating_sub(last_reported) >= PROGRESS_STEP_BYTES {
            last_reported = downloaded;
            on_progress(downloaded, total);
        }
    }
    let downloaded = bytes.len() as u64;
    if downloaded != last_reported {
        on_progress(downloaded, total);
    }
    Ok(bytes)
}

async fn bounded_body(response: Response, limit: usize) -> Result<Vec<u8>, String> {
    bounded_body_with_progress(response, limit, |_, _| {}).await
}

async fn directory_file(client: &Client, url: String) -> Option<String> {
    let response = client.get(url).send().await.ok()?.error_for_status().ok()?;
    let bytes = bounded_body(response, MAX_SCRIPT_BYTES).await.ok()?;
    String::from_utf8(bytes).ok()
}

async fn discover_mirrors() -> Option<Vec<String>> {
    let client = http_client(Client::builder())
        .timeout(CHECK_TIMEOUT)
        .redirect(Policy::none())
        .build()
        .ok()?;
    let html = directory_file(&client, format!("{DIRECTORY}/")).await?;
    let mut chunks = stream::iter(chunk_paths(&html))
        .map(|path| directory_file(&client, format!("{DIRECTORY}{path}")))
        .buffer_unordered(PROBE_CONCURRENCY);
    while let Some(chunk) = chunks.next().await {
        if let Some(chunk) = chunk {
            let names = mirror_names(&chunk);
            if !names.is_empty() {
                return Some(names);
            }
        }
    }
    None
}

async fn mirror_candidates(preferred: Option<&Mirror>) -> Vec<String> {
    let names = timeout(Duration::from_secs(7), discover_mirrors())
        .await
        .ok()
        .flatten()
        .unwrap_or_default();
    unique_matches(
        preferred
            .map(|mirror| mirror.host.as_str())
            .into_iter()
            .chain(DEFAULT_MIRRORS)
            .chain(names.iter().map(String::as_str)),
        MAX_NODES,
    )
}

fn public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let [a, b, c, _] = ip.octets();
            a > 0
                && a < 224
                && !(a == 100 && (64..=127).contains(&b))
                && !(a == 192 && b == 0 && c == 0)
                && !(a == 198 && (18..=19).contains(&b))
                && !ip.is_private()
                && !ip.is_loopback()
                && !ip.is_link_local()
                && !ip.is_documentation()
        }
        IpAddr::V6(ip) => {
            let [first, second, ..] = ip.segments();
            first & 0xe000 == 0x2000 && (first, second) != (0x2001, 0x0db8)
        }
    }
}

async fn resolve_mirror(host: String) -> Option<Mirror> {
    let addresses: Vec<_> = timeout(CHECK_TIMEOUT, lookup_host((host.as_str(), 443)))
        .await
        .ok()?
        .ok()?
        .filter(|address| public_ip(address.ip()))
        .collect();
    (!addresses.is_empty()).then_some(Mirror { host, addresses })
}

fn trusted_asset(url: &Url, version: &str) -> bool {
    let path_prefix = format!("{RELEASES}/download/v{version}/");
    url.scheme() == "https"
        && url.host_str() == Some("github.com")
        && url.port().is_none()
        && url.username().is_empty()
        && url.password().is_none()
        && url.query().is_none()
        && url.fragment().is_none()
        && url.path().strip_prefix(&path_prefix).is_some_and(|name| {
            !name.is_empty() && !name.contains('/') && !name.eq_ignore_ascii_case("latest.json")
        })
}

fn validate_update(update: Option<Update>) -> Result<Option<Update>, String> {
    if update.as_ref().is_some_and(|update| {
        update.signature.is_empty() || !trusted_asset(&update.download_url, &update.version)
    }) {
        return Err("unexpected update asset".to_owned());
    }
    Ok(update)
}

fn validate_version_segment(version: &str) -> Result<&str, String> {
    let clean = version.trim();
    if clean.is_empty()
        || clean.contains("..")
        || clean.contains('/')
        || clean.contains('\\')
        || !clean
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_'))
    {
        return Err("invalid update version".to_owned());
    }
    Ok(clean)
}

fn is_portable_from_exe(exe_path: &Path) -> bool {
    if cfg!(windows) {
        exe_path
            .parent()
            .is_some_and(|dir| !dir.join("uninstall.exe").is_file())
    } else {
        false
    }
}

fn staged_file_path(root: &Path, version: &str, file_name: &str) -> Result<PathBuf, String> {
    let clean = validate_version_segment(version)?;
    Ok(root.join(format!("v{clean}")).join(file_name))
}

fn stage_named_file(
    root: &Path,
    version: &str,
    file_name: &str,
    bytes: &[u8],
) -> Result<PathBuf, String> {
    let dest = staged_file_path(root, version, file_name)?;
    let parent = dest
        .parent()
        .ok_or_else(|| "missing installer directory".to_owned())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let tmp = parent.join(format!(".{file_name}.tmp-{}", std::process::id()));
    {
        let mut file = File::create(&tmp).map_err(|error| error.to_string())?;
        if let Err(error) = file.write_all(bytes) {
            let _ = fs::remove_file(&tmp);
            return Err(error.to_string());
        }
        if let Err(error) = file.sync_all() {
            let _ = fs::remove_file(&tmp);
            return Err(error.to_string());
        }
    }
    #[cfg(windows)]
    if dest.exists() {
        let _ = fs::remove_file(&dest);
    }
    fs::rename(&tmp, &dest).map_err(|error| {
        let _ = fs::remove_file(&tmp);
        error.to_string()
    })?;
    Ok(dest)
}

fn stage_installer_bytes(root: &Path, version: &str, bytes: &[u8]) -> Result<PathBuf, String> {
    stage_named_file(root, version, "setup.exe", bytes)
}

fn old_exe_path(exe_path: &Path) -> Result<PathBuf, String> {
    let parent = exe_path
        .parent()
        .ok_or_else(|| "missing executable directory".to_owned())?;
    let name = exe_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "invalid executable name".to_owned())?;
    Ok(parent.join(format!(".{name}.old")))
}

fn cleanup_old_exe_at(exe_path: &Path) {
    let Ok(old_path) = old_exe_path(exe_path) else {
        return;
    };
    if !old_path.exists() {
        return;
    }
    for attempt in 0..5 {
        if fs::remove_file(&old_path).is_ok() {
            return;
        }
        if attempt < 4 {
            std::thread::sleep(Duration::from_millis(100));
        }
    }
}

pub fn cleanup_stale_portable_binary() {
    let Ok(exe_path) = std::env::current_exe() else {
        return;
    };
    if !is_portable_from_exe(&exe_path) {
        return;
    }
    std::thread::spawn(move || {
        cleanup_old_exe_at(&exe_path);
    });
}

fn rename_with_retry(from: &Path, to: &Path) -> std::io::Result<()> {
    let mut last_err = None;
    for attempt in 0..3 {
        match fs::rename(from, to) {
            Ok(()) => return Ok(()),
            Err(error) => {
                last_err = Some(error);
                if attempt < 2 {
                    std::thread::sleep(Duration::from_millis(150));
                }
            }
        }
    }
    Err(last_err.expect("retry loop ran at least once"))
}

fn replace_portable_exe(exe_path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = exe_path
        .parent()
        .ok_or_else(|| "missing executable directory".to_owned())?;
    let name = exe_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "invalid executable name".to_owned())?;
    let new_path = parent.join(format!(".{name}.new-{}", std::process::id()));
    let old_path = old_exe_path(exe_path)?;
    {
        let mut file = File::create(&new_path).map_err(|error| error.to_string())?;
        if let Err(error) = file.write_all(bytes) {
            let _ = fs::remove_file(&new_path);
            return Err(error.to_string());
        }
        if let Err(error) = file.sync_all() {
            let _ = fs::remove_file(&new_path);
            return Err(error.to_string());
        }
    }
    if old_path.exists() {
        let _ = fs::remove_file(&old_path);
    }
    if let Err(error) = rename_with_retry(exe_path, &old_path) {
        let _ = fs::remove_file(&new_path);
        return Err(error.to_string());
    }
    if let Err(error) = rename_with_retry(&new_path, exe_path) {
        let _ = fs::rename(&old_path, exe_path);
        let _ = fs::remove_file(&new_path);
        return Err(error.to_string());
    }
    Ok(())
}

fn parse_version_tuple(raw: &str) -> Option<(u64, u64, u64)> {
    let core = raw.split('-').next()?;
    let mut parts = core.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch = parts.next()?.parse().ok()?;
    if parts.next().is_some() {
        return None;
    }
    Some((major, minor, patch))
}

fn cleanup_old_staged_updates(root: &Path, current_version: &str) {
    let Some(current) = parse_version_tuple(current_version) else {
        return;
    };
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        let Some(ver) = name.strip_prefix('v') else {
            continue;
        };
        if let Some(parsed) = parse_version_tuple(ver)
            && parsed <= current
        {
            let _ = fs::remove_dir_all(path);
        }
    }
}

fn updates_root_dir() -> Result<PathBuf, String> {
    spm_selftest::self_test::data_dir()
        .map(|dir| dir.join("updates"))
        .map_err(|error| error.message.unwrap_or(error.code))
}

async fn probe_mirror(updater: &Updater, host: String) -> Option<(Mirror, Option<Update>)> {
    let mirror = resolve_mirror(host).await?;
    let client = mirror
        .configure(Client::builder())
        .timeout(CHECK_TIMEOUT)
        .build()
        .ok()?;
    let response = client
        .get(mirror.url(MANIFEST).ok()?)
        .send()
        .await
        .ok()?
        .error_for_status()
        .ok()?;
    let bytes = bounded_body(response, MAX_MANIFEST_BYTES).await.ok()?;
    let manifest = serde_json::from_slice(&bytes).ok()?;
    let update = validate_update(updater.restore_update(manifest).ok()?).ok()?;
    Some((mirror, update))
}

fn store_update(
    webview: &Webview,
    update: Update,
    mirror: Option<Mirror>,
    portable: bool,
    portable_replace: bool,
) -> AvailableUpdate {
    let version = update.version.clone();
    let id = webview.resources_table().add(PendingUpdate {
        update,
        mirror,
        portable,
        portable_replace,
        install_lock: Mutex::new(()),
    });
    AvailableUpdate {
        id,
        version,
        portable,
        portable_replace,
    }
}

async fn check_with_updater(
    webview: &Webview,
    updater: &Updater,
    portable: bool,
    portable_replace: bool,
) -> Result<Option<AvailableUpdate>, String> {
    if let Ok(Ok(update)) = timeout(CHECK_TIMEOUT, updater.check()).await
        && let Ok(update) = validate_update(update)
    {
        return Ok(
            update.map(|update| store_update(webview, update, None, portable, portable_replace))
        );
    }

    let candidates = mirror_candidates(None).await;
    let mut probes = stream::iter(candidates)
        .map(|host| probe_mirror(updater, host))
        .buffer_unordered(PROBE_CONCURRENCY);
    let mut reachable = false;
    while let Some(result) = probes.next().await {
        if let Some((mirror, update)) = result {
            if let Some(update) = update {
                return Ok(Some(store_update(
                    webview,
                    update,
                    Some(mirror),
                    portable,
                    portable_replace,
                )));
            }
            reachable = true;
        }
    }
    if reachable {
        Ok(None)
    } else {
        Err("the update feed is unreachable".to_owned())
    }
}

#[cfg(windows)]
fn portable_target_name() -> &'static str {
    if cfg!(target_arch = "aarch64") {
        "windows-aarch64-portable"
    } else {
        "windows-x86_64-portable"
    }
}

#[tauri::command]
pub async fn check_desktop_update(webview: Webview) -> Result<Option<AvailableUpdate>, String> {
    if !webview.config().plugins.0.contains_key("updater") {
        return Ok(None);
    }
    if let Ok(root) = updates_root_dir() {
        cleanup_old_staged_updates(&root, env!("CARGO_PKG_VERSION"));
    }
    let portable = std::env::current_exe()
        .ok()
        .is_some_and(|path| is_portable_from_exe(&path));

    #[cfg(windows)]
    if portable
        && let Ok(portable_updater) = webview
            .updater_builder()
            .configure_client(http_client)
            .target(portable_target_name())
            .build()
        && let Ok(Some(available)) =
            check_with_updater(&webview, &portable_updater, portable, true).await
    {
        return Ok(Some(available));
    }

    let updater = webview
        .updater_builder()
        .configure_client(http_client)
        .build()
        .map_err(|error| error.to_string())?;
    check_with_updater(&webview, &updater, portable, false).await
}

async fn fetch_from_mirror(
    update: &Update,
    mirror: &Mirror,
    webview: &Webview,
) -> Result<Vec<u8>, String> {
    let client = mirror
        .configure(Client::builder())
        .timeout(DOWNLOAD_TIMEOUT)
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .get(mirror.url(update.download_url.as_str())?)
        .send()
        .await
        .and_then(Response::error_for_status)
        .map_err(|error| error.to_string())?;
    let bytes = bounded_body_with_progress(response, MAX_PACKAGE_BYTES, |downloaded, total| {
        emit_progress(webview, "downloading", downloaded, total);
    })
    .await?;
    emit_progress(webview, "verifying", bytes.len() as u64, None);
    update.verify(&bytes).map_err(|error| error.to_string())?;
    Ok(bytes)
}

async fn download_update(pending: &PendingUpdate, webview: &Webview) -> Result<Vec<u8>, String> {
    let update = &pending.update;
    if let Some(mirror) = &pending.mirror
        && let Ok(bytes) = fetch_from_mirror(update, mirror, webview).await
    {
        return Ok(bytes);
    }

    let mut downloaded_total: u64 = 0;
    let mut last_reported: u64 = 0;
    if let Ok(Ok(bytes)) = timeout(
        DOWNLOAD_TIMEOUT,
        update.download(
            |chunk_len, total| {
                downloaded_total = downloaded_total.saturating_add(chunk_len as u64);
                if downloaded_total.saturating_sub(last_reported) >= PROGRESS_STEP_BYTES {
                    last_reported = downloaded_total;
                    emit_progress(webview, "downloading", downloaded_total, total);
                }
            },
            || {
                emit_progress(webview, "verifying", 0, None);
            },
        ),
    )
    .await
    {
        emit_progress(webview, "verifying", bytes.len() as u64, None);
        update.verify(&bytes).map_err(|error| error.to_string())?;
        return Ok(bytes);
    }

    let candidates = mirror_candidates(pending.mirror.as_ref()).await;
    let preferred = pending.mirror.as_ref().map(|mirror| mirror.host.as_str());
    for host in candidates
        .into_iter()
        .filter(|host| Some(host.as_str()) != preferred)
        .take(DOWNLOAD_ATTEMPTS)
    {
        if let Some(mirror) = resolve_mirror(host).await
            && let Ok(bytes) = fetch_from_mirror(update, &mirror, webview).await
        {
            return Ok(bytes);
        }
    }
    Err("no verified update package could be downloaded".to_owned())
}

#[tauri::command]
pub async fn install_desktop_update(
    webview: Webview,
    id: ResourceId,
) -> Result<InstallOutcome, String> {
    let pending = webview
        .resources_table()
        .get::<PendingUpdate>(id)
        .map_err(|error| error.to_string())?;
    let _guard = pending
        .install_lock
        .try_lock()
        .map_err(|error| error.to_string())?;
    let bytes = download_update(&pending, &webview).await?;

    #[cfg(windows)]
    {
        emit_progress(&webview, "staging", bytes.len() as u64, None);
        let version = pending.update.version.clone();
        if pending.portable_replace
            && let Ok(exe_path) = std::env::current_exe()
        {
            let root = updates_root_dir()?;
            let fallback_name = format!("SPM-SelfTest-v{version}.exe");
            let target_exe = exe_path.clone();
            let result = tokio::task::spawn_blocking(move || {
                if replace_portable_exe(&target_exe, &bytes).is_ok() {
                    Ok((target_exe, true))
                } else {
                    stage_named_file(&root, &version, &fallback_name, &bytes)
                        .map(|staged| (staged, false))
                }
            })
            .await
            .map_err(|error| error.to_string())??;

            let (result_path, swapped) = result;
            let launched = if swapped {
                emit_progress(&webview, "launching", 0, None);
                Command::new(&result_path).spawn().is_ok()
            } else {
                false
            };
            webview
                .resources_table()
                .close(id)
                .map_err(|error| error.to_string())?;
            if launched {
                let app = webview.app_handle().clone();
                tokio::spawn(async move {
                    tokio::time::sleep(Duration::from_millis(200)).await;
                    app.exit(0);
                });
            }
            return Ok(InstallOutcome {
                mode: "portable".to_owned(),
                installer_path: Some(result_path.display().to_string()),
                launched,
            });
        }

        let root = updates_root_dir()?;
        let installer_path =
            tokio::task::spawn_blocking(move || stage_installer_bytes(&root, &version, &bytes))
                .await
                .map_err(|error| error.to_string())??;
        let path_string = installer_path.display().to_string();
        emit_progress(&webview, "launching", 0, None);
        let mut command = Command::new(&installer_path);
        if !pending.portable {
            command.arg("/P");
        }
        let launched = command.spawn().is_ok();
        webview
            .resources_table()
            .close(id)
            .map_err(|error| error.to_string())?;
        if launched {
            let app = webview.app_handle().clone();
            tokio::spawn(async move {
                tokio::time::sleep(Duration::from_millis(250)).await;
                app.exit(0);
            });
        }
        Ok(InstallOutcome {
            mode: "installer".to_owned(),
            installer_path: Some(path_string),
            launched,
        })
    }

    #[cfg(not(windows))]
    {
        pending
            .update
            .install(bytes)
            .map_err(|error| error.to_string())?;
        webview
            .resources_table()
            .close(id)
            .map_err(|error| error.to_string())?;
        Ok(InstallOutcome {
            mode: "inPlace".to_owned(),
            installer_path: None,
            launched: false,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_unique_directory_chunks_and_named_https_nodes() {
        assert_eq!(
            chunk_paths(
                r#"<script src="/_next/static/chunks/abcd.js"></script><link href="/_next/static/chunks/abcd.js">"#
            ),
            ["/_next/static/chunks/abcd.js"]
        );
        assert_eq!(
            mirror_names(
                r#"{label:"contribute",value:"node.example.com"},{label:"search",value:"node.example.com"},{label:"search",value:"other.example.org"},{label:"search",value:"127.0.0.1"},{label:"search",value:"fake.localhost"},{label:"other",value:"ignored.example.net"}"#
            ),
            ["node.example.com", "other.example.org"]
        );
    }

    #[test]
    fn accepts_only_the_current_projects_tagged_release_assets() {
        for (url, accepted) in [
            (
                "https://github.com/Tinnci/spm-selftest-oss/releases/download/v0.1.1/App.AppImage",
                true,
            ),
            (
                "https://github.com/Tinnci/spm-selftest-oss/releases/download/v0.1.0/App.AppImage",
                false,
            ),
            (
                "https://github.com/Tinnci/spm-selftest-oss/releases/download/v0.1.1/latest.json",
                false,
            ),
            (
                "https://github.com/other/repo/releases/download/v0.1.1/App.AppImage",
                false,
            ),
            (
                "http://github.com/Tinnci/spm-selftest-oss/releases/download/v0.1.1/App.AppImage",
                false,
            ),
            (
                "https://node.example.com/https://github.com/Tinnci/spm-selftest-oss/releases/download/v0.1.1/App.AppImage",
                false,
            ),
        ] {
            assert_eq!(trusted_asset(&Url::parse(url).unwrap(), "0.1.1"), accepted);
        }
        assert!("1.1.1.1".parse().is_ok_and(public_ip));
        for local in [
            "127.0.0.1",
            "169.254.169.254",
            "10.0.0.1",
            "::1",
            "fc00::1",
            "::ffff:127.0.0.1",
        ] {
            assert!(!local.parse().is_ok_and(public_ip));
        }
    }

    #[test]
    fn stages_setup_exe_and_cleans_old_versions() {
        let root = std::env::temp_dir().join(format!("spm_update_stage_{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);

        assert!(stage_installer_bytes(&root, "../evil", b"MZ").is_err());
        assert!(stage_installer_bytes(&root, "0.1.6/foo", b"MZ").is_err());

        let staged = stage_installer_bytes(&root, "0.1.6", b"MZ-installer").unwrap();
        assert_eq!(
            staged.file_name().and_then(|n| n.to_str()),
            Some("setup.exe")
        );
        assert_eq!(fs::read(&staged).unwrap(), b"MZ-installer");

        let old = stage_installer_bytes(&root, "0.1.4", b"old").unwrap();
        assert!(old.is_file());
        cleanup_old_staged_updates(&root, "0.1.5");
        assert!(!old.exists());
        assert!(staged.is_file());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn detects_portable_mode_from_sibling_uninstaller() {
        let dir = std::env::temp_dir().join(format!("spm_update_portable_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let exe = dir.join("spm-selftest.exe");
        fs::write(&exe, b"").unwrap();

        #[cfg(windows)]
        assert!(is_portable_from_exe(&exe));

        fs::write(dir.join("uninstall.exe"), b"").unwrap();
        assert!(!is_portable_from_exe(&exe));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn replaces_portable_exe_and_cleans_old_binary() {
        let dir = std::env::temp_dir().join(format!("spm_update_replace_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let exe = dir.join("SPM-SelfTest.exe");
        fs::write(&exe, b"old-binary").unwrap();

        replace_portable_exe(&exe, b"new-binary").unwrap();
        assert_eq!(fs::read(&exe).unwrap(), b"new-binary");
        let old = old_exe_path(&exe).unwrap();
        assert_eq!(fs::read(&old).unwrap(), b"old-binary");

        cleanup_old_exe_at(&exe);
        assert!(!old.exists());

        let _ = fs::remove_dir_all(&dir);
    }
}
