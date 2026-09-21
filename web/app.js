import {AnalysisController} from '/analysis-controller.js';
const controller=new AnalysisController(()=>new Worker('/worker.js',{type:'module'}));
import {escapeHTML as esc,htmlReport} from '/render.js';
const $=id=>document.getElementById(id);
let report=null,filter='all',revision=0,visibleLimit=200;
function idle(){ $('analyze').disabled=false;$('cancel').hidden=true; }
const messages={OPERATION_REMOVED:'已有接口被删除，仍调用它的客户端将受到影响。',PARAMETER_REQUIRED:'新增了必填参数，或将可选参数改为必填。',TYPE_INCOMPATIBLE:'字段类型变化，不再满足接收方的契约。',ENUM_INCOMPATIBLE:'枚举取值范围不再兼容。',REQUIRED_PROPERTY:'接收方要求必填的字段，发送方已不再保证提供。',BOUND_INCOMPATIBLE:'数值、长度或数量限制收紧，部分原有值可能不再被接受。',NULLABILITY:'发送方可能传递 null，但接收方不接受。',SECURITY_TIGHTENED:'鉴权要求收紧：旧凭据或权限范围可能不再足够。',SECURITY_SCHEME_CHANGED:'凭据定义发生变化，需要复核令牌或传输方式。',UNSUPPORTED_SCHEMA:'发现支持范围之外的 Schema 关键字，需要复核。'};
function invalidate(){$('notice').textContent='';revision++;controller.cancel();idle();report=null;$('export-json').disabled=true;$('export-html').disabled=true;$('summary').className='summary';$('summary').innerHTML='<div><span class="tiny">分析状态</span><h3>内容已更新</h3><p>请重新检查，生成与当前输入一致的报告。</p></div>';$('findings').replaceChildren();$('filters').hidden=true;$('more').hidden=true;}
for(const side of ['old','new']){
 $(side).addEventListener('input',invalidate);
 $(`${side}-file`).addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;invalidate();const ticket=revision;try{if(file.size>8_000_000)throw Error('文件过大，请使用小于 8 MB 的 JSON 文件。');const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()).replace(/^\uFEFF/,'');if(ticket!==revision)return;$(side).value=text;$(`${side}-label`).textContent=file.name;invalidate();$('notice').textContent='';}catch(error){if(ticket===revision)$('notice').textContent=error.message;}e.target.value='';});
}
async function load(){invalidate();const ticket=revision;try{const selected=$('scenario').value;const [a,b]=await Promise.all([fetch('/examples/old.json'),fetch(`/examples/${selected}.json`)]);if(!a.ok||!b.ok)throw Error('示例加载失败');const texts=await Promise.all([a.text(),b.text()]);if(ticket!==revision)return;$('old').value=texts[0];$('new').value=texts[1];$('old-label').textContent='old.json · 基准版本';$('new-label').textContent=`${selected}.json · 待发布版本`;invalidate();$('notice').textContent='';}catch(e){if(ticket===revision)$('notice').textContent=e.message;}}
$('load').addEventListener('click',load);
function findings(){
 const query=$('search').value.trim().toLowerCase();
 const items=report.findings.filter(f=>(filter==='all'||f.severity===filter)&&(!query||[f.operation,f.rule,f.message,f.location].some(v=>v.toLowerCase().includes(query))));
 $('more').hidden=items.length<=visibleLimit;
 $('findings').innerHTML=report.errors.map(e=>`<p class="errors">${esc(e)}</p>`).join('')+items.slice(0,visibleLimit).map(f=>`<article class="finding"><span class="badge ${f.severity==='warning'?'warning':''}">${f.severity==='warning'?'待复核':'破坏性变更'}</span><div><h3>${esc(f.operation)}<span class="rule">${esc(f.rule)}</span></h3>${messages[f.rule]?`<p>${esc(messages[f.rule])}</p>`:''}<p lang="en">${esc(f.message)}</p><code>${esc(f.location||'/')}</code></div></article>`).join('');
 if(!items.length&&!report.errors.length)$('findings').innerHTML=`<p class="empty">${report.status==='compatible'?'在支持范围内未发现兼容性问题。':'当前筛选下没有条目。'}</p>`;
}
function draw(){
 const titles={breaking:'发现兼容性风险',compatible:'支持范围内兼容',incomplete:'需要进一步复核',invalid:'无法分析此输入'};
 $('summary').className=`summary ${report.status}`;
 $('summary').innerHTML=`<div><span class="tiny">分析完成 · ${report.complete?'支持范围内覆盖完整':'分析覆盖不完整'}</span><h3>${titles[report.status]}</h3><p>${report.complete?'检查结果仅针对声明的接口契约。':'存在无效输入或未支持的结构，请查看下方详情。'}</p></div><div class="counts"><div><strong class="bad">${report.breaking_count}</strong><span>破坏性变更</span></div><div><strong class="warn">${report.warning_count}</strong><span>待复核</span></div></div>`;
 $('filters').hidden=report.findings.length===0;$('export-json').disabled=false;$('export-html').disabled=false;findings();
}
$('analyze').addEventListener('click',async()=>{
 invalidate();const ticket=revision;$('analyze').disabled=true;$('cancel').hidden=false;$('notice').textContent='正在后台分析…';
 try{
  const result=await controller.analyze($('old').value,$('new').value);
  if(ticket!==revision)return;
  report=result;filter='all';visibleLimit=200;$('search').value='';
  for(const b of document.querySelectorAll('[data-filter]'))b.setAttribute('aria-pressed',String(b.dataset.filter==='all'));
  $('notice').textContent='';draw();
 }catch(e){if(ticket===revision && e.name!=='AbortError')$('notice').textContent=e.message;}
 finally{if(ticket===revision)idle();}
});
$('cancel').addEventListener('click',()=>{invalidate();$('notice').textContent='已取消，可以修改输入后重新检查。';});
$('search').addEventListener('input',()=>{visibleLimit=200;if(report)findings();});
$('more').addEventListener('click',()=>{visibleLimit+=200;findings();});
for(const b of document.querySelectorAll('[data-filter]'))b.addEventListener('click',()=>{filter=b.dataset.filter;visibleLimit=200;for(const x of document.querySelectorAll('[data-filter]'))x.setAttribute('aria-pressed',String(x===b));findings();});
function download(type){if(!report)return;const blob=new Blob([type==='json'?JSON.stringify(report,null,2):htmlReport(report)],{type:type==='json'?'application/json':'text/html'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`moonapi-report.${type}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-json').addEventListener('click',()=>download('json'));$('export-html').addEventListener('click',()=>download('html'));
await load();
