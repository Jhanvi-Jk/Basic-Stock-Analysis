# Stock Analysis Process

## Overview
This directive outlines the process of fetching key financial metrics for a specific US stock ticker. The primary tool to execute this process is `execution/fetch_stock_data.py`.

## Required Inputs
- `ticker`: A valid US Stock ticker symbol (e.g., AAPL, MSFT, TSLA).

## Execution Details
The deterministic script `execution/fetch_stock_data.py` should be used to retrieve the following metrics:
1. Return on Capital Employed (ROCE)
2. Price to Earnings (PE)
3. Beta
4. Free Cash Flow (FCF)
5. Current Ratio
6. Quick Ratio (Acid Test Ratio)
7. Gearing Ratio (Debt to Equity)
8. Net Profit Margin

## Output Format
The execution script should output a JSON string or dictionary with raw values, ready to be consumed by the frontend for visualization.

## Edge Cases and Error Handling
- Invalid ticker: Ensure the script handles non-existent tickers gracefully.
- Missing data: If a specific metric is missing from the API source, default it to `null` or handle it gracefully so the rest of the application doesn't crash.
