# 불닭 경영분석 대시보드 (2026-11 수정판 · 주가·DART 자동 업데이트)

삼양식품(불닭)과 농심의 2023~2025년 연결 재무, 사업·해외, 생산, 공급사슬, 검색 관심도, 사건 연표를 보는 **정적 웹 대시보드**입니다.
데이터는 `data/` 폴더의 CSV를 그대로 읽습니다. 서버·로그인·AI 호출은 없습니다. 경영학 수업용 분석이며 투자 추천이 아닙니다.

- 기준 자료: `docs/handoff/` (2026-11-03 수정 전달본 — 00·01·02 문서, 검증결과.json, reference/)
- 기존 화면: `불닭 (1)/index.html` (d3 단일 파일)을 바탕으로 고쳤습니다. 무엇이 바뀌었는지는 [`docs/구현보고서.md`](docs/구현보고서.md)에 있습니다.

## 실행 (Windows 기준)

준비물: **Python 3** (설치 확인: `py --version`). 인터넷이 없어도 동작합니다(d3를 `assets/vendor`에 포함).

1. 이 폴더(`buldak-dashboard`)에서 터미널을 엽니다. 탐색기 주소창에 `cmd` 입력 → Enter 하면 바로 열립니다.
2. 정적 서버를 켭니다.
   ```bat
   py -m http.server 8000
   ```
   Mac·Linux: `python3 -m http.server 8000`
3. 브라우저에서 **http://localhost:8000** 을 엽니다. ← 로컬 시연 주소
4. 끝낼 때는 터미널에서 **Ctrl + C** 를 누르고 창을 닫습니다.

