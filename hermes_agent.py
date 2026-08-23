import os
import json
import requests
from bs4 import BeautifulSoup
from datetime import datetime

# ==========================================
# 1. 설정 정보
# ==========================================
GITHUB_TOKEN = os.environ.get("WT_GITHUB_TOKEN", "")
GIST_ID = os.environ.get("WT_GIST_ID", "")
GIST_FILENAME = "wealthtrack-data.json"

HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Hermes-Asset-Agent"
}

# ==========================================
# 2. 시세 및 환율 수집기
# ==========================================
def get_krx_stock_price(ticker_code: str) -> int:
    """네이버 증권 국내 주식 종가 크롤링"""
    clean_code = str(ticker_code).strip().zfill(6)
    url = f"https://finance.naver.com/item/main.naver?code={clean_code}"
    res = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
    if res.status_code == 200:
        soup = BeautifulSoup(res.text, "html.parser")
        today_div = soup.find("p", class_="no_today")
        if today_div:
            price_span = today_div.find("span", class_="blind")
            if price_span:
                return int(price_span.text.replace(",", ""))
    return 0

def get_usd_exchange_rate() -> float:
    """네이버 금융 원/달러 환율 크롤링"""
    url = "https://finance.naver.com/marketindex/"
    res = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
    if res.status_code == 200:
        soup = BeautifulSoup(res.text, "html.parser")
        rate_span = soup.select_one("div.head_info > span.value")
        if rate_span:
            return float(rate_span.text.replace(",", ""))
    return 1380.0

def get_us_stock_price(ticker_symbol: str) -> float:
    """미국 주식 시세 조회 (Yahoo Finance API)"""
    clean_ticker = str(ticker_symbol).strip().upper()
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{clean_ticker}"
    res = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
    if res.status_code == 200:
        data = res.json()
        try:
            return float(data["chart"]["result"][0]["meta"]["regularMarketPrice"])
        except (KeyError, IndexError):
            pass
    return 0.0

# ==========================================
# 3. Gist 통신
# ==========================================
def fetch_gist_data() -> tuple[dict, str]:
    url = f"https://api.github.com/gists/{GIST_ID}"
    res = requests.get(url, headers=HEADERS)
    if res.status_code == 200:
        files = res.json().get("files", {})
        target_file = files.get(GIST_FILENAME)
        actual_name = GIST_FILENAME
        if not target_file:
            for fname, fobj in files.items():
                if fname.endswith(".json"):
                    target_file = fobj
                    actual_name = fname
                    break
        if target_file:
            return json.loads(target_file["content"]), actual_name
    raise Exception(f"Gist 데이터 로드 실패: {res.status_code} {res.text}")

def update_gist_data(new_data: dict, filename: str):
    url = f"https://api.github.com/gists/{GIST_ID}"
    payload = {
        "files": {
            filename: {
                "content": json.dumps(new_data, ensure_ascii=False, indent=2)
            }
        }
    }
    res = requests.patch(url, headers=HEADERS, json=payload)
    if res.status_code == 200:
        print("✅ [Hermes] Gist 자산 데이터가 성공적으로 업데이트되었습니다.")
    else:
        raise Exception(f"Gist 업데이트 실패: {res.status_code} {res.text}")

# ==========================================
# 4. 재평가 실행 로직
# ==========================================
def run_hermes_update():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 🤖 헤르메스 에이전트 자산 평가 업데이트 시작...")
    
    app_data, filename = fetch_gist_data()
    usd_rate = get_usd_exchange_rate()
    print(f"💵 현재 원/달러 기준 환율: {usd_rate:,.2f}원")

    # 1. 메인 accounts 데이터 탐색
    accounts = app_data.get("accounts", [])
    print(f"📂 등록된 계좌 수: {len(accounts)}개")

    total_net_worth = 0

    for account in accounts:
        account_name = account.get("name", "이름없음")
        holdings = account.get("holdings") or account.get("items") or []
        account_stock_total = 0

        for item in holdings:
            name = item.get("name", "종목")
            code = item.get("code") or item.get("ticker") or item.get("symbol")
            market = str(item.get("market", "KRX")).upper()
            qty = float(item.get("quantity") or item.get("shares") or item.get("qty") or 0)

            # 가격 갱신
            if code and qty > 0:
                if market in ["US", "USA", "OVERSEAS", "NASDAQ", "NYSE"]:
                    price_usd = get_us_stock_price(code)
                    if price_usd > 0:
                        item["currentPriceUSD"] = price_usd
                        item["currentPrice"] = int(price_usd * usd_rate)
                        item["totalValue"] = int(qty * price_usd * usd_rate)
                        item["valuation"] = item["totalValue"]
                        print(f"  - [{account_name}] (해외) {name}({code}): ${price_usd:,.2f} x {qty} -> {item['totalValue']:,}원")
                else:
                    price_krw = get_krx_stock_price(code)
                    if price_krw > 0:
                        item["currentPrice"] = price_krw
                        item["totalValue"] = int(qty * price_krw)
                        item["valuation"] = item["totalValue"]
                        print(f"  - [{account_name}] (국내) {name}({code}): {price_krw:,}원 x {qty} -> {item['totalValue']:,}원")

            item_val = int(item.get("totalValue") or item.get("valuation") or item.get("value") or 0)
            account_stock_total += item_val

        # 계좌 현금 및 총 평가액 계산
        cash = int(account.get("cash") or 0)
        account_total = account_stock_total + cash
        account["totalValuation"] = account_total
        account["balance"] = account_total
        total_net_worth += account_total

    print(f"💰 재계산된 총 순자산: {total_net_worth:,}원")

    # 2. monthlyRecords의 가장 최근 레코드 동기화 (있는 경우)
    monthly_records = app_data.get("monthlyRecords", [])
    if monthly_records:
        latest_record = monthly_records[-1]
        latest_record["totalNetWorth"] = total_net_worth
        latest_record["netWorth"] = total_net_worth
        latest_record["lastUpdated"] = datetime.now().isoformat()
        print(f"📊 최신 월별 히스토리({latest_record.get('month', '최신')}) 순자산 갱신 완료")

    # 3. Gist 저장
    update_gist_data(app_data, filename)

if __name__ == "__main__":
    run_hermes_update()
