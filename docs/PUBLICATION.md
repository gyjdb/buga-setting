# 公开快照的边界

公开版从本地 `organized_project` 已确认材料生成；首次复制的每份文献保持原始字节，SHA256 见 `public-source-manifest.json`。现行正文仍由 `00_PROJECT/CURRENT_CANON_MANIFEST.json` 决定，不修改状态、作者权威、版本编号或来源关系。

## 收录

- `00_PROJECT`：作者依据、现行清单、项目总卷与决定记录。
- `01_CURRENT_CANON`、`02_PROPOSALS`、`03_UNRESOLVED`：保留实际状态与适用范围。
- `04_REFERENCE`、`05_SUPERSEDED`、`10_WORKING_DRAFTS`：参考、旧版、候选与修订说明。
- `07_WORLD_GUIDE`：馆藏读物《银色联盟风土志》的正文、序与编者材料（参考 `REFERENCE`）。插图不在这里，随前端发布于 `tools/library_portal/web/assets/plates/`。
- `90_AUDIT`：编校报告、决定定位、基线文献、修订快照及结构化记录。其中 `editorial_cleanup_2026-09-18` 与 `in_world_register_2026-09-18` 下的 `baseline/`、`prepared/` 是当时现行正文的整份副本，只随仓库保存，不进入站点索引与检索，以免同一段正文重复出现。
- `99_SOURCE_ARCHIVE_INDEX/external/回答.txt`：作者提供的原始世界观回答。

## 本地保留，未公开打包

- `06_HISTORY` 原始聊天记录及结构化对话导出。
- 来源档案中的账户、项目容器、完整导出与原始 memory 元数据。
- `.git`、`.agents`、`.codex`、`.impeccable`、缓存、技能与可执行文件。
- 旧 ChatGPT 打包工作区、段落索引、门户前后代码快照及历史设计研究截图。
- 风土志插图的提示词、备选图与逐张评审记录，以及作画法参照的扫描页。
- macOS 附属元数据 `._*` / `.DS_Store`。

原始报告中引用上述材料的路径、来源编号和适用限制不改写。公开版会将不能定位的正文引用标记为未定位；这不表示原材料不存在，也不表示已公开核验其内容。网站页脚提供本说明。

## 完整性与部署

`verify.py` 检查公开语料的字节、现行清单、检索内容与链接；`verify_publication.py` 额外检查来源清单、字体与打包边界。只有 `site/library_portal/` 上传到 GitHub Pages。源文件和下载副本保持一致，不改写文献来适配界面。

后续更新应有作者确认或明确版本依据，更新相应清单并运行检查。公开版数量小于本地工作区，页面计数读取本版实际索引。

## 仓库历史文件

早期根目录文献及 HTML 展示已归入 `archive/legacy-2026-03/`，另有一份与现有待决材料完全一致的副本被去重。新旧入口及 SHA256 见 `archive/README.md` 和 `archive/manifest.json`。归档不等于设定状态变更，也不将这些文件再次收录为独立来源。整理前的 Git 提交继续保留。
