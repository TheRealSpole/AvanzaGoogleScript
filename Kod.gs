/**
* GS AZ-fuldata v1.0.2 -25 Juli 2018-
*/
 
function azPost(id, ma, single, chartRes) {
 
  var azPost_url = 'https://www.avanza.se/ab/component/highstockchart/getchart/orderbook';
  var cacheTime = 21600; // 21600s = 6 hour
 
  id = id || false;
  ma = ma || false;
  single = single || false;
  chartRes = chartRes || false;
 
  // check if cached
  var cacheString = 'cache_' + id.toString() + ma + single + chartRes;
  var cache = CacheService.getScriptCache();
  var cacheData = cache.get(cacheString);
 
  if(!id) return 'Inget id definierat';
 
  if(id){
   
    var json = '{"orderbookId":%id%,"chartType":"AREA","widthOfPlotContainer":558,"chartResolution":"MONTH","navigator":true,"percentage":false,"volume":false,"owners":false,"timePeriod":"year","ta":[]}';
    json = json.replace('%id%', id);
    if(chartRes)
      json = json.replace('MONTH', chartRes);
   
    if( ma ){
      json = json.replace('[]', '[{"type":"sma","timeFrame": '+ ma +'}]');
    }
   
    // make the request
    var options = {
      'method' : 'post',
      'contentType': 'application/json',
      'payload' : json,
      'muteHttpExceptions': true
    }
   
    var response, data;
   
    if(cacheData != null) {
      data = cacheData;
    }
    else {
      response = UrlFetchApp.fetch(azPost_url, options);
      data = response.getContentText();
      cache.put(cacheString, data, cacheTime); // cache for 1 hour
    }
    // Debug print out
    //var rows = [];
    //rows.push([data, 1]);
    //return rows;
    
    var data = JSON.parse(data);
    var dataPoints = data.dataPoints;
    if(!dataPoints)
      dataPoints = data.marketMakerBidPoints;
    var len = dataPoints.length;
   
    // check if ma set
    if( ma )
    {
      var maData = data.technicalAnalysis[0]['dataPoints'];
    }
   
    var rows = [], data, i=0;
    var maPos = len-maData.length+1;
   
    for (i; i<len; i++) {
     
      cur = dataPoints[i];
      var date = cur[0],
          nav = cur[1];
     
      var jsdate = new Date(date),
          year = jsdate.getFullYear(),
          month = jsdate.getMonth() + 1, // jsdate = 0 based index
            day = jsdate.getDate();
     
      if( month < 10 ) { month = '0' + month; } // add leading zero
      if( day < 10 ) { day = '0' + day; } // add leading zero
     
      var ymd = year +'-'+ month + '-' + day;
     
      if( ma ) {
        var cur_sma;
        if ( maData[i-maPos+1] ){
          cur_sma = maData[i-maPos+1][1]; // sma-index is index-1
        }
        else { cur_sma = ''; }
      }
     
      // last point did not have ma, must find latest ma (since 1 year data does not include 100% of all MA-points)
      if( ma && cur_sma === '' ){
        cur_sma = maData[maData.length-1];
      }
      if( !single ){
        if( !ma ) { rows.push([ymd, nav]); }
        else { rows.push([ymd, nav, cur_sma]); }
      }
      else {
        if( !ma ) { rows.push([nav]); }
        else { rows.push([nav, cur_sma, data.changeSinceOneMonth]); }
      }
     
    } // end loop
   
    // set headers
    if(ma) { rows.unshift(['Datum', 'Kurs', 'MA'+ma]); }
    else { rows.unshift(['Datum', 'Kurs']); }
   
    // check if user wants single (value)
    if( single ) {
      var len = rows.length,
          lastRow = rows[len-1];
     
      rows = [lastRow];
    }
   
    return rows;
   
  }
 
} // azPost()
 
// hämta senaste kurs
function azNav(id, ma, res){
  return azPost(id, ma, true, "MONTH");
}
 
function toPercent(val){
  return Math.round(val*10000)/100;
}
 
