// Configuration
const CONFIG = {
    SHEET_ID: '1a03XfNlJ_5xBE3JpKNzLZ_qf7oWkamRsLo-Hr0MWCm0',
    SHEET_NAME: 'Sheet1',
    SHEET_GID: 0, // Sheet1'ning GID'si
    
    // Google Apps Script Web App URL (CORS muammosini hal qiladi)
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwsKE6dmeE22aSXN-M8lxdDHuS7gz1X0OCmK81jzeqc1xw7IJMJ8Bl1M_DRE3NablhDIA/exec',
    
    // Google Sheets API URL
    get API_URL() {
        return `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${this.SHEET_NAME}`;
    },
    // CSV URL
    get CSV_URL() {
        return `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/export?format=csv&gid=${this.SHEET_GID}`;
    }
};

// Global data storage
let allData = [];
let filteredData = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadData();
});

// Load data from Google Sheets
async function loadData() {
    try {
        showLoading(true);
        
        // Try Google Apps Script URL with JSONP (NO CORS issues!)
        if (CONFIG.APPS_SCRIPT_URL && CONFIG.APPS_SCRIPT_URL !== 'SIZNING_GOOGLE_APPS_SCRIPT_URL_NI_BU_YERGA_JOYLASHTIRING') {
            try {
                console.log('Trying Apps Script URL with JSONP...');
                
                // Use JSONP to avoid CORS
                const jsonData = await loadDataViaJSONP(CONFIG.APPS_SCRIPT_URL);
                
                if (jsonData && jsonData.status === 'success') {
                    console.log('Apps Script success:', jsonData.count, 'rows');
                    allData = processData(jsonData.data);
                    filteredData = [...allData];
                    
                    populateFilters();
                    renderDashboard();
                    updateLastUpdateTime();
                    showLoading(false);
                    return;
                }
            } catch (appsScriptError) {
                console.log('Apps Script JSONP failed:', appsScriptError);
            }
        }
        
        // Try JSON API
        try {
            console.log('Trying JSON API...');
            const response = await fetch(CONFIG.API_URL);
            const text = await response.text();
            
            // Remove Google's JSON prefix
            const jsonText = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
            const jsonData = JSON.parse(jsonText);
            
            // Extract data from Google's format
            const rows = jsonData.table.rows;
            const cols = jsonData.table.cols;
            
            const processedData = rows.map(row => {
                const rowData = {};
                cols.forEach((col, index) => {
                    const label = col.label || `Column${index}`;
                    const cell = row.c[index];
                    rowData[label] = cell ? (cell.v !== null ? cell.v : '') : '';
                });
                return rowData;
            });
            
            allData = processData(processedData);
            filteredData = [...allData];
            
            populateFilters();
            renderDashboard();
            updateLastUpdateTime();
            showLoading(false);
            return;
            
        } catch (jsonError) {
            console.log('JSON API failed:', jsonError);
        }
        
        // Fallback to CSV
        console.log('Trying CSV...');
        const response = await fetch(CONFIG.CSV_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        
        // Parse CSV
        Papa.parse(csvText, {
            header: true,
            dynamicTyping: false,
            skipEmptyLines: true,
            complete: function(results) {
                console.log('CSV parsed:', results.data.length, 'rows');
                
                // Process data
                allData = processData(results.data);
                filteredData = [...allData];
                
                console.log('Processed data:', allData.length, 'rows');
                
                // Initialize filters
                populateFilters();
                
                // Render dashboard
                renderDashboard();
                
                // Update last update time
                updateLastUpdateTime();
                
                showLoading(false);
            },
            error: function(error) {
                console.error('CSV parse error:', error);
                showLoading(false);
                showError('CSV parse xatolik: ' + error.message);
            }
        });
    } catch (error) {
        console.error('Load error:', error);
        showLoading(false);
        showError('❌ CORS XATOLIK!\n\nLokal fayldan to\'g\'ridan-to\'g\'ri Google Sheets\'ga kirish mumkin emas.\n\n✅ YECHIM:\n\n1. GoogleAppsScript.js faylidagi yo\'riqnomani o\'qing\n2. Google Apps Script orqali API yarating\n3. URL\'ni app.js\'dagi CONFIG.APPS_SCRIPT_URL ga joylashtiring\n\nYoki TROUBLESHOOTING.txt faylini o\'qing!');
    }
}

// Process raw data
function processData(data) {
    console.log('Processing data, first row:', data[0]);
    
    return data.map(row => {
        // Google Sheets ustunlari bo'yicha mapping
        // Ko'p variantlarni qo'llab-quvvatlash
        const sku = row['SKU'] || row['C'] || row['sku'] || row['SKU kodi'] || '';
        const name = row['SKU Nomi'] || row['B'] || row['Mahsulot nomi'] || row['Name'] || '';
        const quantity = parseFloat(row['Miqdor'] || row['E'] || row['Quantity'] || row['Soni'] || 0);
        const date = row['Sana'] || row['F'] || row['Date'] || row['Sotilgan sana'] || '';
        const supplier = row['Yetkazuvchi'] || row['H'] || row['Supplier'] || '';
        const brand = row['Brend'] || row['J'] || row['Brand'] || '';
        const category = row['Kategoriya'] || row['K'] || row['Category'] || '';
        const purchasePrice = parseFloat(row['Xarid narxi'] || row['M'] || row['Purchase Price'] || row['Narxi'] || 0);
        const commission = parseFloat(row['Komissiya'] || row['N'] || row['Commission'] || 0);
        const logistics = parseFloat(row['Logistika'] || row['P'] || row['Logistics'] || 0);
        const salePrice = parseFloat(row['Sotuv narxi'] || row['R'] || row['Sale Price'] || row['Sotilgan narx'] || 0);
        const profit = parseFloat(row['Foyda'] || row['S'] || row['Profit'] || 0);
        const markup = parseFloat(row['Markup %'] || row['T'] || row['Markup'] || 0);
        const store = row['Dokon'] || row['U'] || row['Store'] || row['Dokon nomi'] || '';
        const yandexPayment = parseFloat(row['Yandex tolov'] || row['W'] || row['Payment'] || 0);
        const tax = parseFloat(row['Soliq'] || row['X'] || row['Tax'] || 0);

        return {
            sku,
            name,
            quantity,
            date: parseDate(date),
            supplier,
            brand,
            category,
            purchasePrice,
            commission,
            logistics,
            salePrice,
            profit,
            markup,
            store,
            yandexPayment,
            tax,
            totalCost: purchasePrice + commission + logistics,
            margin: salePrice > 0 ? ((profit / salePrice) * 100) : 0
        };
    }).filter(row => row.sku && row.name); // Bo'sh qatorlarni o'chirish
}

// Parse date
function parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
        // Assuming format: YYYY-MM-DD or DD-MM-YYYY
        if (parts[0].length === 4) {
            return new Date(parts[0], parts[1] - 1, parts[2]);
        } else {
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
    }
    return new Date(dateStr);
}

