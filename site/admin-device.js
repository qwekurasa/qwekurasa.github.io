window.AdminDevice={
  async load(){
    const record=await deviceRecord('readonly',store=>store.get('github'));
    if(!record)return '';
    const value=await crypto.subtle.decrypt({name:'AES-GCM',iv:record.iv},record.key,record.encrypted);
    return new TextDecoder().decode(value);
  },
  async save(token){
    const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(token));
    await deviceRecord('readwrite',store=>store.put({iv,key,encrypted},'github'));
  },
  async forget(){
    await deviceRecord('readwrite',store=>store.delete('github'));
  }
};

function deviceRecord(mode,operation){
  return new Promise((resolve,reject)=>{
    const open=indexedDB.open('portfolio-admin-device',1);
    open.onupgradeneeded=()=>open.result.createObjectStore('credentials');
    open.onerror=()=>reject(open.error);
    open.onsuccess=()=>{
      const database=open.result;
      const transaction=database.transaction('credentials',mode);
      const request=operation(transaction.objectStore('credentials'));
      transaction.oncomplete=()=>{database.close();resolve(request.result);};
      transaction.onabort=()=>{database.close();reject(transaction.error);};
    };
  });
}