/* hämta 1 mån, 3 mån, 6 mån etc */
function azPerf(id,ma,cacheTime){
 
  id = id || false;
  ma = ma || 10;
  cacheTime = cacheTime || 21600; // 6 hours
 
  if(!id) return 'no id was set';
 
 //azFund_url = 'https://www.avanza.se/_mobile/market/fund/{id}'
  var azFund_url = 'https://www.avanza.se/_api/fund-guide/guide/{id}',
      //azStock_url = 'https://www.avanza.se/_mobile/market/stock/{id}',
      azStock_url = 'https://www.avanza.se/_api/market-guide/stock/{id}',
      check_url = 'https://www.avanza.se/_mobile/market/orderbooklist/{id}',
      azIndex_url = 'https://www.avanza.se/_api/market-index/{id}',
      response, data, rows = [], url;
 
  // options for all requests
  var options = {
    "muteHttpExceptions":true
  }
 
 
  // first check what type something is, can be either FUND or something else
  // all 'something' else has a different format, but the *SAME* format
 
  // check if cached
  var cacheString = 'check_' + id.toString() + ma;
  var cache = CacheService.getScriptCache();
  var cacheData = cache.get(cacheString);
 
  if( cacheData ){
    data = cacheData;
  }
  else {
    check_url = check_url.replace('{id}', id);
    response = UrlFetchApp.fetch(check_url, options);
    data = response.getContentText();
    cache.put(cacheString, data, cacheTime);
  }
 
  var isFund = true;
 
  //return data;
  data = JSON.parse(data);
  data = data[0];
 
  var type = data.instrumentType;
 
  // check what the instrument type was and act accordingly
  if( type !== "FUND" ){ isFund = false;  }

  if( type === "INDEX") {
    url = azIndex_url.replace('{id}', id);
    // check if cached
    var cacheString = 'index_' + id.toString() + ma;
    var cache = CacheService.getScriptCache();
    var cacheData = cache.get(cacheString);

    if( cacheData ){
      data = cacheData;
    }
    else {
      response = UrlFetchApp.fetch(url, options);
      data = response.getContentText();
      cache.put(cacheString, data, cacheTime);
    }

    data = JSON.parse(data);

    data.type = 'Index';
    data.nav = data.quote.last;
    data.navDate = toDateNum(data.quote.timeOfLast);

    data.developmentOneDay = toPercent((data.quote.last/data.historicalClosingPrices.oneDay)-1);
    data.developmentOneWeek = toPercent((data.quote.last/data.historicalClosingPrices.oneWeek)-1);
    data.developmentOneMonth = toPercent((data.quote.last/data.historicalClosingPrices.oneMonth)-1);
    data.developmentThreeMonths = toPercent((data.quote.last/data.historicalClosingPrices.threeMonths)-1);
    data.developmentSixMonths = '';
    data.developmentOneYear = toPercent((data.quote.last/data.historicalClosingPrices.oneYear)-1);
    data.developmentThreeYears = toPercent((data.quote.last/data.historicalClosingPrices.threeYears)-1);
    data.developmentFiveYears = toPercent((data.quote.last/data.historicalClosingPrices.fiveYears)-1);

    data.sharpeRatio = '-';
    data.standardDeviation = '-';
    data.startDate = data.historicalClosingPrices.startDate;

  } else { // Slår även upp fonder här nu för att få en vecka utveckling.
   
    url = azStock_url.replace('{id}', id);
   
    // check if cached
    var cacheString = 'stock_' + id.toString() + ma;
    var cache = CacheService.getScriptCache();
    var cacheData = cache.get(cacheString);
   
    if( cacheData ){
      data = cacheData;
    }
    else {
      response = UrlFetchApp.fetch(url, options);
      data = response.getContentText();
      cache.put(cacheString, data, cacheTime);
    }
   
    data = JSON.parse(data);
    data.nav = data.quote.last;
   
    // add all developmentXXX
    data.developmentOneDay = toPercent((data.quote.last/data.historicalClosingPrices.oneDay)-1);
    data.developmentOneWeek = toPercent((data.quote.last/data.historicalClosingPrices.oneWeek)-1);
    data.developmentOneMonth = toPercent((data.quote.last/data.historicalClosingPrices.oneMonth)-1);
    data.developmentThreeMonths = toPercent((data.quote.last/data.historicalClosingPrices.threeMonths)-1);
    data.developmentSixMonths = ''
    data.developmentOneYear = toPercent((data.quote.last/data.historicalClosingPrices.oneYear)-1);
    data.developmentThreeYears = toPercent((data.quote.last/data.historicalClosingPrices.threeYears)-1);
    if(data.historicalClosingPrices.fiveYears)
      data.developmentFiveYears = toPercent((data.quote.last/data.historicalClosingPrices.fiveYears)-1);
   
    // add others
    data.sharpeRatio = '-';
    data.navDate = toDateNum(data.quote.timeOfLast);
    if(!data.startDate)
      data.startDate = '-';
    data.standardDeviation = '-';
   
    if(data.tickerSymbol)
      data.name = data.name + ' (' + data.tickerSymbol + ')';
   
    if( type.indexOf('TRADED_FUND') > -1 ){
      data.type = 'ETF';
    }
    else if( type === 'CERTIFICATE'){
      data.type = 'Certifikat';
    }
    else {
      data.type = 'Aktie';
    }
   
  }
 
  // it's a fund
  if( isFund ) {
    var developmentOneWeek = data.developmentOneWeek;
   
    // check if cached
    var cacheString = 'fund_' + id.toString() + ma;
    var cache = CacheService.getScriptCache();
    var cacheData = cache.get(cacheString);
   
    if( cacheData ){
      data = cacheData;
    }
    else {
      url = azFund_url.replace('{id}',id);
      response = UrlFetchApp.fetch(url, options);
      data = response.getContentText();
      cache.put(cacheString, data, cacheTime);
    }
   
    data = JSON.parse(data);
    data.type = data.fundTypeName;
    data.developmentOneWeek = developmentOneWeek;
  }
 
  var lastUpdate;
  lastUpdate = data.navDate.split('T')[0];
 
  var nav = azPost(id, ma, true, "MONTH"),    
      cur = data.nav,
      //cur = nav[0][0],
      sma = nav[0][1];
 
  if( isNaN(sma) ){
    sma = sma[1];
   //sma = response.getContentText();
  }
 
  var diff = Math.round(((cur/sma)-1)*1000)/1000,
    diff = Math.round(diff*1000)/10 + '%';
 
  var stdDev = data.standardDeviation,
      fee = data.managementFee;
 
  // check for changeSince since some will not have certain values
  for( var key in data ) {
    var cur = data[key];
    if( key.indexOf('changeSince') > -1 ){
      if( isNaN(cur) ){ data[key] = 0; }
    }
  } // end loop
 
  rows.push([data.name, data.type, diff, data.sharpeRatio, data.standardDeviation, data.developmentOneDay, data.developmentOneWeek,data.developmentOneMonth, data.developmentThreeMonths,data.developmentSixMonths,data.developmentOneYear,data.developmentThreeYears,data.developmentFiveYears, lastUpdate, data.nav, sma]);
  // Debug printout
  //rows.push([nav[0][0], nav[0][1], nav[0][2], diff]);
 
  return rows;
 
}
 
