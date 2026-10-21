import unittest

from catalog_publish import build_plan, choose_measurement, normalize_url


def backup(products=None, links=None):
    return {
        "tables": {
            "stores": [
                {"id": "store-disco", "name": "Disco", "slug": "disco"},
                {"id": "store-tata", "name": "Ta-Ta", "slug": "ta-ta"},
                {"id": "store-dorado", "name": "El Dorado", "slug": "el-dorado"},
            ],
            "categories": [
                {"id": f"category-{index}", "name": name}
                for index, name in enumerate(("Almacén", "Bebidas", "Carnes", "Lácteos", "Limpieza"))
            ],
            "products": products or [],
            "store_products": links or [],
        }
    }


def group(records=None, **overrides):
    value = {
        "confidence": "high",
        "cuanto_category": "Bebidas",
        "active_store_count": 2,
        "duplicate_store": False,
        "minimum_score": 0.98,
        "canonical": {"source_store": "Disco"},
        "records": records or [
            {
                "store": "Disco",
                "title": "Coca-Cola Zero 1.5 L",
                "url": "https://www.disco.com.uy/product/coca-cola-zero/p/",
                "measurements": [{"dimension": "volume_ml", "value": 1500}],
                "metadata": {
                    "ok": True,
                    "name": "Coca-Cola Sin Azúcar 1,5 L",
                    "brand": "Coca-Cola",
                    "image_url": "https://images.example/coke.jpg",
                },
            },
            {
                "store": "TaTa",
                "title": "Coca Cola sin azúcar 1.5L",
                "url": "https://www.tata.com.uy/coca-cola-sin-azucar/p",
                "measurements": [{"dimension": "volume_ml", "value": 1500}],
            },
        ],
    }
    value.update(overrides)
    return value


class CatalogPublishTests(unittest.TestCase):
    def test_url_normalization_ignores_host_prefix_query_and_trailing_slash(self):
        left = normalize_url("HTTPS://WWW.DISCO.COM.UY/product/test/?utm_source=x")
        right = normalize_url("https://disco.com.uy/product/test")
        self.assertEqual(left, right)

    def test_measurement_prefers_cross_store_agreement(self):
        self.assertEqual(choose_measurement(group()), (1.5, "L"))

    def test_dry_plan_creates_product_and_two_links(self):
        plan = build_plan([group()], backup())
        self.assertEqual(plan["summary"]["create_products"], 1)
        self.assertEqual(plan["summary"]["create_store_products"], 2)
        action = plan["actions"][0]
        self.assertEqual(action["product"]["name"], "Coca-Cola Sin Azúcar 1,5 L")
        self.assertEqual(action["product"]["quantity"], 1.5)
        self.assertEqual(action["product"]["unit"], "L")

    def test_existing_url_extends_same_product_without_overwriting_curated_fields(self):
        products = [{
            "id": "product-1",
            "name": "Nombre curado",
            "brand": None,
            "quantity": 1.5,
            "unit": "L",
            "category_id": "category-1",
            "image_url": None,
        }]
        links = [{
            "id": "link-1",
            "product_id": "product-1",
            "store_id": "store-disco",
            "url": "https://disco.com.uy/product/coca-cola-zero/p",
        }]
        plan = build_plan([group()], backup(products, links))
        self.assertEqual(plan["summary"]["extend_products"], 1)
        action = plan["actions"][0]
        self.assertEqual(action["product_patch"], {
            "brand": "Coca-Cola",
            "image_url": "https://images.example/coke.jpg",
        })
        self.assertEqual(len(action["links"]), 1)
        self.assertEqual(action["links"][0]["store_id"], "store-tata")

    def test_multiple_existing_products_are_a_conflict(self):
        links = [
            {
                "id": "link-1", "product_id": "product-1", "store_id": "store-disco",
                "url": "https://disco.com.uy/product/coca-cola-zero/p",
            },
            {
                "id": "link-2", "product_id": "product-2", "store_id": "store-tata",
                "url": "https://tata.com.uy/coca-cola-sin-azucar/p",
            },
        ]
        products = [{"id": "product-1"}, {"id": "product-2"}]
        plan = build_plan([group()], backup(products, links))
        self.assertEqual(plan["summary"]["conflicts"], 1)
        self.assertEqual(plan["summary"]["actions"], 0)

    def test_stale_store_url_is_remediated_in_place(self):
        products = [{
            "id": "product-1", "name": "Coca-Cola", "brand": "Coca-Cola",
            "category_id": "category-1", "image_url": "image",
        }]
        links = [
            {
                "id": "link-disco", "product_id": "product-1", "store_id": "store-disco",
                "url": "https://disco.com.uy/product/old-coca-cola/p", "active": False,
            },
            {
                "id": "link-tata", "product_id": "product-1", "store_id": "store-tata",
                "url": "https://tata.com.uy/coca-cola-sin-azucar/p", "active": True,
            },
        ]
        plan = build_plan([group()], backup(products, links))
        self.assertEqual(plan["summary"]["conflicts"], 0)
        self.assertEqual(plan["summary"]["update_store_products"], 1)
        patch = plan["actions"][0]["link_patches"][0]
        self.assertEqual(patch["id"], "link-disco")
        self.assertEqual(patch["values"]["url"], "https://www.disco.com.uy/product/coca-cola-zero/p/")
        self.assertTrue(patch["values"]["active"])
        self.assertEqual(patch["previous"]["url"], "https://disco.com.uy/product/old-coca-cola/p")
        self.assertFalse(patch["previous"]["active"])

    def test_unvalidated_group_is_skipped(self):
        value = group()
        for record in value["records"]:
            record["metadata"] = {"ok": False}
        plan = build_plan([value], backup())
        self.assertEqual(plan["summary"]["actions"], 0)
        self.assertEqual(plan["summary"]["skipped_by_reason"]["validation:no-live-page"], 1)


if __name__ == "__main__":
    unittest.main()
