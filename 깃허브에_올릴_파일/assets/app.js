
(async () => {
'use strict';
// =====================================================================
// 1. DATA — data/ 와 sources/ 의 정적 CSV를 그대로 읽는다.
//    · 저장된 원자료는 반올림·덮어쓰기 하지 않는다 (화면 표시만 반올림).
//    · 빈 값은 null (0으로 바꾸지 않음).
// =====================================================================
const FILES = {
  financials: 'data/financials.csv',
  calculated_metrics: 'data/calculated_metrics.csv',
  quarterly_financials: 'data/quarterly_financials.csv',
  segments: 'data/segments.csv',
  production: 'data/production.csv',
  foreign_entities: 'data/foreign_entities.csv',
  foreign_entities_local_currency: 'data/foreign_entities_local_currency.csv',
  brand_sales: 'data/brand_sales.csv',
  price_snapshot: 'data/price_snapshot.csv',
  search_monthly: 'data/search_monthly.csv',
  events: 'data/events.csv',
  research_status: 'data/research_status.csv',
  source_index: 'data/source_index.csv',
  source_registry: 'data/source_registry.csv',
  audit_ledger: 'data/audit_ledger.csv',
  audit_source_links: 'data/audit_source_links.csv',
  nongshim_segments: 'data/nongshim_segments.csv',
  nongshim_region_revenue: 'data/nongshim_region_revenue.csv',
  nongshim_utilization: 'data/nongshim_utilization.csv',
  nongshim_annual_crosscheck: 'data/nongshim_annual_crosscheck.csv',
  raw_material_prices: 'data/raw_material_prices.csv',
  suppliers: 'data/suppliers.csv',
  sales_channels: 'data/sales_channels.csv',
  by_region_worldwide: 'sources/by_region_Worldwide_20230101-0000_20261027-2109.csv',
  by_region_us: 'sources/by_region_US_20230101-0900_20261027-2112.csv',
  top_worldwide: 'sources/searched_with_top-searches_queries_Worldwide_20230101-0000_20261027-2109.csv',
  top_us: 'sources/searched_with_top-searches_queries_US_20230101-0900_20261027-2112.csv',
  rising_worldwide: 'sources/searched_with_rising-searches_queries_Worldwide_20230101-0000_20261027-2109.csv',
  rising_us: 'sources/searched_with_rising-searches_queries_US_20230101-0900_20261027-2112.csv',
};
const bootEl = document.getElementById('app');
let RAW, EVIDENCE = [], VERIFY = null;
try {
  const get = async (u) => { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw new Error(`${u} (HTTP ${r.status})`); return r.text(); };
  RAW = Object.fromEntries(await Promise.all(Object.entries(FILES).map(async ([k, u]) => [k, await get(u)])));
  // 보조 자료: 없어도 대시보드는 동작
  try { EVIDENCE = JSON.parse(await get('sources/extracted_source_rows.json')); } catch (e) { EVIDENCE = []; }
  try { VERIFY = JSON.parse(await get('docs/handoff/검증결과.json')); } catch (e) { VERIFY = null; }
} catch (err) {
  bootEl.innerHTML = `<div class="boot-err"><h1>데이터를 불러오지 못했습니다</h1><p>${String(err.message).replace(/[<>&]/g, '')}</p>
  <p>이 대시보드는 <b>data/</b> 폴더의 CSV를 읽습니다. 파일을 더블클릭해서 열면(file://) 브라우저가 CSV 읽기를 막습니다.</p>
  <p>폴더에서 터미널을 열고 <code>py -m http.server 8000</code> (Mac: <code>python3 -m http.server 8000</code>) 실행 후 <b>http://localhost:8000</b> 으로 여세요.</p></div>`;
  return;
}
bootEl.removeAttribute('aria-busy');

const parseCSV = (t) => {
  t = t.replace(/^﻿/, '');
  const out = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); f = ''; if (row.length > 1 || row[0] !== '') out.push(row); row = []; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); out.push(row); }
  const [h, ...rs] = out;
  return rs.map((r) => Object.fromEntries(h.map((k, i) => [k.replace(/^﻿/, '').trim(), (r[i] ?? '').trim()])));
};
const N = (s) => (s === undefined || s === null || s === '' ? null : Number(s));
const R = {}; Object.keys(RAW).forEach((k) => { R[k] = parseCSV(RAW[k]); });

// 분석기간 2023~2025, 기본 2025. 2022는 성장률·평균잔액 계산에만 사용.
const YEARS = [2023, 2024, 2025];
const COMPANIES = { SY: { name: '삼양식품', short: '삼양', color: '#d4262c', soft: '#efb9b7' }, NS: { name: '농심', short: '농심', color: '#3d6fb6', soft: '#b9cbe6' } };
const coName = (c) => COMPANIES[c].name;
const ids = (s) => String(s || '').split(/[;,\s]+/).filter(Boolean);

const FIN = R.financials.map((r) => ({ c: r.company_id, year: +r.year, metric: r.metric, label: r.label, v: N(r.value), source: r.source, page: r.printed_page, note: r.note, audit: ids(r.audit_id) }));
const finRow = (y, m, c = S.company) => FIN.find((d) => d.c === c && d.year === y && d.metric === m);
const fin = (y, m, c = S.company) => finRow(y, m, c)?.v ?? null;
const MET = R.calculated_metrics.map((r) => ({ ...r, c: r.company_id, year: +r.year }));
const met = (y, k, c = S.company) => { const r = MET.find((d) => d.c === c && d.year === y); return r ? N(r[k]) : null; };
const metRow = (y, c = S.company) => MET.find((d) => d.c === c && d.year === y);
const QALL = R.quarterly_financials.map((q) => ({ c: q.company_id, period: q.period, year: +q.year, quarter: +q.quarter, revenue: N(q.revenue), cost: N(q.cost_of_sales), sga: N(q.sga), op: N(q.operating_profit), margin: N(q.operating_margin_pct), method: q.method, source: q.source, annual: q.annual_source, note: q.note, audit: ids(q.audit_ids) }));
const Qc = (c = S.company) => QALL.filter((q) => q.c === c);
const SEG = R.segments.map((s) => ({ year: +s.year, segment: s.segment, exports: N(s.exports), domestic: N(s.domestic), total: N(s.total), source: s.source, note: s.note, audit: ids(s.audit_ids) }));
const PROD = R.production.map((p) => ({ year: +p.year, plant: p.factory + ' ' + p.product, factory: p.factory, product: p.product, cap: N(p.capacity_value), prod: N(p.production_value), util: N(p.reported_time_utilization_pct), source: p.source, note: p.note, audit: ids(p.audit_ids) }));
const PLANTS = [...new Set(PROD.map((p) => p.plant))];
const FE = R.foreign_entities.map((f) => ({ year: +f.year, entity: f.entity, rev: N(f.revenue), growth: N(f.growth_pct), source: f.source, basis: f.basis, note: f.note, audit: ids(f.audit_id) }));
const ENTITIES = [...new Set(FE.map((f) => f.entity))];
const FEL = R.foreign_entities_local_currency.map((f) => ({ year: +f.year, entity: f.entity, rev: N(f.revenue), unit: f.unit, growth: N(f.growth_pct), source: f.source, note: f.note }));
const BRAND = R.brand_sales.map((b) => ({ year: +b.year, rev: N(b.revenue), scope: b.scope, evidence: b.evidence, source: b.source, cross: b.crosscheck, note: b.note }));
const PRICE = R.price_snapshot.map((p) => ({ ...p, perBag: N(p.price_per_bag_usd), price: N(p.price_usd), packs: N(p.pack_count) }));
const SEARCH = R.search_monthly.map((s) => ({ month: s.month.slice(0, 7), y: +s.month.slice(0, 4), m: +s.month.slice(5, 7), region: s.region, platform: s.platform, query: s.query, v: N(s.index), file: s.source_file, audit: ids(s.audit_id) }));
const PRECISION = (p) => (/^\d{4}-\d{2}-\d{2}$/.test(p) ? '일' : /^\d{4}-\d{2}$/.test(p) ? '월' : /^\d{4}-H[12]$/.test(p) ? '반기' : /^\d{4}-연말$/.test(p) ? '연말' : /^\d{4}$/.test(p) ? '연도' : '기타');
const SORTKEY = (p) => { const y = p.slice(0, 4); const pr = PRECISION(p); return pr === '일' ? p : pr === '월' ? p + '-15' : pr === '반기' ? `${y}-${p.endsWith('H1') ? '06-30' : '12-30'}` : `${y}-12-31`; };
const EVENTS = R.events.map((e, i) => ({ ...e, i, value: N(e.value), precision: PRECISION(e.period), key: SORTKEY(e.period), year: +e.period.slice(0, 4) })).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.i - b.i));
const REGIONS = { Worldwide: '전 세계', US: '미국', KR: '국내' };
const REGION_DESC = { Worldwide: 'Google Trends · 검색어 buldak · 전 세계', US: 'Google Trends · 검색어 buldak · 미국', KR: 'Naver DataLab · 불닭볶음면·까르보불닭 · 국내' };
const BY_REGION = { Worldwide: R.by_region_worldwide.map((r) => ({ name: r.Region, v: N(r.buldak) })), US: R.by_region_us.map((r) => ({ name: r.Region, v: N(r.buldak) })) };
const QUERIES = { Worldwide: { top: R.top_worldwide, rising: R.rising_worldwide }, US: { top: R.top_us, rising: R.rising_us } };
// 농심 · 공급사슬
const NSSEG = R.nongshim_segments.map((r) => ({ year: +r.year, segment: r.segment, domestic: N(r.domestic), exports: N(r.exports), total: N(r.total_before_discounts), loc: r.source_location, note: r.note, source: r.source_id }));
const NSREG = R.nongshim_region_revenue.map((r) => ({ year: +r.year, region: r.region, v: N(r.external_revenue), scope: r.scope, status: r.status, note: r.note, url: r.source_url, loc: r.source_location, audit: ids(r.audit_id) }));
const NSREGIONS = [...new Set(NSREG.map((r) => r.region))];
const NSUTIL = R.nongshim_utilization.map((r) => ({ year: +r.year, scope: r.scope, entity: r.entity, avail: N(r.available_hours), actual: N(r.actual_hours), util: N(r.reported_utilization_pct), recalc: N(r.recalculated_utilization_pct), status: r.status, loc: r.source_location, source: r.source_id, note: r.note, bad: r.status !== '원문 대조·산식 일치' }));
const RAWMAT = R.raw_material_prices.map((r) => ({ buyer: r.buyer, material: r.material, year: +r.year, v: N(r.price_krw_per_kg), page: r.printed_page, pdf: r.pdf_page, basis: r.source_basis }));
const MATERIALS = [...new Set(RAWMAT.map((r) => r.material))];
const SUPPLIERS = R.suppliers;
const CHANNELS = R.sales_channels.map((r) => ({ ...r, share: N(r.reported_share_pct) }));
const CH_GROUPS = [...new Set(CHANNELS.map((r) => r.group))];
// 검증 원장: audit_id → 원장 행, audit_id → 출처 ID 목록, 출처 ID → 등록부
const AUDIT = new Map(R.audit_ledger.map((a) => [a.audit_id, a]));
const AUDIT_SRC = new Map(); R.audit_source_links.forEach((l) => { const a = AUDIT_SRC.get(l.audit_id) || []; if (!a.includes(l.source_id)) a.push(l.source_id); AUDIT_SRC.set(l.audit_id, a); });
const REG = new Map(R.source_registry.map((s) => [s.source_id, s]));
const EVID = new Map(); (Array.isArray(EVIDENCE) ? EVIDENCE : []).forEach((e) => EVID.set(`${e.source_id}:t${e.table_index_zero_based}:r${e.row_index_zero_based}`, e));
// '대조 완료'로 표시할 수 있는 상태 (01 지침: 대조되지 않은 지표에는 완료 표시 금지)
const VERIFIED = new Set(['원문 대조 일치', '별도 사업보고서 비교열 대조 일치']);
const auditStatus = (r) => (VERIFIED.has(r) ? 'ok' : /신규/.test(r) ? 'new' : /보도값/.test(r) ? 'press' : 'na');

// ---------- units / format ----------
const eokW = (v) => (v === null ? null : v / 1e8);   // 원 → 억원
const eokM = (v) => (v === null ? null : v / 100);   // 백만원 → 억원
const eokK = (v) => (v === null ? null : v / 1e5);   // 천원 → 억원
const nf = (d) => new Intl.NumberFormat('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? '데이터 없음' : nf(d).format(v));
const eok = (v, d = 1) => (v === null || v === undefined ? '데이터 없음' : fmt(v, d) + '억원');
const pct = (v, d = 1) => (v === null || v === undefined ? '데이터 없음' : fmt(v, d) + '%');
const growth = (c, p) => (c === null || p === null || p === 0 || c === undefined || p === undefined ? null : (c / p - 1) * 100);
const signed = (v, unit, d = 1) => (v === null || v === undefined ? '비교 불가' : (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), d) + unit);
const pillHTML = (v, unit, d = 1, neutral = false) => `<span class="pill ${v === null || v === undefined || neutral ? 'na' : v > 0 ? 'up' : v < 0 ? 'down' : 'na'}">${v === null || v === undefined ? '전년 비교 없음' : (v > 0 ? '▲ ' : v < 0 ? '▼ ' : '') + fmt(Math.abs(v), d) + unit}</span>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const margin = (y, c = S.company) => { const o = fin(y, 'operating_profit', c); const r = fin(y, 'revenue', c); return o === null || !r ? null : (o / r) * 100; };
const seg = (y, s) => SEG.find((r) => r.year === y && r.segment === s);
const exportShare = (y) => { const s = seg(y, '면스낵'); return s && s.exports !== null && s.domestic !== null ? (s.exports / (s.exports + s.domestic)) * 100 : null; };
const pp = (a, b) => (a === null || b === null || a === undefined || b === undefined ? null : a - b); // %p 차이

// ---------- sources ----------
const PDF = 'sources/annual_report_2025.pdf';
const ar = (pages, first) => ({ label: `삼양식품 사업보고서 2026.03.18 (연결) p.${pages}`, url: `${PDF}#page=${first + 4}` });
const SRC = {
  pl: ar('48', 48), bs: ar('47', 47), cf: ar('50', 50), seg: ar('27', 27), prod: ar('18~20', 18), fe25: ar('52~54', 52), local: ar('26~27', 26), mgmt: ar('266~267', 266), supply: ar('18', 18), channel: ar('28~29', 28),
  y2022: { label: '2022 비교기준: 2024.04.04 증권신고서 제2부 연결재무제표 (KIND)', url: 'https://kind.krx.co.kr/external/2024/04/04/000636/20240404001699/10002.htm' },
  ar2024: { label: '2024 사업보고서 (KIND, 2025.03.18) — 2023·2024 해외법인·가동률', url: 'https://kind.krx.co.kr/external/2025/03/18/001592/20250318007395/11011.htm' },
  sr2023: { label: '2024.04.04 증권신고서 — 2023 공장 시간가동률', url: 'https://kind.krx.co.kr/external/2024/04/04/000636/20240404001699/10002.htm' },
  google: { label: 'Google Trends 원자료 CSV (sources/time_series_*.csv, 조회 2026-10-27)', url: 'sources/' },
  naver: { label: 'Naver DataLab (sources/datalab_original.xlsx)', url: 'https://datalab.naver.com/keyword/trendSearch.naver' },
  hk: { label: '한국경제 2025-08-03 (K팝 데몬 헌터스·라면 검색 보도)', url: 'https://v.daum.net/v/20250803171948890' },
  guide01: { label: '01_수정_구현지침.md (2026-11-03 전달본)', url: 'docs/handoff/01_수정_구현지침.md' },
  verify02: { label: '02_검증결과와_한계.md (2026-11-03 전달본)', url: 'docs/handoff/02_검증결과와_한계.md' },
};
const srcFrom = (s) => { const u = (s || '').match(/https?:\/\/\S+/); if (u) return { label: s.length > 80 ? s.slice(0, 77) + '…' : s, url: u[0] }; const p = (s || '').match(/p\.(\d+)/); if (p && /사업보고서|annual_report/.test(s)) return { label: s, url: `${PDF}#page=${+p[1] + 4}` }; if (/^sources\//.test(s || '')) return { label: s, url: s }; return { label: s }; };
// 등록부(source_registry.csv)의 출처를 링크로
const regSrc = (sid) => { const r = REG.get(sid); if (!r) return { label: `${sid} (등록부에 없음)` }; const name = r.title && r.title !== sid ? r.title : `공시 원문 ${sid}`; return { label: `${name} · ${sid}`, url: r.source_url || null }; };
// audit_id 목록 → 연결된 출처 (중복 제거)
const auditSources = (aids) => [...new Set(aids.flatMap((a) => AUDIT_SRC.get(a) || []))].map(regSrc);
// 회사별 재무 출처: 삼양은 사업보고서 페이지, 농심은 감사 원장에 연결된 공시
const finSources = (c, y, metrics, kind) => {
  if (c === 'SY') return [kind === 'bs' ? SRC.bs : kind === 'cf' ? SRC.cf : SRC.pl, ...(y === 2023 ? [SRC.y2022] : [])];
  const a = metrics.flatMap((m) => [...(finRow(y, m, c)?.audit || []), ...(finRow(y - 1, m, c)?.audit || [])]);
  return auditSources(a);
};
const finAudit = (c, ys, metrics) => ys.flatMap((y) => metrics.flatMap((m) => finRow(y, m, c)?.audit || []));

// =====================================================================
// 2. STATE
// =====================================================================
const PAGES = [
  { id: 'overview', label: '종합 현황', desc: '연결 실적 핵심 지표 · 기업과 연도를 선택하세요', icon: 'M3 12h4l3-8 4 16 3-8h4' },
  { id: 'compare', label: '기업 비교', desc: '삼양식품·농심 연결 재무 비교 (사업 구성·회계 분류 차이 유의)', icon: 'M4 18V8m5 10V4m6 14v-6m5 6V9M3 20h18' },
  { id: 'performance', label: '경영성과', desc: '수익성·현금흐름·재무안정성', icon: 'M4 20V10m6 10V4m6 16v-7m4 7H2' },
  { id: 'market', label: '사업·해외', desc: '사업별 실적과 해외 판매법인·지역 매출', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z' },
  { id: 'production', label: '생산', desc: '생산능력·실적·공시 가동률', icon: 'M3 21V10l6 3V9l6 3V5l6 3v13H3Z' },
  { id: 'supply', label: '공급사슬', desc: '원재료 → 매입처 → 공장 → 판매경로 (연결 물량은 미공개)', icon: 'M4 6h4v4H4zM16 6h4v4h-4zM10 14h4v4h-4zM8 8h8M6 10v2a2 2 0 0 0 2 2h2m8-4v2a2 2 0 0 1-2 2h-2' },
  { id: 'search', label: '검색 관심도', desc: '플랫폼별 월간 상대지수 (판매량 아님)', icon: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4' },
  { id: 'timeline', label: '사건 연표', desc: '공시·공식 발표·회사 발표 인용 보도 (날짜 정밀도 유지)', icon: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z' },
  { id: 'lens', label: '5가지 관점', desc: '관찰값 / 확인할 질문 / 한계 — 등급·임계치를 매기지 않음', icon: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z' },
  { id: 'board', label: '분석 보드', desc: '근거 카드를 끌어 분류 (삼양식품 근거)', icon: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z' },
  { id: 'audit', label: '데이터 검증', desc: '값별 원문 대조 기록·출처 연결 (audit_ledger)', icon: 'M9 12l2 2 4-4M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z' },
  { id: 'sources', label: '출처', desc: '원문 출처·계산식·조사 현황·원자료', icon: 'M6 3h9l4 4v14H6V3Zm9 0v4h4M9 12h7M9 16h7' },
];
// 필터 적용 범위. company: 'both' = 두 회사 동시 표시 / 'any' = 선택 기업 / 'SY' = 삼양 자료만 존재
const FILTERS = {
  overview: { period: true, market: null, company: 'any', scope: '기업 → 전체 카드 · 연도 → 카드·강조 연도 · 연간/분기 → 추이 차트' },
  compare: { period: true, market: null, company: 'both', scope: '두 회사 동시 표시 · 연도 → 비교표·강조 연도 · 연간/분기 → 추이 차트' },
  performance: { period: true, market: null, company: 'any', scope: '기업 → 전체 카드 · 연도 → 카드·강조 연도 · 연간/분기 → 손익 추이' },
  market: { period: false, market: 'entity', company: 'any', scope: '기업 → 사업·해외 자료 · 연도 → 카드·강조 연도 · 해외법인 → 강조(삼양)' },
  production: { period: false, market: null, company: 'any', scope: '기업 → 생산 자료 · 연도 → 공장·제품유형별 값' },
  supply: { period: false, market: null, company: 'SY', scope: '연도 → 원재료 가격·공장 값 · 판매경로·매입처는 2025 보고서 기준' },
  search: { period: false, market: 'region', company: 'SY', scope: '연도 → 강조 구간 · 시장 → 검색 지역(플랫폼)' },
  timeline: { period: false, market: null, company: 'SY', scope: '연도 → 해당 연도 사건 강조' },
  lens: { period: false, market: null, company: 'any', scope: '기업 → 관찰값 · 연도 → 기준 연도 (전년 비교 포함)' },
  audit: { period: false, market: null, company: 'any', scope: '기업 → 원장 행 필터 · 데이터셋·상태 선택' },
  sources: { period: false, market: null, company: 'none', scope: '필터가 적용되지 않는 화면' },
  board: { period: false, market: null, company: 'SY', scope: '필터 미적용 — 카드는 삼양식품 2023~2025 고정 근거 (분류만 바뀜)' },
};
const S = { page: 'overview', company: 'SY', year: 2025, period: 'annual', entity: 'all', region: 'Worldwide', edit: false, panel: true, hl: null, auditDs: 'all', auditRes: 'all', tlOnly: false };
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 */ } } };

// =====================================================================
// 3. SHELL
// =====================================================================
const $ = (s, el = document) => el.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'html') el.innerHTML = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach((c) => { if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(c)); });
  return el;
};
const icon = (d) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.7'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); s.append(p); return s; };

const root = document.getElementById('app');
root.className = 'app';
root.innerHTML = `
<nav class="nav" aria-label="메뉴">
  <div class="brand"><div class="brand-mark">불</div><div><b>불닭 경영분석</b><small>삼양식품 · 농심 비교 · 2023–2025</small></div></div>
  <ul class="nav-list" id="navList"></ul>
  <div class="nav-foot">재무: 각 사 사업보고서 연결재무제표<br>자료 전달본 2026-11-03 · 외부 확인 2026-10-27<br>투자 추천이 아닌 수업용 분석</div>
</nav>
<section class="center">
  <header class="topbar">
    <div class="page-title"><h1 id="pgTitle"></h1><p id="pgDesc"></p></div>
    <div class="filters">
      <div class="f-group"><span>기업</span><div class="seg" id="fCo"></div></div>
      <div class="f-group"><span>분석 연도</span><div class="seg" id="fYear"></div></div>
      <div class="f-group"><span>기간</span><div class="seg" id="fPeriod"><button data-v="annual">연간</button><button data-v="quarter">분기</button></div></div>
      <div class="f-group"><span id="fMarketLabel">시장</span><select class="select" id="fMarket" aria-label="시장 필터"></select></div>
      <button class="tool-btn" id="editBtn" aria-pressed="false" title="카드 배치 편집">⠿ 카드 편집</button>
    </div>
  </header>
  <div class="scope" id="scope"></div>
  <div class="workspace" id="ws"></div>
</section>
<aside class="panel" id="panel" aria-label="데이터 질의">
  <div class="panel-h"><div><h2>데이터 질의</h2><small id="aiState">CSV 계산 · 사용 행·산식·출처 표시</small></div><button class="panel-toggle" id="panelToggle" aria-label="패널 접기" aria-expanded="true">⟩</button><span class="vlabel">데이터 질의</span></div>
  <div class="panel-body">
    <div class="qa-suggest"><p>예시 질문 — 누르면 CSV에서 계산하고 관련 화면으로 이동합니다</p><div class="chips" id="chips"></div></div>
    <div class="qa-feed" id="feed"><div class="qa-empty" id="feedEmpty">질문을 고르거나 입력하세요.<br>답변에는 사용한 행·산식·단위·기간·출처가 표시됩니다.<br>데이터에 없는 질문은 ‘미확인’으로 답합니다.</div></div>
    <form class="qa-form" id="qaForm">
      <textarea id="qaInput" placeholder="예: 2025년 두 회사 영업이익률은?" aria-label="데이터 질문"></textarea>
      <div class="qa-row"><small id="qaHint">AI가 아니라 규칙 기반 계산입니다. 지원: 기업(삼양·농심)·연도·분기·재무지표·성장률·가동률·해외법인·검색 최고점.</small><button class="btn-primary" id="qaSend" type="submit">질문</button></div>
    </form>
  </div>
</aside>`;
const tip = h('div', { class: 'tip', hidden: true }); document.body.append(tip);
const showTip = (ev, lines) => { tip.innerHTML = lines.map((l, i) => `<div class="${i === 0 ? 'h' : ''}">${esc(l)}</div>`).join(''); tip.hidden = false; const w = tip.offsetWidth, hh = tip.offsetHeight; let x = ev.clientX + 14, y = ev.clientY + 14; if (x + w > innerWidth - 8) x = ev.clientX - w - 14; if (y + hh > innerHeight - 8) y = ev.clientY - hh - 14; tip.style.left = Math.max(4, x) + 'px'; tip.style.top = Math.max(4, y) + 'px'; };
const hideTip = () => { tip.hidden = true; };

PAGES.forEach((p) => $('#navList').append(h('li', {}, h('button', { class: 'nav-btn', 'data-page': p.id, onclick: () => go(p.id) }, icon(p.icon), p.label))));
Object.keys(COMPANIES).forEach((c) => $('#fCo').append(h('button', { 'data-v': c, onclick: () => { S.company = c; render(); } }, coName(c))));
YEARS.forEach((y) => $('#fYear').append(h('button', { 'data-v': y, onclick: () => { S.year = y; render(); } }, String(y))));
$('#fPeriod').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && !b.disabled) { S.period = b.dataset.v; render(); } });
$('#fMarket').addEventListener('change', (e) => { const f = FILTERS[S.page].market; if (f === 'entity') S.entity = e.target.value; if (f === 'region') S.region = e.target.value; render(); });
$('#editBtn').addEventListener('click', () => { S.edit = !S.edit; render(); });
$('#panelToggle').addEventListener('click', () => { S.panel = !S.panel; paintPanel(); });
const paintPanel = () => { $('#panel').classList.toggle('closed', !S.panel); $('#panelToggle').textContent = S.panel ? '⟩' : '⟨'; $('#panelToggle').setAttribute('aria-expanded', String(S.panel)); $('#panelToggle').setAttribute('aria-label', S.panel ? '패널 접기' : '패널 펼치기'); };

function go(page, opts = {}) { S.page = page; S.hl = null; S.hlPlant = null; Object.assign(S, opts); S.edit = false; render(); }

function paintFilters() {
  const pg = PAGES.find((p) => p.id === S.page); const F = FILTERS[S.page];
  $('#pgTitle').textContent = pg.label; $('#pgDesc').textContent = pg.desc;
  document.querySelectorAll('.nav-btn').forEach((b) => b.setAttribute('aria-current', b.dataset.page === S.page ? 'page' : 'false'));
  const coOn = ['any', 'SY'].includes(F.company);
  $('#fCo').querySelectorAll('button').forEach((b) => { b.setAttribute('aria-pressed', String(coOn && b.dataset.v === S.company)); b.disabled = !coOn; });
  $('#fCo').title = F.company === 'both' ? '이 화면은 두 회사를 함께 표시합니다' : F.company === 'none' ? '이 화면에는 기업 선택이 적용되지 않습니다' : '';
  const yearOn = !['sources', 'board', 'audit'].includes(S.page);
  $('#fYear').querySelectorAll('button').forEach((b) => { b.setAttribute('aria-pressed', String(+b.dataset.v === S.year)); b.disabled = !yearOn; });
  $('#fPeriod').querySelectorAll('button').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.v === S.period && F.period)); b.disabled = !F.period; });
  $('#fPeriod').title = F.period ? '' : '이 화면에는 분기 자료가 연결되지 않습니다 (분기 자료는 손익만 있음)';
  const sel = $('#fMarket'); sel.replaceChildren();
  const syOnly = F.market && S.company !== 'SY';
  if (F.market === 'entity' && !syOnly) { $('#fMarketLabel').textContent = '해외법인'; sel.append(h('option', { value: 'all' }, '전체 법인'), ...ENTITIES.map((e) => h('option', { value: e }, e))); sel.value = S.entity; sel.disabled = false; sel.title = ''; }
  else if (F.market === 'region' && !syOnly) { $('#fMarketLabel').textContent = '검색 지역'; sel.append(...Object.entries(REGIONS).map(([k, v]) => h('option', { value: k }, v))); sel.value = S.region; sel.disabled = false; sel.title = ''; }
  else { $('#fMarketLabel').textContent = '시장'; sel.append(h('option', {}, '해당 없음')); sel.disabled = true; sel.title = syOnly ? '농심은 개별 해외법인·검색 자료가 제공되지 않았습니다' : '이 화면의 지표는 국가별 자료가 없어 시장 필터를 적용하지 않습니다'; }
  const noEdit = ['sources', 'board', 'audit', 'timeline'].includes(S.page);
  $('#editBtn').setAttribute('aria-pressed', String(S.edit)); $('#editBtn').hidden = noEdit;
  const sc = $('#scope'); sc.replaceChildren();
  sc.append(h('span', {}, h('b', {}, '필터 적용 범위 '), F.scope));
  if (coOn) sc.append(h('span', { class: 'co-chip', style: `--cc:${COMPANIES[S.company].color}` }, `표시 기업: ${coName(S.company)} 연결`));
  if (!F.period && !['sources', 'board'].includes(S.page)) sc.append(h('span', { class: 'off' }, '연간/분기: 이 화면 미적용'));
}

// =====================================================================
// 4. CHART PRIMITIVES (d3)
// =====================================================================
const C = { accent: '#d4262c', accentSoft: '#efb9b7', dark: '#3b3936', darkSoft: '#cfcac1', blue: '#3d6fb6', teal: '#24987a', orange: '#df6d36', violet: '#8562c4', base: '#d8d3ca', grid: '#eeebe5', axis: '#d6d1c8' };
const ro = new ResizeObserver((entries) => entries.forEach((e) => { const f = e.target.__draw; if (f && Math.abs((e.target.__w || 0) - e.target.clientWidth) > 4) { e.target.__w = e.target.clientWidth; f(); } }));
const mount = (el, draw) => { el.__draw = () => { d3.select(el).selectAll('svg').remove(); draw(Math.max(220, el.clientWidth)); }; el.__w = el.clientWidth; ro.observe(el); requestAnimationFrame(() => el.__draw()); };
const textW = (svg, s, cls = 'tick') => { const t = svg.append('text').attr('class', cls).text(s); const w = t.node().getComputedTextLength(); t.remove(); return w; };
const T = 450;