function TODAY_MINUS(offset){
 
  var d = new Date();
  d.setMonth(d.getMonth()-offset);
 
  var month = d.getMonth(),
      year = d.getFullYear();
 
  if(month < 10 ) month = '0' + month;
 
  var all = year + '-' + month + '-01';
  return all;
 
}
 
function lastNoZero(myRange) {
  lastRow = myRange.length;
  for (; myRange[lastRow - 1] == "" || myRange[lastRow - 1] == 0 && lastRow > 0 ; lastRow--)  {
    /*nothing to do*/
  }
  return myRange[lastRow - 1];
}
 
 
function getUERATE(ma, cacheTime) {
 
    if (typeof ma !== "number") {
        ma = 12;
    } else {
        ma = ma || 12;
    }
    cacheTime = cacheTime || 21600; // 6 hours
    var cacheString = 'cache_unrate' + ma;
    var cache = CacheService.getScriptCache();
    var cacheData = cache.get(cacheString);    
    var unrate_url = 'https://api.bls.gov/publicAPI/v1/timeseries/data/LNS14000000';
    var response;
 
    // options for all requests
    var options = {
        "muteHttpExceptions": true
    }
   
    var data;
    response = UrlFetchApp.fetch(unrate_url, options);
    if (cacheData != null) {
        data = cacheData;
    }
    else {
        response = UrlFetchApp.fetch(unrate_url, options);
        data = response.getContentText();
        cache.put(cacheString, data, cacheTime); // cache for 1 hour
    }
    data = response.getContentText();
    data = JSON.parse(data);
 
    if (data.status !== "REQUEST_SUCCEEDED") {
        return null;
    }
    var series = data.Results.series[0].data;
    if (!Array.isArray(series) || series.length < 1) {
        return null;
    }
    var rows = [];
    var currUE = parseFloat(series[0].value);
    if (series.length < ma + 1) {
        ma = series.length;
    }
    var sumRate = 0.0;
    for (var i = 1; i < ma + 1; i++) {
        var ueval = parseFloat(series[i].value);
 
        sumRate += ueval;
    }
    var smarate = sumRate / (ma);
    smarate = Math.round(smarate * 100) / 100;
    //unrate = Math.round(unrate * 100) / 100
    rows.push(["US UE Rate:", currUE.toFixed(2)]);
    rows.push(["SMA" + ma + ":", smarate.toFixed(2)]);
    rows.push(["Recession likely?", smarate > currUE ? "No" : "Yes"]);
    return rows;
 
}
 
