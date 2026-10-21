#!/usr/bin/env python3
"""Validate matched product pages and add structured metadata and image hashes."""

from __future__ import annotations

import argparse
import gzip
import html
import io
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from PIL import Image


USER_AGENT = "Cuanto.uy catalog remediation/0.1 (+https://cuanto.uy)"
PRODUCT_JSON_LD = re.compile(
    r"<script\b[^>]*type=[\"']application/ld(?:\+|&#x2B;|&#43;)json[\"'][^>]*>([\s\S]*?)</script>",
    re.IGNORECASE,
)
STORE_PREFERENCE = ("Disco", "TaTa", "El Dorado")


def as_product(payload: object) -> dict | None:
    if isinstance(payload, list):
        for item in payload:
            product = as_product(item)
            if product:
                return product
        return None
    if not isinstance(payload, dict):
        return None
    if str(payload.get("@type", "")).lower() == "product":
        return payload
    graph = payload.get("@graph")
    return as_product(graph) if graph else None


def scalar_brand(value: object) -> str | None:
    if isinstance(value, str):
        return value.strip() or None
    if isinstance(value, dict):
        name = value.get("name")
        return str(name).strip() if name else None
    return None


def first_image(value: object) -> str | None:
    if isinstance(value, str):
        return value
    if isinstance(value, list) and value:
        return first_image(value[0])
    if isinstance(value, dict):
        candidate = value.get("url") or value.get("contentUrl")
        return str(candidate) if candidate else None
    return None


def image_dhash(url: str | None) -> str | None:
    if not url:
        return None
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "image/*"})
    try:
        with urlopen(request, timeout=25) as response:
            body = response.read(8 * 1024 * 1024)
        with Image.open(io.BytesIO(body)) as image:
            gray = image.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
            pixels = list(gray.get_flattened_data())
        bits = 0
        for row in range(8):
            for column in range(8):
                bits = (bits << 1) | int(pixels[row * 9 + column] > pixels[row * 9 + column + 1])
        return f"{bits:016x}"
    except Exception:
        return None


def fetch_metadata(url: str, include_image_hash: bool) -> dict:
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Encoding": "identity",
        },
    )
    try:
        with urlopen(request, timeout=35) as response:
            status = response.status
            final_url = response.geturl()
            raw_body = response.read(2 * 1024 * 1024)
            if response.headers.get("Content-Encoding", "").lower() == "gzip":
                raw_body = gzip.decompress(raw_body)
            body = raw_body.decode("utf-8", errors="replace")
    except HTTPError as error:
        return {"ok": False, "status": error.code, "error": f"HTTP {error.code}"}
    except (URLError, TimeoutError, OSError) as error:
        return {"ok": False, "status": None, "error": str(error)}

    product = None
    for raw_payload in PRODUCT_JSON_LD.findall(body):
        try:
            product = as_product(json.loads(html.unescape(raw_payload)))
        except (json.JSONDecodeError, TypeError):
            continue
        if product:
            break
    if not product:
        return {
            "ok": False,
            "status": status,
            "final_url": final_url,
            "error": "product JSON-LD not found",
        }
    image_url = first_image(product.get("image"))
    return {
        "ok": True,
        "status": status,
        "final_url": final_url,
        "name": product.get("name"),
        "brand": scalar_brand(product.get("brand")),
        "image_url": image_url,
        "image_dhash": image_dhash(image_url) if include_image_hash else None,
        "gtin": product.get("gtin") or product.get("gtin13") or product.get("gtin14"),
        "sku": product.get("sku"),
        "category": product.get("category"),
    }


def hamming(left: str, right: str) -> int:
    return (int(left, 16) ^ int(right, 16)).bit_count()


def add_group_image_evidence(group: dict) -> None:
    hashes = [
        (record["store"], record.get("metadata", {}).get("image_dhash"))
        for record in group["records"]
        if record.get("metadata", {}).get("image_dhash")
    ]
    distances = []
    for index, (left_store, left_hash) in enumerate(hashes):
        for right_store, right_hash in hashes[index + 1:]:
            if left_store != right_store:
                distances.append(hamming(left_hash, right_hash))
    group["image_evidence"] = {
        "compared_pairs": len(distances),
        "minimum_distance": min(distances) if distances else None,
        "maximum_distance": max(distances) if distances else None,
        "near_identical": bool(distances) and min(distances) <= 6,
    }


def canonical_metadata(group: dict) -> dict:
    for store in STORE_PREFERENCE:
        for record in group["records"]:
            metadata = record.get("metadata", {})
            if record["store"] == store and metadata.get("ok"):
                return {
                    "source_store": store,
                    "name": metadata.get("name") or record["title"],
                    "brand": metadata.get("brand"),
                    "image_url": metadata.get("image_url"),
                }
    record = group["records"][0]
    return {"source_store": record["store"], "name": record["title"], "brand": None, "image_url": None}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--workers", type=int, default=10)
    parser.add_argument("--reuse", type=Path, action="append", default=[])
    args = parser.parse_args()

    groups = json.loads(args.input.read_text(encoding="utf-8"))
    reused_metadata = {}
    for reuse_path in args.reuse:
        for reused_group in json.loads(reuse_path.read_text(encoding="utf-8")):
            for record in reused_group.get("records", []):
                if "metadata" in record:
                    reused_metadata[record["url"]] = record["metadata"]
    for group in groups:
        for record in group["records"]:
            if record["url"] in reused_metadata:
                record["metadata"] = reused_metadata[record["url"]]

    jobs: dict[str, bool] = {}
    for group in groups:
        if group["confidence"] == "medium":
            for record in group["records"]:
                if "metadata" not in record:
                    jobs[record["url"]] = True
        elif group["confidence"] == "high":
            ordered = sorted(
                group["records"],
                key=lambda record: STORE_PREFERENCE.index(record["store"]),
            )
            if not any(record.get("metadata", {}).get("ok") for record in ordered):
                preferred = next((record for record in ordered if "metadata" not in record), None)
                if preferred:
                    jobs.setdefault(preferred["url"], False)

    print(f"validating {len(jobs)} product pages", file=sys.stderr, flush=True)
    metadata_by_url: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(fetch_metadata, url, include_hash): url
            for url, include_hash in jobs.items()
        }
        for completed, future in enumerate(as_completed(futures), 1):
            url = futures[future]
            try:
                metadata_by_url[url] = future.result()
            except Exception as error:  # pragma: no cover - worker isolation
                metadata_by_url[url] = {"ok": False, "status": None, "error": str(error)}
            if completed % 100 == 0:
                print(f"validated {completed}/{len(jobs)}", file=sys.stderr, flush=True)

    for group in groups:
        for record in group["records"]:
            if record["url"] in metadata_by_url:
                record["metadata"] = metadata_by_url[record["url"]]
        if group["confidence"] == "medium":
            add_group_image_evidence(group)
        group["canonical"] = canonical_metadata(group)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(groups, ensure_ascii=False, indent=2), encoding="utf-8")
    states = {}
    for metadata in metadata_by_url.values():
        key = "ok" if metadata.get("ok") else metadata.get("error", "error")
        states[key] = states.get(key, 0) + 1
    print(json.dumps({"validated": len(jobs), "states": states}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
