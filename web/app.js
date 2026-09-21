import {analyze} from '/engine.js';
import {escapeHTML as esc,htmlReport} from '/render.js';
const $=id=>document.getElementById(id);
let report=null,filter='all';
const messages={OPERATION_REMOVED:'已有接口被删除，仍调用它的客户端将受到影响。',PARAMETER_REQUIRED:'新增了必填参数，或将可选参数改为必填。',TYPE_INCOMPATIBLE:'字段类型变化，不再满足接收方的契约。',ENUM_INCOMPATIBLE:'枚举取值范围不再兼容。',REQUIRED_PROPERTY:'接收方要求必填的字段，发送方已不再保证提供。',BOUND_INCOMPATIBLE:'数值、长度或数量限制收紧，部分原有值可能不再被接受。',NULLABILITY:'发送方可能传递 null，但接收方不接受。',SECURITY_REVIEW:'鉴权要求需要人工复核，第一版不会自动判断其兼容性。',UNSUPPORTED_SCHEMA:'发现支持范围之外的 Schema 关键字，需要复核。'};
function invalidate(){report=null;$('export-json').disabled=true;$('export-html').disabled=true;$('summary').className='summary';$('summary').innerHTML='<div><span class="tiny">分析状态</span><h3>内容已更新</h3><p>请重新检查，生成与当前输入一致的报告。</p></div>';$('findings').replaceChildren();$('filters').hidden=true;}
for(const side of ['old','new']){
 $(side).addEventListener('input',invalidate);
 $(`${side}-file`).addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>8_000_000)throw Error('文件过大，请使用小于 8 MB 的 JSON 文件。');$(side).value=(await file.text()).replace(/^\uFEFF/,'');$(`${side}-label`).textContent=file.name;invalidate();$('notice').textContent='';}catch(error){$('notice').textContent=error.message;}e.target.value='';});
}
async function load(){try{const selected=$('scenario').value;const [a,b]=await Promise.all([fetch('/examples/old.json'),fetch(`/examples/${selected}.json`)]);if(!a.ok||!b.ok)throw Error('示例加载失败');$('old').value=await a.text();$('new').value=await b.text();$('old-label').textContent='old.json · 基准版本';$('new-label').textContent=`${selected}.json · 待发布版本`;invalidate();$('notice').textContent='';}catch(e){$('notice').textContent=e.message;}}
$('load').addEventListener('click',load);
function findings(){
 const items=report.findings.filter(f=>filter==='all'||f.severity===filter);
 $('findings').innerHTML=report.errors.map(e=>`<p class="errors">${esc(e)}</p>`).join('')+items.map(f=>`<article class="finding"><span class="badge ${f.severity==='warning'?'warning':''}">${f.severity==='warning'?'待复核':'破坏性变更'}</span><div><h3>${esc(f.operation)}<span class="rule">${esc(f.rule)}</span></h3>${messages[f.rule]?`<p>${esc(messages[f.rule])}</p>`:''}<p lang="en">${esc(f.message)}</p><code>${esc(f.location||'/')}</code></div></article>`).join('');
 if(!items.length&&!report.errors.length)$('findings').innerHTML=`<p class="empty">${report.status==='compatible'?'在支持范围内未发现兼容性问题。':'当前筛选下没有条目。'}</p>`;
}
function draw(){
 const titles={breaking:'发现兼容性风险',compatible:'支持范围内兼容',incomplete:'需要进一步复核',invalid:'无法分析此输入'};
 $('summary').className=`summary ${report.status}`;
 $('summary').innerHTML=`<div><span class="tiny">分析完成 · ${report.complete?'支持范围内覆盖完整':'分析覆盖不完整'}</span><h3>${titles[report.status]}</h3><p>${report.complete?'检查结果仅针对声明的接口契约。':'存在无效输入或未支持的结构，请查看下方详情。'}</p></div><div class="counts"><div><strong class="bad">${report.breaking_count}</strong><span>破坏性变更</span></div><div><strong class="warn">${report.warning_count}</strong><span>待复核</span></div></div>`;
 $('filters').hidden=report.findings.length===0;$('export-json').disabled=false;$('export-html').disabled=false;findings();
}
$('analyze').addEventListener('click',async()=>{const button=$('analyze');button.disabled=true;$('notice').textContent='';await new Promise(r=>requestAnimationFrame(r));try{report=JSON.parse(analyze($('old').value,$('new').value));filter='all';for(const b of document.querySelectorAll('[data-filter]'))b.setAttribute('aria-pressed',String(b.dataset.filter==='all'));draw();}catch(e){invalidate();$('notice').textContent=`分析失败：${e.message}`;}finally{button.disabled=false;}});
for(const b of document.querySelectorAll('[data-filter]'))b.addEventListener('click',()=>{filter=b.dataset.filter;for(const x of document.querySelectorAll('[data-filter]'))x.setAttribute('aria-pressed',String(x===b));findings();});
function download(type){if(!report)return;const blob=new Blob([type==='json'?JSON.stringify(report,null,2):htmlReport(report)],{type:type==='json'?'application/json':'text/html'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`moonapi-report.${type}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-json').addEventListener('click',()=>download('json'));$('export-html').addEventListener('click',()=>download('html'));
await load();