// grouped / stacked vertical bars
function barChart(el, o) {
  mount(el, (W) => {
    const H = o.height || 220; const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const vals = o.stacked ? o.data.map((d) => d3.sum(o.series, (s) => d[s.key] ?? 0)) : o.data.flatMap((d) => o.series.map((s) => d[s.key])).filter((v) => v !== null && v !== undefined);
    const lo = Math.min(0, d3.min(vals) ?? 0); const hi = Math.max(0, d3.max(vals) ?? 0);
    const y = d3.scaleLinear([lo, hi * 1.15 || 1], [H - 24, 14]).nice();
    const ticks = y.ticks(4); const left = d3.max(ticks, (t) => textW(svg, o.fmt(t))) + 10;
    const x = d3.scaleBand(o.data.map((d) => d.label), [left, W - 4]).padding(o.pad ?? 0.3);
    svg.append('g').selectAll('line').data(ticks).join('line').attr('x1', left).attr('x2', W).attr('y1', y).attr('y2', y).attr('stroke', (t) => (t === 0 ? C.axis : C.grid));
    svg.append('g').selectAll('text').data(ticks).join('text').attr('class', 'tick').attr('x', left - 6).attr('y', y).attr('dy', '.32em').attr('text-anchor', 'end').text(o.fmt);
    svg.append('g').selectAll('text').data(o.data).join('text').attr('class', (d) => 'tick' + (o.isSel?.(d) ? ' hi' : '')).attr('x', (d) => x(d.label) + x.bandwidth() / 2).attr('y', H - 7).attr('text-anchor', 'middle').text((d) => d.label);
    const g = svg.append('g').selectAll('g').data(o.data).join('g').attr('transform', (d) => `translate(${x(d.label)},0)`).attr('class', 'mark');
    if (o.stacked) {
      g.each(function (d) {
        let acc = 0; const gg = d3.select(this);
        o.series.forEach((s) => { const v = d[s.key] ?? 0; const y0 = y(acc), y1 = y(acc + v); acc += v;
          gg.append('rect').attr('x', 0).attr('width', x.bandwidth()).attr('y', y(0)).attr('height', 0).attr('fill', o.colorOf ? o.colorOf(s, d) : s.color).attr('stroke', '#fff').attr('stroke-width', 1.5)
            .transition().duration(T).ease(d3.easeCubicOut).attr('y', y1).attr('height', Math.max(0, y0 - y1)); });
        if (o.topLabel) gg.append('text').attr('class', 'val').attr('x', x.bandwidth() / 2).attr('y', y(acc) - 5).attr('text-anchor', 'middle').text(o.topLabel(d));
      });
    } else {
      const xs = d3.scaleBand(o.series.map((s) => s.key), [0, x.bandwidth()]).padding(0.12);
      o.series.forEach((s) => {
        const bw = Math.min(o.maxBar || 34, xs.bandwidth());
        g.append('rect').attr('x', xs(s.key) + (xs.bandwidth() - bw) / 2).attr('width', bw).attr('rx', 3).attr('y', y(0)).attr('height', 0)
          .attr('fill', (d) => (o.colorOf ? o.colorOf(s, d) : s.color))
          .transition().duration(T).ease(d3.easeCubicOut)
          .attr('y', (d) => (d[s.key] === null ? y(0) : Math.min(y(d[s.key]), y(0)))).attr('height', (d) => (d[s.key] === null ? 0 : Math.abs(y(0) - y(d[s.key]))));
        if (o.labels) g.append('text').attr('class', 'val').attr('x', xs(s.key) + xs.bandwidth() / 2).attr('y', (d) => (d[s.key] === null ? y(0) - 4 : y(Math.max(0, d[s.key])) - 4)).attr('text-anchor', 'middle')
          .text((d) => (d[s.key] === null ? (o.nullLabel ?? '없음') : o.labels(d[s.key], d, s))).attr('fill', (d) => (o.isSel?.(d) ? '#1c1a17' : '#8a847a'));
      });
    }
    g.append('rect').attr('x', 0).attr('width', x.bandwidth()).attr('y', 0).attr('height', H - 24).attr('fill', 'transparent')
      .on('mousemove', (ev, d) => showTip(ev, o.tip(d))).on('mouseleave', hideTip).on('click', (ev, d) => { hideTip(); o.onClick?.(d); });
  });
}

// line / area chart over category x
function lineChart(el, o) {
  mount(el, (W) => {
    const H = o.height || 220; const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const vals = o.series.flatMap((s) => s.values).filter((v) => v !== null && v !== undefined);
    const y = d3.scaleLinear([o.yMin ?? 0, o.yMax ?? (d3.max(vals) * 1.12 || 1)], [H - (o.twoRow ? 34 : 22), 12]).nice();
    const ticks = y.ticks(4); const left = d3.max(ticks, (t) => textW(svg, o.fmt(t))) + 10;
    const x = d3.scalePoint(o.labels, [left + 8, W - (o.right || 10)]);
    const base = H - (o.twoRow ? 34 : 22);
    if (o.band) { const [a, b] = o.band; if (x(a) !== undefined && x(b) !== undefined) svg.append('rect').attr('x', x(a) - x.step() / 2).attr('width', x(b) - x(a) + x.step()).attr('y', 4).attr('height', base - 4).attr('fill', C.accent).attr('fill-opacity', 0.05).attr('rx', 6); }
    svg.append('g').selectAll('line').data(ticks).join('line').attr('x1', left).attr('x2', W).attr('y1', y).attr('y2', y).attr('stroke', C.grid);
    svg.append('g').selectAll('text').data(ticks).join('text').attr('class', 'tick').attr('x', left - 6).attr('y', y).attr('dy', '.32em').attr('text-anchor', 'end').text(o.fmt);
    const every = o.every || 1;
    svg.append('g').selectAll('text').data(o.labels).join('text').attr('class', (l, i) => 'tick' + (o.isSelLabel?.(l) ? ' hi' : '')).attr('x', (l) => x(l)).attr('y', base + 14).attr('text-anchor', 'middle').text((l, i) => (i % every === 0 ? (o.tickText ? o.tickText(l) : l) : ''));
    if (o.twoRow) o.twoRow.forEach((g) => svg.append('text').attr('class', 'tick' + (g.hi ? ' hi' : '')).attr('x', (x(g.from) + x(g.to)) / 2).attr('y', H - 4).attr('text-anchor', 'middle').text(g.text));
    (o.events || []).forEach((e) => { if (x(e.at) === undefined) return; svg.append('line').attr('x1', x(e.at)).attr('x2', x(e.at)).attr('y1', 10).attr('y2', base).attr('stroke', '#b9b3a9').attr('stroke-dasharray', '2 3'); });
    const ends = [];
    o.series.forEach((s, si) => {
      const pts = o.labels.map((l, i) => ({ l, v: s.values[i] }));
      const line = d3.line().defined((d) => d.v !== null && d.v !== undefined).x((d) => x(d.l)).y((d) => y(d.v));
      if (s.area) {
        const id = 'g' + Math.random().toString(36).slice(2);
        const gr = svg.append('defs').append('linearGradient').attr('id', id).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
        [[0, 0.22], [1, 0]].forEach(([of, a]) => gr.append('stop').attr('offset', of).attr('stop-color', s.color).attr('stop-opacity', a));
        svg.append('path').attr('d', d3.area().defined((d) => d.v !== null).x((d) => x(d.l)).y0(y(o.yMin ?? 0)).y1((d) => y(d.v))(pts)).attr('fill', `url(#${id})`).attr('opacity', 0).transition().duration(T).attr('opacity', 1);
      }
      const p = svg.append('path').attr('d', line(pts)).attr('fill', 'none').attr('stroke', s.color).attr('stroke-width', s.width || 2).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
      if (s.dash) p.attr('stroke-dasharray', s.dash);
      else { const L = p.node().getTotalLength(); p.attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L).transition().duration(T + 150).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0).on('end', () => p.attr('stroke-dasharray', null)); }
      if (s.dots) svg.append('g').selectAll('circle').data(pts.filter((d) => d.v !== null && s.dots(d.l))).join('circle').attr('cx', (d) => x(d.l)).attr('cy', (d) => y(d.v)).attr('r', 3.5).attr('fill', '#fff').attr('stroke', s.color).attr('stroke-width', 2);
      if (s.endLabel) { const last = [...pts].reverse().find((d) => d.v !== null); if (last) ends.push({ x: x(last.l), y: y(last.v) - 8, color: s.color, text: s.endLabel(last.v) }); }
    });
    ends.sort((a, b) => a.y - b.y); for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
    ends.forEach((e) => svg.append('text').attr('class', 'val').attr('x', e.x - 4).attr('y', e.y).attr('text-anchor', 'end').attr('fill', e.color).text(e.text));
    (o.peaks || []).forEach((pk) => { if (x(pk.at) === undefined) return; svg.append('circle').attr('cx', x(pk.at)).attr('cy', y(pk.v)).attr('r', 5).attr('fill', C.accent).attr('stroke', '#fff').attr('stroke-width', 2); svg.append('text').attr('class', 'val').attr('x', x(pk.at)).attr('y', y(pk.v) - 9).attr('text-anchor', 'middle').text(pk.text); });
    const rule = svg.append('line').attr('y1', 8).attr('y2', base).attr('stroke', '#8a847a').attr('stroke-opacity', 0);
    svg.append('g').selectAll('rect').data(o.labels).join('rect').attr('x', (l) => x(l) - x.step() / 2).attr('width', x.step()).attr('y', 0).attr('height', base).attr('fill', 'transparent').attr('class', 'mark')
      .on('mousemove', (ev, l) => { rule.attr('x1', x(l)).attr('x2', x(l)).attr('stroke-opacity', 0.5); showTip(ev, o.tip(l, o.labels.indexOf(l))); })
      .on('mouseleave', () => { rule.attr('stroke-opacity', 0); hideTip(); })
      .on('click', (ev, l) => { hideTip(); o.onClick?.(l, o.labels.indexOf(l)); });
  });
}

// horizontal bars with optional prior-year bar
function hbars(el, o) {
  mount(el, (W) => {
    const rowH = o.rowH || 30; const H = o.data.length * rowH + 8;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const left = (o.labelW ?? d3.max(o.data, (d) => textW(svg, d.label))) + 12;
    const right = d3.max(o.data, (d) => textW(svg, d.text || '', 'val')) + 14;
    const max = o.max ?? d3.max(o.data, (d) => Math.max(d.v ?? 0, d.prev ?? 0)) ?? 1;
    const x = d3.scaleLinear([0, max || 1], [left, W - right]);
    const g = svg.append('g').selectAll('g').data(o.data).join('g').attr('transform', (d, i) => `translate(0,${i * rowH + 4})`).attr('class', 'mark');
    g.append('text').attr('class', (d) => 'tick' + (d.sel ? ' hi' : '')).attr('x', left - 10).attr('y', rowH / 2 - 2).attr('dy', '.32em').attr('text-anchor', 'end').text((d) => d.label);
    g.append('rect').attr('x', left).attr('y', 5).attr('height', o.prev ? 11 : 14).attr('rx', 3).attr('width', 0).attr('fill', (d) => d.color || (d.sel ? C.accent : C.darkSoft))
      .transition().duration(T).ease(d3.easeCubicOut).attr('width', (d) => (d.v === null ? 0 : Math.max(1, x(d.v) - left)));
    if (o.prev) g.append('rect').attr('x', left).attr('y', 18).attr('height', 3).attr('rx', 1.5).attr('fill', '#b9b3a9').attr('width', (d) => (d.prev === null || d.prev === undefined ? 0 : Math.max(1, x(d.prev) - left)));
    g.append('text').attr('class', 'val').attr('x', (d) => (d.v === null ? left + 4 : x(d.v) + 6)).attr('y', o.prev ? 11 : 12).attr('dy', '.32em').text((d) => d.text).attr('fill', (d) => (d.v === null ? '#a19b91' : '#1c1a17'));
    g.append('rect').attr('x', 0).attr('width', W).attr('height', rowH).attr('fill', 'transparent').on('mousemove', (ev, d) => showTip(ev, o.tip(d))).on('mouseleave', hideTip).on('click', (ev, d) => { hideTip(); o.onClick?.(d); });
  });
}

function heatmap(el, o) {
  mount(el, (W) => {
    const svg = d3.select(el).append('svg').attr('width', '100%');
    const left = d3.max(o.rows, (r) => textW(svg, String(r))) + 12; const cw = (W - left) / 12; const ch = 30; const top = 16; const H = top + ch * o.rows.length + 2;
    svg.attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const color = d3.scaleLinear([0, 100], ['#fbf3f2', C.accent]).interpolate(d3.interpolateRgb).clamp(true);
    svg.append('g').selectAll('text').data(d3.range(1, 13)).join('text').attr('class', 'tick').attr('x', (m) => left + (m - 0.5) * cw).attr('y', 11).attr('text-anchor', 'middle').text((m) => (cw < 24 && m % 3 !== 1 ? '' : m + '월'));
    svg.append('g').selectAll('text').data(o.rows).join('text').attr('class', (r) => 'tick' + (r === o.selRow ? ' hi' : '')).attr('x', left - 8).attr('y', (r, i) => top + i * ch + ch / 2).attr('dy', '.32em').attr('text-anchor', 'end').text((r) => r);
    const cells = svg.append('g').selectAll('g').data(o.cells).join('g').attr('transform', (d) => `translate(${left + (d.m - 1) * cw},${top + o.rows.indexOf(d.row) * ch})`).attr('class', 'mark');
    cells.append('rect').attr('x', 1.5).attr('y', 1.5).attr('width', Math.max(1, cw - 3)).attr('height', ch - 3).attr('rx', 4).attr('fill', (d) => color(d.v)).attr('stroke', (d) => (d.peak ? '#1c1a17' : 'none')).attr('stroke-width', 1.5).attr('opacity', 0).transition().duration(T).delay((d) => d.m * 18).attr('opacity', 1);
    if (cw >= 26) cells.append('text').attr('class', 'val').attr('x', cw / 2).attr('y', ch / 2).attr('dy', '.32em').attr('text-anchor', 'middle').attr('fill', (d) => (d.v > 60 ? '#fff' : '#1c1a17')).text((d) => fmt(d.v, 0));
    if (o.selRow !== undefined && o.rows.includes(o.selRow)) svg.append('rect').attr('x', left).attr('y', top + o.rows.indexOf(o.selRow) * ch).attr('width', W - left).attr('height', ch).attr('rx', 5).attr('fill', 'none').attr('stroke', C.accent).attr('stroke-width', 1.2).attr('pointer-events', 'none');
    cells.on('mousemove', (ev, d) => showTip(ev, o.tip(d))).on('mouseleave', hideTip).on('click', (ev, d) => { hideTip(); o.onClick?.(d); });
  });
}

