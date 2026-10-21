import unittest

from catalog_matching import (
    Measurement,
    ProductRecord,
    classify_cuanto_category,
    has_variant_conflict,
    measurements_state,
    semantic_normalize,
)


def record(record_id: int, title: str, category: str = "Bebidas") -> ProductRecord:
    from catalog_matching import parse_measurements, tokens_for

    normalized = semantic_normalize(title)
    return ProductRecord(
        record_id=record_id,
        store="Disco" if record_id == 1 else "TaTa",
        source_category=category,
        title=title,
        url="https://example.com/product",
        normalized=normalized,
        tokens=tokens_for(normalized),
        measurements=parse_measurements(normalized),
    )


class CatalogMatchingTests(unittest.TestCase):
    def test_zero_and_sin_azucar_share_semantics(self):
        self.assertEqual(
            semantic_normalize("Coca-Cola Zero 3 L"),
            semantic_normalize("Coca Cola sin azúcar 3 litros"),
        )

    def test_equivalent_units_match(self):
        left = record(1, "Jugo marca 1.5 L")
        right = record(2, "Jugo marca 1500 ml")
        self.assertEqual(measurements_state(left, right), "exact")

    def test_different_sizes_conflict(self):
        left = record(1, "Jugo marca 1 L")
        right = record(2, "Jugo marca 1.5 L")
        self.assertEqual(measurements_state(left, right), "conflict")

    def test_different_bonus_sizes_conflict(self):
        left = record(1, "Yerba 1 kg + 250 g de regalo")
        right = record(2, "Yerba 1 kg + 100 g de regalo")
        self.assertEqual(measurements_state(left, right), "conflict")

    def test_weight_marker_is_not_misread_as_a_pack_count(self):
        product = record(1, "Paté al vacío x 150 g")
        self.assertEqual(
            [(item.dimension, item.value) for item in product.measurements],
            [("weight_g", 150.0)],
        )

    def test_prefix_multipack_is_detected(self):
        product = record(1, "Jabón 2 x 200 g")
        self.assertEqual(
            [(item.dimension, item.value) for item in product.measurements],
            [("count", 2.0), ("weight_g", 200.0)],
        )

    def test_one_sided_multipack_conflicts_with_single_unit(self):
        pack = record(1, "Agua sin gas 2.25 L x 4")
        single = record(2, "Agua sin gas 2.25 L")
        self.assertEqual(measurements_state(pack, single), "conflict")

    def test_bundle_gift_conflicts_with_plain_product(self):
        bundle = record(1, "Gin Tanqueray 750 ml + copa")
        plain = record(2, "Gin Tanqueray 750 ml")
        self.assertTrue(has_variant_conflict(bundle, plain))

    def test_wine_blend_conflicts_with_single_varietal(self):
        blend = record(1, "Vino Tannat Cabernet 750 ml")
        varietal = record(2, "Vino Tannat 750 ml")
        self.assertTrue(has_variant_conflict(blend, varietal))

    def test_frozen_bread_with_cheese_is_not_dairy(self):
        products = [
            record(1, "Pan de ajo picante 300 g", "Frescos"),
            record(2, "Pan de ajo picante con queso 300 g", "Congelados"),
        ]
        self.assertIsNone(classify_cuanto_category(products))

    def test_frozen_ravioli_with_meat_is_not_meat(self):
        products = [
            record(1, "Ravioles de carne y verdura 1 kg", "Frescos"),
            record(2, "Pack ravioles carne y verdura 1 kg", "Congelados"),
        ]
        self.assertIsNone(classify_cuanto_category(products))

    def test_frozen_milanesa_stays_in_meat(self):
        products = [
            record(1, "Milanesa de pollo 500 g", "Frescos"),
            record(2, "Milanesa pollo congelada 500 g", "Congelados"),
        ]
        self.assertEqual(classify_cuanto_category(products), "Carnes")

    def test_zero_and_original_conflict(self):
        left = record(1, "Coca Cola Zero 3 L")
        right = record(2, "Coca Cola Original 3 L")
        self.assertTrue(has_variant_conflict(left, right))

    def test_unspecified_and_zero_conflict(self):
        left = record(1, "Agua Frutté naranja 600 ml")
        right = record(2, "Agua Frutté naranja cero 600 ml")
        self.assertTrue(has_variant_conflict(left, right))

    def test_combined_flavor_is_not_plain_flavor(self):
        left = record(1, "Agua Frutté naranja 600 ml")
        right = record(2, "Agua Frutté mango naranja 600 ml")
        self.assertTrue(has_variant_conflict(left, right))

    def test_cheese_flavored_snack_stays_in_pantry(self):
        item = record(1, "Snack Doritos queso 28 g")
        item.source_category = "Almacen"
        self.assertEqual(classify_cuanto_category([item]), "Almacén")

    def test_fresh_yogurt_maps_to_dairy(self):
        item = record(1, "Yogur Conaprole frutilla 500 g")
        item.source_category = "Frescos"
        self.assertEqual(classify_cuanto_category([item]), "Lácteos")


if __name__ == "__main__":
    unittest.main()
