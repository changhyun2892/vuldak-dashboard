#!/usr/bin/env python3
"""
DART 정기보고서(사업·반기·분기) 자동 반영 → data/dart_*.csv

    DART_API_KEY=발급키 python scripts/update_dart.py
    (Windows: set DART_API_KEY=발급키  →  py scripts\\update_dart.py)

동작
 1. 삼양식품(종목코드 003230)의 DART 고유번호(corp_code)를 찾는다 (처음 한 번만, data/dart_meta.json에 저장).
 2. 2023-01-01 이후 정기공시 목록을 받아 '아직 반영하지 않은' 사업·반기·분기보고서를 찾는다.
    정정보고서([기재정정] 등)가 새로 올라오면 그 기간을 다시 받아 덮어쓴다.
 3. 새 보고서마다 단일회사 전체 재무제표 API(연결, CFS)에서 핵심 계정을 뽑아 저장한다.
 4. 분기 단일 실적(Q1~Q4)을 다시 계산해 data/dart_auto_quarterly.csv로 저장한다.

원칙
 - 기존에 사람이 원문 대조한 data/financials.csv, quarterly_financials.csv는 건드리지 않는다.
   자동 수집값은 별도 파일에 '자동 수집 · 원문 대조 전'으로 저장하고, 대시보드가 기존 검증값과 비교해 보여준다.
 - 값이 없으면 빈칸(=데이터 없음)으로 두고 0으로 채우지 않는다.
 - API 키가 없거나 요청이 실패하면 기존 파일을 유지하고 경고만 남긴다 (사이트가 깨지지 않게).
 - 표준 라이브러리만 사용.
"""
from __future__ import annotations

import csv
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
META = DATA / "dart_meta.json"
REPORTS = DATA / "dart_reports.csv"
FINS = DATA / "dart_auto_financials.csv"
QTR = DATA / "dart_auto_quarterly.csv"
LOG = DATA / "update_log.json"

BASE = os.environ.get("DART_BASE_URL", "https://opendart.fss.or.kr/api")  # 테스트 때만 바꿈
STOCK_CODE = "003230"
CORP_NAME = "삼양식품"
BGN_DE = "20230101"
KST = timezone(timedelta(hours=9))

# 보고서 결산월 → DART reprt_code
REPRT = {"12": ("11011", "사업보고서", 4), "06": ("11012", "반기보고서", 2), "03": ("11013", "1분기보고서", 1), "09": ("11014", "3분기보고서", 3)}

# 뽑을 계정: (metric, 화면 이름, 재무제표 구분, account_id 후보, 계정명 정규식)
ACCOUNTS = [
    ("revenue", "매출액", ("IS", "CIS"), ("ifrs-full_Revenue", "ifrs_Revenue"), r"^(매출액|수익\(매출액\)|영업수익|매출)$"),
    ("cost_of_sales", "매출원가", ("IS", "CIS"), ("ifrs-full_CostOfSales", "ifrs_CostOfSales"), r"^매출원가$"),
    ("sga", "판매비와관리비", ("IS", "CIS"), ("dart_TotalSellingGeneralAdministrativeExpenses",), r"^판매비\s*와\s*관리비$"),
    ("operating_profit", "영업이익", ("IS", "CIS"), ("dart_OperatingIncomeLoss",), r"^영업이익(\(손실\))?$"),
    ("net_income", "당기순이익", ("IS", "CIS"), ("ifrs-full_ProfitLoss", "ifrs_ProfitLoss"), r"^(당기순이익|분기순이익|반기순이익)(\(손실\))?$"),
    ("total_assets", "자산총계", ("BS",), ("ifrs-full_Assets", "ifrs_Assets"), r"^자산총계$"),
    ("total_liabilities", "부채총계", ("BS",), ("ifrs-full_Liabilities", "ifrs_Liabilities"), r"^부채총계$"),
    ("total_equity", "자본총계", ("BS",), ("ifrs-full_Equity", "ifrs_Equity"), r"^자본총계$"),
    ("operating_cashflow", "영업활동현금흐름", ("CF",), ("ifrs-full_CashFlowsFromUsedInOperatingActivities", "ifrs_CashFlowsFromUsedInOperatingActivities"), r"^영업활동(으로\s*인한)?\s*현금흐름$"),
]
FLOW = {"revenue", "cost_of_sales", "sga", "operating_profit", "net_income"}  # 기간 손익 (분기 단일값 계산 대상)