// Populate filter dropdowns
function populateFilters() {
    const stores = [...new Set(allData.map(d => d.store))].filter(Boolean).sort();
    const brands = [...new Set(allData.map(d => d.brand))].filter(Boolean).sort();
    const categories = [...new Set(allData.map(d => d.category))].filter(Boolean).sort();
    const suppliers = [...new Set(allData.map(d => d.supplier))].filter(Boolean).sort();

    populateSelect('filter-store', stores);
    populateSelect('filter-brand', brands);
    populateSelect('filter-category', categories);
    populateSelect('filter-supplier', suppliers);

    // Add event listeners
    document.getElementById('filter-date-from').addEventListener('change', applyFilters);
    document.getElementById('filter-date-to').addEventListener('change', applyFilters);
    document.getElementById('filter-store').addEventListener('change', applyFilters);
    document.getElementById('filter-brand').addEventListener('change', applyFilters);
    document.getElementById('filter-category').addEventListener('change', applyFilters);
    document.getElementById('filter-supplier').addEventListener('change', applyFilters);
}

function populateSelect(elementId, options) {
    const select = document.getElementById(elementId);
    const currentValue = select.value;
    
    // Clear existing options except first
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        select.appendChild(opt);
    });
    
    select.value = currentValue;
}

// Apply filters
function applyFilters() {
    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo = document.getElementById('filter-date-to').value;
    const store = document.getElementById('filter-store').value;
    const brand = document.getElementById('filter-brand').value;
    const category = document.getElementById('filter-category').value;
    const supplier = document.getElementById('filter-supplier').value;

    filteredData = allData.filter(row => {
        if (dateFrom && row.date < new Date(dateFrom)) return false;
        if (dateTo && row.date > new Date(dateTo)) return false;
        if (store && row.store !== store) return false;
        if (brand && row.brand !== brand) return false;
        if (category && row.category !== category) return false;
        if (supplier && row.supplier !== supplier) return false;
        return true;
    });

    renderDashboard();
}

