# 本轮审计与恢复说明

基线HEAD cb2efd7；用户直接授权D64。此前D54–D63已经实施但未提交，完整起始状态见BASELINE.json。

- baseline：旧17份正文及00项目文件的原字节副本；仍保留原路径。
- prepared：本轮17份最终正文与迁出队列；与发布文件按SHA256核对。
- CHANGES.json、changelogs、diffs：212个编辑操作及完整差异。
- LORE_RELOCATIONS.json：21项命题、原句、原行和哈希。
- SOURCE_REVIEW、K20_STYLE_GATE、VERIFICATION：文体、跨文件和静态回归。
- BROWSER_REVIEW、PORTAL_TEST_OUTPUT：实际页面及搜索复核。
- portal_before / portal_after / portal_diffs / PORTAL_SOURCE_MAP：仓库外档案馆脚本的变更证据，恢复目标相对于迁移根目录，不能在副本目录直接运行这些脚本。

prepare.py重生成prepared、diff与日志；publish.py仅发布获授权的本轮正文与项目记录，拒绝覆盖不匹配的新正文。旧正文永不改写。checkpoint.py已存在的基线不会重建。verify.py只写本目录验证结果。

档案馆仍用原命令：在迁移根运行python tools/library_portal/build.py、python tools/library_portal/verify.py、node tools/library_portal/test_search.cjs。证据入库前的站点检查见portal_validation_before_evidence.json；全部源文件写完后再次构建，最终生成侧报告在site/library_portal/data/validation-report.json。后者不回抄源目录，避免循环改变构建快照。

本轮无新增AUTHOR_DECISION；原19项AUTHOR_ONLY和12项接口继续保留。18项PENDING_RELOCATION是安置队列，不是未决事实。