REPORT_COLS = ["rcept_no", "rcept_dt", "report_nm", "bsns_year", "reprt_code", "report_type", "is_correction", "status", "message", "processed_at", "viewer_url"]
FIN_COLS = ["bsns_year", "reprt_code", "report_type", "metric", "label", "value", "value_cumulative", "unit", "fs_div", "sj_div", "account_id", "account_nm", "rcept_no", "rcept_dt", "report_nm", "viewer_url", "fetched_at", "status"]
QTR_COLS = ["year", "quarter", "period", "metric", "label", "value", "unit", "method", "rcept_nos", "status"]


class DartError(RuntimeError):
    pass


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def get(path: str, params: dict, raw: bool = False):
    q = urllib.parse.urlencode(params)
    url = f"{BASE}/{path}?{q}"
    last = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "buldak-dashboard"}), timeout=60) as r:
                body = r.read()
            if raw:
                return body
            js = json.loads(body.decode("utf-8"))
            st = js.get("status")
            if st == "000":
                return js
            if st == "013":  # 조회된 데이터 없음
                return {"status": "013", "list": []}
            raise DartError(f"DART {path} 오류 {st}: {js.get('message')}")
        except DartError:
            raise
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 * (attempt + 1))
    raise DartError(f"DART {path} 요청 실패: {last}")


