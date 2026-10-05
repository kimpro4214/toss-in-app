import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const directory = new URL('../src/content/', import.meta.url);
const questions = readdirSync(directory).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(new URL(f,directory),'utf8')));
const urls = [...new Set(questions.flatMap(q=>q.sources.map(s=>s.url)))];
const result=[];let cursor=0;
async function worker(){
  while(cursor<urls.length){const url=urls[cursor++];try{
    const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
    const body=await response.text();
    result.push({url,status:response.status,finalUrl:response.url,title:(body.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]??'').replace(/\s+/g,' ').trim(),questionIds:questions.filter(q=>q.sources.some(s=>s.url===url)).map(q=>q.id)});
  }catch(error){result.push({url,error:error.message})}}
}
await Promise.all(Array.from({length:4},worker));
mkdirSync(new URL('../reports/',import.meta.url),{recursive:true});
writeFileSync(new URL('../reports/sources.json',import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),note:'접속 검사. 문항의 정답 의미를 자동 증명하지 않습니다.',results:result.sort((a,b)=>a.url.localeCompare(b.url))},null,2)+'\n');
console.log(`출처 ${urls.length}개 확인, 성공 ${result.filter(r=>r.status===200).length}개`);
for(const r of result.filter(r=>r.status!==200))console.log(JSON.stringify(r));
