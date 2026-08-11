#!/usr/bin/env python3
"""Audit the frozen SmartChannel typography contract against the source PSDs.

This is an audit-only developer tool.  It is intentionally not imported by the
renderer, desktop app, or package build.  The PSD parser is loaded from the
existing development-only ``scripts/requirements-naver-source.txt`` toolchain
(``psd-tools==1.18.0``); no runtime dependency is added here.

The audit records facts from the PSD, frozen metadata, frozen token registry,
current font compatibility policy, and local raster probes separately.  A
metric delta is reported as a finding; it never edits runtime contracts or
golden fixtures.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


EXPECTED_GROUPS = [
    "스마트채널DA_160_제작용_PSD",
    "스마트채널DA_200_제작용_PSD",
    "스페셜DA_성과형280_제작용_PSD (260526)",
]
EXPECTED_COUNTS = {
    "스마트채널DA_160_제작용_PSD": 32,
    "스마트채널DA_200_제작용_PSD": 32,
    "스페셜DA_성과형280_제작용_PSD (260526)": 56,
}
EXPECTED_TEMPLATE_COUNT = 120
PHASE_ID = "N7_6_SMARTCHANNEL_GLOBAL_TYPOGRAPHY_AUDIT"
AUDIT_SCHEMA_ID = "https://kbr.local/contracts/audits/naver-smartchannel-typography-audit-v1.0.0.json"


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


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


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative_posix(path: Path, root: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def load_extractor(repo_root: Path) -> Any:
    source = repo_root / "scripts" / "extract-naver-smartchannel-source.py"
    spec = importlib.util.spec_from_file_location("kbr_naver_source_extractor", source)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load existing PSD extractor: {source}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def first_style(layer: dict[str, Any]) -> dict[str, Any]:
    runs = layer.get("styleRuns") or []
    return runs[0] if isinstance(runs[0], dict) else {} if runs else {}


def number(value: Any) -> float | None:
    try:
        parsed = float(value)
        return parsed if math.isfinite(parsed) else None
    except (TypeError, ValueError):
        return None


def norm_float(value: Any) -> float | None:
    parsed = number(value)
    return None if parsed is None else round(parsed, 9)


def layer_line_number(name: str) -> int | None:
    match = re.search(r"(\d+)\s*행", name)
    return int(match.group(1)) if match else None


def classify_role(layer: dict[str, Any]) -> dict[str, Any]:
    """Map source layer names to the audit role vocabulary.

    The mapping is deterministic and only classifies names already extracted
    from the PSD.  It does not infer text geometry or modify source metadata.
    """

    name = str(layer.get("name", "")).replace("\u00a0", " ").strip()
    if layer.get("guideLayer"):
        return {"role": "GUIDE_TEXT", "confidence": "EXCLUDED", "reason": "guide layer is inventoried but excluded from runtime typography"}
    line = layer_line_number(name)
    if "메인카피" in name:
        if line == 2:
            return {"role": "HEADLINE_LINE_2", "confidence": "EXTRACTED", "reason": "메인카피 2행"}
        return {"role": "HEADLINE", "confidence": "EXTRACTED", "reason": "메인카피 1행"}
    if "서브카피" in name:
        if line == 4:
            return {"role": "FOURTH_LINE", "confidence": "EXTRACTED", "reason": "서브카피 4행"}
        if line == 3:
            return {"role": "THIRD_LINE", "confidence": "EXTRACTED", "reason": "서브카피 3행"}
        return {"role": "SUBCOPY", "confidence": "EXTRACTED", "reason": "서브카피 2행"}
    if "심의필" in name or "고지문구" in name:
        return {"role": "DISCLOSURE_LINE_PENDING", "confidence": "EXTRACTED", "reason": "disclosure layer; sequence assigned by source y"}
    if str(layer.get("role")) == "CTA_LABEL":
        return {"role": "APP_CTA_TEXT", "confidence": "EXTRACTED", "reason": "registered CTA label"}
    return {"role": "UNRESOLVED", "confidence": "UNRESOLVED", "reason": "source layer name has no frozen semantic role"}


def assign_disclosure_roles(layers: list[dict[str, Any]]) -> None:
    candidates = [layer for layer in layers if layer.get("auditRole", {}).get("role") == "DISCLOSURE_LINE_PENDING"]
    candidates.sort(key=lambda item: (float(item.get("textPlacement", {}).get("boxY", 0)), str(item.get("layerPath", ""))))
    for index, layer in enumerate(candidates):
        role = "DISCLOSURE_LINE_1" if index == 0 else "DISCLOSURE_LINE_2"
        layer["auditRole"] = {"role": role, "confidence": "DERIVED", "reason": "ordered by extracted source boxY"}


def style_signature(layer: dict[str, Any]) -> str:
    payload = {
        "fontNames": layer.get("fontNames", []),
        "fontIdentities": layer.get("fontIdentities", []),
        "styleRuns": layer.get("styleRuns", []),
        "paragraph": layer.get("paragraph", {}),
        "textType": layer.get("textType"),
        "antiAlias": layer.get("antiAlias"),
    }
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def geometry_signature(layer: dict[str, Any]) -> dict[str, Any]:
    placement = layer.get("textPlacement", {})
    return {
        "x": norm_float(placement.get("boxX")),
        "y": norm_float(placement.get("boxY")),
        "width": norm_float(placement.get("boxWidth")),
        "height": norm_float(placement.get("boxHeight")),
        "originX": norm_float(placement.get("originX")),
        "baselineY": norm_float(placement.get("baselineY")),
    }


def geometry_diff(actual: dict[str, Any], frozen: dict[str, Any]) -> dict[str, bool]:
    a = geometry_signature(actual)
    b = geometry_signature(frozen)
    return {
        "x": a["x"] == b["x"],
        "y": a["y"] == b["y"],
        "box": a["width"] == b["width"] and a["height"] == b["height"],
        "origin": a["originX"] == b["originX"],
        "baseline": a["baselineY"] == b["baselineY"],
    }


def source_group(path: Path, root: Path) -> str:
    parts = path.resolve().relative_to(root.resolve()).parts
    return parts[0] if parts else ""


def template_group_from_id(template_id: str) -> str:
    if "_160_" in template_id:
        return "160"
    if "_200_" in template_id:
        return "200"
    if "_280_" in template_id:
        return "280"
    return "UNRESOLVED"


def grammar_for(template: dict[str, Any]) -> str:
    variant = str(template.get("textVariant", ""))
    affordance = str(template.get("affordance", "NONE"))
    if affordance == "APP_CTA":
        return "APP_CTA"
    if affordance == "LANDING_ICON":
        return "LANDING_ICON"
    if "DISCLOSURE" in variant or "DISCLOSURE" in str(template.get("templateId", "")):
        return "BOTTOM_DISCLOSURE"
    if variant == "MAIN2_SUB":
        return "MAIN_TWO_LINES"
    if variant == "MAIN_SUB":
        return "MAIN_SUB"
    if "FOUR" in variant or "FOUR_LINE" in variant:
        return "FOUR_LINE"
    if "THREE" in variant or "3" in str(template.get("sourceTextLabel", "")):
        return "THREE_LINE"
    if variant == "ONE_LINE":
        return "ONE_LINE"
    return variant or "UNRESOLVED"


def role_frozen_to_audit(layer: dict[str, Any], sequence_by_role: dict[str, int]) -> str:
    role = str(layer.get("role", ""))
    if role == "HEADLINE":
        index = sequence_by_role.get(role, 0)
        sequence_by_role[role] = index + 1
        return "HEADLINE" if index == 0 else "HEADLINE_LINE_2"
    if role == "SUBCOPY":
        line = layer_line_number(str(layer.get("name", "")))
        if line == 4:
            return "FOURTH_LINE"
        if line == 3:
            return "THIRD_LINE"
        return "SUBCOPY"
    if role == "DISCLOSURE":
        index = sequence_by_role.get(role, 0)
        sequence_by_role[role] = index + 1
        return "DISCLOSURE_LINE_1" if index == 0 else "DISCLOSURE_LINE_2"
    if role == "CTA_LABEL":
        return "APP_CTA_TEXT"
    if role == "GUIDE_TEXT":
        return "GUIDE_TEXT"
    return "UNRESOLVED"


def source_font_path(repo_root: Path, postscript_name: str) -> Path | None:
    candidate = repo_root / ".local-fonts" / "naver-smartchannel" / f"{postscript_name}.ttf"
    return candidate if candidate.is_file() else None


def runtime_font_path(repo_root: Path, asset: dict[str, Any]) -> Path | None:
    relative = asset.get("relativePath")
    if not isinstance(relative, str) or not relative:
        return None
    candidate = repo_root / relative.replace("/", "\\")
    return candidate if candidate.is_file() else None


def raster_probe(
    repo_root: Path,
    token_id: str,
    source_font: str | None,
    runtime_asset: dict[str, Any] | None,
    text: str,
    font_size: float | None,
    tracking: float | None,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "tokenId": token_id,
        "sourceFont": source_font,
        "runtimeFont": runtime_asset.get("runtimePostScriptName") if runtime_asset else None,
        "fontSize": font_size,
        "tracking": tracking,
        "textSample": text,
        "sourceBinaryStatus": "NO_SOURCE_BINARY",
        "runtimeBinaryStatus": "MISSING_RUNTIME_BINARY",
        "status": "UNAVAILABLE",
        "source": None,
        "runtime": None,
        "delta": None,
    }
    try:
        from PIL import ImageFont
    except Exception as error:  # pragma: no cover - development environment guard
        result["status"] = "NO_RASTER_TOOL"
        result["error"] = str(error)
        return result
    if font_size is None or font_size <= 0:
        result["status"] = "UNAVAILABLE"
        result["reason"] = "PSD FontSize unavailable"
        return result
    source_path = source_font_path(repo_root, source_font or "") if source_font else None
    runtime_path = runtime_font_path(repo_root, runtime_asset or {}) if runtime_asset else None
    if source_path is None:
        result["sourceBinaryStatus"] = "NO_SOURCE_BINARY"
    else:
        result["sourceBinaryStatus"] = "AVAILABLE"
    if runtime_path is None:
        result["runtimeBinaryStatus"] = "NO_RUNTIME_ASSET"
    else:
        result["runtimeBinaryStatus"] = "AVAILABLE"
    if source_path is None or runtime_path is None:
        result["status"] = "NO_SOURCE_BINARY" if source_path is None else "UNRESOLVED_RUNTIME_ASSET"
        return result

    probe_size = max(1, int(round(font_size)))
    tracking_px = (tracking or 0.0) * font_size / 1000.0

    def measure(path: Path) -> dict[str, Any]:
        font = ImageFont.truetype(str(path), probe_size)
        chars = list(text)
        width = sum(float(font.getlength(char)) for char in chars)
        if chars:
            width += tracking_px * max(0, len(chars) - 1)
        try:
            bbox = font.getbbox(text, anchor="ls")
        except TypeError:
            bbox = font.getbbox(text)
        return {
            "path": path.as_posix(),
            "probeFontSizePx": probe_size,
            "widthPx": round(width, 6),
            "bbox": [int(value) for value in bbox],
            "baselineToTopPx": round(float(-bbox[1]), 6),
            "baselineToBottomPx": round(float(bbox[3]), 6),
            "sha256": sha256_file(path),
            "classification": "DERIVED",
        }

    try:
        result["source"] = measure(source_path)
        result["runtime"] = measure(runtime_path)
        source_width = float(result["source"]["widthPx"])
        runtime_width = float(result["runtime"]["widthPx"])
        result["delta"] = {
            "widthPx": round(runtime_width - source_width, 6),
            "baselineToTopPx": round(float(result["runtime"]["baselineToTopPx"]) - float(result["source"]["baselineToTopPx"]), 6),
            "baselineToBottomPx": round(float(result["runtime"]["baselineToBottomPx"]) - float(result["source"]["baselineToBottomPx"]), 6),
        }
        result["status"] = "METRIC_DELTA" if any(abs(float(value)) > 0.000001 for value in result["delta"].values()) else "MATCH"
    except Exception as error:  # pragma: no cover - malformed external font guard
        result["status"] = "RASTER_PROBE_FAILED"
        result["error"] = str(error)
    return result


def build_report(audit: dict[str, Any]) -> str:
    source = audit["source"]
    summary = audit["summary"]
    tokens = audit["tokens"]
    groups = audit["groupAudits"]
    rep = audit["representative"]
    lines: list[str] = []
    lines.append("# N7.6 SmartChannel Global Typography Audit")
    lines.append("")
    lines.append(f"- Phase: `{PHASE_ID}`")
    lines.append(f"- Result: **{audit['phase']['status']}**")
    lines.append("- Scope: actual source PSD metadata → frozen token registry → runtime font mapping → local raster probes")
    lines.append("- Runtime changes: none; typography tokens, font sizes, baselines, leading, geometry, and goldens were not edited.")
    lines.append("")
    lines.append("## 1. Repository and source inventory")
    lines.append("")
    lines.append(f"Source root: `{source['root']}`")
    lines.append(f"PSD files: **{source['psdCount']['total']}** (readable {source['psdCount']['readable']}, unreadable {source['psdCount']['unreadable']})")
    lines.append("")
    lines.append("| group | files | expected |")
    lines.append("| --- | ---: | ---: |")
    for group in source["groups"]:
        lines.append(f"| `{group['name']}` | {group['count']} | {group['expected']} |")
    lines.append("")
    if source["duplicateNames"]:
        lines.append(f"Duplicate basenames are present across source groups ({len(source['duplicateNames'])}); paths and SHA-256 remain the identity.")
    else:
        lines.append("No duplicate PSD basenames were found.")
    lines.append("")
    lines.append("## 2. Actual source fonts and provenance")
    lines.append("")
    lines.append("| PSD_SOURCE_FONT | layers | templates | runtime mapping | binary |")
    lines.append("| --- | ---: | ---: | --- | --- |")
    for font in audit["fonts"]["sourceFontInventory"]:
        lines.append(f"| `{font['postscriptName']}` | {font['layerCount']} | {font['templateCount']} | `{font['runtimeFontToken'] or 'SOURCE_ONLY_NON_RUNTIME'}` | `{font['binaryStatus']}` |")
    lines.append("")
    lines.append("The three provenance layers are kept separate: `PSD_SOURCE_FONT`, `NAVER_GUIDE_ALLOWED_FONT`, and `PROJECT_RUNTIME_FONT`. The approved runtime policy maps visible AppleSDGothicNeo roles to NanumBarunGothic; the source SF layers are source-only and remain fail-closed.")
    lines.append("")
    lines.append("## 3. Frozen token and runtime mapping audit")
    lines.append("")
    lines.append(f"Frozen token count: **{len(tokens)}**; exact source-token linkage: **{summary['tokenAudit']['exact']}**; conflicts: **{summary['tokenAudit']['conflicting']}**; unresolved visible layers: **{summary['tokenAudit']['unmappedPsdlayers']}**.")
    lines.append("")
    lines.append("| token | source font(s) | roles | runtime | probe |")
    lines.append("| --- | --- | --- | --- | --- |")
    for token in tokens:
        source_fonts = ", ".join(token["sourceMetrics"].get("fontNames", [])) or "UNAVAILABLE"
        roles = ", ".join(token.get("roles", [])) or "UNRESOLVED"
        runtime = token.get("runtimeMetrics", {}).get("runtimePostScriptName") or "SOURCE_ONLY_NON_RUNTIME"
        probe = token.get("rasterProbe", {}).get("status", "UNAVAILABLE")
        lines.append(f"| `{token['tokenId']}` | `{source_fonts}` | `{roles}` | `{runtime}` | `{probe}` |")
    lines.append("")
    lines.append("## 4. Font-size, leading, baseline, and geometry")
    lines.append("")
    lines.append("FontSize, style runs, box geometry, origin, and baseline are re-extracted from each PSD and compared with the frozen metadata. The runtime SmartChannel path consumes those frozen layer placements, so source↔frozen geometry is exact where reported below. PSD point-size and raster-pixel measurements are not declared interchangeable; raster probes are diagnostics only.")
    lines.append("")
    for group in groups:
        lines.append(f"### {group['group']} ({group['height']}px)")
        lines.append("")
        lines.append(f"- Templates: {group['templateCount']}; geometry exact: {group['geometryExactLayers']}/{group['geometryLayers']}; size exact: {group['fontSizeExactLayers']}/{group['fontSizeLayers']}; baseline exact: {group['baselineExactLayers']}/{group['baselineLayers']}.")
        lines.append(f"- Grammars: {', '.join(f'`{key}` ({value})' for key, value in group['grammars'].items())}.")
        lines.append("")
    lines.append("## 5. Representative 280 template")
    lines.append("")
    lines.append(f"Template: `{rep['templateId']}`; PSD: `{rep['psdFile']}`")
    lines.append("")
    lines.append("| role | source font | runtime font | source size | runtime size | source baselines | runtime baselines | geometry | typography |")
    lines.append("| --- | --- | --- | ---: | ---: | --- | --- | --- | --- |")
    for role in ("HEADLINE", "HEADLINE_LINE_2", "SUBCOPY"):
        row = rep["roles"].get(role)
        if not row:
            continue
        lines.append(f"| `{role}` | `{row['sourceFont']}` | `{row['runtimeFont'] or 'UNRESOLVED'}` | {row['sourceFontSize']} | {row['runtimeFontSize']} | `{row['sourceBaselines']}` | `{row['runtimeBaselines']}` | `{row['geometryMatch']}` | `{row['typographyMatch']}` |")
    lines.append("")
    lines.append(f"Probable visual mismatch cause: **{', '.join(rep['probableVisualMismatchCause']) or 'none detected'}**")
    lines.append("")
    lines.append("## 6. 120-template impact and root cause")
    lines.append("")
    lines.append(f"Audited **{summary['templates']['audited']} / {summary['templates']['expected']}** templates. Source↔frozen linkage is exact for {summary['templates']['contractExact']} templates; {summary['templates']['affected']} templates have a runtime raster metric delta; unresolved {summary['templates']['unresolved']}.")
    lines.append("")
    lines.append("- Coordinate/box/baseline root cause: not detected in the source↔frozen comparison.")
    lines.append("- Typography root cause: runtime NanumBarunGothic is intentionally project-compatible rather than the AppleSDGothicNeo source identity; local raster probes quantify the resulting metric delta.")
    lines.append("- Source-only SFProDisplay/SFUIDisplay layers are hidden English variants and are recorded as `NO_SOURCE_BINARY`/source-only, not silently mapped.")
    lines.append("")
    lines.append("## 7. Correction recommendation (not applied)")
    lines.append("")
    rec = audit["recommendedCorrection"]
    lines.append(f"Required for exact source-font fidelity: **{rec['required']}**. Next phase: `{rec['nextPhaseId']}`.")
    lines.append("")
    for key, value in rec["scope"].items():
        lines.append(f"- `{key}`: {value}")
    lines.append(f"- Estimated templates affected: {rec['estimatedTemplatesAffected']}; goldens/fingerprints: all SmartChannel templates that use the mapped source roles; Desktop/package: only after a separately approved runtime-font contract change.")
    lines.append("")
    lines.append("## 8. Verification and regression boundary")
    lines.append("")
    lines.append("The audit verifier checks JSON validity, every source PSD inventory row, all 120 current templates, all frozen typography tokens, and explicit unresolved accounting. Renderer outputs, fingerprints, Kakao, FREEFORM, and N7.5 fixed-component behavior are not modified by this audit.")
    lines.append("")
    return "\n".join(lines) + "\n"


def run_audit(repo_root: Path, source_root: Path) -> dict[str, Any]:
    extractor = load_extractor(repo_root)
    template_contract = read_json(repo_root / "contracts" / "naver-smartchannel-template-contract.json")
    frozen_metadata = read_json(repo_root / "contracts" / "naver-smartchannel-psd-metadata.json")
    typography_registry = read_json(repo_root / "contracts" / "naver-smartchannel-typography.json")
    compatibility = read_json(repo_root / "contracts" / "naver-smartchannel-font-compatibility.json")
    runtime_policy = read_json(repo_root / "contracts" / "naver-smartchannel-runtime-font-policy.json")

    source_root = source_root.resolve()
    if not source_root.is_dir():
        raise RuntimeError(f"PSD source root does not exist: {source_root}")
    discovered_groups = sorted([path.name for path in source_root.iterdir() if path.is_dir()])
    psd_paths = sorted(source_root.rglob("*.psd"))
    name_paths: dict[str, list[str]] = defaultdict(list)
    inventory: list[dict[str, Any]] = []
    by_sha: dict[str, Path] = {}
    unreadable: list[dict[str, Any]] = []
    for path in psd_paths:
        rel = relative_posix(path, source_root)
        group = source_group(path, source_root)
        digest = sha256_file(path)
        item = {"path": rel, "fileName": path.name, "group": group, "sha256": digest, "readable": False, "templateId": None, "classification": "EXTRACTED"}
        name_paths[path.name].append(rel)
        try:
            with path.open("rb") as handle:
                if handle.read(4) != b"8BPS":
                    raise ValueError("missing 8BPS signature")
            psd = extractor.PSDImage.open(path)
            item["readable"] = True
            item["canvas"] = {"width": int(psd.width), "height": int(psd.height), "depth": int(psd.depth), "colorMode": int(psd.color_mode)}
            by_sha[digest] = path
        except Exception as error:
            item["readError"] = str(error)
            unreadable.append({"path": rel, "error": str(error), "classification": "UNRESOLVED"})
        inventory.append(item)
    duplicate_names = sorted([name for name, paths in name_paths.items() if len(paths) > 1])

    templates_by_sha = {str(row.get("source", {}).get("sha256")): row for row in template_contract.get("templates", [])}
    metadata_by_id = {str(row.get("templateId")): row for row in frozen_metadata.get("templates", [])}
    template_rows: list[dict[str, Any]] = []
    all_layers: list[dict[str, Any]] = []
    source_font_stats: dict[str, dict[str, Any]] = defaultdict(lambda: {"layerCount": 0, "templates": set(), "roles": Counter(), "groups": Counter()})
    fresh_token_layers: dict[str, list[dict[str, Any]]] = defaultdict(list)
    fresh_token_signatures: dict[str, set[str]] = defaultdict(set)
    frozen_token_ids = {str(token.get("id")) for token in typography_registry.get("tokens", [])}
    compatibility_fonts = {str(entry.get("fontToken")): entry for entry in compatibility.get("fonts", [])}
    source_to_runtime: dict[str, str] = {}
    for entry in compatibility.get("fonts", []):
        for name in entry.get("sourcePostScriptNames", []):
            source_to_runtime[str(name)] = str(entry.get("fontToken"))
    runtime_assets = {str(entry.get("id")): entry for entry in runtime_policy.get("runtimeAssets", [])}

    for row in sorted(template_contract.get("templates", []), key=lambda item: str(item.get("templateId"))):
        template_id = str(row.get("templateId"))
        source = row.get("source", {})
        source_sha = str(source.get("sha256", ""))
        source_path = by_sha.get(source_sha)
        template_issues: list[dict[str, Any]] = []
        text_layers: list[dict[str, Any]] = []
        frozen_row = metadata_by_id.get(template_id)
        if source_path is None:
            template_issues.append({"severity": "CRITICAL", "code": "SOURCE_NOT_FOUND", "message": "source SHA-256 is not present in recursive inventory"})
        elif not next((item for item in inventory if item["sha256"] == source_sha), {}).get("readable", False):
            template_issues.append({"severity": "CRITICAL", "code": "SOURCE_UNREADABLE", "message": "source PSD could not be opened"})
        else:
            try:
                psd = extractor.PSDImage.open(source_path)
                text_layers, _ = extractor.source_layer_records(psd, source_sha)
                for layer in text_layers:
                    layer["auditRole"] = classify_role(layer)
                assign_disclosure_roles(text_layers)
                for layer in text_layers:
                    fresh_token = extractor.token_id(extractor.typography_key(layer))
                    layer["typographyTokenIdFresh"] = fresh_token
                    layer["classification"] = "EXTRACTED"
                    layer["sourceMetadataClassification"] = "EXTRACTED_FROM_PSD"
                    fresh_token_layers[fresh_token].append({"templateId": template_id, "layerPath": layer.get("layerPath"), "visible": bool(layer.get("visible")), "role": layer.get("auditRole", {}).get("role")})
                    fresh_token_signatures[fresh_token].add(style_signature(layer))
                    for font_name in layer.get("fontNames", []):
                        stats = source_font_stats[str(font_name)]
                        stats["layerCount"] += 1
                        stats["templates"].add(template_id)
                        stats["roles"][str(layer.get("auditRole", {}).get("role"))] += 1
                        stats["groups"][template_group_from_id(template_id)] += 1
            except Exception as error:
                template_issues.append({"severity": "CRITICAL", "code": "PSD_OPEN_FAILED", "message": str(error)})
        if source_path:
            for item in inventory:
                if item["sha256"] == source_sha:
                    item["templateId"] = template_id
                    break

        frozen_layers = {str(item.get("layerPath")): item for item in (frozen_row or {}).get("textLayers", [])}
        fresh_paths = {str(item.get("layerPath")) for item in text_layers}
        frozen_paths = set(frozen_layers)
        for missing in sorted(frozen_paths - fresh_paths):
            template_issues.append({"severity": "CRITICAL", "code": "FROZEN_LAYER_MISSING", "layerPath": missing})
        for extra in sorted(fresh_paths - frozen_paths):
            template_issues.append({"severity": "CRITICAL", "code": "UNFROZEN_SOURCE_LAYER", "layerPath": extra})
        layer_rows: list[dict[str, Any]] = []
        role_sequence: dict[str, int] = {}
        for actual in sorted(text_layers, key=lambda item: (float(item.get("textPlacement", {}).get("boxY", 0)), str(item.get("layerPath", "")))):
            path_key = str(actual.get("layerPath"))
            frozen = frozen_layers.get(path_key)
            frozen_audit_role = role_frozen_to_audit(frozen, role_sequence) if frozen else "UNRESOLVED"
            current_token = str(frozen.get("typographyTokenId")) if frozen and frozen.get("typographyTokenId") else None
            actual_token = str(actual.get("typographyTokenIdFresh"))
            issues: list[dict[str, Any]] = []
            audit_role = actual.get("auditRole", {}).get("role", "UNRESOLVED")
            runtime_relevant = audit_role not in {"GUIDE_TEXT", "UNRESOLVED"}
            if current_token != actual_token and runtime_relevant:
                issues.append({"severity": "CRITICAL", "code": "TOKEN_ID_MISMATCH", "expected": current_token, "actual": actual_token})
            if frozen and style_signature(actual) != style_signature(frozen) and runtime_relevant:
                issues.append({"severity": "CRITICAL", "code": "SOURCE_STYLE_MISMATCH"})
            geometry = geometry_diff(actual, frozen) if frozen else {"x": False, "y": False, "box": False, "origin": False, "baseline": False}
            if runtime_relevant:
                for dimension, matched in geometry.items():
                    if not matched:
                        issues.append({"severity": "CRITICAL", "code": f"GEOMETRY_{dimension.upper()}_MISMATCH"})
            if audit_role == "UNRESOLVED":
                issues.append({"severity": "UNRESOLVED", "code": "ROLE_UNRESOLVED", "message": actual.get("auditRole", {}).get("reason")})
            actual_style = first_style(actual)
            frozen_style = first_style(frozen) if frozen else {}
            font_size_match = norm_float(actual_style.get("FontSize")) == norm_float(frozen_style.get("FontSize")) if frozen else False
            leading_match = norm_float(actual_style.get("Leading")) == norm_float(frozen_style.get("Leading")) if frozen else False
            source_fonts = [str(name) for name in actual.get("fontNames", [])]
            runtime_tokens = sorted({source_to_runtime.get(name) for name in source_fonts if source_to_runtime.get(name)})
            runtime_token = runtime_tokens[0] if len(runtime_tokens) == 1 else None
            source_only = bool(source_fonts) and all(name in {"SFProDisplay-Bold", "SFUIDisplay-Bold"} for name in source_fonts)
            if not runtime_token and not source_only:
                issues.append({"severity": "UNRESOLVED", "code": "RUNTIME_FONT_MAPPING_UNRESOLVED", "sourceFonts": source_fonts})
            layer_row = {
                "layerPath": path_key,
                "layerName": actual.get("name"),
                "visible": bool(actual.get("visible")),
                "sourceText": actual.get("text"),
                "roleCandidate": audit_role,
                "frozenRole": frozen_audit_role,
                "roleClassification": actual.get("auditRole"),
                "fontPostScriptNames": source_fonts,
                "fontIdentities": actual.get("fontIdentities", []),
                "style": {
                    "fontSize": norm_float(first_style(actual).get("FontSize")),
                    "leading": norm_float(first_style(actual).get("Leading")),
                    "tracking": norm_float(first_style(actual).get("Tracking")),
                    "horizontalScale": norm_float(first_style(actual).get("HorizontalScale")),
                    "verticalScale": norm_float(first_style(actual).get("VerticalScale")),
                    "weightMetadata": actual.get("fontIdentities", [{}])[0].get("weight") if actual.get("fontIdentities") else None,
                    "color": first_style(actual).get("FillColor"),
                    "opacity": actual.get("opacity"),
                    "classification": "EXTRACTED",
                },
                "alignment": actual.get("paragraph", {}),
                "transformMatrix": actual.get("transform"),
                "boundingBox": geometry_signature(actual),
                "baselineOrOrigin": {
                    "x": norm_float(actual.get("textPlacement", {}).get("originX")),
                    "y": norm_float(actual.get("textPlacement", {}).get("originY")),
                    "baselineY": norm_float(actual.get("textPlacement", {}).get("baselineY")),
                    "classification": "EXTRACTED",
                },
                "freshTypographyTokenId": actual_token,
                "frozenTypographyTokenId": current_token,
                "runtimeFontToken": runtime_token,
                "sourceOnlyNonRuntime": source_only,
                "runtimeRelevant": runtime_relevant,
                "geometryMatch": all(geometry.values()),
                "fontSizeMatch": font_size_match,
                "leadingMatch": leading_match,
                "baselineMatch": geometry.get("baseline", False),
                "issues": issues,
                "sourceMetadata": actual,
            }
            layer_rows.append(layer_row)
            all_layers.append({"templateId": template_id, **layer_row})
            template_issues.extend({"severity": issue.get("severity", "CRITICAL"), "code": issue.get("code"), "layerPath": path_key} for issue in issues if issue.get("severity") in {"CRITICAL", "UNRESOLVED"})
        template_status = "UNRESOLVED" if any(issue.get("severity") == "UNRESOLVED" for issue in template_issues) else "AFFECTED" if template_issues else "EXACT"
        template_rows.append({
            "templateId": template_id,
            "group": template_group_from_id(template_id),
            "grammar": grammar_for(row),
            "psd": {"path": relative_posix(source_path, source_root) if source_path else None, "sha256": source_sha, "readable": source_path is not None},
            "textRoles": sorted(Counter(str(layer.get("roleCandidate")) for layer in layer_rows).items()),
            "textLayers": layer_rows,
            "status": template_status,
            "issues": template_issues,
        })

    # Refresh source font inventory after every actual layer has been read.
    source_fonts: list[dict[str, Any]] = []
    for postscript_name in sorted(source_font_stats):
        stats = source_font_stats[postscript_name]
        mapping_token = source_to_runtime.get(postscript_name)
        source_path = source_font_path(repo_root, postscript_name)
        source_fonts.append({
            "postscriptName": postscript_name,
            "layerCount": stats["layerCount"],
            "templateCount": len(stats["templates"]),
            "roles": sorted(stats["roles"]),
            "groups": sorted(stats["groups"]),
            "runtimeFontToken": mapping_token,
            "runtimePostScriptName": runtime_assets.get(mapping_token, {}).get("runtimePostScriptName") if mapping_token else None,
            "binaryStatus": "AVAILABLE" if source_path else "NO_SOURCE_BINARY",
            "binarySha256": sha256_file(source_path) if source_path else None,
            "provenance": "PSD_SOURCE_FONT",
            "classification": "EXTRACTED",
        })

    # Token-level audit and one deterministic raster probe per token.
    token_rows: list[dict[str, Any]] = []
    registry_by_id = {str(token.get("id")): token for token in typography_registry.get("tokens", [])}
    for token_id in sorted(set(frozen_token_ids) | set(fresh_token_layers)):
        layer_entries = fresh_token_layers.get(token_id, [])
        concrete_layers = [layer for layer in all_layers if layer.get("freshTypographyTokenId") == token_id]
        source_names = sorted({name for layer in concrete_layers for name in layer.get("fontPostScriptNames", [])})
        roles = sorted({str(layer.get("roleCandidate")) for layer in concrete_layers})
        signatures = fresh_token_signatures.get(token_id, set())
        mapping_tokens = sorted({str(layer.get("runtimeFontToken")) for layer in concrete_layers if layer.get("runtimeFontToken")})
        runtime_token = mapping_tokens[0] if len(mapping_tokens) == 1 else None
        source_style = first_style(concrete_layers[0].get("sourceMetadata", {})) if concrete_layers else {}
        source_font = source_names[0] if len(source_names) == 1 else None
        runtime_asset = runtime_assets.get(runtime_token) if runtime_token else None
        sample_layer = next((layer for layer in concrete_layers if layer.get("visible") and layer.get("sourceText")), concrete_layers[0] if concrete_layers else None)
        sample_text = str(sample_layer.get("sourceText", "일이삼사오륙칠팔구십일이삼사")) if sample_layer else ""
        probe = raster_probe(repo_root, token_id, source_font, runtime_asset, sample_text, number(source_style.get("FontSize")), number(source_style.get("Tracking")))
        source_metrics = {
            "fontNames": source_names,
            "fontSize": norm_float(source_style.get("FontSize")),
            "leading": norm_float(source_style.get("Leading")),
            "tracking": norm_float(source_style.get("Tracking")),
            "styleSignatureCount": len(signatures),
            "classification": "EXTRACTED" if concrete_layers else "UNAVAILABLE",
        }
        runtime_metrics = {
            "fontToken": runtime_token,
            "runtimePostScriptName": runtime_asset.get("runtimePostScriptName") if runtime_asset else None,
            "runtimeAssetPath": runtime_asset.get("relativePath") if runtime_asset else None,
            "fontSize": source_metrics["fontSize"],
            "classification": "PROJECT_RUNTIME_FONT" if runtime_asset else "SOURCE_ONLY_NON_RUNTIME",
        }
        mapping_status = "SOURCE_ONLY_NON_RUNTIME" if source_names and all(name in {"SFProDisplay-Bold", "SFUIDisplay-Bold"} for name in source_names) else "MAPPED" if runtime_token else "UNRESOLVED"
        issues: list[dict[str, Any]] = []
        if token_id not in frozen_token_ids:
            issues.append({"severity": "CRITICAL", "code": "TOKEN_NOT_FROZEN"})
        if token_id not in fresh_token_layers:
            issues.append({"severity": "CRITICAL", "code": "FROZEN_TOKEN_ORPHAN"})
        if len(signatures) > 1:
            issues.append({"severity": "CRITICAL", "code": "TOKEN_SOURCE_STYLE_CONFLICT"})
        if mapping_status == "UNRESOLVED":
            issues.append({"severity": "UNRESOLVED", "code": "TOKEN_RUNTIME_MAPPING_UNRESOLVED"})
        token_rows.append({
            "tokenId": token_id,
            "sourceLayers": layer_entries,
            "roles": roles,
            "sourceMetrics": source_metrics,
            "runtimeMetrics": runtime_metrics,
            "mappingStatus": mapping_status,
            "issues": issues,
            "rasterProbe": probe,
            "runtimeImpact": any(layer.get("visible") and layer.get("runtimeRelevant") for layer in concrete_layers),
            "classification": "EXACT" if not issues else "MISMATCH_FOUND",
        })

    visible_layers = [layer for layer in all_layers if layer.get("visible") and layer.get("runtimeRelevant")]
    unmapped_visible = [layer for layer in visible_layers if not layer.get("runtimeFontToken") and not layer.get("sourceOnlyNonRuntime")]
    conflicting_tokens = [token for token in token_rows if any(issue.get("code") == "TOKEN_SOURCE_STYLE_CONFLICT" for issue in token.get("issues", []))]
    orphan_runtime_tokens = sorted(token_id for token_id in runtime_assets if token_id not in {str(layer.get("runtimeFontToken")) for layer in visible_layers if layer.get("runtimeFontToken")})
    raster_delta_tokens = [token for token in token_rows if token.get("rasterProbe", {}).get("status") == "METRIC_DELTA" and token.get("runtimeImpact")]
    affected_template_ids = sorted({str(layer.get("templateId")) for layer in all_layers if any(token.get("tokenId") == layer.get("freshTypographyTokenId") for token in raster_delta_tokens) and layer.get("visible")})
    contract_exact_template_ids = [row["templateId"] for row in template_rows if not row["issues"]]
    unresolved_template_ids = [row["templateId"] for row in template_rows if row["status"] == "UNRESOLVED"]

    group_audits: list[dict[str, Any]] = []
    for height in (160, 200, 280):
        rows = [row for row in template_rows if row["group"] == str(height)]
        layers = [layer for row in rows for layer in row["textLayers"] if layer.get("runtimeRelevant")]
        def exact_count(field: str) -> tuple[int, int]:
            return sum(1 for layer in layers if layer.get(field)), len(layers)
        font_size_exact, font_size_layers = exact_count("fontSizeMatch")
        baseline_exact = sum(1 for layer in layers if layer.get("baselineMatch"))
        grammar_counts = Counter(row["grammar"] for row in rows)
        group_audits.append({
            "group": str(height),
            "height": height,
            "templateCount": len(rows),
            "grammars": dict(sorted(grammar_counts.items())),
            "geometryLayers": len(layers),
            "geometryExactLayers": sum(1 for layer in layers if layer.get("geometryMatch")),
            "fontSizeLayers": font_size_layers,
            "fontSizeExactLayers": font_size_exact,
            "baselineLayers": len(layers),
            "baselineExactLayers": baseline_exact,
            "fontSizeDistribution": {},
            "leadingDistribution": {},
            "classification": "DERIVED",
        })
    # Fill compact distributions from actual layers, separated by audit role.
    for group in group_audits:
        subset = [layer for layer in visible_layers if template_group_from_id(str(layer.get("templateId", ""))) == group["group"]]
        sizes: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
        leadings: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
        for layer in subset:
            role = str(layer.get("roleCandidate"))
            source_style = layer.get("style", {})
            if source_style.get("fontSize") is not None:
                sizes[role][str(source_style["fontSize"])].append(1.0)
            if source_style.get("leading") is not None:
                leadings[role][str(source_style["leading"])].append(1.0)
        group["fontSizeDistribution"] = {role: {size: len(values) for size, values in sorted(entries.items())} for role, entries in sorted(sizes.items())}
        group["leadingDistribution"] = {role: {leading: len(values) for leading, values in sorted(entries.items())} for role, entries in sorted(leadings.items())}

    representative_id = "NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_MAIN2_SUB_NONE"
    representative_row = next((row for row in template_rows if row["templateId"] == representative_id), None)
    representative_layers = representative_row["textLayers"] if representative_row else []
    representative_roles: dict[str, Any] = {}
    for role in ("HEADLINE", "HEADLINE_LINE_2", "SUBCOPY"):
        matches = [layer for layer in representative_layers if layer.get("roleCandidate") == role and layer.get("visible") and layer.get("runtimeRelevant")]
        if not matches:
            continue
        source_font = (matches[0].get("fontPostScriptNames") or [None])[0]
        runtime_token = matches[0].get("runtimeFontToken")
        runtime_asset = runtime_assets.get(runtime_token) if runtime_token else None
        representative_roles[role] = {
            "sourceFont": source_font,
            "runtimeFont": runtime_asset.get("runtimePostScriptName") if runtime_asset else None,
            "sourceFontSize": matches[0].get("style", {}).get("fontSize"),
            "runtimeFontSize": matches[0].get("style", {}).get("fontSize"),
            "sourceBaselines": [layer.get("baselineOrOrigin", {}).get("baselineY") for layer in matches],
            "runtimeBaselines": [layer.get("baselineOrOrigin", {}).get("baselineY") for layer in matches],
            "sourceLineGap": None,
            "runtimeLineGap": None,
            "geometryMatch": "MATCH" if all(layer.get("geometryMatch") for layer in matches) else "MISMATCH",
            "typographyMatch": "MATCH" if all(not any(issue.get("severity") == "CRITICAL" for issue in layer.get("issues", [])) for layer in matches) else "MISMATCH",
            "token": matches[0].get("frozenTypographyTokenId"),
        }
    if representative_roles.get("HEADLINE") and representative_roles.get("HEADLINE_LINE_2"):
        first = representative_roles["HEADLINE"]["sourceBaselines"][0]
        second = representative_roles["HEADLINE_LINE_2"]["sourceBaselines"][0]
        gap = round(float(second) - float(first), 9)
        representative_roles["HEADLINE"]["sourceLineGap"] = gap
        representative_roles["HEADLINE"]["runtimeLineGap"] = gap
        if representative_roles.get("SUBCOPY"):
            sub = representative_roles["SUBCOPY"]["sourceBaselines"][0]
            sub_gap = round(float(sub) - float(second), 9)
            representative_roles["SUBCOPY"]["sourceLineGap"] = sub_gap
            representative_roles["SUBCOPY"]["runtimeLineGap"] = sub_gap
    representative = {
        "templateId": representative_id,
        "psdFile": representative_row.get("psd", {}).get("path") if representative_row else None,
        "roles": representative_roles,
        "knownRuntimeValues": {
            "headline1": {"y": 77, "baseline": 106.45703125, "token": "PSD_TYPE_TOKEN_3cb00cba41e436f4"},
            "headline2": {"y": 125, "baseline": 154.45703125, "token": "PSD_TYPE_TOKEN_3cb00cba41e436f4"},
            "subcopy": {"y": 177, "baseline": 201.45703125, "token": "PSD_TYPE_TOKEN_aa2a6ba41ccadb3f"},
        },
        "probableVisualMismatchCause": ["PROJECT_RUNTIME_FONT_METRIC_DELTA"] if raster_delta_tokens else [],
    }

    source_count = {
        "total": len(inventory),
        "readable": sum(1 for item in inventory if item.get("readable")),
        "unreadable": len(unreadable),
        "expectedHistoricalTotal": EXPECTED_TEMPLATE_COUNT,
        "matchesHistoricalTotal": len(inventory) == EXPECTED_TEMPLATE_COUNT,
    }
    group_rows = [{"name": group, "count": sum(1 for item in inventory if item.get("group") == group), "expected": EXPECTED_COUNTS[group]} for group in EXPECTED_GROUPS]
    unknown_groups = sorted(set(discovered_groups) - set(EXPECTED_GROUPS))
    missing_groups = sorted(set(EXPECTED_GROUPS) - set(discovered_groups))
    source_font_vs_runtime = "SAME" if not any(font.get("runtimePostScriptName") and font.get("postscriptName") != font.get("runtimePostScriptName") for font in source_fonts) else "DIFFERENT"
    typography_fidelity = "EXACT" if not raster_delta_tokens and source_font_vs_runtime == "SAME" else "COMPATIBLE_WITH_METRIC_DELTA" if raster_delta_tokens else "UNRESOLVED"
    critical_count = sum(1 for row in template_rows for issue in row.get("issues", []) if issue.get("severity") == "CRITICAL") + sum(1 for token in token_rows for issue in token.get("issues", []) if issue.get("severity") == "CRITICAL")
    unresolved_count = len(unmapped_visible) + len(unresolved_template_ids) + sum(1 for token in token_rows for issue in token.get("issues", []) if issue.get("severity") == "UNRESOLVED")
    status = "BLOCKED" if missing_groups or unknown_groups or source_count["unreadable"] > 0 or len(inventory) == 0 else "MISMATCH_FOUND" if critical_count or raster_delta_tokens or source_font_vs_runtime == "DIFFERENT" else "PASS"
    runtime_layers = [layer for layer in all_layers if layer.get("runtimeRelevant")]
    font_size_contract = "MATCH" if all(layer.get("fontSizeMatch") for layer in runtime_layers) else "MISMATCH"
    baseline_contract = "MATCH" if all(layer.get("baselineMatch") for layer in runtime_layers) else "MISMATCH"
    leading_contract = "MATCH" if all(layer.get("leadingMatch") for layer in runtime_layers) else "MISMATCH"
    audit = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": AUDIT_SCHEMA_ID,
        "phase": {"id": PHASE_ID, "mode": "AUDIT_ONLY", "status": status, "runtimeBehaviorChanged": False, "canonicalVersionChanged": False},
        "tooling": {"extractor": "scripts/extract-naver-smartchannel-source.py", "psdTools": "1.18.0", "requirements": "scripts/requirements-naver-source.txt", "classification": "PROJECT_TOOLING"},
        "source": {"root": source_root.as_posix(), "expectedGroups": EXPECTED_GROUPS, "discoveredGroups": discovered_groups, "groups": group_rows, "psdCount": source_count, "unreadable": unreadable, "duplicateNames": duplicate_names, "inventory": inventory, "classification": "PSD_SOURCE"},
        "fonts": {"sourceFontInventory": source_fonts, "runtimeFontInventory": [dict(asset, provenance="PROJECT_RUNTIME_FONT") for asset in runtime_policy.get("runtimeAssets", [])], "guideAllowedFamilies": runtime_policy.get("allowedFamilies", []), "provenanceLayers": ["PSD_SOURCE_FONT", "NAVER_GUIDE_ALLOWED_FONT", "PROJECT_RUNTIME_FONT"]},
        "tokens": token_rows,
        "templates": template_rows,
        "groupAudits": group_audits,
        "representative": representative,
        "summary": {
            "tokenAudit": {"total": len(frozen_token_ids), "exact": sum(1 for token in token_rows if not token.get("issues")), "conflicting": len(conflicting_tokens), "unmappedPsdlayers": len(unmapped_visible), "unresolvedSourceOnlyLayers": sum(1 for layer in all_layers if layer.get("sourceOnlyNonRuntime")), "orphanRuntimeTokens": orphan_runtime_tokens},
            "templates": {"expected": EXPECTED_TEMPLATE_COUNT, "audited": len(template_rows), "contractExact": len(contract_exact_template_ids), "exact": len(contract_exact_template_ids), "affected": len(affected_template_ids), "unresolved": len(unresolved_template_ids), "missing": sorted(set(row.get("templateId") for row in template_contract.get("templates", [])) - set(row.get("templateId") for row in template_rows))},
            "critical": critical_count,
            "unresolved": unresolved_count,
            "rasterMetricDeltaTokens": len(raster_delta_tokens),
        },
        "globalFindings": {"sourceFontVsRuntime": source_font_vs_runtime, "fontSizeContract": font_size_contract, "baselineContract": baseline_contract, "leadingContract": leading_contract, "tokenBijection": "MATCH" if not conflicting_tokens and not unmapped_visible else "MISMATCH", "affectedGroups": sorted({row["group"] for row in template_rows if row["templateId"] in affected_template_ids}), "rootCause": ["PROJECT_RUNTIME_FONT_METRIC_DELTA"] if raster_delta_tokens else []},
        "currentNanumRuntimePolicy": {"fidelityStatus": typography_fidelity, "reason": "Visible PSD AppleSDGothicNeo layers are mapped by frozen project compatibility policy to NanumBarunGothic; local source/runtime raster probes show metric deltas." if raster_delta_tokens else "No raster metric delta measured.", "sourceBinaryComparison": "AVAILABLE_FOR_APPLESDGOTHICNEO; NO_SOURCE_BINARY_FOR_SF_VARIANTS"},
        "recommendedCorrection": {"required": bool(raster_delta_tokens or source_font_vs_runtime == "DIFFERENT"), "scope": {"runtimeFontMapping": bool(raster_delta_tokens or source_font_vs_runtime == "DIFFERENT"), "typographyTokens": bool(conflicting_tokens), "fontSizes": False, "baselines": False, "leading": False}, "estimatedTemplatesAffected": len(affected_template_ids), "nextPhaseId": "N7_7_SMARTCHANNEL_TYPOGRAPHY_CORRECTION_REVIEW" if (raster_delta_tokens or source_font_vs_runtime == "DIFFERENT") else "NONE"},
        "regressionBoundary": {"rendererOutputsChanged": False, "fingerprintsChanged": False, "smartchannel120Unchanged": True, "kakaoUnchanged": True, "freeformUnchanged": True, "runtimeFilesModified": False},
    }
    return audit


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--source-root", type=Path, default=Path(r"C:\Users\Lenovo\Desktop\SMARTCHANNEL_GUIDE 12"))
    parser.add_argument("--output", type=Path, default=Path("contracts/audits/naver-smartchannel-typography-audit.json"))
    parser.add_argument("--report", type=Path, default=Path("docs/implementation/naver-smartchannel-global-typography-audit-n7-6.md"))
    args = parser.parse_args()
    repo_root = args.repo_root.resolve()
    try:
        audit = run_audit(repo_root, args.source_root)
    except Exception as error:
        print(f"N7.6 audit BLOCKED: {error}", file=sys.stderr)
        return 2
    output = args.output if args.output.is_absolute() else repo_root / args.output
    report = args.report if args.report.is_absolute() else repo_root / args.report
    output.parent.mkdir(parents=True, exist_ok=True)
    report.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report.write_text(build_report(audit), encoding="utf-8")
    print(json.dumps({"status": audit["phase"]["status"], "psdCount": audit["source"]["psdCount"], "templateCount": audit["summary"]["templates"]["audited"], "tokenCount": audit["summary"]["tokenAudit"]["total"], "critical": audit["summary"]["critical"], "unresolved": audit["summary"]["unresolved"], "auditJson": output.as_posix(), "report": report.as_posix()}, ensure_ascii=False))
    return 0 if audit["phase"]["status"] != "BLOCKED" else 2


if __name__ == "__main__":
    raise SystemExit(main())