function bubbles(el, o) {
  mount(el, (W) => {
    const H = 230; const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const all = PROD.filter((d) => d.cap !== null);
    const x = d3.scaleLog([d3.min(all, (d) => eokM(d.cap)) * 0.7, d3.max(all, (d) => eokM(d.cap)) * 1.6], [40, W - 12]);
    const y = d3.scaleLinear([30, 100], [H - 24, 10]); const r = d3.scaleSqrt([0, d3.max(all, (d) => eokM(d.prod))], [3, 20]);
    [40, 60, 80, 100].forEach((t) => { svg.append('line').attr('x1', 40).attr('x2', W).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', C.grid); svg.append('text').attr('class', 'tick').attr('x', 34).attr('y', y(t)).attr('dy', '.32em').attr('text-anchor', 'end').text(t + '%'); });
    [300, 1000, 3000].filter((t) => t > x.domain()[0] && t < x.domain()[1]).forEach((t) => { svg.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', 10).attr('y2', H - 24).attr('stroke', C.grid).attr('stroke-dasharray', '3 3'); svg.append('text').attr('class', 'tick').attr('x', x(t)).attr('y', H - 8).attr('text-anchor', 'middle').text(fmt(t, 0) + '억원'); });
    const g = svg.append('g').selectAll('g').data(o.data).join('g').attr('class', 'mark');
    g.append('circle').attr('cx', (d) => x(eokM(d.cap))).attr('cy', (d) => y(d.util)).attr('r', 0).attr('fill', (d) => (d.sel ? C.accent : C.blue)).attr('fill-opacity', 0.28).attr('stroke', (d) => (d.sel ? C.accent : C.blue)).attr('stroke-width', 1.5)
      .transition().duration(T).attr('r', (d) => r(eokM(d.prod) ?? 0));
    const boxes = [];
    [...o.data].sort((a, b) => y(a.util) - y(b.util)).forEach((d) => {
      const cx = x(eokM(d.cap)), cy = y(d.util), rr = r(eokM(d.prod) ?? 0); const w = textW(svg, d.plant);
      let lx = cx + rr + 4, anchor = 'start'; if (lx + w > W - 4) { lx = cx - rr - 4; anchor = 'end'; }
      const x0 = anchor === 'start' ? lx : lx - w; let ly = cy;
      for (let k = 0; k < 8; k++) { const hit = boxes.find((b) => x0 < b.x1 && x0 + w > b.x0 && Math.abs(ly - b.y) < 12); if (!hit) break; ly = hit.y + 12; }
      boxes.push({ x0, x1: x0 + w, y: ly });
      svg.append('text').attr('class', 'tick' + (d.sel ? ' hi' : '')).attr('x', lx).attr('y', ly).attr('dy', '.32em').attr('text-anchor', anchor).attr('pointer-events', 'none').text(d.plant);
    });
    g.on('mousemove', (ev, d) => showTip(ev, o.tip(d))).on('mouseleave', hideTip).on('click', (ev, d) => { hideTip(); o.onClick?.(d); });
  });
}

function miniBars(el, rows, unit) { // for answers in the panel
  mount(el, (W) => {
    const rowH = 22; const H = rows.length * rowH + 4; const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const left = d3.max(rows, (d) => textW(svg, d.label)) + 8; const right = d3.max(rows, (d) => textW(svg, d.text, 'val')) + 10;
    const max = d3.max(rows, (d) => Math.abs(d.v ?? 0)) || 1; const x = d3.scaleLinear([0, max], [left, W - right]);
    const g = svg.append('g').selectAll('g').data(rows).join('g').attr('transform', (d, i) => `translate(0,${i * rowH + 2})`);
    g.append('text').attr('class', 'tick').attr('x', left - 6).attr('y', rowH / 2).attr('dy', '.32em').attr('text-anchor', 'end').text((d) => d.label);
    g.append('rect').attr('x', left).attr('y', 5).attr('height', rowH - 10).attr('rx', 3).attr('fill', (d) => d.color || C.accent).attr('width', 0).transition().duration(T).attr('width', (d) => (d.v === null ? 0 : Math.max(1, x(Math.abs(d.v)) - left)));
    g.append('text').attr('class', 'val').attr('x', (d) => (d.v === null ? left + 2 : x(Math.abs(d.v)) + 5)).attr('y', rowH / 2).attr('dy', '.32em').text((d) => d.text);
  });
}

// =====================================================================
// 5. DETAIL SHEET
// =====================================================================
function openDetail(d) {
  const bg = h('div', { class: 'sheet-bg', onclick: (e) => { if (e.target === bg) close(); } });
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  const list = (title, items, cls) => (items && items.length ? h('section', { class: cls || '' }, h('h4', {}, title), h('ul', {}, items.map((t) => h('li', {}, t)))) : null);
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': d.title },
    h('div', { class: 'sheet-h' }, h('div', {}, h('h3', {}, d.title, d.badge ? h('span', { class: 'badge' }, d.badge) : null), d.sub ? h('p', {}, d.sub) : null), h('button', { class: 'sheet-x', onclick: close, 'aria-label': '닫기' }, '✕')),
    h('div', { class: 'sheet-b' },
      d.rows?.length ? h('table', { class: 'kv' }, h('tbody', {}, d.rows.map((r) => h('tr', {}, h('th', {}, r[0]), h('td', {}, r[1], r[2] ? h('small', {}, r[2]) : null))))) : null,
      d.formula?.length ? h('section', {}, h('h4', {}, '계산식'), h('div', { class: 'formula' }, d.formula.map((f) => h('div', {}, f)))) : null,
      list('확인된 사실', d.facts),
      list('회사 설명 (사업보고서 등)', d.company),
      list('경영학적 해석', d.interp),
      list('의사결정 시사점', d.impl, 'box-impl'),
      d.nodoc ? h('section', { class: 'box-nodoc' }, h('h4', {}, '해설 없음'), h('p', {}, d.nodoc)) : null,
      list('해석 한계', d.limits, 'box-lim'),
      d.sources?.length ? h('section', {}, h('h4', {}, '출처'), h('ul', { class: 'src-list' }, uniqSrc(d.sources).map((s) => h('li', {}, s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.label) : s.label)))) : null,
      d.audit?.length ? auditBlock(d.audit) : null));
  bg.append(sheet); document.body.append(bg); sheet.querySelector('.sheet-x').focus();
}
const uniqSrc = (arr) => { const seen = new Set(); return arr.filter((s) => s && !seen.has(s.label + (s.url || '')) && seen.add(s.label + (s.url || ''))); };
const NODOC_NS = '제공 문서(02_경영해석과_출처)에는 농심에 대한 경영 해석 문구가 없어 값·산식·출처·검증 기록만 표시합니다.';
const statusBadge = (res) => h('span', { class: 'ast ' + auditStatus(res) }, (VERIFIED.has(res) ? '✓ ' : '') + res);
const evidenceCells = (loc) => [...String(loc || '').matchAll(/([a-z0-9_]+):t(\d+):r(\d+)/g)].map((m) => EVID.get(`${m[1]}:t${m[2]}:r${m[3]}`)).filter(Boolean);
// 검증 기록 블록: audit_ledger 행 + audit_source_links → source_registry + 추출된 원문 표 행
function auditBlock(aids) {
  const rows = [...new Set(aids)].map((a) => AUDIT.get(a)).filter(Boolean);
  if (!rows.length) return null;
  const cnt = {}; rows.forEach((r) => { cnt[r.result] = (cnt[r.result] || 0) + 1; });
  const srcs = auditSources(rows.map((r) => r.audit_id));
  const rev = [...new Set(rows.map((r) => r.latest_revision_check))].join(' · ');
  const show = rows.slice(0, 60);
  return h('section', { class: 'audit-box' },
    h('h4', {}, `검증 기록 (audit_ledger.csv · ${rows.length}건)`),
    h('div', { class: 'ast-row' }, Object.entries(cnt).map(([k, v]) => h('span', {}, statusBadge(k), ` ${v}`))),
    h('details', { open: rows.length <= 6 ? true : null }, h('summary', {}, '대상 행·값·원문 위치·대조 방법 보기'),
      h('div', { class: 'tw', style: 'max-height:260px' }, h('table', { class: 'tbl audit-tbl' },
        h('thead', {}, h('tr', {}, ['ID', '대상 행', '필드', '데이터 값', '원문 값', '원문 위치', '방법', '상태'].map((t) => h('th', { class: 'l' }, t)))),
        h('tbody', {}, show.map((r) => h('tr', { class: 'click', onclick: () => openDetail(auditDetail(r.audit_id)) }, h('td', { class: 'l' }, r.audit_id), h('td', { class: 'l' }, r.row_key), h('td', { class: 'l' }, r.field), h('td', { class: 'l' + (r.dataset_value === '' ? ' nd' : '') }, r.dataset_value === '' ? '(빈 값)' : r.dataset_value), h('td', { class: 'l' + (r.source_value === '' ? ' nd' : '') }, r.source_value === '' ? '(빈 값)' : r.source_value), h('td', { class: 'l' }, r.source_location || '—'), h('td', { class: 'l' }, r.method), h('td', { class: 'l' }, statusBadge(r.result))))))),
      rows.length > show.length ? h('p', { class: 'note' }, `처음 ${show.length}건만 표시 · 전체는 ‘데이터 검증’ 화면에서 확인`) : null),
    srcs.length ? h('div', {}, h('h4', { style: 'margin-top:8px' }, '연결된 출처 (audit_source_links → source_registry)'), h('ul', { class: 'src-list' }, srcs.map((s) => h('li', {}, s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.label) : s.label)))) : null,
    h('p', { class: 'note' }, `최신 정정공시 확인: ${rev || '기록 없음'} · ✓ 표시는 ‘원문 대조 일치’·‘별도 사업보고서 비교열 대조 일치’에만 붙입니다. 신규 추출 값은 독립 제3자 검증이 아닙니다.`));
}
function auditDetail(aid) {
  const r = AUDIT.get(aid); if (!r) return { title: aid, rows: [['상태', '원장에 없음']] };
  const ev = evidenceCells(r.source_location);
  return { title: `검증 기록 ${aid}`, sub: `${r.dataset} · ${r.row_key} · ${r.field}`, badge: VERIFIED.has(r.result) ? null : r.result,
    rows: [['데이터 값', r.dataset_value === '' ? '(빈 값)' : r.dataset_value, r.dataset_value === '' ? '결측은 0으로 바꾸지 않음' : ''], ['원문 값', r.source_value === '' ? '(빈 값)' : r.source_value], ['원문 위치', r.source_location || '—'], ['대조 방법', r.method], ['상태', r.result], ['확인일', r.checked_on], ['최신 정정공시 확인', r.latest_revision_check], ['인과 확인', r.causality_check]],
    facts: ev.map((e) => `추출된 원문 표 행 ${e.evidence_id} (${e.source_id} 표 ${e.table_index_zero_based} · 행 ${e.row_index_zero_based}): ${e.cells.join(' | ')}`),
    limits: [VERIFIED.has(r.result) ? '원문과 대조한 기록입니다. 최신 정정공시 전체 이력 확인은 별도입니다.' : '대조 완료 표시를 붙이지 않는 상태입니다.', '표 행 번호는 0부터 센 추출 위치입니다 (sources/extracted_source_rows.json).'],
    sources: [...auditSources([aid]), ...(ev.length ? [{ label: 'sources/extracted_source_rows.json', url: 'sources/extracted_source_rows.json' }] : [])] };
}

// =====================================================================
// 6. PAGES — 각 페이지는 kpis()와 cards()를 돌려준다
// =====================================================================
const yr = () => S.year;
const isSelY = (d) => d.year === S.year;
const isSY = () => S.company === 'SY';
const LIMIT_CONSOL_OF = (c) => (c === 'SY' ? '삼양식품 회사 연결 실적이며 불닭 브랜드 단독 실적이 아닙니다.' : '농심 회사 연결 실적이며 특정 브랜드(신라면 등) 실적이 아닙니다.');
const LIMIT_CONSOL = LIMIT_CONSOL_OF('SY');
const LIMIT_NSNEW = '농심 수치는 공시 원문 행에서 추출한 값입니다. 2022~2024는 다른 연도 사업보고서 비교열과 대조했고, 2025는 신규 추출 상태입니다. 독립적인 제3자 검증이나 최신 정정 확인이 아닙니다.';
const LIMIT_FE = ['종속기업 요약재무정보(연결 내부거래 제거 전)라 연결매출에 더하지 않습니다.', '원화 환산 성장률에는 환율 영향이 포함됩니다(현지통화 성장률과 다름).', '법인 매출을 해당 국가 최종소비자 매출로 단정하지 않습니다.'];
const LIMIT_SEARCH = ['검색 관심도는 기간 내 최고점을 100으로 둔 상대지수이며 판매량이 아닙니다.', 'Google(buldak)과 네이버(불닭볶음면·까르보불닭)는 플랫폼·검색어가 달라 지수 수준을 직접 비교하지 않습니다.', '전 세계 자료에는 미국이 포함되어 있어 서로 독립 표본이 아닙니다.', '검색 최고점과 같은 시기의 사건은 시기 일치일 뿐 인과가 확인되지 않았습니다.'];
const LIMIT_PROD = ['생산능력·생산실적은 기간별 기준가격을 적용한 금액이며 봉지 수가 아닙니다.', '2025는 하반기 밀양2공장 가동, 밀양 면류 생산금액 산정기준 변경, 공장 가동가능시간 산정기준 변경이 있어 전년과 단순 비교하지 않습니다.', '시간 기준 공시 가동률을 금액으로 다시 계산하지 않았습니다.'];
const LIMIT_NSREG = ['농심 사업지역별 영업부문의 외부고객 수익입니다(천원). 삼양 해외법인의 내부거래 제거 전 매출이나 면스낵 수출과 범위가 달라 직접 비교하지 않습니다.', '판매 지역 최종소비·현지법인 전체 매출·한국 직접수출액으로 해석하지 않습니다.'];
const NOTE_SY = (lim) => (lim || []);
// 제공 문서 해설 (02_경영해석과_출처 · 03_추가조사) — 삼양식품에만 존재
const DOC = {
  company: '사업보고서 p.266~267: 수출물량 증가·가격 인상·해외법인 현지영업을 매출 증가 배경으로 설명. 원재료와 신공장 고정비 부담에도 해외수출 규모 및 환율 변화로 원가율이 하락했다고 설명(회사 설명이며 각 요인의 기여액을 따로 측정한 결과는 아님).',
  y2024: '2024: 매출원가율 65.1%→58.1%, 판관비율 22.6%→21.9%로 낮아져 영업이익률 개선과 연결된다. 손익 산식으로 확인되는 변화이며 2024 개별 원인의 상세 검증을 대체하지 않는다.',
  y2025: '2025: 원가율 58.1%→55.2%, 판관비율 21.9%→22.5%. 원가율 개선이 판관비율 상승을 상쇄했다.',
  supply: '수출 확대가 이어지는 상황에서 공급 능력과 현금 창출이 함께 증가하는지 확인한다.',
  cash1: '연결 현금흐름표 p.50: 영업으로부터 창출된 현금은 증가했지만 법인세 납부가 451.8억원에서 1,123.1억원으로 증가했다.',
  cash2: '회사는 유동성 설명에서 운전자본 부담 확대도 언급한다. 따라서 순영업현금흐름 감소를 재고 증가 하나로 설명하지 않는다.',
  gap: '영업현금흐름과 유형자산 취득 지출의 차액을 적자나 파산 위험으로 단정하지 않는다.',
  watch: '생산 확대 이후 재고·매출채권 회수 속도, 투자 집행과 자금조달 부담을 관찰한다. 단순 회전율 변화만으로 부실을 판정하지 않는다.',
  ocf2023: '2023 영업현금흐름 성장률(251.8%)은 낮은 2022 기준값도 함께 확인해야 한다 (03 문서 2절).',
};

function kpiCard(label, value, unit, scope, deltaHTML, onClick, dot, stripes) {
  const bars = stripes ? h('span', { class: 'kpi-bars', 'aria-hidden': 'true' }, stripes.map((st) => { const mx = d3.max(stripes, (x) => x.v) || 1; return h('i', { style: `height:${Math.max(12, ((st.v ?? 0) / mx) * 100)}%;background:${st.sel ? dot || '#d4262c' : '#d9d5ce'}` }); })) : null;
  return h('button', { class: 'kpi', onclick: onClick, style: dot ? `--kc:${dot}` : null }, h('span', { class: 'kpi-l' }, h('i', { style: dot ? `background:${dot}` : null }), label), h('span', { class: 'kpi-v', html: `${esc(value)}<small>${esc(unit)}</small>` }), bars, h('span', { class: 'kpi-d', html: deltaHTML }), h('span', { class: 'kpi-s' }, scope));
}
const finGrowthRow = (y, m, c) => { const a = fin(y, m, c), b = fin(y - 1, m, c); return b === null ? `${y - 1} 값 없음` : `${y - 1}: ${eok(eokW(b))} · 전년 대비 ${signed(growth(a, b), '%')}`; };
const plCheck = (y, c) => { const r = fin(y, 'revenue', c), co = fin(y, 'cost_of_sales', c), s = fin(y, 'sga', c), o = fin(y, 'operating_profit', c); return [r, co, s, o].includes(null) ? '계산 불가' : r - co - s === o ? '매출 − 원가 − 판관비 = 영업이익 ✓ (원 단위 일치)' : `불일치 (${fmt(r - co - s - o, 0)}원)`; };
const detailRevenue = (y, c = S.company) => ({ title: `${coName(c)} ${y} 매출액`, sub: c === 'SY' ? '삼양식품 연결 · 불닭 브랜드 매출 아님' : '농심 연결', badge: c === 'NS' ? '공시 원문 추출' : null,
  rows: [[`${y} 매출액`, eok(eokW(fin(y, 'revenue', c))), `원 단위 ${fmt(fin(y, 'revenue', c), 0)}원`], [`${y - 1} 매출액`, eok(eokW(fin(y - 1, 'revenue', c))), y - 1 === 2022 ? '2022는 성장률 계산용 비교기준' : ''], ['전년 대비', pct(growth(fin(y, 'revenue', c), fin(y - 1, 'revenue', c)))], ['손익 검증', plCheck(y, c)]],
  formula: ['성장률 = (당기 ÷ 전기 − 1) × 100', '억원 = 원 ÷ 100,000,000 (표시만 반올림, 저장값은 원 단위 그대로)'],
  facts: [`${coName(c)} 매출: ${YEARS.map((yy) => `${yy} ${eok(eokW(fin(yy, 'revenue', c)))}`).join(' → ')}.`],
  company: c === 'SY' ? [DOC.company] : [], impl: c === 'SY' ? [DOC.supply] : [], nodoc: c === 'NS' ? NODOC_NS : null,
  limits: [LIMIT_CONSOL_OF(c), ...(c === 'NS' ? [LIMIT_NSNEW] : [])], sources: [...finSources(c, y, ['revenue'], 'pl'), ...(c === 'SY' ? [SRC.mgmt] : [])], audit: finAudit(c, [y, y - 1], ['revenue', 'cost_of_sales', 'sga', 'operating_profit']) });
const detailOP = (y, c = S.company) => ({ title: `${coName(c)} ${y} 영업이익`, sub: c === 'SY' ? '연결 · 불닭 브랜드 영업이익은 공개자료 없음' : '농심 연결',
  rows: [[`${y}`, eok(eokW(fin(y, 'operating_profit', c))), `원 단위 ${fmt(fin(y, 'operating_profit', c), 0)}원`], [`${y - 1}`, eok(eokW(fin(y - 1, 'operating_profit', c)))], ['전년 대비', pct(growth(fin(y, 'operating_profit', c), fin(y - 1, 'operating_profit', c)))], ['매출 전년 대비', pct(growth(fin(y, 'revenue', c), fin(y - 1, 'revenue', c)))], ['손익 검증', plCheck(y, c)]],
  formula: ['영업이익 = 매출 − 매출원가 − 판매비와관리비', '성장률 = (당기 ÷ 전기 − 1) × 100'],
  facts: c === 'SY' ? ['02 문서: 2024 매출 44.9%·영업이익 133.6% 증가, 2025 매출 36.1%·영업이익 52.1% 증가.'] : [], company: c === 'SY' ? [DOC.company] : [], nodoc: c === 'NS' ? NODOC_NS : null,
  limits: [LIMIT_CONSOL_OF(c), ...(c === 'NS' ? [LIMIT_NSNEW] : [])], sources: finSources(c, y, ['operating_profit'], 'pl'), audit: finAudit(c, [y, y - 1], ['operating_profit', 'revenue']) });
const detailMargin = (y, c = S.company) => ({ title: `${coName(c)} ${y} 영업이익률`,
  rows: [[`${y}`, pct(margin(y, c))], [`${y - 1}`, pct(margin(y - 1, c)), `변화 ${signed(pp(margin(y, c), margin(y - 1, c)), '%p')}`], ['매출원가율', pct(met(y, 'cost_ratio_pct', c))], ['판관비율', pct(met(y, 'sga_ratio_pct', c))]],
  formula: ['영업이익률 = 영업이익 ÷ 매출액 × 100', '= 100 − 매출원가율 − 판관비율', '비율 변화는 %p'],
  facts: c === 'SY' ? [DOC.y2024, DOC.y2025] : [], company: c === 'SY' ? [DOC.company] : [], nodoc: c === 'NS' ? NODOC_NS : null,
  limits: ['손익 산식으로 확인되는 변화이며 개별 원인의 기여도 측정이 아닙니다.', LIMIT_CONSOL_OF(c)], sources: finSources(c, y, ['operating_profit', 'revenue'], 'pl'), audit: finAudit(c, [y, y - 1], ['operating_profit', 'revenue']) });
const detailExport = (y) => (S.company !== 'SY' ? detailNsSeg(y) : { title: `${y} 면스낵 수출 비중`, sub: '삼양식품 면스낵 제품 안의 비중 · 회사 전체 해외매출 비중이 아님',
  rows: [['면스낵 수출', eok(eokM(seg(y, '면스낵')?.exports ?? null))], ['면스낵 내수', eok(eokM(seg(y, '면스낵')?.domestic ?? null))], ['수출 비중', pct(exportShare(y))], [`${y - 1} 수출 비중`, pct(exportShare(y - 1)), exportShare(y - 1) === null ? '2022 사업부문 수출·내수 자료는 패키지에 없음' : `변화 ${signed(pp(exportShare(y), exportShare(y - 1)), '%p')}`]],
  formula: ['면스낵 수출 비중 = 수출 ÷ (수출 + 내수) × 100', '억원 = 백만원 ÷ 100'],
  facts: [`면스낵 수출 비중 (CSV 계산): ${YEARS.map((yy) => `${yy} ${pct(exportShare(yy))}`).join(' → ')}.`], impl: [DOC.supply],
  limits: ['면스낵 사업 안의 비중이며 회사 전체 해외매출 비중과 다릅니다.', '제품 매출 구분이며 불닭 단독 매출이 아닙니다.', '농심은 집계·매출에누리 범위가 달라 이 지표를 비교하지 않습니다 (calculated_metrics.csv export_share_status).'], sources: [SRC.seg], audit: [...(seg(y, '면스낵')?.audit || []), ...(seg(y - 1, '면스낵')?.audit || [])] });

const PAGE = {};

// ---------- 종합 현황 ----------
PAGE.overview = {
  kpis() {
    const y = yr(); const c = S.company; const col = COMPANIES[c].color; const Q = Qc(c);
    const m = margin(y, c), mp = margin(y - 1, c);
    const cards = [
      kpiCard('매출액', fmt(eokW(fin(y, 'revenue', c))), '억원', `${coName(c)} 연결 · 막대 = 12분기`, pillHTML(growth(fin(y, 'revenue', c), fin(y - 1, 'revenue', c)), '%') + ` ${y - 1} 대비`, () => openDetail(detailRevenue(y, c)), col, Q.map((q) => ({ v: q.revenue, sel: q.year === y }))),
      kpiCard('영업이익', fmt(eokW(fin(y, 'operating_profit', c))), '억원', `${coName(c)} 연결 · 막대 = 12분기`, pillHTML(growth(fin(y, 'operating_profit', c), fin(y - 1, 'operating_profit', c)), '%') + ` ${y - 1} 대비`, () => openDetail(detailOP(y, c)), '#3b3936', Q.map((q) => ({ v: q.op, sel: q.year === y }))),
      kpiCard('영업이익률', fmt(m), '%', '영업이익 ÷ 매출 · 막대 = 12분기', pillHTML(pp(m, mp), '%p') + ` ${y - 1} 대비`, () => openDetail(detailMargin(y, c)), '#24987a', Q.map((q) => ({ v: q.margin, sel: q.year === y }))),
    ];
    if (c === 'SY') { const ex = exportShare(y), exp = exportShare(y - 1); cards.push(kpiCard('면스낵 수출 비중', fmt(ex), '%', '면스낵 사업 안의 비중 · 전사 해외비중 아님', pillHTML(pp(ex, exp), '%p') + (exp === null ? ' 2022 사업부문 자료 없음' : ` ${y - 1} 대비`), () => openDetail(detailExport(y)), '#3d6fb6', YEARS.map((yy) => ({ v: exportShare(yy), sel: yy === y })))); }
    else { const st = metRow(y, 'NS')?.export_share_status || ''; cards.push(kpiCard('면스낵 수출 비중', '비교 불가', '', st.replace('비교 불가: ', ''), '<span class="pill na">자료 범위 차이</span> 농심 제품별 표는 별도', () => openDetail(detailNsSeg(y)), '#8f8a82')); }
    return cards;
  },
  cards() {
    const c = S.company;
    return [
      { id: 'ov-trend', w: 4, title: () => (S.period === 'annual' ? `${coName(c)} 매출·영업이익 추이 (억원)` : `${coName(c)} 분기 매출·영업이익 (억원)`), sub: () => (S.period === 'annual' ? '연결 · 선택 연도 진하게' : '단일 3개월 손익 · Q4는 연간 − 9개월(결산조정 포함)'), body: (b) => trendChart(b), detail: () => detailRevenue(yr()) },
      c === 'SY'
        ? { id: 'ov-export', w: 2, title: '면스낵 수출·내수 (억원)', sub: '사업보고서 p.27 · 불닭 단독 아님', body: (b) => exportChart(b, '면스낵'), detail: () => detailSegment('면스낵', yr()) }
        : { id: 'ov-export', w: 2, title: '농심 제품별 내수·수출 (억원)', sub: 'nongshim_segments · 매출에누리 별도 · 삼양 면스낵과 범위 다름', body: (b) => nsSegChart(b), detail: () => detailNsSeg(yr()) },
      c === 'SY'
        ? { id: 'ov-fe', w: 3, title: () => `${yr()} 해외 판매법인 매출 (억원)`, sub: '원화 환산 · 얇은 막대 = 전년 · 연결매출에 합산 금지', body: (b) => feBars(b), detail: () => detailEntity(S.entity === 'all' ? '미국' : S.entity) }
        : { id: 'ov-fe', w: 3, title: () => `${yr()} 농심 사업지역별 외부고객 수익 (억원)`, sub: '지역 영업부문 기준 · 삼양 해외법인과 비교 금지', body: (b) => nsRegionBars(b), detail: () => detailNsRegion(yr()) },
      { id: 'ov-margin', w: 3, title: '영업이익률과 원가 구조 (%)', sub: '영업이익률 · 매출원가율 · 판관비율', body: (b) => ratioChart(b), detail: () => detailRatios(yr()) },
    ];
  },
};
function trendChart(b, c = S.company) {
  const col = COMPANIES[c]; const Q = Qc(c);
  const el = h('div', { class: 'chart' }); const lg = h('div', { class: 'legend', html: `<span><i style="background:${col.color}"></i>매출액</span><span><i style="background:#3b3936"></i>영업이익</span>` }); b.append(el, lg);
  if (S.period === 'annual') {
    barChart(el, { data: YEARS.map((y) => ({ label: String(y), year: y, rev: eokW(fin(y, 'revenue', c)), op: eokW(fin(y, 'operating_profit', c)) })), series: [{ key: 'rev', color: col.color }, { key: 'op', color: C.dark }], colorOf: (s, d) => (d.year === S.year ? s.color : s.key === 'rev' ? col.soft : C.darkSoft), isSel: isSelY, fmt: (v) => fmt(v, 0), labels: (v) => fmt(v, 0),
      tip: (d) => [`${d.year}년 · ${col.name} 연결`, `매출액 ${eok(d.rev)}`, `영업이익 ${eok(d.op)}`, `영업이익률 ${pct(margin(d.year, c))}`, '클릭 → 상세·출처'], onClick: (d) => openDetail(detailRevenue(d.year, c)) });
  } else {
    const L = Q.map((q) => q.period);
    lineChart(el, { labels: L, height: 230, twoRow: YEARS.map((y) => ({ from: `${y}-Q1`, to: `${y}-Q4`, text: String(y), hi: y === S.year })), tickText: (l) => l.slice(5), band: [`${S.year}-Q1`, `${S.year}-Q4`], fmt: (v) => fmt(v, 0),
      series: [{ values: Q.map((q) => eokW(q.revenue)), color: col.color, area: true, dots: (l) => l.startsWith(String(S.year)), endLabel: (v) => fmt(v, 0) }, { values: Q.map((q) => eokW(q.op)), color: C.dark, dots: (l) => l.startsWith(String(S.year)) }],
      tip: (l, i) => { const q = Q[i]; const p = Q.find((r) => r.year === q.year - 1 && r.quarter === q.quarter); return [`${q.period} · ${col.name} · 단일 분기`, `매출 ${eok(eokW(q.revenue))}${p ? ` (전년 동기 ${signed(growth(q.revenue, p.revenue), '%')})` : ''}`, `영업이익 ${eok(eokW(q.op))}`, `이익률 ${pct(q.margin)}`, '클릭 → 분기 상세']; }, onClick: (l, i) => openDetail(detailQuarter(Q[i])) });
  }
}
function detailQuarter(q) {
  const p = QALL.find((r) => r.c === q.c && r.year === q.year - 1 && r.quarter === q.quarter);
  const sumOk = (k, kk) => { const qs = Qc(q.c).filter((r) => r.year === q.year); return qs.length === 4 && d3.sum(qs, (r) => r[k]) === fin(q.year, kk, q.c); };
  return { title: `${coName(q.c)} ${q.period} 분기 실적`, sub: '단일 3개월 손익 · 연결', rows: [['매출액', eok(eokW(q.revenue)), p ? `전년 동기 대비 ${signed(growth(q.revenue, p.revenue), '%')}` : '전년 동기 데이터 없음 (2022 분기 미수록)'], ['매출원가', eok(eokW(q.cost))], ['판관비', eok(eokW(q.sga))], ['영업이익', eok(eokW(q.op)), p ? `전년 동기 대비 ${signed(growth(q.op, p.op), '%')}` : ''], ['영업이익률', pct(q.margin), p ? `전년 동기 ${pct(p.margin)} · 변화 ${signed(pp(q.margin, p.margin), '%p')}` : ''], ['산출 방법', q.method], ['손익 검증', q.revenue - q.cost - q.sga === q.op ? '매출 − 원가 − 판관비 = 영업이익 ✓' : '불일치'], [`${q.year} 4개 분기 합 = 연간`, ['revenue', 'cost', 'sga', 'op'].every((k, i) => sumOk(k, ['revenue', 'cost_of_sales', 'sga', 'operating_profit'][i])) ? '매출·원가·판관비·영업이익 모두 일치 ✓' : '불일치']],
    formula: ['Q1 = 반기 누적 − Q2 · Q3 = 9개월 누적 − 반기 누적 · Q4 = 연간 확정 − 9개월 누적', '전년 동기 대비 = (당분기 ÷ 전년 같은 분기 − 1) × 100'], impl: ['단일 분기보다 전년 동기·연간 흐름으로 판단합니다.'],
    limits: ['Q4는 연간 결산조정이 포함된 잔여 분기입니다.', '누적 실적과 섞지 않았고 증권사 추정치를 쓰지 않았습니다.', ...(q.c === 'NS' ? ['농심 분기값은 공시 원문 기반 신규 계산입니다(감사 원장 상태 참고).'] : [])], sources: [srcFrom(q.source), ...auditSources(q.audit)], audit: q.audit };
}
function exportChart(b, segName) {
  const el = h('div', { class: 'chart' }); b.append(el, h('div', { class: 'legend', html: '<span><i style="background:#3d6fb6"></i>수출</span><span><i style="background:#df6d36"></i>내수</span>' }));
  barChart(el, { stacked: true, data: YEARS.map((y) => { const s = seg(y, segName); return { label: String(y), year: y, ex: eokM(s?.exports ?? null), dom: eokM(s?.domestic ?? null) }; }), series: [{ key: 'ex', color: C.blue }, { key: 'dom', color: C.orange }], colorOf: (s, d) => (d.year === S.year ? s.color : d3.interpolateRgb(s.color, '#ffffff')(0.55)), isSel: isSelY, fmt: (v) => fmt(v, 0), pad: 0.38,
    topLabel: (d) => `수출 ${fmt((d.ex / (d.ex + d.dom)) * 100, 1)}%`, tip: (d) => [`${d.year} ${segName}`, `수출 ${eok(d.ex)}`, `내수 ${eok(d.dom)}`, `수출 비중 ${pct((d.ex / (d.ex + d.dom)) * 100)}`, '클릭 → 상세'], onClick: (d) => openDetail(detailSegment(segName, d.year)) });
}
function detailSegment(name, y) {
  const s = seg(y, name), p = seg(y - 1, name);
  return { title: `${y} ${name} 내수·수출`, sub: '삼양식품 사업보고서 제품 매출 구분 · 불닭 단독 아님', rows: [['수출', eok(eokM(s?.exports ?? null)), p ? `전년 대비 ${signed(growth(s.exports, p.exports), '%')}` : '2022 사업부문 자료 없음'], ['내수', eok(eokM(s?.domestic ?? null)), p ? `전년 대비 ${signed(growth(s.domestic, p.domestic), '%')}` : ''], ['합계', eok(eokM(s?.total ?? null)), s && s.exports + s.domestic === s.total ? '수출 + 내수 = 합계 ✓' : ''], ['수출 비중', pct(s ? (s.exports / (s.exports + s.domestic)) * 100 : null)]], formula: ['수출 비중 = 수출 ÷ (수출 + 내수) × 100', '억원 = 백만원 ÷ 100'],
    facts: [`${name} 수출 (CSV): ${YEARS.map((yy) => `${yy} ${eok(eokM(seg(yy, name)?.exports ?? null))}`).join(' → ')}`, `${name} 내수 (CSV): ${YEARS.map((yy) => `${yy} ${eok(eokM(seg(yy, name)?.domestic ?? null))}`).join(' → ')}`], impl: [DOC.supply],
    limits: ['면스낵 수출 비중은 회사 전체 해외매출 비중과 다릅니다.', '제품 매출 구분이며 불닭 단독 매출이 아닙니다.'], sources: [SRC.seg], audit: [...(s?.audit || []), ...(p?.audit || [])] };
}
function feBars(b) {
  const el = h('div', { class: 'chart short' }); b.append(el);
  const data = ENTITIES.map((e) => { const c = FE.find((f) => f.entity === e && f.year === S.year); const p = FE.find((f) => f.entity === e && f.year === S.year - 1); const notYet = c && c.rev === null && /미설립/.test(c.note);
    return { label: e, entity: e, v: eokK(c?.rev ?? null), prev: eokK(p?.rev ?? null), text: c?.rev === null || !c ? (notYet ? '설립 전' : '데이터 없음') : `${fmt(eokK(c.rev), 0)}  ${c.growth === null ? (p && p.rev === null ? '(설립 다음 해)' : '(전년 없음)') : signed(c.growth, '%')}`, sel: S.entity === 'all' ? false : S.entity === e, color: S.entity === 'all' || S.entity === e ? C.accent : C.darkSoft }; }).sort((a, b2) => (b2.v ?? -1) - (a.v ?? -1));
  hbars(el, { data, prev: true, tip: (d) => [`${d.entity} 판매법인 · ${S.year}`, `매출 ${d.v === null ? d.text : eok(d.v)}`, `${S.year - 1}: ${d.prev === null ? (d.entity === '유럽' && S.year - 1 === 2023 ? '설립 전' : '데이터 없음') : eok(d.prev)}`, '연결 내부거래 제거 전 · 합산 금지', '클릭 → 법인 상세'], onClick: (d) => openDetail(detailEntity(d.entity)) });
}
const FE_DOC = { 미국: ['사업보고서 p.26: 미국법인 2025 매출 약 419백만달러, 성장률 50.8%와 메인스트림 입점·프로모션 확대를 설명. 월마트·코스트코에 이어 크로거·샘스클럽·타겟 등이 언급된다(2025 보고 시점의 판매채널 설명이며 모든 업체의 최초 입점일이나 전 점포 판매를 의미하지 않음).'], 중국: ['사업보고서: 판매망 확대 및 소비자 수요에 따른 제품 다변화 설명.'], 일본: ['사업보고서: 직거래선과 신규 거래처 확보 설명.'] };
function detailEntity(e) {
  const rows = YEARS.map((y) => { const f = FE.find((r) => r.entity === e && r.year === y); return [`${y} 매출 (원화)`, f?.rev === null || !f ? (/미설립/.test(f?.note || '') ? '설립 전' : '데이터 없음') : eok(eokK(f.rev)), f?.growth !== null && f ? `원화 성장률 ${pct(f.growth)}` : f?.rev === null ? '0이 아니라 해당 없음' : '']; });
  const l = FEL.find((r) => r.entity === e); if (l) rows.push([`${l.year} 현지통화 (설명값)`, `${fmt(l.rev, l.rev < 100 ? 1 : 0)} ${l.unit.replace('_', ' ')}`, l.growth !== null ? `현지통화 성장률 ${pct(l.growth)} · 근사값` : '근사값 · 현지통화 성장률 없음']);
  const srcs = [...new Set(FE.filter((f) => f.entity === e).map((f) => f.source))].map(srcFrom);
  return { title: `해외 판매법인: ${e}`, sub: '삼양식품 연결 대상 종속기업 요약재무정보 (천원 → 억원)', rows, formula: ['억원 = 천원 ÷ 100,000', '원화 성장률 = (당기 ÷ 전기 − 1) × 100'], company: FE_DOC[e] || [], limits: LIMIT_FE, sources: [...srcs, SRC.local], audit: FE.filter((f) => f.entity === e).flatMap((f) => f.audit) };
}
function ratioChart(b, c = S.company) {
  const el = h('div', { class: 'chart short' }); b.append(el, h('div', { class: 'legend', html: '<span><i class="line" style="background:#d4262c"></i>영업이익률</span><span><i class="line" style="background:#3d6fb6"></i>매출원가율</span><span><i class="line" style="background:#df6d36"></i>판관비율</span>' }));
  lineChart(el, { labels: YEARS.map(String), height: 180, yMax: 80, fmt: (v) => v + '%', right: 40, isSelLabel: (l) => +l === S.year,
    series: [{ values: YEARS.map((y) => met(y, 'operating_margin_pct', c)), color: C.accent, width: 2.4, dots: () => true, endLabel: (v) => pct(v) }, { values: YEARS.map((y) => met(y, 'cost_ratio_pct', c)), color: C.blue, dots: () => true, endLabel: (v) => pct(v) }, { values: YEARS.map((y) => met(y, 'sga_ratio_pct', c)), color: C.orange, dots: () => true, endLabel: (v) => pct(v) }],
    tip: (l) => [`${l}년 · ${coName(c)}`, `영업이익률 ${pct(met(+l, 'operating_margin_pct', c))}`, `매출원가율 ${pct(met(+l, 'cost_ratio_pct', c))}`, `판관비율 ${pct(met(+l, 'sga_ratio_pct', c))}`, '클릭 → 상세'], onClick: (l) => openDetail(detailRatios(+l, c)) });
}
function detailRatios(y, c = S.company) {
  return { title: `${coName(c)} ${y} 수익성 구조`, rows: [['영업이익률', pct(met(y, 'operating_margin_pct', c)), `${y - 1} 대비 ${signed(pp(met(y, 'operating_margin_pct', c), met(y - 1, 'operating_margin_pct', c)), '%p')}`], ['매출원가율', pct(met(y, 'cost_ratio_pct', c)), `${y - 1} 대비 ${signed(pp(met(y, 'cost_ratio_pct', c), met(y - 1, 'cost_ratio_pct', c)), '%p')}`], ['판관비율', pct(met(y, 'sga_ratio_pct', c)), `${y - 1} 대비 ${signed(pp(met(y, 'sga_ratio_pct', c), met(y - 1, 'sga_ratio_pct', c)), '%p')}`]],
    formula: ['매출원가율 = 매출원가 ÷ 매출액 × 100', '판관비율 = 판매비와관리비 ÷ 매출액 × 100', '영업이익률 = 100 − 매출원가율 − 판관비율', 'calculated_metrics.csv 의 비율은 0~100 척도'],
    facts: c === 'SY' ? [DOC.y2024, DOC.y2025] : [], company: c === 'SY' ? [DOC.company] : [], nodoc: c === 'NS' ? NODOC_NS : null,
    limits: ['회사 설명은 요인별 기여액을 측정한 결과가 아닙니다.', LIMIT_CONSOL_OF(c)], sources: [...finSources(c, y, ['revenue', 'cost_of_sales', 'sga'], 'pl'), ...(c === 'SY' ? [SRC.mgmt] : [])], audit: finAudit(c, [y], ['revenue', 'cost_of_sales', 'sga', 'operating_profit']) };
}
// ---------- 농심 전용: 제품별·지역별 ----------
function nsSegChart(b) {
  const el = h('div', { class: 'chart' }); b.append(el, h('div', { class: 'legend', html: '<span><i style="background:#3d6fb6"></i>수출</span><span><i style="background:#df6d36"></i>내수</span><span>· 매출에누리 등(차감)은 표시 안 함</span>' }));
  const segs = ['라면', '스낵', '기타'];
  barChart(el, { stacked: true, data: segs.map((sname) => { const r = NSSEG.find((x) => x.year === S.year && x.segment === sname); return { label: sname, seg: sname, ex: eokM(r?.exports ?? null), dom: eokM(r?.domestic ?? null) }; }), series: [{ key: 'ex', color: C.blue }, { key: 'dom', color: C.orange }], fmt: (v) => fmt(v, 0), pad: 0.4,
    topLabel: (d) => fmt(d.ex + d.dom, 0), tip: (d) => [`농심 ${S.year} ${d.seg}`, `수출 ${eok(d.ex)}`, `내수 ${eok(d.dom)}`, '제품·상품·기타 통합 · 매출에누리 별도', '클릭 → 상세'], onClick: () => openDetail(detailNsSeg(S.year)) });
}
function detailNsSeg(y) {
  const rows = NSSEG.filter((r) => r.year === y).map((r) => [r.segment, `내수 ${eok(eokM(r.domestic))} · 수출 ${r.exports === null ? '(빈 값)' : eok(eokM(r.exports))}`, `합계(에누리 전) ${eok(eokM(r.total))}${r.segment === '매출에누리 등' ? ' · 차감 항목, 빈 수출을 0으로 보지 않음' : ''}`]);
  const tot = d3.sum(NSSEG.filter((r) => r.year === y), (r) => r.total);
  rows.push(['사업 합계 (백만원)', fmt(tot, 0), `연결 매출 ${fmt(fin(y, 'revenue', 'NS') / 1e6, 0)}백만원과 비교 — 백만원 반올림 차이 허용 (검증결과.json ‘NS 사업합’)`]);
  return { title: `농심 ${y} 제품별 내수·수출`, sub: 'nongshim_segments.csv · 백만원 → 억원', badge: '공시 원문 추출', rows, formula: ['억원 = 백만원 ÷ 100', '사업 합계 = 라면 + 스낵 + 기타 + 매출에누리 등(음수)'],
    nodoc: NODOC_NS, limits: ['제품·상품·기타 통합, 매출에누리 별도 집계입니다. 삼양 면스낵과 같은 범위가 아니므로 수출비중·제품별 순위를 강제로 비교하지 않습니다 (01 지침 2절).', '내수에 해외 종속회사 현지 매출이 포함되는지 등 범위에 유의합니다. 수출은 그룹 해외매출 전체가 아닙니다.', LIMIT_NSNEW],
    sources: [...new Set(NSSEG.map((r) => r.source))].map(regSrc) };
}
function nsRegionBars(b) {
  const el = h('div', { class: 'chart short' }); b.append(el);
  const data = NSREGIONS.map((rg) => { const c = NSREG.find((r) => r.region === rg && r.year === S.year); const p = NSREG.find((r) => r.region === rg && r.year === S.year - 1); return { label: rg, region: rg, v: eokK(c?.v ?? null), prev: eokK(p?.v ?? null), text: c ? `${fmt(eokK(c.v), 0)}${p ? '  ' + signed(growth(c.v, p.v), '%') : ''}` : '해당 연도 행 없음', color: rg === '한국' ? C.darkSoft : C.blue }; }).sort((a, b2) => (b2.v ?? -1) - (a.v ?? -1));
  hbars(el, { data, prev: true, tip: (d) => [`농심 ${d.region} · ${S.year}`, `외부고객 수익 ${d.v === null ? '해당 연도 행 없음' : eok(d.v)}`, `${S.year - 1}: ${d.prev === null ? '행 없음' : eok(d.prev)}`, '지역 영업부문 기준', '클릭 → 상세'], onClick: () => openDetail(detailNsRegion(S.year)) });
  b.append(h('p', { class: 'note' }, '유럽은 2025년 행만 있습니다. 2023·2024년 행이 없는 이유는 CSV에 기재되어 있지 않아 0으로 그리지 않습니다.'));
}
function detailNsRegion(y) {
  const rs = NSREG.filter((r) => r.year === y); const tot = d3.sum(rs, (r) => r.v); const nonKr = d3.sum(rs.filter((r) => r.region !== '한국'), (r) => r.v);
  return { title: `농심 ${y} 사업지역별 외부고객 수익`, sub: 'nongshim_region_revenue.csv · 천원 → 억원', badge: '공시 원문 신규 추출',
    rows: [...rs.map((r) => [r.region, eok(eokK(r.v)), (() => { const p = NSREG.find((x) => x.region === r.region && x.year === y - 1); return p ? `${y - 1} 대비 ${signed(growth(r.v, p.v), '%')}` : `${y - 1} 행 없음`; })()]), ['지역 합계', eok(eokK(tot)), `연결 매출 ${eok(eokW(fin(y, 'revenue', 'NS')))}와 천원 반올림 범위에서 대조 (02 문서 추가 보완)`], ['한국 외 지역 합계 비중', pct((nonKr / tot) * 100), '= 한국 외 지역 합 ÷ 지역 합계 × 100 (농심 내부 구성비)']],
    formula: ['억원 = 천원 ÷ 100,000', '한국 외 비중 = (지역 합계 − 한국) ÷ 지역 합계 × 100'], nodoc: NODOC_NS, limits: [...LIMIT_NSREG, '한국 외 비중은 삼양 면스낵 수출 비중과 정의가 달라 나란히 비교하지 않습니다.', LIMIT_NSNEW],
    sources: auditSources(rs.flatMap((r) => r.audit)), audit: rs.flatMap((r) => r.audit) };
}

// ---------- 해외시장 ----------
PAGE.market = {
  kpis() {
    if (S.company === 'NS') return nsMarketKpis();
    const y = yr(); const s = seg(y, '면스낵'), p = seg(y - 1, '면스낵'); const e = S.entity === 'all' ? null : S.entity;
    const f = e ? FE.find((r) => r.entity === e && r.year === y) : null;
    const top = FE.filter((r) => r.year === y && r.rev !== null).sort((a, b) => b.rev - a.rev)[0];
    return [
      kpiCard('면스낵 수출', fmt(eokM(s?.exports ?? null)), '억원', '사업부문 · 제품 매출', pillHTML(p ? growth(s.exports, p.exports) : null, '%') + (p ? ` ${y - 1} 대비` : ' 2022 자료 없음'), () => openDetail(detailSegment('면스낵', y)), '#3d6fb6'),
      kpiCard('면스낵 수출 비중', fmt(exportShare(y)), '%', '면스낵 사업 안', pillHTML(exportShare(y - 1) === null ? null : exportShare(y) - exportShare(y - 1), '%p'), () => openDetail(detailSegment('면스낵', y)), '#3d6fb6'),
      e ? kpiCard(`${e} 법인 매출`, f?.rev === null || !f ? (/미설립/.test(f?.note || '') ? '설립 전' : '없음') : fmt(eokK(f.rev)), f?.rev ? '억원' : '', '원화 환산 · 연결제거 전', pillHTML(f?.growth ?? null, '%'), () => openDetail(detailEntity(e)))
        : kpiCard('최대 판매법인', top ? top.entity : '—', '', top ? `${eok(eokK(top.rev))} · 원화 환산` : '', pillHTML(top?.growth ?? null, '%'), () => top && openDetail(detailEntity(top.entity))),
      kpiCard('소스조미소재 수출', fmt(eokM(seg(y, '소스조미소재')?.exports ?? null)), '억원', '사업부문 · 제품 매출', pillHTML(seg(y - 1, '소스조미소재') ? growth(seg(y, '소스조미소재').exports, seg(y - 1, '소스조미소재').exports) : null, '%'), () => openDetail(detailSegment('소스조미소재', y)), '#df6d36'),
    ];
  },
  cards() {
    if (S.company === 'NS') return nsMarketCards();
    return [
      { id: 'mk-seg-n', w: 3, title: '면스낵 수출·내수 (억원)', sub: '제품 매출 구분', body: (b) => exportChart(b, '면스낵'), detail: () => detailSegment('면스낵', yr()) },
      { id: 'mk-seg-s', w: 3, title: '소스조미소재 수출·내수 (억원)', sub: '제품 매출 구분', body: (b) => exportChart(b, '소스조미소재'), detail: () => detailSegment('소스조미소재', yr()) },
      { id: 'mk-contrib', w: 6, title: () => `${yr()} 연결매출 증가 기여 (억원)`, sub: '연결매출 증가액 = 면스낵 증가 + 소스조미소재 증가 + 나머지 매출·조정', body: (b) => contribChart(b), detail: () => detailContrib(yr()) },
      { id: 'mk-fe3', w: 4, title: '해외 판매법인 3개년 매출 (억원)', sub: () => (S.entity === 'all' ? '원화 환산 · 막대 색 = 연도 · 법인을 선택하면 강조' : `${S.entity} 강조 · 원화 환산`), body: (b) => feYears(b), detail: () => detailEntity(S.entity === 'all' ? '미국' : S.entity) },
      { id: 'mk-local', w: 2, title: '2025 현지통화 설명값', sub: '사업보고서 p.26~27 · 근사값 · 원화 표와 섞지 않음', body: (b) => localTable(b), detail: () => ({ title: '해외법인 현지통화 설명값', rows: FEL.map((l) => [l.entity, `${fmt(l.rev, l.rev < 100 ? 1 : 0)} ${l.unit.replace('_', ' ')}`, l.growth !== null ? `현지통화 성장률 ${pct(l.growth)}` : '성장률 없음']), limits: ['현지통화 성장률은 원화 환산 성장률과 다릅니다.', '근사값이며 연결매출에 합산하지 않습니다.'], sources: [SRC.local] }) },
    ];
  },
};
function nsMarketKpis() {
  const y = yr(); const r = (sg, yy) => NSSEG.find((x) => x.year === yy && x.segment === sg);
  const rg = NSREG.filter((x) => x.year === y); const tot = d3.sum(rg, (x) => x.v); const non = d3.sum(rg.filter((x) => x.region !== '한국'), (x) => x.v);
  const rgp = NSREG.filter((x) => x.year === y - 1); const totp = d3.sum(rgp, (x) => x.v); const nonp = d3.sum(rgp.filter((x) => x.region !== '한국'), (x) => x.v);
  const top = rg.filter((x) => x.region !== '한국').sort((a, b) => b.v - a.v)[0];
  return [
    kpiCard('라면 수출', fmt(eokM(r('라면', y)?.exports ?? null)), '억원', '농심 제품별 표 · 제품·상품 통합', pillHTML(r('라면', y - 1) ? growth(r('라면', y).exports, r('라면', y - 1).exports) : null, '%') + (r('라면', y - 1) ? ` ${y - 1} 대비` : ' 2022 제품별 자료 없음'), () => openDetail(detailNsSeg(y)), C.blue),
    kpiCard('라면 내수', fmt(eokM(r('라면', y)?.domestic ?? null)), '억원', '매출에누리 차감 전', pillHTML(r('라면', y - 1) ? growth(r('라면', y).domestic, r('라면', y - 1).domestic) : null, '%') + (r('라면', y - 1) ? ` ${y - 1} 대비` : ''), () => openDetail(detailNsSeg(y)), C.orange),
    kpiCard('한국 외 지역 수익 비중', fmt((non / tot) * 100), '%', '지역 영업부문 외부고객 수익 기준', pillHTML(rgp.length ? pp((non / tot) * 100, (nonp / totp) * 100) : null, '%p') + (rgp.length ? ` ${y - 1} 대비` : ' 2022 지역 자료 없음'), () => openDetail(detailNsRegion(y)), C.blue),
    kpiCard('최대 해외 지역', top ? top.region : '—', '', top ? `${eok(eokK(top.v))} · 외부고객 수익` : '', '<span class="pill na">지역 영업부문</span>', () => openDetail(detailNsRegion(y)), C.dark),
  ];
}
function nsMarketCards() {
  return [
    { id: 'mk-ns-seg', w: 3, title: () => `농심 ${yr()} 제품별 내수·수출 (억원)`, sub: '라면·스낵·기타 · 매출에누리 별도', body: (b) => nsSegChart(b), detail: () => detailNsSeg(yr()) },
    { id: 'mk-ns-segtbl', w: 3, title: '농심 제품별 3개년 (억원)', sub: '합계는 매출에누리 차감 전', body: (b) => nsSegTable(b), detail: () => detailNsSeg(yr()) },
    { id: 'mk-ns-reg', w: 3, title: () => `농심 ${yr()} 사업지역별 외부고객 수익 (억원)`, sub: '얇은 막대 = 전년 · 지역 영업부문 기준', body: (b) => nsRegionBars(b), detail: () => detailNsRegion(yr()) },
    { id: 'mk-ns-regtbl', w: 3, title: '농심 지역별 3개년 (억원)', sub: '행 없음 = 공시 표에 해당 연도 행 없음', body: (b) => nsRegionTable(b), detail: () => detailNsRegion(yr()) },
    { id: 'mk-ns-fe', w: 6, title: '농심 개별 해외법인 매출', sub: '01 지침: 제공되지 않은 항목은 ‘자료 없음’', body: (b) => b.append(h('div', { class: 'nodata' }, '자료 없음 — 이번 전달본에는 농심 개별 해외법인(종속기업) 매출이 제공되지 않았습니다. 지역별 외부고객 수익은 범위가 달라 삼양 해외 판매법인 매출과 직접 비교하지 않습니다.')) },
  ];
}
function nsSegTable(b) {
  const segs = ['라면', '스낵', '기타', '매출에누리 등'];
  b.append(h('div', { class: 'tw' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, '제품'), h('th', {}, '구분'), ...YEARS.map((y) => h('th', { class: y === S.year ? 'sel' : '' }, String(y))))),
    h('tbody', {}, segs.flatMap((sg) => ['domestic', 'exports'].map((k) => h('tr', { class: 'click', onclick: () => openDetail(detailNsSeg(S.year)) }, h('td', {}, k === 'domestic' ? sg : ''), h('td', { class: 'l' }, k === 'domestic' ? '내수' : '수출'), ...YEARS.map((y) => { const r = NSSEG.find((x) => x.year === y && x.segment === sg); const v = r ? r[k] : null; return h('td', { class: v === null ? 'nd' : '' }, v === null ? '(빈 값)' : fmt(eokM(v))); }))))))));
  b.append(h('p', { class: 'note' }, '매출에누리 등의 수출 칸은 원문이 빈 값입니다(0으로 해석하지 않음).'));
}
function nsRegionTable(b) {
  b.append(h('div', { class: 'tw' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, '지역'), ...YEARS.map((y) => h('th', { class: y === S.year ? 'sel' : '' }, String(y))))),
    h('tbody', {}, NSREGIONS.map((rg) => h('tr', { class: 'click', onclick: () => openDetail(detailNsRegion(S.year)) }, h('td', {}, rg), ...YEARS.map((y) => { const r = NSREG.find((x) => x.region === rg && x.year === y); return h('td', { class: r ? '' : 'nd' }, r ? fmt(eokK(r.v)) : '행 없음'); })))),
    h('tfoot', {}, h('tr', {}, h('td', {}, '지역 합계'), ...YEARS.map((y) => h('td', {}, fmt(eokK(d3.sum(NSREG.filter((r) => r.year === y), (r) => r.v))))))))));
}
function feYears(b) {
  const el = h('div', { class: 'chart' }); const yc = { 2023: '#e7b3b1', 2024: '#d9706f', 2025: '#b11d23' };
  b.append(el, h('div', { class: 'legend', html: YEARS.map((y) => `<span><i style="background:${yc[y]}"></i>${y}</span>`).join('') + '<span>· 유럽 2023 = 설립 전</span>' }));
  barChart(el, { data: ENTITIES.map((e) => { const o = { label: e, entity: e }; YEARS.forEach((y) => { o['y' + y] = eokK(FE.find((f) => f.entity === e && f.year === y)?.rev ?? null); }); return o; }), series: YEARS.map((y) => ({ key: 'y' + y, color: yc[y] })), maxBar: 22, pad: 0.2, nullLabel: '',
    colorOf: (s, d) => (S.entity !== 'all' && d.entity !== S.entity ? '#e4e0d9' : s.color), isSel: (d) => d.entity === S.entity, fmt: (v) => fmt(v, 0),
    tip: (d) => [`${d.entity} 판매법인`, ...YEARS.map((y) => `${y}: ${d['y' + y] === null ? (y === 2023 && d.entity === '유럽' ? '설립 전' : '데이터 없음') : eok(d['y' + y])}`), '클릭 → 법인 상세'], onClick: (d) => openDetail(detailEntity(d.entity)) });
}
function localTable(b) {
  b.append(h('div', { class: 'tw' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, '법인'), h('th', {}, '매출'), h('th', {}, '현지 성장률'))), h('tbody', {}, FEL.map((l) => h('tr', { class: 'click' + (S.entity === l.entity ? ' sel' : ''), onclick: () => openDetail(detailEntity(l.entity)) }, h('td', {}, l.entity), h('td', {}, `${fmt(l.rev, l.rev < 100 ? 1 : 0)} ${l.unit.replace('_', ' ')}`), h('td', { class: l.growth === null ? 'nd' : '' }, l.growth === null ? '데이터 없음' : pct(l.growth))))))));
  b.append(h('p', { class: 'note' }, '원화 환산 성장률(환율 영향 포함)과 다른 값입니다.'));
}
function contrib(y) {
  const t = (n, yy) => seg(yy, n)?.total ?? null;
  if (t('면스낵', y - 1) === null) return null;
  const dn = eokM(t('면스낵', y) - t('면스낵', y - 1)), ds = eokM(t('소스조미소재', y) - t('소스조미소재', y - 1)), dt = eokW(fin(y, 'revenue') - fin(y - 1, 'revenue'));
  return { dn, ds, dr: dt - dn - ds, dt };
}
function contribChart(b) {
  const c = contrib(yr());
  if (!c) { b.append(h('div', { class: 'nodata' }, `${yr()}년 기여도는 계산하지 않습니다. 2022 사업부문별 매출이 패키지에 없습니다. 2024 또는 2025를 선택하세요.`)); return; }
  const el = h('div', { class: 'chart short' }); b.append(el);
  hbars(el, { data: [{ label: '면스낵', v: c.dn, text: eok(c.dn), color: C.blue }, { label: '소스조미소재', v: c.ds, text: eok(c.ds), color: C.orange }, { label: '나머지 매출·조정', v: c.dr, text: eok(c.dr), color: C.base }, { label: '연결매출 증가액', v: c.dt, text: eok(c.dt), color: C.accent }], rowH: 32, tip: (d) => [d.label, `${yr() - 1}→${yr()} ${d.text}`, '클릭 → 계산식'], onClick: () => openDetail(detailContrib(yr())) });
}
function detailContrib(y) { const c = contrib(y); return { title: `${y} 연결매출 증가 기여`, rows: c ? [['면스낵 증가', eok(c.dn)], ['소스조미소재 증가', eok(c.ds)], ['나머지 매출·조정', eok(c.dr)], ['연결매출 증가액', eok(c.dt)]] : [['계산', '데이터 없음', '2022 사업부문 자료 없음']], formula: ['사업별 기여액 = 당기 사업 매출 − 전기 사업 매출', '나머지 = 연결매출 증가액 − 면스낵 증가 − 소스조미소재 증가'], limits: ['‘나머지 매출·조정’은 원문 단일 사업부가 아닌 차이 조정 항목입니다.', '사업 표는 백만원 단위라 반올림 차이가 있을 수 있습니다.'], sources: [SRC.seg, SRC.pl] }; }