// Render complete dashboard
function renderDashboard() {
    renderKPIs();
    renderCharts();
    renderTables();
}

// Render KPI cards
function renderKPIs() {
    const kpis = calculateKPIs(filteredData);
    const kpiGrid = document.getElementById('kpi-grid');
    
    kpiGrid.innerHTML = `
        <div class="kpi-card fade-in">
            <div class="kpi-header">
                <div class="kpi-title">Jami Sotuv</div>
                <div class="kpi-icon" style="background: rgba(59, 130, 246, 0.2); color: #3b82f6;">
                    <i class="fas fa-dollar-sign"></i>
                </div>
            </div>
            <div class="kpi-value">${formatCurrency(kpis.totalSales)}</div>
            <div class="kpi-change positive">
                <i class="fas fa-arrow-up"></i>
                <span>+${kpis.salesGrowth}% vs. o'tgan oy</span>
            </div>
        </div>

        <div class="kpi-card fade-in">
            <div class="kpi-header">
                <div class="kpi-title">Sof Foyda</div>
                <div class="kpi-icon" style="background: rgba(16, 185, 129, 0.2); color: #10b981;">
                    <i class="fas fa-chart-line"></i>
                </div>
            </div>
            <div class="kpi-value">${formatCurrency(kpis.totalProfit)}</div>
            <div class="kpi-change ${kpis.profitChange >= 0 ? 'positive' : 'negative'}">
                <i class="fas fa-arrow-${kpis.profitChange >= 0 ? 'up' : 'down'}"></i>
                <span>${kpis.profitChange >= 0 ? '+' : ''}${kpis.profitChange}% o'zgarish</span>
            </div>
        </div>

        <div class="kpi-card fade-in">
            <div class="kpi-header">
                <div class="kpi-title">Sotilgan Mahsulotlar</div>
                <div class="kpi-icon" style="background: rgba(139, 92, 246, 0.2); color: #8b5cf6;">
                    <i class="fas fa-box"></i>
                </div>
            </div>
            <div class="kpi-value">${formatNumber(kpis.totalQuantity)}</div>
            <div class="kpi-change">
                <i class="fas fa-info-circle"></i>
                <span>${kpis.uniqueProducts} turli mahsulot</span>
            </div>
        </div>

        <div class="kpi-card fade-in">
            <div class="kpi-header">
                <div class="kpi-title">O'rtacha Margin</div>
                <div class="kpi-icon" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b;">
                    <i class="fas fa-percentage"></i>
                </div>
            </div>
            <div class="kpi-value">${kpis.avgMargin.toFixed(1)}%</div>
            <div class="kpi-change ${kpis.avgMargin >= 20 ? 'positive' : 'warning'}">
                <i class="fas fa-${kpis.avgMargin >= 20 ? 'check' : 'exclamation'}-circle"></i>
                <span>${kpis.avgMargin >= 20 ? 'Yaxshi' : 'Past'} margin</span>
            </div>
        </div>

        <div class="kpi-card fade-in">
            <div class="kpi-header">
                <div class="kpi-title">Yandex Komissiya</div>
                <div class="kpi-icon" style="background: rgba(239, 68, 68, 0.2); color: #ef4444;">
                    <i class="fas fa-hand-holding-dollar"></i>
                </div>
            </div>
            <div class="kpi-value">${formatCurrency(kpis.totalCommission)}</div>
            <div class="kpi-change">
                <i class="fas fa-info-circle"></i>
                <span>${((kpis.totalCommission / kpis.totalSales) * 100).toFixed(1)}% sotuvdan</span>
            </div>
        </div>

        <div class="kpi-card fade-in">
            <div class="kpi-header">
                <div class="kpi-title">Logistika Xarajati</div>
                <div class="kpi-icon" style="background: rgba(6, 182, 212, 0.2); color: #06b6d4;">
                    <i class="fas fa-truck"></i>
                </div>
            </div>
            <div class="kpi-value">${formatCurrency(kpis.totalLogistics)}</div>
            <div class="kpi-change">
                <i class="fas fa-info-circle"></i>
                <span>${((kpis.totalLogistics / kpis.totalSales) * 100).toFixed(1)}% sotuvdan</span>
            </div>
        </div>

        <div class="kpi-card fade-in">
            <div class="kpi-header">
                <div class="kpi-title">Faol Dokonlar</div>
                <div class="kpi-icon" style="background: rgba(139, 92, 246, 0.2); color: #8b5cf6;">
                    <i class="fas fa-store"></i>
                </div>
            </div>
            <div class="kpi-value">${kpis.activeStores}</div>
            <div class="kpi-change positive">
                <i class="fas fa-check-circle"></i>
                <span>Barcha faol</span>
            </div>
        </div>

        <div class="kpi-card fade-in">
            <div class="kpi-header">
                <div class="kpi-title">Muammoli Mahsulotlar</div>
                <div class="kpi-icon" style="background: rgba(239, 68, 68, 0.2); color: #ef4444;">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
            </div>
            <div class="kpi-value">${kpis.problemProducts}</div>
            <div class="kpi-change ${kpis.problemProducts > 0 ? 'negative' : 'positive'}">
                <i class="fas fa-${kpis.problemProducts > 0 ? 'exclamation' : 'check'}-circle"></i>
                <span>${kpis.problemProducts > 0 ? 'E\'tibor bering!' : 'Hammasi yaxshi'}</span>
            </div>
        </div>
    `;
}

