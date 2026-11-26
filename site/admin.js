const $=s=>document.querySelector(s);
const {labels:sectionLabels,sectionOf}=window.ProjectSections;
$('#f-section').replaceChildren(...Object.entries(sectionLabels).map(([key,label])=>new Option(label,key)));
let token='',savedProjectsSha='',cats=[],list=[],removed=[],pending=[],edit=null,dirty=false;
const esc=v=>String(v??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]);

const githubRepo='/repos/qwekurasa/qwekurasa.github.io';
const projectsPath='site/projects.js';
const mediaPath=/^img\/[a-z0-9_-]+\/[a-z0-9_.-]+\.(webp|jpe?g|png|gif)$/i;

async function github(endpoint,{method='GET',body}={}){
  const response=await fetch('https://api.github.com'+endpoint,{
    method,cache:'no-store',credentials:'omit',redirect:'error',
    headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok){
    if(response.status===401)throw new Error('Токен GitHub недействителен или истёк.');
    if(response.status===403)throw new Error('Проверьте доступ токена к qwekurasa.github.io и право Contents → Read and write.');
    throw new Error(result.message||'Ошибка GitHub '+response.status);
  }
  return result;
}

async function loadData(){
  const file=await github(githubRepo+'/contents/'+projectsPath);
  const source=new TextDecoder().decode(Uint8Array.from(atob(file.content),char=>char.charCodeAt(0)));
  const fields=/^\s*window\.CUSTOM\s*=\s*([\s\S]*?);\s*(?:window\.CATS\s*=\s*([\s\S]*?);\s*)?$/.exec(source);
  if(!fields)throw new Error('Не удалось прочитать проекты из GitHub.');
  const projects=JSON.parse(fields[1]),categories=fields[2]?JSON.parse(fields[2]):[];
  if(!Array.isArray(projects)||!Array.isArray(categories))throw new Error('Некорректные данные проектов.');
  savedProjectsSha=file.sha;
  list=projects;
  cats=categories;
}

async function login(savedToken=''){
  if($('#enter').disabled)return;
  token=savedToken||$('#pw').value.trim();
  if(!token){$('#pw').focus();return;}
  $('#enter').disabled=true;
  $('#lmsg').textContent='';
  try{
    const user=await github('/user');
    if(user.login!=='qwekurasa')throw new Error('Нужен токен аккаунта qwekurasa.');
    await loadData();
    render();renderCats();
    if(!savedToken){
      try{await window.AdminDevice.save(token);}
      catch{
        $('#device-status').textContent='Этот браузер не сохранил токен. При следующем входе введите его снова.';
        $('#device-status').hidden=false;
      }
    }
    $('#pw').value='';
    $('#login').hidden=true;
    $('#app').hidden=false;
  }catch(error){
    token='';
    $('#lmsg').textContent=error.message;
  }finally{
    $('#enter').disabled=false;
  }
}
$('#enter').onclick=()=>login();
$('#pw').onkeydown=e=>{if(e.key==='Enter')$('#enter').click()};
$('#logout').onclick=async()=>{
  if(dirty&&!confirm('Выйти без сохранения изменений?'))return;
  try{
    await window.AdminDevice.forget();
    token='';
    dirty=false;
    location.reload();
  }catch{
    $('#device-status').textContent='Не удалось удалить токен. Очистите данные этого сайта в браузере.';
    $('#device-status').hidden=false;
  }
};

function mark(){dirty=true;$('#bar').hidden=false;publish()}
function render(){
  $('#list').innerHTML=Object.entries(sectionLabels).map(([key,label])=>{
    const projects=list.map((p,i)=>({p,i})).filter(({p})=>sectionOf(p)===key);
    if(!projects.length)return '';
    return `<h3 class="admin-group-title">${label}</h3>${projects.map(({p,i},row)=>`<div class="pr"><span class="c">P${String(i+1).padStart(3,'0')}</span><span>${esc(p.name)}</span><div>
      <button class="ghost" data-a="move" data-i="${i}" data-to="${projects[row-1]?.i??''}" aria-label="Выше" ${row?'':'disabled'}>↑</button><button class="ghost" data-a="move" data-i="${i}" data-to="${projects[row+1]?.i??''}" aria-label="Ниже" ${row<projects.length-1?'':'disabled'}>↓</button><button class="ghost" data-a="edit" data-i="${i}">Изменить</button>${p.id?`<a class="btn ghost" href="https://qwekurasa.github.io/#p-c${esc(p.id)}" target="_blank" rel="noopener">Открыть ↗</a>`:''}</div></div>`).join('')}`;
  }).join('')||'<p class="pr note" style="display:block">Пока нет проектов.</p>';
}
$('#list').onclick=e=>{const b=e.target.closest('button');if(!b)return;const i=+b.dataset.i;
  if(b.dataset.a==='edit')open(i);
  else if(b.dataset.to!==''){const j=+b.dataset.to;[list[i],list[j]]=[list[j],list[i]];mark();render()}};

const BASE=['Сайт','Приложение','Бот','Дизайн','Инструмент'];
const used=()=>list.map(p=>p.type).filter(Boolean);
const allCats=()=>[...new Set([...BASE,...cats,...used()])];
function fillTypes(v){$('#f-type').innerHTML='<option value="">— без категории —</option>'+allCats().map(c=>`<option>${esc(c)}</option>`).join('')+'<option value="+">+ Своя категория…</option>';$('#f-type').value=v||'';$('#newcat').hidden=true}
function addCat(v){const c=v.trim().slice(0,40);if(!c)return;if(!allCats().includes(c)){cats.push(c);mark()}renderCats();return c}
function renderCats(){const u=used();$('#cats').innerHTML=allCats().map(c=>`<span class="btn ghost" style="cursor:default">${esc(c)}${cats.includes(c)&&!u.includes(c)?` <a href="#" data-c="${esc(c)}" title="Удалить" style="text-decoration:none">×</a>`:''}</span>`).join('')}
$('#cats').onclick=e=>{const a=e.target.closest('[data-c]');if(!a)return;e.preventDefault();cats=cats.filter(c=>c!==a.dataset.c);renderCats();mark()};
$('#c-add').onclick=()=>{if(addCat($('#c-new').value))$('#c-new').value=''};
$('#c-new').onkeydown=e=>{if(e.key==='Enter')$('#c-add').click()};
$('#f-type').onchange=()=>{const n=$('#f-type').value==='+';$('#newcat').hidden=!n;if(n){$('#f-cat').value='';$('#f-cat').focus()}};
$('#addCat').onclick=()=>{const c=addCat($('#f-cat').value);if(c)fillTypes(c)};
$('#f-cat').onkeydown=e=>{if(e.key==='Enter')$('#addCat').click()};
const F=['name','type','created','stack','platforms','link','pwa','device','folder','description','descriptionHeading','section'];
function syncSection(){
  const design=$('#f-section').value==='design';
  $('#project-details').hidden=design;
  $('#logo-picker').hidden=!design;
  $('#gallery-title').textContent=design?'Карусель проекта':'Галерея проекта';
  $('#gallery-note').textContent=(design?'Изображения будут показаны каруселью. ':'До пяти фото и GIF в ряд. Ширина зависит от пропорций файла. ')+ 'PNG, JPG, WebP и GIF. До 60 файлов, GIF зацикливаются и могут весить до 3 МБ.';
}
const colorFields=[
  {key:'backgroundColor',label:'Фон проекта',fallback:'#000000'},
  {key:'textColor',label:'Весь текст',fallback:'#e5e5ea'},
  {key:'titleColor',label:'Название проекта',fallback:'#dddde2'},
  {key:'descriptionColor',label:'Описание',fallback:'#94949a'},
].map(({key,label,fallback})=>{
  const row=document.createElement('label');
  const enabled=document.createElement('input');
  enabled.type='checkbox';
  enabled.setAttribute('aria-label','Задать цвет: '+label);
  const picker=document.createElement('input');
  picker.type='color';
  picker.setAttribute('aria-label','Цвет: '+label);
  enabled.onchange=()=>{picker.disabled=!enabled.checked;};
  row.append(enabled,picker,label);
  $('#project-colors').append(row);
  return {key,fallback,enabled,picker};
});
function loadProjectColors(project){
  for(const {key,fallback,enabled,picker} of colorFields){
    enabled.checked=/^#[0-9a-f]{6}$/i.test(project[key]||'');
    picker.value=enabled.checked?project[key]:fallback;
    picker.disabled=!enabled.checked;
  }
}
$('#f-section').onchange=syncSection;
$('#f-device').onchange=()=>{$('#pwaLbl').textContent=$('#f-device').value==='ipad'?'Адрес сайта — откроется в iPad (с https://)':'Адрес web-приложения — запустится в iPhone (с https://)'};
function open(i){edit={i,shots:(i==null?[]:list[i].shots||[]).map(s=>({...s})),feats:(i==null?[]:list[i].features||[]).map(f=>({h:f.h||'',p:f.p||'',ul:(f.ul||[]).join('\n')}))};
  const p=i==null?{}:list[i];fillTypes(p.type);F.forEach(k=>k!=='type'&&($('#f-'+k).value=p[k]||(k==='device'?'phone':k==='folder'?'1':'')));$('#f-device').onchange();
  loadProjectColors(p);
  $('#f-section').value=sectionOf(p);$('#project-details').open=false;syncSection();
  $('#galleryStatus').textContent='';
  edit.logo=typeof p.logo==='string'?{src:p.logo}:p.logo||null;
  $('#logo-file').value='';setLogoStatus('');drawLogo();
  $('#ftitle').textContent=i==null?'Project Editor · новый':'Project Editor · '+p.name;$('#del').hidden=i==null;
  edit.gallery=(p.gallery||[]).map(s=>({...s}));
  $('#form').hidden=false;drawShots();drawGallery();drawFeats();$('#form').scrollIntoView({behavior:'smooth'})}
$('#add').onclick=()=>open(null);
$('#cancel').onclick=()=>{if(edit.logo?.preview&&!edit.logo.saved)URL.revokeObjectURL(edit.logo.preview);edit=null;$('#form').hidden=true};

let logoLoading=false;
const logoSource=logo=>typeof logo==='string'?logo:logo?.src||'';
function setLogoStatus(message){
  const status=$('#logo-status');
  status.textContent=message;
  status.hidden=!message;
}
function drawLogo(){
  const preview=$('#logo-preview');
  const src=edit.logo?.preview||logoSource(edit.logo);
  preview.hidden=!src;
  $('#logo-remove').hidden=!src;
  if(src)preview.src=src;
  else preview.removeAttribute('src');
}
function replaceLogo(logo){
  if(edit.logo?.preview&&!edit.logo.saved)URL.revokeObjectURL(edit.logo.preview);
  edit.logo=logo;
  drawLogo();
}
$('#logo-remove').onclick=()=>{replaceLogo(null);setLogoStatus('');};
$('#logo-file').onchange=async event=>{
  const file=event.target.files[0],current=edit;
  event.target.value='';
  if(!file||!current||logoLoading)return;
  logoLoading=true;
  $('#done').disabled=true;
  const type=file.type||(/\.svg$/i.test(file.name)?'image/svg+xml':/\.png$/i.test(file.name)?'image/png':/\.jpe?g$/i.test(file.name)?'image/jpeg':'');
  let url;
  try{
    if(!['image/svg+xml','image/png','image/jpeg'].includes(type))throw new Error('Выберите SVG, PNG или JPG.');
    // Decode as an image, then store a small, transparent PNG on the site.
    url=URL.createObjectURL(file.slice(0,file.size,type));
    const image=new Image();image.src=url;
    await image.decode();
    const scale=Math.min(1,512/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
    canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw new Error('Логотип не удалось обработать.');
    if(edit!==current)return;
    replaceLogo({blob,preview:URL.createObjectURL(blob)});
    setLogoStatus('Логотип готов к сохранению.');
  }catch(error){if(edit===current)setLogoStatus(error.message);}
  finally{if(url)URL.revokeObjectURL(url);logoLoading=false;$('#done').disabled=galleryLoading;}
};

function drawShots(){$('#shots').innerHTML=edit.shots.map((s,k)=>`<div class="item"><img src="${s.preview||'/'+esc(s.src)}" alt="">
  <div><input data-k="${k}" data-f="h" placeholder="Заголовок фото" value="${esc(s.h)}" style="margin-bottom:6px">
  <textarea data-k="${k}" data-f="p" placeholder="Описание фото" style="min-height:60px">${esc(s.p)}</textarea>
  <div class="tools"><button class="ghost" data-k="${k}" data-a="up" ${k?'':'disabled'}>↑</button><button class="ghost" data-k="${k}" data-a="down" ${k<edit.shots.length-1?'':'disabled'}>↓</button><button class="ghost" data-k="${k}" data-a="rm">Убрать</button></div></div></div>`).join('')}
$('#shots').oninput=e=>{const t=e.target;if(t.dataset.f)edit.shots[t.dataset.k][t.dataset.f]=t.value};
$('#shots').onclick=e=>{const b=e.target.closest('button');if(!b)return;const k=+b.dataset.k,S=edit.shots;
  if(b.dataset.a==='rm')S.splice(k,1);else{const j=b.dataset.a==='up'?k-1:k+1;[S[k],S[j]]=[S[j],S[k]]}drawShots()};
function drawGallery(){$('#gallery').innerHTML=edit.gallery.map((s,k)=>`<div class="item"><img src="${s.preview||'/'+esc(s.src)}" alt="">
  <div><p class="note">Изображение ${k+1}${s.width&&s.height?' · '+s.width+' × '+s.height:''}</p><input data-k="${k}" placeholder="Описание изображения для доступности" value="${esc(s.alt)}">
  <div class="tools"><button class="ghost" data-k="${k}" data-a="up" aria-label="Выше изображение ${k+1}" ${k?'':'disabled'}>↑</button><button class="ghost" data-k="${k}" data-a="down" aria-label="Ниже изображение ${k+1}" ${k<edit.gallery.length-1?'':'disabled'}>↓</button><button class="ghost" data-k="${k}" data-a="rm">Убрать</button></div></div></div>`).join('')}
$('#gallery').oninput=e=>{if(e.target.matches('input'))edit.gallery[+e.target.dataset.k].alt=e.target.value};
$('#gallery').onclick=e=>{const b=e.target.closest('button');if(!b)return;const k=+b.dataset.k,S=edit.gallery;
  if(b.dataset.a==='rm'){const [s]=S.splice(k,1);if(s.preview)URL.revokeObjectURL(s.preview)}else{const j=b.dataset.a==='up'?k-1:k+1;if(j<0||j>=S.length)return;[S[k],S[j]]=[S[j],S[k]]}drawGallery()};
let galleryLoading=false;
$('#galleryFiles').onchange=async e=>{const current=edit,files=[...e.target.files];e.target.value='';if(galleryLoading)return;if(current.gallery.length+files.length>60){$('#galleryStatus').textContent='Можно добавить до 60 изображений. Удалите лишние или выберите меньше файлов.';return;}galleryLoading=true;$('#done').disabled=true;
  try{for(const f of files){if(!/^image\/(jpeg|png|webp|gif)$/.test(f.type))throw new Error('Поддерживаются PNG, JPG, WebP и GIF');
    $('#galleryStatus').textContent='Подготовка: '+f.name;const blob=await shrink(f),bm=await createImageBitmap(blob);const width=bm.width,height=bm.height;bm.close();
    if(edit!==current)break;current.gallery.push({blob,preview:URL.createObjectURL(blob),alt:'',file:0,width,height});drawGallery()}
    $('#galleryStatus').textContent='Изображения добавлены. Нажмите «Сохранить проект», чтобы опубликовать.';
  }catch(err){$('#galleryStatus').textContent='Ошибка: '+err.message}finally{galleryLoading=false;$('#done').disabled=logoLoading}};
function drawFeats(){$('#feats').innerHTML=edit.feats.map((f,k)=>`<div class="item f"><div><input data-k="${k}" data-f="h" placeholder="Название, например «Импорт выписки»" value="${esc(f.h)}">
  <textarea data-k="${k}" data-f="p" placeholder="Короткое описание" style="min-height:52px;margin-bottom:6px">${esc(f.p)}</textarea>
  <textarea data-k="${k}" data-f="ul" placeholder="Пункты списка — каждый с новой строки (необязательно)" style="min-height:52px">${esc(f.ul)}</textarea>
  <div class="tools"><button class="ghost" data-k="${k}" data-a="up" ${k?'':'disabled'}>↑</button><button class="ghost" data-k="${k}" data-a="down" ${k<edit.feats.length-1?'':'disabled'}>↓</button><button class="ghost" data-k="${k}" data-a="rm">Убрать</button></div></div></div>`).join('')}
$('#feats').oninput=e=>{const t=e.target;if(t.dataset.f)edit.feats[t.dataset.k][t.dataset.f]=t.value};
$('#feats').onclick=e=>{const b=e.target.closest('button');if(!b)return;const k=+b.dataset.k,S=edit.feats;
  if(b.dataset.a==='rm')S.splice(k,1);else{const j=b.dataset.a==='up'?k-1:k+1;[S[k],S[j]]=[S[j],S[k]]}drawFeats()};
$('#addF').onclick=()=>{edit.feats.push({h:'',p:'',ul:''});drawFeats()};
$('#files').onchange=async e=>{for(const f of e.target.files){const blob=await shrink(f);edit.shots.push({blob,preview:URL.createObjectURL(blob),h:'',p:''})}e.target.value='';drawShots()};

// Фото до 3 МБ сохраняются без перекодирования.
async function shrink(f){if(f.type==='image/gif'){if(f.size>3e6)throw new Error('GIF должен быть не больше 3 МБ');const looped=await window.GalleryMedia.loopGif(f);if(looped.size>3e6)throw new Error('GIF должен быть не больше 3 МБ');return looped;}if(f.size<=3e6&&/^image\/(jpeg|png|webp|gif)$/.test(f.type))return f;
  const bm=await createImageBitmap(f),c=document.createElement('canvas');c.width=bm.width;c.height=bm.height;c.getContext('2d').drawImage(bm,0,0);
  for(const q of[.95,.9,.85,.75]){const b=await new Promise(res=>c.toBlob(res,'image/webp',q));if(b.size<=3e6)return b}
  return new Promise(res=>c.toBlob(res,'image/webp',.7))}

$('#done').onclick=()=>{if(galleryLoading||logoLoading)return;const name=$('#f-name').value.trim();if(!name){$('#f-name').focus();return}
  const old=edit.i==null?null:list[edit.i],p={id:old?.id||Date.now().toString(36)};F.forEach(k=>p[k]=$('#f-'+k).value.trim());if(p.type==='+')p.type='';
  for(const {key,enabled,picker} of colorFields)if(enabled.checked)p[key]=picker.value;
  (old?.shots||[]).forEach(s=>{if(!edit.shots.some(n=>n.src===s.src))removed.push(s.src)});
  (old?.gallery||[]).forEach(s=>{if(!edit.gallery.some(n=>n.src===s.src))removed.push(s.src)});p.gallery=edit.gallery;
  const previousLogo=logoSource(old?.logo);
  if(previousLogo&&previousLogo!==logoSource(edit.logo))removed.push(previousLogo);
  if(edit.logo){p.logo=edit.logo;p.logo.saved=true;}
  p.shots=edit.shots;p.features=edit.feats.filter(f=>f.h.trim()).map(f=>({h:f.h.trim(),p:f.p.trim(),ul:f.ul.split('\n').map(x=>x.trim()).filter(Boolean)}));if(old)list[edit.i]=p;else list.push(p);
  edit=null;$('#form').hidden=true;mark();render();renderCats()};
$('#del').onclick=()=>{const p=list[edit.i];if(!confirm('Удалить «'+p.name+'»?'))return;
  [...(p.shots||[]),...(p.gallery||[])].forEach(s=>s.src&&removed.push(s.src));if(logoSource(p.logo))removed.push(logoSource(p.logo));list.splice(edit.i,1);edit=null;$('#form').hidden=true;mark();render();renderCats()};

const b64=b=>new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result.split(',')[1]);fr.readAsDataURL(b)});
let busy=false,again=false;
const projectMedia=p=>[...(p.shots||[]),...(p.gallery||[]),...(p.logo?.blob?[p.logo]:[])];
async function commitProjects(projects,files){
  const ref=await github(githubRepo+'/git/ref/heads/main');
  const head=ref.object.sha;
  const currentFile=await github(githubRepo+'/contents/'+projectsPath+'?ref='+head);
  if(currentFile.sha!==savedProjectsSha)throw new Error('Проекты уже изменились в GitHub. Перезагрузите редактор перед сохранением.');

  const pathsInUse=new Set(projects.flatMap(project=>[project.logo,...project.shots.map(shot=>shot.src),...project.gallery.map(item=>item.src)]));
  const deletions=[...new Set(removed)].filter(path=>mediaPath.test(path)&&!pathsInUse.has(path)&&!files.some(file=>file.path===path));
  const content='window.CUSTOM='+JSON.stringify(projects,null,1)+';\nwindow.CATS='+JSON.stringify(cats)+';\n';
  const gitPath=path=>({path:'site/'+path,mode:'100644',type:'blob'});
  const data=await github(githubRepo+'/git/blobs',{method:'POST',body:{content,encoding:'utf-8'}});
  const base=await github(githubRepo+'/git/commits/'+head);
  const tree=await github(githubRepo+'/git/trees',{method:'POST',body:{base_tree:base.tree.sha,tree:[
    {path:projectsPath,mode:'100644',type:'blob',sha:data.sha},
    ...files.filter(file=>pathsInUse.has(file.path)).map(file=>({...gitPath(file.path),sha:file.sha})),
    ...deletions.map(path=>({...gitPath(path),sha:null}))
  ]}});
  const commit=await github(githubRepo+'/git/commits',{method:'POST',body:{message:'Админка: обновление проектов',tree:tree.sha,parents:[head]}});
  await github(githubRepo+'/git/refs/heads/main',{method:'PATCH',body:{sha:commit.sha,force:false}});
  savedProjectsSha=data.sha;
}