// ---------- 검색 관심도 ----------
const sOf = (rg) => SEARCH.filter((s) => s.region === rg);
const peakOf = (rg) => sOf(rg).reduce((a, b) => (b.v > a.v ? b : a));
const avgOf = (rg, y) => d3.mean(sOf(rg).filter((s) => s.y === y), (s) => s.v);
PAGE.search = {
  kpis() {
    const rg = S.region; const pk = peakOf(rg); const yv = sOf(rg).filter((s) => s.y === yr()); const ymax = yv.reduce((a, b) => (b.v > a.v ? b : a));
    const a = avgOf(rg, yr()), ap = avgOf(rg, yr() - 1);
    return [
      kpiCard(`${REGIONS[rg]} 기간 최고점`, pk.month, '', REGION_DESC[rg], '<span class="pill na">지수 100</span> 2023–2025 중', () => openDetail(detailSearchMonth(rg, pk)), C.accent),
      kpiCard(`${yr()} 최고 월`, ymax.month.slice(5) + '월', '', `${REGIONS[rg]} · 지수 ${fmt(ymax.v, rg === 'KR' ? 1 : 0)}`, '<span class="pill na">연도 내</span>', () => openDetail(detailSearchMonth(rg, ymax)), C.accent),
      kpiCard(`${yr()} 월평균 지수`, fmt(a, 1), '', `${REGIONS[rg]} · 같은 지역 안에서만 비교`, pillHTML(ap ? a - ap : null, 'pt') + (ap ? ` ${yr() - 1} 대비` : ' 2022 자료 없음'), () => openDetail({ title: `${REGIONS[rg]} ${yr()} 월평균 지수`, rows: YEARS.map((y) => [`${y} 월평균`, fmt(avgOf(rg, y), 1)]), formula: ['월평균 = 해당 연도 12개월 지수의 산술평균 (같은 지역 시계열 안에서만 비교)'], limits: LIMIT_SEARCH, sources: [rg === 'KR' ? SRC.naver : SRC.google] }), C.dark),
      kpiCard('최고점 시기 비교', `${peakOf('Worldwide').month.slice(2)} / ${peakOf('KR').month.slice(2)}`, '', 'Google 전 세계 / 네이버 국내', '<span class="pill na">시기만 비교</span>', () => openDetail(detailPeaks()), C.blue),
    ];
  },
  cards() {
    return [
      { id: 'sr-line', w: 4, title: () => `월간 검색 관심도 — ${REGION_DESC[S.region]}`, sub: () => `음영 = ${yr()} · 점선 = 월 단위로 공개된 사건(시기 표시일 뿐 인과 아님)`, body: (b) => searchLine(b), detail: () => detailSearchMonth(S.region, peakOf(S.region)) },
      { id: 'sr-peaks', w: 2, title: '플랫폼별 최고점 시기', sub: '각 지역 자체 기준(최고 = 100) · 수준 비교 금지', body: (b) => peakTable(b), detail: () => detailPeaks() },
      { id: 'sr-multi', w: 3, title: '3개 지역 추이 (각자 축)', sub: '형태와 최고점 시기만 비교 · 지수 수준 비교 금지', body: (b) => smallMultiples(b), detail: () => detailPeaks() },
      { id: 'sr-heat', w: 3, title: () => `월별 히트맵 — ${REGIONS[S.region]}`, sub: '진할수록 높은 지수 · 테두리 = 기간 최고점', body: (b) => searchHeat(b), detail: () => detailSearchMonth(S.region, peakOf(S.region)) },
      { id: 'sr-region', w: 3, title: () => (S.region === 'KR' ? '지역별 관심도' : `지역별 관심도 상위 10 — ${REGIONS[S.region]}`), sub: 'Google 원자료 상대 점수 (검색 건수·판매 순위 아님)', body: (b) => regionBars(b), detail: () => ({ title: '지역별 관심도', facts: ['Google Trends by_region 원자료의 상대 점수입니다(최고 지역 = 100).'], limits: ['검색 건수나 판매량 순위가 아닙니다.', '네이버 국내 자료에는 지역 구분이 없습니다.'], sources: [SRC.google] }) },
      { id: 'sr-query', w: 3, title: '관련 검색어 (Google)', sub: '인기 상위 8 · 증가율 비교 기준 불명확 → KPI로 쓰지 않음', body: (b) => queryTable(b), detail: () => ({ title: '관련 검색어', limits: ['increase percent의 비교 기준이 원본만으로 확인되지 않습니다.', '‘Breakout’은 원문 표기를 유지했습니다.', '리콜·암 관련 검색은 소비자의 질문이며 사실 확인 자료가 아닙니다.'], sources: [{ label: 'sources/searched_with_top/rising-searches_queries_*.csv' }] }) },
    ];
  },
};
const monthEvents = () => EVENTS.filter((e) => /^\d{4}-\d{2}/.test(e.period)).map((e) => ({ ...e, month: e.period.slice(0, 7) }));
function searchLine(b) {
  const rg = S.region; const s = sOf(rg); const el = h('div', { class: 'chart' }); b.append(el);
  const pk = peakOf(rg); const ev = monthEvents();
  lineChart(el, { labels: s.map((d) => d.month), height: 240, yMax: 105, fmt: (v) => fmt(v, 0), every: 3, tickText: (l) => (l.endsWith('-01') ? l.slice(0, 4) : l.slice(5) + '월'), band: [`${yr()}-01`, `${yr()}-12`],
    series: [{ values: s.map((d) => d.v), color: rg === 'KR' ? C.orange : rg === 'US' ? C.violet : C.blue, area: true, width: 2.2 }], events: ev.map((e) => ({ at: e.month })), peaks: [{ at: pk.month, v: pk.v, text: `최고 ${pk.month}` }],
    tip: (l, i) => { const d = s[i]; const p = s.find((r) => r.y === d.y - 1 && r.m === d.m); const es = ev.filter((e) => e.month === l); return [`${l} · ${REGIONS[rg]}`, `지수 ${fmt(d.v, rg === 'KR' ? 1 : 0)}`, `전년 같은 달 ${p ? fmt(p.v, rg === 'KR' ? 1 : 0) : '데이터 없음'}`, ...es.map((e) => `사건: ${e.title}`), '클릭 → 월 상세']; },
    onClick: (l, i) => openDetail(detailSearchMonth(rg, s[i])) });
}
function detailSearchMonth(rg, d) {
  const s = sOf(rg); const p = s.find((r) => r.y === d.y - 1 && r.m === d.m); const rank = [...s].sort((a, b) => b.v - a.v).findIndex((r) => r.month === d.month) + 1; const es = monthEvents().filter((e) => e.month === d.month);
  return { title: `${d.month} 검색 관심도 — ${REGIONS[rg]}`, sub: REGION_DESC[rg], rows: [['지수', fmt(d.v, rg === 'KR' ? 2 : 0)], ['전년 같은 달', p ? fmt(p.v, rg === 'KR' ? 2 : 0) : '데이터 없음', p ? '' : '2022 월간 자료는 정리본에서 제외'], ['36개월 중 순위', `${rank}위`], ...es.map((e) => [`같은 시기 사건 (${e.period})`, e.title, '시기 일치일 뿐 인과 미확인'])], facts: [`${REGIONS[rg]} 기간 최고점은 ${peakOf(rg).month}입니다.`], company: rg !== 'KR' && d.month === '2025-08' ? ['한국경제 2025-08-03: K팝 데몬 헌터스와 라면 검색 관심 증가 보도, 불닭은 7월 20~27일 유튜브 검색이 최근 1년 최고(주간 유튜브 기준으로 제공된 월간 웹검색과 조건이 다름).'] : rg === 'KR' && d.month === '2025-02' ? ['실적 발표·소스 캠페인 시기를 검토했으나 네이버 해당 검색어 증가와 직접 연결하는 자료를 확인하지 못했습니다.'] : [], impl: ['원인을 확정하려면 일별 관심도·당시 관련 검색어·캠페인 유입 데이터가 필요합니다.'], limits: LIMIT_SEARCH, sources: [rg === 'KR' ? SRC.naver : SRC.google, ...(d.month === '2025-08' && rg !== 'KR' ? [SRC.hk] : [])] };
}
function detailPeaks() { return { title: '국내·해외 검색 최고점 시기', rows: Object.keys(REGIONS).map((rg) => [REGIONS[rg], peakOf(rg).month, REGION_DESC[rg]]), facts: ['Google 전 세계·미국은 2025-08, 네이버 국내는 2025-02가 각 지역의 최고점(100)입니다.'], interp: ['03 문서 6절 발표용 문구: 국내와 해외에서 관심 최고점의 시기가 달랐다. 해외에서는 같은 여름 K라면·불닭 검색 관심 증가 보도도 확인되지만, 특정 행사가 이 최고점을 만들었다는 인과는 입증되지 않았다.'], company: ['해외: 같은 여름 K라면·불닭 검색 관심 증가 보도가 있으나 플랫폼·기간 조건이 달라 원인으로 확정할 수 없습니다.'], limits: LIMIT_SEARCH, sources: [SRC.google, SRC.naver, SRC.hk] }; }
function peakTable(b) {
  b.append(h('div', { class: 'tw' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, '지역'), h('th', {}, '최고점'), h('th', {}, `${yr()} 최고 월`))), h('tbody', {}, Object.keys(REGIONS).map((rg) => { const ym = sOf(rg).filter((s) => s.y === yr()).reduce((a, c) => (c.v > a.v ? c : a)); return h('tr', { class: 'click' + (rg === S.region ? ' sel' : ''), onclick: () => { S.region = rg; render(); } }, h('td', {}, REGIONS[rg]), h('td', {}, peakOf(rg).month), h('td', {}, ym.month.slice(5) + '월')); })))));
  b.append(h('p', { class: 'note' }, '행을 누르면 해당 지역으로 전환됩니다. 플랫폼·검색어가 달라 지수 크기를 서로 비교하지 않습니다.'));
}
function smallMultiples(b) {
  Object.keys(REGIONS).forEach((rg) => {
    const s = sOf(rg); const el = h('div', { class: 'chart', style: 'min-height:70px' }); b.append(h('div', { style: 'font-size:11px;color:#6c675f;margin-top:4px' }, `${REGIONS[rg]} · 최고 ${peakOf(rg).month}`), el);
    lineChart(el, { labels: s.map((d) => d.month), height: 70, yMax: 100, fmt: () => '', every: 99, tickText: () => '', series: [{ values: s.map((d) => d.v), color: rg === 'KR' ? C.orange : rg === 'US' ? C.violet : C.blue, area: true, width: 1.6 }], peaks: [{ at: peakOf(rg).month, v: 100, text: '' }], band: [`${yr()}-01`, `${yr()}-12`],
      tip: (l, i) => [`${l} · ${REGIONS[rg]}`, `지수 ${fmt(s[i].v, rg === 'KR' ? 1 : 0)}`], onClick: (l, i) => openDetail(detailSearchMonth(rg, s[i])) });
  });
}
function searchHeat(b) { const el = h('div', { class: 'chart short' }); b.append(el); const rg = S.region; const pk = peakOf(rg); heatmap(el, { rows: YEARS, selRow: yr(), cells: sOf(rg).map((d) => ({ row: d.y, m: d.m, v: d.v, d, peak: d.month === pk.month })), tip: (c) => [`${c.d.month} · ${REGIONS[rg]}`, `지수 ${fmt(c.v, rg === 'KR' ? 1 : 0)}${c.peak ? ' · 기간 최고점' : ''}`, '클릭 → 월 상세'], onClick: (c) => openDetail(detailSearchMonth(rg, c.d)) }); }
function regionBars(b) {
  if (S.region === 'KR') { b.append(h('div', { class: 'nodata' }, '해당 없음 — 네이버 DataLab 자료에는 지역 구분이 없습니다. 전 세계 또는 미국을 선택하세요.')); return; }
  const el = h('div', { class: 'chart short' }); b.append(el);
  hbars(el, { data: BY_REGION[S.region].slice(0, 10).map((r, i) => ({ label: r.name, v: r.v, text: fmt(r.v, 0), color: i === 0 ? C.accent : C.darkSoft })), rowH: 22, max: 100, tip: (d) => [d.label, `상대 점수 ${d.text}`, '검색 건수 아님'] });
}
function queryTable(b) {
  if (S.region === 'KR') { b.append(h('div', { class: 'nodata' }, '해당 없음 — 국내(네이버) 관련 검색어 원자료는 패키지에 없습니다.')); return; }
  const q = QUERIES[S.region];
  b.append(h('div', { class: 'tw' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, '인기 검색어'), h('th', {}, '관심'), h('th', {}, '증가'))), h('tbody', {}, q.top.slice(0, 8).map((r) => h('tr', {}, h('td', {}, r.query), h('td', {}, r['search interest']), h('td', {}, r['increase percent'])))))));
}

// ---------- 경영성과 ----------
const invertPill = (html) => html.replace(/pill (up|down)/, (m0, a) => `pill ${a === 'up' ? 'down' : 'up'}`); // 부채비율은 감소가 개선
PAGE.performance = {
  kpis() {
    const y = yr(); const c = S.company;
    return [
      kpiCard('영업활동현금흐름', fmt(eokW(fin(y, 'operating_cashflow'))), '억원', `${coName(c)} 연결 현금흐름표`, pillHTML(growth(fin(y, 'operating_cashflow'), fin(y - 1, 'operating_cashflow')), '%') + ` ${y - 1} 대비`, () => openDetail(detailCash(y)), C.teal),
      kpiCard('유형자산 취득 후 차액', fmt(eokW(met(y, 'cash_after_ppe_KRW'))), '억원', '영업현금 − 유형자산 취득 (FCF 아님)', '<span class="pill na">차액</span>', () => openDetail(detailCash(y)), C.orange),
      kpiCard('부채비율', fmt(met(y, 'debt_equity_pct')), '%', '부채총계 ÷ 자본총계', invertPill(pillHTML(pp(met(y, 'debt_equity_pct'), met(y - 1, 'debt_equity_pct')), '%p')) + ` ${y - 1} 대비`, () => openDetail(detailStability(y)), C.dark),
      kpiCard('재고회전율', fmt(met(y, 'inventory_turnover'), 2), '회', '매출원가 ÷ 기초·기말 평균 재고', pillHTML(pp(met(y, 'inventory_turnover'), met(y - 1, 'inventory_turnover')), '회', 2, true) + ` ${y - 1} 대비`, () => openDetail(detailWC(y)), C.blue),
    ];
  },
  cards() {
    const c = S.company;
    return [
      { id: 'pf-trend', w: 3, title: () => (S.period === 'annual' ? '매출·영업이익 (억원)' : '분기 매출·영업이익 (억원)'), sub: () => (S.period === 'annual' ? `${coName(c)} 연결` : 'Q4 = 연간 − 9개월(결산조정 포함)'), body: (b) => trendChart(b), detail: () => detailRevenue(yr()) },
      { id: 'pf-cash', w: 3, title: '영업이익 · 영업현금흐름 · 법인세 납부 (억원)', sub: '이익이 현금으로 이어졌는지 비교', body: (b) => cashCompare(b), detail: () => detailCash(yr()) },
      { id: 'pf-capex', w: 2, title: '현금 창출 vs 설비투자 (억원)', sub: '숫자 = 차액 (무형자산 미포함)', body: (b) => capexChart(b), detail: () => detailCash(yr()) },
      { id: 'pf-ratio', w: 2, title: '수익성 구조 (%)', sub: '영업이익률·원가율·판관비율', body: (b) => ratioChart(b), detail: () => detailRatios(yr()) },
      { id: 'pf-stab', w: 2, title: '재무 안정성 (%)', sub: '부채비율·유동비율', body: (b) => stabChart(b), detail: () => detailStability(yr()) },
      { id: 'pf-table', w: 3, title: () => (S.period === 'annual' ? '연간 손익·현금 요약표 (억원)' : '분기 손익표 (억원)'), sub: '행 클릭 → 상세', body: (b) => perfTable(b), detail: () => detailRevenue(yr()) },
      c === 'SY'
        ? { id: 'pf-brand', w: 3, title: '참고: 불닭 브랜드 매출 보도값 (억원)', sub: '언론보도 근사값 · 회사 연결 실적과 별도 영역', body: (b) => brandChart(b), detail: () => detailBrand() }
        : { id: 'pf-brand', w: 3, title: '참고: 농심 브랜드 매출', sub: '01 지침: 제공되지 않은 항목은 ‘자료 없음’', body: (b) => b.append(h('div', { class: 'nodata' }, '자료 없음 — 농심 브랜드(신라면 등) 매출 보도값은 이번 전달본에 없습니다. 회사 연결 실적을 브랜드 실적으로 바꾸어 쓰지 않습니다.')) },
    ];
  },
};
function cashCompare(b, c = S.company) {
  const el = h('div', { class: 'chart' }); b.append(el, h('div', { class: 'legend', html: '<span><i style="background:#3b3936"></i>영업이익</span><span><i style="background:#24987a"></i>영업활동현금흐름</span><span><i style="background:#df6d36"></i>법인세 납부</span>' }));
  barChart(el, { data: YEARS.map((y) => ({ label: String(y), year: y, op: eokW(fin(y, 'operating_profit', c)), ocf: eokW(fin(y, 'operating_cashflow', c)), tax: eokW(fin(y, 'tax_paid_outflow', c)) })), series: [{ key: 'op', color: C.dark }, { key: 'ocf', color: C.teal }, { key: 'tax', color: C.orange }], colorOf: (s, d) => (d.year === S.year ? s.color : d3.interpolateRgb(s.color, '#fff')(0.6)), isSel: isSelY, fmt: (v) => fmt(v, 0), labels: (v) => fmt(v, 0), maxBar: 26,
    tip: (d) => [`${d.year}년 · ${coName(c)}`, `영업이익 ${eok(d.op)}`, `영업활동현금흐름 ${eok(d.ocf)}`, `법인세 납부 ${eok(d.tax)}`, '클릭 → 상세'], onClick: (d) => openDetail(detailCash(d.year, c)) });
}
function detailCash(y, c = S.company) {
  const g = (m) => growth(fin(y, m, c), fin(y - 1, m, c));
  return { title: `${coName(c)} ${y} 이익과 현금흐름`, sub: '유형자산 취득 후 차액은 잉여현금흐름(FCF)이 아님',
    rows: [['영업이익', eok(eokW(fin(y, 'operating_profit', c))), `전년 대비 ${pct(g('operating_profit'))}`], ['영업활동현금흐름', eok(eokW(fin(y, 'operating_cashflow', c))), `전년 대비 ${pct(g('operating_cashflow'))}`], ['법인세 납부', eok(eokW(fin(y, 'tax_paid_outflow', c))), `${y - 1}: ${eok(eokW(fin(y - 1, 'tax_paid_outflow', c)))}`], ['유형자산 취득', eok(eokW(fin(y, 'ppe_purchase_outflow', c)))], ['차액', eok(eokW(met(y, 'cash_after_ppe_KRW', c)))], ['재고자산 증가율', pct(met(y, 'inventory_growth_pct', c))]],
    formula: ['차액 = 영업활동현금흐름 − 유형자산 취득 현금지출 (무형자산 등 미포함)', '비용·현금유출은 CSV에 양수로 저장'],
    company: c === 'SY' && y === 2025 ? [DOC.cash1, DOC.cash2] : [], facts: c === 'SY' && y === 2024 ? ['02 문서: 2024 영업현금흐름 3,579.0억원으로 유형자산 취득 지출 2,284.5억원보다 많았다.'] : [], impl: c === 'SY' ? [DOC.watch] : [], nodoc: c === 'NS' ? NODOC_NS : null,
    limits: [DOC.gap, '각 요인의 기여액은 분리 측정되지 않았습니다.', ...(c === 'SY' && y === 2023 ? [DOC.ocf2023] : []), ...(c === 'NS' ? ['농심 CSV 주석: 영업현금흐름 분류 정책은 회사별 차이가 있습니다(두 회사 직접 비교 시 유의).', LIMIT_NSNEW] : [])],
    sources: finSources(c, y, ['operating_cashflow', 'ppe_purchase_outflow', 'tax_paid_outflow'], 'cf'), audit: finAudit(c, [y, y - 1], ['operating_profit', 'operating_cashflow', 'ppe_purchase_outflow', 'tax_paid_outflow']) };
}
function capexChart(b, c = S.company) {
  const el = h('div', { class: 'chart short' }); b.append(el, h('div', { class: 'legend', html: '<span><i style="background:#24987a"></i>영업현금흐름</span><span><i style="background:#df6d36"></i>유형자산 취득</span>' }));
  barChart(el, { height: 180, data: YEARS.map((y) => ({ label: String(y), year: y, ocf: eokW(fin(y, 'operating_cashflow', c)), capex: eokW(fin(y, 'ppe_purchase_outflow', c)), gap: eokW(met(y, 'cash_after_ppe_KRW', c)) })), series: [{ key: 'ocf', color: C.teal }, { key: 'capex', color: C.orange }], colorOf: (s, d) => (d.year === S.year ? s.color : d3.interpolateRgb(s.color, '#fff')(0.6)), isSel: isSelY, fmt: (v) => fmt(v, 0), labels: (v, d, s) => (s.key === 'capex' ? `차액 ${fmt(d.gap, 0)}` : ''), maxBar: 24,
    tip: (d) => [`${d.year}년 · ${coName(c)}`, `영업현금흐름 ${eok(d.ocf)}`, `유형자산 취득 ${eok(d.capex)}`, `차액 ${eok(d.gap)}`], onClick: (d) => openDetail(detailCash(d.year, c)) });
}
function stabChart(b, c = S.company) {
  const el = h('div', { class: 'chart short' }); b.append(el, h('div', { class: 'legend', html: '<span><i class="line" style="background:#d4262c"></i>부채비율</span><span><i class="line" style="background:#3d6fb6"></i>유동비율</span>' }));
  const mx = d3.max(YEARS.flatMap((y) => [met(y, 'debt_equity_pct', c), met(y, 'current_ratio_pct', c)]));
  lineChart(el, { labels: YEARS.map(String), height: 180, yMax: Math.max(180, Math.ceil(mx / 20) * 20 + 20), fmt: (v) => v + '%', right: 44, isSelLabel: (l) => +l === S.year, series: [{ values: YEARS.map((y) => met(y, 'debt_equity_pct', c)), color: C.accent, dots: () => true, endLabel: (v) => pct(v) }, { values: YEARS.map((y) => met(y, 'current_ratio_pct', c)), color: C.blue, dots: () => true, endLabel: (v) => pct(v) }],
    tip: (l) => [`${l}년 · ${coName(c)}`, `부채비율 ${pct(met(+l, 'debt_equity_pct', c))}`, `유동비율 ${pct(met(+l, 'current_ratio_pct', c))}`], onClick: (l) => openDetail(detailStability(+l, c)) });
}
function detailStability(y, c = S.company) {
  const ta = fin(y, 'total_assets', c), tl = fin(y, 'total_liabilities', c), eq = fin(y, 'equity', c);
  return { title: `${coName(c)} ${y} 재무 안정성`, rows: [['부채비율', pct(met(y, 'debt_equity_pct', c)), `${y - 1} 대비 ${signed(pp(met(y, 'debt_equity_pct', c), met(y - 1, 'debt_equity_pct', c)), '%p')}`], ['유동비율', pct(met(y, 'current_ratio_pct', c)), `${y - 1} 대비 ${signed(pp(met(y, 'current_ratio_pct', c), met(y - 1, 'current_ratio_pct', c)), '%p')}`], ['부채총계', eok(eokW(tl))], ['자본총계', eok(eokW(eq))], ['자산총계', eok(eokW(ta)), ta === tl + eq ? '자산 = 부채 + 자본 ✓ (원 단위 일치)' : '불일치'], ['유동자산 / 유동부채', `${eok(eokW(fin(y, 'current_assets', c)))} / ${eok(eokW(fin(y, 'current_liabilities', c)))}`]],
    formula: ['부채비율 = 부채총계 ÷ 자본총계 × 100', '유동비율 = 유동자산 ÷ 유동부채 × 100', '비율 변화는 %p'],
    facts: c === 'SY' ? [`부채비율 ${YEARS.map((yy) => pct(met(yy, 'debt_equity_pct', c))).join(' → ')}, 유동비율 ${YEARS.map((yy) => pct(met(yy, 'current_ratio_pct', c))).join(' → ')} (2023→2025, CSV 계산).`] : [], impl: c === 'SY' ? [DOC.watch] : [], nodoc: c === 'NS' ? NODOC_NS : null,
    limits: ['임계치나 우수·위험 등급을 매기지 않습니다 (01 지침 4절).', LIMIT_CONSOL_OF(c), ...(c === 'NS' ? [LIMIT_NSNEW] : [])], sources: finSources(c, y, ['total_assets', 'total_liabilities', 'equity', 'current_assets', 'current_liabilities'], 'bs'), audit: finAudit(c, [y], ['total_assets', 'total_liabilities', 'equity', 'current_assets', 'current_liabilities']) };
}
function detailWC(y, c = S.company) {
  return { title: `${coName(c)} ${y} 운전자본`, rows: [['재고자산', eok(eokW(fin(y, 'inventory', c))), `증가율 ${pct(met(y, 'inventory_growth_pct', c))}`], ['매출채권', eok(eokW(fin(y, 'receivables', c))), `${y - 1}: ${eok(eokW(fin(y - 1, 'receivables', c)))}`], ['재고회전율', `${fmt(met(y, 'inventory_turnover', c), 2)}회`, `${y - 1}: ${fmt(met(y - 1, 'inventory_turnover', c), 2)}회`], ['매출채권회전율', `${fmt(met(y, 'receivables_turnover', c), 2)}회`, `${y - 1}: ${fmt(met(y - 1, 'receivables_turnover', c), 2)}회`]],
    formula: ['재고회전율 = 매출원가 ÷ 기초·기말 평균 재고 (2023은 2022 기말 재고 사용)', '매출채권회전율 = 매출액 ÷ 기초·기말 평균 매출채권 (외상매출 대신 전체 매출 사용)'],
    impl: c === 'SY' ? [DOC.watch] : [], nodoc: c === 'NS' ? NODOC_NS : null, limits: ['단순 회전율 변화만으로 부실을 판정하지 않습니다.', ...(c === 'NS' ? [LIMIT_NSNEW] : [])],
    sources: finSources(c, y, ['inventory', 'receivables', 'cost_of_sales', 'revenue'], 'bs'), audit: finAudit(c, [y, y - 1], ['inventory', 'receivables', 'cost_of_sales', 'revenue']) };
}
function perfTable(b, c = S.company) {
  if (S.period === 'quarter') {
    const Q = Qc(c);
    b.append(h('div', { class: 'tw' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, '분기'), h('th', {}, '매출'), h('th', {}, '영업이익'), h('th', {}, '이익률'))), h('tbody', {}, Q.map((q) => h('tr', { class: 'click' + (q.year === S.year ? ' sel' : ''), onclick: () => openDetail(detailQuarter(q)) }, h('td', {}, q.period), h('td', {}, fmt(eokW(q.revenue))), h('td', {}, fmt(eokW(q.op))), h('td', {}, pct(q.margin))))))));
    const keys = [['revenue', 'revenue'], ['cost', 'cost_of_sales'], ['sga', 'sga'], ['op', 'operating_profit']];
    const sums = YEARS.map((y) => [y, keys.every(([k, m]) => d3.sum(Q.filter((q) => q.year === y), (q) => q[k]) === fin(y, m, c))]);
    b.append(h('p', { class: 'note' }, '4개 분기 합 = 연간 확정 (매출·원가·판관비·영업이익): ' + sums.map(([y, ok]) => `${y} ${ok ? '✓' : '불일치'}`).join(' · ')));
    return;
  }
  const rows = [['매출액', 'revenue'], ['매출원가', 'cost_of_sales'], ['판관비', 'sga'], ['영업이익', 'operating_profit'], ['영업활동현금흐름', 'operating_cashflow'], ['유형자산 취득', 'ppe_purchase_outflow'], ['법인세 납부', 'tax_paid_outflow'], ['재고자산', 'inventory']];
  b.append(h('div', { class: 'tw' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, '항목'), ...YEARS.map((y) => h('th', { class: y === S.year ? 'sel' : '' }, String(y))))), h('tbody', {}, rows.map(([l, m]) => h('tr', { class: 'click', onclick: () => openDetail(m === 'operating_cashflow' || m === 'tax_paid_outflow' || m === 'ppe_purchase_outflow' ? detailCash(S.year, c) : m === 'inventory' ? detailWC(S.year, c) : m === 'operating_profit' ? detailOP(S.year, c) : detailRevenue(S.year, c)) }, h('td', {}, l), ...YEARS.map((y) => h('td', {}, fmt(eokW(fin(y, m, c))))))), h('tr', {}, h('td', {}, '영업이익률'), ...YEARS.map((y) => h('td', {}, pct(met(y, 'operating_margin_pct', c)))))))));
}
function brandChart(b) {
  const el = h('div', { class: 'chart short' }); b.append(el);
  barChart(el, { height: 170, data: BRAND.map((r) => ({ label: String(r.year), year: r.year, v: r.rev })), series: [{ key: 'v', color: C.accent }], colorOf: (s, d) => (d.year === S.year ? C.accent : C.accentSoft), isSel: isSelY, fmt: (v) => fmt(v, 0), labels: (v) => `약 ${fmt(v, 0)}`, maxBar: 40,
    tip: (d) => [`${d.year} 불닭 브랜드 (보도값)`, `약 ${fmt(d.v, 0)}억원`, '언론보도 근사값 · 감사 재무값 아님'], onClick: () => openDetail(detailBrand()) });
  b.append(h('p', { class: 'note warn' }, h('span', { class: 'badge' }, '언론보도 기준·근사값'), ' 감사받은 회사 연결매출이 아닙니다. 연도별 집계 범위가 같은지 확인되지 않아 성장률을 확정 비교값으로 쓰지 않고, 연결매출 대비 비중·브랜드 이익률을 계산하지 않습니다. 브랜드 영업이익: 데이터 없음.'));
}
function detailBrand() {
  const aids = R.audit_ledger.filter((a) => a.dataset === 'brand_sales.csv').map((a) => a.audit_id);
  return { title: '불닭 브랜드 매출 보도값', badge: '언론보도 기준·근사값', sub: '회사 연결 실적(종합 현황)과 다른 자료', rows: BRAND.map((r) => [String(r.year), `약 ${fmt(r.rev, 0)}억원`, r.scope]).concat([['불닭 브랜드 영업이익', '데이터 없음', '공개자료 미확인 — 회사 전체·면스낵 이익으로 대체하지 않음']]),
    limits: ['감사 재무제표의 독립 브랜드 계정이 아닙니다 (검증 상태: ‘보도값 일치; 감사 공시 아님’).', '상품군 포함 범위·연결/별도 산정 정의가 공개되지 않아 연도별 집계 범위가 같은지 확인되지 않았습니다. 성장률을 확정 비교값으로 쓰지 않습니다.', '회사 연결매출 대비 비중·브랜드 이익률을 계산하지 않습니다.', '2024 기사 부제의 1조500억원은 수출액이며 브랜드 매출 1조2,100억원과 다릅니다.'],
    sources: BRAND.map((r) => srcFrom(r.source)).concat([{ label: '3개년 보도 교차확인', url: BRAND[0].cross }]), audit: aids };
}