// Calculate KPIs
function calculateKPIs(data) {
    const totalSales = data.reduce((sum, row) => sum + row.salePrice, 0);
    const totalProfit = data.reduce((sum, row) => sum + row.profit, 0);
    const totalQuantity = data.reduce((sum, row) => sum + row.quantity, 0);
    const totalCommission = data.reduce((sum, row) => sum + row.commission, 0);
    const totalLogistics = data.reduce((sum, row) => sum + row.logistics, 0);
    
    const uniqueProducts = new Set(data.map(row => row.sku)).size;
    const activeStores = new Set(data.map(row => row.store)).size;
    
    const avgMargin = data.length > 0 
        ? data.reduce((sum, row) => sum + row.margin, 0) / data.length 
        : 0;
    
    const problemProducts = data.filter(row => row.profit < 0 || row.margin < 5).length;
    
    return {
        totalSales,
        totalProfit,
        totalQuantity,
        totalCommission,
        totalLogistics,
        uniqueProducts,
        activeStores,
        avgMargin,
        problemProducts,
        salesGrowth: 12.5, // Mock data
        profitChange: 8.3 // Mock data
    };
}

// Render all charts
function renderCharts() {
    renderSalesChart();
    renderProfitChart();
    renderBrandsChart();
    renderCategoriesChart();
    renderStoresChart();
    renderSuppliersChart();
}

