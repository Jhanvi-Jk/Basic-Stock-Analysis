// Theme Toggle
const themeToggle = document.getElementById('themeToggle');
const body = document.body;

themeToggle.addEventListener('click', () => {
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    body.setAttribute('data-theme', newTheme);
});

// Elements
const tickerInput1 = document.getElementById('tickerInput1');
const tickerInput2 = document.getElementById('tickerInput2');
const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('errorMessage');
const resultsContainer = document.getElementById('resultsContainer');
const tableHeaderRow = document.getElementById('tableHeaderRow');
const tableBody = document.getElementById('tableBody');
const chartLegend = document.getElementById('chartLegend');
let radarChartInstance = null;

let currentMode = 'single';

// Mode Toggle Setup
const modeRadios = document.querySelectorAll('input[name="analysisMode"]');
modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        currentMode = e.target.value;
        if (currentMode === 'compare') {
            tickerInput1.placeholder = "Stock 1 (e.g. AAPL)";
            tickerInput2.classList.remove('hidden');
        } else {
            tickerInput1.placeholder = "Enter stock ticker (e.g., AAPL)";
            tickerInput2.classList.add('hidden');
        }
    });
});

// Setup Table Headers based on mode
function updateTableHeaders() {
    tableHeaderRow.innerHTML = '';
    const thMetric = document.createElement('th'); thMetric.textContent = 'Metric';
    tableHeaderRow.appendChild(thMetric);
    
    if (currentMode === 'single') {
        const thActual = document.createElement('th'); thActual.textContent = 'Actual Value';
        const thIdeal = document.createElement('th'); thIdeal.textContent = 'Ideal Range';
        const thStatus = document.createElement('th'); thStatus.textContent = 'Status';
        tableHeaderRow.appendChild(thActual);
        tableHeaderRow.appendChild(thIdeal);
        tableHeaderRow.appendChild(thStatus);
    } else {
        const thS1 = document.createElement('th'); thS1.textContent = 'Stock 1';
        const thS2 = document.createElement('th'); thS2.textContent = 'Stock 2';
        const thIdeal = document.createElement('th'); thIdeal.textContent = 'Ideal Range';
        tableHeaderRow.appendChild(thS1);
        tableHeaderRow.appendChild(thS2);
        tableHeaderRow.appendChild(thIdeal);
    }
}

// Metric Configurations
const metricsConfig = [
    { key: 'pe_ratio', label: 'Price to Earnings', ideal: '10 - 25', format: val => val ? val.toFixed(2) : 'N/A' },
    { key: 'roce', label: 'Return on Capital Employed', ideal: '> 15%', format: val => val ? val.toFixed(2) + '%' : 'N/A' },
    { key: 'net_profit_margin', label: 'Net Profit Margin', ideal: '> 10%', format: val => val ? val.toFixed(2) + '%' : 'N/A' },
    { key: 'free_cash_flow', label: 'Free Cash Flow', ideal: '> 0', format: val => val ? '$' + (val / 1e9).toFixed(2) + 'B' : 'N/A' },
    { key: 'current_ratio', label: 'Current Ratio', ideal: '1.2 - 2.0', format: val => val ? val.toFixed(2) : 'N/A' },
    { key: 'inventory_spread', label: 'Inventory Spread', ideal: 'Spread < 0.5', format: val => val ? val.toFixed(2) : 'N/A' },
    { key: 'debt_to_equity', label: 'Debt to Equity', ideal: '< 100%', format: val => val ? val.toFixed(2) + '%' : 'N/A' },
    { key: 'beta', label: 'Beta', ideal: 'Depends on Risk', format: val => val ? val.toFixed(2) : 'N/A' },
];

let currentData = null; // Store fetched data

analyzeBtn.addEventListener('click', analyzeStock);
tickerInput1.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') analyzeStock();
});
tickerInput2.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') analyzeStock();
});

const riskRadios = document.querySelectorAll('input[name="riskPreference"]');
riskRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        if (currentData) {
            processAndRender(currentData);
        }
    });
});

