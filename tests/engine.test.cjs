const assert=require('node:assert/strict');const {webcrypto}=require('node:crypto');const {dims,policy,score,band,valid}=require('../dist/engine.js');
let count=0;function test(n,f){f();count++;console.log('PASS '+n);}
const p=policy();function sample(){return {metrics:Object.fromEntries(dims.flatMap(d=>d.items).map(i=>[i[0],p.criteria[i[0]][2]])),evidence:dims.map(d=>({dimension:d.id,state:'verified'})),submitted:true,signPolicy:p.version,signatureValid:true,authorized:true,clarifications:[],redline:''};}
test('weights sum to 100',()=>assert.equal(p.weights.reduce((a,b)=>a+b),100));
test('all inner weights sum to 100',()=>dims.forEach(d=>assert.equal(d.items.reduce((a,i)=>a+i[2],0),100)));
test('boundary bands',()=>{assert.equal(band(.99,[1,3,5,10]),0);assert.equal(band(1,[1,3,5,10]),40);assert.equal(band(3,[1,3,5,10]),60);assert.equal(band(5,[1,3,5,10]),80);assert.equal(band(10,[1,3,5,10]),100);assert.equal(band(null,[1,3,5,10]),0);});
test('verified 80 is eligible',()=>{let r=score(sample(),p);assert.equal(r.verified,80);assert.equal(r.decision,'建议准入');});
test('one low dimension cannot be compensated',()=>{let s=sample();dims[0].items.forEach(i=>s.metrics[i[0]]=p.criteria[i[0]][0]);assert.equal(score(s,p).decision,'不予准入');});
test('missing evidence causes hold not rejection',()=>{let s=sample();s.evidence.pop();assert.equal(score(s,p).decision,'待核验 / 澄清');assert.equal(score(s,p).coverage,85);});
test('exact 60 is conditional',()=>{let s=sample();dims.flatMap(d=>d.items).forEach(i=>s.metrics[i[0]]=p.criteria[i[0]][1]);assert.equal(score(s,p).verified,60);assert.equal(score(s,p).decision,'有条件准入');});
test('invalid signature blocks eligibility',()=>{let s=sample();s.signatureValid=false;assert.equal(score(s,p).decision,'待核验 / 澄清');});
test('old policy signature blocks eligibility',()=>{let s=sample();s.signPolicy='CAPEX-0.9';assert.equal(score(s,p).decision,'待核验 / 澄清');});
test('unverified identity blocks eligibility',()=>{let s=sample();s.authorized=false;assert.equal(score(s,p).decision,'待核验 / 澄清');});
test('open and answered clarification block eligibility',()=>{let s=sample();for(let status of ['open','answered']){s.clarifications=[{status}];assert.equal(score(s,p).decision,'待核验 / 澄清');}s.clarifications=[{status:'closed'}];assert.equal(score(s,p).decision,'建议准入');});
test('confirmed redline overrides perfect score',()=>{let s=sample();s.redline='证书造假';assert.equal(score(s,p).decision,'不予准入');});
test('invalid policy cannot produce admission',()=>{let x=policy();x.weights[0]=99;assert.equal(valid(x),false);assert.equal(score(sample(),x).decision,'配置无效');x=policy();x.criteria.share=[1,1,2,3];assert.equal(valid(x),false);});
test('missing metric causes hold',()=>{let s=sample();s.metrics.share=null;assert.equal(score(s,p).decision,'待核验 / 澄清');});
(async()=>{let k=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);let data=new TextEncoder().encode('signed supplier snapshot'),sig=await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},k.privateKey,data);assert(await webcrypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},k.publicKey,sig,data));assert.equal(await webcrypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},k.publicKey,sig,new TextEncoder().encode('tampered supplier snapshot')),false);console.log('PASS cryptographic signature detects tampering');console.log(`${count+1} checks passed`);})();