// ---------- 생산 ----------
PAGE.production = {
  kpis() {
    if (S.company === 'NS') return nsProdKpis();
    const y = yr(); const pr = (n) => PROD.find((p) => p.plant === n && p.year === y); const tot = (yy, k) => d3.sum(PROD.filter((p) => p.year === yy && p[k] !== null), (p) => p[k]);
    const same = (k) => { const both = PLANTS.filter((n) => PROD.find((p) => p.plant === n && p.year === y && p[k] !== null) && PROD.find((p) => p.plant === n && p.year === y - 1 && p[k] !== null)); const sm = (yy) => d3.sum(both, (n) => PROD.find((p) => p.plant === n && p.year === yy)[k]); return y > 2023 ? growth(sm(y), sm(y - 1)) : null; };
    const nRows = PROD.filter((p) => p.year === y && p.cap !== null).length;
    const mi = pr('밀양 면류'), mp = PROD.find((p) => p.plant === '밀양 면류' && p.year === y - 1);
    return [
      kpiCard('생산능력 합계', fmt(eokM(tot(y, 'cap')), 0), '억원', `금액 기준 · ${nRows}개 공장·품목 행 합`, pillHTML(same('cap'), '%') + (y > 2023 ? ' 동일 행 기준' : ''), () => openDetail(detailPlantsTotal(y)), C.dark),
      kpiCard('생산실적 합계', fmt(eokM(tot(y, 'prod')), 0), '억원', `금액 기준 · ${nRows}개 행 합`, pillHTML(same('prod'), '%') + (y > 2023 ? ' 동일 행 기준' : ''), () => openDetail(detailPlantsTotal(y)), C.blue),
      kpiCard('밀양 면류 가동률', fmt(mi?.util ?? null, 1), '%', '공시 시간 기준', pillHTML(mp ? mi.util - mp.util : null, '%p', 1, true) + (y === 2025 ? ' · 산정기준 변경' : ''), () => openDetail(detailPlant('밀양 면류')), C.accent),
      kpiCard('익산 면류 가동률', fmt(pr('익산 면류')?.util ?? null, 1), '%', '공시 시간 기준', pillHTML(y > 2023 ? pr('익산 면류').util - PROD.find((p) => p.plant === '익산 면류' && p.year === y - 1).util : null, '%p', 1, true), () => openDetail(detailPlant('익산 면류')), C.teal),
    ];
  },
  cards() {
    if (S.company === 'NS') return nsProdCards();
    return [
      { id: 'pd-bubble', w: 3, title: () => `${yr()} 생산능력과 가동률`, sub: '가로 = 생산능력(억원, 로그) · 세로 = 가동률 · 원 크기 = 생산실적', body: (b) => { const el = h('div', { class: 'chart' }); b.append(el); const miss = PROD.filter((p) => p.year === yr() && p.cap === null); bubbles(el, { data: PROD.filter((p) => p.year === yr() && p.cap !== null && p.util !== null).map((p) => ({ ...p, sel: p.plant === S.hlPlant })), tip: (d) => [`${d.plant} · ${d.year}`, `가동률 ${pct(d.util, 2)}`, `생산능력 ${eok(eokM(d.cap))}`, `생산실적 ${eok(eokM(d.prod))}`, '클릭 → 공장 상세'], onClick: (d) => openDetail(detailPlant(d.plant)) }); if (miss.length) b.append(h('p', { class: 'note' }, `⊘ ${miss.map((m) => m.plant).join(', ')}: ${yr()}년 데이터 없음 (당시 공시에 별도 행 없음, 0으로 표시하지 않음)`)); }, detail: () => detailPlant('밀양 면류') },
      { id: 'pd-util', w: 3, title: '공시 시간가동률 2023~2025 (%)', sub: '굵은 막대 = 선택 연도 · 2025 산정기준 변경', body: (b) => utilChart(b), detail: () => detailPlant('밀양 면류') },
      { id: 'pd-cap', w: 6, title: () => `${yr()} 공장·품목별 생산능력 vs 생산실적 (억원)`, sub: '금액 기준 · 봉지 수 아님', body: (b) => capTable(b), detail: () => detailPlantsTotal(yr()) },
    ];
  },
};
function utilChart(b) {
  const el = h('div', { class: 'chart' }); const yc = { 2023: '#cfcac1', 2024: '#8f8a82', 2025: '#d4262c' };
  b.append(el, h('div', { class: 'legend', html: YEARS.map((y) => `<span><i style="background:${yc[y]}"></i>${y}</span>`).join('') }));
  barChart(el, { data: PLANTS.map((p) => { const o = { label: p.replace('조미소스소재', '소스'), plant: p }; YEARS.forEach((y) => { o['y' + y] = PROD.find((r) => r.plant === p && r.year === y)?.util ?? null; }); return o; }), series: YEARS.map((y) => ({ key: 'y' + y, color: yc[y] })), colorOf: (s, d) => (s.key === 'y' + S.year ? (S.year === 2025 ? yc[2025] : '#3b3936') : s.key === 'y2025' ? '#efb9b7' : '#e2ded6'), maxBar: 12, pad: 0.18, fmt: (v) => v + '%', nullLabel: '',
    tip: (d) => [d.plant, ...YEARS.map((y) => `${y}: ${d['y' + y] === null ? '데이터 없음' : pct(d['y' + y], 2)}`), '클릭 → 공장 상세'], onClick: (d) => openDetail(detailPlant(d.plant)) });
}
function capTable(b) {
  b.append(h('div', { class: 'tw' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, '공장·품목'), h('th', {}, '생산능력'), h('th', {}, '생산실적'), h('th', {}, '공시 가동률'), h('th', {}, '전년 가동률'))), h('tbody', {}, PLANTS.map((p) => { const c = PROD.find((r) => r.plant === p && r.year === S.year); const pv = PROD.find((r) => r.plant === p && r.year === S.year - 1); return h('tr', { class: 'click' + (p === S.hlPlant ? ' sel' : ''), onclick: () => openDetail(detailPlant(p)) }, h('td', {}, p), h('td', { class: c?.cap === null ? 'nd' : '' }, c?.cap === null ? '데이터 없음' : fmt(eokM(c.cap))), h('td', { class: c?.prod === null ? 'nd' : '' }, c?.prod === null ? '데이터 없음' : fmt(eokM(c.prod))), h('td', { class: c?.util === null ? 'nd' : '' }, pct(c?.util ?? null, 2)), h('td', { class: !pv || pv.util === null ? 'nd' : '' }, pv ? pct(pv.util, 2) : '—')); })))));
  if (S.year === 2025) b.append(h('p', { class: 'note warn' }, '2025: 하반기 밀양2공장 가동 · 밀양 면류 생산능력·실적 산정기준 변경 · 공장 가동가능시간 산정기준 변경. 전년과 단순 비교하지 않습니다.'));
}
function detailPlant(p) {
  const rows = YEARS.map((y) => { const r = PROD.find((x) => x.plant === p && x.year === y); return [String(y), r?.cap === null ? '데이터 없음' : `가동률 ${pct(r.util, 2)}`, r?.cap === null ? r.note : `생산능력 ${eok(eokM(r.cap))} · 생산실적 ${eok(eokM(r.prod))}`]; });
  return { title: `${p} 생산 현황`, sub: '금액 기준 생산능력·실적 · 시간 기준 공시 가동률', rows, formula: ['억원 = 백만원 ÷ 100', '가동률은 공시값 그대로 (금액으로 재계산하지 않음)'], facts: p === '밀양 면류' ? ['밀양 면류 생산능력: 2024 2,916.8억원 → 2025 6,058.7억원 (금액 기준).', '사업보고서: 제65기(2025) 하반기부터 밀양2공장 가동, 밀양공장(면류) 생산능력·생산실적 산정기준 변경, 공장별 가동가능시간 산정 기준 변경.'] : [], interp: p === '밀양 면류' ? ['03 문서 3절: 2025 밀양2공장 가동과 산정기준 변경으로 단순한 하락을 수요 부진으로 해석하면 안 된다. 공시만으로 하락 원인을 확정할 수 없다.'] : [], impl: ['증설된 능력이 실제 생산·판매로 채워지는지 이후 연도 가동률로 확인합니다.'], limits: LIMIT_PROD, sources: [SRC.prod, SRC.ar2024, SRC.sr2023] };
}
function detailPlantsTotal(y) { const t = (yy, k) => d3.sum(PROD.filter((p) => p.year === yy && p[k] !== null), (p) => p[k]); return { title: `${y} 생산능력·실적 합계`, rows: [['생산능력 합계', eok(eokM(t(y, 'cap')))], ['생산실적 합계', eok(eokM(t(y, 'prod')))], ...(y > 2023 ? [['전년 대비 (전체 합계 기준)', pct(growth(t(y, 'cap'), t(y - 1, 'cap'))), y === 2025 ? '2025는 밀양 조미소스소재 행이 새로 포함되어 카드의 동일 행 기준 증가율과 다름' : '']] : [])], formula: ['합계 = 데이터가 있는 공장·품목 행의 합 (공장 합계 행과 중복 합산하지 않음)'], facts: [`사업보고서 원문 생산능력 합계(2023 1,053,712 · 2024 1,113,075 · 2025 1,589,964백만원)와 행 합계 ${fmt(t(y, 'cap'), 0)}백만원: ${t(y, 'cap') === { 2023: 1053712, 2024: 1113075, 2025: 1589964 }[y] ? '일치 ✓' : '불일치'}`], limits: [...LIMIT_PROD, '2023~2024는 밀양 조미소스소재 행이 없어 6개가 아닌 5개 행의 합입니다.', '금액 증가를 물량 증가율로 단정하지 않습니다.'], sources: [SRC.prod] }; }

// ---------- 농심 생산 (nongshim_utilization.csv) ----------
const NS_UTIL_LIMIT = ['농심은 국내 ‘제품유형 집계’와 해외 ‘사업소 집계’로 공시합니다. 삼양의 공장·품목별 표와 집계 단위가 달라 직접 순위화하지 않습니다 (01 지침 2절).', '가동률은 공시 표기값을 그대로 쓰고, 시간으로 다시 계산한 값은 참고로만 표시합니다.', '농심 2024 상해농심은 원문 내부 산식 불일치(공시 45.1% vs 시간 재계산 약 46.2%)로 비교·판정에서 제외합니다.'];
function nsProdKpis() {
  const y = yr(); const u = (e, yy = y) => NSUTIL.find((r) => r.entity === e && r.year === yy);
  const k = (e, col) => { const c = u(e), p = u(e, y - 1); return kpiCard(`${e} 가동률`, fmt(c?.util ?? null, 1), '%', '국내 제품유형 집계 · 공시값', pillHTML(p ? pp(c.util, p.util) : null, '%p', 1, true) + (p ? ` ${y - 1} 대비` : ' 2022 자료 없음'), () => openDetail(detailNsUtil(e)), col); };
  const bad = NSUTIL.filter((r) => r.bad);
  return [k('라면', C.blue), k('스낵', C.orange), kpiCard('해외 사업소', String(NSUTIL.filter((r) => r.year === y && r.scope.startsWith('해외')).length), '곳', '해외 사업소 집계 행 수', '<span class="pill na">사업소별 표 참고</span>', () => openDetail(detailNsUtil('청도농심')), C.dark), kpiCard('확인 필요 행', String(bad.length), '건', bad.map((r) => `${r.year} ${r.entity}`).join(', '), '<span class="pill na">비교·판정 제외</span>', () => openDetail(detailNsUtil(bad[0].entity)), '#9a6a00')];
}
function nsProdCards() {
  return [
    { id: 'pd-ns-dom', w: 3, title: '농심 국내 제품유형별 가동률 (%)', sub: '공시 시간가동률 · 굵은 막대 = 선택 연도', body: (b) => nsUtilChart(b, '국내'), detail: () => detailNsUtil('라면') },
    { id: 'pd-ns-ovs', w: 3, title: '농심 해외 사업소 가동률 (%)', sub: '⚠ = 원문 내부 산식 불일치(비교 제외)', body: (b) => nsUtilChart(b, '해외'), detail: () => detailNsUtil('상해농심') },
    { id: 'pd-ns-tbl', w: 6, title: () => `농심 ${yr()} 가동가능·실가동 시간과 공시 가동률`, sub: '공시값 그대로 · 시간 재계산은 참고', body: (b) => nsUtilTable(b), detail: () => detailNsUtil('상해농심') },
  ];
}
function nsUtilChart(b, scope) {
  const el = h('div', { class: 'chart' }); const yc = { 2023: '#cfcac1', 2024: '#8f8a82', 2025: '#3d6fb6' };
  b.append(el, h('div', { class: 'legend', html: YEARS.map((y) => `<span><i style="background:${yc[y]}"></i>${y}</span>`).join('') }));
  const ents = [...new Set(NSUTIL.filter((r) => r.scope.startsWith(scope)).map((r) => r.entity))];
  barChart(el, { data: ents.map((e) => { const o = { label: e.replace('농심', ''), entity: e }; YEARS.forEach((y) => { const r = NSUTIL.find((x) => x.entity === e && x.year === y); o['y' + y] = r?.util ?? null; o['b' + y] = !!r?.bad; }); return o; }), series: YEARS.map((y) => ({ key: 'y' + y, color: yc[y] })), colorOf: (s, d) => (d['b' + s.key.slice(1)] ? '#f0dfb0' : s.key === 'y' + S.year ? '#3d6fb6' : '#e2ded6'), maxBar: 12, pad: 0.18, fmt: (v) => v + '%', nullLabel: '',
    labels: (v, d, s) => (d['b' + s.key.slice(1)] ? '⚠' : ''), tip: (d) => [d.entity, ...YEARS.map((y) => `${y}: ${d['y' + y] === null ? '행 없음' : pct(d['y' + y])}${d['b' + y] ? ' ⚠ 원문 내부 산식 불일치' : ''}`), '클릭 → 상세'], onClick: (d) => openDetail(detailNsUtil(d.entity)) });
}
function nsUtilTable(b) {
  const rows = NSUTIL.filter((r) => r.year === S.year);
  b.append(h('div', { class: 'tw' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, '집계'), h('th', { class: 'l' }, '대상'), h('th', {}, '가동가능 시간'), h('th', {}, '실가동 시간'), h('th', {}, '공시 가동률'), h('th', {}, '시간 재계산(참고)'), h('th', { class: 'l' }, '상태'))),
    h('tbody', {}, rows.map((r) => h('tr', { class: 'click' + (r.bad ? ' warnrow' : ''), onclick: () => openDetail(detailNsUtil(r.entity)) }, h('td', {}, r.scope), h('td', { class: 'l' }, r.entity), h('td', {}, fmt(r.avail, 0)), h('td', {}, fmt(r.actual, 0)), h('td', {}, pct(r.util)), h('td', {}, pct(r.recalc, 2)), h('td', { class: 'l' }, r.bad ? h('span', { class: 'badge' }, '확인 필요 · 비교 제외') : '원문 대조·산식 일치')))))));
  b.append(h('p', { class: 'note' }, NS_UTIL_LIMIT[0]));
}
function detailNsUtil(e) {
  const rs = NSUTIL.filter((r) => r.entity === e);
  return { title: `농심 ${e} 가동률`, sub: `${rs[0]?.scope || ''} · nongshim_utilization.csv`, badge: rs.some((r) => r.bad) ? '확인 필요' : null,
    rows: rs.map((r) => [String(r.year), `공시 ${pct(r.util)}`, `가동가능 ${fmt(r.avail, 0)}시간 · 실가동 ${fmt(r.actual, 0)}시간 · 재계산 ${pct(r.recalc, 2)} · ${r.status} · 원문 위치 ${r.loc}`]),
    formula: ['시간 재계산 = 실가동 시간 ÷ 가동가능 시간 × 100 (참고용, 공시값을 대체하지 않음)'], nodoc: NODOC_NS,
    limits: [...NS_UTIL_LIMIT, ...(rs.some((r) => r.bad) ? ['원문 표기값과 재계산값을 모두 보존했으며 어느 값이 잘못됐는지는 확인하지 못했습니다 (02_검증결과와_한계).'] : [])], sources: [...new Set(rs.map((r) => r.source))].map(regSrc).concat([SRC.verify02]) };
}

// ---------- 기업 비교 ----------
const CMP_METRICS = [
  { k: 'revenue', l: '매출액', kind: 'won' }, { k: 'operating_profit', l: '영업이익', kind: 'won' }, { k: 'operating_margin_pct', l: '영업이익률', kind: 'pct' }, { k: 'cost_ratio_pct', l: '매출원가율', kind: 'pct' }, { k: 'sga_ratio_pct', l: '판관비율', kind: 'pct' },
  { k: 'debt_equity_pct', l: '부채비율', kind: 'pct' }, { k: 'current_ratio_pct', l: '유동비율', kind: 'pct' }, { k: 'operating_cashflow', l: '영업활동현금흐름', kind: 'won' }, { k: 'ppe_purchase_outflow', l: '유형자산 취득', kind: 'won' },
];
const cmpVal = (m, y, c) => (m.kind === 'won' ? eokW(fin(y, m.k, c)) : met(y, m.k, c));
const cmpTxt = (m, v) => (m.kind === 'won' ? eok(v) : pct(v));
const cmpDelta = (m, y, c) => { const a = cmpVal(m, y, c), b = cmpVal(m, y - 1, c); return m.kind === 'won' ? signed(growth(a, b), '%') : signed(pp(a, b), '%p'); };
const CMP_LIMITS = ['두 회사의 사업 구성(삼양: 면스낵 수출 중심 / 농심: 라면·스낵·기타, 국내 비중 큼)과 회계 분류가 달라 같은 지표라도 의미가 다를 수 있습니다 (01 지침 2절).', '농심 CSV 주석: 영업현금흐름 분류 정책은 회사별 차이가 있습니다.', '면스낵 수출 비중·브랜드·제품별 순위·가동률은 집계 범위가 달라 비교하지 않습니다.', LIMIT_NSNEW, '수치 차이를 우열 등급으로 바꾸지 않습니다.'];
PAGE.compare = {
  kpis() {
    const y = yr();
    const card = (m) => h('button', { class: 'kpi kpi2', onclick: () => openDetail(detailCmp(m, y)) }, h('span', { class: 'kpi-l' }, `${y} ${m.l}`),
      ...['SY', 'NS'].map((c) => h('span', { class: 'kpi2-row' }, h('i', { style: `background:${COMPANIES[c].color}` }), h('em', {}, COMPANIES[c].short), h('b', {}, m.kind === 'won' ? fmt(cmpVal(m, y, c), 0) : fmt(cmpVal(m, y, c))), h('small', {}, m.kind === 'won' ? '억원' : '%'), h('span', { class: 'dl' }, cmpDelta(m, y, c)))),
      h('span', { class: 'kpi-s' }, m.kind === 'won' ? '연결 · 오른쪽 = 전년 대비 %' : '연결 · 오른쪽 = 전년 대비 %p · 등급 판정 없음'));
    return [CMP_METRICS[0], CMP_METRICS[1], CMP_METRICS[2], CMP_METRICS[5]].map(card);
  },
  cards() {
    return [
      { id: 'cp-table', w: 6, title: () => `${yr()} 연결 재무 비교표`, sub: '행 클릭 → 두 회사 값·산식·출처·검증 기록 · 괄호 = 전년 대비 (금액 %, 비율 %p)', body: (b) => cmpTable(b), detail: () => detailCmp(CMP_METRICS[0], yr()) },
      { id: 'cp-rev', w: 3, title: () => (S.period === 'annual' ? '매출액 (억원)' : '분기 매출액 (억원)'), sub: () => (S.period === 'annual' ? '연결 · 선택 연도 진하게' : '단일 3개월 · Q4 = 연간 − 9개월'), body: (b) => cmpRevChart(b), detail: () => detailCmp(CMP_METRICS[0], yr()) },
      { id: 'cp-margin', w: 3, title: () => (S.period === 'annual' ? '영업이익률 (%)' : '분기 영업이익률 (%)'), sub: '영업이익 ÷ 매출액 × 100', body: (b) => cmpMarginChart(b), detail: () => detailCmp(CMP_METRICS[2], yr()) },
      { id: 'cp-ocf', w: 3, title: '영업활동현금흐름 · 유형자산 취득 (억원)', sub: '두 회사 · 연도별', body: (b) => cmpCashChart(b), detail: () => detailCmp(CMP_METRICS[7], yr()) },
      { id: 'cp-stab', w: 3, title: '부채비율 · 유동비율 (%)', sub: '실선 = 삼양 · 점선 = 농심', body: (b) => cmpStabChart(b), detail: () => detailCmp(CMP_METRICS[5], yr()) },
      { id: 'cp-q', w: 3, title: '분기 검증: 4개 분기 합 = 연간', sub: '두 회사 각 12분기 · 매출·원가·판관비·영업이익', body: (b) => cmpQuarterCheck(b), detail: () => detailCmpQuarter() },
      { id: 'cp-note', w: 3, title: '비교할 때 주의할 점', sub: '01 지침 2절 · 02 검증결과', body: (b) => b.append(h('ul', { class: 'plain' }, CMP_LIMITS.map((t) => h('li', {}, t)))) },
    ];
  },
};
function cmpTable(b) {
  const y = yr();
  b.append(h('div', { class: 'tw' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, '지표'), h('th', {}, '삼양식품'), h('th', {}, '농심'), h('th', { class: 'l' }, '산식·단위'))),
    h('tbody', {}, CMP_METRICS.map((m) => h('tr', { class: 'click', onclick: () => openDetail(detailCmp(m, y)) }, h('td', {}, m.l), ...['SY', 'NS'].map((c) => h('td', {}, cmpTxt(m, cmpVal(m, y, c)), h('small', { class: 'dl' }, ` (${cmpDelta(m, y, c)})`))), h('td', { class: 'l small' }, CMP_FORMULA[m.k])))),
    h('tbody', {}, h('tr', {}, h('td', {}, '면스낵 수출 비중'), h('td', {}, pct(exportShare(y))), h('td', { class: 'nd' }, '비교 불가'), h('td', { class: 'l small' }, metRow(y, 'NS')?.export_share_status || ''))))));
}
const CMP_FORMULA = { revenue: '원 ÷ 1억 = 억원', operating_profit: '매출 − 원가 − 판관비', operating_margin_pct: '영업이익 ÷ 매출 × 100', cost_ratio_pct: '매출원가 ÷ 매출 × 100', sga_ratio_pct: '판관비 ÷ 매출 × 100', debt_equity_pct: '부채총계 ÷ 자본총계 × 100', current_ratio_pct: '유동자산 ÷ 유동부채 × 100', operating_cashflow: '연결 현금흐름표', ppe_purchase_outflow: '현금유출, 양수 저장' };
const CMP_INPUTS = { revenue: ['revenue'], operating_profit: ['operating_profit'], operating_margin_pct: ['operating_profit', 'revenue'], cost_ratio_pct: ['cost_of_sales', 'revenue'], sga_ratio_pct: ['sga', 'revenue'], debt_equity_pct: ['total_liabilities', 'equity'], current_ratio_pct: ['current_assets', 'current_liabilities'], operating_cashflow: ['operating_cashflow'], ppe_purchase_outflow: ['ppe_purchase_outflow'] };
function detailCmp(m, y) {
  const inputs = CMP_INPUTS[m.k];
  return { title: `${y} ${m.l}: 삼양식품 vs 농심`, sub: '두 회사 연결 기준', rows: [...['SY', 'NS'].flatMap((c) => [[`${coName(c)} ${y}`, cmpTxt(m, cmpVal(m, y, c)), `${y - 1}: ${cmpTxt(m, cmpVal(m, y - 1, c))} · 전년 대비 ${cmpDelta(m, y, c)}`], ...inputs.map((k) => [`  └ ${coName(c)} ${finRow(y, k, c)?.label || k}`, `${fmt(fin(y, k, c), 0)}원`, '원 단위 저장값'])])],
    formula: [`${m.l} = ${CMP_FORMULA[m.k]}`, m.kind === 'won' ? '금액 성장률은 %' : '비율 변화는 %p'], limits: CMP_LIMITS,
    sources: [...finSources('SY', y, inputs, ['debt_equity_pct', 'current_ratio_pct'].includes(m.k) ? 'bs' : ['operating_cashflow', 'ppe_purchase_outflow'].includes(m.k) ? 'cf' : 'pl'), ...finSources('NS', y, inputs)], audit: [...finAudit('SY', [y], inputs), ...finAudit('NS', [y], inputs)] };
}
function cmpRevChart(b) {
  const el = h('div', { class: 'chart' }); b.append(el, h('div', { class: 'legend', html: Object.keys(COMPANIES).map((c) => `<span><i style="background:${COMPANIES[c].color}"></i>${coName(c)}</span>`).join('') }));
  if (S.period === 'annual') {
    barChart(el, { data: YEARS.map((y) => ({ label: String(y), year: y, SY: eokW(fin(y, 'revenue', 'SY')), NS: eokW(fin(y, 'revenue', 'NS')) })), series: ['SY', 'NS'].map((c) => ({ key: c, color: COMPANIES[c].color })), colorOf: (s, d) => (d.year === S.year ? s.color : COMPANIES[s.key].soft), isSel: isSelY, fmt: (v) => fmt(v, 0), labels: (v) => fmt(v, 0), maxBar: 28,
      tip: (d) => [`${d.year} 매출액`, `삼양식품 ${eok(d.SY)}`, `농심 ${eok(d.NS)}`, '클릭 → 상세'], onClick: (d) => openDetail(detailCmp(CMP_METRICS[0], d.year)) });
  } else {
    const L = Qc('SY').map((q) => q.period);
    lineChart(el, { labels: L, height: 220, twoRow: YEARS.map((y) => ({ from: `${y}-Q1`, to: `${y}-Q4`, text: String(y), hi: y === S.year })), tickText: (l) => l.slice(5), band: [`${S.year}-Q1`, `${S.year}-Q4`], fmt: (v) => fmt(v, 0),
      series: ['SY', 'NS'].map((c) => ({ values: L.map((p) => eokW(QALL.find((q) => q.c === c && q.period === p)?.revenue ?? null)), color: COMPANIES[c].color, dots: () => true, endLabel: (v) => fmt(v, 0) })),
      tip: (l) => [`${l} 매출 · 단일 분기`, ...['SY', 'NS'].map((c) => `${coName(c)} ${eok(eokW(QALL.find((q) => q.c === c && q.period === l).revenue))}`)], onClick: (l) => openDetail(detailQuarter(QALL.find((q) => q.c === 'SY' && q.period === l))) });
  }
}
function cmpMarginChart(b) {
  const el = h('div', { class: 'chart' }); b.append(el, h('div', { class: 'legend', html: Object.keys(COMPANIES).map((c) => `<span><i class="line" style="background:${COMPANIES[c].color}"></i>${coName(c)}</span>`).join('') }));
  const L = S.period === 'annual' ? YEARS.map(String) : Qc('SY').map((q) => q.period);
  const val = (c, l) => (S.period === 'annual' ? margin(+l, c) : QALL.find((q) => q.c === c && q.period === l)?.margin ?? null);
  lineChart(el, { labels: L, height: 220, yMax: 30, fmt: (v) => v + '%', right: 40, isSelLabel: (l) => l.startsWith(String(S.year)), tickText: S.period === 'annual' ? null : (l) => l.slice(5), twoRow: S.period === 'annual' ? null : YEARS.map((y) => ({ from: `${y}-Q1`, to: `${y}-Q4`, text: String(y), hi: y === S.year })), band: S.period === 'annual' ? null : [`${S.year}-Q1`, `${S.year}-Q4`],
    series: ['SY', 'NS'].map((c) => ({ values: L.map((l) => val(c, l)), color: COMPANIES[c].color, width: 2.2, dots: () => true, endLabel: (v) => pct(v) })),
    tip: (l) => [`${l} 영업이익률`, ...['SY', 'NS'].map((c) => `${coName(c)} ${pct(val(c, l))}`)], onClick: (l) => (S.period === 'annual' ? openDetail(detailCmp(CMP_METRICS[2], +l)) : openDetail(detailQuarter(QALL.find((q) => q.c === 'NS' && q.period === l)))) });
}
function cmpCashChart(b) {
  const el = h('div', { class: 'chart' }); b.append(el, h('div', { class: 'legend', html: '<span><i style="background:#d4262c"></i>삼양 영업현금</span><span><i style="background:#efb9b7"></i>삼양 유형자산 취득</span><span><i style="background:#3d6fb6"></i>농심 영업현금</span><span><i style="background:#b9cbe6"></i>농심 유형자산 취득</span>' }));
  barChart(el, { data: YEARS.map((y) => ({ label: String(y), year: y, so: eokW(fin(y, 'operating_cashflow', 'SY')), sc: eokW(fin(y, 'ppe_purchase_outflow', 'SY')), no: eokW(fin(y, 'operating_cashflow', 'NS')), nc: eokW(fin(y, 'ppe_purchase_outflow', 'NS')) })), series: [{ key: 'so', color: '#d4262c' }, { key: 'sc', color: '#efb9b7' }, { key: 'no', color: '#3d6fb6' }, { key: 'nc', color: '#b9cbe6' }], isSel: isSelY, fmt: (v) => fmt(v, 0), maxBar: 16, pad: 0.2,
    tip: (d) => [`${d.year}`, `삼양 영업현금 ${eok(d.so)} · 취득 ${eok(d.sc)}`, `농심 영업현금 ${eok(d.no)} · 취득 ${eok(d.nc)}`, '영업현금흐름 분류 정책은 회사별 차이'], onClick: (d) => openDetail(detailCmp(CMP_METRICS[7], d.year)) });
}
function cmpStabChart(b) {
  const el = h('div', { class: 'chart' }); b.append(el, h('div', { class: 'legend', html: '<span><i class="line" style="background:#d4262c"></i>부채비율</span><span><i class="line" style="background:#24987a"></i>유동비율</span><span><i class="dash"></i>점선 = 농심</span>' }));
  lineChart(el, { labels: YEARS.map(String), height: 200, yMax: 280, fmt: (v) => v + '%', right: 44, isSelLabel: (l) => +l === S.year,
    series: [['SY', 'debt_equity_pct', C.accent, null], ['SY', 'current_ratio_pct', C.teal, null], ['NS', 'debt_equity_pct', C.accent, '5 4'], ['NS', 'current_ratio_pct', C.teal, '5 4']].map(([c, k, col, dash]) => ({ values: YEARS.map((y) => met(y, k, c)), color: col, dash, dots: () => true, endLabel: (v) => `${COMPANIES[c].short} ${fmt(v, 0)}` })),
    tip: (l) => [`${l}년`, ...['SY', 'NS'].map((c) => `${coName(c)} 부채비율 ${pct(met(+l, 'debt_equity_pct', c))} · 유동비율 ${pct(met(+l, 'current_ratio_pct', c))}`)], onClick: (l) => openDetail(detailCmp(CMP_METRICS[5], +l)) });
}
const qSumOk = (c, y) => { const qs = Qc(c).filter((q) => q.year === y); return qs.length === 4 && [['revenue', 'revenue'], ['cost', 'cost_of_sales'], ['sga', 'sga'], ['op', 'operating_profit']].every(([k, m]) => d3.sum(qs, (q) => q[k]) === fin(y, m, c)); };
const qPlOk = (c) => Qc(c).every((q) => q.revenue - q.cost - q.sga === q.op);
function cmpQuarterCheck(b) {
  b.append(h('div', { class: 'tw' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, '회사'), ...YEARS.map((y) => h('th', {}, String(y))), h('th', {}, '분기 손익 산식'))),
    h('tbody', {}, ['SY', 'NS'].map((c) => h('tr', { class: 'click', onclick: () => openDetail(detailCmpQuarter()) }, h('td', {}, `${coName(c)} (${Qc(c).length}분기)`), ...YEARS.map((y) => h('td', {}, qSumOk(c, y) ? '✓ 일치' : '불일치')), h('td', {}, qPlOk(c) ? '✓ 12분기 일치' : '불일치')))))));
  b.append(h('p', { class: 'note' }, '대시보드가 CSV에서 직접 계산한 결과입니다. 원 단위 정수로 비교합니다.'));
}
function detailCmpQuarter() {
  return { title: '두 회사 12분기 검증', rows: ['SY', 'NS'].flatMap((c) => YEARS.map((y) => [`${coName(c)} ${y}`, qSumOk(c, y) ? '4개 분기 합 = 연간 ✓' : '불일치', Qc(c).filter((q) => q.year === y).map((q) => `${q.period.slice(5)} ${fmt(eokW(q.revenue))}`).join(' · ') + ` = ${eok(eokW(fin(y, 'revenue', c)))}`])),
    formula: ['Σ(Q1..Q4) 매출·매출원가·판관비·영업이익 = 연간 확정값 (원 단위 정확 일치)', '각 분기: 매출 − 원가 − 판관비 = 영업이익'], limits: ['Q4는 연간에서 9개월을 뺀 잔여분이라 분기합은 구조상 연간과 같아집니다. 이 검사는 계산·입력 오류를 찾는 용도입니다.', '농심 분기 48개 값은 공시 원문 기반 신규 계산 상태입니다.'], sources: [SRC.verify02], audit: QALL.flatMap((q) => q.audit) };
}

