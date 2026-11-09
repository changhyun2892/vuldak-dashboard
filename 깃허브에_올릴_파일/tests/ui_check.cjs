/*
 * 화면 동작 점검 (01_수정_구현지침 '완료 확인'의 화면 항목)
 *
 *   1) 이 폴더에서 정적 서버 실행:  py -m http.server 8000
 *   2) 다른 터미널에서:             npm i -D playwright && npx playwright install chromium
 *                                   node tests/ui_check.cjs            (주소 기본값 http://localhost:8000/)
 *
 * 화면을 바꾸지 않고 읽기·클릭만 합니다. 실패 항목이 있으면 종료 코드 1.
 */
const { chromium, devices } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8000/';
const out = [];
const check = (name, ok, detail = '') => out.push([ok ? '통과' : '실패', name, detail]);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.kpi', { timeout: 15000 });
  const kpiText = () => page.$$eval('#ws .kpi', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')));
  const setState = (o, pg) => page.evaluate(([o, pg]) => { Object.assign(window.__app.S, o); window.__app.go(pg); }, [o, pg]);
  const clickSeg = async (sel, label) => { await page.click(`${sel} button:has-text("${label}")`); await page.waitForTimeout(150); };

  // 1. 기본: 삼양 2025
  let k = await kpiText();
  check('기본 화면 = 삼양식품 2025', /23,517\.9/.test(k[0]) && /5,241\.9/.test(k[1]) && /22\.3/.test(k[2]) && /84\.6/.test(k[3]), k.slice(0, 4).join(' | '));
  // 2. 기업 전환 (버튼 클릭)
  await clickSeg('#fCo', '농심'); k = await kpiText();
  check('기업 전환 → 농심 2025 매출·영업이익', /35,143\.2/.test(k[0]) && /1,839\.3/.test(k[1]), k.slice(0, 2).join(' | '));
  check('농심 면스낵 수출 비중 = 비교 불가(사유 표시)', /비교 불가/.test(k[3]), k[3]);
  // 3. 연도 전환
  await clickSeg('#fCo', '삼양식품'); await clickSeg('#fYear', '2023'); k = await kpiText();
  check('연도 전환 → 삼양 2023 매출 11,929.1억', /11,929\.1/.test(k[0]), k[0]);
  await clickSeg('#fYear', '2024'); k = await kpiText();
  check('연도 전환 → 삼양 2024 매출 17,280.2억', /17,280\.2/.test(k[0]), k[0]);
  await clickSeg('#fYear', '2025');
  // 4. 분기 전환
  await clickSeg('#fPeriod', '분기');
  const qTitle = await page.textContent('#ov-trend h3');
  check('연간/분기 전환 → 분기 차트', /분기/.test(qTitle), qTitle);
  await setState({ period: 'quarter' }, 'performance');
  const qNote = await page.textContent('#pf-table .note');
  check('삼양 4개 분기 합 = 연간 (화면 계산)', (qNote.match(/✓/g) || []).length === 3, qNote);
  await setState({ company: 'NS', period: 'quarter' }, 'performance');
  const qNoteNS = await page.textContent('#pf-table .note');
  check('농심 4개 분기 합 = 연간 (화면 계산)', (qNoteNS.match(/✓/g) || []).length === 3, qNoteNS);
  await setState({ company: 'SY', period: 'annual' }, 'overview');
  // 5. 미확인 값 (0으로 그리지 않음)
  await setState({ company: 'SY', year: 2023 }, 'production');
  const capTbl = await page.textContent('#pd-cap');
  check('밀양 조미소스소재 2023 = 데이터 없음', /데이터 없음/.test(capTbl));
  await setState({ company: 'SY', year: 2023 }, 'market');
  const fe = await page.textContent('#mk-fe3');
  check('유럽법인 2023 = 설립 전', /설립 전/.test(fe));
  await setState({ company: 'NS', year: 2025 }, 'search');
  const ns = await page.textContent('#ws');
  check('농심 검색 화면 = 자료 없음', /자료 없음/.test(ns));
  // 6. 출처 버튼 → 출처·검증 기록
  await setState({ company: 'NS', year: 2025 }, 'overview');
  await page.click('#ov-trend .info'); await page.waitForSelector('.sheet');
  const sheet = await page.textContent('.sheet');
  check('출처 버튼 → 출처 링크와 검증 기록 표시', /출처/.test(sheet) && /검증 기록/.test(sheet) && (await page.$$('.sheet .src-list a')).length > 0);
  await page.keyboard.press('Escape');
  await setState({ company: 'SY', year: 2025 }, 'performance');
  await page.click('#pf-brand .info'); await page.waitForSelector('.sheet');
  check('브랜드 보도값 별도 설명(배지)', /언론보도 기준·근사값/.test(await page.textContent('.sheet')));
  await page.keyboard.press('Escape');
  await setState({ company: 'SY' }, 'sources');
  check('2026 가격 표본 별도 설명', /2026 조회 표본/.test(await page.textContent('#so-price')));
  // 7. 비교 화면 · 상해농심 배지
  await setState({ year: 2025 }, 'compare');
  const cmp = await page.textContent('#cp-table');
  check('기업 비교표 2025 (삼양 22.3% / 농심 5.2%)', /22\.3%/.test(cmp) && /5\.2%/.test(cmp));
  await setState({ company: 'NS', year: 2024 }, 'production');
  check('농심 2024 상해농심 확인 필요 배지', /확인 필요/.test(await page.textContent('#pd-ns-tbl')));
  // 8. 데이터 질의 (01 지침 4절 예시)
  const ask = async (q) => { await page.fill('#qaInput', q); await page.press('#qaInput', 'Enter'); await page.waitForTimeout(200); return page.textContent('#feed .ans:first-child'); };
  let a = await ask('2025년 두 회사 영업이익률은?');
  check('질의: 2025년 두 회사 영업이익률', /22\.3%/.test(a) && /5\.2%/.test(a) && /사용한 데이터 행/.test(a) && /산식/.test(a));
  a = await ask('2024년 대비 삼양 2025 매출 증가율은?');
  check('질의: 2024→2025 삼양 매출 증가율 +36.1%', /\+36\.1%/.test(a));
  a = await ask('2025 밀양 면류 가동률은?');
  check('질의: 2025 밀양 면류 가동률 54.6%', /54\.6%/.test(a) && /산정기준/.test(a));
  a = await ask('오뚜기 2025 매출은?');
  check('질의: 데이터에 없는 질문 → 미확인', /미확인/.test(a));
  a = await ask('검색 최고점은 왜 생겼어?');
  check('질의: 검색 원인 → 인과 단정 안 함', /원인은 확인되지 않았습니다|인과/.test(a));
  // 9. 모든 화면 × 두 기업 오류 없음
  const pages = await page.$$eval('.nav-btn', (b) => b.map((x) => x.dataset.page));
  for (const c of ['SY', 'NS']) for (const pg of pages) await setState({ company: c, year: 2025, period: 'annual' }, pg);
  check(`전체 화면(${pages.length}개 × 2개 기업) 콘솔 오류 없음`, errors.length === 0, errors.slice(0, 3).join(' / '));
  await browser.close();

  // 10. 모바일 (iPhone 13, 390px)
  const b2 = await chromium.launch(); const ctx = await b2.newContext({ ...devices['iPhone 13'] }); const m = await ctx.newPage();
  await m.goto(URL, { waitUntil: 'networkidle' }); await m.waitForSelector('.kpi');
  const over = [];
  for (const pg of pages) { await m.evaluate((pg) => window.__app.go(pg), pg); await m.waitForTimeout(250); const w = await m.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]); if (w[0] > w[1] + 1) over.push(`${pg} ${w[0]}>${w[1]}`); }
  check('모바일 390px: 모든 화면 가로 넘침 없음', over.length === 0, over.join(', '));
  await m.evaluate(() => window.__app.go('overview')); await (await m.$$('#ws .kpi'))[0].click(); await m.waitForSelector('.sheet');
  check('모바일: 상세 시트 열림', !!(await m.$('.sheet')));
  await b2.close();

  const w = Math.max(...out.map((r) => r[1].length));
  out.forEach(([s, n, d]) => console.log(`[${s}] ${n.padEnd(w)}  ${d}`));
  const fails = out.filter((r) => r[0] === '실패').length;
  console.log(`\n통과 ${out.length - fails} · 실패 ${fails}`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
