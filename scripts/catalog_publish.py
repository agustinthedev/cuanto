#!/usr/bin/env python3
"""Plan and publish high-confidence catalog matches to Supabase.

The command is deliberately dry-run by default. It reads credentials from a
local env file, takes a catalog backup, and writes a complete plan before any
mutation. Passing ``--apply`` rebuilds the plan from current production state
and applies only conflict-free, idempotent actions.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import uuid
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError
from urllib.parse import quote, urlparse, urlunparse
from urllib.request import Request, urlopen


SOURCE_STORE_NAMES = ("Disco", "TaTa", "El Dorado")
STORE_ALIASES = {
    "disco": "Disco",
    "ta-ta": "TaTa",
    "tata": "TaTa",
    "el-dorado": "El Dorado",
    "eldorado": "El Dorado",
}
CATEGORY_NAMES = {"Almacén", "Bebidas", "Carnes", "Lácteos", "Limpieza"}
CANONICAL_STORE_ORDER = ("Disco", "TaTa", "El Dorado")


class PublishError(RuntimeError):
    """Raised when a safe catalog publication cannot continue."""


def utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        values[key.strip()] = value
    missing = [key for key in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY") if not values.get(key)]
    if missing:
        raise PublishError(f"Missing required env values: {', '.join(missing)}")
    return values


class SupabaseRest:
    def __init__(self, base_url: str, service_key: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }

    def request(
        self,
        table: str,
        *,
        query: str = "",
        method: str = "GET",
        body: object | None = None,
        prefer: str | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> object:
        url = f"{self.base_url}/rest/v1/{table}"
        if query:
            url = f"{url}?{query}"
        headers = dict(self.headers)
        if prefer:
            headers["Prefer"] = prefer
        if extra_headers:
            headers.update(extra_headers)
        data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
        request = Request(url, data=data, headers=headers, method=method)
        try:
            with urlopen(request, timeout=60) as response:
                payload = response.read()
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise PublishError(f"Supabase {method} {table} failed ({error.code}): {detail[:500]}") from error
        if not payload:
            return None
        return json.loads(payload.decode("utf-8"))

    def list_all(self, table: str, select: str = "*", order_by: str = "id") -> list[dict]:
        rows: list[dict] = []
        page_size = 1000
        offset = 0
        while True:
            page = self.request(
                table,
                query=f"select={quote(select, safe=',()*')}&order={quote(order_by, safe=',.')}.asc",
                extra_headers={"Range": f"{offset}-{offset + page_size - 1}"},
            )
            if not isinstance(page, list):
                raise PublishError(f"Unexpected response while reading {table}")
            rows.extend(page)
            if len(page) < page_size:
                return rows
            offset += page_size

    def insert(self, table: str, rows: list[dict]) -> None:
        if rows:
            self.request(table, method="POST", body=rows, prefer="return=minimal")

    def patch(self, table: str, row_id: str, values: dict) -> None:
        if values:
            self.request(
                table,
                query=f"id=eq.{quote(row_id, safe='-')}",
                method="PATCH",
                body=values,
                prefer="return=minimal",
            )

    def delete_ids(self, table: str, row_ids: Iterable[str]) -> None:
        ids = list(row_ids)
        if not ids:
            return
        encoded = ",".join(quote(row_id, safe="-") for row_id in ids)
        self.request(table, query=f"id=in.({encoded})", method="DELETE", prefer="return=minimal")


def chunks(values: list[dict], size: int) -> Iterable[list[dict]]:
    for index in range(0, len(values), size):
        yield values[index:index + size]


def normalize_url(value: str) -> str:
    parsed = urlparse(value.strip())
    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    path = re.sub(r"/+", "/", parsed.path).rstrip("/") or "/"
    return urlunparse((parsed.scheme.lower() or "https", host, path, "", "", ""))


def resolve_store_name(store: dict) -> str | None:
    name = str(store.get("name") or "").strip()
    if name in SOURCE_STORE_NAMES:
        return name
    slug = str(store.get("slug") or "").strip().lower()
    return STORE_ALIASES.get(slug)


def choose_measurement(group: dict) -> tuple[float, str]:
    """Return a stable package measurement, preferring cross-store agreement."""
    candidates: list[tuple[str, float]] = []
    per_record: list[set[tuple[str, float]]] = []
    for record in group.get("records", []):
        measurements = {
            (str(item["dimension"]), round(float(item["value"]), 3))
            for item in record.get("measurements", [])
            if item.get("dimension") in {"weight_g", "volume_ml", "count"}
            and float(item.get("value", 0)) > 0
        }
        per_record.append(measurements)
        candidates.extend(measurements)

    frequency = Counter(candidates)
    preferred_dimensions = ("weight_g", "volume_ml", "count")
    agreed = [item for item, count in frequency.items() if count >= 2]
    if agreed:
        dimension, value = sorted(
            agreed,
            key=lambda item: (-frequency[item], preferred_dimensions.index(item[0]), -item[1]),
        )[0]
    else:
        canonical_store = str(group.get("canonical", {}).get("source_store") or "")
        canonical_record = next(
            (record for record in group.get("records", []) if record.get("store") == canonical_store),
            group.get("records", [{}])[0],
        )
        canonical_measurements = [
            (str(item["dimension"]), round(float(item["value"]), 3))
            for item in canonical_record.get("measurements", [])
            if item.get("dimension") in {"weight_g", "volume_ml", "count"}
            and float(item.get("value", 0)) > 0
        ]
        if not canonical_measurements:
            return 1.0, "un"
        dimension, value = sorted(
            canonical_measurements,
            key=lambda item: (preferred_dimensions.index(item[0]), -item[1]),
        )[0]

    if dimension == "weight_g":
        return (round(value / 1000, 3), "kg") if value >= 1000 else (value, "g")
    if dimension == "volume_ml":
        return (round(value / 1000, 3), "L") if value >= 1000 else (value, "ml")
    return value, "un"


def choose_canonical(group: dict) -> dict:
    canonical = group.get("canonical") or {}
    records = group.get("records", [])
    for store_name in CANONICAL_STORE_ORDER:
        record = next(
            (
                item for item in records
                if item.get("store") == store_name and item.get("metadata", {}).get("ok") is True
            ),
            None,
        )
        if record:
            metadata = record["metadata"]
            return {
                "source_store": store_name,
                "name": str(metadata.get("name") or record.get("title") or "").strip(),
                "brand": clean_optional_text(metadata.get("brand")),
                "image_url": clean_optional_text(metadata.get("image_url")),
            }
    return {
        "source_store": canonical.get("source_store"),
        "name": str(canonical.get("name") or records[0].get("title") or "").strip(),
        "brand": clean_optional_text(canonical.get("brand")),
        "image_url": clean_optional_text(canonical.get("image_url")),
    }


def clean_optional_text(value: object) -> str | None:
    text = str(value or "").strip()
    return text or None


def eligible_group(group: dict) -> tuple[bool, str | None]:
    if group.get("confidence") != "high":
        return False, f"confidence:{group.get('confidence', 'missing')}"
    if group.get("cuanto_category") not in CATEGORY_NAMES:
        return False, "category:excluded"
    if int(group.get("active_store_count", 0)) < 2:
        return False, "stores:fewer-than-two"
    if group.get("duplicate_store"):
        return False, "stores:duplicate"
    if not any(record.get("metadata", {}).get("ok") is True for record in group.get("records", [])):
        return False, "validation:no-live-page"
    return True, None


def build_backup(client: SupabaseRest) -> dict[str, object]:
    tables = {
        "stores": client.list_all("stores"),
        "categories": client.list_all("categories"),
        "products": client.list_all("products"),
        "store_products": client.list_all("store_products"),
        "tags": client.list_all("tags"),
        "product_tags": client.list_all("product_tags", order_by="product_id"),
    }
    return {"created_at": utc_now(), "tables": tables}


def build_plan(groups: list[dict], backup: dict[str, object]) -> dict[str, object]:
    tables = backup["tables"]
    assert isinstance(tables, dict)
    stores = list(tables["stores"])
    categories = list(tables["categories"])
    products = list(tables["products"])
    store_products = list(tables["store_products"])

    store_ids = {
        resolved: str(store["id"])
        for store in stores
        if (resolved := resolve_store_name(store)) is not None
    }
    missing_stores = sorted(set(SOURCE_STORE_NAMES) - set(store_ids))
    if missing_stores:
        raise PublishError(f"Missing production stores: {', '.join(missing_stores)}")

    category_ids = {
        str(category.get("name")): str(category["id"])
        for category in categories
        if category.get("name") in CATEGORY_NAMES
    }
    missing_categories = sorted(CATEGORY_NAMES - set(category_ids))
    if missing_categories:
        raise PublishError(f"Missing production categories: {', '.join(missing_categories)}")

    product_by_id = {str(product["id"]): product for product in products}
    links_by_url: dict[str, list[dict]] = defaultdict(list)
    links_by_product_store: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for link in store_products:
        links_by_url[normalize_url(str(link["url"]))].append(link)
        links_by_product_store[(str(link["product_id"]), str(link["store_id"]))].append(link)

    actions: list[dict] = []
    conflicts: list[dict] = []
    skipped = Counter()
    seen_urls: set[str] = set()

    for group_index, group in enumerate(groups):
        is_eligible, reason = eligible_group(group)
        if not is_eligible:
            skipped[reason or "ineligible"] += 1
            continue

        records = [record for record in group["records"] if record.get("store") in store_ids]
        record_urls = [normalize_url(str(record["url"])) for record in records]
        duplicate_input_urls = sorted({url for url in record_urls if url in seen_urls})
        if duplicate_input_urls:
            conflicts.append({
                "group_index": group_index,
                "reason": "source-url-used-by-multiple-groups",
                "urls": duplicate_input_urls,
            })
            continue

        mapped_product_ids = {
            str(link["product_id"])
            for url in record_urls
            for link in links_by_url.get(url, [])
        }
        if len(mapped_product_ids) > 1:
            conflicts.append({
                "group_index": group_index,
                "reason": "urls-map-to-multiple-products",
                "product_ids": sorted(mapped_product_ids),
                "urls": record_urls,
            })
            continue

        target_product_id = next(iter(mapped_product_ids), None)
        occupied: list[dict] = []
        replacement_links: dict[str, dict] = {}
        if target_product_id:
            for record, normalized in zip(records, record_urls):
                store_id = store_ids[str(record["store"])]
                existing_for_store = links_by_product_store.get((target_product_id, store_id), [])
                if existing_for_store and all(normalize_url(str(item["url"])) != normalized for item in existing_for_store):
                    if len(existing_for_store) == 1 and not links_by_url.get(normalized):
                        replacement_links[store_id] = existing_for_store[0]
                    else:
                        occupied.append({
                            "store": record["store"],
                            "proposed_url": record["url"],
                            "existing_urls": [item["url"] for item in existing_for_store],
                        })
        if occupied:
            conflicts.append({
                "group_index": group_index,
                "reason": "product-already-has-different-store-link",
                "product_id": target_product_id,
                "details": occupied,
            })
            continue

        canonical = choose_canonical(group)
        if not canonical["name"]:
            skipped["canonical:missing-name"] += 1
            continue
        quantity, unit = choose_measurement(group)
        product_id = target_product_id or str(uuid.uuid4())
        product_values = {
            "name": canonical["name"][:200],
            "brand": canonical["brand"],
            "quantity": quantity,
            "unit": unit,
            "category_id": category_ids[str(group["cuanto_category"])],
            "image_url": canonical["image_url"],
        }

        links: list[dict] = []
        link_patches: list[dict] = []
        for record, normalized in zip(records, record_urls):
            store_id = store_ids[str(record["store"])]
            metadata = record.get("metadata", {})
            link_values = {
                "url": str(record["url"]),
                "external_name": str(record.get("title") or "")[:500] or None,
                "active": True,
                "image_url": clean_optional_text(metadata.get("image_url")) if metadata.get("ok") else None,
                "image_fetched_at": utc_now() if metadata.get("ok") and metadata.get("image_url") else None,
            }
            if store_id in replacement_links:
                current_link = replacement_links[store_id]
                patch = {
                    key: value for key, value in link_values.items()
                    if value is not None and current_link.get(key) != value
                }
                if patch:
                    link_patches.append({
                        "id": str(current_link["id"]),
                        "values": patch,
                        "previous": {key: current_link.get(key) for key in patch},
                    })
                continue
            if any(
                str(link["product_id"]) == product_id and str(link["store_id"]) == store_id
                for link in links_by_url.get(normalized, [])
            ):
                continue
            links.append({
                "id": str(uuid.uuid4()),
                "product_id": product_id,
                "store_id": store_id,
                **link_values,
            })

        product_patch: dict = {}
        action_kind = "create"
        if target_product_id:
            action_kind = "extend"
            existing_product = product_by_id[target_product_id]
            for field in ("brand", "category_id", "image_url"):
                if not existing_product.get(field) and product_values.get(field):
                    product_patch[field] = product_values[field]

        if action_kind == "extend" and not links and not link_patches and not product_patch:
            skipped["existing:already-complete"] += 1
            seen_urls.update(record_urls)
            continue

        actions.append({
            "group_index": group_index,
            "kind": action_kind,
            "product_id": product_id,
            "product": product_values if action_kind == "create" else None,
            "product_patch": product_patch,
            "product_previous": (
                {key: product_by_id[target_product_id].get(key) for key in product_patch}
                if target_product_id else {}
            ),
            "links": links,
            "link_patches": link_patches,
            "evidence": {
                "confidence": group["confidence"],
                "minimum_score": group.get("minimum_score"),
                "canonical_source_store": canonical["source_store"],
                "category": group["cuanto_category"],
            },
        })
        seen_urls.update(record_urls)

    counts = Counter(action["kind"] for action in actions)
    return {
        "created_at": utc_now(),
        "source_groups": len(groups),
        "current_catalog": {
            "products": len(products),
            "store_products": len(store_products),
        },
        "summary": {
            "actions": len(actions),
            "create_products": counts["create"],
            "extend_products": counts["extend"],
            "create_store_products": sum(len(action["links"]) for action in actions),
            "update_store_products": sum(len(action["link_patches"]) for action in actions),
            "conflicts": len(conflicts),
            "skipped": sum(skipped.values()),
            "skipped_by_reason": dict(sorted(skipped.items())),
        },
        "conflicts": conflicts,
        "actions": actions,
    }


def apply_plan(client: SupabaseRest, plan: dict[str, object]) -> dict[str, object]:
    actions = list(plan["actions"])
    new_products = [
        {"id": action["product_id"], **action["product"]}
        for action in actions
        if action["kind"] == "create"
    ]
    all_links = [link for action in actions for link in action["links"]]
    created_product_ids: list[str] = []
    inserted_products = 0
    inserted_links = 0
    applied_link_patches: list[dict] = []
    applied_product_patches: list[dict] = []

    try:
        for batch in chunks(new_products, 100):
            client.insert("products", batch)
            created_product_ids.extend(str(row["id"]) for row in batch)
            inserted_products += len(batch)
        for batch in chunks(all_links, 200):
            client.insert("store_products", batch)
            inserted_links += len(batch)
        patched_links = 0
        for action in actions:
            for link_patch in action["link_patches"]:
                client.patch("store_products", str(link_patch["id"]), link_patch["values"])
                applied_link_patches.append(link_patch)
                patched_links += 1
        patched_products = 0
        for action in actions:
            if action["kind"] == "extend" and action["product_patch"]:
                client.patch("products", str(action["product_id"]), action["product_patch"])
                applied_product_patches.append(action)
                patched_products += 1
    except Exception as error:
        rollback_errors: list[str] = []
        for action in reversed(applied_product_patches):
            try:
                client.patch("products", str(action["product_id"]), action["product_previous"])
            except Exception as rollback_error:  # pragma: no cover - network contingency
                rollback_errors.append(str(rollback_error))
        for link_patch in reversed(applied_link_patches):
            try:
                client.patch("store_products", str(link_patch["id"]), link_patch["previous"])
            except Exception as rollback_error:  # pragma: no cover - network contingency
                rollback_errors.append(str(rollback_error))
        if created_product_ids:
            try:
                for batch_ids in (
                    created_product_ids[index:index + 100]
                    for index in range(0, len(created_product_ids), 100)
                ):
                    client.delete_ids("products", batch_ids)
            except Exception as rollback_error:  # pragma: no cover - network contingency
                rollback_errors.append(str(rollback_error))
        if rollback_errors:
            raise PublishError(
                f"Publication failed ({error}); rollback also failed: {'; '.join(rollback_errors)}"
            ) from error
        raise

    return {
        "applied_at": utc_now(),
        "inserted_products": inserted_products,
        "inserted_store_products": inserted_links,
        "patched_store_products": patched_links,
        "patched_products": patched_products,
    }


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def project_ref(base_url: str) -> str:
    return urlparse(base_url).netloc.split(".", 1)[0]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Enriched catalog matches JSON")
    parser.add_argument("--env-file", type=Path, default=Path("apps/scraper/.dev.vars"))
    parser.add_argument("--output-dir", type=Path, default=Path("catalog-output"))
    parser.add_argument("--expected-project-ref", help="Abort unless the Supabase URL matches this project ref")
    parser.add_argument("--apply", action="store_true", help="Apply the freshly generated plan")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    env = read_env(args.env_file)
    actual_ref = project_ref(env["SUPABASE_URL"])
    if args.expected_project_ref and actual_ref != args.expected_project_ref:
        raise PublishError(
            f"Supabase project mismatch: expected {args.expected_project_ref}, found {actual_ref}"
        )

    groups = json.loads(args.input.read_text(encoding="utf-8"))
    if not isinstance(groups, list):
        raise PublishError("Input JSON must contain a list of match groups")

    client = SupabaseRest(env["SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    backup = build_backup(client)
    backup_path = args.output_dir / f"catalog-backup-{timestamp}.json"
    write_json(backup_path, backup)

    plan = build_plan(groups, backup)
    plan["project_ref"] = actual_ref
    plan["backup_path"] = str(backup_path.resolve())
    plan["mode"] = "apply" if args.apply else "dry-run"
    plan_path = args.output_dir / f"catalog-plan-{timestamp}.json"
    write_json(plan_path, plan)

    result: dict[str, object] = {
        "mode": plan["mode"],
        "project_ref": actual_ref,
        "backup": str(backup_path.resolve()),
        "plan": str(plan_path.resolve()),
        "summary": plan["summary"],
    }
    if args.apply:
        result["result"] = apply_plan(client, plan)
        verification = build_backup(client)
        result["verified_catalog"] = {
            "products": len(verification["tables"]["products"]),
            "store_products": len(verification["tables"]["store_products"]),
        }
        result_path = args.output_dir / f"catalog-result-{timestamp}.json"
        write_json(result_path, result)
        result["result_file"] = str(result_path.resolve())

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, json.JSONDecodeError, PublishError) as error:
        print(f"catalog publication failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
