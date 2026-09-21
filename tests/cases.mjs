// Shared behavioral fixtures; also generate portable MoonBit black-box tests.
export const base=()=>({openapi:'3.0.3',info:{title:'Orders',version:'1'},paths:{'/orders':{get:{responses:{'200':{description:'OK'}}}}}});
export const clone=v=>structuredClone(v);
export function documentWithSchema(schema,direction='request'){
 const d=base(),op=d.paths['/orders'].get;
 if(direction==='request')op.requestBody={content:{'application/json':{schema}}};
 else op.responses['200'].content={'application/json':{schema}};
 return d;
}
export const cases=[];
function add(name,oldDoc,newDoc,status,rule){cases.push({name,oldText:typeof oldDoc==='string'?oldDoc:JSON.stringify(oldDoc),newText:typeof newDoc==='string'?newDoc:JSON.stringify(newDoc),status,rule});}
function mutate(name,change,status,rule){const a=base(),b=clone(a);change(b,a);add(name,a,b,status,rule);}
function schemas(name,a,b,status,rule,direction='request'){add(name,documentWithSchema(a,direction),documentWithSchema(b,direction),status,rule);}
const p=(type='string',required=false)=>({name:'filter',in:'query',required,schema:{type}});
add('identical minimal document',base(),base(),'compatible');
mutate('removed operation',d=>d.paths={},'breaking','OPERATION_REMOVED');
mutate('added operation',d=>d.paths['/health']={get:{responses:{'200':{description:'OK'}}}},'compatible');
mutate('required query parameter',d=>d.paths['/orders'].get.parameters=[p('string',true)],'breaking','PARAMETER_REQUIRED');
mutate('optional query parameter',d=>d.paths['/orders'].get.parameters=[p()],'compatible');
mutate('optional becomes required',(b,a)=>{a.paths['/orders'].get.parameters=[p()];b.paths['/orders'].get.parameters=[p('string',true)]},'breaking','PARAMETER_REQUIRED');
mutate('removed parameter is uncertain',(b,a)=>a.paths['/orders'].get.parameters=[p()],'incomplete','PARAMETER_REMOVED');
mutate('path inheritance respected',(b,a)=>{a.paths['/orders'].parameters=[p('string',true)];b.paths['/orders'].parameters=[p('string',true)]},'compatible');
mutate('operation parameter overrides path item',(b,a)=>{a.paths['/orders'].parameters=[p('string',true)];a.paths['/orders'].get.parameters=[p()];b.paths['/orders'].parameters=[p('string',true)];b.paths['/orders'].get.parameters=[p()]},'compatible');
mutate('header names are case insensitive',(b,a)=>{a.paths['/orders'].get.parameters=[{...p(),name:'X-Key',in:'header'}];b.paths['/orders'].get.parameters=[{...p(),name:'x-key',in:'header'}]},'compatible');
mutate('serialization defaults normalized',(b,a)=>{a.paths['/orders'].get.parameters=[p()];b.paths['/orders'].get.parameters=[{...p(),style:'form',explode:true}]},'compatible');
mutate('serialization change',(b,a)=>{a.paths['/orders'].get.parameters=[p()];b.paths['/orders'].get.parameters=[{...p(),explode:false}]},'incomplete','SERIALIZATION_CHANGED');
schemas('request type change',{type:'string'},{type:'integer'},'breaking','TYPE_INCOMPATIBLE');
schemas('request integer widens to number',{type:'integer'},{type:'number'},'compatible');
schemas('request number narrows to integer',{type:'number'},{type:'integer'},'breaking','TYPE_INCOMPATIBLE');
schemas('response integer widens to number',{type:'integer'},{type:'number'},'breaking','TYPE_INCOMPATIBLE','response');
schemas('response number narrows to integer',{type:'number'},{type:'integer'},'compatible',undefined,'response');
schemas('request loses null',{type:'string',nullable:true},{type:'string'},'breaking','NULLABILITY');
schemas('request accepts null',{type:'string'},{type:'string',nullable:true},'compatible');
schemas('response gains null',{type:'string'},{type:'string',nullable:true},'breaking','NULLABILITY','response');
schemas('response loses null',{type:'string',nullable:true},{type:'string'},'compatible',undefined,'response');
schemas('request enum narrows',{type:'string',enum:['a','b']},{type:'string',enum:['a']},'breaking','ENUM_INCOMPATIBLE');
schemas('request enum widens',{type:'string',enum:['a']},{type:'string',enum:['a','b']},'compatible');
schemas('response enum widens',{type:'string',enum:['a']},{type:'string',enum:['a','b']},'breaking','ENUM_INCOMPATIBLE','response');
schemas('response enum narrows',{type:'string',enum:['a','b']},{type:'string',enum:['a']},'compatible',undefined,'response');
schemas('enum order irrelevant',{type:'string',enum:['a','b']},{type:'string',enum:['b','a']},'compatible');
schemas('request minimum rises',{type:'number',minimum:0},{type:'number',minimum:5},'breaking','BOUND_INCOMPATIBLE');
schemas('request minimum falls',{type:'number',minimum:5},{type:'number',minimum:0},'compatible');
schemas('response maximum rises',{type:'number',maximum:5},{type:'number',maximum:10},'breaking','BOUND_INCOMPATIBLE','response');
schemas('exclusive boundary',{type:'number',minimum:0},{type:'number',minimum:0,exclusiveMinimum:true},'breaking','EXCLUSIVE_BOUND');
schemas('string max length tightens',{type:'string',maxLength:20},{type:'string',maxLength:10},'breaking','BOUND_INCOMPATIBLE');
schemas('pattern change requires review',{type:'string',pattern:'a'},{type:'string',pattern:'b'},'incomplete','CONSTRAINT_REVIEW');
schemas('format change requires review',{type:'string',format:'uuid'},{type:'string',format:'email'},'incomplete','CONSTRAINT_REVIEW');
schemas('array items change',{type:'array',items:{type:'string'}},{type:'array',items:{type:'integer'}},'breaking','TYPE_INCOMPATIBLE');
schemas('array uniqueness added',{type:'array',items:{type:'string'}},{type:'array',items:{type:'string'},uniqueItems:true},'breaking','UNIQUE_ITEMS');
const obj=required=>({type:'object',properties:{id:{type:'string'}},required,additionalProperties:false});
schemas('request property becomes required',obj([]),obj(['id']),'breaking','REQUIRED_PROPERTY');
schemas('request required property relaxed',obj(['id']),obj([]),'compatible');
schemas('response loses required guarantee',obj(['id']),obj([]),'breaking','REQUIRED_PROPERTY','response');
schemas('response gains required guarantee',obj([]),obj(['id']),'compatible',undefined,'response');
schemas('request unknown properties become forbidden',{type:'object'},{type:'object',additionalProperties:false},'breaking','SCHEMA_FORBIDDEN');
schemas('response now emits arbitrary properties',{type:'object',additionalProperties:false},{type:'object'},'breaking','SCHEMA_FORBIDDEN','response');
schemas('response permits additive property under open contract',{type:'object'},{type:'object',properties:{id:{type:'string'}}},'compatible',undefined,'response');
schemas('request new optional property under open old contract needs its type accepted',{type:'object'},{type:'object',properties:{id:{type:'string'}}},'breaking','TYPE_INCOMPATIBLE');
mutate('required request body',d=>d.paths['/orders'].get.requestBody={required:true,content:{'application/json':{schema:{type:'string'}}}},'breaking','BODY_REQUIRED');
{const a=documentWithSchema({type:'string'}),b=clone(a);delete b.paths['/orders'].get.requestBody;add('body removed',a,b,'incomplete','BODY_REMOVED');}
{const a=documentWithSchema({type:'string'}),b=clone(a);b.paths['/orders'].get.requestBody.content={'text/plain':{schema:{type:'string'}}};add('request media removed',a,b,'breaking','MEDIA_TYPE_INCOMPATIBLE');}
mutate('response status added',d=>d.paths['/orders'].get.responses['404']={description:'missing'},'incomplete','RESPONSE_STATUS_ADDED');
{const a=documentWithSchema({type:'string'},'response'),b=base();add('response body removed',a,b,'breaking','RESPONSE_BODY_REMOVED');}
mutate('server changed',d=>d.servers=[{url:'https://api.example.test'}],'incomplete','SERVERS_CHANGED');
mutate('operation id changed',d=>d.paths['/orders'].get.operationId='listOrders','incomplete','OPERATION_ID_CHANGED');
mutate('auth cannot silently pass',d=>d.security=[{bearer:[]}],'incomplete','SECURITY_REVIEW');
mutate('callbacks not silently skipped',d=>d.paths['/orders'].get.callbacks={},'incomplete','CALLBACK_REVIEW');
schemas('allOf not silently skipped',{allOf:[{type:'string'}]},{allOf:[{type:'string'}]},'incomplete','UNSUPPORTED_SCHEMA');
schemas('readOnly explicitly unsupported',{type:'string',readOnly:true},{type:'string',readOnly:true},'incomplete','UNSUPPORTED_SCHEMA');
schemas('external refs not fetched',{$ref:'https://example.test/schema.json'},{$ref:'https://example.test/schema.json'},'incomplete','UNSUPPORTED_REF');
{const a=documentWithSchema({$ref:'#/components/schemas/A'}),b=clone(a);a.components={schemas:{A:{type:'string'}}};b.components={schemas:{A:{type:'integer'}}};add('local reference compared',a,b,'breaking','TYPE_INCOMPATIBLE');}
{const a=documentWithSchema({$ref:'#/components/schemas/A~1B~0C'});a.components={schemas:{'A/B~C':{type:'string'}}};add('JSON Pointer escapes',a,a,'compatible');}
{const a=documentWithSchema({$ref:'#/components/schemas/A'});a.components={schemas:{A:{$ref:'#/components/schemas/A'}}};add('reference cycle',a,a,'incomplete','CYCLIC_REF');}
{const a=documentWithSchema({$ref:'#/components/schemas/A'});a.components={schemas:{A:{type:'object',properties:{next:{$ref:'#/components/schemas/A'}}}}};add('recursive schema',a,a,'incomplete','SCHEMA_DEPTH');}
schemas('unresolved reference',{$ref:'#/components/schemas/Missing'},{$ref:'#/components/schemas/Missing'},'invalid');
schemas('invalid pointer escape',{$ref:'#/components/schemas/A~2'},{$ref:'#/components/schemas/A~2'},'invalid');
add('invalid JSON','{',base(),'invalid');
add('root array invalid','[]',base(),'invalid');
mutate('OpenAPI 3.1 rejected',d=>d.openapi='3.1.0','invalid');
mutate('missing info rejected',d=>delete d.info,'invalid');
mutate('empty responses invalid',d=>d.paths['/orders'].get.responses={},'invalid');
mutate('duplicate parameters invalid',d=>d.paths['/orders'].get.parameters=[p(),p()],'invalid');
schemas('invalid schema type',{type:'string'},{type:['string','null']},'invalid');
schemas('array missing items',{type:'string'},{type:'array'},'invalid');
schemas('negative length',{type:'string'},{type:'string',minLength:-1},'invalid');
schemas('inverted bounds',{type:'number'},{type:'number',minimum:5,maximum:1},'invalid');
schemas('required entries invalid',{type:'object'},{type:'object',required:[2]},'invalid');
schemas('type omission reviewed',{minimum:2},{minimum:2},'incomplete','IMPLICIT_TYPE');
mutate('malformed security is not anonymous',d=>d.security={bearer:[]},'invalid');
mutate('malformed security scopes',d=>d.security=[{bearer:'write'}],'invalid');
schemas('exclusive bound requires bound',{type:'number'},{type:'number',exclusiveMinimum:true},'invalid');
schemas('constraint type mismatch reviewed',{type:'string',minimum:2},{type:'string',minimum:2},'incomplete','CONSTRAINT_TYPE');
{const a=documentWithSchema({type:'string'},'response'),b=structuredClone(a);a.paths['/orders'].get.responses['200'].content['text/plain']={schema:{type:'string'}};add('response media removal is reviewed',a,b,'incomplete','RESPONSE_MEDIA_REMOVED');}