> `index.html`을 더블클릭해서 열면(file://) 브라우저가 CSV 읽기를 막아 "데이터를 불러오지 못했습니다" 안내가 나옵니다. 반드시 2~3번처럼 주소로 여세요.
> 8000번 포트가 이미 쓰이면 `py -m http.server 8080` 처럼 다른 번호를 쓰고 그 번호로 접속합니다.

VS Code를 쓰면 Live Server 확장으로 `index.html` → *Open with Live Server* 해도 됩니다.

## 점검

```bat
py scripts\verify_data.py
```
CSV만으로 01 지침 완료 기준 수치(2025 삼양 매출 23,517.9억·영업이익 5,241.9억, 농심 35,143.2억·1,839.3억), 두 회사 12분기 합 = 연간, 손익·재무상태표 항등식, 계산 지표 재계산, 검색 최고점, 결측 유지 등을 확인합니다(표준 라이브러리만 사용).

화면 동작 점검(선택): 기업·연도·분기 전환, 미확인 값, 출처 버튼, 질의 예시, 모바일 폭을 실제 브라우저로 확인합니다.
```bat
npm i -D playwright
npx playwright install chromium
REM 서버를 켠 상태에서 다른 터미널에서:
node tests\ui_check.cjs http://localhost:8000/
```

## 인터넷 공개 (선택)

빌드 과정이 없는 정적 사이트라 폴더째 올리면 됩니다.

- **GitHub Pages**: 이 폴더를 저장소 루트로 push → Settings → Pages → Branch `main` / `(root)` → 몇 분 뒤 `https://<아이디>.github.io/<저장소>/`
- **Netlify Drop**: app.netlify.com/drop 에 폴더를 끌어다 놓기
- **Render (Static Site)**: Build Command 비움, Publish Directory `.`

아직 공개 배포는 하지 않았습니다. 기존 onrender 주소는 이전 버전 그대로이며 이 수정본으로 자동 교체되지 않습니다.

## 폴더 구조

```
index.html              화면 틀 (데이터 없음)
assets/app.js           대시보드 코드 (CSV 로드·계산·화면·질의)
assets/styles.css       스타일 (PC 3단 · 모바일 1열)
assets/vendor/d3.min.js d3 v7.9.0 (ISC)
data/*.csv              화면 연결용 CSV 23개 — 전달본 그대로, 수정·반올림하지 않음
sources/                사업보고서 PDF, Google Trends·네이버 원본, 추출된 원문 표 행(JSON)
docs/handoff/           전달 문서 원본 (00·01·02·검증결과.json·reference/)
docs/구현보고서.md       읽은 파일·CSV 구조·화면 연결·차이 목록·검증 결과·미완료
scripts/verify_data.py  데이터 점검
tests/ui_check.cjs      화면 동작 점검 (Playwright)
```

## 데이터를 고칠 때

- `data/*.csv`를 UTF-8(BOM 포함 가능)로 저장합니다. 빈 칸은 결측이며 0으로 채우지 않습니다.
- 금액 단위는 각 파일의 `unit` 열을 따릅니다(원·천원·백만원·억원). 화면이 억원으로 바꿔 표시합니다.
- 수정 후 `py scripts\verify_data.py`로 항등식·분기합이 깨지지 않았는지 확인합니다.

## 범위에서 뺀 것

- **DART 자동 조회**: 인증키를 브라우저 코드·CSV·저장소에 넣지 않습니다(01 지침 5절). 서버 환경변수와 사람 검토 절차가 필요한 후속 작업입니다.
- **주가 연동**: 전달본(00 문서)에서 제외.
- **자유형 AI 답변**: 연동하지 않았습니다. 오른쪽 '데이터 질의'는 규칙 기반 CSV 계산입니다.


## DART 자동 업데이트 (2026-11-10 추가)

새 메뉴 **DART 자동 업데이트**: 평일 16:40(KST)마다 GitHub Actions가 DART에 삼양식품 사업·반기·분기보고서가 새로 올라왔는지 확인하고, 있으면 핵심 계정(매출·원가·판관비·영업이익·순이익·자산·부채·자본·영업현금흐름)을 받아 저장합니다. 바뀐 CSV를 커밋하면 Render가 자동으로 다시 배포합니다.

| 파일 | 역할 |
|---|---|
| `scripts/update_dart.py` | 새 정기보고서 감지 → `data/dart_reports.csv`, `dart_auto_financials.csv`, `dart_auto_quarterly.csv` |
| `.github/workflows/update-data.yml` | 평일 실행 → 바뀐 CSV 커밋 → Render 재배포 |
| `data/update_log.json` | 마지막 실행 결과 (화면 ‘자동 업데이트 상태’ 카드) |
| `scripts/update_stock.py` | 주가 수집 (준비만 해둠 · 워크플로에서 꺼져 있음) |

- 기존에 원문 대조한 `financials.csv`·`quarterly_financials.csv`는 자동으로 바뀌지 않습니다. 자동 수집값은 별도 파일에 ‘자동 수집 · 원문 대조 전’으로 저장되고, 겹치는 기간은 화면에서 검증값과 원 단위로 대조합니다.
- 분기 단일 실적: Q1·Q2·Q3 = 각 보고서의 3개월 값, Q4 = 사업보고서 연간 − 3분기 누적.
- 새 보고서는 DART 재무 API에 반영될 때까지 최대 14일 동안 매일 다시 시도합니다. 정정보고서는 같은 기간을 최신 값으로 교체합니다.

### 자동 업데이트 설정 (한 번만)

1. GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret**
   이름 `DART_API_KEY`, 값에 DART 인증키 → Add secret (키는 코드·사이트에 노출되지 않음)
2. **Settings → Actions → General → Workflow permissions** → *Read and write permissions* → Save
3. **Actions** 탭 → *데이터 자동 업데이트* → **Run workflow** (첫 실행에서 2023년 이후 보고서를 모두 받아옴)
4. 초록색 체크로 끝나면 커밋이 생기고 Render가 다시 배포합니다. 이후는 평일마다 자동.

로컬 실행 (Windows): `set DART_API_KEY=키` → `py scripts\update_dart.py`
