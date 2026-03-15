from flask import Flask, render_template, request, jsonify
import sys
import os

# Add execution directory to path so we can import our script directly if needed
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'execution')))
from fetch_stock_data import fetch_financial_metrics

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/analyze')
def analyze():
    ticker1 = request.args.get('ticker1')
    ticker2 = request.args.get('ticker2')
    
    if not ticker1:
        return jsonify({"success": False, "error": "No primary ticker provided"}), 400
    
    # Execute the deterministic script for ticker 1
    result1 = fetch_financial_metrics(ticker1)
    if not result1.get("success"):
        return jsonify(result1), 400

    response = {
        "success": True,
        "ticker1_data": result1
    }

    # If comparison mode, fetch ticker 2
    if ticker2:
        result2 = fetch_financial_metrics(ticker2)
        if not result2.get("success"):
            return jsonify({"success": False, "error": f"Failed to fetch data for competitor {ticker2}"}), 400
        response["ticker2_data"] = result2

    return jsonify(response), 200

if __name__ == '__main__':
    app.run(debug=True, port=8080)
