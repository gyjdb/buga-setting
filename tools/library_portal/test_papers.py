"""Boundary, provenance and unsafe/stale-asset regressions for academic pages."""
import hashlib
import html
import json
import re
import tempfile
import unittest
from pathlib import Path

import papers


class SourceBoundaryTests(unittest.TestCase):
    def test_chinese_excludes_editorial_and_adjacent_work(self):
        text = "# Batch\n## 一、选本\n### Alpha\n#### 题解\nA\n#### 正文\nB\n### Beta\nC\n## 二、编者说明\n### Alpha\nPRIVATE EDITING\n"
        section = papers.slice_zh(text, "Alpha")
        self.assertEqual(section, "### Alpha\n#### 题解\nA\n#### 正文\nB\n")
        self.assertNotIn("PRIVATE", section)

    def test_changed_or_duplicate_heading_fails(self):
        with self.assertRaises(ValueError):
            papers.slice_zh("## 一、选本\n### Alpha revised\ntext", "Alpha")
        with self.assertRaises(ValueError):
            papers.slice_zh("## 一、选本\n### Alpha\none\n### Alpha\ntwo", "Alpha")
        with self.assertRaises(ValueError):
            papers.slice_zh("## 二、编者说明\n### Alpha\ntext", "Alpha")

    def test_english_keeps_subheadings_but_not_next_work(self):
        text = "# Batch\n## Exact title\n**EXACT TITLE**\n\nBy A\n### Section\ntext\n## Next title\nwrong"
        section = papers.slice_en(text, "Exact title")
        self.assertIn("### Section\ntext", section)
        self.assertNotIn("Next title", section)
        body = papers.reading_body(section, "en")
        self.assertIn("By A", body)
        self.assertNotIn("EXACT TITLE", body)

    def test_math_uses_typst_and_distinguishes_display(self):
        body = "text $n(n - 1) \\/ 2$\n　　$ sum_(i=1)^n x_i $　　（一）\n　　D ＋ rD ＝ D（1 ＋ r）\n```\n$do_not_render$\n```"
        self.assertEqual(papers.math_fragments(body, "zh"), [
            {"expression": "n(n - 1) \\/ 2", "display": False},
            {"expression": "sum_(i=1)^n x_i", "display": True},
        ])
        self.assertNotEqual(papers.math_key("x", True), papers.math_key("x", False))

    def test_registered_sources_and_samples_exist(self):
        registry = papers.load_registry()
        root = papers.HERE.parents[1] / "organized_project"
        publication_dates = {row[1]: row[3] for row in papers._contents(papers.read_text(root / registry["contentsPath"]))}
        self.assertEqual(len(registry["papers"]), 20)
        self.assertEqual({p["id"] for p in registry["papers"] if p["webReady"]}, {"metcalfe", "alding", "stanhope"})
        for p in registry["papers"]:
            zh = papers.slice_zh(papers.read_text(root / p["sourceZhPath"]), p["sourceHeading"])
            en = papers.slice_en(papers.read_text(root / p["sourceEnPath"]), p["print"]["en_title"])
            fields = papers._fields(zh)
            self.assertEqual(fields["篇名"], p["sourceHeading"])
            self.assertEqual(fields["外文篇名"], p.get("sourceEnTitle", p["print"]["en_title"]))
            self.assertNotIn("## 二、编者说明", zh)
            self.assertTrue(en.strip())
            self.assertTrue(p["print"]["ready"])
            self.assertRegex(papers.world_date(publication_dates[p["sourceHeading"]], p["print"]["imprint_year"]), r"^(混沌纪年|第一纪) \d+ 年$")

    def test_publication_date_comes_from_contents_not_earlier_reading(self):
        venue = "1283 年宣读，《白塔学会年刊》混沌纪年 1286 年"
        self.assertEqual(papers.world_date(venue, "C.R. 1286"), "混沌纪年 1286 年")
        self.assertEqual(papers.world_date("专著，第一纪 238 年", "F.E. 238 · The Year of the Frozen Spring"), "第一纪 238 年")
        for stale in ("C.R. 1283", "F.E. 1286", ""):
            with self.subTest(stale=stale), self.assertRaisesRegex(ValueError, "disagrees"):
                papers.world_date(venue, stale)

    def test_missing_or_ambiguous_source_year_cannot_fall_back_to_print(self):
        for venue in ("未注明纪年", "第一纪 319 年刊出，第一纪 320 年订正"):
            with self.subTest(venue=venue), self.assertRaisesRegex(ValueError, "ambiguous"):
                papers.world_date(venue, "F.E. 319")


