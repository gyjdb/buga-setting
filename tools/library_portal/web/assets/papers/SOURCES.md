# 学术网页 SVG 的来源与维护

这些文件是正文数学排版与原稿插图的派生展示资产，不是另一份正文。

- `math/<sha256>.svg`：用 `papers.py` 的同一选篇与公式解析器，从三篇双语原稿提取原生 Typst 数学表达式，交 Typst 0.15.1 排版。哈希输入为 `inline\n<表达式>` 或 `display\n<表达式>`；表达式两端空白去除。未做 LaTeX 翻译，也未改公式内容。陈列公式采用原生 block equation，行内公式保留行内式样；上下边界按 glyph bounds 取值，防止裁掉上下标与积分／求和限。
- `<论文ID>/<zh或en>-figure-<图号>.svg`：直接只读导入 `tools/paper_pdf/template.typ` 的 `fig-old-1`、`fig-met-1/2/3`、`fig-stn-1/2`，分别导出两种语言。图形数据、曲线、格点和标字都来自原函数。包裹环境保持 `setup-en/setup-zh` 的本体字号（10.2/10pt）和行间距（0.6/0.85em），并照 `figblock` 去缩进、取消两端对齐；不能把图题的 8.8pt 或公式导出的零行距套在图本体上，否则多行菱形格标字会挤叠。网页图题仍从 Markdown 原稿读取。
- 篇目与选篇边界：`tools/library_portal/data/papers.json`；三篇为奥尔丁《论质数的疏密》、梅特卡夫《元素亲和表》、斯坦霍普《复工、收贴与银券通论》。源文件在 `organized_project/02_PROPOSALS/`，英文原刊与中文提案均保持原件。
- `tools/library_portal/data/paper-assets.json` 记录源切片哈希、原模板哈希、逐幅图题、SVG 哈希和尺寸；公式另记录实际字号和基线。修改了被选中的原稿、图题、模板或资产后应重新导出，不能只更新哈希掩盖差异。

在仓库根目录执行：

```text
python tools/library_portal/export_paper_assets.py
python tools/library_portal/export_paper_assets.py --check
```

导出需要本地 Typst，以及原排印采用的字体。公式用 New Computer Modern；插图英文按篇目登记的 `print.font_en`（本批为 New Computer Modern、Palatino Linotype），中文用 Times New Roman 与 SimSun。导出器没有复制字体文件，SVG 只有字形轮廓与矢量图形，不增加网页字体下载。字体仍适用各自的原许可，不因导出而改称为本项目的开放字体。

字体资料与许可入口：[New Computer Modern 上游发行页](https://ctan.org/pkg/newcomputermodern)、Microsoft 的 [Palatino Linotype](https://learn.microsoft.com/en-us/typography/font-list/palatino-linotype) 与 [SimSun](https://learn.microsoft.com/en-us/typography/font-list/simsun) 字体页（含 Licensing and redistribution info）。本次使用本机既有字体；没有把字体软件及其许可重新打包发布。

原模板的绘图依赖为 [CeTZ 0.3.4](https://github.com/cetz-package/cetz) 与 [cetz-plot 0.1.1](https://github.com/cetz-package/cetz-plot)；本地包的 `typst.toml` 与 `LICENSE` 记录其许可。依赖缓存仅在 `tmp/paper-assets/packages/`，不随网站发布。生成工具是 [Typst](https://github.com/typst/typst)，数学采用其 [原生 equation](https://typst.app/docs/reference/math/equation/) 排版。

正式门户构建仅读已提交的 SVG 和 manifest，不调用 Typst，不下载绘图包，也不要求 Windows 字体或 PDF 排印模板存在。SVG 本身不含外部字体、脚本、外部图片或外部引用；图形在网页上使用白纸底，数学可随文字主题调整明暗。手机端较长公式横向滚动，密集图可打开原尺寸查看。
