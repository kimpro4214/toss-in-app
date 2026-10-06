import { readFileSync, writeFileSync } from 'node:fs';
const path = subject => new URL(`../src/content/${subject}.json`,import.meta.url);
const modify = (subject, fn) => {const qs=JSON.parse(readFileSync(path(subject),'utf8'));fn(qs);writeFileSync(path(subject),JSON.stringify(qs,null,2)+'\n')};
const patterns=['pat3cfs','pat3afs','pat3bfs','pat3dfs','pat3efs','pat4afs','pat4bfs','pat4cfs','pat4dfs','pat4efs','pat4ffs','pat4gfs','pat5afs','pat5bfs','pat5cfs','pat5dfs','pat5efs','pat5ffs','pat5gfs','pat5hfs','pat5ifs','pat5jfs','pat5kfs'];
modify('gof',qs=>{
  for(let i=0;i<23;i++)if(![1,5,12].includes(i))qs[i].sources=[{title:`GoF ${qs[i].topic} 원문 — MIT 공개 자료`,url:`https://people.csail.mit.edu/addy/pattern/${patterns[i]}.htm`}];
  qs[23].sources=[{title:'GoF 분류와 패턴 선택 — MIT 공개 원문',url:'https://people.csail.mit.edu/addy/pattern/chap1.htm'}];
});
modify('network',qs=>{for(const q of qs)if(/TLS|UDP|IP|HTTP\/2/.test(q.topic)){
  const protocol=/TLS/.test(q.topic)?'8446':/UDP/.test(q.topic)?'768':/HTTP\/2/.test(q.topic)?'9113':'791';
  q.sources.push({title:`IETF RFC ${protocol}`,url:`https://www.rfc-editor.org/rfc/rfc${protocol}.html`});
}});
modify('oop',qs=>{for(const q of qs)if(/LSP|후조건|상속 관계|지원하지/.test(q.topic))q.sources.push({title:'Liskov·Wing: Behavioral Subtyping 원 논문',url:'https://www.cs.cmu.edu/~wing/publications/LiskovWing94.pdf'})});
modify('cpp',qs=>{qs[0].code='int x = 1;\nint& r = x;\nr = 3;\n// 이 시점의 x는?';});