// ---------- 공급사슬 (삼양식품) ----------
PAGE.supply = {
  kpis() {
    const y = yr(); const prev = (m) => RAWMAT.find((r) => r.material === m && r.year === y - 1); const cur = (m) => RAWMAT.find((r) => r.material === m && r.year === y);
    const k = (m, col) => kpiCard(`${m} 가격`, fmt(cur(m)?.v ?? null, 0), '원/kg', `${cur(m)?.buyer || ''} 매입 · 단가(물량 아님)`, pillHTML(prev(m) ? growth(cur(m).v, prev(m).v) : null, '%', 1, true) + (prev(m) ? ` ${y - 1} 대비` : ' 2022 자료 없음'), () => openDetail(detailMaterial(m)), col);
    return [k('맥분', C.orange), k('정제유(팜유)', C.teal), kpiCard('주요 매입처', String(new Set(SUPPLIERS.map((s) => s.supplier)).size), '곳', '2025 사업보고서 기재 · 완전 목록 아님', '<span class="pill na">물량 미공개</span>', () => openDetail(detailSuppliers()), C.dark), kpiCard('판매경로 그룹', String(CH_GROUPS.length), '개', '그룹 안 비중만 공개 · 합산 금지', '<span class="pill na">분모 미명시</span>', () => openDetail(detailChannels(CH_GROUPS[0])), C.blue)];
  },
  cards() {
    return [
      { id: 'sc-flow', w: 6, title: '공급사슬 단계 (클릭하면 근거)', sub: '원재료 단가 → 매입처 → 생산 공장 → 판매경로 · 단계 사이 연결 물량은 원문에서 확인되지 않음', body: (b) => supplyFlow(b), detail: () => detailSupplyLimits() },
      { id: 'sc-price', w: 3, title: '주요 원재료 가격 추이 (원/kg)', sub: '사업보고서 p.18 가격변동추이 · 실제 구매량·구매총액 아님', body: (b) => materialChart(b), detail: () => detailMaterial('맥분') },
      { id: 'sc-ch', w: 3, title: '판매경로 비중 (그룹 안 %)', sub: '각 그룹 = 100% · 그룹끼리 합산·금액 환산 금지', body: (b) => channelChart(b), detail: () => detailChannels(CH_GROUPS[0]) },
    ];
  },
};
const SUPPLY_LIMITS = ['원문은 개별 공급처 → 개별 공장 물량, 공장 → 특정 고객 물량을 확인해 주지 않습니다. 단계 사이 연결은 ‘미확인’이며 선 굵기로 수량·매출액을 나타내지 않습니다 (01 지침 3절).', '원재료 가격은 단가이지 구매 물량이 아닙니다.', '판매경로 비중은 2025 사업보고서 표에 실렸으나 기준연도·분모 정의가 명확하지 않습니다. 서로 다른 그룹의 비중을 합산하거나 회사 전체 매출로 환산하지 않습니다.', '소스·조미소재는 원문 표의 병합 셀 그대로 하나의 그룹으로 유지합니다(B2C/B2B를 소스·조미소재 각각에 배정할 근거 없음).', '원맥 3품종의 공급처(씨제이제일제당)는 병합 셀 전체에 적용된 값입니다.'];
function supplyFlow(b) {
  const y = yr();
  const stage = (n, title, sub, items) => h('div', { class: 'sc-stage' }, h('div', { class: 'sc-h' }, h('span', { class: 'sc-n' }, n), h('div', {}, h('b', {}, title), h('small', {}, sub))), h('div', { class: 'sc-items' }, items));
  const item = (label, meta, on, warn) => h('button', { class: 'sc-item' + (warn ? ' warn' : ''), onclick: on }, h('span', {}, label), meta ? h('small', {}, meta) : null);
  const link = () => h('div', { class: 'sc-link', title: '연결 물량 미공개' }, h('span', {}, '연결 물량'), h('b', {}, '미확인'));
  const mats = MATERIALS.map((m) => { const r = RAWMAT.find((x) => x.material === m && x.year === y); return item(m, `${r ? fmt(r.v, 0) + '원/kg' : '데이터 없음'} · ${r?.buyer || ''}`, () => openDetail(detailMaterial(m))); });
  const sups = [...new Set(SUPPLIERS.map((s) => s.supplier))].map((sp) => { const rs = SUPPLIERS.filter((s) => s.supplier === sp); return item(sp, `${rs.map((s) => s.material).join(', ')}${rs.some((s) => s.related_party === '계열관계') ? ' · 계열관계' : ''}`, () => openDetail(detailSuppliers(sp))); });
  const plants = PLANTS.map((p) => { const r = PROD.find((x) => x.plant === p && x.year === y); return item(p, r?.cap === null ? '데이터 없음 (공시 행 없음)' : `생산실적 ${eok(eokM(r.prod), 0)} · 가동률 ${pct(r.util)}`, () => openDetail(detailPlant(p)), r?.cap === null); });
  const chs = CH_GROUPS.map((g) => item(g, CHANNELS.filter((c) => c.group === g).map((c) => `${c.channel} ${fmt(c.share)}%`).join(' · '), () => openDetail(detailChannels(g))));
  b.append(h('div', { class: 'sc-flow' }, stage('1', '원재료 단가', `${y} · 원/kg`, mats), link(), stage('2', '주요 매입처', '2025 보고서 기재', sups), link(), stage('3', '생산 공장·품목', `${y} · 금액 기준`, plants), link(), stage('4', '판매경로', '그룹 안 비중 · 2025 보고서', chs)));
  b.append(h('p', { class: 'note warn' }, SUPPLY_LIMITS[0]));
}
function detailSupplyLimits() { return { title: '공급사슬 표시 원칙', rows: [['원재료 가격', `${RAWMAT.length}행 (6개 재료 × 3년)`, 'raw_material_prices.csv'], ['매입처', `${SUPPLIERS.length}행`, 'suppliers.csv · 물량·금액·공장배분 열은 모두 빈 값'], ['공장', `${PLANTS.length}개 공장·품목`, 'production.csv'], ['판매경로', `${CHANNELS.length}행 · ${CH_GROUPS.length}개 그룹`, 'sales_channels.csv']], limits: SUPPLY_LIMITS, sources: [SRC.supply, SRC.channel, SRC.prod, SRC.guide01] }; }
function materialChart(b) {
  const el = h('div', { class: 'chart' }); const cols = [C.orange, '#b0855a', C.teal, C.blue, C.violet, C.dark];
  b.append(el, h('div', { class: 'legend', html: MATERIALS.map((m, i) => `<span><i class="line" style="background:${cols[i]}"></i>${m}</span>`).join('') }));
  lineChart(el, { labels: YEARS.map(String), height: 200, yMin: 0, fmt: (v) => fmt(v, 0), right: 50, isSelLabel: (l) => +l === S.year,
    series: MATERIALS.map((m, i) => ({ values: YEARS.map((y) => RAWMAT.find((r) => r.material === m && r.year === y)?.v ?? null), color: cols[i], dots: () => true, endLabel: (v) => fmt(v, 0) })),
    tip: (l) => [`${l}년 원재료 단가 (원/kg)`, ...MATERIALS.map((m) => `${m} ${fmt(RAWMAT.find((r) => r.material === m && r.year === +l)?.v ?? null, 0)}`), '단가이며 구매량 아님'], onClick: () => openDetail(detailMaterial('맥분')) });
}
function detailMaterial(m) {
  const rs = RAWMAT.filter((r) => r.material === m).sort((a, b) => a.year - b.year);
  return { title: `원재료 단가: ${m}`, sub: `${rs[0]?.buyer} 매입 · raw_material_prices.csv`, rows: rs.map((r) => [String(r.year), `${fmt(r.v, 0)}원/kg`, (() => { const p = rs.find((x) => x.year === r.year - 1); return p ? `전년 대비 ${signed(growth(r.v, p.v), '%')}` : '2022 자료 없음'; })()]).concat([['공급처 (2025 보고서)', SUPPLIERS.filter((s) => s.material === m).map((s) => s.supplier).join(', ') || '기재 없음', SUPPLIERS.find((s) => s.material === m)?.note || '']]),
    formula: ['단가 변화율 = (당기 ÷ 전기 − 1) × 100'], limits: [rs[0]?.basis, '가격 상승·하락을 원가율 변화의 원인으로 단정하지 않습니다 (구매 물량·환율·제품 구성 미공개).', SUPPLY_LIMITS[4]].filter(Boolean),
    sources: [{ label: `삼양식품 사업보고서 2026.03.18 인쇄 p.${rs[0]?.page} (PDF p.${rs[0]?.pdf})`, url: `${PDF}#page=${rs[0]?.pdf}` }] };
}
function detailSuppliers(only) {
  const rs = only ? SUPPLIERS.filter((s) => s.supplier === only) : SUPPLIERS;
  return { title: only ? `매입처: ${only}` : '주요 매입처 (2025 사업보고서)', rows: rs.map((s) => [`${s.buyer} ← ${s.supplier}`, s.material, `${s.related_party}${s.related_party === '원문 - 표기' ? ' (특수관계 여부 원문 ‘-’)' : ''} · 물량·금액·공장배분: 원문 미공개 · ${s.verification}`]),
    limits: ['공급처 목록은 완전 목록을 보장하지 않습니다.', '공급처 → 개별 공장 물량은 확인되지 않아 연결하지 않습니다.', SUPPLY_LIMITS[4]], sources: [SRC.supply] };
}
function channelChart(b) {
  const el = h('div', { class: 'chart' }); b.append(el);
  const chans = [...new Set(CHANNELS.map((c) => c.channel))]; const pal = d3.scaleOrdinal(chans, ['#d4262c', '#3d6fb6', '#24987a', '#df6d36', '#8562c4', '#8f8a82', '#b0855a', '#3b3936', '#c9a227', '#5aa0a8']);
  barChart(el, { stacked: true, height: 230, data: CH_GROUPS.map((g) => { const o = { label: g.replace('면스낵/', '').replace('·조미소재', '·조미'), group: g }; chans.forEach((c) => { o[c] = CHANNELS.find((x) => x.group === g && x.channel === c)?.share ?? null; }); return o; }), series: chans.map((c) => ({ key: c, color: pal(c) })), fmt: (v) => v + '%', pad: 0.3,
    tip: (d) => [`${d.group} (그룹 안 비중)`, ...CHANNELS.filter((c) => c.group === d.group).map((c) => `${c.channel} ${fmt(c.share)}%`), '그룹끼리 합산 금지 · 클릭 → 상세'], onClick: (d) => openDetail(detailChannels(d.group)) });
  b.append(h('p', { class: 'note' }, '막대 높이는 모두 100%입니다. 그룹 크기(매출액)를 뜻하지 않습니다. 색 = 판매경로.'));
}
function detailChannels(g) {
  const rs = CHANNELS.filter((c) => c.group === g);
  return { title: `판매경로: ${g}`, sub: `${rs[0]?.products} · sales_channels.csv`, rows: rs.map((c) => [c.channel, `${fmt(c.share)}%`, c.customer_examples]).concat([['그룹 합계', `${fmt(d3.sum(rs, (c) => c.share))}%`, '동일 그룹 안에서만 100% (검증결과.json 통과)'], ['기준연도', rs[0]?.year_status], ['분모', rs[0]?.denominator_status]]),
    limits: [rs[0]?.note, SUPPLY_LIMITS[2], ...(g.startsWith('소스') ? [SUPPLY_LIMITS[3]] : []), '고객 예시는 개별 경로별 대응이 아닙니다.'].filter(Boolean), sources: [SRC.channel] };
}

// ---------- 사건 연표 (삼양식품) ----------
PAGE.timeline = {
  kpis() { return []; },
  cards() {
    return [
      { id: 'tl-list', w: 4, title: () => (S.tlOnly ? `${yr()}년 사건` : '불닭 성장 연표 2023~2025'), sub: '연도·반기·월·일 정밀도를 원문 그대로 · 사건은 실적·검색의 원인으로 확정되지 않음', body: (b) => timelineList(b), detail: () => detailEvents() },
      { id: 'tl-ms', w: 2, title: '누적 판매 마일스톤 (회사 발표)', sub: '누적 기록 · 연간 판매량으로 차감 계산하지 않음', body: (b) => milestoneList(b), detail: () => detailEvents() },
      { id: 'tl-prec', w: 2, title: '날짜 정밀도', sub: 'events.csv period 형식에서 판별', body: (b) => { const cnt = d3.rollup(EVENTS, (v) => v.length, (e) => e.precision); b.append(h('ul', { class: 'plain' }, [...cnt].map(([k, v]) => h('li', {}, `${k}: ${v}건`)), h('li', {}, `검증 상태: ${[...new Set(EVENTS.map((e) => e.verification_status))].join(', ')} (확인일 ${EVENTS[0]?.verified_on || '—'})`))); } },
    ];
  },
};
function timelineList(b) {
  const tools = h('div', { class: 'raw-tools' }, h('div', { class: 'seg' }, h('button', { 'aria-pressed': String(!S.tlOnly), onclick: () => { S.tlOnly = false; render(); } }, '전체 2023~2025'), h('button', { 'aria-pressed': String(S.tlOnly), onclick: () => { S.tlOnly = true; render(); } }, `${yr()}년만`)));
  const evs = EVENTS.filter((e) => !S.tlOnly || e.year === yr());
  b.append(tools, h('ol', { class: 'tl' }, evs.map((e) => h('li', { class: 'tl-i' + (e.year === yr() ? ' sel' : ''), tabindex: '0', onclick: () => openDetail(detailEvent(e)), onkeydown: (ev) => { if (ev.key === 'Enter') openDetail(detailEvent(e)); } },
    h('div', { class: 'tl-d' }, h('b', {}, e.period), h('span', { class: 'prec' }, e.precision)), h('div', { class: 'tl-t' }, h('div', {}, e.title, e.value !== null ? h('span', { class: 'badge' }, `${fmt(e.value, 0)}${e.unit}`) : null), e.note ? h('small', {}, e.note) : null)))));
}
function milestoneList(b) {
  const ms = EVENTS.filter((e) => e.value !== null);
  b.append(h('ul', { class: 'ms' }, ms.map((e) => h('li', { class: e.year === yr() ? 'sel' : '', onclick: () => openDetail(detailEvent(e)) }, h('b', {}, `${fmt(e.value, 0)}${e.unit}`), h('span', {}, e.period), h('small', {}, e.note)))));
  b.append(h('p', { class: 'note' }, '2026년 5월 100억 개 기록은 분석 범위(2023~2025) 밖이라 연표에서 제외되어 있습니다 (02 경영해석 출처 4).'));
}
function detailEvent(e) {
  return { title: e.title, sub: `${e.period} · 날짜 정밀도: ${e.precision}`, rows: [['시점 (원문 정밀도)', e.period], ['값', e.value === null ? '—' : `${fmt(e.value, 0)}${e.unit}`], ['검증 상태', e.verification_status, e.verification_note], ['확인일', e.verified_on], ['비고', e.note || '—']],
    limits: ['연표 사건은 실적·검색 최고점의 원인으로 확정되지 않았습니다.', '상반기·하반기·연말 같은 표기를 임의의 날짜로 바꾸지 않습니다.', ...(/코첼라/.test(e.title) ? ['3월 발표에 따른 4월 행사 계획이며 실제 운영·성과는 확인하지 않았습니다 (02_검증결과와_한계).'] : [])], sources: [srcFrom(e.source)] };
}
function detailEvents() { return { title: '사건 연표 원칙', rows: [['사건 수', `${EVENTS.length}건`, 'events.csv'], ['검증', '2026-11-03 17행 출처·날짜 정밀도 재확인 (02 문서)']], limits: ['공시의 ‘상반기/하반기 입점 완료’를 임의 날짜로 바꾸지 않습니다.', '모든 SKU·모든 유통업체의 첫 입점을 전수 조사한 목록이 아닙니다.', '2026년 회사 발표가 회고한 2025년 사건은 회고임을 유지합니다.'], sources: [SRC.verify02] }; }

// ---------- 5가지 관점 ----------
// 관찰값은 CSV 계산, 질문·한계는 01 지침 4절과 02 문서 문구. 등급·임계치 없음.
function lensDefs(c, y) {
  const g = (m) => growth(fin(y, m, c), fin(y - 1, m, c));
  const rgNon = () => { const rs = NSREG.filter((r) => r.year === y); const t = d3.sum(rs, (r) => r.v); return t ? (d3.sum(rs.filter((r) => r.region !== '한국'), (r) => r.v) / t) * 100 : null; };
  return [
    { id: 'growth', t: '성장 지속성', obs: [['매출 성장률', YEARS.map((yy) => `${yy} ${signed(growth(fin(yy, 'revenue', c), fin(yy - 1, 'revenue', c)), '%')}`).join(' · ')], ['영업이익률', YEARS.map((yy) => `${yy} ${pct(margin(yy, c))}`).join(' · ')]],
      q: ['매출 성장률과 영업이익률을 함께 보면 성장이 수익성 개선과 같이 나타났는가?', ...(c === 'SY' ? ['증설된 생산능력이 실제 생산·판매로 채워지는지 이후 연도 가동률로 확인할 수 있는가?'] : ['제품별(라면·스낵) 내수·수출 중 어디서 매출이 변했는가?'])], lim: [LIMIT_CONSOL_OF(c), '3개년 자료만으로 추세의 지속을 판정하지 않습니다.'], go: () => go('overview', { year: y }) },
    { id: 'quality', t: '이익의 질', obs: [['영업이익 vs 영업현금흐름', `${eok(eokW(fin(y, 'operating_profit', c)))} vs ${eok(eokW(fin(y, 'operating_cashflow', c)))}`], ['전년 대비', `영업이익 ${signed(g('operating_profit'), '%')} · 영업현금 ${signed(g('operating_cashflow'), '%')}`], ['매출원가율 · 판관비율', `${pct(met(y, 'cost_ratio_pct', c))} · ${pct(met(y, 'sga_ratio_pct', c))}`]],
      q: ['영업이익 증가가 영업현금흐름 증가로 이어졌는가? 법인세 납부·운전자본 변화는?', '이익률 변화가 원가율과 판관비율 중 어디서 왔는가 (손익 산식)?'], lim: ['손익 산식으로 확인되는 변화는 개별 원인의 기여도 측정이 아닙니다.', ...(c === 'NS' ? ['영업현금흐름 분류 정책은 회사별 차이가 있습니다.'] : [])], go: () => go('performance', { year: y, hl: 'pf-cash' }) },
    { id: 'cash', t: '현금·재무 안정성', obs: [['영업현금 − 유형자산 취득', eok(eokW(met(y, 'cash_after_ppe_KRW', c)))], ['부채비율 · 유동비율', `${pct(met(y, 'debt_equity_pct', c))} · ${pct(met(y, 'current_ratio_pct', c))}`], ['법인세 납부', `${eok(eokW(fin(y - 1, 'tax_paid_outflow', c)))} → ${eok(eokW(fin(y, 'tax_paid_outflow', c)))}`]],
      q: ['영업현금흐름과 유형자산 취득 지출의 차액은 어떻게 변했는가?', '투자 집행과 자금조달 부담을 어떻게 관찰할 것인가?'], lim: [DOC.gap, '‘유형자산 취득 후 차액’은 무형자산 등을 빼지 않아 잉여현금흐름(FCF)이 아닙니다.', '부채비율·유동비율에 우수·위험 임계치를 두지 않습니다.'], go: () => go('performance', { year: y, hl: 'pf-capex' }) },
    { id: 'fx', t: '해외·환율 위험', obs: c === 'SY' ? [['면스낵 수출 비중', `${pct(exportShare(y))} (${signed(pp(exportShare(y), exportShare(y - 1)), '%p')})`], ['미국법인 성장률', `원화 ${pct(FE.find((f) => f.entity === '미국' && f.year === 2025)?.growth)} vs 현지통화 ${pct(FEL.find((f) => f.entity === '미국')?.growth)} (2025)`]] : [['한국 외 지역 외부고객 수익 비중', `${pct(rgNon())} (${y})`], ['라면 수출', `${eok(eokM(NSSEG.find((r) => r.year === y && r.segment === '라면')?.exports ?? null))}`]],
      q: c === 'SY' ? ['매출 성장이 수출에 얼마나 의존하는가? 환율·해외 유통 변화에 대한 노출은?', '원화 환산 성장률과 현지통화 성장률의 차이는 무엇을 뜻하는가?'] : ['지역별 외부고객 수익 구성은 어떻게 변했는가?', '수출과 해외 지역 수익을 어떻게 구분해 읽을 것인가?'], lim: c === 'SY' ? ['면스낵 수출 비중은 회사 전체 해외매출 비중이 아닙니다.', '해외법인 매출은 연결 내부거래 제거 전이라 연결매출에 더하지 않습니다.'] : LIMIT_NSREG, go: () => go('market', { year: y }) },
    { id: 'capacity', t: '생산 여력', obs: c === 'SY' ? [['밀양 면류 가동률', `${pct(PROD.find((p) => p.plant === '밀양 면류' && p.year === y - 1)?.util ?? null)} → ${pct(PROD.find((p) => p.plant === '밀양 면류' && p.year === y)?.util ?? null)}`], ['밀양 면류 생산능력', `${eok(eokM(PROD.find((p) => p.plant === '밀양 면류' && p.year === y - 1)?.cap ?? null), 0)} → ${eok(eokM(PROD.find((p) => p.plant === '밀양 면류' && p.year === y)?.cap ?? null), 0)} (금액)`]] : [['라면 제품유형 가동률', `${pct(NSUTIL.find((r) => r.entity === '라면' && r.year === y - 1)?.util ?? null)} → ${pct(NSUTIL.find((r) => r.entity === '라면' && r.year === y)?.util ?? null)}`], ['스낵 제품유형 가동률', `${pct(NSUTIL.find((r) => r.entity === '스낵' && r.year === y)?.util ?? null)}`]],
      q: ['공시 가동률의 산정기준이 바뀌었는가? (삼양 2025: 밀양2공장 가동·기준 변경)', '증설 능력이 이후 생산·판매로 채워지는가?'], lim: c === 'SY' ? LIMIT_PROD : NS_UTIL_LIMIT, go: () => go('production', { year: y }) },
  ];
}
PAGE.lens = {
  kpis() { return []; },
  cards() {
    const c = S.company, y = yr();
    return lensDefs(c, y).map((L) => ({ id: 'ls-' + L.id, w: 2, title: L.t, sub: `${coName(c)} · ${y} 기준`, body: (b) => b.append(h('div', { class: 'lens' }, h('h4', {}, '관찰값'), h('table', { class: 'kv' }, h('tbody', {}, L.obs.map((o) => h('tr', {}, h('th', {}, o[0]), h('td', {}, o[1]))))), h('h4', {}, '확인할 질문'), h('ul', {}, L.q.map((t) => h('li', {}, t))), h('h4', {}, '한계'), h('ul', { class: 'lim' }, L.lim.map((t) => h('li', {}, t))), h('button', { class: 'go', onclick: L.go }, '관련 화면 →'))),
      detail: () => ({ title: `${L.t} — ${coName(c)} ${y}`, rows: L.obs, facts: [], impl: L.q, limits: [...L.lim, '01 지침 4절: 근거 없이 우수·위험 등급이나 임계치를 확정하지 않습니다.'], sources: [SRC.guide01] }) })).concat([{ id: 'ls-note', w: 6, title: '관점 카드 사용 원칙', sub: '01_수정_구현지침 4절', body: (b) => b.append(h('p', { class: 'note' }, '관찰값은 CSV에서 계산했고, 질문과 한계는 제공 문서 문구를 따랐습니다. 점수·신호등·우수/위험 등급을 붙이지 않습니다. 기업을 바꾸면 해당 기업 자료로 관찰값이 바뀝니다.')) }]);
  },
};

