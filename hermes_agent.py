import os
import json
import requests
from bs4 import BeautifulSoup
from datetime import datetime

# ==========================================
# 1. 설정 정보 (환경 변수 또는 직접 입력)
# ==========================================
GITHUB_TOKEN = os.environ.get("WT_GITHUB_TOKEN", "ghp_여기에_토큰_입력")
GIST_ID = os.environ.get("WT_GIST_ID", "여기에_GIST_ID_입력")
GIST_FILENAME = "wealthtrack-data.json"

HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Hermes-Asset-Agent"
}

# ==========================================
# 2. 시세 크롤러 함수
# ==========================================
def get_krx_stock_price(ticker_code: str) -> int:
    """네이버 증권에서 국내 주식 현재가(종가) 크롤링"""
    url = f"https://finance.naver.com/item/main.naver?code={ticker_code}"
    res = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
    if res.status_code == 200:
        soup = BeautifulSoup(res.text, "html.parser")
        today_div = soup.find("fieldset", class_="blind")
        if today_div:
            # 현재가 영역 파싱
            now_price = soup.find("p", class_="no_today").find("span", class_="blind").text
            return int(now_price.replace(",", ""))
    return 0

def get_usd_exchange_rate() -> float:
    """네이버 금융에서 원/달러 환율 크롤링"""
    url = "https://finance.naver.com/marketindex/"
    res = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
    if res.status_code == 200:
        soup = BeautifulSoup(res.text, "html.parser")
        rate_span = soup.select_one("div.head_info > span.value")
        if rate_span:
            return float(rate_span.text.replace(",", ""))
    return 1380.0  # 기본 폴백 환율

def get_us_stock_price(ticker_symbol: str) -> float:
    """미국 주식 시세 크롤링 (Yahoo Finance API 경량 엔드포인트 활용)"""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker_symbol}"
    headers = {"User-Agent": "Mozilla/5.0"}
    res = requests.get(url, headers=headers)
    if res.status_code == 200:
        data = res.json()
        try:
            return float(data["chart"]["result"][0]["meta"]["regularMarketPrice"])
        except (KeyError, IndexError):
            pass
    return 0.0

# ==========================================
# 3. Gist 읽기 및 쓰기 함수
# ==========================================
def fetch_gist_data() -> dict:
    """GitHub Gist에서 최신 자산 JSON 데이터 로드"""
    url = f"https://api.github.com/gists/{GIST_ID}"
    res = requests.get(url, headers=HEADERS)
    if res.status_code == 200:
        files = res.json().get("files", {})
        target_file = files.get(GIST_FILENAME)
        if target_file:
            return json.loads(target_file["content"])
    raise Exception(f"Gist 데이터 로드 실패: {res.status_code} {res.text}")

def update_gist_data(new_data: dict):
    """업데이트된 JSON 데이터를 Gist에 저장"""
    url = f"https://api.github.com/gists/{GIST_ID}"
    payload = {
        "files": {
            GIST_FILENAME: {
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
# 4. 에이전트 주 실행 루프
# ==========================================
def run_hermes_update():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 🤖 헤르메스 에이전트 자산 평가 업데이트 시작...")
    
    # 1. 데이터 로드
    app_data = fetch_gist_data()
    usd_rate = get_usd_exchange_rate()
    print(f"💵 현재 원/달러 기준 환율: {usd_rate:,.2f}원")

    # 2. 가장 최근 월(Month) 데이터 탐색 및 보유 주식 시세 갱신
    # (JSON 구조에 따라 월별/계좌별 holdings를 순회)
    records = app_data.get("monthlyRecords", [])
    if not records:
        print("⚠️ 월별 기록이 존재하지 않습니다.")
        return

    latest_record = records[-1]
    print(f"📊 대상 월별 기록: {latest_record.get('month', '최신')}")

    total_net_worth = 0

    for account in latest_record.get("accounts", []):
        account_total = 0
        
        # 주식 및 ETF 항목 단가 최신화
        for holding in account.get("holdings", []):
            code = holding.get("code") or holding.get("ticker")
            market = holding.get("market", "KRX")  # KRX 또는 US
            quantity = holding.get("quantity", 0)

            if code:
                if market == "US":
                    current_price_usd = get_us_stock_price(code)
                    if current_price_usd > 0:
                        holding["currentPriceUSD"] = current_price_usd
                        holding["currentPrice"] = int(current_price_usd * usd_rate)
                        holding["totalValue"] = int(quantity * current_price_usd * usd_rate)
                        print(f"  - [해외] {holding.get('name')}({code}): ${current_price_usd:,.2f} -> {holding['totalValue']:,}원")
                else:
                    current_price_krw = get_krx_stock_price(code)
                    if current_price_krw > 0:
                        holding["currentPrice"] = current_price_krw
                        holding["totalValue"] = int(quantity * current_price_krw)
                        print(f"  - [국내] {holding.get('name')}({code}): {current_price_krw:,}원 -> {holding['totalValue']:,}원")
            
            account_total += holding.get("totalValue", 0)

        # 현금 및 기타 자산 합산
        account_total += account.get("cash", 0)
        account["totalValuation"] = account_total
        total_net_worth += account_total

    latest_record["totalNetWorth"] = total_net_worth
    latest_record["lastUpdated"] = datetime.now().isoformat()
    print(f"💰 재계산된 총 순자산: {total_net_worth:,}원")

    # 3. Gist에 저장
    update_gist_data(app_data)

if __name__ == "__main__":
    run_hermes_update()