def read_csv(p: Path) -> list[dict]:
    if not p.exists():
        return []
    with p.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_csv(p: Path, cols: list[str], rows: list[dict]) -> None:
    with p.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def write_log(info: dict) -> None:
    log = {}
    if LOG.exists():
        try:
            log = json.loads(LOG.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            log = {}
    log["dart"] = info
    LOG.write_text(json.dumps(log, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def corp_code(key: str) -> str:
    meta = json.loads(META.read_text(encoding="utf-8")) if META.exists() else {}
    if meta.get("stock_code") == STOCK_CODE and meta.get("corp_code"):
        return meta["corp_code"]
    z = zipfile.ZipFile(io.BytesIO(get("corpCode.xml", {"crtfc_key": key}, raw=True)))
    root = ET.fromstring(z.read(z.namelist()[0]))
    for el in root.iter("list"):
        if (el.findtext("stock_code") or "").strip() == STOCK_CODE:
            cc = el.findtext("corp_code").strip()
            META.write_text(json.dumps({"stock_code": STOCK_CODE, "corp_name": (el.findtext("corp_name") or "").strip(), "corp_code": cc, "found_at": now_kst()}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            return cc
    raise DartError(f"종목코드 {STOCK_CODE}의 corp_code를 찾지 못했습니다")


def list_reports(key: str, cc: str) -> list[dict]:
    out, page = [], 1
    end_de = datetime.now(KST).strftime("%Y%m%d")
    while True:
        js = get("list.json", {"crtfc_key": key, "corp_code": cc, "bgn_de": BGN_DE, "end_de": end_de, "pblntf_ty": "A", "page_no": page, "page_count": 100})
        out += js.get("list", [])
        if page >= int(js.get("total_page", 1) or 1):
            break
        page += 1
    reps = []
    for r in out:
        nm = r.get("report_nm", "")
        m = re.search(r"(사업|반기|분기)보고서\s*\((\d{4})\.(\d{2})\)", nm)
        if not m or m.group(3) not in REPRT:
            continue
        code, rtype, _ = REPRT[m.group(3)]
        reps.append({"rcept_no": r["rcept_no"], "rcept_dt": r.get("rcept_dt", ""), "report_nm": nm.strip(), "bsns_year": m.group(2), "reprt_code": code, "report_type": rtype,
                     "is_correction": "Y" if nm.strip().startswith("[") else "N", "viewer_url": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={r['rcept_no']}"})
    reps.sort(key=lambda r: (r["rcept_dt"], r["rcept_no"]))
    return reps


def num(s) -> int | None:
    if s is None:
        return None
    s = str(s).replace(",", "").strip()
    if s in ("", "-"):
        return None
    try:
        return int(float(s))
    except ValueError:
        return None


def pick(items: list[dict], sj: tuple, ids: tuple, name_re: str) -> dict | None:
    cand = [i for i in items if i.get("sj_div") in sj]
    for aid in ids:
        for i in cand:
            if i.get("account_id") == aid:
                return i
    rx = re.compile(name_re)
    for i in cand:
        if rx.match(re.sub(r"\s+", "", i.get("account_nm", "")).replace("Ⅰ.", "")) or rx.match((i.get("account_nm") or "").strip()):
            return i
    return None


def fetch_period(key: str, cc: str, rep: dict) -> list[dict]:
    js = get("fnlttSinglAcntAll.json", {"crtfc_key": key, "corp_code": cc, "bsns_year": rep["bsns_year"], "reprt_code": rep["reprt_code"], "fs_div": "CFS"})
    items = js.get("list", [])
    if not items:
        return []
    rows, ts = [], now_kst()
    used_rcept = items[0].get("rcept_no") or rep["rcept_no"]
    for metric, label, sj, ids, name_re in ACCOUNTS:
        it = pick(items, sj, ids, name_re)
        val = num(it.get("thstrm_amount")) if it else None
        cum = num(it.get("thstrm_add_amount")) if it else None
        if metric in FLOW and rep["reprt_code"] == "11011":
            cum = val  # 연간 = 누적
        if metric in FLOW and cum is None and rep["reprt_code"] == "11013":
            cum = val  # 1분기는 3개월 = 누적
        rows.append({"bsns_year": rep["bsns_year"], "reprt_code": rep["reprt_code"], "report_type": rep["report_type"], "metric": metric, "label": label,
                     "value": "" if val is None else val, "value_cumulative": "" if cum is None else cum, "unit": "KRW", "fs_div": "CFS",
                     "sj_div": it.get("sj_div", "") if it else "", "account_id": it.get("account_id", "") if it else "", "account_nm": (it.get("account_nm") or "").strip() if it else "",
                     "rcept_no": used_rcept, "rcept_dt": rep["rcept_dt"], "report_nm": rep["report_nm"], "viewer_url": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={used_rcept}",
                     "fetched_at": ts, "status": "자동 수집 · 원문 대조 전" if it else "계정 미발견"})
    return rows


def build_quarterly(fins: list[dict]) -> list[dict]:
    """분기 단일 실적: Q1·Q2·Q3 = 각 보고서의 3개월 값, Q4 = 사업보고서 연간 − 3분기 누적."""
    by = {(r["bsns_year"], r["reprt_code"], r["metric"]): r for r in fins}
    years = sorted({r["bsns_year"] for r in fins})
    out = []
    for y in years:
        for metric, label, *_ in ACCOUNTS:
            if metric not in FLOW:
                continue
            for q, code, method in ((1, "11013", "1분기보고서 3개월"), (2, "11012", "반기보고서 3개월"), (3, "11014", "3분기보고서 3개월")):
                r = by.get((y, code, metric))
                if r and r["value"] != "":
                    out.append({"year": y, "quarter": q, "period": f"{y}-Q{q}", "metric": metric, "label": label, "value": r["value"], "unit": "KRW", "method": method, "rcept_nos": r["rcept_no"], "status": "자동 수집 · 원문 대조 전"})
            a, c3 = by.get((y, "11011", metric)), by.get((y, "11014", metric))
            if a and c3 and a["value"] != "" and c3["value_cumulative"] != "":
                out.append({"year": y, "quarter": 4, "period": f"{y}-Q4", "metric": metric, "label": label, "value": int(a["value"]) - int(c3["value_cumulative"]), "unit": "KRW",
                            "method": "사업보고서 연간 − 3분기 누적 (결산조정 포함)", "rcept_nos": f"{a['rcept_no']};{c3['rcept_no']}", "status": "자동 수집 · 원문 대조 전"})
    out.sort(key=lambda r: (r["year"], int(r["quarter"]), r["metric"]))
    return out


def main() -> int:
    key = os.environ.get("DART_API_KEY", "").strip()
    started = now_kst()
    if not key:
        print("[경고] DART_API_KEY가 없습니다 — GitHub 저장소 Settings → Secrets에 등록하세요. 기존 파일 유지.", file=sys.stderr)
        write_log({"status": "키 없음", "checked_at": started, "message": "DART_API_KEY 미설정"})
        return 0
    DATA.mkdir(exist_ok=True)
    try:
        cc = corp_code(key)
        found = list_reports(key, cc)
    except DartError as e:
        print(f"[경고] {e} — 기존 파일 유지", file=sys.stderr)
        write_log({"status": "실패", "checked_at": started, "message": str(e)[:200]})
        return 0

    done = {r["rcept_no"]: r for r in read_csv(REPORTS)}
    fins = read_csv(FINS)
    new = [r for r in found if r["rcept_no"] not in done]
    added, errors = [], []
    for rep in new:
        try:
            rows = fetch_period(key, cc, rep)
            if rows:
                # 같은 기간은 최신 보고서(정정 포함)로 교체
                fins = [f for f in fins if not (f["bsns_year"] == rep["bsns_year"] and f["reprt_code"] == rep["reprt_code"])] + rows
                st, msg = "반영", f"{sum(1 for r in rows if r['value'] != '')}개 계정"
            else:
                # 공시 직후에는 재무 API 반영이 늦을 수 있음 → 14일 동안은 매일 다시 시도
                age = (datetime.now(KST).date() - datetime.strptime(rep["rcept_dt"], "%Y%m%d").date()).days if rep["rcept_dt"] else 99
                if age <= 14:
                    added.append(f"{rep['report_nm']} ({rep['rcept_dt']}) — 재무 데이터 대기 (다음 실행 때 재시도)")
                    continue
                st, msg = "재무 데이터 없음", "fnlttSinglAcntAll 결과 없음 (재무제표 미포함 정정 등)"
            done[rep["rcept_no"]] = {**rep, "status": st, "message": msg, "processed_at": now_kst()}
            added.append(f"{rep['report_nm']} ({rep['rcept_dt']}) — {st}")
            time.sleep(0.5)
        except DartError as e:
            errors.append(f"{rep['report_nm']}: {e}")  # 다음 실행 때 다시 시도 (done에 넣지 않음)

    fins.sort(key=lambda r: (r["bsns_year"], {"11013": 1, "11012": 2, "11014": 3, "11011": 4}.get(r["reprt_code"], 9), r["metric"]))
    write_csv(FINS, FIN_COLS, fins)
    write_csv(QTR, QTR_COLS, build_quarterly(fins))
    write_csv(REPORTS, REPORT_COLS, sorted(done.values(), key=lambda r: (r["rcept_dt"], r["rcept_no"])))
    latest = max(done.values(), key=lambda r: (r["rcept_dt"], r["rcept_no"]), default=None)
    write_log({"status": "성공" if not errors else "일부 실패", "checked_at": started, "corp_code": cc, "reports_total": len(done), "new_reports": added, "errors": errors[:5],
               "latest_report": latest and {k: latest[k] for k in ("report_nm", "rcept_dt", "viewer_url")}})
    print(f"정기보고서 {len(found)}건 확인 · 새로 반영 {len(added)}건 · 오류 {len(errors)}건")
    for a in added:
        print("  +", a)
    for e in errors:
        print("  !", e, file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
