# 불닭 경영분석 대시보드

제공된 Claude 공개 아티팩트의 HTML·CSS·컴파일된 JavaScript를 보존한 독립 실행 패키지입니다.

## 실행

이 폴더에서 `python -m http.server 8000` 실행 후 http://localhost:8000 접속.
별도 npm 설치나 빌드가 필요하지 않습니다. ES 모듈을 사용하므로 파일 더블클릭보다 HTTP 서버로 실행하세요.

## 파일

- index.html: 진입점
- styles.css: 원본 스타일
- app.js: React·차트 라이브러리·데이터·화면이 포함된 원본 컴파일 번들
- render.yaml: Render Static Site 구성

## Render 배포

압축을 풀어 폴더 안 파일들을 GitHub 저장소 루트에 올립니다.
Render에서 New → Static Site → 저장소 연결 → Branch: main.
Build Command는 비워두고 Publish Directory는 `.` 로 설정합니다.
Redis·API 키·데이터베이스는 현재 패키지 실행에 필요하지 않습니다.

## 수정과 한계

CSS는 styles.css에서 수정할 수 있습니다. app.js는 개발용 JSX 원본이 아닌 컴파일 번들이므로 대규모 기능 수정은 원본 JSX 확보 또는 소스 재구성이 권장됩니다.
화면·수치·설명·차트 동작을 보존하며, 자료의 사실 여부를 새로 검증한 패키지는 아닙니다.
Claude 전용 frame-runtime만 제거했으며 링크로 연결된 외부 출처는 인터넷 연결이 필요합니다.
라이브러리 저작권 주석은 app.js 끝에 보존되어 있습니다.

원본: https://claude.ai/artifact/UjJW22DrdWLs93MGVEGjKw

## 확인한 동작
독립 서버에서 첫 화면·SVG 차트 15개 렌더링, 2023 연도 선택, 매출액 상세창, 연간/분기 전환을 확인했습니다. 전체 버튼과 모바일 모든 해상도를 전수 검증한 것은 아닙니다.
사업보고서 PDF를 포함했습니다.
