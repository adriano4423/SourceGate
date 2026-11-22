/* SourceGate deterministic scoring engine. Independent of UI and AI. */
(function(root){
const dims=[
 {id:'market',name:'商业市场占有率',en:'Market position',weight:15,items:[
 ['share','可比细分市场份额',40,'%', [1,3,5,10],'第三方行业报告；明确品类、区域、年度与分母。'],
 ['projects','近三年可核实同类项目',35,'个',[1,3,5,10],'合同／验收证明与客户回访，去除重复项目。'],
 ['repeat','重复采购客户比例',25,'%', [20,40,60,80],'可比客户清单及订单；明确统计周期。']]},
 {id:'finance',name:'财务状况（近三年）',en:'Financial resilience',weight:20,items:[
 ['current','三年最低流动比率',35,'倍',[0.8,1,1.2,1.5],'流动资产÷流动负债；三年经审计报表，同一币种／实体。'],
 ['equity','三年最低权益资产比',30,'%', [5,15,25,40],'权益÷总资产；任一年净资产为负须专项审查。'],
 ['cash','三年经营现金流为正年数',35,'年',[0,1,2,3],'按各年现金流量表统计；补充持续经营及审计意见。']]},
 {id:'tech',name:'技术创新',en:'Technical innovation',weight:15,items:[
 ['rd','三年平均研发投入占营收',30,'%', [0.5,1,2,4],'研发明细与财务对账；代理商使用相应品类模板。'],
 ['validation','公司技术规格符合率',45,'%', [70,85,95,100],'逐项技术偏差表与测试报告；关键技术规格不得豁免。'],
 ['innovation','近三年已验证创新应用',25,'项',[0,1,2,4],'有客户应用和性能数据；仅有专利不视为落地。']]},
 {id:'esg',name:'ESG 标准',en:'Responsible business',weight:15,items:[
 ['environment','环境控制完成项',35,'/4',[1,2,3,4],'四项：环境方针、能耗基线、量化减排目标、外部核查。'],
 ['social','劳动与安全控制完成项',35,'/4',[1,2,3,4],'四项：劳动政策、安全培训、事件记录、整改闭环。'],
 ['governance','治理控制完成项',30,'/4',[1,2,3,4],'四项：反贿赂、举报机制、利益冲突申报、管理层审查。']]},
 {id:'supply',name:'供应链管理',en:'Supply continuity',weight:20,items:[
 ['otd','近十二个月准时交付率',40,'%', [75,85,95,98],'按合同承诺日期及完整交付计算，明确订单样本。'],
 ['dual','关键物料合格双源覆盖率',35,'%', [20,40,60,80],'按关键 BOM 统计；替代源须完成技术资格验证。'],
 ['bcp','连续性控制完成项',25,'/4',[1,2,3,4],'四项：LLE 交期台账、应急预案、演练记录、次级供应商映射。']]},
 {id:'quality',name:'质量管理',en:'Quality assurance',weight:15,items:[
 ['fpy','近十二个月一次合格率',40,'%', [85,90,95,99],'按一致检验口径统计；附 FAT／出厂检验记录。'],
 ['capa','到期 CAPA 按时关闭率',35,'%', [60,75,90,98],'按到期整改项统计；无到期项需审批证据，不自动满分。'],
 ['qms','质量控制完成项',25,'/4',[1,2,3,4],'四项：有效 QMS、ITP/FAT、追溯记录、内审与纠正。']]}
];
function policy(){return {version:'CAPEX-1.0',company:'项目采购战略寻源',weights:dims.map(d=>d.weight),floors:dims.map(()=>60),admit:75,conditional:60,criteria:Object.fromEntries(dims.flatMap(d=>d.items.map(i=>[i[0],i[4]])))};}
function band(value,thresholds){if(value===null||value===''||value===undefined||!Number.isFinite(Number(value)))return 0;let x=Number(value);if(x>=thresholds[3])return 100;if(x>=thresholds[2])return 80;if(x>=thresholds[1])return 60;if(x>=thresholds[0])return 40;return 0;}
function valid(p){return p.weights.length===6&&p.floors.length===6&&p.weights.every(w=>Number.isFinite(w)&&w>0)&&Math.abs(p.weights.reduce((a,b)=>a+b,0)-100)<1e-8&&p.floors.every(v=>v>=0&&v<=100)&&p.conditional>=0&&p.admit<=100&&p.conditional<=p.admit&&dims.every(d=>d.items.every(i=>{let a=p.criteria[i[0]];return a&&a.length===4&&a.every(Number.isFinite)&&a.every((x,n)=>n===0||x>a[n-1]);}));}
function score(s,p){
 if(!valid(p))return {decision:'配置无效',tone:'red',reasons:['权重合计须为100%，分档阈值须严格递增。'],dimensions:[],raw:0,verified:0,coverage:0};
 let dimensions=dims.map((d,di)=>{let parts=d.items.map(i=>{let x=s.metrics[i[0]]??null;let points=band(x,p.criteria[i[0]]);let ev=s.evidence.find(e=>e.dimension===d.id&&e.state==='verified');return {id:i[0],name:i[1],value:x,points,weight:i[2],verified:!!ev};});return {...d,weight:p.weights[di],floor:p.floors[di],parts,raw:parts.reduce((a,c)=>a+c.points*c.weight/100,0),verified:parts.reduce((a,c)=>a+(c.verified?c.points*c.weight/100:0),0)};});
 let raw=dimensions.reduce((a,d)=>a+d.raw*d.weight/100,0),verified=dimensions.reduce((a,d)=>a+d.verified*d.weight/100,0),coverage=dimensions.reduce((a,d)=>a+(d.parts.every(i=>i.verified)?d.weight:0),0);
 let reasons=[],decision,tone='amber';
 if(s.redline){decision='不予准入';tone='red';reasons.push('已确认触发红线：'+s.redline);}
 else if(!s.submitted){decision='草稿';reasons.push('供应商尚未签署并提交。');}
 else if(!s.signatureValid||s.signPolicy!==p.version||!s.authorized||coverage<100||s.clarifications.some(c=>c.status!=='closed')||dimensions.some(d=>d.parts.some(i=>i.value===null))){decision='待核验 / 澄清';if(!s.signatureValid)reasons.push('签名缺失、已失效或尚未通过完整性验证。');if(s.signPolicy!==p.version)reasons.push('须按当前评分规则版本重新签署。');if(!s.authorized)reasons.push('签署人身份与授权尚未核实。');if(coverage<100)reasons.push('存在未经确认的维度证据。');if(s.clarifications.some(c=>c.status!=='closed'))reasons.push('存在未关闭的澄清。');if(dimensions.some(d=>d.parts.some(i=>i.value===null)))reasons.push('存在未填写指标。');}
 else if(dimensions.some(d=>d.verified<d.floor)||verified<p.conditional){decision='不予准入';tone='red';reasons.push(...dimensions.filter(d=>d.verified<d.floor).map(d=>`${d.name}低于${d.floor}分基准线`));if(verified<p.conditional)reasons.push('总分低于最低准入门槛。');}
 else if(verified<p.admit){decision='有条件准入';reasons.push('须制定整改、期限和限额，经审批后方可录入。');}
 else{decision='建议准入';tone='green';reasons.push('六维基准线、证据、签名和澄清检查均通过；待采购负责人审批。');}
 return {dimensions,raw,verified,coverage,decision,tone,reasons};
}
root.SourceGate={dims,policy,band,valid,score};if(typeof module!=='undefined')module.exports=root.SourceGate;
})(typeof window!=='undefined'?window:globalThis);