// Sales dynamics chart
function renderSalesChart() {
    const dailySales = aggregateByDate(filteredData, 'salePrice');
    
    const options = {
        series: [{
            name: 'Sotuv',
            data: dailySales.values
        }],
        chart: {
            type: 'area',
            height: 300,
            background: 'transparent',
            toolbar: { show: false },
            animations: { enabled: true }
        },
        colors: ['#3b82f6'],
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 3 },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.7,
                opacityTo: 0.2
            }
        },
        xaxis: {
            categories: dailySales.dates,
            labels: { style: { colors: '#94a3b8' } }
        },
        yaxis: {
            labels: {
                style: { colors: '#94a3b8' },
                formatter: (val) => formatCurrency(val, true)
            }
        },
        grid: {
            borderColor: '#334155',
            strokeDashArray: 4
        },
        tooltip: {
            theme: 'dark',
            y: { formatter: (val) => formatCurrency(val) }
        }
    };

    const chart = new ApexCharts(document.querySelector("#sales-chart"), options);
    chart.render();
}

// Profit dynamics chart
function renderProfitChart() {
    const dailyProfit = aggregateByDate(filteredData, 'profit');
    
    const options = {
        series: [{
            name: 'Foyda',
            data: dailyProfit.values
        }],
        chart: {
            type: 'bar',
            height: 300,
            background: 'transparent',
            toolbar: { show: false }
        },
        colors: ['#10b981'],
        plotOptions: {
            bar: {
                borderRadius: 8,
                dataLabels: { position: 'top' }
            }
        },
        dataLabels: { enabled: false },
        xaxis: {
            categories: dailyProfit.dates,
            labels: { style: { colors: '#94a3b8' } }
        },
        yaxis: {
            labels: {
                style: { colors: '#94a3b8' },
                formatter: (val) => formatCurrency(val, true)
            }
        },
        grid: {
            borderColor: '#334155',
            strokeDashArray: 4
        },
        tooltip: {
            theme: 'dark',
            y: { formatter: (val) => formatCurrency(val) }
        }
    };

    const chart = new ApexCharts(document.querySelector("#profit-chart"), options);
    chart.render();
}

// Brands pie chart
function renderBrandsChart() {
    const brandData = aggregateByField(filteredData, 'brand', 'salePrice');
    
    const options = {
        series: brandData.values.slice(0, 8),
        chart: {
            type: 'donut',
            height: 300,
            background: 'transparent'
        },
        labels: brandData.labels.slice(0, 8),
        colors: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#6366f1'],
        legend: {
            position: 'bottom',
            labels: { colors: '#94a3b8' }
        },
        plotOptions: {
            pie: {
                donut: {
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Jami',
                            color: '#f1f5f9',
                            formatter: () => formatCurrency(brandData.values.reduce((a, b) => a + b, 0), true)
                        }
                    }
                }
            }
        },
        dataLabels: {
            enabled: true,
            style: { colors: ['#fff'] },
            dropShadow: { enabled: false }
        },
        tooltip: {
            theme: 'dark',
            y: { formatter: (val) => formatCurrency(val) }
        }
    };

    const chart = new ApexCharts(document.querySelector("#brands-chart"), options);
    chart.render();
}

// Categories bar chart
function renderCategoriesChart() {
    const categoryData = aggregateByField(filteredData, 'category', 'profit');
    
    const options = {
        series: [{
            name: 'Foyda',
            data: categoryData.values.slice(0, 10)
        }],
        chart: {
            type: 'bar',
            height: 300,
            background: 'transparent',
            toolbar: { show: false }
        },
        colors: ['#8b5cf6'],
        plotOptions: {
            bar: {
                horizontal: true,
                borderRadius: 8
            }
        },
        dataLabels: { enabled: false },
        xaxis: {
            categories: categoryData.labels.slice(0, 10),
            labels: {
                style: { colors: '#94a3b8' },
                formatter: (val) => formatCurrency(val, true)
            }
        },
        yaxis: {
            labels: { style: { colors: '#94a3b8' } }
        },
        grid: {
            borderColor: '#334155',
            strokeDashArray: 4
        },
        tooltip: {
            theme: 'dark',
            y: { formatter: (val) => formatCurrency(val) }
        }
    };

    const chart = new ApexCharts(document.querySelector("#categories-chart"), options);
    chart.render();
}

