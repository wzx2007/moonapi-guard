import {mkdirSync,writeFileSync} from 'node:fs';
const old={
 openapi:'3.0.3',info:{title:'Northstar Orders API',version:'1.0.0'},
 paths:{
  '/orders':{get:{
   operationId:'listOrders',
   parameters:[
    {name:'limit',in:'query',schema:{type:'integer',minimum:1,maximum:100}},
    {name:'status',in:'query',schema:{type:'string',enum:['pending','shipped','delivered']}}
   ],
   responses:{'200':{description:'Order list',content:{
    'application/json':{schema:{type:'array',items:{$ref:'#/components/schemas/Order'}}}
   }}}
  }},
  '/health':{get:{responses:{'200':{description:'Healthy'}}}}
 },
 components:{schemas:{Order:{type:'object',required:['id','status'],properties:{
  id:{type:'integer'},status:{type:'string',enum:['pending','shipped','delivered']}
 },additionalProperties:false}}}
};
const breaking=structuredClone(old);breaking.info.version='2.0.0';delete breaking.paths['/health'];breaking.paths['/orders'].get.parameters[0].schema.maximum=50;breaking.paths['/orders'].get.parameters[1].required=true;breaking.paths['/orders'].get.parameters[1].schema.enum=['pending','shipped'];breaking.components.schemas.Order.properties.id.type='string';breaking.components.schemas.Order.required=['id'];breaking.components.schemas.Order.properties.status.enum.push('cancelled');
const compatible=structuredClone(old);compatible.info.version='1.1.0';compatible.paths['/orders'].get.parameters[0].schema.maximum=200;compatible.paths['/orders'].get.parameters[1].schema.enum.push('cancelled');compatible.paths['/metrics']={get:{responses:{'204':{description:'No content'}}}};
const security=structuredClone(old);security.info.version='2.0.0';security.paths['/orders'].get.security=[{bearer:[]}];security.components.securitySchemes={bearer:{type:'http',scheme:'bearer'}};
const review=structuredClone(old);review.info.version='1.2.0';review.paths['/orders'].get.responses['200'].headers={'X-Request-ID':{schema:{type:'string'}}};
mkdirSync(new URL('../examples/',import.meta.url),{recursive:true});
for(const [name,doc] of Object.entries({old,breaking,compatible,review,security}))writeFileSync(new URL(`../examples/${name}.json`,import.meta.url),JSON.stringify(doc,null,2)+'\n');