async function publish(){if(busy){again=true;return}busy=true;$('#app').inert=true;$('#publish').hidden=true;const files=pending;
  try{let n=0,total=list.reduce((a,p)=>a+projectMedia(p).filter(s=>s.blob).length,0);
    for(const p of list)for(const s of projectMedia(p))if(s.blob){$('#bmsg').textContent=`Загрузка фото ${++n}/${total}…`;
      const {sha}=await github(githubRepo+'/git/blobs',{method:'POST',body:{content:await b64(s.blob),encoding:'base64'}}),path=`img/${p.id}/${crypto.randomUUID()}.${{'image/jpeg':'jpg','image/png':'png','image/gif':'gif'}[s.blob.type]||'webp'}`;
      files.push({path,sha});s.src=path;delete s.blob}
    $('#bmsg').textContent='Публикация…';
    const clean=list.map(p=>({...p,logo:logoSource(p.logo)||undefined,features:p.features||[],shots:(p.shots||[]).map(s=>({src:s.src,h:s.h||'',p:s.p||''})),gallery:(p.gallery||[]).map(s=>({src:s.src,alt:s.alt||'',file:Math.max(0,Math.min(2,Math.floor(Number(s.file)||0))),width:s.width||0,height:s.height||0}))}));
    await commitProjects(clean,files);
    removed=[];pending=[];dirty=false;$('#bmsg').textContent='Сохранено. GitHub Pages публикует обновление.';setTimeout(()=>{if(!dirty)$('#bar').hidden=true},6000);render()}
  catch(e){$('#bmsg').textContent='Ошибка: '+e.message;$('#publish').hidden=false}
  $('#app').inert=false;busy=false;if(again){again=false;publish()}}
$('#publish').onclick=publish;
addEventListener('beforeunload',e=>{if(dirty)e.preventDefault()});
window.AdminDevice.load().then(savedToken=>{
  if(savedToken&&!token&&!$('#pw').value)login(savedToken);
}).catch(()=>{});