/**
* GS AZ TAA v1.0.1
*/
 
 
// azPost
function azGet( id, ma, period ){
 
  // options
  id = id || false;
  ma = ma || 10;
  period = period.toUpperCase() || 'MONTH';
 
  // checks
  if(!id) return 'Inget id definierat';
  if (['MINUTE', 'HOUR', 'DAY', 'WEEK', 'MONTH'].indexOf( period ) < 0 ){
    return 'Perioden är fel, använd MINUTE, HOUR, DAY, WEEK eller MONTH';
  }
 
  // base VARs
  var azPostURL = 'https://www.avanza.se/ab/component/highstockchart/getchart/orderbook';
  var cacheTime = 21600; // 21600 = 6 hours
  var json = '{"orderbookId":{id},"chartType":"AREA","widthOfPlotContainer":558,"chartResolution":"{period}","navigator":true,"percentage":false,"volume":false,"owners":false,"timePeriod":"three_months","ta":[]}';
 
  // replace json with user options
  json = json
  .replace('{id}', id)
  .replace('[]', '[{"type":"sma","timeFrame": '+ ma +'}]')
 
  if( period === 'HOUR' || period === 'MINUTE' ){
    json = json.replace('three_months', 'today'); // three months does not support hour/minute data
  }
 
  json = json.replace('{period}',period);
 
 
 
 
 
  // ------------------------------------------------------ //
 
 
  // request options
  var requestOptions = {
    'method' : 'post',
    'contentType': 'application/json',
    'payload' : json,
    'muteHttpExceptions': true
  }
 
  var response, data, updated;
 
  // check/setup cache
  var cacheString = 'cache_' + id.toString() + ma + period;
  var cache = CacheService.getDocumentCache();
 
  // execute the request or get from cache
  if(cache.get(cacheString) != null) {
    updated = new Date(Date.now()-cacheTime);
    data = cache.get(cacheString);
  }
  else {
    updated = new Date();
    response = UrlFetchApp.fetch(azPostURL, requestOptions);
    data = response.getContentText();
    cache.put(cacheString, data, cacheTime); // use cacheTime variable
  }
 
 
  // ------------------------------------------------------ //
 
 
  // PARSE DATA
  data = JSON.parse(data);
  var dataPoints = data.dataPoints;
  var maData = data.technicalAnalysis[0]['dataPoints'];
 
  var rows = [],
      data,
      len = dataPoints.length,
      mlen = maData.length;
 
  // get last dataPoint only
  dataPoints = dataPoints[len-1];
  maData = maData[mlen-1];
 
  // get all data
  var cur = dataPoints;
  var nav = cur[1];
 
  var jsdate = updated,
      y = jsdate.getFullYear(),
      m = pad( jsdate.getMonth()+1 ),
      d = pad( jsdate.getDate() ),
      hh = pad( jsdate.getHours() ),
      mm = pad( jsdate.getMinutes() );
 
  var dateFormat = y + '-' + m + '-' + d + ' ' + hh + ':' + mm;
 
   var cur_sma = maData[1]; // sma-index is index-1
 
  // last point did not have ma, must find latest ma (since 1 year data does not include 100% of all MA-points)
  if( cur_sma === '' ){
    var all_sma = data.technicalAnalysis[0]['dataPoints'];
    var len = all_sma.length;
    cur_sma = all_sma[len-1];
  }
 
 
  // get difference in perent
  //var indicator = toPercent((nav/cur_sma)-1) + '%';
  var indicator = ((nav/cur_sma)-1);
 
  // push data to rows
  rows.push([indicator, nav, cur_sma, dateFormat]);
 
  return rows;
 
} // azGet()
 
 
 
