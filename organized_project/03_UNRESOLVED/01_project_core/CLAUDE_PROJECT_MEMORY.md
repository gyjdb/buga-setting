**Purpose & context**

Ethan is developing an elaborate fantasy worldbuilding project centered on the **Silver Alliance (银色联盟 / 布加巫师联盟)**, a magocratic floating-city civilization set in the Vonde (沃恩德) universe, loosely inspired by but deliberately diverging from *The Amber Sword (琥珀之剑)*. The project has two interlocking strands: (1) a comprehensive corpus of in-world institutional legal documents governing the Alliance's governance, military, magic, and civil systems; and (2) a planned novel (*《银袍》*) following the character William Pister (威廉·匹斯特) from youth through his role as the Alliance's founding architect.

The world centers on the Buga people (布加人/布加巫师)—long-lived wizard-craftspeople inhabiting floating sky-cities—as the founding ethnic group of the Alliance. 白银之民 is the broader umbrella category including Silver Elves (银精灵), Cloud Giants (云巨人), Buga wizards, and others with silver blood. The capital is 卡奈奇, with 白塔 and 卡奈奇 as the two cities of Buga orthodox succession. The formal national name is 布加巫师联盟; 银色联盟 is the common name; 联盟 is the short form.

Ethan's creative goal is a world that feels genuinely immersive—drawing on real-world institutional parallels (U.S. Congress, Chinese governmental architecture) for "爽感" (satisfying resonance) without direct copying. Documents read as genuine in-world institutional artifacts, not annotated design notes.

**Current state**

*Institutional corpus:* A large, version-controlled set of Markdown documents exists, organized across constitutional, parliamentary, executive, military, judicial, magic-law, and chartered-institution layers. Key completed or substantially advanced documents include: 宪章 (v0.4), 白银议会组织法, 白银执政院 (v2.7, 23 ministries), 防务基本法 (v2.3), 裁断体系组织法, 盟约监察院组织法 (v1.2), 内务治安部组织架构 (v2.2), 银烛会, 银色舰队统帅部, 大图书馆章程 (v1.8), 白塔章程 (v2.1), 白银学会章程 (v1.1), 魔法基本法, 法术环级标准, 环级认定规程, 禁魔分区规程, and others. A register-standardization pass has been completed or is underway across the corpus (replacing flowery epithets, classical constructions, and argumentative passages with modern legal register while preserving all substantive rules and canonical proper nouns).

*Creative writing:* A novel-quality fictional fragment depicting the catastrophic "fall event" (坠落事件)—a once-in-a-millennium superlimit mana tide causing a floating city to crash into the sea—has been drafted through v0.5 across four chapters, covering detection, evacuation, institutional response, and aftermath.

*Workflow:* Ethan works within a Claude.ai project. Source files are at /mnt/project/ (read-only); deliverables go to /mnt/user-data/outputs/. Ethan manually re-uploads finished drafts to the project library between turns and communicates in informal Mandarin.

**On the horizon**

- Remaining register-standardization rewrites across the full corpus queue
- Continued propagation of institutional changes across cross-referencing documents
- Canonical naming decisions for all placeholder character and city names in the fall-event narrative
- 公务职级通则 rename of the rank-name scheme (冕铭典卷序), currently on hold pending Ethan's aesthetic decision
- Novel drafting for *《银袍》*, beginning from William's youth and academy years at 圣埃博松学院

**Key learnings & principles**

*Magic system:* Magic works as 施法（引动法则→释放法术）—a caster channels through a focus, invokes the relevant subset of Māsha's inscribed laws (法则), and releases a tangible spell (法术). Laws are the world's underlying substrate, not tactile objects; they cannot be physically "grabbed" or "pressed." The 魔网 provides energy only; most spells draw from the caster's personal 魔力. 弦魔法 (string magic) is a parallel category to 神之下 magic, not a higher tier on the same scale—it has its own rings 1–14, and anything above ring 14 is necessarily string magic, but string magic is not necessarily above ring 14. 弦魔法 is an absolute red-line prohibition that cannot be used even in catastrophe. 禁魔 suppresses the act of casting itself rather than cutting energy.

*Civilization competence framing:* The Alliance vastly surpasses modern society—every citizen is a caster, institutions operate with near-instant magical communication, and emergency protocols are reflex-level rather than bureaucratic. A catastrophe like the fall event defeats Alliance engineering but not Alliance civilization.

*Institutional design principles:* No party apparatus exists in the Alliance—party-organ equivalents are structurally absent. Dual-designation placards (加挂牌子) are used extensively. The 公务职级通则 is a 废案 (abandoned draft) and should not be cited. 城邦院 is the current first chamber (city-states); 元老会 is the joint presidium (联合主席团)—these must not be confused.

*Document discipline:* Claude must not invent institutions or names not verifiable in the existing corpus. Corpus-wide grep verification before any institution rename is mandatory (the 城邦院 incident). 执政院 v2.7 is the canonical source for current department and bureau names. Ambiguities go to 衔接说明 notes rather than silent fixes. Number-diff discrepancies in register rewrites are traced to source before acceptance.

*Prose style (for fiction):* Avoid overuse of "不是X而是Y" sentence structures, staccato rhythmic patterns, and overwrought literary flourishes.

**Approach & patterns**

- Ethan confirms architectural direction before Claude drafts full documents; mechanical fixes can be fully delegated
- Ethan contributes his own revisions between rounds and expects honest structural critique, not validation
- Brief signals like "就这样吧" or "可以" mean approval to proceed
- Direct pushback when output doesn't meet expectations—Claude should take corrections seriously and propagate them
- Cross-document consistency is a priority: changes to one document must be flagged for synchronization across others via 衔接 notes
- Lore corrections from Ethan propagate immediately into all affected documents
- Worldbuilding decisions are confirmed before full drafting; judgment calls are flagged explicitly rather than decided unilaterally
- Documents are written in formal modern Chinese legal register (现代法律用语), avoiding classical constructions except for fixed institutional terms and canonical proper nouns; Simplified Chinese throughout

**Tools & resources**

- Claude.ai project with file system access: bash_tool and create_file against /mnt/project/ (read-only), /home/claude/ (working), /mnt/user-data/outputs/ (delivery)
- Python verification script for register rewrites: strips blockquote lines, computes Counter diffs on number tokens, compares article/heading sequences via regex, scans for banned classical patterns, spot-checks canonical proper nouns
- Fallback: bash heredoc (cat > filename << 'EOF') when create_file fails on large documents
- Source material: *The Amber Sword (琥珀之剑)* as inspiration (diverged from, not adapted)