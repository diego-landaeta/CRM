// Fix sobre el import de ICTESS:
// 1) Forzar responsable_id según el CSV (datos más frescos)
// 2) Upsertear lead_utms con canal_detectado del CSV (sobreescribiendo nulls)
import fs from 'fs';
import pg from 'pg';

const PROJECT_ID = 4;
const CSV = '/tmp/ictess.csv';
const pool = new pg.Pool({ host:'localhost', port:5432, user:'crm_user', password:'CrmDB2026!Secure', database:'crm_prod_db' });
const query = (t,p) => pool.query(t,p);

function parseCsv(text) {
  const rows=[]; let row=[],cell='',inQ=false;
  for (let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(inQ){if(c==='"'&&n==='"'){cell+='"';i++}else if(c==='"')inQ=false;else cell+=c}else{if(c==='"')inQ=true;else if(c===','){row.push(cell);cell=''}else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell=''}else if(c==='\r'){}else cell+=c}}
  if(cell||row.length){row.push(cell);rows.push(row)}return rows;
}
const normEmail=s=>{const t=(s||'').trim().toLowerCase();return (!t||/no\s*suministrad/i.test(t)||!t.includes('@'))?null:t;};
const normPhone=s=>{const d=String(s||'').replace(/[^\d]/g,'');return d.length>=7?d.replace(/^0+/,''):null;};
function mapOrigen(raw){const o=(raw||'').trim().toLowerCase();if(o==='whatsapp')return 'whatsapp';if(o==='web')return 'organico';if(o==='facebook'||o==='instagram')return 'meta_ads';return 'directo';}
function cleanAsesora(raw){const s=(raw||'').trim();if(!s||s==='-')return null;return s.split(/\s+/)[0];}

const userCache = new Map();
async function findUserByName(name){
  if(!name)return null;
  if(userCache.has(name))return userCache.get(name);
  const aliases={antonio:'tony',samantha:'samantha'};
  const search=(aliases[name.toLowerCase()]||name).toLowerCase();
  const {rows}=await query(`SELECT id FROM users WHERE LOWER(nombre) LIKE $1 ORDER BY id LIMIT 1`,[`${search.split(' ')[0]}%`]);
  const id=rows[0]?.id||null;
  userCache.set(name,id);return id;
}

(async()=>{
  const text=fs.readFileSync(CSV,'utf-8');
  const rows=parseCsv(text);
  let updatedResp=0, updatedUtms=0, sinLead=0;
  for(let i=1;i<rows.length;i++){
    const r=rows[i];if(r.length<11||!r[0]?.trim())continue;
    const email=normEmail(r[1]);
    const phone=normPhone(r[2])||normPhone(r[13]);
    if(!email&&!phone)continue;
    const tecnico=cleanAsesora(r[8]);
    const canal=mapOrigen(r[10]);
    const respId=tecnico?await findUserByName(tecnico):null;

    // Buscar lead
    const params=[PROJECT_ID];let where=`project_id=$1 AND deleted_at IS NULL`;
    if(email){where+=` AND LOWER(email)=$${params.length+1}`;params.push(email);}
    else{where+=` AND regexp_replace(telefono,'[^0-9]','','g')=$${params.length+1}`;params.push(phone);}
    const {rows:lr}=await query(`SELECT id FROM leads WHERE ${where} LIMIT 1`,params);
    if(!lr[0]){sinLead++;continue;}
    const leadId=lr[0].id;

    // 1) Forzar responsable
    if(respId){
      await query(`UPDATE leads SET responsable_id=$1, updated_at=NOW() WHERE id=$2 AND (responsable_id IS DISTINCT FROM $1)`,[respId,leadId]);
      updatedResp++;
    }

    // 2) Upsert utms con canal real
    const existing=await query(`SELECT id, canal_detectado FROM lead_utms WHERE lead_id=$1`,[leadId]);
    if(existing.rows[0]){
      if(existing.rows[0].canal_detectado!==canal){
        await query(`UPDATE lead_utms SET canal_detectado=$1::utm_channel WHERE lead_id=$2`,[canal,leadId]);
        updatedUtms++;
      }
    }else{
      await query(`INSERT INTO lead_utms (lead_id, canal_detectado, created_at) VALUES ($1,$2::utm_channel,NOW())`,[leadId,canal]);
      updatedUtms++;
    }
  }
  console.log(`Resp actualizado: ${updatedResp}`);
  console.log(`Utms actualizado: ${updatedUtms}`);
  console.log(`Sin lead match:   ${sinLead}`);
  await pool.end();
})().catch(e=>{console.error(e);process.exit(1);});
