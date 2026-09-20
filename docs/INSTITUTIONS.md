# 机构名录与来源范围

[打开机构总目](https://gyjdb.github.io/buga-setting/#/institutions)。目前共 371 个独立条目：354 个现行机构及具名单位、8 个设施、4 个历史／已撤销机构和 5 个条件性机制。每个实体使用稳定 ID，分组与重复导航不另计数。

| 现行浏览分组 | 条目数 |
| --- | ---: |
| 议会与终局监护 | 7 |
| 执政院行政体系 | 77 |
| 禁术管制体系 | 45 |
| 内务治安体系 | 68 |
| 盟约监察体系 | 22 |
| 裁断体系 | 6 |
| 联盟防务体系 | 12 |
| 银烛会监察与预警体系 | 54 |
| 白塔知识守护体系 | 14 |
| 白银学会学术体系 | 18 |
| 大图书馆典藏体系 | 13 |
| 布加联盟储备系统 | 5 |
| 学派、行会与公共教育 | 13 |

完整阅读 `CURRENT_CANON_MANIFEST.json` 选定的 17 份正文，逐节核对组织法、章程、内设表格和实施附件；其路径与 SHA256 保存在名录覆盖清单中。机构数据属于展示层整理，不修改正文、原件或其权威状态。构建校验引用原文、行号与章节，详情链接到对应条款；文本匹配仅用于“全文提及”。

机构分组不建立行政隶属。内设、直属、隶属、双重领导、主管、监督、授权、任命、协作、业务联系及历史沿革按来源分别表达。议会、裁断、监察、学术自治和储备机关没有被统一挂在执政院下。

## 公开依据与资料边界

- 两项撤销决定使用公开的 `DECISION_LOG.md` 中 D35、D41；相应作者原答已在本地核对。原始聊天记录沿用[既有公开范围](PUBLICATION.md)，不因本次更新而公开打包。
- D62 中尚未确定实体与职权的“可能……小组”没有实例化。D63 确认六座堡垒存在，按现行名称作为设施收录。
- 各城邦治安、卫戍、储备区分库、公法分庭、执行分署、台网监控站等缺具名清单，仅保留类别说明。白塔分库是条件式条款，没有据此新建具名机构。
- 圣殿封存署、高阶魔核中心、部分行会和科处的资料较薄，未补造职责、负责人或日期。白银学院与银翼学院没有合并依据。
- 回收远征司有设立条款，未见过渡组建完成记录。现行建制不等于实际组建已完成。
- 银烛调和会议、特别审计组、弹劾审查会、疫害隔离统筹会、大图书馆入库鉴定组单列为条件性机制。年中通报会是活动，馆藏层、纯建筑地点和职级不作为机构。
- 巴贝尔白银图书馆是历史机构；现行章程对它的描述归入历史描述依据，不冒充设立文件。

## 维护与检查

维护 `tools/library_portal/data/institutions.json`，然后正常构建。机构 ID 创建后不随改名改变；别名与关系须有来源。保留旧 `#/browse?institution=…` 筛选，新详情用 `#/institution/<ID>`。资源使用相对路径。

```bash
python tools/library_portal/build.py
python tools/library_portal/verify.py
python tools/library_portal/verify_publication.py
python -m unittest discover -s tools/library_portal -p test_institutions.py
node tools/library_portal/test_institutions.cjs
node tools/library_portal/test_search.cjs
node tools/library_portal/test_frontend.cjs
```

公开版馆藏与全文提及数量由公开语料重算，可能少于本地工作区；机构实体数量相同。推送 main 后由 GitHub Actions 构建并部署，发布完成须同时检查工作流与实际网址。
