import yfinance as yf
import json
import sys
import numpy as np

def fetch_financial_metrics(ticker, is_competitor=False):
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        
        # Helper to safely get float values
        def get_value(key, default=None):
            val = info.get(key)
            return float(val) if val is not None and val != 'Infinity' and val != 'NaN' else default
            
        # 1. Price to Earnings (PE)
        pe_ratio = get_value('trailingPE')
        
        # 2. Beta
        beta = get_value('beta')
        
        # 3. Free Cash Flow (FCF)
        fcf = get_value('freeCashflow')
        
        # 4. Current Ratio
        current_ratio = get_value('currentRatio')
        
        # 5. Quick Ratio (Acid Test Ratio)
        quick_ratio = get_value('quickRatio')
        
        # 6. Gearing Ratio (Debt to Equity)
        # Note: yf 'debtToEquity' is usually a percentage (e.g., 150 means 150%, or 1.5)
        # We will keep it as raw value representing percentage or decimal, depending on what yfinance returns.
        debt_to_equity = get_value('debtToEquity')
        
        # 7. Net Profit Margin
        # yf 'profitMargins' is usually a decimal (e.g. 0.25 = 25%)
        profit_margin = get_value('profitMargins')
        if profit_margin is not None:
            profit_margin = profit_margin * 100 # Convert to percentage
            
        # 8. Return on Capital Employed (ROCE)
        # ROCE = EBIT / Capital Employed
        # Capital Employed = Total Assets - Current Liabilities
        roce = None
        # Try to calculate ROCE if we can get the financials
        try:
            financials = stock.financials
            balance_sheet = stock.balance_sheet
            
            if not financials.empty and not balance_sheet.empty:
                # get most recent year
                col = financials.columns[0]
                col_bs = balance_sheet.columns[0]
                
                # EBIT
                ebit = None
                if 'EBIT' in financials.index:
                    ebit = financials.loc['EBIT', col]
                elif 'Operating Income' in financials.index:
                    ebit = financials.loc['Operating Income', col]
                    
                # Total Assets and Current Liabilities
                total_assets = None
                if 'Total Assets' in balance_sheet.index:
                    total_assets = balance_sheet.loc['Total Assets', col_bs]
                    
                current_liabilities = None
                if 'Total Current Liabilities' in balance_sheet.index:
                    current_liabilities = balance_sheet.loc['Total Current Liabilities', col_bs]
                elif 'Current Liabilities' in balance_sheet.index:
                    current_liabilities = balance_sheet.loc['Current Liabilities', col_bs]

                if ebit is not None and total_assets is not None and current_liabilities is not None:
                    capital_employed = total_assets - current_liabilities
                    if capital_employed != 0:
                        roce = (ebit / capital_employed) * 100 # percentage
        except Exception as e:
            # Fallback if manual calc fails, maybe use returnOnEquity as a rough proxy proxy if ROCE is strictly required but missing
            pass
            
# Removed autocomplete logic. Now we just fetch what is passed.
        
        result = {
            "success": True,
            "ticker": ticker.upper(),
            "metrics": {
                "pe_ratio": pe_ratio,
                "beta": beta,
                "free_cash_flow": fcf,
                "current_ratio": current_ratio,
                "quick_ratio": quick_ratio,
                "debt_to_equity": debt_to_equity,
                "net_profit_margin": profit_margin,
                "roce": roce
            }
        }
        return result
        
    except Exception as e:
        return {
            "success": False,
            "ticker": ticker,
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) > 1:
        ticker = sys.argv[1]
        print(json.dumps(fetch_financial_metrics(ticker), indent=2))
    else:
        print(json.dumps({"success": False, "error": "No ticker provided"}))
