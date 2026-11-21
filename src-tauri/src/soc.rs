use std::collections::BTreeMap;

pub const UNISOC: &str = "Unisoc";
pub const MEDIATEK: &str = "MediaTek";
pub const QUALCOMM: &str = "Qualcomm";
pub const OTHER: &str = "Other";
pub const UNKNOWN: &str = "Unknown";

const MANUFACTURER_KEYS: &[&str] = &[
    "ro.soc.manufacturer",
    "ro.soc.vendor",
    "ro.board.vendor",
    "ro.product.manufacturer",
];

const MODEL_KEYS: &[&str] = &[
    "ro.soc.model",
    "ro.board.platform",
    "ro.product.board",
    "ro.hardware",
    "ro.boot.hardware",
];

fn first(props: &BTreeMap<String, String>, keys: &[&str]) -> String {
    keys.iter()
        .find_map(|key| {
            props
                .get(*key)
                .map(|value| value.trim())
                .filter(|value| !value.is_empty())
                .map(str::to_owned)
        })
        .unwrap_or_default()
}

pub fn from_props(props: &BTreeMap<String, String>) -> (String, String) {
    let manufacturer = first(props, MANUFACTURER_KEYS);
    let model = first(props, MODEL_KEYS);
    let hardware = first(props, &["ro.hardware", "ro.boot.hardware"]);
    let board = first(props, &["ro.product.board", "ro.board.platform"]);

    let vendor = classify(&[
        manufacturer.as_str(),
        model.as_str(),
        hardware.as_str(),
        board.as_str(),
    ]);
    let model = if model.is_empty() {
        "(not set)".to_owned()
    } else {
        model
    };
    (vendor.to_owned(), model)
}

fn tokens(value: &str) -> impl Iterator<Item = &str> {
    value
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|token| !token.is_empty())
}

fn is_unisoc_token(token: &str) -> bool {
    token.starts_with("ums")
        || token.starts_with("sc98")
        || token.starts_with("sc96")
        || token.starts_with("t6")
            && matches!(
                token,
                "t606"
                    | "t610"
                    | "t612"
                    | "t616"
                    | "t618"
                    | "t619"
                    | "t760"
                    | "t765"
                    | "t770"
                    | "t820"
                    | "t910"
            )
}

fn is_mediatek_token(token: &str) -> bool {
    if token == "mtk" || token == "mediatek" || token == "helio" || token == "dimensity" {
        return true;
    }
    token
        .strip_prefix("mt")
        .is_some_and(|rest| rest.chars().next().is_some_and(|c| c.is_ascii_digit()))
}

fn is_qualcomm_token(token: &str) -> bool {
    if token == "qcom" || token == "qualcomm" || token == "msm" || token == "mdm" {
        return true;
    }
    if ["sm", "sdm", "msm", "mdm"].iter().any(|prefix| {
        token
            .strip_prefix(prefix)
            .is_some_and(|rest| rest.chars().next().is_some_and(|c| c.is_ascii_digit()))
    }) {
        return true;
    }
    matches!(
        token,
        "kona"
            | "lahaina"
            | "taro"
            | "kalama"
            | "pineapple"
            | "crow"
            | "parrot"
            | "bengal"
            | "holi"
            | "blair"
            | "scuba"
            | "cape"
            | "milos"
            | "eliza"
            | "waipio"
            | "sun"
    )
}

pub fn classify(values: &[&str]) -> &'static str {
    for value in values {
        let lower = value.trim().to_ascii_lowercase();
        if lower.is_empty() {
            continue;
        }
        if lower.contains("unisoc") || lower.contains("spreadtrum") || lower.contains("sprd") {
            return UNISOC;
        }
        if lower.contains("mediatek")
            || lower.contains("mtk")
            || lower.contains("dimensity")
            || lower.contains("helio")
        {
            return MEDIATEK;
        }
        if lower.contains("qualcomm") || lower.contains("qcom") {
            return QUALCOMM;
        }
        if lower == "other"
            || lower.contains("exynos")
            || lower.contains("tensor")
            || lower.contains("kirin")
        {
            return OTHER;
        }
        for token in tokens(&lower) {
            if is_unisoc_token(token) {
                return UNISOC;
            }
            if is_mediatek_token(token) {
                return MEDIATEK;
            }
            if is_qualcomm_token(token) {
                return QUALCOMM;
            }
            if matches!(token, "exynos" | "tensor" | "kirin") {
                return OTHER;
            }
        }
    }
    UNKNOWN
}

pub fn vendor_of(fields: &BTreeMap<String, String>) -> &'static str {
    if let Some(stored) = fields.get("soc_vendor") {
        let vendor = classify(&[stored]);
        if vendor != UNKNOWN {
            return vendor;
        }
    }
    let values: Vec<&str> = [
        "soc_model",
        "platform",
        "hardware",
        "board",
        "soc",
        "manufacturer",
    ]
    .iter()
    .filter_map(|key| fields.get(*key).map(String::as_str))
    .collect();
    classify(&values)
}

pub fn is_unisoc(fields: &BTreeMap<String, String>) -> bool {
    vendor_of(fields) == UNISOC
}

#[cfg(test)]
mod tests {
    use super::*;

    fn props(values: &[(&str, &str)]) -> BTreeMap<String, String> {
        values
            .iter()
            .map(|(key, value)| ((*key).to_owned(), (*value).to_owned()))
            .collect()
    }

    #[test]
    fn detects_canonical_soc_properties() {
        let (vendor, model) = from_props(&props(&[
            ("ro.soc.manufacturer", "Unisoc"),
            ("ro.soc.model", "UMS9230"),
        ]));
        assert_eq!(vendor, UNISOC);
        assert_eq!(model, "UMS9230");

        let (vendor, model) = from_props(&props(&[
            ("ro.soc.manufacturer", "MediaTek"),
            ("ro.soc.model", "MT6765"),
        ]));
        assert_eq!(vendor, MEDIATEK);
        assert_eq!(model, "MT6765");

        let (vendor, model) = from_props(&props(&[
            ("ro.soc.manufacturer", "Qualcomm"),
            ("ro.soc.model", "SM8550"),
        ]));
        assert_eq!(vendor, QUALCOMM);
        assert_eq!(model, "SM8550");
    }

    #[test]
    fn falls_back_to_board_platform_and_hardware() {
        assert_eq!(
            from_props(&props(&[("ro.board.platform", "ums512")])).0,
            UNISOC
        );
        assert_eq!(
            from_props(&props(&[("ro.board.platform", "mt6833")])).0,
            MEDIATEK
        );
        assert_eq!(from_props(&props(&[("ro.hardware", "qcom")])).0, QUALCOMM);
        assert_eq!(
            from_props(&props(&[("ro.board.platform", "sm6150")])).0,
            QUALCOMM
        );
    }

    #[test]
    fn vendor_build_version_is_not_a_soc_vendor() {
        let fields = props(&[("vendor", "UNISOC_V14"), ("manufacturer", "Demo")]);
        assert_eq!(vendor_of(&fields), UNKNOWN);
    }

    #[test]
    fn other_known_vendor_is_not_misclassified() {
        assert_eq!(
            from_props(&props(&[("ro.board.platform", "exynos2200")])).0,
            OTHER
        );
        assert_eq!(
            from_props(&props(&[("ro.board.platform", "foo-platform")])).0,
            UNKNOWN
        );
    }
}