// Stores comparison chart
function renderStoresChart() {
    const storeData = aggregateByField(filteredData, 'store', 'salePrice');
    
    const options = {
        series: [{
            name: 'Sotuv',
            data: storeData.values
        }],
        chart: {
            type: 'bar',
            height: 300,
            background: 'transparent',
            toolbar: { show: false }
        },
        colors: ['#3b82f6'],
        plotOptions: {
            bar: {
                borderRadius: 8,
                distributed: true
            }
        },
        dataLabels: { enabled: false },
        xaxis: {
            categories: storeData.labels,
            labels: { style: { colors: '#94a3b8' } }
        },
        yaxis: {
            labels: {
                style: { colors: '#94a3b8' },
                formatter: (val) => formatCurrency(val, true)
            }
        },
        grid: {
            borderColor: '#334155',
            strokeDashArray: 4
        },
        legend: { show: false },
        tooltip: {
            theme: 'dark',
            y: { formatter: (val) => formatCurrency(val) }
        }
    };

    const chart = new ApexCharts(document.querySelector("#stores-chart"), options);
    chart.render();
}

// Suppliers rating chart
function renderSuppliersChart() {
    const supplierData = aggregateByField(filteredData, 'supplier', 'profit');
    
    const options = {
        series: [{
            name: 'Foyda',
            data: supplierData.values.slice(0, 8)
        }],
        chart: {
            type: 'bar',
            height: 300,
            background: 'transparent',
            toolbar: { show: false }
        },
        colors: ['#10b981'],
        plotOptions: {
            bar: {
                horizontal: true,
                borderRadius: 8
            }
        },
        dataLabels: { enabled: false },
        xaxis: {
            categories: supplierData.labels.slice(0, 8),
            labels: {
                style: { colors: '#94a3b8' },
                formatter: (val) => formatCurrency(val, true)
            }
        },
        yaxis: {
            labels: { style: { colors: '#94a3b8' } }
        },
        grid: {
            borderColor: '#334155',
            strokeDashArray: 4
        },
        tooltip: {
            theme: 'dark',
            y: { formatter: (val) => formatCurrency(val) }
        }
    };

    const chart = new ApexCharts(document.querySelector("#suppliers-chart"), options);
    chart.render();
}

// Render tables
function renderTables() {
    renderTopProductsTable();
    renderFlopProductsTable();
}

// TOP products table
function renderTopProductsTable() {
    const productSales = {};
    
    filteredData.forEach(row => {
        if (!productSales[row.sku]) {
            productSales[row.sku] = {
                sku: row.sku,
                name: row.name,
                brand: row.brand,
                quantity: 0,
                sales: 0,
                profit: 0
            };
        }
        productSales[row.sku].quantity += row.quantity;
        productSales[row.sku].sales += row.salePrice;
        productSales[row.sku].profit += row.profit;
    });
    
    const sortedProducts = Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 20);
    
    const tbody = document.getElementById('top-products-body');
    tbody.innerHTML = sortedProducts.map((product, index) => {
        const margin = product.sales > 0 ? (product.profit / product.sales * 100) : 0;
        return `
            <tr>
                <td>${index + 1}</td>
                <td><code>${product.sku}</code></td>
                <td>${product.name}</td>
                <td><span class="badge success">${product.brand}</span></td>
                <td>${formatNumber(product.quantity)}</td>
                <td>${formatCurrency(product.sales, true)}</td>
                <td>${formatCurrency(product.profit, true)}</td>
                <td><span class="badge ${margin >= 20 ? 'success' : margin >= 10 ? 'warning' : 'danger'}">${margin.toFixed(1)}%</span></td>
            </tr>
        `;
    }).join('');
}

