# 公开快照的边界

公开版只收馆藏，由维护者本地的 `organized_project` 同步生成；每份文献保持原始字节，SHA256 见 `public-source-manifest.json`。现行法典由本地的现行清单选定，同步时写成 `tools/library_portal/data/canon.json`（路径、编号与哈希），公开构建据此标出现行正文；公开的 `portal_config.json` 带 `profile: public`，网站据此只显示馆藏的著录。

## 收录

- `01_CURRENT_CANON`：现行法典，只收现行清单选定的版本。
- `07_WORLD_GUIDE`：馆藏读物《银色联盟风土志》的正文与序。插图不在这里，随前端发布于 `tools/library_portal/web/assets/plates/`。
- `08_CLASSIC_PAPERS`：馆藏读物《联盟学术名篇》。`各批/` 下是各批中译与英文原刊的源稿，按批合卷，网站的学术文献页在构建时从这里截取正文，不另存一份；`联盟学术名篇.pdf` 是中译本合订一册，`原刊/` 下是二十份英文原刊，另有篇目页。PDF 在本地用 Typst 排印后入库，公开版照原件复制，Pages 工作流不重排；公开范围里只有这个目录收 PDF。篇目元数据在 `tools/library_portal/data/papers.json`，三篇网页全文的公式与图版是预生成的 SVG，随前端发布于 `tools/library_portal/web/assets/papers/`。
- `09_HOLDINGS`：其余馆藏文书，按门类分目录：法典与规章（部院办法与学界通则）、学术文献（评定、排行、期刊与年报）、百科与年表（《联盟百科全书》的学科史与院校词条、学科年表、历年年名）、公文与手稿。文件头记门类、分组、馆藏编号、发布者与世界内的年代。

馆藏的门类与分组定在 `tools/library_portal/data/categories.json`。

## 本地保留，未公开

- 作者决定、作者依据、项目总卷、现行清单与修订记录（`00_PROJECT`）。
- 提案、未决事项、底稿与候选稿（`02_PROPOSALS`、`03_UNRESOLVED`、`10_WORKING_DRAFTS`）。提案里的世界内文书经作者采纳以后才抽进 `09_HOLDINGS` 公开。
- 法典旧版与被取代的文本、参考资料、编校与审计记录（`01_CURRENT_CANON` 下的旧版、`04_REFERENCE`、`05_SUPERSEDED`、`90_AUDIT`），以及风土志的编者材料。
- 作者提供的原始世界观回答（`99_SOURCE_ARCHIVE_INDEX`），`06_HISTORY` 原始聊天记录及结构化对话导出。
- 来源档案中的账户、项目容器、完整导出与原始 memory 元数据。
- `.git`、`.agents`、`.codex`、`.impeccable`、缓存、技能与可执行文件。
- 旧 ChatGPT 打包工作区、段落索引、门户前后代码快照及历史设计研究截图。
- 风土志插图的提示词、备选图与逐张评审记录，以及作画法参照的扫描页。
- 学术名篇的排印脚本、模板与中间文件（模板用到 Windows 自带字体，在公开环境中无法照样重排），以及网页公式与图版的导出器 `export_paper_assets.py`。
- macOS 附属元数据 `._*` / `.DS_Store`。

机构名录只引已发布的文献，只有作者决定作依据的条目不进公开名录，见 [INSTITUTIONS.md](INSTITUTIONS.md)。公开版会将不能定位的正文引用标记为未定位；这不表示原材料不存在，也不表示已公开核验其内容。

## 完整性与部署

`verify.py` 检查公开语料的字节、现行清单、检索内容与链接；`verify_publication.py` 额外检查来源清单、字体与打包边界。只有 `site/library_portal/` 上传到 GitHub Pages。源文件和下载副本保持一致，不改写文献来适配界面。

后续更新由维护者在本地经作者确认后同步，更新来源清单并运行检查。页面计数读取本版实际索引。

## 仓库历史

2026-11-08 起公开仓库只收馆藏，git 历史从一次干净提交重新开始。此前公开过的作者决定、提案、法典旧版，以及 `archive/` 下 2026 年 3 月的早期文件，不再保留在公开仓库里。
