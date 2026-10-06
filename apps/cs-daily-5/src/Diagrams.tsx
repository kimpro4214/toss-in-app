export function Diagram({ kind }: { kind: 'queue' | 'pipeline' | 'layers' }) {
  const items = kind === 'queue' ? ['A', 'B', 'C'] : kind === 'pipeline' ? ['정점', 'VS', '래스터', 'PS', '픽셀'] : ['화면', '응용', '도메인', '어댑터'];
  return <figure className="diagram"><svg viewBox={`0 0 ${items.length * 86 + 24} 76`} role="img" aria-label={kind === 'queue' ? '먼저 들어간 A가 앞에 있는 FIFO 큐' : kind === 'pipeline' ? '정점부터 픽셀까지의 단순화한 렌더링 흐름' : '소프트웨어 책임 계층'}>
    {items.map((label, i) => <g key={label}><rect x={12 + i * 86} y="14" width="68" height="44" rx="10" fill={i === 0 ? '#3182f6' : '#eaf1fd'}/><text x={46 + i * 86} y="41" textAnchor="middle" fontSize="12" fill={i === 0 ? 'white' : '#355070'}>{label}</text>{i < items.length - 1 && <path d={`M ${82 + i * 86} 36 h 12 m -4 -4 l 4 4 -4 4`} stroke="#6b86aa" fill="none"/>}</g>)}
  </svg></figure>;
}