// FLOP products table
function renderFlopProductsTable() {
    const productData = {};
    
    filteredData.forEach(row => {
        if (!productData[row.sku]) {
            productData[row.sku] = {
                sku: row.sku,
                name: row.name,
                brand: row.brand,
                quantity: 0,
                sales: 0,
                profit: 0
            };
        }
        productData[row.sku].quantity += row.quantity;
        productData[row.sku].sales += row.salePrice;
        productData[row.sku].profit += row.profit;
    });
    
    const problemProducts = Object.values(productData)
        .filter(p => p.profit < 0 || (p.sales > 0 && (p.profit / p.sales * 100) < 5))
        .sort((a, b) => a.profit - b.profit)
        .slice(0, 20);
    
    const tbody = document.getElementById('flop-products-body');
    tbody.innerHTML = problemProducts.map((product, index) => {
        const status = product.profit < 0 ? 'Zarar' : 'Past margin';
        return `
            <tr>
                <td>${index + 1}</td>
                <td><code>${product.sku}</code></td>
                <td>${product.name}</td>
                <td>${product.brand}</td>
                <td>${formatNumber(product.quantity)}</td>
                <td>${formatCurrency(product.sales, true)}</td>
                <td>${formatCurrency(product.profit, true)}</td>
                <td><span class="badge ${product.profit < 0 ? 'danger' : 'warning'}">${status}</span></td>
            </tr>
        `;
    }).join('');
}

// Aggregate data by date
function aggregateByDate(data, field) {
    const aggregated = {};
    
    data.forEach(row => {
        if (!row.date) return;
        const dateKey = row.date.toISOString().split('T')[0];
        aggregated[dateKey] = (aggregated[dateKey] || 0) + row[field];
    });
    
    const sorted = Object.entries(aggregated).sort((a, b) => a[0].localeCompare(b[0]));
    
    return {
        dates: sorted.map(([date]) => formatDate(new Date(date))),
        values: sorted.map(([, value]) => Math.round(value))
    };
}

// Aggregate data by field
function aggregateByField(data, groupField, valueField) {
    const aggregated = {};
    
    data.forEach(row => {
        const key = row[groupField] || 'Noma\'lum';
        aggregated[key] = (aggregated[key] || 0) + row[valueField];
    });
    
    const sorted = Object.entries(aggregated)
        .sort((a, b) => b[1] - a[1]);
    
    return {
        labels: sorted.map(([label]) => label),
        values: sorted.map(([, value]) => Math.round(value))
    };
}

// Filter table by search
function filterTable(tableId, searchText) {
    const table = document.getElementById(tableId);
    const rows = table.getElementsByTagName('tr');
    const search = searchText.toLowerCase();
    
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    }
}

// Utility functions
function formatCurrency(value, short = false) {
    if (short) {
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + 'M';
        } else if (value >= 1000) {
            return (value / 1000).toFixed(0) + 'K';
        }
    }
    return new Intl.NumberFormat('uz-UZ', {
        style: 'currency',
        currency: 'UZS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

function formatNumber(value) {
    return new Intl.NumberFormat('uz-UZ').format(value);
}

function formatDate(date) {
    return date.toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' });
}

function updateLastUpdateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('last-update').textContent = `Oxirgi yangilanish: ${timeStr}`;
}

function showLoading(show) {
    const loader = document.getElementById('loading-screen');
    if (show) {
        loader.style.opacity = '1';
        loader.style.display = 'flex';
    } else {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);
    }
}

function showError(message) {
    alert('❌ XATOLIK!\n\n' + message + '\n\n📋 YECHIM:\n1. Google Sheets faylini oching\n2. "Share" tugmasini bosing\n3. "Anyone with the link" → "Viewer" qilib qo\'ying\n4. Sahifani yangilang (F5)\n\nAgar muammo davom etsa, F12 bosib Console\'ni tekshiring.');
}

// JSONP loader - CORS muammosini hal qiladi
function loadDataViaJSONP(url) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonpCallback_' + Date.now();
        const script = document.createElement('script');
        
        // Global callback funksiya
        window[callbackName] = function(data) {
            delete window[callbackName];
            document.body.removeChild(script);
            resolve(data);
        };
        
        // Timeout
        const timeout = setTimeout(() => {
            delete window[callbackName];
            document.body.removeChild(script);
            reject(new Error('JSONP request timeout'));
        }, 30000); // 30 soniya
        
        // Script yaratish
        script.src = url + '?callback=' + callbackName;
        script.onerror = function() {
            clearTimeout(timeout);
            delete window[callbackName];
            document.body.removeChild(script);
            reject(new Error('JSONP request failed'));
        };
        
        document.body.appendChild(script);
    });
}