async function analyzeStock() {
    const t1 = tickerInput1.value.trim().toUpperCase();
    const t2 = tickerInput2.value.trim().toUpperCase();
    if (!t1) return;
    if (currentMode === 'compare' && !t2) return;

    // Reset UI
    resultsContainer.classList.add('hidden');
    errorMessage.classList.add('hidden');
    loading.classList.remove('hidden');
    
    updateTableHeaders();

    try {
        let url = `/api/analyze?ticker1=${encodeURIComponent(t1)}`;
        if (currentMode === 'compare') {
            url += `&ticker2=${encodeURIComponent(t2)}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        loading.classList.add('hidden');

        if (!data.success) {
            errorMessage.textContent = data.error || 'Failed to fetch data.';
            errorMessage.classList.remove('hidden');
            return;
        }

        currentData = data;
        processAndRender(data);
        resultsContainer.classList.remove('hidden');

    } catch (err) {
        loading.classList.add('hidden');
        errorMessage.textContent = 'An error occurred while connecting to the server.';
        errorMessage.classList.remove('hidden');
    }
}

function normalizeScore(key, value, metrics) {
    if (value === null || value === undefined) return 0; // Default center if missing
    
    // Normalize to 0 - 100 scale (100 is best edge, 0 is center)
    // Heuristics:
    switch(key) {
        case 'pe_ratio':
            // PE: Lower positive is better. e.g. 10 is 100, 50 is 20. Neg PE is bad (0).
            if (value <= 0) return 0;
            if (value >= 100) return 10;
            return Math.max(0, 100 - ((value - 10) * 1.25)); 
        case 'roce':
            // ROCE: Higher is better. >30 is 100, 0 is 0. 
            if (value < 0) return 0;
            return Math.min(100, (value / 30) * 100);
        case 'net_profit_margin':
            // High is better. > 40 is 100.
            if (value < 0) return 0;
            return Math.min(100, (value / 40) * 100);
        case 'free_cash_flow':
            // Positive FCF is good, we'll just give a high score if > 0, low if < 0.
            return value > 0 ? 80 : 0;
        case 'current_ratio':
            // Ideal 1.5 - 2.0
            if (value < 1) return (value / 1) * 30; // 0-30 for bad range
            if (value >= 1.2 && value <= 2.5) return 100;
            if (value > 2.5) return 80; // slightly inefficient
            return 50;
        case 'inventory_spread':
            // Diff between current and quick
            return Math.max(0, 100 - (value * 100)); // Spread of 1 = 0 score, 0 = 100 score
        case 'debt_to_equity':
            // Lower is better. <30 is 100, > 200 is 0
            if (value < 0) return 0; // Usually error
            if (value > 200) return 0;
            return Math.max(0, 100 - (value / 2));
        case 'beta':
            const pref = document.querySelector('input[name="riskPreference"]:checked').value;
            if (pref === 'conservative') {
                // Lower is better
                if (value < 0.5) return 100;
                if (value > 2.0) return 0;
                return Math.max(0, 100 - ((value - 0.5) * 66));
            } else {
                // Aggressive, higher is better
                if (value > 1.5) return 100;
                if (value < 0.5) return 0;
                return Math.min(100, (value - 0.5) * 100);
            }
        default:
            return 50;
    }
}

function checkOutsideIdeal(key, value) {
    if (value === null || value === undefined) return false;
    
    switch(key) {
        case 'pe_ratio': return value < 10 || value > 25;
        case 'roce': return value < 15;
        case 'net_profit_margin': return value < 10;
        case 'free_cash_flow': return value <= 0;
        case 'current_ratio': return value < 1.2 || value > 2.0;
        case 'inventory_spread': return value >= 0.5;
        case 'debt_to_equity': return value >= 100;
        case 'beta': 
            const pref2 = document.querySelector('input[name="riskPreference"]:checked').value;
            if (pref2 === 'conservative') return value > 1.2;
            return value < 0.8;
        default: return false;
    }
}

function processAndRender(data) {

    const s1Data = data.ticker1_data;
    const s2Data = data.ticker2_data; // nullable

    // Calculate inventory spread for s1
    const current1 = s1Data.metrics.current_ratio;
    const quick1 = s1Data.metrics.quick_ratio;
    const spread1 = (current1 !== null && quick1 !== null) ? (current1 - quick1) : null;
    const enriched1 = { ...s1Data.metrics, inventory_spread: spread1 };
    
    let enriched2 = null;
    if (currentMode === 'compare' && s2Data) {
        const current2 = s2Data.metrics.current_ratio;
        const quick2 = s2Data.metrics.quick_ratio;
        const spread2 = (current2 !== null && quick2 !== null) ? (current2 - quick2) : null;
        enriched2 = { ...s2Data.metrics, inventory_spread: spread2 };
        
        // update chart legend labels
        document.querySelector('.badge-stock1').nextSibling.textContent = ` ${s1Data.ticker}`;
        document.querySelector('.badge-stock2').nextSibling.textContent = ` ${s2Data.ticker}`;
        chartLegend.classList.remove('hidden');
    } else {
        chartLegend.classList.add('hidden');
    }

    const labels = [];
    const scores1 = [];
    const scores2 = [];
    
    tableBody.innerHTML = '';
    const isDarkMode = document.body.getAttribute('data-theme') === 'dark';

    metricsConfig.forEach((config, index) => {
        labels.push(config.label);
        
        // Stock 1 Variables
        const val1 = enriched1[config.key];
        const score1 = normalizeScore(config.key, val1, enriched1);
        const isBad1 = checkOutsideIdeal(config.key, val1);
        scores1.push(score1);

        // Stock 2 Variables
        let val2 = null, score2 = null, isBad2 = false;
        if (enriched2) {
            val2 = enriched2[config.key];
            score2 = normalizeScore(config.key, val2, enriched2);
            isBad2 = checkOutsideIdeal(config.key, val2);
            scores2.push(score2);
        }

        // Determine if there is a worse score in compare mode
        let s1Worse = false;
        let s2Worse = false;
        if (currentMode === 'compare' && score1 !== null && score2 !== null) {
            if (score1 < score2) s1Worse = true;
            else if (score2 < score1) s2Worse = true;
        }

        const tr = document.createElement('tr');
        tr.id = `row-${index}`;
        
        const tdMetric = document.createElement('td');
        tdMetric.textContent = config.label;
        tr.appendChild(tdMetric);
        
        // Stock 1 Column
        const tdS1 = document.createElement('td');
        const spanS1 = document.createElement('span');
        spanS1.className = 'value-box value-box-stock1';
        if (isBad1) {
            spanS1.classList.add('value-bad');
        } else if (s1Worse) {
            spanS1.classList.add('value-worse');
        }
        spanS1.textContent = config.format(val1);
        tdS1.appendChild(spanS1);
        
        if (currentMode === 'single') {
            // For single mode we have a separate status column
        } else {
            // Compare mode: add bad text inline
            const statusSpan1 = document.createElement('div');
            statusSpan1.style.fontSize = '0.8rem';
            statusSpan1.style.marginTop = '0.3rem';
            statusSpan1.textContent = isBad1 ? 'Suboptimal' : '';
            if(isBad1) statusSpan1.style.color = 'var(--ring-bad)';
            tdS1.appendChild(statusSpan1);
        }
        tr.appendChild(tdS1);
        
        // Stock 2 Column (Compare Mode only)
        if (currentMode === 'compare') {
            const tdS2 = document.createElement('td');
            const spanS2 = document.createElement('span');
            spanS2.className = 'value-box value-box-stock2';
            if (isBad2) {
                spanS2.classList.add('value-bad');
            } else if (s2Worse) {
                spanS2.classList.add('value-worse');
            }
            spanS2.textContent = config.format(val2);
            tdS2.appendChild(spanS2);
            
            const statusSpan2 = document.createElement('div');
            statusSpan2.style.fontSize = '0.8rem';
            statusSpan2.style.marginTop = '0.3rem';
            statusSpan2.textContent = isBad2 ? 'Suboptimal' : '';
            if(isBad2) statusSpan2.style.color = 'var(--ring-bad)';
            tdS2.appendChild(statusSpan2);
            
            tr.appendChild(tdS2);
        }

        // Ideal Range Column
        const tdIdeal = document.createElement('td');
        tdIdeal.textContent = config.ideal;
        tr.appendChild(tdIdeal);
        
        // Status Column (Single Mode only)
        if (currentMode === 'single') {
            const tdStatus = document.createElement('td');
            tdStatus.textContent = isBad1 ? 'Suboptimal' : (val1 === null ? 'Missing' : 'Normal');
            if(isBad1) tdStatus.style.color = 'var(--ring-bad)';
            tr.appendChild(tdStatus);
        }
        
        tableBody.appendChild(tr);
    });

    renderChart(labels, scores1, (currentMode === 'compare' && scores2.length > 0) ? { name: s2Data.ticker, data: scores2 } : null);
}

function renderChart(labels, data, competitorData) {
    const ctx = document.getElementById('radarChart').getContext('2d');
    
    if (radarChartInstance) {
        radarChartInstance.destroy();
    }

    const cssTheme = getComputedStyle(document.body);
    const accentPrimary = cssTheme.getPropertyValue('--accent-primary').trim();
    const accentSecondary = cssTheme.getPropertyValue('--accent-secondary').trim();
    const textPrimary = cssTheme.getPropertyValue('--text-primary').trim();

    const datasets = [{
        label: 'Efficiency Score',
        data: data,
        backgroundColor: 'rgba(14, 165, 233, 0.2)',
        borderColor: accentPrimary,
        pointBackgroundColor: accentSecondary,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: accentPrimary, 
        borderWidth: 2,
    }];

    if (competitorData) {
        datasets.push({
            label: `${competitorData.name} (Competitor) Score`,
            data: competitorData.data,
            backgroundColor: 'rgba(168, 85, 247, 0.2)', // Translucent purple
            borderColor: 'rgba(168, 85, 247, 0.8)',
            pointBackgroundColor: 'rgba(168, 85, 247, 1)',
            pointBorderColor: '#fff',
            borderWidth: 2,
        });
    }

    radarChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { left: 40, right: 40 } // Keep labels from cropping at edges
            },
            scales: {
                r: {
                    angleLines: { color: cssTheme.getPropertyValue('--border-color') },
                    grid: { color: cssTheme.getPropertyValue('--border-color') },
                    pointLabels: {
                        color: textPrimary,
                        font: { family: 'Outfit', size: 12, weight: '500' }
                    },
                    ticks: {
                        display: false, // hide the 0-100 numbers inside
                        max: 100,
                        min: 0
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Score: ${context.raw.toFixed(0)}/100`;
                        }
                    }
                }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const element = elements[0];
                    const index = element.index;
                    const datasetIndex = element.datasetIndex; // 0 = Stock 1, 1 = Stock 2
                    
                    highlightRow(index, datasetIndex);
                }
            }
        }
    });
}

function highlightRow(index, datasetIndex = 0) {
    // Remove existing highlights
    document.querySelectorAll('tr[id^="row-"]').forEach(el => {
        el.classList.remove('row-highlight-stock1', 'row-highlight-stock2', 'row-highlight-both');
    });

    const row = document.getElementById(`row-${index}`);
    if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // force reflow
        void row.offsetWidth;
        
        if (currentMode === 'compare') {
            const val1 = radarChartInstance.data.datasets[0].data[index];
            const val2 = radarChartInstance.data.datasets[1].data[index];
            if (val1 === val2 && val1 !== null) {
                row.classList.add('row-highlight-both');
            } else if (datasetIndex === 0) {
                row.classList.add('row-highlight-stock1');
            } else {
                row.classList.add('row-highlight-stock2');
            }
        } else {
            row.classList.add('row-highlight-both'); // Defaults to yellow
        }
        
        setTimeout(() => {
            row.classList.remove('row-highlight-stock1', 'row-highlight-stock2', 'row-highlight-both');
        }, 3000);
    }
}
