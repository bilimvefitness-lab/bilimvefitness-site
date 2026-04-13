import asyncio
import json
import unittest
from pathlib import Path

from app.db.portion_profile_store import JsonPortionProfileStore
from app.schemas.nutrition import ClarificationQuestion, NutritionParseResponse, ParsedNutritionItem
from app.services.nutrition_food_catalog_v2 import FoodCatalog, normalize_food_text
from app.services.nutrition_parser_v5 import NutritionParserServiceV5
from app.services.portion_learning import PortionLearningService


FIXTURE_DIR = (
    Path(__file__).resolve().parent
    / "fixtures"
    / "turkish_nutrition_regression_pack"
)
STORE_PATH = (
    Path(__file__).resolve().parent.parent
    / "data"
    / "test_artifacts"
    / "turkish_parser_regression_portions.json"
)


class TurkishNutritionRegressionPackTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        manifest_path = FIXTURE_DIR / "manifest.json"
        cls.manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        cls.case_files = [
            FIXTURE_DIR / file_name for file_name in cls.manifest["files"]
        ]
        cls.packs = [
            json.loads(file_path.read_text(encoding="utf-8"))
            for file_path in cls.case_files
        ]
        cls.cases_by_category = {
            pack["category"]: pack["cases"]
            for pack in cls.packs
        }

        STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        STORE_PATH.write_text("[]", encoding="utf-8")
        store = JsonPortionProfileStore(STORE_PATH)
        cls.parser = NutritionParserServiceV5(
            FoodCatalog(),
            PortionLearningService(store),
        )

    def test_unit_variations(self) -> None:
        self._run_category("unit_variations")

    def test_spelling_mistakes(self) -> None:
        self._run_category("spelling_mistakes")

    def test_common_turkish_shorthand(self) -> None:
        self._run_category("common_turkish_shorthand")

    def test_multi_line_meal_input(self) -> None:
        self._run_category("multi_line_meal_input")

    def test_mixed_clean_and_messy_input(self) -> None:
        self._run_category("mixed_clean_and_messy_input")

    def test_fallback_suggestions(self) -> None:
        self._run_category("fallback_suggestions")

    def _run_category(self, category: str) -> None:
        for case in self.cases_by_category[category]:
            with self.subTest(case_id=case["id"], input=case["input"]):
                result = asyncio.run(
                    self.parser.parse_text(case["input"], user_id="regression-suite")
                )
                self._assert_case_matches(category, case, result)

    def _assert_case_matches(
        self,
        category: str,
        case: dict,
        result: NutritionParseResponse,
    ) -> None:
        prefix = self._prefix(category, case)
        self.assertEqual(
            result.confidence_level,
            case["expected_overall_confidence"],
            msg=f"{prefix} overall confidence mismatch",
        )
        self.assertEqual(
            self._derive_case_resolution(result),
            case["expected_resolution"],
            msg=f"{prefix} case resolution mismatch",
        )
        self.assertEqual(
            len(result.parsed_items),
            len(case["expected_items"]),
            msg=f"{prefix} parsed item count mismatch",
        )

        questions_by_index = {
            question.item_index: question for question in result.clarification_questions
        }
        clarification_indices = [
            index
            for index, expected in enumerate(case["expected_items"])
            if expected["needs_clarification"]
        ]
        shared_fallback = case.get("expected_fallback", {"type": "none", "choices": []})
        shared_fallback_index = (
            clarification_indices[0]
            if shared_fallback.get("type") != "none" and len(clarification_indices) == 1
            else None
        )

        for index, (expected_item, actual_item) in enumerate(
            zip(case["expected_items"], result.parsed_items, strict=False)
        ):
            self._assert_item_matches(
                prefix=prefix,
                item_index=index,
                expected_item=expected_item,
                actual_item=actual_item,
                question=questions_by_index.get(index),
                shared_fallback=shared_fallback if index == shared_fallback_index else None,
            )

    def _assert_item_matches(
        self,
        *,
        prefix: str,
        item_index: int,
        expected_item: dict,
        actual_item: ParsedNutritionItem,
        question: ClarificationQuestion | None,
        shared_fallback: dict | None,
    ) -> None:
        item_prefix = f"{prefix} item[{item_index}]"
        expected_raw_food = expected_item.get("raw_food_name")
        if expected_raw_food is not None:
            self.assertEqual(
                normalize_food_text(actual_item.food_name),
                normalize_food_text(expected_raw_food),
                msg=f"{item_prefix} raw food name mismatch",
            )

        expected_name = expected_item.get("canonical_display_name")
        if expected_name is None:
            self.assertIsNone(
                actual_item.canonical_display_name,
                msg=f"{item_prefix} canonical food should be unresolved",
            )
        else:
            self.assertEqual(
                normalize_food_text(actual_item.canonical_display_name or ""),
                normalize_food_text(expected_name),
                msg=f"{item_prefix} canonical food mismatch",
            )

        expected_weight = expected_item.get("expected_weight_g")
        if expected_weight is not None:
            if expected_name is None and actual_item.estimated_weight_g is None:
                expected_weight = None
        if expected_weight is not None:
            self.assertAlmostEqual(
                actual_item.estimated_weight_g or 0.0,
                expected_weight,
                delta=0.51,
                msg=f"{item_prefix} estimated weight mismatch",
            )

        self.assertEqual(
            actual_item.confidence_level,
            expected_item["confidence_level"],
            msg=f"{item_prefix} confidence mismatch",
        )
        self.assertEqual(
            actual_item.needs_clarification,
            expected_item["needs_clarification"],
            msg=f"{item_prefix} clarification flag mismatch",
        )

        expected_fallback = expected_item.get("expected_fallback") or shared_fallback
        self._assert_fallback_matches(
            item_prefix=item_prefix,
            expected_fallback=expected_fallback or {"type": "none", "choices": []},
            question=question,
        )

    def _assert_fallback_matches(
        self,
        *,
        item_prefix: str,
        expected_fallback: dict,
        question: ClarificationQuestion | None,
    ) -> None:
        fallback_type = expected_fallback.get("type", "none")
        if fallback_type == "none":
            self.assertIsNone(
                question,
                msg=f"{item_prefix} unexpected clarification question",
            )
            return

        self.assertIsNotNone(
            question,
            msg=f"{item_prefix} expected clarification question is missing",
        )
        assert question is not None

        actual_choices = [choice.label for choice in question.choices]
        actual_suggestions = list(question.suggested_options)

        if fallback_type == "clarification_only":
            self.assertFalse(
                actual_choices,
                msg=f"{item_prefix} clarification should not include explicit choices",
            )
            self.assertFalse(
                actual_suggestions,
                msg=f"{item_prefix} clarification should not include suggestions",
            )
            return

        available = actual_choices or actual_suggestions
        self.assertTrue(
            available,
            msg=f"{item_prefix} expected clarification options are missing",
        )

        for expected_choice in expected_fallback.get("choices", []):
            normalized_expected = normalize_food_text(expected_choice)
            matched = any(
                normalized_expected in normalize_food_text(actual_choice)
                or normalize_food_text(actual_choice) in normalized_expected
                for actual_choice in available
            )
            self.assertTrue(
                matched,
                msg=(
                    f"{item_prefix} missing expected clarification choice "
                    f"'{expected_choice}'. Actual: {available}"
                ),
            )

    def _derive_case_resolution(self, result: NutritionParseResponse) -> str:
        if result.clarification_questions:
            if any(
                item.canonical_display_name is None
                for item in result.parsed_items
                if item.needs_clarification
            ):
                return "food_choice_fallback"
            return "portion_clarification"
        if result.confidence_level == "medium" or any(
            item.confidence_level == "medium"
            for item in result.parsed_items
        ):
            return "medium_confidence_direct"
        return "direct"

    def _prefix(self, category: str, case: dict) -> str:
        return f"[{category}] {case['id']} | {case['input']!r}"


if __name__ == "__main__":
    unittest.main()
