import { useEffect, useRef, useState } from 'react';
import { Button } from '@toss/tds-mobile';
import type { Account, Position, Receipt, State } from './types';
import { defaultAccount, defaultPosition, initialState } from './state';
import { closeApp, createStore, native, setupNavigation, type Store } from './platform';
import { Icon, Title, type Tab } from './components';
import { AccountEditor, PositionEditor, ReceiptEditor } from './Editors';
import { Dashboard } from './Dashboard';
import { Fire } from './Fire';
import { Tax } from './TaxScreen';
import { toIncome } from './engine';
type Panel = { kind:'position'; value:Position } | { kind:'account'; value:Account } | { kind:'receipt'; value:Receipt };
export default function App() {
  const [s,setS] = useState(initialState), [tab,setTab] = useState<Tab>('income'), [panel,setPanel] = useState<Panel | null>(null);
  const [loading,setLoading] = useState(true), [error,setError] = useState(''), [status,setStatus] = useState(''), [saving,setSaving] = useState(false), [dirty,setDirty] = useState(false);
  const store = useRef<Store | null>(null), stateRef = useRef(s), panelRef = useRef(panel), tabRef = useRef(tab);
  stateRef.current = s; panelRef.current = panel; tabRef.current = tab;
  useEffect(() => { let active = true; createStore().then(async st => { const loaded = await st.load(); if (active) { store.current = st; setS(loaded); } }).catch(e => { if (active) setError(e.message || '저장소를 연결하지 못했어요. 새로고침으로 다시 시도해 주세요.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const back = () => { if (panelRef.current) { setPanel(null); setError(''); } else if (tabRef.current !== 'income') setTab('income'); else void closeApp(); };
  useEffect(() => setupNavigation(back), []);
  useEffect(() => { const pop = () => back(); window.addEventListener('popstate',pop); return () => window.removeEventListener('popstate',pop); }, []);
  useEffect(() => { const viewport=window.visualViewport; const resize=() => document.documentElement.classList.toggle('keyboard-open',!!viewport && window.innerHeight-viewport.height>150); viewport?.addEventListener('resize',resize); return () => { viewport?.removeEventListener('resize',resize); document.documentElement.classList.remove('keyboard-open'); }; },[]);
  function update(next:State) { setS(next); setDirty(true); setStatus(''); }
  function onError(message:string) { setError(message); window.scrollTo({ top:0 }); }
  async function save() { if (saving || !store.current) return; const snapshot = s; setSaving(true); setError(''); try { await store.current.save(snapshot); setStatus('저장했어요'); if (stateRef.current === snapshot) setDirty(false); } catch (e) { onError(e instanceof Error ? e.message : '저장하지 못했어요. 다시 저장해 주세요.'); } finally { setSaving(false); } }
  function open(next:Panel) { setError(''); setPanel(next); history.pushState({ panel:next.kind },'',location.href); window.scrollTo({ top:0 }); }
  function done(next:State) { update(next); setPanel(null); window.scrollTo({ top:0 }); }
  const editPosition = (p?:Position) => open({ kind:'position',value:p ? structuredClone(p) : defaultPosition(s.accounts[0].id) });
  const editAccount = (a?:Account) => open({ kind:'account',value:a ? structuredClone(a) : defaultAccount() });
  const editReceipt = (r?:Receipt) => open({ kind:'receipt',value:r ? structuredClone(r) : { id:crypto.randomUUID(),positionId:s.positions[0].id,date:`${s.tax.year}-01-01`,gross:0,foreignTax:0,nationalTax:0,localTax:0 } });
  if (loading) return <main className="app"><Title title="배당생활을 준비해요" subtitle="저장한 기록을 불러오고 있어요." /></main>;
  return <div className="app">
    {!native && <header className="browser-nav"><button aria-label="뒤로가기" onClick={back}><Icon kind="back" /></button><button className="brand" onClick={() => { setPanel(null); setTab('income'); }}><img src="/icon.svg" alt="" />배당생활</button><span className="nav-label">세후 배당 계산</span></header>}
    {error && <div className="global-alert" role="alert">{error}</div>}
    {!panel && dirty && <div className="save-banner"><span>저장하지 않은 변경이 있어요</span><Button size="small" variant="weak" disabled={saving || !store.current} onClick={() => void save()}>{saving ? '저장 중' : '저장하기'}</Button></div>}
    {panel?.kind === 'position' ? <PositionEditor state={s} initial={panel.value} onError={onError} onRemove={() => { if(s.receipts.some(r => r.positionId===panel.value.id)) onError("수령 기록이 있는 종목이에요. 기록을 먼저 정리해 주세요."); else done({...s,positions:s.positions.filter(v => v.id!==panel.value.id)}); }} onClose={() => setPanel(null)} onDone={p => done({ ...s,positions:[...s.positions.filter(v => v.id !== p.id),p] })} /> : panel?.kind === 'account' ? <AccountEditor state={s} initial={panel.value} onError={onError} onRemove={() => { if(s.accounts.length<=1 || s.positions.some(p => p.accountId===panel.value.id)) onError("종목이 없는 계좌만 삭제할 수 있어요. 계좌는 하나 이상 유지해 주세요."); else done({...s,accounts:s.accounts.filter(v => v.id!==panel.value.id)}); }} onClose={() => setPanel(null)} onDone={a => done({ ...s,accounts:[...s.accounts.filter(v => v.id !== a.id),a] })} /> : panel?.kind === 'receipt' ? <ReceiptEditor state={s} initial={panel.value} onError={onError} onRemove={() => done({...s,receipts:s.receipts.filter(v => v.id!==panel.value.id)})} onClose={() => setPanel(null)} onDone={r => { const p=s.positions.find(p => p.id===r.positionId)!; const previous=s.receipts.find(v => v.id===r.id && v.positionId===r.positionId); done({ ...s,receipts:[...s.receipts.filter(v => v.id !== r.id),{ ...r,incomeSnapshot:previous?.incomeSnapshot ?? toIncome(p,r.gross),accountKind:previous?.accountKind ?? s.accounts.find(a => a.id===p.accountId)!.kind }] }); }} /> : <main>
      {tab === 'income' ? <Dashboard state={s} update={update} editPosition={editPosition} editAccount={editAccount} /> : tab === 'fire' ? <Fire state={s} update={update} /> : <Tax state={s} update={update} editReceipt={editReceipt} />}
      <div className="save-area"><Button display="block" color="dark" variant="weak" disabled={saving || !store.current || !dirty} onClick={() => void save()}>{saving ? '저장하고 있어요' : dirty ? '입력한 내용 저장하기' : '저장된 내용이에요'}</Button><p aria-live="polite" role="status">{status || (dirty ? '변경한 내용은 저장 버튼을 눌러 보관해 주세요.' : '보유·소득 정보는 이 기기에 저장해요.')}</p></div>
    </main>}
    {!panel && <nav className="floating-tabs" aria-label="주요 화면">{([['income','내 배당'],['fire','FIRE'],['tax','세금·신고']] as const).map(([key,label]) => <button key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => { setTab(key); setError(''); window.scrollTo({ top:0 }); }}><Icon kind={key} /><span>{label}</span></button>)}</nav>}
  </div>;
}
