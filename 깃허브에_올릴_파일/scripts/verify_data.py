#!/usr/bin/env python3
"""
데이터 점검 — 01_수정_구현지침 '완료 확인' + 이전 01 문서 7절의 수치 기준.

    python scripts/verify_data.py          (Windows: py scripts\\verify_data.py)

표준 라이브러리만 사용합니다. data/ CSV를 읽기만 하고 수정하지 않습니다.
결과: 통과 / 실패 / 미실행(이 스크립트로 확인할 수 없는 항목)을 구분해 출력합니다.
"""
from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
results: list[tuple[str, str, str]] = []  # (상태, 항목, 상세)


def rd(name: str) -> list[dict[str, str]]:
    with (DATA / name).open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append(("통과" if ok else "실패", name, detail))


def not_run(name: str, why: str) -> None:
    results.append(("미실행", name, why))


def eok(v: int) -> float:  # 원 → 억원
    return v / 1e8


def main() -> int:
    fin = defaultdict(dict)
    for r in rd("financials.csv"):
        fin[(r["company_id"], int(r["year"]))][r["metric"]] = int(r["value"])
    met = {(r["company_id"], int(r["year"])): r for r in rd("calculated_metrics.csv")}
    q = rd("quarterly_financials.csv")
    seg = {(int(r["year"]), r["segment"]): r for r in rd("segments.csv")}

    # --- 01 수정 지침 완료 확인 수치 (약 = 소수 첫째 자리 반올림 비교)
    targets = [("SY", "revenue", 23517.9), ("SY", "operating_profit", 5241.9), ("NS", "revenue", 35143.2), ("NS", "operating_profit", 1839.3)]
    for c, m, want in targets:
        got = round(eok(fin[(c, 2025)][m]), 1)
        check(f"2025 {c} {m} ≈ {want:,}억원", got == want, f"CSV {got:,}억원")

    # --- 이전 01 문서 7절
    sy25 = fin[("SY", 2025)]
    check("2025 삼양 영업이익률 22.3%", round(100 * sy25["operating_profit"] / sy25["revenue"], 1) == 22.3)
    s = seg[(2025, "면스낵")]
    share = 100 * int(s["exports"]) / (int(s["exports"]) + int(s["domestic"]))
    check("2025 면스낵 수출 비중 84.6%", round(share, 1) == 84.6, f"{share:.4f}%")
    check("2025 삼양 영업현금흐름 ≈ 3,092.9억원", round(eok(sy25["operating_cashflow"]), 1) == 3092.9)
    check("2025 삼양 유형자산 취득 ≈ 4,489.9억원", round(eok(sy25["ppe_purchase_outflow"]), 1) == 4489.9)

    # --- 손익 산식·재무상태표 (두 회사, 2022~2025)
    for (c, y), m in sorted(fin.items()):
        check(f"{c} {y} 매출−원가−판관비=영업이익", m["revenue"] - m["cost_of_sales"] - m["sga"] == m["operating_profit"])
        check(f"{c} {y} 자산=부채+자본", m["total_assets"] == m["total_liabilities"] + m["equity"])

    # --- 두 회사 각 12분기: 분기합 = 연간, 분기 손익 산식
    keys = [("revenue", "revenue"), ("cost_of_sales", "cost_of_sales"), ("sga", "sga"), ("operating_profit", "operating_profit")]
    for c in ("SY", "NS"):
        rows = [r for r in q if r["company_id"] == c]
        check(f"{c} 분기 행 수 = 12", len(rows) == 12, f"{len(rows)}행")
        for y in (2023, 2024, 2025):
            ys = [r for r in rows if int(r["year"]) == y]
            for qk, fk in keys:
                check(f"{c} {y} 4개 분기 {qk} 합 = 연간", sum(int(r[qk]) for r in ys) == fin[(c, y)][fk])
        check(f"{c} 12분기 손익 산식", all(int(r["revenue"]) - int(r["cost_of_sales"]) - int(r["sga"]) == int(r["operating_profit"]) for r in rows))

    # --- 계산 지표 재계산 (원값 → 비율)
    for (c, y), r in sorted(met.items()):
        m, p = fin[(c, y)], fin[(c, y - 1)]
        calc = {
            "operating_margin_pct": 100 * m["operating_profit"] / m["revenue"],
            "cost_ratio_pct": 100 * m["cost_of_sales"] / m["revenue"],
            "debt_equity_pct": 100 * m["total_liabilities"] / m["equity"],
            "current_ratio_pct": 100 * m["current_assets"] / m["current_liabilities"],
            "inventory_turnover": m["cost_of_sales"] / ((m["inventory"] + p["inventory"]) / 2),
            "receivables_turnover": m["revenue"] / ((m["receivables"] + p["receivables"]) / 2),
            "revenue_growth_pct": 100 * (m["revenue"] / p["revenue"] - 1),
        }
        bad = [k for k, v in calc.items() if abs(float(r[k]) - v) > 1e-6 * max(1, abs(v))]
        check(f"{c} {y} calculated_metrics 재계산 일치", not bad, ", ".join(bad))
        if c == "NS":
            check(f"NS {y} 면스낵 수출비중 빈칸 + 사유", r["noodle_export_share_pct"] == "" and r["export_share_status"].startswith("비교 불가"))

    # --- 검색: 지역별 36개월, 최고점
    sm = rd("search_monthly.csv")
    by = defaultdict(list)
    for r in sm:
        by[r["region"]].append(r)
    for rg, want in (("KR", "2025-02"), ("Worldwide", "2025-08"), ("US", "2025-08")):
        rows = by[rg]
        peak = max(rows, key=lambda r: float(r["index"]))["month"][:7]
        check(f"검색 {rg} 36개월", len(rows) == 36, f"{len(rows)}")
        check(f"검색 {rg} 최고점 {want}", peak == want, peak)

    # --- 결측: 0으로 채우지 않았는지
    prod = rd("production.csv")
    miss = [r for r in prod if r["factory"] == "밀양" and r["product"] == "조미소스소재" and r["year"] in ("2023", "2024")]
    check("밀양 조미소스소재 2023~2024 빈 값 유지", all(r["capacity_value"] == "" and r["reported_time_utilization_pct"] == "" for r in miss))
    eu = [r for r in rd("foreign_entities.csv") if r["entity"] == "유럽" and r["year"] == "2023"]
    check("유럽법인 2023 빈 값(설립 전)", len(eu) == 1 and eu[0]["revenue"] == "")

    # --- 연표: 17건, 2026 누적 판매 기록 없음
    ev = rd("events.csv")
    check("사건 17건", len(ev) == 17, f"{len(ev)}")
    check("2025 연표에 2026 기록 없음", not any(r["period"].startswith("2026") for r in ev))

    # --- 판매경로: 그룹 안 합계 100%
    groups = defaultdict(float)
    for r in rd("sales_channels.csv"):
        groups[r["group"]] += float(r["reported_share_pct"])
    check("판매경로 그룹별 합계 100%", all(abs(v - 100) < 0.05 for v in groups.values()), ", ".join(f"{k} {v:.1f}" for k, v in groups.items()))

    # --- 농심 지역 합계 ≈ 연결 매출 (천원 반올림)
    reg, nreg = defaultdict(int), defaultdict(int)
    for r in rd("nongshim_region_revenue.csv"):
        reg[int(r["year"])] += int(r["external_revenue"]); nreg[int(r["year"])] += 1
    for y, tot in sorted(reg.items()):
        diff = tot * 1000 - fin[("NS", y)]["revenue"]  # 지역별 천원 반올림 → 지역 수 × 500원 이내
        check(f"농심 {y} 지역 합 ≈ 연결 매출 (천원 반올림)", abs(diff) <= 500 * nreg[y], f"차이 {diff:,}원")

    # --- 감사 원장 연결
    led = {r["audit_id"] for r in rd("audit_ledger.csv")}
    links = rd("audit_source_links.csv")
    regs = {r["source_id"] for r in rd("source_registry.csv")}
    check("모든 감사 항목에 출처 연결", led <= {l["audit_id"] for l in links})
    check("연결된 출처 ID가 등록부에 존재", {l["source_id"] for l in links} <= regs)
    uniq = len({(l["audit_id"], l["source_id"]) for l in links})
    vj = json.loads((ROOT / "docs/handoff/검증결과.json").read_text(encoding="utf-8"))
    doc_n = vj.get("recheck_2026_11_03", {}).get("source_id_links")
    results.append(("참고", "출처 연결 건수 (문서 vs CSV)", f"검증결과.json {doc_n} · CSV {len(links)}행(중복 제외 {uniq}) — 불일치, 원인 미확인"))

    # --- 이 스크립트로 확인할 수 없는 항목
    not_run("기업·연도·분기 전환, 출처 버튼, 미확인 값 표시, 모바일 화면", "브라우저 동작 — tests/ui_check.cjs 또는 직접 확인")
    not_run("최신 정정공시 전체 이력", "전달본에서도 미완료 (검증결과.json)")
    not_run("DART 실제 접속", "이번 기본 구현 범위에서 분리")

    w = max(len(n) for _, n, _ in results)
    for st, n, d in results:
        print(f"[{st}] {n.ljust(w)}  {d}")
    fails = [r for r in results if r[0] == "실패"]
    print(f"\n통과 {sum(1 for r in results if r[0] == '통과')} · 실패 {len(fails)} · 미실행 {sum(1 for r in results if r[0] == '미실행')} · 참고 {sum(1 for r in results if r[0] == '참고')}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
