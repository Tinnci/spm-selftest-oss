use std::{
    collections::HashSet,
    net::{IpAddr, SocketAddr},
    sync::LazyLock,
    time::Duration,
};

use futures_util::{StreamExt, stream};
use regex::Regex;
use reqwest::{Client, ClientBuilder, Response, redirect::Policy};
use serde::Serialize;
use tauri::{Manager, Resource, ResourceId, Url, Webview};
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
const DEFAULT_MIRRORS: [&str; 2] = ["ghproxy.net", "gh-proxy.com"];

static CHUNK: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"/_next/static/chunks/[a-zA-Z0-9_.~-]+\.js").unwrap());
static NODE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"label:\s*"(?:contribute|search)",\s*value:\s*"([a-zA-Z0-9.-]+)""#).unwrap()
});

struct PendingUpdate {
    update: Update,
    mirror: Option<Mirror>,
    install_lock: Mutex<()>,
}

impl Resource for PendingUpdate {}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailableUpdate {
    id: ResourceId,
    version: String,
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

async fn bounded_body(mut response: Response, limit: usize) -> Result<Vec<u8>, String> {
    if response
        .content_length()
        .is_some_and(|length| length > limit as u64)
    {
        return Err("update response is too large".to_owned());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
        if chunk.len() > limit - bytes.len() {
            return Err("update response is too large".to_owned());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
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

fn store_update(webview: &Webview, update: Update, mirror: Option<Mirror>) -> AvailableUpdate {
    let version = update.version.clone();
    let id = webview.resources_table().add(PendingUpdate {
        update,
        mirror,
        install_lock: Mutex::new(()),
    });
    AvailableUpdate { id, version }
}

#[tauri::command]
pub async fn check_desktop_update(webview: Webview) -> Result<Option<AvailableUpdate>, String> {
    if !webview.config().plugins.0.contains_key("updater") {
        return Ok(None);
    }
    let updater = webview
        .updater_builder()
        .configure_client(http_client)
        .build()
        .map_err(|error| error.to_string())?;
    if let Ok(Ok(update)) = timeout(CHECK_TIMEOUT, updater.check()).await
        && let Ok(update) = validate_update(update)
    {
        return Ok(update.map(|update| store_update(&webview, update, None)));
    }

    let candidates = mirror_candidates(None).await;
    let mut probes = stream::iter(candidates)
        .map(|host| probe_mirror(&updater, host))
        .buffer_unordered(PROBE_CONCURRENCY);
    let mut reachable = false;
    while let Some(result) = probes.next().await {
        if let Some((mirror, update)) = result {
            if let Some(update) = update {
                return Ok(Some(store_update(&webview, update, Some(mirror))));
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

async fn fetch_from_mirror(update: &Update, mirror: &Mirror) -> Result<Vec<u8>, String> {
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
    let bytes = bounded_body(response, MAX_PACKAGE_BYTES).await?;
    update.verify(&bytes).map_err(|error| error.to_string())?;
    Ok(bytes)
}

async fn download_update(pending: &PendingUpdate) -> Result<Vec<u8>, String> {
    let update = &pending.update;
    if let Some(mirror) = &pending.mirror
        && let Ok(bytes) = fetch_from_mirror(update, mirror).await
    {
        return Ok(bytes);
    }
    if let Ok(Ok(bytes)) = timeout(DOWNLOAD_TIMEOUT, update.download(|_, _| {}, || {})).await {
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
            && let Ok(bytes) = fetch_from_mirror(update, &mirror).await
        {
            return Ok(bytes);
        }
    }
    Err("no verified update package could be downloaded".to_owned())
}

#[tauri::command]
pub async fn install_desktop_update(webview: Webview, id: ResourceId) -> Result<(), String> {
    let pending = webview
        .resources_table()
        .get::<PendingUpdate>(id)
        .map_err(|error| error.to_string())?;
    let _guard = pending
        .install_lock
        .try_lock()
        .map_err(|error| error.to_string())?;
    let bytes = download_update(&pending).await?;
    pending
        .update
        .install(bytes)
        .map_err(|error| error.to_string())?;
    webview
        .resources_table()
        .close(id)
        .map_err(|error| error.to_string())
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
}
