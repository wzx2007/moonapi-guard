// Rendering only: compatibility decisions are made by the MoonBit engine.
export function csvReport(report) {
 const cell=value=>{
  let text=String(value);
  // Spreadsheet import must not execute user-controlled formula cells.
  if(/^[\s\uFEFF]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
 };
 const rows=[['record_type','status','complete','severity','rule','operation','location','message'],
  ['summary',report.status,report.complete,'','','','',`${report.breaking_count} breaking; ${report.warning_count} review`],
  ...report.errors.map(message=>['error',report.status,report.complete,'error','','','',message]),
  ...report.findings.map(f=>['finding',report.status,report.complete,f.severity,f.rule,f.operation,f.location,f.message])];
 return rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
export function sarifReport(report) {
 const ids=[...new Set(report.findings.map(f=>f.rule))].sort();
 const rules=ids.map(id=>({id,shortDescription:{text:id.replaceAll('_',' ')}}));
 return {
  $schema:'https://json.schemastore.org/sarif-2.1.0.json',version:'2.1.0',
  runs:[{
   tool:{driver:{name:'MoonAPI Guard',version:report.version,rules}},
   invocations:[{executionSuccessful:report.errors.length===0,
    toolExecutionNotifications:report.errors.map(text=>({level:'error',message:{text}}))}],
   results:report.findings.map(f=>({
    ruleId:f.rule,ruleIndex:ids.indexOf(f.rule),level:f.severity==='breaking'?'error':'warning',
    message:{text:f.operation+': '+f.message},
    locations:[{logicalLocations:[{fullyQualifiedName:f.location||'/',kind:'member'}]}],
    properties:{operation:f.operation,severity:f.severity}
   })),
   properties:{analysisStatus:report.status,complete:report.complete}
  }]
 };
}
export const escapeHTML = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function textReport(r){
 const plain=s=>String(s).replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
 return [`MoonAPI Guard ${r.version} — ${r.status.toUpperCase()}`,`${r.breaking_count} breaking | ${r.warning_count} review | coverage ${r.complete?'complete within supported subset':'incomplete'}`,...r.errors.map(e=>`ERROR: ${plain(e)}`),...r.findings.map(f=>`[${plain(f.severity.toUpperCase())}] ${plain(f.rule)}\n  ${plain(f.operation)} · ${plain(f.location)}\n  ${plain(f.message)}`),'Compatibility applies only to documented contracts and the supported subset; it does not prove runtime behavior.'].join('\n');
}
export function markdownReport(r){
 // Entities preserve literal content without creating links, images, emphasis
 // or table delimiters, including when the input contains backslashes.
 const cell=s=>escapeHTML(s).replace(/[\\`*_{}\[\]()#+.!|~]/g,c=>'&#'+c.charCodeAt(0)+';').replace(/[\r\n]/g,' ');
 return `# MoonAPI Guard — ${r.status}\n\n${r.breaking_count} breaking · ${r.warning_count} review · coverage ${r.complete?'complete within supported subset':'incomplete'}\n\n`+r.errors.map(e=>`- Error: ${cell(e)}\n`).join('')+'\n| Severity | Rule | Operation | Location | Explanation |\n|---|---|---|---|---|\n'+r.findings.map(f=>`| ${[f.severity,f.rule,f.operation,f.location,f.message].map(cell).join(' | ')} |`).join('\n')+'\n\nScope: OpenAPI 3.0 JSON; documented contracts only. See docs/SUPPORT.md.\n';
}
export function htmlReport(r){
 return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MoonAPI Guard report</title><style>body{font:16px/1.6 system-ui;background:#f4f6f8;color:#152a30;margin:0;padding:40px}main{max-width:1080px;margin:auto}h1{font-size:36px}article{background:white;border:1px solid #dbe2e5;border-left:4px solid #dc7158;padding:20px;margin:14px 0;border-radius:8px}code{overflow-wrap:anywhere;font-size:13px}small{color:#52636a}.warning{border-left-color:#b89538}.error{color:#a12e30}</style><main><small>MOONAPI GUARD / COMPATIBILITY REPORT</small><h1>${escapeHTML(r.status.toUpperCase())}</h1><p>${r.breaking_count} breaking · ${r.warning_count} review · coverage ${r.complete?'complete within supported subset':'incomplete'}</p>${r.errors.map(e=>`<p class="error">${escapeHTML(e)}</p>`).join('')}${r.findings.map(f=>`<article class="${f.severity==='warning'?'warning':'breaking'}"><small>${escapeHTML(f.severity.toUpperCase())} · ${escapeHTML(f.rule)}</small><h2>${escapeHTML(f.operation)}</h2><p>${escapeHTML(f.message)}</p><code>${escapeHTML(f.location)}</code></article>`).join('')}<p>OpenAPI 3.0 JSON · documented contracts only. A clean result applies to the supported subset, not runtime behavior.</p></main></html>`;
}