class AssetTests(unittest.TestCase):
    def setUp(self):
        temporary_root = papers.HERE.parents[1] / "tmp"
        temporary_root.mkdir(exist_ok=True)
        self.tmp = tempfile.TemporaryDirectory(dir=temporary_root)
        self.root = Path(self.tmp.name)
        self.url = "assets/papers/test.svg"
        path = self.root / self.url
        path.parent.mkdir(parents=True)
        path.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><path d="M0 0L1 1"/></svg>', encoding="utf-8")
        self.asset = {"url": self.url, "widthPt": 12, "heightPt": 12, "fontSizePt": 12, "baselinePt": 9,
                      "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
        self.reader = papers.AssetReader({"schemaVersion": 1, "papers": {}}, self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def test_missing_and_changed_asset_fail_closed(self):
        bad = dict(self.asset, url="assets/papers/missing.svg")
        with self.assertRaises(ValueError):
            self.reader.validate(bad)
        (self.root / self.url).write_text("modified", encoding="utf-8")
        with self.assertRaises(ValueError):
            self.reader.validate(self.asset)

    def test_external_and_traversal_assets_rejected(self):
        for url in ("https://example.com/x.svg", "../x.svg", "assets/papers/../../x.svg", "assets\\papers\\x.svg"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                self.reader.validate(dict(self.asset, url=url))

    def test_active_svg_rejected_even_with_matching_hash(self):
        path = self.root / self.url
        path.write_text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', encoding="utf-8")
        with self.assertRaises(ValueError):
            self.reader.validate(dict(self.asset, sha256=hashlib.sha256(path.read_bytes()).hexdigest()))

    def test_source_drift_requires_asset_refresh(self):
        manifest = {"schemaVersion": 1, "papers": {"test": {"languages": {"zh": {"source": {"sha256": papers.digest_text("original\n")}}}}}}
        reader = papers.AssetReader(manifest, self.root)
        reader.language("test", "zh", "original\n")
        with self.assertRaisesRegex(ValueError, "Stale"):
            reader.language("test", "zh", "changed\n")

    def test_formula_key_cannot_substitute_other_expression(self):
        data = {"math": {papers.math_key("x", False): dict(self.asset, expression="y", display=False)}}
        with self.assertRaisesRegex(ValueError, "disagrees"):
            self.reader.math(data, "x", False)

    def test_local_template_change_requires_export(self):
        relative = "tools/paper_pdf/template.typ"
        path = self.root / relative
        path.parent.mkdir(parents=True)
        path.write_bytes(b"original template\r\n")
        manifest = {"template": {"path": relative, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}}
        papers.verify_local_template(manifest, self.root)
        path.write_bytes(b"changed template\r\n")
        with self.assertRaisesRegex(ValueError, "template changed"):
            papers.verify_local_template(manifest, self.root)

    def test_public_build_without_template_skips_local_template_check(self):
        manifest = {"template": {"path": "tools/paper_pdf/template.typ", "sha256": "local-only-original-hash"}}
        papers.verify_local_template(manifest, self.root)

    def test_safe_semantics_and_formula_baseline(self):
        data = {"math": {papers.math_key("x", False): dict(self.asset, expression="x", display=False)}, "figures": {}}
        body = "#### 正文\n\n<script>alert(1)</script>\n\nA $x$ ［1］\n\n表一　测试\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n◇ 第二章略\n\n**引文**\n\n1. Author, Book.\n"
        rendered = papers.render_body(body, "zh", "test", self.reader, data)
        markup = rendered["html"]
        self.assertNotIn("<script>", markup)
        self.assertIn("&lt;script&gt;", markup)
        self.assertIn('data-math-format="typst"', markup)
        self.assertIn('data-depth-em="0.25000"', markup)
        self.assertIn('href="#zh-ref-1"', markup)
        self.assertIn('id="zh-ref-1"', markup)
        self.assertIn('class="paper-table"', markup)
        self.assertIn('aria-labelledby="zh-table-caption-', markup)
        self.assertIn('class="paper-omission"', markup)
        self.assertTrue(all('id="' + item["id"] + '"' in markup for item in rendered["toc"]))


if __name__ == "__main__":
    unittest.main()