// helpers
function toPercent(val){ return Math.round(val*10000)/100; }
function pad(n){return n<10 ? '0'+n : n} // add leading zeros to days, months etc
 
 
/**
* UNRATE v1.0.0
* Get unemployment rate and its current moving average
* usage ie =UNRATE(12)
*/
function UNRATE(ma){
 
  ma = ma || 12;
 
  // setup
  var url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=UNRATE";
 
  // max months to get
  var date = new Date();
  date.setMonth(date.getMonth() - ma);
  date.setDate(1);
  date = date.getFullYear() + '-' + pad(date.getMonth()) + '-' + pad(date.getDate());
  url += '&cosd=' + date;
 
  // get and parse csv
  var req = UrlFetchApp.fetch(url, { "muteHttpExceptions": true });
  var res = Utilities.parseCsv(req.getContentText());
 
  // only use last X values (use MA-value)
  res = res.slice(-1 * ma);
 
  var sum = 0,
      len = res.length, i = 0;
 
  for(i; i<len; i++){
    sum += parseFloat( res[i][1] );
  }
 
  // current and ma
  var current = res[len-1][1];
  var currentMA = (sum/ma).toFixed(3);
 
  // rows, push
  var rows = [];
  rows.push(["Nuvarande UNRATE", current]);
  rows.push(["Medelvärde (MA" + ma + ")", currentMA]);
  rows.push(["Risk för recession?", currentMA > current ? "Nej" : "Ja"]);
 
  return rows;

 
} // UNRATE()

/* lists the first top 20 (Az pagination default) funds sorted by 3 month yield descending
* starting from startIndex (0 by default)
*/
function azList(startIndex) {
  const azListUrl = 'https://www.avanza.se/_api/fund-guide/list';
  let startIndex_ = 0;
  
  if (!!startIndex) startIndex_ = startIndex;

  const data = {
    startIndex: startIndex_,
    sortField:"developmentThreeMonths",
    sortDirection:"DESCENDING"
  };

  const options = {
    method : 'post',
    contentType: 'application/json',
    payload : JSON.stringify(data)
  };

  const results = UrlFetchApp.fetch(azListUrl, options);
  const rdata = JSON.parse(results.getContentText());
  
  if (rdata.fundListViews) 
    return rdata.fundListViews
              .filter(e => e.developmentOneYear != null) // remove funds without at least 1y history
              .map(e => [e.category, e.orderbookId]);
  else
    return ["field fundListViews not found in return data"];
}

/*
Lists the top 100 sorted by 3m yield descending
*/
function azListTop100() {
  let index = 0;
  let arr = [];

  //return azList(0);
  while ( index < 6) {
    arr = arr.concat(azList(index++ * 20));
  }
  
  return arr;
}

// vertical spread of AzPost MA
function azPostMiniMa(id, ma, single) {
  _rows = azPost(id, ma, false, single).slice(1);
  _maArray = _rows.map(e => e[2]);
  return [_maArray];
}

// vertical spread of AzPost returns
function azPostMiniPrice(id, ma, single) {
  _rows = azPost(id, ma, false, single).slice(1);
  _returnsArray = _rows.map(e => e[1]);
  return [_returnsArray];
}

function toDateNum(string) {
  //convert unix timestamp to milliseconds rather than seconds
  var d = new Date(string);

  //get timezone of spreadsheet
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

  //format date to readable format
  var date = Utilities.formatDate(d, tz, 'yyyy-MM-dd'); // 'dd-MM-yyyy hh:mm:ss a'

  return date;
}