#!/usr/bin/env python3
"""
삼양식품(003230) 일별 주가 수집 → data/stock_daily.csv

    python scripts/update_stock.py

- 표준 라이브러리만 사용 (설치 필요 없음).
- 출처: Yahoo Finance 일봉 (티커 003230.KS). DART는 주가를 제공하지 않습니다.
- 매 실행마다 2023-01-01 ~ 오늘 전체를 다시 받아 파일을 통째로 다시 씁니다
  (중간에 빠진 날이 생기지 않도록).
- 받아오기에 실패하면 기존 파일을 그대로 두고 경고만 출력합니다 (사이트가 깨지지 않게).
- 장중 실시간 시세가 아니라 '장 마감 후 일별 종가' 기준입니다.
"""
from __future__ import annotations

import csv
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "stock_daily.csv"
LOG = ROOT / "data" / "update_log.json"
TICKER = "003230.KS"
INDEX = "^KS11"  # KOSPI 지수 (시장 전체 움직임과 비교용)
START = datetime(2023, 1, 1, tzinfo=timezone.utc)
KST = timezone(timedelta(hours=9))
SOURCE = f"Yahoo Finance {TICKER} 일봉"
HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]


def fetch(ticker: str = TICKER) -> dict:
    p1 = int(START.timestamp())
    p2 = int(time.time()) + 86400
    last_err = None
    for host in HOSTS:
        url = f"https://{host}/v8/finance/chart/{urllib.parse.quote(ticker)}?period1={p1}&period2={p2}&interval=1d&events=div%2Csplits"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (buldak-dashboard data updater)"})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    return json.load(r)
            except Exception as e:  # noqa: BLE001 — 네트워크 오류는 재시도
                last_err = e
                time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"주가 요청 실패: {last_err}")


def parse(js: dict, raw: bool = False) -> list[dict]:
    res = js["chart"]["result"][0]
    ts = res.get("timestamp") or []
    q = res["indicators"]["quote"][0]
    rows = []
    for i, t in enumerate(ts):
        c = q["close"][i]
        if c is None:  # 거래정지·휴장 등
            continue
        d = datetime.fromtimestamp(t, KST).strftime("%Y-%m-%d")
        if raw:
            rows.append({"date": d, "close_raw": c})
            continue
        rows.append({
            "date": d,
            "open": round(q["open"][i]) if q["open"][i] is not None else "",
            "high": round(q["high"][i]) if q["high"][i] is not None else "",
            "low": round(q["low"][i]) if q["low"][i] is not None else "",
            "close": round(c),
            "volume": q["volume"][i] if q["volume"][i] is not None else "",
            "source": SOURCE,
        })
    # 같은 날짜가 두 번 오면 마지막 값 사용
    uniq = {r["date"]: r for r in rows}
    return [uniq[k] for k in sorted(uniq)]


def write_log(key: str, info: dict) -> None:
    log = {}
    if LOG.exists():
        try:
            log = json.loads(LOG.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            log = {}
    log[key] = info
    LOG.write_text(json.dumps(log, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    now = datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")
    try:
        rows = parse(fetch())
        if len(rows) < 20:
            raise RuntimeError(f"받은 행이 너무 적음 ({len(rows)}행)")
        try:  # KOSPI는 실패해도 주가는 저장
            kospi = {r["date"]: r["close_raw"] for r in parse(fetch(INDEX), raw=True)}
        except Exception as e:  # noqa: BLE001
            print(f"[경고] KOSPI 수집 실패: {e}", file=sys.stderr)
            kospi = {}
        for r in rows:
            k = kospi.get(r["date"])
            r["kospi"] = "" if k is None else round(k, 2)
    except Exception as e:  # noqa: BLE001
        print(f"[경고] {e} — 기존 stock_daily.csv를 유지합니다.", file=sys.stderr)
        write_log("stock", {"status": "실패", "checked_at": now, "message": str(e)[:200]})
        return 0  # 워크플로 전체를 실패시키지 않음
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["date", "open", "high", "low", "close", "volume", "kospi", "source"])
        w.writeheader()
        w.writerows(rows)
    write_log("stock", {"status": "성공", "checked_at": now, "rows": len(rows), "last_date": rows[-1]["date"], "last_close": rows[-1]["close"], "source": SOURCE})
    print(f"주가 {len(rows)}행 저장 · 마지막 {rows[-1]['date']} 종가 {rows[-1]['close']:,}원")
    return 0


if __name__ == "__main__":
    sys.exit(main())