// ---------- 데이터 검증 ----------
PAGE.audit = {
  kpis() {
    const rows = auditRows(); const cnt = d3.rollup(rows, (v) => v.length, (r) => r.result);
    const k = (lab, keys, col, sub) => kpiCard(lab, String(d3.sum(keys, (kk) => cnt.get(kk) || 0)), '건', sub, '', () => { S.auditRes = keys.length === 1 ? keys[0] : 'all'; render(); }, col);
    return [k('원문 대조 일치', ['원문 대조 일치'], C.teal, '기존 자료를 공시 원문과 대조'), k('비교열 대조 일치', ['별도 사업보고서 비교열 대조 일치'], C.blue, '다른 연도 보고서 비교열과 대조'), k('신규 추출·계산', ['공시 원문 신규 추출', '공시 원문 기반 신규 계산'], '#9a6a00', '대조 완료 표시 없음'), k('결측·보도값', ['공시 해당 값 없음', '공시 해당 행 없음', '해당 없음: 설립 전', '보도값 일치; 감사 공시 아님'], C.dark, '빈 값 사유·언론 보도')];
  },
  cards() {
    return [
      { id: 'au-ledger', w: 6, title: '검증 원장 (audit_ledger.csv)', sub: () => `기업: ${coName(S.company)} · 행 클릭 → 원문 위치·추출 행·출처`, body: (b) => auditTable(b), detail: () => auditInfo() },
      { id: 'au-cross', w: 3, title: '농심 2022~2024 교차대조 (42건)', sub: 'nongshim_annual_crosscheck.csv · 다른 연도 사업보고서 비교열', body: (b) => crossTable(b), detail: () => ({ title: '농심 교차대조', rows: [['대조 건수', `${R.nongshim_annual_crosscheck.length}건`], ['결과', [...new Set(R.nongshim_annual_crosscheck.map((r) => r.result))].join(', ')]], limits: ['동일 회사의 공통 기초자료이므로 독립 감사는 아닙니다 (02 문서 추가 보완).', '2025년 재무 14개는 신규 추출 상태입니다.'], sources: [...new Set(R.nongshim_annual_crosscheck.map((r) => r.source_id))].map(regSrc) }) },
      { id: 'au-issue', w: 3, title: '확인 필요 · 미실시 항목', sub: '02_검증결과와_한계 · 검증결과.json', body: (b) => issueList(b), detail: () => auditInfo() },
    ];
  },
};
const auditRows = () => R.audit_ledger.filter((a) => a.row_key.startsWith(S.company + '|') || (S.company === 'SY' && !/^(SY|NS)\|/.test(a.row_key)));
function auditTable(b) {
  const all = auditRows(); const dss = [...new Set(all.map((a) => a.dataset))]; const res = [...new Set(all.map((a) => a.result))];
  const selD = h('select', { class: 'select', 'aria-label': '데이터셋' }, h('option', { value: 'all' }, `전체 데이터셋 (${all.length})`), dss.map((d) => h('option', { value: d }, `${d} (${all.filter((a) => a.dataset === d).length})`)));
  const selR = h('select', { class: 'select', 'aria-label': '상태' }, h('option', { value: 'all' }, '전체 상태'), res.map((r) => h('option', { value: r }, r)));
  selD.value = dss.includes(S.auditDs) ? S.auditDs : 'all'; selR.value = res.includes(S.auditRes) ? S.auditRes : 'all';
  const box = h('div', { class: 'tw', style: 'max-height:420px' }); const cnt = h('small', { class: 'note' });
  const draw = () => { S.auditDs = selD.value; S.auditRes = selR.value; const rows = all.filter((a) => (selD.value === 'all' || a.dataset === selD.value) && (selR.value === 'all' || a.result === selR.value)); cnt.textContent = `${rows.length}건 표시`;
    box.replaceChildren(h('table', { class: 'tbl audit-tbl' }, h('thead', {}, h('tr', {}, ['ID', '데이터셋', '대상 행', '필드', '데이터 값', '원문 위치', '방법', '상태', '출처 ID'].map((t) => h('th', { class: 'l' }, t)))),
      h('tbody', {}, rows.map((r) => h('tr', { class: 'click', onclick: () => openDetail(auditDetail(r.audit_id)) }, h('td', { class: 'l' }, r.audit_id), h('td', { class: 'l' }, r.dataset.replace('.csv', '')), h('td', { class: 'l' }, r.row_key), h('td', { class: 'l' }, r.field), h('td', { class: 'l' + (r.dataset_value === '' ? ' nd' : '') }, r.dataset_value === '' ? '(빈 값)' : r.dataset_value), h('td', { class: 'l' }, r.source_location || '—'), h('td', { class: 'l' }, r.method), h('td', { class: 'l' }, statusBadge(r.result)), h('td', { class: 'l' }, (AUDIT_SRC.get(r.audit_id) || []).join(', '))))))); };
  selD.addEventListener('change', draw); selR.addEventListener('change', draw);
  b.append(h('div', { class: 'raw-tools' }, selD, selR, cnt), box); draw();
}
function crossTable(b) {
  const rs = R.nongshim_annual_crosscheck;
  b.append(h('div', { class: 'tw', style: 'max-height:300px' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, '연도·항목'), h('th', {}, '데이터 값'), h('th', {}, '비교열 값'), h('th', { class: 'l' }, '결과'))), h('tbody', {}, rs.map((r) => h('tr', {}, h('td', {}, `${r.year} ${r.metric}`), h('td', {}, fmt(N(r.dataset_value), 0)), h('td', {}, fmt(N(r.independent_source_value), 0)), h('td', { class: 'l' }, r.result === '일치' || /일치/.test(r.result) ? '✓ ' + r.result : r.result)))))));
}
function issueList(b) {
  const iss = VERIFY?.source_internal_issues || []; const nt = VERIFY?.not_tested || ['(검증결과.json을 읽지 못함)'];
  const links = R.audit_source_links.length; const uniq = new Set(R.audit_source_links.map((l) => l.audit_id + '|' + l.source_id)).size;
  b.append(h('h4', { class: 'mini-h' }, '원문 내부 불일치'), h('ul', { class: 'plain' }, iss.map((i) => h('li', {}, `${i.year} ${i.entity}: 공시 ${i.reported_utilization_pct}% vs 시간 재계산 ${fmt(+i.recalculated_utilization_pct, 1)}% — ${i.note}`))),
    h('h4', { class: 'mini-h' }, '전달본에서 미실시로 기록된 항목'), h('ul', { class: 'plain' }, nt.map((t) => h('li', {}, t))),
    h('h4', { class: 'mini-h' }, '문서와 다른 수치'), h('ul', { class: 'plain' }, h('li', {}, `검증결과.json은 출처 연결을 ${VERIFY?.recheck_2026_11_03?.source_id_links ?? '?'}건으로 기록했지만 audit_source_links.csv는 ${links}행(중복 제외 ${uniq}건)입니다. 어느 쪽이 맞는지 확인하지 못했습니다. 화면은 CSV를 그대로 씁니다.`)));
}
function auditInfo() { return { title: '검증 원장 읽는 법', rows: [['원장 행', `${R.audit_ledger.length}건`, 'audit_ledger.csv'], ['출처 연결', `${R.audit_source_links.length}행`, 'audit_source_links.csv'], ['출처 등록부', `${R.source_registry.length}건`, 'source_registry.csv'], ['추출된 원문 표 행', `${EVIDENCE.length}행`, 'sources/extracted_source_rows.json']], formula: ['audit_id → audit_source_links.source_id (여러 개 가능) → source_registry.source_url', '원문 위치 형식: 출처ID:t표번호:r행번호 (0부터 센 값)'], limits: ['✓는 ‘원문 대조 일치’·‘별도 사업보고서 비교열 대조 일치’에만 붙입니다.', '농심 신규 수치는 공시 원문 행에서 추출한 값이며 독립적인 제3자 검증이나 최신 정정 확인이 아닙니다 (01 지침 1절).', '최신 정정공시 전체 이력 대조는 미완료입니다 (검증결과.json).'], sources: [SRC.guide01, SRC.verify02] }; }

// ---------- 출처 ----------
PAGE.sources = {
  kpis() { return []; },
  cards() {
    return [
      { id: 'so-main', w: 3, title: '삼양식품 주요 원문', sub: '사업보고서는 해당 인쇄 페이지로 열립니다 (PDF 페이지 = 인쇄 페이지 + 4)', body: (b) => b.append(h('ul', { class: 'src-list' }, [SRC.pl, SRC.bs, SRC.cf, SRC.seg, SRC.prod, SRC.supply, SRC.channel, SRC.fe25, SRC.local, SRC.mgmt, SRC.y2022, SRC.ar2024, SRC.naver, SRC.google].map((s) => h('li', {}, s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.label) : s.label)))) },
      { id: 'so-reg', w: 3, title: '출처 등록부 (source_registry.csv)', sub: '감사 원장이 가리키는 출처 ID · 최신 정정 확인 상태', body: (b) => b.append(h('div', { class: 'tw', style: 'max-height:300px' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', { class: 'l' }, 'ID'), h('th', { class: 'l' }, '원문'), h('th', { class: 'l' }, '정정 확인'))), h('tbody', {}, R.source_registry.map((s) => h('tr', {}, h('td', { class: 'l' }, s.source_id), h('td', { class: 'l' }, s.source_url ? h('a', { href: s.source_url, target: '_blank', rel: 'noopener', class: 'lnk' }, s.title && s.title !== s.source_id ? s.title : s.source_url) : s.title), h('td', { class: 'l' }, s.latest_revision_check))))))) },
      { id: 'so-formula', w: 3, title: '계산식', sub: '이전 01 문서 5절 + 01 수정 지침', body: (b) => b.append(h('div', { class: 'formula' }, FORMULAS.map((f) => h('div', {}, f)))) },
      { id: 'so-gaps', w: 3, title: '미확보·제한 항목과 처리', sub: '데이터가 없는 기능은 숨기지 않고 사유 표시', body: (b) => b.append(h('div', { class: 'tw' }, h('table', { class: 'tbl' }, h('tbody', {}, GAPS.map(([a, c]) => h('tr', {}, h('td', { class: 'l' }, a), h('td', { class: 'l' }, c))))))) },
      { id: 'so-price', w: 3, title: '참고: 미국 소매가격 표본 (2026-10-27 조회)', sub: '연도 선택과 분리 · 2023~2025 가격 아님 · 재무 비교 아님', body: (b) => priceRef(b) },
      { id: 'so-status', w: 3, title: '이전 조사 기록 (research_status.csv)', sub: '2026-10-27 조사 시점의 참고 기록 · 최신 상태는 ‘데이터 검증’ 화면', body: (b) => b.append(h('div', { class: 'tw' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', { class: 'l' }, '항목'), h('th', { class: 'l' }, '상태'), h('th', { class: 'l' }, '남은 한계'))), h('tbody', {}, R.research_status.map((r) => h('tr', {}, h('td', {}, r.item), h('td', { class: 'l' }, r.status), h('td', { class: 'l' }, r.remaining))))))) },
      { id: 'so-docs', w: 3, title: '전달 문서', sub: 'docs/handoff · 이번 전달본이 reference/ 보다 우선', body: (b) => b.append(h('ul', { class: 'src-list' }, [['00_먼저읽기.md', '읽는 순서·주의'], ['01_수정_구현지침.md', '수정 작업·완료 확인'], ['02_검증결과와_한계.md', '대조 범위·미확인'], ['검증결과.json', '검증 항목 결과'], ['reference/02_경영해석과_출처.md', '삼양 해설 문구 (참고)'], ['reference/03_추가조사_결과와_잔여한계.md', '추가조사·한계 (참고)'], ['reference/01_대시보드_기획과_구현안내.md', '화면·계산식 (참고)']].map(([f, d]) => h('li', {}, h('a', { href: 'docs/handoff/' + f, target: '_blank', rel: 'noopener' }, f), ` — ${d}`)))) },
      { id: 'so-index', w: 3, title: '외부 원문 URL 색인 (source_index.csv)', sub: '확인일 2026-10-27', body: (b) => b.append(h('div', { class: 'tw', style: 'max-height:260px' }, h('table', { class: 'tbl' }, h('tbody', {}, R.source_index.map((s) => h('tr', {}, h('td', { class: 'l' }, h('a', { href: s.source_url, target: '_blank', rel: 'noopener', class: 'lnk' }, s.source_url)), h('td', { class: 'l' }, s.used_in))))))) },
      { id: 'so-raw', w: 6, title: '원자료 보기', sub: '대시보드가 읽는 CSV 원본 그대로 (빈 칸 = 결측, 0 아님)', body: (b) => rawViewer(b) },
    ];
  },
};
const GAPS = [['오뚜기 재무·가격·검색', '자료 없음 → 표시 안 함'], ['농심 개별 해외법인·검색·브랜드 매출', '자료 없음 → 해당 화면에 ‘자료 없음’ 표시'], ['농심 면스낵 수출 비중', '집계 범위 차이 → 비교 불가 (사유 표시)'], ['농심 2024 상해농심 가동률', '원문 내부 산식 불일치 → 확인 필요 배지·비교 제외'], ['불닭 브랜드 영업이익', '공개자료 미확인 → 데이터 없음'], ['브랜드 매출 집계 범위의 연도별 동일성', '미확인 → 성장률 강조 안 함'], ['회사 전체 해외매출 비중(삼양)', 'CSV 미수록 → 면스낵 수출 비중만 표시'], ['2022 사업부문·분기 실적', '미확보 → 2023 일부 전년 비교 없음'], ['밀양 조미소스소재 2023~2024', '당시 공시 별도 행 없음 → 데이터 없음'], ['유럽법인 2023', '설립 전'], ['농심 유럽 지역 2023~2024', '해당 연도 행 없음 (사유 미기재)'], ['공급처→공장, 공장→고객 물량', '원문 미공개 → 연결 미확인'], ['판매경로 기준연도·분모', '불명확 → 그룹 안 비중만, 합산·환산 금지'], ['검색 최고점의 직접 원인', '인과 미확인 → 시기만 표시'], ['네이버 지역별·관련 검색어', '원자료 없음 → 해당 없음'], ['DART 자동 반영·주가 연동', '이번 기본 구현 범위에서 분리 (후속)']];
const FORMULAS = ['영업이익률 = 영업이익 ÷ 매출액 × 100', '매출원가율 = 매출원가 ÷ 매출액 × 100 · 판관비율 = 판관비 ÷ 매출액 × 100', '성장률 = (당기 ÷ 전기 − 1) × 100 (전기 결측·0이면 계산 안 함) · 비율 변화는 %p', '면스낵 수출 비중 = 수출 ÷ (수출 + 내수) × 100 (삼양 면스낵 안의 비중)', '유형자산 취득 후 차액 = 영업현금흐름 − 유형자산 취득 (FCF 아님)', '부채비율 = 부채 ÷ 자본 × 100 · 유동비율 = 유동자산 ÷ 유동부채 × 100', '재고회전율 = 매출원가 ÷ 평균 재고 · 매출채권회전율 = 매출액 ÷ 평균 매출채권', '사업별 기여액 = 당기 사업 매출 − 전기 사업 매출 (나머지 = 차이 조정)', '단위: 원 ÷ 1억 · 백만원 ÷ 100 · 천원 ÷ 10만 = 억원 (표시만 반올림)'];
function priceRef(b) {
  const el = h('div', { class: 'chart short', style: 'min-height:80px' }); b.append(h('p', { class: 'note warn' }, h('span', { class: 'badge' }, '2026 조회 표본'), ' 2026-10-27에 검색엔진이 반환한 Walmart 온라인 표시가격 1건씩입니다. 배송지·판매자·세금·배송비가 고정되지 않았고, 2023~2025 가격으로 소급하지 않습니다.'), el);
  hbars(el, { data: PRICE.map((p) => ({ label: p.product, v: p.perBag, text: `봉당 $${fmt(p.perBag, 3)} (${p.packs}봉 $${fmt(p.price, 2)})`, color: p.product.includes('농심') ? C.blue : C.accent })), rowH: 28, tip: (d) => [d.label, d.text, '조회일 2026-10-27 · 배송지·판매자·세금 미고정'] });
  b.append(h('p', { class: 'note' }, '중량·조리유형이 달라 품질 프리미엄으로 해석하지 않으며, 신라면 중량 표기 충돌(4.02oz/4.2oz)로 100g당 비교는 보류했습니다.'), h('ul', { class: 'src-list' }, PRICE.map((p) => h('li', {}, h('a', { href: p.source, target: '_blank', rel: 'noopener' }, p.source)))));
}
function rawViewer(b) {
  const names = Object.keys(R); const sel = h('select', { class: 'select', id: 'rawSel', 'aria-label': '원자료 선택' }, names.map((n) => h('option', { value: n }, `${FILES[n]} (${R[n].length}행)`)));
  const box = h('div', { class: 'tw', style: 'max-height:380px' });
  const draw = () => { const rows = R[sel.value]; const cols = Object.keys(rows[0] || {}); box.replaceChildren(h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, cols.map((c) => h('th', { class: 'l' }, c)))), h('tbody', {}, rows.slice(0, 600).map((r) => h('tr', {}, cols.map((c) => h('td', { class: 'l' + (r[c] === '' ? ' nd' : ''), style: 'white-space:nowrap' }, r[c] === '' ? '(빈 값)' : r[c]))))))); };
  sel.addEventListener('change', draw); b.append(h('div', { class: 'raw-tools' }, sel, h('a', { class: 'lnk', href: FILES[names[0]], target: '_blank', id: 'rawDl' }, 'CSV 열기')), box); draw();
  sel.addEventListener('change', () => { b.querySelector('#rawDl').href = FILES[sel.value]; });
}

// =====================================================================
// 분석 보드 — 근거 카드를 끌어 분류하는 칸반 (영상의 Bid pipeline 상호작용)
// 카드 수치는 모두 CSV에서 계산. 열 이동은 '분류'만 바꾸며 수치를 바꾸지 않는다.
// =====================================================================
const CAT = { 실적: '#d4262c', 해외: '#3d6fb6', 현금: '#24987a', 생산: '#8562c4', 검색: '#df6d36', 자료: '#8f8a82' };
const COLS = [
  { id: 'grow', label: '성장 근거', dot: '#1d8a5c', hint: '성과를 뒷받침하는 수치' },
  { id: 'risk', label: '위험·점검', dot: '#c23b30', hint: '관찰이 필요한 변화' },
  { id: 'check', label: '확인 필요', dot: '#9a6a00', hint: '데이터 한계·미확인' },
  { id: 'use', label: '발표에 쓸 근거', dot: '#1c1a17', hint: '교수님 발표에 채택' },
];
function boardCards() {
  const prevCo = S.company; S.company = 'SY';
  try { return boardCardsSY(); } finally { S.company = prevCo; }
}
function boardCardsSY() {
  const fe = (e, y) => FE.find((r) => r.entity === e && r.year === y);
  const mi = (y) => PROD.find((p) => p.plant === '밀양 면류' && p.year === y);
  return [
    { id: 'rev', cat: '실적', title: '매출 3년 연속 30%대 이상 성장', meta: `2025 ${eok(eokW(fin(2025, 'revenue')))} · 연결`, value: signed(met(2025, 'revenue_growth_pct'), '%'), bar: null, src: 'p.48', detail: () => detailRevenue(2025, 'SY') },
    { id: 'margin', cat: '실적', title: '영업이익률 12.4% → 22.3%', meta: '원가율 하락이 산식상 주된 요인', value: pct(met(2025, 'operating_margin_pct')), bar: met(2025, 'operating_margin_pct') / 30, src: 'p.48', detail: () => detailRatios(2025, 'SY') },
    { id: 'export', cat: '해외', title: '면스낵 수출 비중 84.6%', meta: '면스낵 사업 안의 비중 · 전사 비중 아님', value: pct(exportShare(2025)), bar: exportShare(2025) / 100, src: 'p.27', detail: () => detailSegment('면스낵', 2025) },
    { id: 'us', cat: '해외', title: '미국 판매법인 매출 약 3.7배', meta: `2023 ${fmt(eokK(fe('미국', 2023).rev), 0)} → 2025 ${fmt(eokK(fe('미국', 2025).rev), 0)}억원`, value: signed(fe('미국', 2025).growth, '%'), bar: null, src: 'p.52', detail: () => detailEntity('미국') },
    { id: 'eu', cat: '해외', title: '유럽법인 설립 다음 해 급성장', meta: `2025 ${eok(eokK(fe('유럽', 2025).rev))} · 2023 설립 전`, value: signed(fe('유럽', 2025).growth, '%'), bar: null, src: 'p.52', detail: () => detailEntity('유럽') },
    { id: 'ocf', cat: '현금', title: '영업현금흐름 감소', meta: `법인세 납부 ${fmt(eokW(fin(2024, 'tax_paid_outflow')), 0)} → ${fmt(eokW(fin(2025, 'tax_paid_outflow')), 0)}억원`, value: signed(met(2025, 'operating_cashflow_growth_pct'), '%'), bar: null, src: 'p.50', detail: () => detailCash(2025, 'SY') },
    { id: 'gap', cat: '현금', title: '설비투자가 영업현금 초과', meta: '유형자산 취득 후 차액 (FCF 아님)', value: signed(eokW(met(2025, 'cash_after_ppe_KRW')), '억', 0), bar: null, src: 'p.50', detail: () => detailCash(2025, 'SY') },
    { id: 'inv', cat: '현금', title: '재고자산 65.5% 증가', meta: `재고회전율 ${fmt(met(2024, 'inventory_turnover'), 2)} → ${fmt(met(2025, 'inventory_turnover'), 2)}회`, value: signed(met(2025, 'inventory_growth_pct'), '%'), bar: null, src: 'p.47', detail: () => detailWC(2025, 'SY') },
    { id: 'debt', cat: '현금', title: '부채비율 102.9% → 72.7%', meta: '자본이 부채보다 빠르게 증가', value: pct(met(2025, 'debt_equity_pct')), bar: met(2025, 'debt_equity_pct') / 150, src: 'p.47', detail: () => detailStability(2025, 'SY') },
    { id: 'miryang', cat: '생산', title: '밀양 면류 가동률 하락', meta: '2025 밀양2공장 가동·산정기준 변경', value: `${pct(mi(2024).util, 1)} → ${pct(mi(2025).util, 1)}`, bar: mi(2025).util / 100, src: 'p.19', detail: () => detailPlant('밀양 면류') },
    { id: 'cap', cat: '생산', title: '밀양 면류 생산능력 2배 이상', meta: '금액 기준 · 물량 증가율로 단정 금지', value: `${fmt(eokM(mi(2024).cap), 0)} → ${fmt(eokM(mi(2025).cap), 0)}억`, bar: null, src: 'p.18', detail: () => detailPlant('밀양 면류') },
    { id: 'peak', cat: '검색', title: '국내·해외 최고점 시기 다름', meta: 'Google 2025-08 · 네이버 2025-02', value: '시기만 비교', bar: null, src: 'Trends', detail: () => detailPeaks() },
    { id: 'cause', cat: '검색', title: '검색 최고점 원인 미확인', meta: '같은 시기 보도는 인과 근거 아님', value: '인과 미확인', bar: null, src: '03 문서', detail: () => detailSearchMonth('Worldwide', peakOf('Worldwide')) },
    { id: 'brand', cat: '자료', title: '불닭 브랜드 매출은 보도값', meta: '집계 범위 동일성 미확인 · 이익 데이터 없음', value: '약 1조6,000억', bar: null, src: '언론', detail: () => detailBrand() },
    { id: 'comp', cat: '자료', title: '농심과 연결 재무 비교 가능', meta: '사업 구성·회계 분류 차이 · 농심은 신규 추출 값', value: `이익률 ${fmt(margin(2025, 'SY'))} vs ${fmt(margin(2025, 'NS'))}%`, bar: null, src: '공시', detail: () => detailCmp(CMP_METRICS[2], 2025) },
  ];
}
const BOARD_DEFAULT = { grow: ['rev', 'margin', 'export', 'us', 'eu', 'debt'], risk: ['ocf', 'gap', 'inv', 'miryang'], check: ['cause', 'brand', 'comp'], use: ['cap', 'peak'] };
function loadBoard() {
  const ids = boardCards().map((c) => c.id); const saved = store.get('board:v1', null);
  if (!saved) return JSON.parse(JSON.stringify(BOARD_DEFAULT));
  const seen = new Set(); const b = {};
  COLS.forEach((c) => { b[c.id] = (saved[c.id] || []).filter((id) => ids.includes(id) && !seen.has(id) && seen.add(id)); });
  ids.filter((id) => !seen.has(id)).forEach((id) => b.check.push(id));
  return b;
}
let BOARD = null;
const toastEl = h('div', { class: 'toast', role: 'status', hidden: true }); document.body.append(toastEl);
let toastTimer = null;
function toast(msg, undo) {
  toastEl.replaceChildren(h('span', {}, msg), undo ? h('button', { onclick: () => { undo(); toastEl.hidden = true; } }, '되돌리기') : null, h('kbd', {}, '⌘Z'));
  toastEl.hidden = false; toastEl.classList.remove('show'); void toastEl.offsetWidth; toastEl.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 4500);
  lastUndo = undo;
}
let lastUndo = null;
document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && S.page === 'board' && lastUndo) { e.preventDefault(); const u = lastUndo; lastUndo = null; u(); toastEl.hidden = true; } });

function barcode(el, ids, cards, preview) {
  el.replaceChildren();
  const total = cards.length; // 보드 전체 카드 수만큼 칸을 두고, 채운 칸 = 이 열의 근거
  for (let i = 0; i < total; i++) {
    const id = ids[i]; const c = id && cards.find((x) => x.id === id);
    el.append(h('i', { style: c ? `background:${CAT[c.cat]}` : null, class: c ? (preview && preview.id === id ? 'new' : '') : 'off' }));
  }
}
function renderBoard(page) {
  BOARD = BOARD || loadBoard();
  const cards = boardCards(); const byId = (id) => cards.find((c) => c.id === id);
  const sums = h('div', { class: 'board-sum' });
  const sumEls = {};
  COLS.forEach((col) => {
    const num = h('span', { class: 'sum-n' }); const delta = h('span', { class: 'sum-d' }); const bc = h('div', { class: 'barcode' }); const cap = h('div', { class: 'sum-cap' });
    sums.append(h('div', { class: 'sum-card', 'data-col': col.id }, h('div', { class: 'sum-h' }, h('i', { style: `background:${col.dot}` }), col.label), h('div', { class: 'sum-v' }, num, h('small', {}, '개 근거'), delta), bc, cap));
    sumEls[col.id] = { num, delta, bc, cap };
  });
  const paintSums = (state, moving) => {
    COLS.forEach((col) => {
      const ids = state[col.id]; const e = sumEls[col.id]; const base = BOARD[col.id].length; const d = ids.length - base;
      e.num.textContent = ids.length; e.delta.textContent = d ? (d > 0 ? `+${d}` : `${d}`) : ''; e.delta.className = 'sum-d' + (d > 0 ? ' up' : d < 0 ? ' down' : '');
      barcode(e.bc, ids, cards, moving);
      const cnt = {}; ids.forEach((id) => { const c = byId(id); cnt[c.cat] = (cnt[c.cat] || 0) + 1; });
      e.cap.textContent = Object.keys(cnt).length ? Object.entries(cnt).map(([k, v]) => `${k} ${v}`).join(' · ') : col.hint;
      e.num.parentElement.parentElement.classList.toggle('preview', d !== 0);
    });
  };
  const colsEl = h('div', { class: 'board-cols' });
  COLS.forEach((col) => {
    const list = h('div', { class: 'bcol-list' });
    BOARD[col.id].forEach((id) => list.append(cardEl(byId(id))));
    list.append(h('div', { class: 'bcol-empty' }, h('span', {}, '＋'), h('b', {}, '여기에 끌어다 놓기'), h('small', {}, col.hint)));
    colsEl.append(h('section', { class: 'bcol', 'data-col': col.id }, h('header', { class: 'bcol-h' }, h('i', { style: `background:${col.dot}` }), h('span', {}, col.label), h('em', { class: 'bcol-n' }, String(BOARD[col.id].length))), list));
  });
  function cardEl(c) {
    return h('article', { class: 'bcard', 'data-id': c.id, tabindex: '0', 'aria-label': `${c.title} — 끌어서 이동, Enter로 상세` },
      h('div', { class: 'bc-top' }, h('span', { class: 'bc-tag', style: `color:${CAT[c.cat]};background:${CAT[c.cat]}14;border-color:${CAT[c.cat]}33` }, c.cat), h('span', { class: 'bc-src' }, c.src)),
      h('div', { class: 'bc-title' }, c.title), h('div', { class: 'bc-meta' }, c.meta),
      c.bar !== null ? h('div', { class: 'bc-bar' }, h('i', { style: `width:${Math.max(2, Math.min(100, c.bar * 100))}%;background:${CAT[c.cat]}` })) : h('div', { class: 'bc-bar empty' }),
      h('div', { class: 'bc-foot' }, h('span', { class: 'bc-dots' }, h('i', { style: `background:${CAT[c.cat]}` })), h('b', {}, c.value)));
  }
  page.append(h('div', { class: 'board-intro' }, h('div', {}, h('h2', {}, '의사결정 근거 보드'), h('p', {}, '카드를 끌어 분류하면 위 합계가 놓기 전에 미리 바뀝니다. 카드를 누르면 계산식·출처가 열립니다. 초기 분류는 제안이며, 카드 수치는 바뀌지 않습니다.')), h('div', { class: 'board-actions' }, h('button', { class: 'btn-ghost', onclick: () => { const prev = JSON.parse(JSON.stringify(BOARD)); BOARD = JSON.parse(JSON.stringify(BOARD_DEFAULT)); store.set('board:v1', BOARD); render(); toast('초기 분류로 되돌렸습니다', () => { BOARD = prev; store.set('board:v1', BOARD); render(); }); } }, '초기 분류'), h('button', { class: 'btn-dark', onclick: () => openDetail(useSummary()) }, `발표 근거 ${BOARD.use.length}개 보기`))), sums, colsEl,
    h('div', { class: 'board-foot' }, h('span', {}, '끌어서 이동 · Enter 상세 · ⌘/Ctrl+Z 되돌리기'), h('span', {}, `근거 카드 ${cards.length}개 · 수치 출처: 사업보고서 2026.03.18 등`)));
  paintSums(BOARD);
  enableBoardDrag(colsEl, cards, paintSums, byId);
  colsEl.addEventListener('keydown', (e) => { const c = e.target.closest('.bcard'); if (c && e.key === 'Enter') openDetail(byId(c.dataset.id).detail()); });
}
function useSummary() {
  const cards = boardCards(); const list = BOARD.use.map((id) => cards.find((c) => c.id === id));
  return { title: `발표에 쓸 근거 ${list.length}개`, sub: '분석 보드에서 채택한 카드', rows: list.map((c) => [c.title, c.value, `${c.cat} · ${c.meta} · 출처 ${c.src}`]), limits: ['분류는 발표자의 판단이며 수치 자체는 CSV 원자료 그대로입니다.', '각 카드를 눌러 계산식과 원문 출처를 확인하세요.'] };
}
function enableBoardDrag(colsEl, cards, paintSums, byId) {
  let d = null;
  const colOf = (el) => el?.closest?.('.bcol');
  const stateWith = (to, idx) => { const st = {}; COLS.forEach((c) => { st[c.id] = BOARD[c.id].filter((x) => x !== d.id); }); st[to].splice(Math.min(idx, st[to].length), 0, d.id); return st; };
  const indexIn = (list, y) => { const items = [...list.querySelectorAll('.bcard:not(.lifting)')]; let i = 0; for (const it of items) { const r = it.getBoundingClientRect(); if (y > r.top + r.height / 2) i++; } return { i, items }; };
  colsEl.addEventListener('pointerdown', (e) => {
    const card = e.target.closest('.bcard'); if (!card || e.button !== 0) return;
    d = { card, id: card.dataset.id, x0: e.clientX, y0: e.clientY, started: false, from: colOf(card).dataset.col, pid: e.pointerId };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true }); window.addEventListener('pointercancel', cancel, { once: true });
  });
  function start(e) {
    const r = d.card.getBoundingClientRect(); d.dx = e.clientX - r.left; d.dy = e.clientY - r.top;
    d.ghost = d.card.cloneNode(true); d.ghost.classList.add('ghost'); d.ghost.style.width = r.width + 'px'; d.ghost.style.left = '0px'; d.ghost.style.top = '0px'; document.body.append(d.ghost);
    d.ph = h('div', { class: 'bph', style: `height:${r.height}px` }); d.card.after(d.ph); d.card.classList.add('lifting');
    document.body.classList.add('dragging-card'); d.started = true; hideTip();
  }
  function move(e) {
    if (!d) return;
    if (!d.started) { if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return; start(e); }
    e.preventDefault();
    d.ghost.style.transform = `translate(${e.clientX - d.dx}px, ${e.clientY - d.dy}px) rotate(${Math.max(-3, Math.min(3, (e.movementX || 0) * 0.4))}deg)`;
    const under = document.elementFromPoint(e.clientX, e.clientY); const col = colOf(under);
    colsEl.querySelectorAll('.bcol').forEach((c) => c.classList.toggle('over', c === col));
    if (!col) return;
    const list = col.querySelector('.bcol-list'); const { i, items } = indexIn(list, e.clientY);
    if (items[i]) items[i].before(d.ph); else list.querySelector('.bcol-empty').before(d.ph);
    d.to = col.dataset.col; d.idx = i;
    const st = stateWith(d.to, d.idx); paintSums(st, { id: d.id });
    colsEl.querySelectorAll('.bcol').forEach((c) => { c.querySelector('.bcol-n').textContent = st[c.dataset.col].length; });
  }
  function finish(commit) {
    window.removeEventListener('pointermove', move);
    document.body.classList.remove('dragging-card'); colsEl.querySelectorAll('.over').forEach((c) => c.classList.remove('over'));
    if (!d.started) { const c = byId(d.id); d = null; openDetail(c.detail()); return; }
    const { ghost, ph, card } = d; const target = ph.getBoundingClientRect();
    const to = commit && d.to ? d.to : d.from; const prev = JSON.parse(JSON.stringify(BOARD));
    ghost.style.transition = 'transform .18s cubic-bezier(.2,.7,.2,1), box-shadow .18s'; ghost.style.transform = `translate(${target.left}px, ${target.top}px) rotate(0deg)`; ghost.classList.add('landing');
    const moved = { id: d.id, from: d.from, to };
    if (commit && d.to) { BOARD = stateWith(d.to, d.idx); store.set('board:v1', BOARD); }
    d = null;
    setTimeout(() => {
      ghost.remove(); ph.replaceWith(card); card.classList.remove('lifting');
      if (moved.to !== moved.from) {
        const c = byId(moved.id); const label = COLS.find((x) => x.id === moved.to).label;
        render(); requestAnimationFrame(() => document.querySelector(`.bcard[data-id="${moved.id}"]`)?.classList.add('just-moved'));
        toast(`‘${c.title}’ → ${label}`, () => { BOARD = prev; store.set('board:v1', BOARD); render(); });
      } else { render(); }
    }, 190);
  }
  function up() { if (d) finish(true); }
  function cancel() { if (d) finish(false); }
}

