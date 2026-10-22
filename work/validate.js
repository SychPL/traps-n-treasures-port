const fs=require('fs');
const html=fs.readFileSync('remake/index.html','utf8');
const S='<'+'script>', E='</'+'script>';
const i1=html.lastIndexOf(S)+S.length, i2=html.lastIndexOf(E);
const js=html.slice(i1,i2);
fs.writeFileSync('work/_game.js',js);

// wyodrębnij tablicę LEVELS przez bilans nawiasów
const marker='const LEVELS=';
const st=js.indexOf(marker)+marker.length;
let i=st,depth=0,inStr=false,esc=false,q='';
for(;i<js.length;i++){
  const c=js[i];
  if(inStr){
    if(esc){esc=false;continue;}
    if(c==='\\'){esc=true;continue;}
    if(c===q){inStr=false;}
    continue;
  }
  if(c==='"'||c==="'"){inStr=true;q=c;continue;}
  if(c==='[')depth++;
  else if(c===']'){depth--;if(depth===0){i++;break;}}
}
const LEVELS=eval(js.slice(st,i));
let bad=0;
LEVELS.forEach((L,k)=>{
  const lens=[...new Set(L.map.map(r=>r.length))];
  const ok=lens.length===1&&lens[0]===80; if(!ok)bad++;
  const flat=L.map.join('');
  console.log(k,L.name,'| rows',L.map.length,'| len',lens.join(','),ok?'OK':'BAD',
    '| P',flat.includes('P'),'T',flat.includes('T'),'D',flat.includes('D'),'K',flat.includes('K'),
    '| signs',(flat.match(/S\d/g)||[]).length,'| npcs',(flat.match(/N[a-z]/g)||[]).length,
    '| items',(flat.match(/I/g)||[]).length,'| diamonds',(flat.match(/C/g)||[]).length);
});
console.log(bad?('MAPS BAD: '+bad):'MAPS OK');
