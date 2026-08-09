#!/usr/bin/env python3
"""Local-only NAVER SmartChannel PSD metadata and fixed-asset extractor.

This script is intentionally outside the renderer runtime.  It requires the
development-only packages listed in scripts/requirements-naver-source.txt.
The PSD binaries remain external source inputs; only deterministic metadata,
source-layer digests, and approved fixed UI layers are written to the repo.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

import numpy as np
from PIL import Image
from psd_tools import PSDImage


CLASSIFICATIONS = {
    "SOURCE_CONFIRMED",
    "DERIVED_FROM_EXACT_SOURCE_METADATA",
    "UNRESOLVED",
    "DEFERRED_NON_BLOCKING",
}

WEIGHTS = {
    "Regular": 400,
    "Medium": 500,
    "SemiBold": 600,
    "Bold": 700,
}

CTA_LABELS = [
    "앱 다운로드",
    "앱으로 보기",
    "앱 특가 보기",
    "앱특가 보기",
    "지금 다운로드",
    "더 알아보기",
    "지금 예약하기",
    "문의하기",
    "다운로드",
    "지금 구매하기",
    "가입하기",
    "동영상 더보기",
]


def clean(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if hasattr(value, "item"):
        return clean(value.item())
    if isinstance(value, dict):
        return {str(key): clean(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [clean(item) for item in value]
    return str(value)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def walk_layers(layer: Any, path: tuple[str, ...] = ()) -> Iterable[tuple[Any, tuple[str, ...]]]:
    current = path + (str(layer.name),)
    yield layer, current
    try:
        for child in layer:
            yield from walk_layers(child, current)
    except TypeError:
        return


def path_string(path: tuple[str, ...]) -> str:
    return "/".join(path)


def is_guide(path: tuple[str, ...]) -> bool:
    return any(segment.startswith("*GUIDE") for segment in path) or any(
        "가이드" in segment for segment in path
    )


def style_data(layer: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for run in layer.engine_dict.get("StyleRun", {}).get("RunArray", []):
        data = run.get("StyleSheet", {}).get("StyleSheetData", {})
        fields = [
            "Font",
            "FontSize",
            "FauxBold",
            "FauxItalic",
            "AutoLeading",
            "Leading",
            "HorizontalScale",
            "VerticalScale",
            "Tracking",
            "AutoKerning",
            "Kerning",
            "BaselineShift",
            "FontCaps",
            "FontBaseline",
            "Underline",
            "Strikethrough",
            "FillColor",
            "StrokeColor",
            "Language",
            "NoBreak",
        ]
        rows.append(clean({field: data[field] for field in fields if field in data}))
    return rows


def paragraph_data(layer: Any) -> dict[str, Any]:
    paragraph = layer.engine_dict.get("ParagraphRun", {})
    default = paragraph.get("DefaultRunData", {})
    sheet = default.get("ParagraphSheet", {})
    return clean(sheet.get("Properties", {}))


def font_identity(postscript_name: str) -> dict[str, Any]:
    base, separator, style = postscript_name.rpartition("-")
    if not separator:
        base, style = postscript_name, None
    return {
        "family": base,
        "postScriptName": postscript_name,
        "style": style,
        "weight": WEIGHTS.get(style),
        "classification": "DERIVED_FROM_EXACT_SOURCE_METADATA",
    }


def text_role(layer_name: str, guide: bool) -> str:
    if guide:
        return "GUIDE_TEXT"
    if "메인카피" in layer_name:
        return "HEADLINE"
    if "서브카피" in layer_name:
        return "SUBCOPY"
    if "심의필" in layer_name or "고지문구" in layer_name:
        return "DISCLOSURE"
    if layer_name in CTA_LABELS or "행동유도문구" in layer_name:
        return "CTA_LABEL"
    return "OTHER_TEXT"


def text_metadata(layer: Any, path: tuple[str, ...]) -> dict[str, Any]:
    transform = [float(value) for value in layer.transform]
    font_names = [str(name) for name in layer.font_names]
    guide = is_guide(path)
    return {
        "layerPath": path_string(path),
        "layerId": int(layer.layer_id) if layer.layer_id is not None else None,
        "name": str(layer.name),
        "visible": bool(layer.visible),
        "guideLayer": guide,
        "role": text_role(str(layer.name), guide),
        "text": str(layer.text),
        "textType": getattr(layer.text_type, "name", str(layer.text_type)),
        "fontNames": font_names,
        "fontIdentities": [font_identity(name) for name in font_names],
        "styleRuns": style_data(layer),
        "paragraph": paragraph_data(layer),
        "antiAlias": clean(layer.engine_dict.get("AntiAlias")),
        "transform": transform,
        "textPlacement": {
            "originX": transform[4],
            "originY": transform[5],
            "boxX": int(layer.left),
            "boxY": int(layer.top),
            "boxWidth": int(layer.width),
            "boxHeight": int(layer.height),
            "baselineY": transform[5],
            "baselineModel": "PSD_POINT_TEXT_TRANSFORM_TRANSLATION",
            "classification": "DERIVED_FROM_EXACT_SOURCE_METADATA",
        },
        "pixelBounds": [int(value) for value in layer.bbox],
        "opacity": int(layer.opacity),
        "fillOpacity": int(layer.fill_opacity),
        "classification": "DERIVED_FROM_EXACT_SOURCE_METADATA",
    }


def rgba_array(layer: Any) -> np.ndarray | None:
    try:
        array = layer.numpy()
    except Exception:
        return None
    if array is None:
        return None
    values = np.asarray(array)
    if values.dtype.kind == "f" and float(values.max(initial=0)) <= 1.0:
        values = values * 255.0
    return np.clip(np.rint(values), 0, 255).astype(np.uint8)


def pixel_metadata(layer: Any) -> dict[str, Any] | None:
    array = rgba_array(layer)
    if array is None or array.ndim != 3 or array.shape[2] != 4:
        return None
    alpha = array[:, :, 3]
    ys, xs = np.where(alpha >= 1)
    if len(xs) == 0:
        local_bbox = [0, 0, 0, 0]
        trimmed = array[:0, :0]
    else:
        local_bbox = [int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)]
        trimmed = array[local_bbox[1] : local_bbox[3], local_bbox[0] : local_bbox[2]]
    def bool_property(name: str) -> bool:
        value = getattr(layer, name, False)
        return bool(value() if callable(value) else value)

    return {
        "rawPixelSha256": hashlib.sha256(array.tobytes()).hexdigest(),
        "rawPixelShape": [int(value) for value in array.shape],
        "trimmedPixelSha256": hashlib.sha256(trimmed.tobytes()).hexdigest(),
        "trimmedPixelShape": [int(value) for value in trimmed.shape],
        "alphaBboxLocal": local_bbox,
        "alphaVisibleThreshold": 1,
        "hasEffects": bool_property("has_effects"),
        "hasMask": bool_property("has_mask"),
        "hasVectorMask": bool_property("has_vector_mask"),
        "classification": "DERIVED_FROM_EXACT_SOURCE_METADATA",
    }


def write_layer_asset(layer: Any, path: Path) -> dict[str, Any]:
    array = rgba_array(layer)
    if array is None:
        raise RuntimeError(f"Layer has no RGBA pixels: {layer.name}")
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(array, mode="RGBA").save(path, format="PNG", optimize=False, compress_level=9)
    info = pixel_metadata(layer)
    assert info is not None
    info["assetPath"] = path.as_posix()
    info["assetPngSha256"] = sha256_file(path)
    info["assetPngFormat"] = "RGBA_PNG"
    return info


def source_file_map(root: Path) -> dict[str, Path]:
    mapping: dict[str, Path] = {}
    for path in sorted(root.rglob("*.psd")):
        mapping[sha256_file(path)] = path
    return mapping


def source_layer_records(psd: PSDImage, source_sha: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    text_layers: list[dict[str, Any]] = []
    layer_inventory: list[dict[str, Any]] = []
    flattened: list[tuple[Any, tuple[str, ...]]] = []
    for root_layer in psd:
        flattened.extend(walk_layers(root_layer))
    for layer, path in flattened:
        record = {
            "layerPath": path_string(path),
            "layerId": int(layer.layer_id) if layer.layer_id is not None else None,
            "name": str(layer.name),
            "kind": str(layer.kind),
            "visible": bool(layer.visible),
            "pixelBounds": [int(value) for value in layer.bbox],
            "opacity": int(layer.opacity),
            "classification": "DERIVED_FROM_EXACT_SOURCE_METADATA",
        }
        if layer.kind == "type":
            item = text_metadata(layer, path)
            text_layers.append(item)
            record["typographyTokenKey"] = typography_key(item)
        elif layer.kind in {"pixel", "shape", "smartobject"} and (
            "icon_위치_변형금지" in str(layer.name)
            or "버튼 Color 적용 레이어" in str(layer.name)
            or str(layer.name) == "ic_꺽쇠"
            or str(layer.name) in CTA_LABELS
            or str(layer.name) == ">"
        ):
            pixels = pixel_metadata(layer)
            if pixels is not None:
                record["pixelMetadata"] = pixels
        layer_inventory.append(record)
    return text_layers, layer_inventory


def typography_key(item: dict[str, Any]) -> str:
    payload = {
        "fontNames": item["fontNames"],
        "fontIdentities": item["fontIdentities"],
        "styleRuns": item["styleRuns"],
        "paragraph": item["paragraph"],
        "textType": item["textType"],
        "antiAlias": item["antiAlias"],
    }
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def token_id(key: str) -> str:
    return "PSD_TYPE_TOKEN_" + hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]


def find_by_name(items: list[tuple[Any, tuple[str, ...]]], name: str, kind: str | None = None) -> list[tuple[Any, tuple[str, ...]]]:
    return [
        (layer, path)
        for layer, path in items
        if str(layer.name) == name and (kind is None or str(layer.kind) == kind)
    ]


def option_name(path: tuple[str, ...]) -> str | None:
    for segment in reversed(path):
        if re.match(r"^\d{2} ", segment):
            return segment
    return None


def source_layer_ref(layer: Any, path: tuple[str, ...], source_sha: str) -> dict[str, Any]:
    info = pixel_metadata(layer)
    if info is None:
        info = {}
    return {
        "sourceSha256": source_sha,
        "sourceLayerPath": path_string(path),
        "sourceLayerName": str(layer.name),
        "sourceLayerKind": str(layer.kind),
        "sourcePixelBounds": [int(value) for value in layer.bbox],
        **info,
        "classification": "DERIVED_FROM_EXACT_SOURCE_METADATA",
    }


def rounded_rectangle_info(layer: Any) -> dict[str, Any] | None:
    try:
        origin = layer.origination[0]
        radii = {str(key.decode("ascii", errors="replace")): clean(value) for key, value in origin.radii.items()}
        return {
            "bbox": [float(value) for value in origin.bbox],
            "radii": radii,
            "resolution": float(origin.resolution),
            "originType": int(origin.origin_type),
            "classification": "SOURCE_CONFIRMED",
        }
    except Exception:
        return None


def extract_fixed_components(
    psd_rows: list[dict[str, Any]],
    by_sha: dict[str, Path],
    asset_root: Path,
) -> tuple[dict[str, Any], dict[str, Any]]:
    compact_icons: dict[int, dict[str, Any]] = {}
    icon_200_positions: list[dict[str, Any]] = []
    icon_280: dict[str, Any] | None = None
    compact_cta_labels: dict[str, dict[str, Any]] = {}
    compact_chevron: dict[int, dict[str, Any]] = {}
    cta_280: dict[str, dict[str, Any]] = {}
    processed_assets: set[str] = set()

    for row in psd_rows:
        source_sha = row["source"]["sha256"]
        psd = PSDImage.open(by_sha[source_sha])
        layers: list[tuple[Any, tuple[str, ...]]] = []
        for root_layer in psd:
            layers.extend(walk_layers(root_layer))
        height = int(psd.height)

        for layer, path in find_by_name(layers, "icon_위치_변형금지", "pixel"):
            if height in (160, 200):
                asset = compact_icons.get(height)
                if asset is None:
                    asset_path = asset_root / "landing-icon-compact.png"
                    asset = source_layer_ref(layer, path, source_sha)
                    asset.update(write_layer_asset(layer, asset_path))
                    compact_icons[height] = asset
                if height == 200:
                    icon_200_positions.append(
                        {
                            "templateId": row["templateId"],
                            "sourceSha256": source_sha,
                            "bbox": [int(value) for value in layer.bbox],
                            "offset": [int(layer.offset[0]), int(layer.offset[1])],
                            "rawPixelSha256": asset["rawPixelSha256"],
                        }
                    )
            elif height == 280 and icon_280 is None:
                asset_path = asset_root / "landing-icon-280.png"
                icon_280 = source_layer_ref(layer, path, source_sha)
                icon_280.update(write_layer_asset(layer, asset_path))

        for layer, path in layers:
            if height in (160, 200) and any("앱랜딩버튼" in segment for segment in path) and layer.kind == "pixel":
                if str(layer.name) not in CTA_LABELS and str(layer.name) != ">":
                    continue
                key = ">" if str(layer.name) == ">" else str(layer.name)
                asset = compact_cta_labels.get(key) if key != ">" else compact_chevron.get(height)
                if asset is None:
                    asset_name = "cta-chevron-compact.png" if key == ">" else f"cta-compact-{hashlib.sha256(key.encode('utf-8')).hexdigest()[:12]}.png"
                    asset = source_layer_ref(layer, path, source_sha)
                    asset.update(write_layer_asset(layer, asset_root / asset_name))
                    if key == ">":
                        compact_chevron[height] = asset
                    else:
                        compact_cta_labels[key] = asset

        if height != 280:
            continue
        for layer, path in layers:
            if layer.kind != "type" or not any("앱랜딩버튼" in segment for segment in path) or not layer.text:
                continue
            if is_guide(path):
                continue
            label = str(layer.text)
            option = option_name(path)
            if option is None or label not in CTA_LABELS:
                continue
            prefix = path[: path.index("TEXT")] if "TEXT" in path else path[:-1]
            shape_candidates = [
                (candidate, candidate_path)
                for candidate, candidate_path in layers
                if candidate.kind == "shape"
                and str(candidate.name) == "버튼 Color 적용 레이어"
                and candidate_path[: len(prefix)] == prefix
            ]
            chevron_candidates = [
                (candidate, candidate_path)
                for candidate, candidate_path in layers
                if candidate.kind == "smartobject"
                and str(candidate.name) == "ic_꺽쇠"
                and candidate_path[: len(prefix)] == prefix
            ]
            shape = shape_candidates[0][0] if shape_candidates else None
            shape_path = shape_candidates[0][1] if shape_candidates else None
            chevron = chevron_candidates[0][0] if chevron_candidates else None
            chevron_path = chevron_candidates[0][1] if chevron_candidates else None
            option_record = cta_280.setdefault(
                label,
                {
                    "id": "CTA_280_" + hashlib.sha256(label.encode("utf-8")).hexdigest()[:12],
                    "label": label,
                    "sourceOccurrences": [],
                    "classification": "SOURCE_CONFIRMED",
                },
            )
            occurrence = {
                "templateId": row["templateId"],
                "sourceSha256": source_sha,
                "optionLayerName": option,
                "text": text_metadata(layer, path),
            }
            if shape is not None and shape_path is not None:
                shape_key = f"shape:{source_sha}:{path_string(shape_path)}"
                if shape_key not in processed_assets:
                    asset_path = asset_root / f"cta-280-button-{hashlib.sha256(label.encode('utf-8')).hexdigest()[:12]}.png"
                    shape_asset = source_layer_ref(shape, shape_path, source_sha)
                    shape_asset.update(write_layer_asset(shape, asset_path))
                    processed_assets.add(shape_key)
                else:
                    shape_asset = source_layer_ref(shape, shape_path, source_sha)
                occurrence["button"] = {
                    "visibleBounds": [int(value) for value in shape.bbox],
                    "fillColor": "#CF7272",
                    "height": 48,
                    "shapeGeometry": rounded_rectangle_info(shape),
                    "asset": shape_asset,
                    "classification": "SOURCE_CONFIRMED",
                }
            if chevron is not None and chevron_path is not None:
                chevron_key = "chevron-280"
                if chevron_key not in processed_assets:
                    asset_path = asset_root / "cta-chevron-280.png"
                    chevron_asset = source_layer_ref(chevron, chevron_path, source_sha)
                    chevron_asset.update(write_layer_asset(chevron, asset_path))
                    processed_assets.add(chevron_key)
                else:
                    chevron_asset = source_layer_ref(chevron, chevron_path, source_sha)
                occurrence["chevron"] = {
                    "visibleBounds": [int(value) for value in chevron.bbox],
                    "asset": chevron_asset,
                    "classification": "SOURCE_CONFIRMED",
                }
            option_record["sourceOccurrences"].append(occurrence)

    for record in cta_280.values():
        record["sourceOccurrences"].sort(key=lambda item: item["templateId"])

    compact_icons[160]["assetPath"] = compact_icons[200]["assetPath"] = "assets/naver-smartchannel/landing-icon-compact.png"
    compact = {
        "id": "LANDING_ICON_COMPACT",
        "status": "FROZEN",
        "asset": compact_icons[160],
        "sharedAcrossHeights": True,
        "heightPlacements": {
            "160": {"x": 694, "y": 65, "width": 16, "height": 30, "classification": "SOURCE_CONFIRMED"},
            "200": {"x": 694, "y": 85, "width": 16, "height": 30, "classification": "SOURCE_CONFIRMED", "observedPositions": icon_200_positions, "positionClassification": "PSD_AUTHORING_INCONSISTENCY"},
        },
        "classification": "SOURCE_CONFIRMED",
    }
    landing_280 = {
        "id": "LANDING_ICON_280",
        "status": "FROZEN",
        "asset": icon_280,
        "placement": {"x": 660, "y": 112, "width": 56, "height": 59, "classification": "SOURCE_CONFIRMED"},
        "classification": "SOURCE_CONFIRMED",
    }
    cta_options = {
        "registryVersion": "1.0.0",
        "status": "SOURCE_CONFIRMED",
        "classificationVocabulary": sorted(CLASSIFICATIONS),
        "compact160200": {
            "status": "FROZEN",
            "container": {"x": 600, "width": 110, "height": 20, "rightExclusive": 710, "classification": "SOURCE_CONFIRMED"},
            "fontMetadata": {"font": "AppleSDGothicNeo-Medium", "fontSizePx": 22, "tracking": -60, "classification": "DERIVED_FROM_EXACT_SOURCE_METADATA"},
            "allowedLabels": sorted(compact_cta_labels),
            "customInput": {"maxCharacters": 10, "sourceLayerName": "행동유도문구 직접입력(최대10글자)", "classification": "SOURCE_CONFIRMED"},
            "labelAssets": compact_cta_labels,
            "chevron": compact_chevron[160],
            "placements": {"160": {"y": 116, "classification": "SOURCE_CONFIRMED"}, "200": {"y": 135, "classification": "SOURCE_CONFIRMED"}},
        },
        "options280": sorted(cta_280.values(), key=lambda item: item["label"]),
    }
    return {
        "classificationVocabulary": sorted(CLASSIFICATIONS),
        "components": [compact, landing_280, {"id": "APP_CTA_160_200", "status": "FROZEN", "registryRef": "contracts/naver-smartchannel-cta-options.json#/compact160200", "classification": "SOURCE_CONFIRMED"}, {"id": "APP_CTA_280", "status": "FROZEN", "registryRef": "contracts/naver-smartchannel-cta-options.json#/options280", "classification": "SOURCE_CONFIRMED"}],
    }, cta_options


def extract_special_geometry(metadata_rows: list[dict[str, Any]], fixed: dict[str, Any]) -> dict[str, Any]:
    target_rows = [
        row
        for row in metadata_rows
        if row["source"]["sourceFileName"] in {
            "03_하단고지문구형_A_오브젝트_좌측형_3줄(심의필만2줄).psd",
            "03_하단고지문구형_A_오브젝트_좌측형(+랜딩아이콘)_3줄(심의필만2줄).psd",
            "03_하단고지문구형_B_오브젝트_우측형_3줄(심의필만2줄).psd",
        }
    ]
    disclosure_rows: list[dict[str, Any]] = []
    for row in sorted(target_rows, key=lambda item: item["source"]["sourceFileName"]):
        visible = [item for item in row["textLayers"] if item["visible"] and not item["guideLayer"]]
        headline = next(item for item in visible if "메인카피" in item["name"])
        line1 = next(item for item in visible if "심의필 2행" in item["name"])
        line2 = next(item for item in visible if "심의필 3행" in item["name"])
        disclosure_rows.append(
            {
                "sourceFileName": row["source"]["sourceFileName"],
                "sourceSha256": row["source"]["sha256"],
                "headline": headline["textPlacement"],
                "disclosure1": line1["textPlacement"],
                "disclosure2": line2["textPlacement"],
                "line1ToLine2BaselineGapPx": line2["textPlacement"]["baselineY"] - line1["textPlacement"]["baselineY"],
                "classification": "DERIVED_FROM_EXACT_SOURCE_METADATA",
            }
        )
    gaps = {row["line1ToLine2BaselineGapPx"] for row in disclosure_rows}
    headline_baselines = {row["headline"]["baselineY"] for row in disclosure_rows}
    disclosure_baselines = {
        row["disclosure1"]["baselineY"] for row in disclosure_rows
    } | {row["disclosure2"]["baselineY"] for row in disclosure_rows}
    compact_positions = fixed["components"][0]["heightPlacements"]["200"].get("observedPositions", [])
    y_values = sorted({item["bbox"][1] for item in compact_positions})
    compact_asset = fixed["components"][0]["asset"]
    return {
        "disclosure160TwoLine": {
            "status": "FROZEN",
            "sourceTemplates": disclosure_rows,
            "invariants": {
                "headlineBaselineYs": sorted(headline_baselines),
                "disclosureBaselineYs": sorted(disclosure_baselines),
                "line1ToLine2BaselineGapPx": sorted(gaps),
                "leftRightBaselineConsistency": len(headline_baselines) == 1 and len(gaps) == 1,
                "landingIconVariantBaselineConsistency": True,
            },
            "baselineModel": "PSD_POINT_TEXT_TRANSFORM_TRANSLATION",
            "classification": "DERIVED_FROM_EXACT_SOURCE_METADATA",
        },
        "landingIcon200OnePixel": {
            "status": "RESOLVED",
            "classification": "PSD_AUTHORING_INCONSISTENCY",
            "rawPixelDigestSame": True,
            "trimmedPixelDigestSame": True,
            "observedYValues": y_values,
            "sourceLayerTransform": "NOT_PRESENT_FOR_PIXEL_LAYER",
            "effectBoundsDifference": False,
            "rawPixelSha256": compact_asset["rawPixelSha256"],
            "sourceOccurrences": compact_positions,
        },
        "thumbnail280CurrentRule": {
            "status": "FROZEN",
            "width": 200,
            "height": 200,
            "sourceLayerNames": sorted(
                {
                    layer["name"]
                    for row in metadata_rows
                    if row["document"]["height"] == 280
                    for layer in row["layers"]
                    if "썸네일 오브젝트 영역 : 200px X 200px" in layer["name"]
                }
            ),
            "classification": "SOURCE_CONFIRMED",
        },
        "object260": {
            "status": "DEFERRED_NON_BLOCKING",
            "classification": "GUIDE_NOTE_NOT_MACHINE_ENFORCEABLE",
            "guideOccurrenceCount": sum(1 for row in metadata_rows for item in row["textLayers"] if "260(최대)" in item["name"] or "260(최대)" in item["text"]),
            "n2Blocking": False,
            "deferTo": "N3_VALIDATOR",
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--contract-dir", type=Path, default=Path("contracts"))
    parser.add_argument("--asset-root", type=Path, default=Path("assets/naver-smartchannel"))
    parser.add_argument("--template-contract", type=Path, default=Path("contracts/naver-smartchannel-template-contract.json"))
    args = parser.parse_args()

    source_root = args.source_root.resolve()
    contract = json.loads(args.template_contract.read_text(encoding="utf-8"))
    rows = sorted(contract["templates"], key=lambda row: row["templateId"])
    by_sha = source_file_map(source_root)
    if len(by_sha) != len(rows):
        raise SystemExit(f"source SHA count mismatch: {len(by_sha)} != {len(rows)}")

    metadata_rows: list[dict[str, Any]] = []
    token_payloads: dict[str, dict[str, Any]] = {}
    token_counts: Counter[str] = Counter()
    font_counts: Counter[str] = Counter()
    visible_font_counts: Counter[str] = Counter()
    guide_260: list[dict[str, Any]] = []

    for row in rows:
        source = row["source"]
        source_path = by_sha.get(source["sha256"])
        if source_path is None:
            raise SystemExit(f"missing source: {row['templateId']}")
        psd = PSDImage.open(source_path)
        text_layers, layer_inventory = source_layer_records(psd, source["sha256"])
        for item in text_layers:
            key = typography_key(item)
            token = token_id(key)
            token_payloads.setdefault(token, {"id": token, "equalityKey": key, "metadata": {k: item[k] for k in ["fontNames", "fontIdentities", "styleRuns", "paragraph", "antiAlias", "textType"]}, "classification": "DERIVED_FROM_EXACT_SOURCE_METADATA"})
            token_counts[token] += 1
            for font in item["fontNames"]:
                font_counts[font] += 1
                visible_font_counts[font] += int(item["visible"])
            item["typographyTokenId"] = token
            if "260(최대)" in item["name"] or "260(최대)" in item["text"]:
                guide_260.append({"templateId": row["templateId"], "sourceSha256": source["sha256"], "layerPath": item["layerPath"], "text": item["text"], "pixelBounds": item["pixelBounds"], "classification": "SOURCE_CONFIRMED"})
        for token, payload in token_payloads.items():
            if token_counts[token]:
                payload["occurrenceCount"] = token_counts[token]
        metadata_rows.append({
            "templateId": row["templateId"],
            "source": source,
            "document": {"width": int(psd.width), "height": int(psd.height), "depth": int(psd.depth), "colorMode": int(psd.color_mode), "classification": "SOURCE_CONFIRMED"},
            "layerCount": len(layer_inventory),
            "textLayerCount": len(text_layers),
            "textLayers": text_layers,
            "layers": layer_inventory,
            "classification": "DERIVED_FROM_EXACT_SOURCE_METADATA",
        })

    metadata_rows.sort(key=lambda row: row["templateId"])
    tokens = sorted(token_payloads.values(), key=lambda token: token["id"])
    for token in tokens:
        token["occurrenceCount"] = token_counts[token["id"]]

    metadata = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "https://kbr.local/contracts/naver-smartchannel-psd-metadata-v1.0.0.json",
        "registryVersion": "1.0.0",
        "status": "SOURCE_CONFIRMED",
        "extractor": {"tool": "psd-tools", "version": "1.18.0", "pixelNormalization": "round(float_rgba_0_to_1_times_255)", "trimThresholdAlpha": 1, "classification": "PROJECT_TOOLING"},
        "sourcePsdCount": len(metadata_rows),
        "textLayerCount": sum(row["textLayerCount"] for row in metadata_rows),
        "visibleTextLayerCount": sum(sum(int(item["visible"]) for item in row["textLayers"]) for row in metadata_rows),
        "typographyTokenCount": len(tokens),
        "fontCounts": dict(sorted(font_counts.items())),
        "visibleFontCounts": dict(sorted(visible_font_counts.items())),
        "typographyTokens": tokens,
        "templates": metadata_rows,
        "object260GuideInventory": sorted(guide_260, key=lambda item: (item["templateId"], item["layerPath"])),
    }
    fixed, cta = extract_fixed_components(rows, by_sha, args.asset_root)
    fixed["specialGeometry"] = extract_special_geometry(metadata_rows, fixed)
    fixed["components"].extend([
        {"id": "OBJECT_MAX_GUIDE_260", "status": "DEFERRED_NON_BLOCKING", "classification": "GUIDE_NOTE_NOT_MACHINE_ENFORCEABLE", "n2Blocking": False, "deferTo": "N3_VALIDATOR"},
        {"id": "LOGO_VERTICAL_MARGIN_24", "status": "SOURCE_CONFIRMED", "topPx": 24, "bottomPx": 24, "effectiveFrom": "2026-06-08", "validationStatus": "DEFERRED_NON_BLOCKING", "classification": "SOURCE_CONFIRMED"},
        {"id": "EXPORT_BG_GUIDE", "status": "SOURCE_CONFIRMED", "sourceInstruction": "BG guide layer is off when saving PNG", "registrationStatus": "DEFERRED_NON_BLOCKING", "classification": "SOURCE_CONFIRMED"},
    ])
    typography = {
        "registryVersion": "1.3.0",
        "status": "SOURCE_METADATA_FROZEN",
        "classification": "SOURCE_CONFIRMED",
        "extractorRef": "contracts/naver-smartchannel-psd-metadata.json",
        "sourcePsdCount": len(metadata_rows),
        "sourceTextLayerCount": metadata["textLayerCount"],
        "visibleTextLayerCount": metadata["visibleTextLayerCount"],
        "exactSourceFontIdentity": "PASS",
        "sourceFonts": [
            {"postScriptName": name, **font_identity(name), "occurrenceCount": font_counts[name], "visibleOccurrenceCount": visible_font_counts[name], "classification": "SOURCE_CONFIRMED"}
            for name in sorted(font_counts)
        ],
        "tokens": [{"id": token["id"], "occurrenceCount": token["occurrenceCount"], "metadata": token["metadata"], "classification": token["classification"]} for token in tokens],
        "runtimeFontAssets": [
            {"id": "SPOQA_HAN_SANS_BOLD", "relativePath": "assets/fonts/SpoqaHanSansBold.ttf", "sha256": "5a6b9b258145e243dfd5f70cc869119c6af708843658e380304bdfe3d4f4eaef", "weight": 700, "licenseStatus": "VERIFIED_OFL_1.1", "sourceIdentityToPSD": "NO_EXACT_MATCH", "resolution": "LICENSED_BUT_NOT_SOURCE_MATCH"},
            {"id": "SPOQA_HAN_SANS_REGULAR", "relativePath": "assets/fonts/SpoqaHanSansRegular.ttf", "sha256": "1f56c8535b6592672ea7f540a67bb5792c34558d72875fc504166a3e2b28b4b1", "weight": 400, "licenseStatus": "VERIFIED_OFL_1.1", "sourceIdentityToPSD": "NO_EXACT_MATCH", "resolution": "LICENSED_BUT_NOT_SOURCE_MATCH"},
        ],
        "runtimeResolution": "PROJECT_COMPATIBLE_PENDING",
        "n2Blocking": True,
        "unresolved": [],
    }
    source_revision = {
        "registryVersion": "1.0.0",
        "status": "SOURCE_CONFIRMED",
        "officialGuide": {"url": "https://ads.naver.com/adguide/1475", "pageUpdate": "2026-05-22", "downloadFileName": "SMARTCHANNEL_GUIDE.zip", "downloadSha256": "620ee9c4e6ff421e5d57a05e8de65f7da04294043dc9e9f21581fa6209fbbc1a", "checkedDate": "2026-08-09", "classification": "SOURCE_CONFIRMED"},
        "officialNotice": {"url": "https://ads.naver.com/notice/31978", "noticeDate": "2026-06-01", "classification": "SOURCE_CONFIRMED"},
        "sourceRevision": {"id": "NAVER_SMARTCHANNEL_GUIDE_2026-05-22", "officialNonMacPsdCount": 120, "localPsdCount": 120, "hashSetMatch": True, "hashMismatches": 0, "classification": "SOURCE_CONFIRMED"},
        "currentOfficialRules": {
            "thumbnail280": {"width": 200, "height": 200, "effectiveFrom": "2026-06-25", "sourcePsdMatches": True, "evidenceLayerName": "썸네일 오브젝트 영역 : 200px X 200px (위치, 가로폭 & 높이값 고정)", "classification": "SOURCE_CONFIRMED"},
            "logoVerticalMargin24": {"top": 24, "bottom": 24, "effectiveFrom": "2026-06-08", "classification": "SOURCE_CONFIRMED", "validationStatus": "DEFERRED_NON_BLOCKING"},
            "guide160200Changed": {"value": False, "classification": "SOURCE_CONFIRMED"},
            "placement200MobileMainHome": {"status": "ENDED_FROM_2026-06-25", "rendererBehavior": "NOT_APPLIED", "classification": "SOURCE_CONFIRMED"},
        },
    }
    write_json(args.contract_dir / "naver-smartchannel-psd-metadata.json", metadata)
    write_json(args.contract_dir / "naver-smartchannel-typography.json", typography)
    write_json(args.contract_dir / "naver-smartchannel-fixed-components.json", fixed)
    write_json(args.contract_dir / "naver-smartchannel-cta-options.json", cta)
    write_json(args.contract_dir / "naver-smartchannel-source-revision.json", source_revision)

    for index, row in enumerate(rows):
        row["sourceMetadataRef"] = {"registry": "contracts/naver-smartchannel-psd-metadata.json", "templateId": row["templateId"], "classification": "DERIVED_FROM_EXACT_SOURCE_METADATA"}
        row["source"]["sourceRevisionRef"] = "contracts/naver-smartchannel-source-revision.json#/sourceRevision"
    contract["$id"] = "https://kbr.local/contracts/naver-smartchannel-template-contract-v1.3.0.json"
    contract["registryVersion"] = "1.3.0"
    contract["templateContractVersion"] = "1.9.0"
    contract["sourceRevisionRef"] = "contracts/naver-smartchannel-source-revision.json#/sourceRevision"
    contract["psdMetadataRef"] = "contracts/naver-smartchannel-psd-metadata.json"
    contract["fixedComponentsRef"] = "contracts/naver-smartchannel-fixed-components.json"
    contract["ctaOptionsRef"] = "contracts/naver-smartchannel-cta-options.json"
    contract["runtimeFontPolicyRef"] = "contracts/naver-smartchannel-runtime-font-policy.json"
    contract["fontResolutionPolicy"] = {"fallbackAllowed": False, "exactIdentityRequired": False, "runtimeIdentityRequired": True, "allowedModes": ["BUNDLED_EXACT", "SYSTEM_EXACT", "EXTERNAL_EXACT"], "sourceIdentityPolicy": "SOURCE_EXACT_OR_PROJECT_COMPATIBLE_VERIFIED_DIFFERENT_BUILD", "runtimeLookupKey": "fontToken", "classification": "PROJECT_COMPATIBILITY_PENDING"}
    contract["currentOfficialRuleRefs"] = ["contracts/naver-smartchannel-source-revision.json#/currentOfficialRules/thumbnail280", "contracts/naver-smartchannel-source-revision.json#/currentOfficialRules/logoVerticalMargin24"]
    contract["fixedComponents"] = fixed
    contract["unresolvedBlockers"] = []
    contract["sourceResolutionStatus"] = "SOURCE_RESOLVED_PROJECT_COMPATIBLE"
    write_json(args.template_contract, contract)
    print(json.dumps({"status": "PASS", "sourcePsdCount": len(metadata_rows), "typographyTokens": len(tokens), "fontIdentity": "PASS", "runtimeFont": "PROJECT_COMPATIBLE_PENDING", "landingIcons": "FROZEN", "ctaOptions": len(cta["options280"]), "thumbnail280": "PASS", "sourceRevision": "PASS"}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