// =====================================================================
// 7. RENDER (페이지 전환·카드 편집)
// =====================================================================
function render() {
  paintFilters();
  const ws = $('#ws'); ws.replaceChildren(); hideTip();
  const page = h('div', { class: 'page' + (S.edit ? ' editing' : '') });
  page.append(h('div', { class: 'edit-banner' }, '편집 모드 — 카드를 끌어 순서를 바꾸세요. 이 모드에서는 차트 클릭이 꺼집니다.', h('button', { onclick: () => { store.set('order:' + S.page, null); render(); } }, '기본 배치로'), h('button', { onclick: () => { S.edit = false; render(); } }, '완료')));
  const F = FILTERS[S.page];
  if (F.company === 'SY' && S.company !== 'SY' && S.page !== 'board') {
    const what = { search: '검색 관심도(Google Trends·네이버)', supply: '원재료 단가·매입처·판매경로', timeline: '사건 연표' }[S.page] || '이 화면의 자료';
    page.querySelector('.edit-banner').remove();
    page.append(h('div', { class: 'nodata big' }, h('b', {}, `자료 없음 — 농심의 ${what}는 이번 전달본에 제공되지 않았습니다.`), h('p', {}, '01 지침: 신규 기업 선택 시 해당 기업의 데이터만 표시하고, 제공되지 않은 항목은 ‘자료 없음’으로 표시합니다. 삼양식품 자료를 농심 화면에 섞지 않습니다.'), h('button', { class: 'btn-ghost', onclick: () => { S.company = 'SY'; render(); } }, '삼양식품 자료 보기')));
    ws.append(page); return;
  }
  if (S.page === 'board') { page.querySelector('.edit-banner').remove(); if (S.company !== 'SY') page.append(h('p', { class: 'note warn', style: 'margin-bottom:10px' }, '분석 보드는 삼양식품 근거 카드로 고정되어 있습니다 (기업 선택 미적용).')); renderBoard(page); ws.append(page); return; }
  const P = PAGE[S.page]; const k = P.kpis(); if (k.length) page.append(h('div', { class: 'kpis' }, k));
  const cards = P.cards(); const order = store.get('order:' + S.page, null);
  if (order) cards.sort((a, b) => { const ia = order.indexOf(a.id), ib = order.indexOf(b.id); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  const grid = h('div', { class: 'grid' });
  cards.forEach((c) => {
    const val = (v) => (typeof v === 'function' ? v() : v);
    const body = h('div', { class: 'card-b' });
    const card = h('article', { class: `card w${c.w}` + (S.hl === c.id ? ' hl' : ''), id: c.id, draggable: S.edit ? 'true' : null, 'data-id': c.id },
      h('div', { class: 'card-h' }, h('div', {}, h('h3', {}, val(c.title)), c.sub ? h('p', {}, val(c.sub)) : null), c.detail ? h('button', { class: 'info', onclick: () => openDetail(c.detail()) }, '상세·출처') : null), body);
    grid.append(card); c.body(body);
  });
  if (S.edit) enableDrag(grid);
  page.append(grid); ws.append(page);
  if (S.hl) { const el = document.getElementById(S.hl); if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80); }
}
function enableDrag(grid) {
  let dragId = null;
  grid.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('dragstart', (e) => { dragId = card.dataset.id; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (err) { /* noop */ } });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); grid.querySelectorAll('.drop').forEach((x) => x.classList.remove('drop')); });
    card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('drop'); });
    card.addEventListener('dragleave', () => card.classList.remove('drop'));
    card.addEventListener('drop', (e) => { e.preventDefault(); card.classList.remove('drop'); const src = grid.querySelector(`[data-id="${dragId}"]`); if (!src || src === card) return; const cardsArr = [...grid.children]; if (cardsArr.indexOf(src) < cardsArr.indexOf(card)) card.after(src); else card.before(src); store.set('order:' + S.page, [...grid.children].map((x) => x.dataset.id)); });
  });
}

// =====================================================================
// 8. 데이터 질의 패널 — 규칙 기반 (AI 호출 없음)
//    답변 규칙: 사용한 행·산식·단위·기간·출처를 표시 / 데이터에 없으면 ‘미확인’ /
//    검색지수 인과를 단정하지 않음 / 회사 연결과 브랜드 보도값 구분 / 해외법인 합산 금지
// =====================================================================
const feed = $('#feed');
const tagRow = (a) => h('div', { class: 'ans-meta' }, h('span', { class: 'tag ' + (a.unknown ? 'unk' : 'calc') }, a.unknown ? '미확인' : 'CSV 계산'), a.co ? h('span', { class: 'tag' }, `기업: ${a.co}`) : null, h('span', { class: 'tag' }, `기간: ${a.year}`), a.unit ? h('span', { class: 'tag' }, `단위: ${a.unit}`) : null);
function addAnswer(a) {
  $('#feedEmpty')?.remove();
  const mini = a.chart ? h('div', { class: 'mini' }) : null;
  const card = h('div', { class: 'ans' + (a.error ? ' err' : '') + (a.unknown ? ' unk' : '') },
    h('div', { class: 'ans-q' }, a.q), tagRow(a),
    h('h4', {}, a.unknown ? '답변' : '핵심 결론'), h('div', { class: 'concl' }, a.conclusion),
    a.evidence?.length ? [h('h4', {}, '근거 수치'), h('table', { class: 'ev' }, h('tbody', {}, a.evidence.map(([l, v]) => h('tr', {}, h('td', {}, l), h('td', {}, v)))))] : null,
    a.formula?.length ? [h('h4', {}, '산식'), h('ul', { class: 'fx' }, a.formula.map((t) => h('li', {}, t)))] : null,
    a.used?.length ? [h('h4', {}, `사용한 데이터 행 (${a.used.length})`), h('details', {}, h('summary', {}, '파일 · 행 키 · 원값 보기'), h('table', { class: 'ev used' }, h('tbody', {}, a.used.map((u) => h('tr', {}, h('td', {}, `${u.file} · ${u.key}`), h('td', {}, u.raw)))))) ] : null,
    mini ? [h('h4', {}, '관련 차트'), mini] : null,
    a.company?.length ? [h('h4', {}, '확인된 회사 설명 (제공 문서)'), h('ul', {}, a.company.map((t) => h('li', {}, t)))] : null,
    a.interp?.length ? [h('h4', {}, '해석 (제공 문서 문구)'), h('ul', {}, a.interp.map((t) => h('li', {}, t)))] : null,
    a.sources?.length ? [h('h4', {}, '출처'), h('ul', { class: 'src' }, uniqSrc(a.sources).map((s) => h('li', {}, s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.label) : s.label)))] : null,
    a.limits?.length ? [h('h4', {}, '해석 한계'), h('ul', { class: 'limits' }, a.limits.map((t) => h('li', {}, t)))] : null,
    a.goto ? h('button', { class: 'go', onclick: () => a.goto() }, '관련 화면 다시 보기 →') : null);
  feed.prepend(card); feed.scrollTop = 0;
  if (mini) a.chart(mini);
  return card;
}

// ---------- 질문 해석 ----------
const QM = [ // 순서 중요: 긴 표현 먼저
  { re: /매출채권\s*회전율/, k: 'receivables_turnover', t: 'turn', l: '매출채권회전율', num: 'revenue', den: 'receivables' },
  { re: /재고\s*회전율/, k: 'inventory_turnover', t: 'turn', l: '재고회전율', num: 'cost_of_sales', den: 'inventory' },
  { re: /영업\s*이익률|이익률/, k: 'operating_margin_pct', t: 'ratio', l: '영업이익률', num: 'operating_profit', den: 'revenue' },
  { re: /매출\s*원가율|원가율/, k: 'cost_ratio_pct', t: 'ratio', l: '매출원가율', num: 'cost_of_sales', den: 'revenue' },
  { re: /판관비율|판매비와관리비율/, k: 'sga_ratio_pct', t: 'ratio', l: '판관비율', num: 'sga', den: 'revenue' },
  { re: /부채\s*비율/, k: 'debt_equity_pct', t: 'ratio', l: '부채비율', num: 'total_liabilities', den: 'equity' },
  { re: /유동\s*비율/, k: 'current_ratio_pct', t: 'ratio', l: '유동비율', num: 'current_assets', den: 'current_liabilities' },
  { re: /영업\s*활동\s*현금\s*흐름|영업\s*현금\s*흐름|영업\s*현금/, k: 'operating_cashflow', t: 'won', l: '영업활동현금흐름' },
  { re: /유형자산\s*취득|설비\s*투자|capex/i, k: 'ppe_purchase_outflow', t: 'won', l: '유형자산 취득' },
  { re: /법인세/, k: 'tax_paid_outflow', t: 'won', l: '법인세 납부' },
  { re: /영업\s*이익/, k: 'operating_profit', t: 'won', l: '영업이익' },
  { re: /매출\s*원가/, k: 'cost_of_sales', t: 'won', l: '매출원가' },
  { re: /판관비|판매비/, k: 'sga', t: 'won', l: '판매비와관리비' },
  { re: /재고\s*자산|재고/, k: 'inventory', t: 'won', l: '재고자산' },
  { re: /매출\s*채권/, k: 'receivables', t: 'won', l: '매출채권' },
  { re: /유동\s*자산/, k: 'current_assets', t: 'won', l: '유동자산' },
  { re: /유동\s*부채/, k: 'current_liabilities', t: 'won', l: '유동부채' },
  { re: /자산\s*총계|총\s*자산/, k: 'total_assets', t: 'won', l: '자산총계' },
  { re: /부채\s*총계|총\s*부채/, k: 'total_liabilities', t: 'won', l: '부채총계' },
  { re: /자본\s*총계|자기\s*자본/, k: 'equity', t: 'won', l: '자본총계' },
  { re: /매출액|매출/, k: 'revenue', t: 'won', l: '매출액' },
];
const Q_EXAMPLES = ['2025년 두 회사 영업이익률은?', '2024년 대비 삼양 2025 매출 증가율은?', '2025 밀양 면류 가동률은?', '삼양 2025 영업현금흐름은 왜 줄었어?', '농심 2024 3분기 영업이익은?', '2025 미국법인 매출은?', '국내와 해외 검색 최고점은 언제야?'];
function parseQ(q) {
  const t = q.replace(/\s+/g, ' ');
  const years = [...new Set([...t.matchAll(/(20(2[2-6]))\s*년?/g)].map((m) => +m[1]))];
  const both = /두\s*회사|양사|둘\s*다|두\s*기업|양\s*기업/.test(t) || (/삼양|불닭/.test(t) && /농심|신라면/.test(t));
  const cos = both ? ['SY', 'NS'] : /농심|신라면/.test(t) ? ['NS'] : /삼양|불닭/.test(t) ? ['SY'] : [S.company];
  const qm = t.match(/([1-4])\s*분기|Q\s*([1-4])/i); const quarter = qm ? +(qm[1] || qm[2]) : null;
  const metrics = []; let rest = t;
  for (const d of QM) { const m = rest.match(d.re); if (m) { metrics.push(d); rest = rest.replace(d.re, ' '); } }
  return { t, years, cos, quarter, metrics, growth: /증가율|성장률|증감|변화|늘었|줄었|감소율|대비|전년/.test(t), why: /왜|원인|이유|때문/.test(t) };
}
const QSRC = (c, y, ms) => finSources(c, y, ms, ['total_assets', 'total_liabilities', 'equity', 'current_assets', 'current_liabilities', 'inventory', 'receivables'].includes(ms[0]) ? 'bs' : ['operating_cashflow', 'ppe_purchase_outflow', 'tax_paid_outflow'].includes(ms[0]) ? 'cf' : 'pl');
const usedFin = (c, y, m) => { const r = finRow(y, m, c); return r ? { file: 'financials.csv', key: `${c}|${y}|${m}`, raw: `${r.v === null ? '(빈 값)' : fmt(r.v, 0) + ' 원'} · audit ${r.audit.join(',') || '—'}` } : { file: 'financials.csv', key: `${c}|${y}|${m}`, raw: '행 없음' }; };
const unknownAns = (q, why) => ({ q, unknown: true, year: '-', conclusion: `미확인 — ${why}`, evidence: [['지원하는 질문', '기업(삼양·농심) · 연도 2023~2025 · 분기 · 매출/영업이익/이익률/원가율/판관비율/부채비율/유동비율/영업현금흐름/유형자산 취득/법인세/회전율 · 성장률·%p 변화 · 가동률 · 삼양 해외법인 · 검색 최고점 · 브랜드 보도값']], limits: ['데이터에 없는 수치를 추정하거나 만들지 않습니다.', '자유형 AI 답변은 연동되어 있지 않습니다 (01 지침 4절).'] });
function answer(q) {
  const P = parseQ(q); const t = P.t;
  if (/오뚜기/.test(t)) return unknownAns(q, '오뚜기 재무·검색 자료는 이번 전달본에 없습니다.');
  if (/주가|주식|시가총액|PER|DART/i.test(t)) return unknownAns(q, '주가 연동과 DART 자동 조회는 이번 기본 구현 범위에서 분리했습니다.');
  if (P.years.some((y) => y > 2025)) return unknownAns(q, '분석기간은 2023~2025년입니다. 2026년 이후 실적 자료는 없습니다.');
  // 가동률
  if (/가동률/.test(t)) return ansUtil(q, P);
  // 검색
  if (/검색|관심도|트렌드|구글|네이버/.test(t)) return ansSearch(q, P);
  // 브랜드
  if (/브랜드/.test(t)) return ansBrand(q, P);
  // 해외법인 (삼양) / 지역 (농심)
  if (/법인|미국|중국|일본|인도네시아|유럽|해외|지역/.test(t) && !P.metrics.some((m) => m.k !== 'revenue')) return ansOverseas(q, P);
  if (!P.metrics.length) return unknownAns(q, '질문에서 지표(매출·영업이익·영업이익률 등)를 찾지 못했습니다.');
  if (P.quarter) return ansQuarter(q, P);
  return ansFin(q, P);
}
function ansFin(q, P) {
  const m = P.metrics[0]; const ys = P.years.length ? P.years : [S.year];
  let target = Math.max(...ys); let base = ys.length > 1 ? Math.min(...ys) : target - 1;
  if (target < 2023) return unknownAns(q, '2022년은 성장률·평균잔액 계산용 비교기준이며 분석 연도(2023~2025)가 아닙니다.');
  const growthMode = P.growth || ys.length > 1;
  const val = (c, y) => (m.t === 'won' ? fin(y, m.k, c) : m.t === 'ratio' ? (fin(y, m.den, c) ? (fin(y, m.num, c) / fin(y, m.den, c)) * 100 : null) : met(y, m.k, c));
  const show = (v) => (m.t === 'won' ? eok(eokW(v)) : m.t === 'ratio' ? pct(v) : `${fmt(v, 2)}회`);
  const ev = []; const used = []; const parts = [];
  P.cos.forEach((c) => {
    const a = val(c, target), b = val(c, base);
    ev.push([`${coName(c)} ${target} ${m.l}`, show(a)]);
    if (growthMode) { ev.push([`${coName(c)} ${base} ${m.l}`, show(b)]); }
    const d = m.t === 'won' ? growth(a, b) : pp(a, b);
    if (growthMode) ev.push([`${coName(c)} ${base}→${target} ${m.t === 'won' ? '증가율' : '변화'}`, m.t === 'won' ? signed(d, '%') : m.t === 'ratio' ? signed(d, '%p') : signed(d, '회', 2)]);
    if (m.t !== 'turn') { const ks = m.t === 'won' ? [m.k] : [m.num, m.den]; (growthMode ? [base, target] : [target]).forEach((y) => ks.forEach((k) => used.push(usedFin(c, y, k)))); }
    else { used.push({ file: 'calculated_metrics.csv', key: `${c}|${target}|${m.k}`, raw: String(metRow(target, c)?.[m.k] ?? '(없음)') }); if (growthMode) used.push({ file: 'calculated_metrics.csv', key: `${c}|${base}|${m.k}`, raw: String(metRow(base, c)?.[m.k] ?? '(없음)') }); }
    if (m.t === 'ratio') used.push({ file: 'calculated_metrics.csv', key: `${c}|${target}|${m.k}`, raw: `${metRow(target, c)?.[m.k] ?? '(없음)'} (대조: 원값 재계산과 일치 ${Math.abs((met(target, m.k, c) ?? NaN) - a) < 1e-9 ? '✓' : '확인 필요'})` });
    parts.push(growthMode ? `${coName(c)} ${m.l}은 ${base}년 ${show(b)}에서 ${target}년 ${show(a)}로 ${m.t === 'won' ? signed(d, '%') : m.t === 'ratio' ? signed(d, '%p') : signed(d, '회', 2)} 변했습니다` : `${coName(c)} ${target}년 ${m.l}은 ${show(a)}입니다`);
  });
  const formula = m.t === 'won' ? ['억원 = 원 ÷ 100,000,000 (표시만 반올림)', ...(growthMode ? ['증가율 = (당기 ÷ 전기 − 1) × 100'] : [])] : m.t === 'ratio' ? [`${m.l} = ${finRow(target, m.num, P.cos[0])?.label} ÷ ${finRow(target, m.den, P.cos[0])?.label} × 100`, ...(growthMode ? ['비율 변화 = 당기 − 전기 (%p)'] : [])] : [m.k === 'inventory_turnover' ? '재고회전율 = 매출원가 ÷ 기초·기말 평균 재고' : '매출채권회전율 = 매출액 ÷ 기초·기말 평균 매출채권'];
  const company = P.why && P.cos.includes('SY') ? (['revenue', 'operating_profit', 'operating_margin_pct', 'cost_ratio_pct'].includes(m.k) ? [DOC.company] : ['operating_cashflow', 'tax_paid_outflow'].includes(m.k) ? [DOC.cash1, DOC.cash2] : []) : [];
  const limits = [...P.cos.map((c) => LIMIT_CONSOL_OF(c)), ...(P.cos.length > 1 ? [CMP_LIMITS[0]] : []), ...(P.cos.includes('NS') ? [LIMIT_NSNEW] : []), ...(P.why ? ['원인은 수치만으로 확정하지 않습니다. 회사 설명이 있으면 그대로 인용하고, 각 요인의 기여액은 측정되지 않았습니다.'] : []), ...(base === 2022 ? ['2022년 값은 성장률 계산용 비교기준입니다.'] : [])];
  const goto = () => (P.cos.length > 1 ? go('compare', { year: target, hl: 'cp-table' }) : go(['operating_cashflow', 'ppe_purchase_outflow', 'tax_paid_outflow', 'debt_equity_pct', 'current_ratio_pct', 'inventory_turnover', 'receivables_turnover', 'inventory', 'receivables'].includes(m.k) ? 'performance' : 'overview', { year: target, company: P.cos[0] }));
  goto();
  return { q, co: P.cos.map(coName).join(' · '), year: growthMode ? `${base} → ${target}` : String(target), unit: m.t === 'won' ? '억원 (원자료 원)' : m.t === 'ratio' ? '%' : '회', conclusion: parts.join('. ') + '.', evidence: ev, used, formula, company, limits, sources: P.cos.flatMap((c) => QSRC(c, target, m.t === 'ratio' ? [m.num, m.den] : [m.k])), goto,
    chart: P.cos.length > 1 || growthMode ? (el) => miniBars(el, P.cos.flatMap((c) => (growthMode ? [base, target] : [target]).map((y) => { const v = val(c, y); return { label: `${COMPANIES[c].short} ${y}`, v: m.t === 'won' ? eokW(v) : v, text: show(v), color: y === target ? COMPANIES[c].color : COMPANIES[c].soft }; }))) : null };
}
function ansQuarter(q, P) {
  const m = P.metrics[0]; const map = { revenue: 'revenue', cost_of_sales: 'cost', sga: 'sga', operating_profit: 'op', operating_margin_pct: 'margin' };
  if (!map[m.k]) return unknownAns(q, `분기 자료에는 매출·매출원가·판관비·영업이익·영업이익률만 있습니다 (‘${m.l}’ 분기값 없음).`);
  const y = P.years.length ? Math.max(...P.years) : S.year; if (y < 2023) return unknownAns(q, '분기 자료는 2023-Q1~2025-Q4입니다 (2022 분기 미수록).');
  const ev = []; const used = []; const parts = [];
  P.cos.forEach((c) => { const r = QALL.find((x) => x.c === c && x.year === y && x.quarter === P.quarter); const p = QALL.find((x) => x.c === c && x.year === y - 1 && x.quarter === P.quarter); const k = map[m.k]; const show = (v) => (k === 'margin' ? pct(v) : eok(eokW(v)));
    ev.push([`${coName(c)} ${r.period} ${m.l}`, show(r[k])]); if (p) ev.push([`전년 동기 (${p.period})`, `${show(p[k])} · ${k === 'margin' ? signed(pp(r[k], p[k]), '%p') : signed(growth(r[k], p[k]), '%')}`]);
    used.push({ file: 'quarterly_financials.csv', key: `${c}|${y}|${P.quarter}`, raw: `revenue ${fmt(r.revenue, 0)} · cost ${fmt(r.cost, 0)} · sga ${fmt(r.sga, 0)} · op ${fmt(r.op, 0)} 원 · ${r.method}` });
    parts.push(`${coName(c)} ${r.period} ${m.l}은 ${show(r[k])}입니다${p ? ` (전년 동기 대비 ${k === 'margin' ? signed(pp(r[k], p[k]), '%p') : signed(growth(r[k], p[k]), '%')})` : ''}`); });
  const goto = () => go(P.cos.length > 1 ? 'compare' : 'performance', { year: y, period: 'quarter', company: P.cos[0] }); goto();
  return { q, co: P.cos.map(coName).join(' · '), year: `${y}-Q${P.quarter}`, unit: m.k === 'operating_margin_pct' ? '%' : '억원 (원자료 원)', conclusion: parts.join('. ') + '.', evidence: ev, used, formula: ['단일 3개월 손익: Q1 = 반기 누적 − Q2 · Q3 = 9개월 − 반기 · Q4 = 연간 − 9개월', '전년 동기 대비 = (당분기 ÷ 전년 같은 분기 − 1) × 100'], limits: ['Q4는 결산조정이 포함된 잔여 분기입니다.', ...(P.cos.includes('NS') ? ['농심 분기값은 공시 원문 기반 신규 계산 상태입니다.'] : [])], sources: P.cos.flatMap((c) => { const r = QALL.find((x) => x.c === c && x.year === y && x.quarter === P.quarter); return [srcFrom(r.source), ...auditSources(r.audit)]; }), goto };
}
function ansUtil(q, P) {
  const y = P.years.length ? Math.max(...P.years) : S.year; const t = P.t;
  if (P.cos.includes('NS') && P.cos.length === 1) {
    const ents = [...new Set(NSUTIL.map((r) => r.entity))].filter((e) => t.includes(e) || t.includes(e.replace('농심', '')));
    const rs = NSUTIL.filter((r) => r.year === y && (ents.length ? ents.includes(r.entity) : true));
    if (!rs.length) return unknownAns(q, `${y}년 해당 농심 가동률 행을 찾지 못했습니다.`);
    const goto = () => go('production', { year: y, company: 'NS' }); goto();
    return { q, co: '농심', year: String(y), unit: '%', conclusion: rs.map((r) => `${r.entity}(${r.scope}) ${pct(r.util)}${r.bad ? ' — 원문 내부 산식 불일치, 비교 제외' : ''}`).join(', ') + '.', evidence: rs.map((r) => [`${r.entity} 공시 가동률`, `${pct(r.util)} (시간 재계산 ${pct(r.recalc, 2)})`]), used: rs.map((r) => ({ file: 'nongshim_utilization.csv', key: `NS|${r.year}|${r.entity}`, raw: `${r.avail}h / ${r.actual}h · 공시 ${r.util}% · ${r.status}` })), formula: ['공시 가동률 그대로 사용 · 시간 재계산 = 실가동 ÷ 가동가능 × 100 (참고)'], limits: NS_UTIL_LIMIT, sources: [...new Set(rs.map((r) => r.source))].map(regSrc), goto };
  }
  const plant = PLANTS.find((p) => { const [f, pr] = p.split(' '); return t.includes(f) && (t.includes(pr) || (pr === '조미소스소재' && /소스/.test(t)) || (pr === '면류' && /면/.test(t))); }) || PLANTS.find((p) => t.includes(p.split(' ')[0]));
  const rs = PROD.filter((p) => p.year === y && (plant ? p.plant === plant : true));
  const goto = () => go('production', { year: y, company: 'SY', hlPlant: plant || null, hl: 'pd-util' }); goto();
  const rows = rs.map((r) => [`${r.plant} ${y}`, r.util === null ? `데이터 없음 (${r.note})` : pct(r.util, 2)]);
  if (plant) { const p = PROD.find((x) => x.plant === plant && x.year === y - 1); if (p) rows.push([`${plant} ${y - 1}`, p.util === null ? '데이터 없음' : `${pct(p.util, 2)} · 변화 ${signed(pp(rs[0]?.util ?? null, p.util), '%p')}`]); }
  return { q, co: '삼양식품', year: String(y), unit: '% (공시 시간가동률)', conclusion: plant ? `${plant} ${y}년 공시 가동률은 ${pct(rs[0]?.util ?? null, 1)}입니다.${y === 2025 ? ' 2025년은 하반기 밀양2공장 가동과 산정기준 변경이 있어 전년과 단순 비교하지 않습니다.' : ''}` : `${y}년 공장·품목별 공시 가동률입니다.`, evidence: rows, used: rs.map((r) => ({ file: 'production.csv', key: `SY|${r.year}|${r.factory}|${r.product}`, raw: `capacity ${r.cap ?? '(빈 값)'} · production ${r.prod ?? '(빈 값)'} 백만원 · util ${r.util ?? '(빈 값)'}%` })), formula: ['가동률은 공시값 그대로 (생산금액 ÷ 능력금액으로 다시 계산하지 않음)'], company: P.why && plant === '밀양 면류' ? ['사업보고서 p.18~19: 제65기 하반기부터 밀양2공장 가동, 밀양공장(면류) 생산능력·생산실적 산정기준 변경, 공장별 가동가능시간 산정 기준 변경.'] : [], limits: [...LIMIT_PROD, ...(P.why ? ['공시만으로 가동률 하락 원인을 확정할 수 없습니다.'] : [])], sources: [SRC.prod, SRC.ar2024, SRC.sr2023], goto };
}
function ansSearch(q, P) {
  if (P.cos.length === 1 && P.cos[0] === 'NS') return unknownAns(q, '농심 검색 관심도 자료는 이번 전달본에 없습니다.');
  const goto = () => go('search', { company: 'SY', hl: 'sr-peaks' }); goto();
  return { q, co: '삼양식품(불닭)', year: '2023-01 ~ 2025-12', unit: '상대지수 (기간 최고 = 100)', conclusion: `각 지역의 최고점은 Google 전 세계 ${peakOf('Worldwide').month}, 미국 ${peakOf('US').month}, 네이버 국내 ${peakOf('KR').month}입니다. 플랫폼·검색어가 달라 지수 크기는 비교하지 않고 시기만 비교합니다.${P.why ? ' 최고점의 원인은 확인되지 않았습니다(같은 시기 보도는 인과 근거가 아님).' : ''}`,
    evidence: Object.keys(REGIONS).map((rg) => [`${REGIONS[rg]} 최고점`, `${peakOf(rg).month} (${REGION_DESC[rg]})`]), used: Object.keys(REGIONS).map((rg) => ({ file: 'search_monthly.csv', key: `${rg}|${peakOf(rg).month}`, raw: `index ${peakOf(rg).v}` })), formula: ['각 지역 36개월 중 최댓값 = 100인 달'],
    company: P.why ? ['해외: 한국경제 2025-08-03 보도(K팝 데몬 헌터스와 라면 검색 관심 증가)가 있으나 주간 유튜브 기준이라 월간 웹검색 최고점의 원인으로 확정할 수 없습니다 (03 문서 6절).', '국내 2025-02: 실적 발표·소스 캠페인 시기를 검토했으나 직접 연결 자료를 확인하지 못했습니다.'] : [], limits: LIMIT_SEARCH, sources: [SRC.google, SRC.naver, ...(P.why ? [SRC.hk] : [])], goto };
}
function ansBrand(q, P) {
  if (P.cos.length === 1 && P.cos[0] === 'NS') return unknownAns(q, '농심 브랜드 매출 자료는 이번 전달본에 없습니다.');
  const goto = () => go('performance', { company: 'SY', hl: 'pf-brand' }); goto();
  if (/이익/.test(P.t)) return { q, unknown: true, co: '삼양식품(불닭)', year: '2023–2025', conclusion: '미확인 — 불닭 브랜드 영업이익은 공개 자료에서 확인되지 않았습니다. 회사 전체나 면스낵 부문 이익으로 대체하지 않습니다.', limits: ['확정하려면 회사의 브랜드별 손익 공개 또는 IR 회신이 필요합니다 (03 문서 5절).'], sources: [SRC.verify02], goto };
  return { q, co: '삼양식품(불닭 브랜드)', year: '2023–2025', unit: '억원 (보도값)', conclusion: `불닭 브랜드/시리즈 국내외 매출 보도값은 ${BRAND.map((b) => `${b.year} 약 ${fmt(b.rev, 0)}억원`).join(', ')}입니다. 언론보도 근사값이며 감사받은 회사 연결매출이 아닙니다.`, evidence: BRAND.map((b) => [`${b.year} 보도값`, `약 ${fmt(b.rev, 0)}억원`]), used: BRAND.map((b) => ({ file: 'brand_sales.csv', key: `SY|${b.year}`, raw: `${b.rev} 억원 (KRW_100million)` })), limits: ['연도별 집계 범위 동일성 미확인 → 성장률을 확정 비교값으로 쓰지 않습니다.', '회사 연결매출 대비 비중·브랜드 이익률을 계산하지 않습니다.'], sources: BRAND.map((b) => srcFrom(b.source)), goto };
}
function ansOverseas(q, P) {
  const y = P.years.length ? Math.max(...P.years) : S.year; const t = P.t;
  if (P.cos.length === 1 && P.cos[0] === 'NS') {
    const rgs = NSREGIONS.filter((r) => t.includes(r)); const rs = NSREG.filter((r) => r.year === y && (rgs.length ? rgs.includes(r.region) : true));
    const goto = () => go('market', { year: y, company: 'NS' }); goto();
    if (!rs.length) return unknownAns(q, `${y}년 농심 해당 지역 행이 없습니다${rgs.includes('유럽') ? ' (유럽은 2025년 행만 있음)' : ''}.`);
    return { q, co: '농심', year: String(y), unit: '억원 (원자료 천원)', conclusion: `농심 ${y}년 사업지역별 외부고객 수익: ${rs.map((r) => `${r.region} ${eok(eokK(r.v))}`).join(', ')}. 개별 해외법인 매출이 아니라 지역 영업부문 기준입니다.`, evidence: rs.map((r) => [r.region, eok(eokK(r.v))]), used: rs.map((r) => ({ file: 'nongshim_region_revenue.csv', key: `NS|${r.year}|${r.region}`, raw: `${fmt(r.v, 0)} 천원 · audit ${r.audit.join(',')}` })), formula: ['억원 = 천원 ÷ 100,000'], limits: [...LIMIT_NSREG, '농심 개별 해외법인 매출은 이번 전달본에 없습니다.'], sources: auditSources(rs.flatMap((r) => r.audit)), goto };
  }
  const ents = ENTITIES.filter((e) => t.includes(e)); const rs = FE.filter((f) => f.year === y && (ents.length ? ents.includes(f.entity) : true));
  const goto = () => go('market', { year: y, company: 'SY', entity: ents.length === 1 ? ents[0] : 'all', hl: 'mk-fe3' }); goto();
  return { q, co: '삼양식품', year: String(y), unit: '억원 (원자료 천원, 원화 환산)', conclusion: `${y}년 삼양 해외 판매법인 매출(원화 환산): ${rs.map((f) => `${f.entity} ${f.rev === null ? '설립 전' : eok(eokK(f.rev))}${f.growth !== null ? ` (${signed(f.growth, '%')})` : ''}`).join(', ')}. 연결 내부거래 제거 전 값이라 연결매출에 더하지 않습니다.`,
    evidence: rs.map((f) => [`${f.entity} ${y}`, f.rev === null ? '설립 전 (0 아님)' : eok(eokK(f.rev))]).concat(ents.map((e) => { const l = FEL.find((x) => x.entity === e); return l && y === 2025 ? [`${e} 2025 현지통화 (설명값)`, `${l.rev} ${l.unit.replace('_', ' ')}${l.growth !== null ? ` · ${pct(l.growth)}` : ''}`] : null; }).filter(Boolean)),
    used: rs.map((f) => ({ file: 'foreign_entities.csv', key: `SY|${f.year}|${f.entity}`, raw: `${f.rev === null ? '(빈 값)' : fmt(f.rev, 0) + ' 천원'} · audit ${f.audit.join(',')}` })), formula: ['억원 = 천원 ÷ 100,000', '원화 성장률 = (당기 ÷ 전기 − 1) × 100 (환율 영향 포함)'], company: ents.flatMap((e) => FE_DOC[e] || []), limits: LIMIT_FE, sources: [...new Set(rs.map((f) => f.source))].map(srcFrom).concat([SRC.local]), goto };
}
// 예시 질문 (01 지침 4절의 3개 + 기존 추천 질문)
Q_EXAMPLES.forEach((qq) => $('#chips').append(h('button', { class: 'chip', onclick: () => ask(qq) }, qq)));
function ask(q) { try { addAnswer({ q, ...answer(q) }); } catch (e) { console.error(e); addAnswer({ q, unknown: true, year: '-', conclusion: '미확인 — 계산 중 오류가 발생했습니다. 질문을 바꿔 다시 시도하세요.', error: true }); } }
$('#qaForm').addEventListener('submit', (e) => { e.preventDefault(); const q = $('#qaInput').value.trim(); if (!q) return; ask(q); $('#qaInput').value = ''; });
$('#qaInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#qaForm').requestSubmit(); } });

// 첫 화면
if (innerWidth < 1100) S.panel = innerWidth < 860; // 좁은 PC는 패널 접힘, 모바일은 아래로 펼침
paintPanel(); render();
window.__app = { S, go, render, R, fin, met, QALL, FE, PROD, SEARCH, answer, parseQ, auditStatus };
})();
