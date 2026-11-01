import React from 'react';

// Original illustration: body regions only; never use this figure to locate a
// needle. The additional points below are described in text, not plotted.
const pictured=[
 {n:1,name:'百会',code:'GV20',meridian:'督脉',place:'头顶中线附近。',intro:'传统配穴中常提及头部与精神状态；这不是疾病诊断或治疗处方。'},
 {n:2,name:'合谷',code:'LI4',meridian:'手阳明大肠经',place:'手背、拇指与食指之间的区域。',intro:'传统上常用于头面部相关配穴；孕期请先咨询专业人员。'},
 {n:3,name:'内关',code:'PC6',meridian:'手厥阴心包经',place:'前臂掌侧、手腕上方附近。',intro:'内关按压被研究用于恶心的辅助管理；不能替代止吐药或医生评估。'},
 {n:4,name:'足三里',code:'ST36',meridian:'足阳明胃经',place:'小腿前外侧、膝部下方附近。',intro:'传统配穴常与消化和体力有关；具体效果取决于个人情况。'},
 {n:5,name:'三阴交',code:'SP6',meridian:'足太阴脾经',place:'小腿内侧、内踝上方附近。',intro:'传统配穴中常见于妇科与消化相关讨论；孕期避免自行刺激。'}
];
const additional=[
 {name:'印堂',code:'EX-HN3',meridian:'经外奇穴',place:'前额两眉之间附近。',intro:'传统中常见于头面部相关配穴；应避开眼睛及皮肤受损处。'},
 {name:'神门',code:'HT7',meridian:'手少阴心经',place:'手腕掌侧、靠小指的一侧附近。',intro:'传统中常与情绪和睡眠相关讨论；胸痛等症状应及时就医。'},
 {name:'曲池',code:'LI11',meridian:'手阳明大肠经',place:'肘部外侧、肘横纹附近。',intro:'常见于上肢相关传统配穴；局部红肿或损伤时不要自行刺激。'},
 {name:'太冲',code:'LR3',meridian:'足厥阴肝经',place:'足背、拇趾与第二趾之间附近。',intro:'传统中常见于足部相关配穴；不能凭穴位名称判断肝脏疾病。'},
 {name:'涌泉',code:'KI1',meridian:'足少阴肾经',place:'足底前部附近。',intro:'传统中常见于足部配穴；足部破损或感觉减退时应先咨询医生。'}
];
function PointCard({point,illustrated=false}){
 return <article className="acupoint-card"><span aria-hidden="true">{illustrated?point.n:'+'}</span><div><h3>{point.name} <small>{point.code}</small></h3><p><strong>所属：</strong>{point.meridian}</p><p><strong>大致区域：</strong>{point.place}</p><p>{point.intro}</p></div></article>
}
export function AcupunctureEducation(){
 return <section className="acupoint-section" id="acupoints">
  <div className="section-title"><div><span className="eyebrow">认识经络 · 健康科普</span><h2>简单认识人体穴位</h2></div></div>
  <p className="muted">原创人体图仅标示大致身体区域，并非精确穴位定位图，也不能用于针刺或治疗。</p>
  <div className="acupoint-layout">
   <div className="acupoint-diagram"><svg viewBox="0 0 320 460" role="img" aria-label="简化人体正面示意，标出头顶、手部、腕上、小腿前外侧及小腿内侧的大致区域">
    <rect x="1" y="1" width="318" height="458" rx="28" fill="#f3faf7"/>
    <circle cx="160" cy="64" r="32" fill="#d8ede3" stroke="#76a994" strokeWidth="3"/>
    <path d="M128 104 Q160 93 192 104 L202 190 Q201 210 188 230 L194 359 Q195 381 207 393 L180 397 L159 274 L141 397 L113 393 Q126 378 126 358 L132 230 Q119 210 118 190 Z" fill="#d8ede3" stroke="#76a994" strokeWidth="3" strokeLinejoin="round"/>
    <path d="M126 112 Q100 122 87 156 L61 220 M194 112 Q220 122 233 156 L259 220" fill="none" stroke="#9fcbb7" strokeWidth="19" strokeLinecap="round"/>
    <path d="M61 220 L52 239 M259 220 L268 239" fill="none" stroke="#9fcbb7" strokeWidth="13" strokeLinecap="round"/>
    {[[160,32,1],[53,238,2],[241,185,3],[130,292,4],[181,350,5]].map(([x,y,n])=><g key={n}><circle cx={x} cy={y} r="15" fill="#08786a" stroke="white" strokeWidth="3"/><text x={x} y={y+5} textAnchor="middle" fontSize="13" fontWeight="700" fill="white">{n}</text></g>)}
    <text x="160" y="426" textAnchor="middle" fill="#477465" fontSize="13">正面 · 大致区域示意</text>
   </svg></div>
   <div className="acupoint-list">{pictured.map(point=><PointCard key={point.code} point={point} illustrated/>)}</div>
  </div>
  <div className="acupoint-extra"><h3>更多常见穴位 · 文字简介</h3><p className="muted">以下五处没有在人体图上标出，仅作概念介绍。</p><div className="acupoint-list">{additional.map(point=><PointCard key={point.code} point={point}/>)}</div></div>
  <div className="acupoint-facts"><h3>穴位科普：认识与证据</h3><div className="acupoint-facts-grid">
   <article><h4>经络与穴位</h4><p>经络和穴位是传统中医的知识体系；现代医学对针灸作用机制仍在研究，不能把示意图当作身体检查。</p></article>
   <article><h4>研究如何看</h4><p>针灸对部分慢性疼痛可能有帮助，但研究结果因病症和对照方式而异，不能推断每个穴位都能治疗疾病。</p></article>
   <article><h4>针刺与按压</h4><p>针刺应由有资质的人员采用无菌操作。按压也不应造成疼痛；感染、破损或感觉减退区域不要自行刺激。</p></article>
  </div></div>
  <div className="medical-note"><strong>安全提示：</strong>此处仅供健康教育，不提供针刺、艾灸或治疗指导；不要自行针刺。孕期、出血风险、使用抗凝药、免疫低下或皮肤破损等情况请先咨询医生。严重胸痛、呼吸困难或持续呕吐等情况应及时就医。<br/><span>参考资料：</span><a href="https://www.nccih.nih.gov/health/acupuncture-effectiveness-and-safety" target="_blank" rel="noreferrer">NCCIH：针灸的效果与安全性</a>；<a href="https://www.mskcc.org/cancer-care/patient-education/acupressure-nausea-and-vomiting" target="_blank" rel="noreferrer">MSK：内关按压与恶心</a>。</div>
 </section>
}
