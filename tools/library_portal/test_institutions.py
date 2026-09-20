"""Evidence failure cases and corpus-specific institutional boundaries."""
from copy import deepcopy
import json
from pathlib import Path
import unittest
from build import MarkdownIt, heading_slug
from institutions import compile_registry, HIERARCHY

HERE = Path(__file__).parent

class EvidenceValidation(unittest.TestCase):
    def setUp(self):
        self.doc={'id':'doc','path':'law.md','title':'组织法','searchable':True}
        self.text='# 条款\n\n设甲。\n\n# 条款\n\n设乙。\n'
        self.source={'path':'law.md','line':3,'section':'条款','quote':'设甲。','role':'establishes'}
        self.data={'categories':[{'id':'test'}],'coverage':[], 'legacy':{}, 'notes':[], 'institutions':[
            {'id':'org-a','name':'甲','aliases':[],'category':'test','status':'current','kind':'机构','summary':'设立甲。','sources':[self.source],'relations':[]},
            {'id':'org-b','name':'乙','aliases':[],'category':'test','status':'current','kind':'机构','summary':'设立乙。','sources':[dict(self.source,line=7,quote='设乙。')],'relations':[]}]}
    def compile(self):
        return compile_registry(self.data,{'law.md':self.doc},{'doc':self.text},MarkdownIt(),heading_slug,{'files':[]})
    def edge(self,target,typ='internal'):
        return {'type':typ,'target':target,'detail':'测试关系','sources':[deepcopy(self.source)]}
    def test_duplicate_heading_resolves_by_location(self):
        result=self.compile()
        self.assertEqual([r['sources'][0]['anchor'] for r in result['institutions']],['条款','条款-1'])
    def test_duplicate_id_rejected(self):
        self.data['institutions'][1]['id']='org-a'
        with self.assertRaisesRegex(ValueError,'ID 重复'):self.compile()
    def test_missing_document_rejected(self):
        self.source['path']='missing.md'
        with self.assertRaisesRegex(ValueError,'文件不存在'):self.compile()
    def test_changed_quote_rejected(self):
        self.source['quote']='设立了甲。'
        with self.assertRaisesRegex(ValueError,'引文或行号'):self.compile()
    def test_wrong_section_rejected(self):
        self.source['section']='另一条'
        with self.assertRaisesRegex(ValueError,'条款不匹配'):self.compile()
    def test_missing_target_rejected(self):
        self.data['institutions'][0]['relations']=[self.edge('org-missing')]
        with self.assertRaisesRegex(ValueError,'目标无效'):self.compile()
    def test_mixed_hierarchy_cycle_rejected(self):
        self.data['institutions'][0]['relations']=[self.edge('org-b','direct')]
        self.data['institutions'][1]['relations']=[self.edge('org-a','subordinate')]
        with self.assertRaisesRegex(ValueError,'循环'):self.compile()
    def test_reciprocal_cooperation_is_not_hierarchy(self):
        self.data['institutions'][0]['relations']=[self.edge('org-b','cooperation')]
        self.data['institutions'][1]['relations']=[self.edge('org-a','cooperation')]
        self.assertTrue(self.compile()['validation']['hierarchyAcyclic'])
    def test_manifest_drift_rejected(self):
        self.data['coverage']=[{'path':'old.md','sha256':'old'}]
        with self.assertRaisesRegex(ValueError,'现行正文清单'):self.compile()

class CorpusBoundaries(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data=json.loads((HERE/'data/institutions.json').read_text('utf-8'))
        cls.rows=cls.data['institutions'];cls.ids={r['id']:r for r in cls.rows}
    def named(self,name):return next(r for r in self.rows if r['name']==name)
    def test_autonomous_and_judicial_bodies_not_under_executive(self):
        for name in ['白银议会','盟约监察院','白银高等裁断庭','白塔奥维利亚','白银学会','银色联盟大图书馆','联盟储备院','银烛会']:
            pending=[self.named(name)];seen=set()
            while pending:
                row=pending.pop();self.assertNotEqual(row['name'],'白银执政院',name)
                if row['id'] in seen:continue
                seen.add(row['id']);pending += [self.ids[e['target']] for e in row['relations'] if e['type'] in HIERARCHY]
    def test_deep_units_and_non_original_entries(self):
        for name in ['许可证务科','封印学专家组','卡奈奇储备分库','回收远征司','民籍誓籍局','查阅司']:
            self.assertEqual(self.named(name)['status'],'current')
    def test_status_is_not_inherited_from_source(self):
        self.assertEqual(self.named('巴贝尔白银图书馆')['status'],'historical')
        self.assertEqual(self.named('巴贝尔白银图书馆')['sources'][0]['role'],'describes')
        self.assertTrue(self.named('巴贝尔白银图书馆')['sources'][0]['path'].startswith('01_CURRENT_CANON/'))
        self.assertEqual(self.named('银色舰队统帅部')['status'],'abolished')
        self.assertEqual(self.named('银色舰队司令部')['status'],'current')
    def test_generic_systems_and_job_titles_not_entities(self):
        names={r['name'] for r in self.rows}
        self.assertTrue(names.isdisjoint({'裁断体系','布加联盟储备系统','城邦卫戍军','守护法师','流动观测站','年中通报会'}))
    def test_same_named_units_not_merged(self):
        committees=[r for r in self.rows if r['name']=='学术委员会']
        self.assertEqual(len(committees),2)
        self.assertEqual(len({org['id'] for org in committees}),2)

if __name__=='__main__':unittest.main()
