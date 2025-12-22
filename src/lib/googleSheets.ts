// Google Sheets Integration
// To set this up:
// 1. Create a Google Apps Script in your Google Sheet
// 2. Deploy it as a web app
// 3. Replace YOUR_SCRIPT_ID with your actual script ID

export const GOOGLE_SHEETS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzUF13j_X9NfoCLVihDThPcJtp2EoM3TFrb31u3q_nPABhaUMf6vrcX2HioFouWiPt4kg/exec";

// =============================================================================
// GOOGLE APPS SCRIPT CODE - COPY EVERYTHING BELOW INTO YOUR APPS SCRIPT EDITOR
// =============================================================================
// Go to: Extensions → Apps Script → Paste this code → Deploy → New Deployment
// =============================================================================
/*
function doGet(e) {
  var params = e.parameter;

  // Handle Client Inquiry AI Toggle (Column N)
  if (params.action === 'updateClientInquiryAI' && params.rowIndex) {
    var inquirySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inquiry Database");
    var rowIndex = parseInt(params.rowIndex);
    inquirySheet.getRange(rowIndex, 14).setValue(params.aiStatus || "OFF-AI");
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Handle AI Diagnosis Formatting
  if (params.action === 'formatDiagnosis') {
    try {
      // Get OpenAI API key from Keys sheet (cell B1)
      var keysSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Keys');
      var apiKey = keysSheet.getRange(1, 2).getValue();
      
      if (!apiKey) {
        return ContentService.createTextOutput(JSON.stringify({
          error: 'OpenAI API key not configured in Keys sheet (B1)'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var rawDiagnosis = params.rawDiagnosis || '';
      var customerName = params.customerName || '';
      var deviceType = params.deviceType || '';
      var model = params.model || '';
      var serviceId = params.serviceId || '';
      var technician = params.technician || '';
      var finalCost = params.finalCost || '0';

      var prompt = 'You are a professional technical diagnostician for AC Tech Repair PH.\n\n' +
        'Format the following information into a customer-friendly diagnosis report:\n\n' +
        'Customer: ' + customerName + '\n' +
        'Device: ' + deviceType + ' (' + model + ')\n' +
        'Service ID: ' + serviceId + '\n' +
        'Raw Notes: ' + rawDiagnosis + '\n\n' +
        'EXACT FORMAT TO FOLLOW:\n' +
        'Customer Name: [name]\n' +
        'Device Type: [type]\n' +
        'Model: [model]\n' +
        'Service ID: [id]\n\n' +
        'AC TECH DEVICE DIAGNOSIS\n\n' +
        'Findings:\n[Clear description of what was found during inspection]\n\n' +
        'Cause of Issue:\n[Root cause explanation in simple terms]\n\n' +
        'Suggested Solution:\n[Specific repair steps and actions needed]\n\n' +
        'Recommendations:\n[Professional advice for the customer]\n\n' +
        'Service Breakdown:\n[List each service item on a new line. For EVERY item, ALWAYS write the price as "Php {Enter Amount}" literally (do not use real numbers). Example:\n' +
        'LCD Replacement - Php {Enter Amount}\n' +
        'Bezel Replacement - Php {Enter Amount}]\n\n' +
        '---\n\n' +
        'To proceed with the service, please reply PROCEED to confirm your approval and kindly review our Terms and Conditions: bit.ly/actech-termsnconditions\n\n' +
        '---\n\n' +
        'SUMMARY: [One-line summary of the repair needed]\n\n' +
        'WRITING STYLE REQUIREMENTS:\n' +
        '- Customer-oriented and friendly but professional\n' +
        '- Get straight to the point, no fluff\n' +
        '- Use simple, clear language that anyone can understand\n' +
        '- Formal quotation style\n' +
        '- NO markdown formatting (no **, no ##, no bullet points)\n' +
        '- NO em dashes (—), use regular hyphens or commas instead\n' +
        '- NO quotation marks around YES or any other words\n' +
        '- Use plain text only with clear section labels';

      var payload = {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a professional technical diagnostician.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      };

      var options = {
        method: 'post',
        contentType: 'application/json',
        headers: { 'Authorization': 'Bearer ' + apiKey },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      var response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', options);
      var responseCode = response.getResponseCode();
      var responseText = response.getContentText();

      if (responseCode !== 200) {
        var errorMsg = 'AI service error';
        if (responseCode === 429) errorMsg = 'OpenAI rate limit exceeded';
        if (responseCode === 401) errorMsg = 'Invalid OpenAI API key';
        if (responseCode === 402) errorMsg = 'OpenAI quota exceeded';
        
        return ContentService.createTextOutput(JSON.stringify({
          error: errorMsg
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var result = JSON.parse(responseText);
      var formattedDiagnosis = result.choices[0].message.content;

      return ContentService.createTextOutput(JSON.stringify({
        formattedDiagnosis: formattedDiagnosis
      })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
      return ContentService.createTextOutput(JSON.stringify({
        error: 'Failed to format diagnosis: ' + error.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  // Handle AI Report Formatting
  if (params.action === 'formatReport') {
    try {
      // Get OpenAI API key from Keys sheet (cell B1)
      var keysSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Keys');
      var apiKey = keysSheet.getRange(1, 2).getValue();
      
      if (!apiKey) {
        return ContentService.createTextOutput(JSON.stringify({
          error: 'OpenAI API key not configured in Keys sheet (B1)'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var technicianReport = params.technicianReport || '';
      var customerName = params.customerName || '';
      var deviceType = params.deviceType || '';
      var model = params.model || '';
      var serviceId = params.serviceId || '';
      var technician = params.technician || '';
      var finalCost = params.finalCost || '0';

      var prompt = 'You are formatting a service report for AC Tech Repair PH.\n\n' +
        'Format the following information into a customer-friendly service report:\n\n' +
        'Customer: ' + customerName + '\n' +
        'Device: ' + deviceType + ' (' + model + ')\n' +
        'Service ID: ' + serviceId + '\n' +
        'Raw Service Report: ' + technicianReport + '\n\n' +
        'EXACT FORMAT TO FOLLOW:\n' +
        'Customer Name: [name]\n' +
        'Device Type: [type]\n' +
        'Model: [model]\n' +
        'Service ID: [id]\n\n' +
        'AC TECH SERVICE REPORT\n\n' +
        'Work Performed:\n[Clear description of repairs and services completed]\n\n' +
        'Technical Findings:\n[Detailed technical observations and results]\n\n' +
        'Final Status:\n[Current condition of the device]\n\n' +
        'Recommendations:\n[Professional advice for device maintenance and care]\n\n' +
        '---\n\n' +
        'To finalize the service, please reply PROCEED to confirm your approval and kindly review our Terms and Conditions: bit.ly/actech-termsnconditions\n\n' +
        'WRITING STYLE REQUIREMENTS:\n' +
        '- Customer-oriented and friendly but professional\n' +
        '- Get straight to the point, no fluff\n' +
        '- Use simple, clear language that anyone can understand\n' +
        '- Formal service report style\n' +
        '- NO markdown formatting (no **, no ##, no bullet points)\n' +
        '- NO em dashes (—), use regular hyphens or commas instead\n' +
        '- NO quotation marks around any words\n' +
        '- Use plain text only with clear section labels';

      var payload = {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a technical report formatter.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      };

      var options = {
        method: 'post',
        contentType: 'application/json',
        headers: { 'Authorization': 'Bearer ' + apiKey },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      var response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', options);
      var responseCode = response.getResponseCode();
      var responseText = response.getContentText();

      if (responseCode !== 200) {
        var errorMsg = 'AI service error';
        if (responseCode === 429) errorMsg = 'OpenAI rate limit exceeded';
        if (responseCode === 401) errorMsg = 'Invalid OpenAI API key';
        if (responseCode === 402) errorMsg = 'OpenAI quota exceeded';
        
        return ContentService.createTextOutput(JSON.stringify({
          error: errorMsg
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var result = JSON.parse(responseText);
      var formattedReport = result.choices[0].message.content;

      return ContentService.createTextOutput(JSON.stringify({
        formattedReport: formattedReport
      })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
      return ContentService.createTextOutput(JSON.stringify({
        error: 'Failed to format report: ' + error.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  // Handle search requests for Service Database (tracking page)
  if (params.action === 'searchService' && params.serviceId) {
    var serviceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Service Database");
    var data = serviceSheet.getDataRange().getDisplayValues();
    
    // Search for the service ID in column A (index 0)
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == params.serviceId) {
        return ContentService.createTextOutput(JSON.stringify({
          "status": "found",
          "data": {
            "adminRep": data[i][2],
            "clientName": data[i][8],
            "clientId": data[i][5], // Column F - Client ID
            "username": data[i][9],
            "email": data[i][10],
            "phone": data[i][11],
            "device": data[i][16],
            "deviceType": data[i][12],
            "serialNumber": data[i][13],
            "brand": data[i][14],
            "colorMemory": data[i][15] + " | " + data[i][17],
            "timestamp": data[i][4],
            "targetDate": data[i][28],
            "timeFrame": data[i][27],
            "service": data[i][26],
            "serviceCost": data[i][29], // Column AD
            "partsUsed": data[i][46], // Column AU - Parts Used
            "discount": data[i][50], // Column AY - Discount
            "finalCost": data[i][51], // Column AZ - Final Cost
            "quotationPdfUrl": data[i][32], // Column AG - Service Quotation PDF URL
            "status": data[i][1] || "PENDING - APPROVAL",
            "technician": data[i][3],
            "techNotes": data[i][39],
            "adminNotes": data[i][37],
            "adminNotesInternal": data[i][38],
            "chiefComplaint": data[i][18],
            "technicianDiagnosis": data[i][30],
            "aiDiagnosis": data[i][31], // Column AF - AI Diagnosis
            "suggestedRepair": data[i][32],
            "technicianNotesCustomer": data[i][39],
            "technicianNotesInternal": data[i][40],
            "clientType": data[i][7],
            "priority": data[i][6],
            "dents": data[i][19],
            "scratches": data[i][20],
            "missingParts": data[i][21],
            "physicalDamage": data[i][22],
            "importantFiles": data[i][23],
            "noPower": data[i][24],
            "repairHistory": data[i][25],
            "pdfUrl": data[i][41],
            "hasPassword": data[i][43],
            "devicePassword": data[i][44],
            "technicianDepartment": data[i][39],
            "clientFolderUrl": data[i][42], // Column AQ - Client folder for service PDFs
            "deviceReportFolderUrl": data[i][47], // Column AV - Device report photos folder
            "annotationImageUrl": data[i][48],
            "annotationNotes": data[i][49],
            "technicianReport": data[i][52], // Column BA - Technician Report
            "aiReport": data[i][53] // Column BB - AI Report
          }
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "not_found"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Get service info by Service ID (for part received notifications)
  if (params.action === 'getServiceById' && params.serviceId) {
    var serviceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Service Database");
    if (!serviceSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Service Database sheet not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var serviceData = serviceSheet.getDataRange().getDisplayValues();
    for (var si = 1; si < serviceData.length; si++) {
      if (serviceData[si][0] == params.serviceId) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          service: {
            serviceId: serviceData[si][0],
            adminRep: serviceData[si][2] || '',
            technician: serviceData[si][3] || ''
          }
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Service not found'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle search requests for Inquiry Database (service form)
  if (params.action === 'search' && params.serviceId) {
    var inquirySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inquiry Database");
    var data = inquirySheet.getDataRange().getValues();
    
    // Search for the service ID in column B (index 1)
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] == params.serviceId) {
        return ContentService.createTextOutput(JSON.stringify({
          "found": true,
          "data": {
            "name": data[i][4],
            "contactNumber": data[i][6],
            "device": data[i][8],
            "initialDiagnosis": data[i][9],
            "estimatedCost": data[i][10]
          }
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "found": false
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle getting all client inquiries from Inquiry Database
  if (params.action === 'getClientInquiries') {
    var inquirySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inquiry Database");
    if (!inquirySheet) {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "Inquiry Database sheet not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = inquirySheet.getDataRange().getDisplayValues();
    var inquiries = [];
    
    // Columns: A=Client ID, B=Service ID, C=Timestamp, D=(unused), E=Name, F=Address, G=Contact Number,
    //          H=Mode of Transfer, I=Device, J=Initial Diagnosis, K=Quotation, L=Pick-Up Date, M=Direct Chat Link, N=AI Status,
    //          O=Pre-Order, P=Initial Payment, Q=Part ID
    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) { // If Client ID exists
        inquiries.push({
          "rowIndex": i + 1, // 1-indexed row number for update/delete
          "clientId": data[i][0],
          "serviceId": data[i][1],
          "timestamp": data[i][2],
          "name": data[i][4],
          "address": data[i][5],
          "contactNumber": data[i][6],
          "modeOfTransfer": data[i][7],
          "device": data[i][8],
          "initialDiagnosis": data[i][9],
          "quotation": data[i][10],
          "pickUpDate": data[i][11],
          "directChatLink": data[i][12],
          "aiStatus": data[i][13] || "OFF-AI", // Column N - AI Status, default to OFF-AI
          "preOrder": data[i][14] || "", // Column O - Pre-Order (true/false)
          "initialPayment": data[i][15] || "", // Column P - Initial Payment
          "partId": data[i][16] || "" // Column Q - Part ID
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "data": inquiries
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle search requests for Client Database (Customer Management)
  if (params.action === 'searchClient' && params.clientId) {
    var clientSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Client Database");
    var clientData = clientSheet.getDataRange().getDisplayValues();
    
    // Search for the client ID in column A (index 0)
    for (var i = 1; i < clientData.length; i++) {
      if (clientData[i][0] == params.clientId) {
        var customer = {
          "clientId": clientData[i][0],
          "clientName": clientData[i][1],
          "username": clientData[i][2],
          "phone": clientData[i][3],
          "email": clientData[i][4],
          "serviceIds": clientData[i][5] ? clientData[i][5].split(',').map(function(id) { return id.trim(); }) : []
        };
        
        // Now fetch service records for this customer
        var serviceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Service Database");
        var serviceData = serviceSheet.getDataRange().getDisplayValues();
        var services = [];
        
        // Get all services that match the service IDs
        for (var j = 1; j < serviceData.length; j++) {
          var serviceId = serviceData[j][0];
          if (customer.serviceIds.indexOf(serviceId) > -1) {
            services.push({
              "serviceId": serviceId,
              "status": serviceData[j][1] || "PENDING - APPROVAL",
              "service": serviceData[j][26],
              "targetDate": serviceData[j][28],
              "serviceCost": serviceData[j][29],
              "pdfUrl": serviceData[j][41],
              "devicePassword": serviceData[j][44]
            });
          }
        }
        
        return ContentService.createTextOutput(JSON.stringify({
          "status": "success",
          "customer": customer,
          "services": services
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "not_found"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle getting staff list (ADD THIS INSIDE doGet FUNCTION)
  if (params.action === 'getStaffList') {
    var staffSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Staff Management");
    if (!staffSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "Staff Management sheet not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = staffSheet.getDataRange().getDisplayValues();
    var staffList = [];
    
    // Skip header row (i = 1)
    // Columns: A=Staff ID, B=Username, C=Password, D=Name, E=Role, F=Department, G=Status
    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) { // If Staff ID exists
        staffList.push({
          "staffId": data[i][0],
          "username": data[i][1],
          "password": data[i][2],
          "name": data[i][3],
          "role": data[i][4],
          "department": data[i][5] || "",
          "status": data[i][6]
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "data": staffList
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle request for all ongoing services (service tracker)
  if (params.action === 'getAllOngoingServices') {
    var serviceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Service Database");
    var data = serviceSheet.getDataRange().getDisplayValues();
    var services = [];
    
    // Loop through all rows (skip header row)
    for (var i = 1; i < data.length; i++) {
      services.push({
        "serviceId": data[i][0],
        "timestamp": data[i][4],
        "technician": data[i][3],
        "technicianDepartment": data[i][39], // Column AN - Technician Department (comma-separated if multiple)
        "service": data[i][26],
        "deviceType": data[i][12],
        "brand": data[i][14],
        "device": data[i][16],
        "targetDate": data[i][28],
        "status": data[i][1],
        "clientName": data[i][8],
        "internalAdminNotes": data[i][38], // Column AM - Internal Admin Notes
        "internalTechnicianNotes": data[i][40] // Column AO - Internal Technician Notes
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "services": services
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle request for inventory items (for Service Update)
  if (params.action === 'getInventory') {
    var inventorySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory Management");
    
    if (!inventorySheet) {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "Inventory Management sheet not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = inventorySheet.getDataRange().getDisplayValues();
    var inventory = [];
    
    // Loop through all rows (skip header row)
    // Columns: Part ID, Part Name, Device Type, Brand, Model, Quantity, Date Ordered, Supplier, Cost/Unit, Status, Last Updated, Remarks, QR Code (M)
    for (var i = 1; i < data.length; i++) {
      var status = data[i][9]; // Status column
      var quantity = parseInt(data[i][5] || 0);
      
      // Only include items that are in stock
      if (status !== "Out of Stock" && quantity > 0) {
        inventory.push({
          "id": data[i][0],
          "name": data[i][1],
          "deviceType": data[i][2], // Column C - Device Type
          "model": data[i][4], // Column E - Model
          "cost": parseFloat(data[i][8]) || 0,
          "quantity": quantity,
          "qrCode": data[i][12] // Column M - QR Code data URL
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "inventory": inventory
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle request for inventory (inventory management)
  if (params.action === 'getInventoryFull') {
    var inventorySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory Management");
    var data = inventorySheet.getDataRange().getDisplayValues();
    var inventory = [];
    
    // Loop through all rows (skip header row)
    // Columns: Part ID, Part Name, Device Type, Brand, Model, Quantity, Date Ordered, Supplier, Cost/Unit, Status, Last Updated, Remarks, QR Code (M)
    for (var i = 1; i < data.length; i++) {
      inventory.push({
        "partId": data[i][0],
        "partName": data[i][1],
        "deviceType": data[i][2],
        "brand": data[i][3],
        "model": data[i][4],
        "quantity": parseInt(data[i][5] || 0),
        "dateOrdered": data[i][6],
        "supplier": data[i][7],
        "costPerUnit": data[i][8],
        "status": data[i][9],
        "lastUpdated": data[i][10],
        "remarks": data[i][11],
        "qrCode": data[i][12] // Column M - QR Code data URL
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "inventory": inventory
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle request for inventory logs
  if (params.action === 'getInventoryLogs') {
    var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory Log");
    var data = logSheet.getDataRange().getDisplayValues();
    var logs = [];
    
    // Loop through all rows (skip header row)
    // Columns: Log ID, Part ID, Part Name, Device Type, Transaction Type, Quantity Changed, Previous Quantity, New Quantity, Date & Time, Remarks/Notes, Username, Role
    for (var i = 1; i < data.length; i++) {
      logs.push({
        "logId": data[i][0],
        "partId": data[i][1],
        "partName": data[i][2],
        "deviceType": data[i][3],
        "transactionType": data[i][4],
        "quantityChanged": data[i][5],
        "previousQuantity": data[i][6],
        "newQuantity": data[i][7],
        "dateTime": data[i][8],
        "remarks": data[i][9],
        "username": data[i][10] || "Unknown",
        "role": data[i][11] || "Unknown"
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "logs": logs
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle request for done services (Transaction Tracker)
  if (params.action === 'getDoneServices') {
    var serviceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Service Database");
    var data = serviceSheet.getDataRange().getDisplayValues();
    var services = [];
    
    // Loop through all rows and filter for "Done" status (skip header row)
    for (var i = 1; i < data.length; i++) {
      var status = data[i][1] ? data[i][1].trim().toLowerCase() : "";
      if (status === "done" || status === "completed") {
        services.push({
          "serviceId": data[i][0],
          "timestamp": data[i][4],
          "technician": data[i][3],
          "department": data[i][39] || "N/A", // Column AN (Technician Department)
          "deviceType": data[i][12],
          "clientName": data[i][8],
          "service": data[i][26],
          "quotedPrice": parseFloat(data[i][29]) || 0,
          "discount": parseFloat(data[i][50]) || 0, // Column AY (Discount)
          "partsCost": parseFloat(data[i][45]) || 0 // Column AT (Parts Cost)
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "services": services
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle request for service logs (Activity Logs)
  if (params.action === 'getServiceLogs') {
    var serviceId = params.serviceId;
    var limit = parseInt(params.limit) || 10;
    var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Activity Logs");
    
    if (!logSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "Activity Logs sheet not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = logSheet.getDataRange().getDisplayValues();
    var logs = [];
    
    // Loop through rows and filter by serviceId
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] === serviceId) {
        logs.push({
          "logId": data[i][0],
          "serviceId": data[i][1],
          "username": data[i][2],
          "role": data[i][3],
          "timestamp": data[i][4],
          "activity": data[i][5]
        });
      }
    }
    
    // Sort by most recent and limit
    logs.reverse();
    if (logs.length > limit) {
      logs = logs.slice(0, limit);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "logs": logs
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle request for all technicians with departments
  if (params.action === 'getTechnicians') {
    var staffSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Staff Management");
    if (!staffSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "Staff Management sheet not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = staffSheet.getDataRange().getDisplayValues();
    var technicians = [];
    
    // Skip header row (i = 1)
    for (var i = 1; i < data.length; i++) {
      var role = data[i][2] ? data[i][2].trim().toLowerCase() : "";
      if (role === "technician" && data[i][3] === "Active") {
        var name = data[i][1];
        var department = data[i][4] || ""; // Column E (Department)
        var displayName = department ? name + " – " + department : name;
        
        technicians.push({
          "name": name,
          "department": department,
          "displayName": displayName
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "technicians": technicians
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle get device report photos from Google Drive folder
  if (params.action === 'getDeviceReportPhotos' && params.folderId) {
    try {
      var folderId = params.folderId;
      var folder = DriveApp.getFolderById(folderId);
      var files = folder.getFiles();
      var photos = [];
      
      while (files.hasNext()) {
        var file = files.next();
        var mime = file.getMimeType();
        if (mime && mime.indexOf('image/') === 0) {
          var fileId = file.getId();
          var viewUrl = "https://drive.google.com/uc?export=view&id=" + fileId;
          photos.push(viewUrl);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        "status": "success",
        "photos": photos
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  // ========== NOTIFICATIONS ==========
  
  // Get notifications for a user
  if (params.action === 'getNotifications' && params.userId) {
    var notifSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Notifications");
    if (!notifSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        notifications: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = notifSheet.getDataRange().getDisplayValues();
    var notifications = [];
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] === params.userId) {
        notifications.push({
          id: data[i][0],
          userId: data[i][1],
          title: data[i][2],
          message: data[i][3],
          type: data[i][4],
          read: data[i][5] === 'TRUE' || data[i][5] === 'true',
          createdAt: data[i][6],
          serviceId: data[i][7] || null
        });
      }
    }
    
    // Sort by most recent first
    notifications.sort(function(a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    return ContentService.createTextOutput(JSON.stringify({
      notifications: notifications
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // ========== MESSAGING ==========
  
  // Get messages for a user (sent and received)
  if (params.action === 'getMessages' && params.userId) {
    var msgSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Messages");
    if (!msgSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        messages: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = msgSheet.getDataRange().getDisplayValues();
    var messages = [];
    
    for (var i = 1; i < data.length; i++) {
      // Include messages where user is sender OR receiver
      if (data[i][1] === params.userId || data[i][3] === params.userId) {
        messages.push({
          id: data[i][0],
          senderId: data[i][1],
          senderName: data[i][2],
          receiverId: data[i][3],
          receiverName: data[i][4],
          content: data[i][5],
          read: data[i][6] === 'TRUE' || data[i][6] === 'true',
          createdAt: data[i][7]
        });
      }
    }
    
    // Sort by most recent first
    messages.sort(function(a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    return ContentService.createTextOutput(JSON.stringify({
      messages: messages
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // ========== GROUP CHATS (GET) ==========
  
  // Get all group chats for a user
  if (params.action === 'getGroupChats' && params.userId) {
    var groupSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("GroupChats");
    if (!groupSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        groups: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = groupSheet.getDataRange().getValues();
    var groups = [];
    
    for (var i = 1; i < data.length; i++) {
      var memberIds = data[i][3] ? data[i][3].toString().split(',') : [];
      // Check if user is a member
      if (memberIds.includes(params.userId)) {
        groups.push({
          id: data[i][0],
          name: data[i][1],
          createdBy: data[i][2],
          memberIds: memberIds,
          memberNames: data[i][4] ? data[i][4].toString().split(',') : [],
          createdAt: data[i][5]
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      groups: groups
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Get messages for a specific group
  if (params.action === 'getGroupMessages' && params.groupId) {
    var msgSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Messages");
    if (!msgSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        messages: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = msgSheet.getDataRange().getValues();
    var messages = [];
    
    for (var i = 1; i < data.length; i++) {
      // Column I (index 8) is Group ID
      if (data[i][8] === params.groupId) {
        messages.push({
          id: data[i][0],
          senderId: data[i][1],
          senderName: data[i][2],
          receiverId: data[i][3],
          receiverName: data[i][4],
          content: data[i][5],
          read: data[i][6] === 'TRUE' || data[i][6] === 'true',
          createdAt: data[i][7],
          groupId: data[i][8]
        });
      }
    }
    
    // Sort by oldest first for chat display
    messages.sort(function(a, b) {
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
    
    return ContentService.createTextOutput(JSON.stringify({
      messages: messages
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // ========== TYPING INDICATORS (GET) ==========
  
  // Get typing status for a conversation
  if (params.action === 'getTypingStatus' && params.conversationId) {
    var typingSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("TypingStatus");
    if (!typingSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        typingUsers: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = typingSheet.getDataRange().getValues();
    var typingUsers = [];
    var now = new Date().getTime();
    
    for (var i = 1; i < data.length; i++) {
      var timestamp = new Date(data[i][3]).getTime();
      // Only include if typing within last 10 seconds (increased from 5 for network latency)
      if (data[i][1] === params.conversationId && (now - timestamp) < 10000) {
        typingUsers.push({
          userId: data[i][0],
          timestamp: data[i][3]
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      typingUsers: typingUsers
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // ========== READ RECEIPTS (GET) ==========
  
  // Get read receipts for a specific message
  if (params.action === 'getMessageReadReceipts' && params.messageId) {
    var receiptsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("ReadReceipts");
    if (!receiptsSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        receipts: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = receiptsSheet.getDataRange().getValues();
    var receipts = [];
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] === params.messageId) {
        receipts.push({
          id: data[i][0],
          messageId: data[i][1],
          userId: data[i][2],
          userName: data[i][3],
          readAt: data[i][4]
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      receipts: receipts
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Get all read receipts for messages in a group (batch fetch)
  if (params.action === 'getGroupReadReceipts' && params.groupId) {
    var msgSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Messages");
    var receiptsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("ReadReceipts");
    
    if (!msgSheet || !receiptsSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        receipts: {}
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get all message IDs in this group
    var messagesData = msgSheet.getDataRange().getValues();
    var groupMessageIds = [];
    for (var i = 1; i < messagesData.length; i++) {
      if (messagesData[i][8] === params.groupId) {
        groupMessageIds.push(messagesData[i][0]);
      }
    }
    
    // Get all read receipts for these messages
    var receiptsData = receiptsSheet.getDataRange().getValues();
    var receiptsByMessage = {};
    
    for (var i = 1; i < receiptsData.length; i++) {
      var msgId = receiptsData[i][1];
      if (groupMessageIds.indexOf(msgId) > -1) {
        if (!receiptsByMessage[msgId]) {
          receiptsByMessage[msgId] = [];
        }
        receiptsByMessage[msgId].push({
          id: receiptsData[i][0],
          messageId: msgId,
          userId: receiptsData[i][2],
          userName: receiptsData[i][3],
          readAt: receiptsData[i][4]
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      receipts: receiptsByMessage
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // GET all Fast Moving Parts
  if (params.action === 'getFastMovingParts') {
    var fmSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Fast Moving Inventory");
    if (!fmSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "Fast Moving Inventory sheet not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = fmSheet.getDataRange().getDisplayValues();
    var parts = [];
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) {
        parts.push({
          "partId": data[i][0],
          "requestedBy": data[i][1],
          "serviceId": data[i][2],
          "partName": data[i][3],
          "deviceType": data[i][4],
          "brand": data[i][5],
          "model": data[i][6],
          "quantity": data[i][7],
          "dateNeeded": data[i][8],
          "dateOrdered": data[i][9],
          "dateReceived": data[i][10],
          "supplier": data[i][11],
          "cost": data[i][12],
          "status": data[i][13],
          "lastUpdated": data[i][14],
          "remarks": data[i][15]
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "parts": parts
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    "error": "Invalid request"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var params = e.parameter;
  var action = params.action;
  
  // Handle device report photo deletion (Service Update page)
  if (params.action === 'deleteDeviceReportPhoto') {
    try {
      var serviceId = params.serviceId;
      var fileId = params.fileId;
      
      if (!serviceId || !fileId) {
        return ContentService.createTextOutput(JSON.stringify({
          result: 'error',
          message: 'Missing serviceId or fileId'
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      var file = DriveApp.getFileById(fileId);
      // Move the file to trash so it is no longer listed in the folder
      file.setTrashed(true);
      
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success'
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        result: 'error',
        message: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  // Handle update requests for Manage Client
  if (params.action === 'updateService' && params.serviceId) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Service Database");
    var data = sheet.getDataRange().getValues();
    
    // Search for the service ID and device type match
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == params.serviceId && data[i][12] == params.deviceType) {
        // Update the specified columns
        if (params.status) sheet.getRange(i + 1, 2).setValue(params.status);
        if (params.technician) sheet.getRange(i + 1, 4).setValue(params.technician);
        // Update Technician Department (Column AN)
        if (params.technicianDepartment || params.department || params["Technician Department"]) {
          var dept = params.technicianDepartment || params.department || params["Technician Department"];
          sheet.getRange(i + 1, 40).setValue(dept); // Column AN - Technician Department
        }
        if (params.priority) sheet.getRange(i + 1, 7).setValue(params.priority);
        if (params.clientType) sheet.getRange(i + 1, 8).setValue(params.clientType);
        if (params.aiDiagnosis !== undefined) sheet.getRange(i + 1, 32).setValue(params.aiDiagnosis); // Column AF - AI Diagnosis
        if (params.aiReport !== undefined) sheet.getRange(i + 1, 54).setValue(params.aiReport); // Column BB - AI Report
        if (params.services) sheet.getRange(i + 1, 27).setValue(params.services);
        if (params.timeFrame) sheet.getRange(i + 1, 28).setValue(params.timeFrame);
        if (params.targetDate) sheet.getRange(i + 1, 29).setValue(params.targetDate);
        if (params.serviceCost) sheet.getRange(i + 1, 30).setValue(params.serviceCost); // Column AD - Service Cost
        if (params.discount) sheet.getRange(i + 1, 51).setValue(params.discount); // Column AY - Discount
        if (params.finalCost) sheet.getRange(i + 1, 52).setValue(params.finalCost); // Column AZ - Final Cost
        if (params.adminNotes) sheet.getRange(i + 1, 38).setValue(params.adminNotes);
        if (params.adminNotesInternal) sheet.getRange(i + 1, 39).setValue(params.adminNotesInternal);
        if (params.technicianNotesInternal) sheet.getRange(i + 1, 41).setValue(params.technicianNotesInternal);
        
        // Upload NEW PDF if provided and update Column AP with its link
        try {
          var pdfBlob = null;
          if (e && e.files && e.files.PDF) {
            pdfBlob = e.files.PDF;
          } else if (params["PDF_Base64"]) {
            var bytes = Utilities.base64Decode(params["PDF_Base64"]);
            var mimeType = params["PDF_MimeType"] || "application/pdf";
            var fallbackName = "ServiceReport.pdf";
            var base64FileName = params["PDF_FileName"] || fallbackName;
            pdfBlob = Utilities.newBlob(bytes, mimeType, base64FileName);
          }

          if (pdfBlob) {
            var sanitize = function (str) { return String(str || '').replace(/[^a-zA-Z0-9]/g, '_'); };
            var tz = Session.getScriptTimeZone();
            var ts = Utilities.formatDate(new Date(), tz, "MM-dd HH.mm");

            var serviceId = sanitize(params["serviceId"]);
            var clientName = sanitize(params["Client Name"]);
            var deviceType = sanitize(params["Device Type"]);

            var baseName = [serviceId, clientName, deviceType].filter(Boolean).join("_");
            var desiredName =
              (params["PDF_FileName"] && params["PDF_FileName"].trim())
                ? params["PDF_FileName"].trim()
                : (baseName ? (baseName + " - UPDATED (" + ts + ").pdf") : ("ServiceReport - UPDATED (" + ts + ").pdf"));

            pdfBlob.setName(desiredName);

            var folder = DriveApp.getFolderById("1HODvuMnTrrGXSVByZEdDDH8ctxk7bpUj");
            var file = folder.createFile(pdfBlob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

            var pdfUrl = file.getUrl();
            sheet.getRange(i + 1, 42).setValue(pdfUrl);
          }
        } catch (err) {
          Logger.log("Error uploading updated PDF: " + err);
        }
        
        return ContentService.createTextOutput(JSON.stringify({
          "result": "success"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "result": "not_found"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle quotation PDF upload - uploads to Column AQ folder, stores link in Column AG
  if (params.action === 'updateQuotationPDF' && params.serviceId) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Service Database");
    var data = sheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == params.serviceId && data[i][12] == params.deviceType) {
        try {
          var quotationPdfBlob = null;
          if (e && e.files && e.files.QuotationPDF) {
            quotationPdfBlob = e.files.QuotationPDF;
          } else if (params["QuotationPDF_Base64"]) {
            var bytes = Utilities.base64Decode(params["QuotationPDF_Base64"]);
            var mimeType = params["QuotationPDF_MimeType"] || "application/pdf";
            var fallbackName = "ServiceQuotation.pdf";
            var base64FileName = params["QuotationPDF_FileName"] || fallbackName;
            quotationPdfBlob = Utilities.newBlob(bytes, mimeType, base64FileName);
          }

          if (quotationPdfBlob) {
            var desiredName = params["QuotationPDF_FileName"] || "ServiceQuotation.pdf";
            quotationPdfBlob.setName(desiredName);

            // IMPORTANT: Use Column AQ folder (same as updateServicePDF)
            var clientFolderUrl = params.ClientFolderUrl || data[i][42]; // Column AQ
            var folderId = null;
            
            // Extract folder ID from URL if it exists
            if (clientFolderUrl && clientFolderUrl.indexOf("/folders/") > -1) {
              folderId = clientFolderUrl.split("/folders/")[1].split("?")[0];
            }
            
            // If no folder exists, create one in Column AQ
            if (!folderId) {
              var parentFolder = DriveApp.getFolderById("1HODvuMnTrrGXSVByZEdDDH8ctxk7bpUj");
              var sanitize = function (str) { return String(str || '').replace(/[^a-zA-Z0-9]/g, '_'); };
              var folderName = sanitize(params.serviceId) + "_" + sanitize(params["Client Name"]) + "_" + sanitize(params["Device Type"]);
              var newFolder = parentFolder.createFolder(folderName);
              folderId = newFolder.getId();
              clientFolderUrl = "https://drive.google.com/drive/folders/" + folderId;
              
              // Save the folder URL to Column AQ
              sheet.getRange(i + 1, 43).setValue(clientFolderUrl);
            }
            
            // Upload to the client folder (Column AQ)
            var folder = DriveApp.getFolderById(folderId);
            var file = folder.createFile(quotationPdfBlob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

            var quotationPdfUrl = file.getUrl();
            
            // Save the PDF URL to Column AG - Quotation PDF URL
            sheet.getRange(i + 1, 33).setValue(quotationPdfUrl);
            
            return ContentService.createTextOutput(JSON.stringify({
              "result": "success",
              "pdfUrl": quotationPdfUrl
            })).setMimeType(ContentService.MimeType.JSON);
          }
        } catch (err) {
          Logger.log("Error uploading quotation PDF: " + err);
          return ContentService.createTextOutput(JSON.stringify({
            "result": "error",
            "message": err.toString()
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "result": "not_found"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle update requests for Technician Portal
  if (params.action === 'updateTechnicianService' && params.serviceId) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Service Database");
    var data = sheet.getDataRange().getValues();
    
    // Search for the service ID and deviceType match
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == params.serviceId && data[i][12] == params.deviceType) {
        if (params.status) sheet.getRange(i + 1, 2).setValue(params.status); // Column B
        if (params.technician) sheet.getRange(i + 1, 4).setValue(params.technician); // Column D
        // Update Technician Department (Column AN = 40)
        if (params.technicianDepartment || params.department || params["Technician Department"]) {
          var dept = params.technicianDepartment || params.department || params["Technician Department"];
          sheet.getRange(i + 1, 40).setValue(dept); // Column AN - Technician Department
        }
        if (params.technicianDiagnosis) sheet.getRange(i + 1, 31).setValue(params.technicianDiagnosis); // Column AE
        if (params.suggestedRepair) sheet.getRange(i + 1, 33).setValue(params.suggestedRepair); // Column AG
        if (params.technicianNotesCustomer) sheet.getRange(i + 1, 40).setValue(params.technicianNotesCustomer); // Column AN
        if (params.technicianNotesInternal) sheet.getRange(i + 1, 41).setValue(params.technicianNotesInternal); // Column AO
        if (params.technicianReport !== undefined) sheet.getRange(i + 1, 53).setValue(params.technicianReport); // Column BA - Technician Report
        if (params.actualCost !== undefined) sheet.getRange(i + 1, 46).setValue(params.actualCost); // Column AT - Parts Cost (actualCost from frontend)
        if (params.partsUsed !== undefined) sheet.getRange(i + 1, 47).setValue(params.partsUsed); // Column AU
        
        // Parse existing and new parts to calculate the delta
        var existingPartsUsed = data[i][46] || ""; // Column AU - parts used text
        var existingPartsData = [];
        var newPartsData = [];
        
        try {
          // Parse new parts from params
          if (params.partsUsedData) {
            newPartsData = JSON.parse(params.partsUsedData);
          }
          
          // Parse existing parts from the database (format: "Part Name (qty), Part Name (qty)")
          if (existingPartsUsed) {
            var existingParts = existingPartsUsed.split(", ");
            existingParts.forEach(function(part) {
              var match = part.match(/^(.+?)\s*\((\d+)\)$/);
              if (match) {
                existingPartsData.push({ name: match[1].trim(), quantity: parseInt(match[2]) });
              }
            });
          }
          
          // Calculate changes: what was added/removed
          var inventorySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory Management");
          var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory Log");
          var invData = inventorySheet.getDataRange().getValues();
          var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM-dd-yyyy HH:mm:ss");
          
          // Build a map of part ID to quantities
          var existingMap = {};
          var newMap = {};
          
          // Map existing parts by their IDs
          existingPartsData.forEach(function(part) {
            // Find part ID by name
            for (var j = 1; j < invData.length; j++) {
              if (invData[j][1] === part.name) {
                existingMap[invData[j][0]] = part.quantity;
                break;
              }
            }
          });
          
          // Map new parts
          newPartsData.forEach(function(part) {
            newMap[part.id] = part.quantity;
          });
          
          // Process changes
          var allPartIds = Object.keys(existingMap).concat(Object.keys(newMap));
          var uniquePartIds = allPartIds.filter(function(value, index, self) {
            return self.indexOf(value) === index;
          });
          
          uniquePartIds.forEach(function(partId) {
            var oldQty = existingMap[partId] || 0;
            var newQty = newMap[partId] || 0;
            var delta = newQty - oldQty;
            
            if (delta !== 0) {
              // Find part in inventory
              for (var j = 1; j < invData.length; j++) {
                if (invData[j][0] === partId) {
                  var previousStockQty = parseInt(invData[j][5] || 0);
                  var newStockQty = Math.max(0, previousStockQty - delta);
                  var transactionType = delta > 0 ? "Used in Service" : "Returned";
                  
                  // Update inventory quantity
                  inventorySheet.getRange(j + 1, 6).setValue(newStockQty);
                  inventorySheet.getRange(j + 1, 11).setValue(timestamp);
                  
                  // Update status
                  var status = newStockQty === 0 ? "Out of Stock" : newStockQty < 5 ? "Low Stock" : "In Stock";
                  inventorySheet.getRange(j + 1, 10).setValue(status);
                  
                  // Log the change
                  var logId = "LOG" + Date.now() + "_" + j;
                  var remark = transactionType === "Used in Service" 
                    ? "Service ID: " + params.serviceId 
                    : "Returned from Service ID: " + params.serviceId;
                  
                  logSheet.appendRow([
                    logId,
                    partId,
                    invData[j][1],
                    invData[j][2],
                    transactionType,
                    Math.abs(delta),
                    previousStockQty,
                    newStockQty,
                    timestamp,
                    remark,
                    params.username || "Unknown",
                    params.userRole || "Technician"
                  ]);
                  break;
                }
              }
            }
          });
        } catch (err) {
          Logger.log("Error processing parts changes: " + err);
        }
        
        // Handle DEVICE REPORT photos if present
        try {
          var photoCount = parseInt(params["DeviceReportPhotoCount"] || "0");
          Logger.log("Photo count: " + photoCount);
          
          if (photoCount > 0) {
            var folderUrl = data[i][42]; // Column AQ
            var folderId = null;
            
            if (folderUrl && folderUrl.indexOf("/folders/") > -1) {
              folderId = folderUrl.split("/folders/")[1].split("?")[0];
            }
            
            if (!folderId) {
              try {
                var parentFolderForService = DriveApp.getFolderById("1U1p3e89Av4nfil5cuBihXXFdCC9XgU8J");
                var newServiceFolderName = params.serviceId + " - " + (data[i][8] || "Unknown Client");
                var newServiceFolder = parentFolderForService.createFolder(newServiceFolderName);
                folderId = newServiceFolder.getId();
                folderUrl = "https://drive.google.com/drive/folders/" + folderId;
                sheet.getRange(i + 1, 43).setValue(folderUrl);
                Logger.log("Created service folder: " + folderUrl);
              } catch (folderErr) {
                Logger.log("Folder creation error: " + folderErr);
              }
            }
            
            if (folderId) {
              var parentFolder = DriveApp.getFolderById(folderId);
              var deviceReportFolder = null;
              var folders = parentFolder.getFolders();
              
              while (folders.hasNext()) {
                var folder = folders.next();
                if (folder.getName() === "Device Report") {
                  deviceReportFolder = folder;
                  break;
                }
              }
              
              if (!deviceReportFolder) {
                deviceReportFolder = parentFolder.createFolder("Device Report");
                Logger.log("Created Device Report folder");
              }
              
              var deviceReportFolderUrl = "https://drive.google.com/drive/folders/" + deviceReportFolder.getId();
              
              for (var photoIdx = 1; photoIdx <= photoCount; photoIdx++) {
                var photoKey = "DeviceReportPhoto" + photoIdx;
                var photoNameKey = "DeviceReportPhoto" + photoIdx + "_Name";
                
                if (params[photoKey]) {
                  try {
                    // Decode base64 photo data
                    var base64Data = params[photoKey];
                    var photoBlob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/jpeg');
                    var originalName = params[photoNameKey] || ("photo_" + photoIdx + ".jpg");
                    var filename = "device_report_" + photoIdx + "_" + params.serviceId + "_" + Date.now() + ".jpg";
                    photoBlob.setName(filename);
                    
                    var photoFile = deviceReportFolder.createFile(photoBlob);
                    photoFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
                    Logger.log("Uploaded photo " + photoIdx + ": " + filename);
                  } catch (uploadErr) {
                    Logger.log("Upload error " + photoIdx + ": " + uploadErr);
                  }
                } else {
                  Logger.log("Photo " + photoIdx + " not in params");
                }
              }
              
              sheet.getRange(i + 1, 48).setValue(deviceReportFolderUrl);
              Logger.log("Saved folder URL to column AV");
            }
          }
        } catch (photoErr) {
          Logger.log("Photo process error: " + photoErr);
        }
        
        return ContentService.createTextOutput(JSON.stringify({
          "result": "success"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "result": "not_found",
      "message": "Service ID not found or device type mismatch"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle updateServicePDF requests - UPDATE PDF URL for existing service (DO NOT create new row)
  if (params.action === 'updateServicePDF' && params.serviceId) {
    var serviceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Service Database");
    var data = serviceSheet.getDataRange().getValues();
    var serviceId = params.serviceId;
    
    // Find the existing service row by serviceId
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == serviceId) { // Column A is serviceId
        
        // Get existing folder or create new one
        var folderUrl = data[i][42]; // Column AQ
        var folderId = null;
        
        if (folderUrl && folderUrl.indexOf("/folders/") > -1) {
          folderId = folderUrl.split("/folders/")[1].split("?")[0];
        }
        
        // If no folder exists, create one
        if (!folderId) {
          try {
            var parentFolderForService = DriveApp.getFolderById("1U1p3e89Av4nfil5cuBihXXFdCC9XgU8J");
            var newServiceFolderName = serviceId + " - " + (data[i][8] || "Unknown Client");
            var newServiceFolder = parentFolderForService.createFolder(newServiceFolderName);
            folderId = newServiceFolder.getId();
            folderUrl = "https://drive.google.com/drive/folders/" + folderId;
            serviceSheet.getRange(i + 1, 43).setValue(folderUrl);
          } catch (folderErr) {
            Logger.log("Folder creation error: " + folderErr);
          }
        }
        
        // Upload the updated PDF to the service folder
        var pdfUrl = "";
        try {
          var pdfBlob = null;
          if (params["PDF_Base64"]) {
            var bytes = Utilities.base64Decode(params["PDF_Base64"]);
            var mimeType = params["PDF_MimeType"] || "application/pdf";
            var fileName = params["PDF_FileName"] || "updated_form.pdf";
            pdfBlob = Utilities.newBlob(bytes, mimeType, fileName);
          }
          
          if (pdfBlob && folderId) {
            var targetFolder = DriveApp.getFolderById(folderId);
            var file = targetFolder.createFile(pdfBlob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            pdfUrl = file.getUrl();
            
            // Update ONLY the PDF URL column (Column AP = 42 in 1-indexed)
            serviceSheet.getRange(i + 1, 42).setValue(pdfUrl);
            
            return ContentService.createTextOutput(JSON.stringify({
              "result": "success",
              "pdfUrl": pdfUrl
            })).setMimeType(ContentService.MimeType.JSON);
          }
        } catch (uploadErr) {
          Logger.log("PDF upload error: " + uploadErr);
          return ContentService.createTextOutput(JSON.stringify({
            "result": "error",
            "message": "Failed to upload PDF: " + uploadErr
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    
    // Service not found
    return ContentService.createTextOutput(JSON.stringify({
      "result": "error",
      "message": "Service not found"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // getDeviceReportPhotos logic is handled in doGet (see above)

  // Handle update inventory item requests
  if (params.action === 'updateInventoryItem' && params.partId) {
    var inventorySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory Management");
    var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory Log");
    var data = inventorySheet.getDataRange().getValues();
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM-dd-yyyy HH:mm:ss");
    var logId = "LOG" + Date.now();
    
    // Search for the part ID in column A (index 0)
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == params.partId) {
        // Update the part details (not quantity, that's handled by adjustStock)
        if (params.partName) inventorySheet.getRange(i + 1, 2).setValue(params.partName); // Column B
        if (params.deviceType) inventorySheet.getRange(i + 1, 3).setValue(params.deviceType); // Column C
        if (params.brand) inventorySheet.getRange(i + 1, 4).setValue(params.brand); // Column D
        if (params.model) inventorySheet.getRange(i + 1, 5).setValue(params.model); // Column E
        if (params.supplier) inventorySheet.getRange(i + 1, 8).setValue(params.supplier); // Column H
        if (params.costPerUnit) inventorySheet.getRange(i + 1, 9).setValue(params.costPerUnit); // Column I
        if (params.remarks !== undefined) inventorySheet.getRange(i + 1, 12).setValue(params.remarks); // Column L
        inventorySheet.getRange(i + 1, 11).setValue(timestamp); // Column K - Last Updated
        
        // Log the update
        logSheet.appendRow([
          logId,
          params.partId,
          params.partName || data[i][1],
          params.deviceType || data[i][2],
          "Part Details Updated",
          0,
          data[i][5], // Previous Quantity (unchanged)
          data[i][5], // New Quantity (unchanged)
          timestamp,
          "Updated by " + (params.updatedBy || "Admin"),
          params.updatedBy || "Admin",
          "Management"
        ]);
        
        return ContentService.createTextOutput(JSON.stringify({
          "result": "success"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "result": "not_found"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle delete inventory item requests
  if (params.action === 'deleteInventoryItem' && params.partId) {
    var inventorySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory Management");
    var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory Log");
    var data = inventorySheet.getDataRange().getValues();
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM-dd-yyyy HH:mm:ss");
    var logId = "LOG" + Date.now();
    
    // Search for the part ID in column A (index 0)
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == params.partId) {
        // Log the deletion before deleting
        logSheet.appendRow([
          logId,
          data[i][0], // Part ID
          data[i][1], // Part Name
          data[i][2], // Device Type
          "Part Deleted",
          data[i][5], // Quantity at deletion
          data[i][5], // Previous Quantity
          0, // New Quantity (0 after deletion)
          timestamp,
          "Deleted by " + (params.deletedBy || "Admin"),
          params.deletedBy || "Admin",
          "Management"
        ]);
        
        // Delete the row
        inventorySheet.deleteRow(i + 1);
        
        return ContentService.createTextOutput(JSON.stringify({
          "result": "success"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "result": "not_found"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Handle add inventory item requests
  if (params.action === 'addInventoryItem') {
    var inventorySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory Management");
    var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory Log");
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM-dd-yyyy HH:mm:ss");
    // Use client-provided partId when available so it matches the QR code encoded on the frontend
    var partId = params.partId || ("PART" + Date.now());
    var logId = "LOG" + Date.now();
    
    // Add to Inventory Management sheet
    // Columns: Part ID, Part Name, Device Type, Brand, Model, Quantity, Date Ordered, Supplier, Cost/Unit, Status, Last Updated, Remarks, QR Code (M)
    inventorySheet.appendRow([
      partId,
      params.partName,
      params.deviceType,
      params.brand,
      params.model,
      params.quantity,
      params.dateOrdered || "",
      params.supplier || "",
      params.costPerUnit || "",
      params.status,
      timestamp,
      params.remarks,
      params.qrCode || "" // Column M - QR Code data URL (generated client-side)
    ]);
    
    // Log the initial stock to Inventory Log
    // Columns: Log ID, Part ID, Part Name, Device Type, Transaction Type, Quantity Changed, Previous Quantity, New Quantity, Date & Time, Remarks/Notes, Username, Role
    logSheet.appendRow([
      logId,
      partId,
      params.partName,
      params.deviceType,
      "Initial Stock",
      params.quantity,
      0,
      params.quantity,
      timestamp,
      params.remarks,
      params.addedBy || "Admin",
      "Management"
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      "result": "success",
      "partId": partId
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle stock adjustment requests
  if (params.action === 'adjustStock' && params.partId) {
    var inventorySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory Management");
    var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory Log");
    var data = inventorySheet.getDataRange().getValues();
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM-dd-yyyy HH:mm:ss");
    var logId = "LOG" + Date.now();
    
    // Search for the part ID in column A (index 0)
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == params.partId) {
        var previousQty = parseInt(data[i][5] || 0);
        var adjustQty = parseInt(params.quantity);
        var newQty;
        var adjustmentType = params.adjustmentType;
        
        // Calculate new quantity based on adjustment type
        if (adjustmentType === "add") {
          newQty = previousQty + adjustQty;
        } else if (adjustmentType === "remove") {
          newQty = Math.max(0, previousQty - adjustQty);
        } else {
          newQty = adjustQty;
        }
        
        // Update quantity in Inventory Management sheet (Column F = 6)
        inventorySheet.getRange(i + 1, 6).setValue(newQty);
        // Update Last Updated (Column K = 11)
        inventorySheet.getRange(i + 1, 11).setValue(timestamp);
        
        // Auto-update status based on quantity (Column J = 10)
        // BUT do NOT auto-update if current status is "On Order"
        var currentStatus = data[i][9]; // Column J = index 9
        if (currentStatus !== "On Order") {
          var status = newQty === 0 ? "Out of Stock" : newQty < 5 ? "Low Stock" : "In Stock";
          inventorySheet.getRange(i + 1, 10).setValue(status);
        }
        
        // Log the adjustment to Inventory Log
        // Columns: Log ID, Part ID, Part Name, Device Type, Transaction Type, Quantity Changed, Previous Quantity, New Quantity, Date & Time, Remarks/Notes, Username, Role
        logSheet.appendRow([
          logId,
          params.partId,
          data[i][1], // Part Name
          data[i][2], // Device Type
          adjustmentType === "add" ? "Stock In" : adjustmentType === "remove" ? "Stock Out" : "Adjustment",
          adjustQty,
          previousQty,
          newQty,
          timestamp,
          params.remarks,
          params.adjustedBy || "Admin",
          params.userRole || "Management"
        ]);
        
        return ContentService.createTextOutput(JSON.stringify({
          "result": "success"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "result": "not_found"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle activity logging
  if (params.action === 'logActivity') {
    var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Activity Logs");
    
    if (!logSheet) {
      // Create the Activity Logs sheet if it doesn't exist
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      logSheet = ss.insertSheet("Activity Logs");
      logSheet.appendRow(["Log ID", "Service ID", "Username", "Role", "Timestamp", "Activity"]);
    }
    
    var logId = "LOG" + Date.now();
    
    logSheet.appendRow([
      logId,
      params.serviceId,
      params.username,
      params.role,
      params.timestamp,
      params.activity
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "logId": logId
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  
  // Handle place order action
  if (params.action === "placeOrder") {
    var inventorySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory Management");
    var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory Log");
    var data = inventorySheet.getDataRange().getValues();
    var timestamp = Utilities.formatDate(new Date(), "GMT+8", "MM-dd-yyyy, HH:mm");
    var logId = "LOG" + Date.now();
    
    // Find the part
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === params.partId) {
        var currentQty = parseInt(data[i][5] || 0);
        var orderedQty = parseInt(params.orderedQuantity || 0);
        
        // Update status to "On Order" without changing quantity
        inventorySheet.getRange(i + 1, 10).setValue("On Order"); // Column J = 10
        inventorySheet.getRange(i + 1, 11).setValue(timestamp); // Column K = 11
        
        // Update remarks with order information
        var newRemarks = "Ordered: " + orderedQty + " units | Current Stock: " + currentQty + " units";
        if (params.remarks) {
          newRemarks += " | Notes: " + params.remarks;
        }
        inventorySheet.getRange(i + 1, 12).setValue(newRemarks); // Column L = 12
        
        // Log the order
        logSheet.appendRow([
          logId,
          params.partId,
          data[i][1], // Part Name
          data[i][2], // Device Type
          "Order Placed",
          orderedQty,
          currentQty,
          currentQty,
          timestamp,
          "Ordered: " + orderedQty + " units | Current Stock: " + currentQty + " units",
          params.adjustedBy || "Admin",
          params.userRole || "Management"
        ]);
        
        return ContentService.createTextOutput(JSON.stringify({
          "result": "success"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "result": "not_found"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle receive order action
  if (params.action === "receiveOrder") {
    var inventorySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory Management");
    var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory Log");
    var data = inventorySheet.getDataRange().getValues();
    var timestamp = Utilities.formatDate(new Date(), "GMT+8", "MM-dd-yyyy, HH:mm");
    var logId = "LOG" + Date.now();
    
    // Find the part
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === params.partId) {
        var currentQty = parseInt(data[i][5] || 0);
        var remarks = data[i][11] || "";
        
        // Extract ordered quantity from remarks
        var orderedQty = 0;
        var match = remarks.match(/Ordered:\s*(\d+)\s*units/);
        if (match && match[1]) {
          orderedQty = parseInt(match[1]);
        }
        
        // Add ordered quantity to current quantity
        var newQty = currentQty + orderedQty;
        
        // Update quantity
        inventorySheet.getRange(i + 1, 6).setValue(newQty); // Column F = 6
        
        // Update status based on new quantity
        var newStatus = newQty === 0 ? "Out of Stock" : newQty < 5 ? "Low Stock" : "In Stock";
        inventorySheet.getRange(i + 1, 10).setValue(newStatus); // Column J = 10
        inventorySheet.getRange(i + 1, 11).setValue(timestamp); // Column K = 11
        
        // Log the receipt
        logSheet.appendRow([
          logId,
          params.partId,
          data[i][1], // Part Name
          data[i][2], // Device Type
          "Order Received",
          orderedQty,
          currentQty,
          newQty,
          timestamp,
          "Received: " + orderedQty + " units | Current Stock: " + newQty + " units",
          params.receivedBy || "Admin",
          params.userRole || "Management"
        ]);
        
        return ContentService.createTextOutput(JSON.stringify({
          "result": "success",
          "newStatus": newStatus
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "result": "not_found"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle staff management (inside doPost)
  if (params.action === 'addStaff') {
    var staffSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Staff Management");
    if (!staffSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "Staff Management sheet not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Columns: A=Staff ID, B=Username, C=Password, D=Name, E=Role, F=Department, G=Status
    var row = [
      params.staffId,
      params.username,
      params.password,
      params.name,
      params.role,
      params.department || "",
      params.status
    ];
    staffSheet.appendRow(row);
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "staffId": params.staffId
    })).setMimeType(ContentService.MimeType.JSON);
  }

  if (params.action === 'updateStaff' && params.username) {
    var staffSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Staff Management");
    if (!staffSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "Staff Management sheet not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = staffSheet.getDataRange().getValues();
    // Columns: A=Staff ID, B=Username, C=Password, D=Name, E=Role, F=Department, G=Status
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] == params.username) { // Column B = Username
        // Update all fields
        if (params.staffId) staffSheet.getRange(i + 1, 1).setValue(params.staffId);
        if (params.password) staffSheet.getRange(i + 1, 3).setValue(params.password);
        if (params.name) staffSheet.getRange(i + 1, 4).setValue(params.name);
        if (params.role) staffSheet.getRange(i + 1, 5).setValue(params.role);
        staffSheet.getRange(i + 1, 6).setValue(params.department || "");
        if (params.status) staffSheet.getRange(i + 1, 7).setValue(params.status);
        
        return ContentService.createTextOutput(JSON.stringify({
          "status": "success"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": "Staff member not found"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  if (params.action === 'removeStaff' && params.username) {
    var staffSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Staff Management");
    if (!staffSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "Staff Management sheet not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = staffSheet.getDataRange().getValues();
    // Columns: A=Staff ID, B=Username, C=Password, D=Name, E=Role, F=Department, G=Status
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] == params.username) { // Column B = Username
        staffSheet.deleteRow(i + 1);
        return ContentService.createTextOutput(JSON.stringify({
          "status": "success"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": "Staff member not found"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Handle update client inquiry
  if (params.action === 'updateClientInquiry' && params.rowIndex) {
    var inquirySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inquiry Database");
    if (!inquirySheet) {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "Inquiry Database sheet not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var rowIndex = parseInt(params.rowIndex);
    // Columns: A=Client ID, B=Service ID, C=Timestamp, D=(unused), E=Name, F=Address, G=Contact Number,
    //          H=Mode of Transfer, I=Device, J=Initial Diagnosis, K=Quotation, L=Pick-Up Date, M=Direct Chat Link, N=AI Status,
    //          O=Pre-Order, P=Initial Payment, Q=Part ID
    inquirySheet.getRange(rowIndex, 1).setValue(params.clientId || "");
    inquirySheet.getRange(rowIndex, 2).setValue(params.serviceId || "");
    inquirySheet.getRange(rowIndex, 5).setValue(params.name || "");
    inquirySheet.getRange(rowIndex, 6).setValue(params.address || "");
    inquirySheet.getRange(rowIndex, 7).setValue(params.contactNumber || "");
    inquirySheet.getRange(rowIndex, 8).setValue(params.modeOfTransfer || "");
    inquirySheet.getRange(rowIndex, 9).setValue(params.device || "");
    inquirySheet.getRange(rowIndex, 10).setValue(params.initialDiagnosis || "");
    inquirySheet.getRange(rowIndex, 11).setValue(params.quotation || "");
    inquirySheet.getRange(rowIndex, 12).setValue(params.pickUpDate || "");
    inquirySheet.getRange(rowIndex, 13).setValue(params.directChatLink || "");
    inquirySheet.getRange(rowIndex, 15).setValue(params.preOrder || ""); // Column O - Pre-Order
    inquirySheet.getRange(rowIndex, 16).setValue(params.initialPayment || ""); // Column P - Initial Payment
    inquirySheet.getRange(rowIndex, 17).setValue(params.partId || ""); // Column Q - Part ID
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Handle delete client inquiry
  if (params.action === 'deleteClientInquiry' && params.rowIndex) {
    var inquirySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inquiry Database");
    if (!inquirySheet) {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "Inquiry Database sheet not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var rowIndex = parseInt(params.rowIndex);
    inquirySheet.deleteRow(rowIndex);
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Handle update client inquiry AI status only (Column N)
  if (params.action === 'updateClientInquiryAI' && params.rowIndex) {
    var inquirySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inquiry Database");
    if (!inquirySheet) {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "Inquiry Database sheet not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var rowIndex = parseInt(params.rowIndex);
    // Column N = 14 (AI Status: "ON-AI" or "OFF-AI")
    inquirySheet.getRange(rowIndex, 14).setValue(params.aiStatus || "OFF-AI");
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // ========== NOTIFICATIONS (POST) ==========
  
  // Create a new notification
  if (params.action === 'createNotification') {
    var notifSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Notifications");
    if (!notifSheet) {
      // Create the sheet if it doesn't exist
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      notifSheet = ss.insertSheet("Notifications");
      notifSheet.appendRow(["ID", "User ID", "Title", "Message", "Type", "sRead", "Timestamp", "Service ID"]);
    }
    
    var notifId = "NOTIF" + Date.now();
    // IMPORTANT: store real UTC ISO timestamp ("Z" means UTC). Don't format in local timezone with a "Z" suffix.
    var timestamp = new Date().toISOString();
    notifSheet.appendRow([
      notifId,
      params.userId,
      params.title,
      params.message,
      params.type || "system",
      "FALSE",
      timestamp,
      params.serviceId || ""
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      notificationId: notifId
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Mark notification as read
  if (params.action === 'markNotificationRead' && params.notificationId) {
    var notifSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Notifications");
    if (!notifSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "Notifications sheet not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = notifSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === params.notificationId) {
        notifSheet.getRange(i + 1, 6).setValue("TRUE"); // Column F = Read
        return ContentService.createTextOutput(JSON.stringify({
          success: true
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Notification not found"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Mark all notifications as read for a user
  if (params.action === 'markAllNotificationsRead' && params.userId) {
    var notifSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Notifications");
    if (!notifSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "Notifications sheet not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = notifSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] === params.userId && data[i][5] !== "TRUE") {
        notifSheet.getRange(i + 1, 6).setValue("TRUE");
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // ========== MESSAGING (POST) ==========
  
  // Send a new message
  if (params.action === 'sendMessage') {
    var msgSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Messages");
    if (!msgSheet) {
      // Create the sheet if it doesn't exist
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      msgSheet = ss.insertSheet("Messages");
      msgSheet.appendRow(["ID", "Sender ID", "Sender Name", "Receiver ID", "Receiver Name", "Content", "Read", "Created At"]);
    }
    
    var msgId = "MSG" + Date.now();
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
    
    msgSheet.appendRow([
      msgId,
      params.senderId,
      params.senderName,
      params.receiverId,
      params.receiverName,
      params.content,
      "FALSE",
      timestamp
    ]);
    
    // Also create a notification for the receiver
    var notifSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Notifications");
    if (notifSheet) {
      var notifId = "NOTIF" + Date.now();
      notifSheet.appendRow([
        notifId,
        params.receiverId,
        "New message from " + params.senderName,
        params.content.substring(0, 100) + (params.content.length > 100 ? "..." : ""),
        "message",
        "FALSE",
        timestamp,
        ""
      ]);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      messageId: msgId
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Mark message as read
  if (params.action === 'markMessageRead' && params.messageId) {
    var msgSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Messages");
    if (!msgSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "Messages sheet not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = msgSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === params.messageId) {
        msgSheet.getRange(i + 1, 7).setValue("TRUE"); // Column G = Read
        return ContentService.createTextOutput(JSON.stringify({
          success: true
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Message not found"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // ========== GROUP CHATS (POST) ==========
  
  // Create a new group chat
  if (params.action === 'createGroupChat') {
    var groupSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("GroupChats");
    if (!groupSheet) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      groupSheet = ss.insertSheet("GroupChats");
      groupSheet.appendRow(["ID", "Name", "Created By", "Member IDs", "Member Names", "Created At"]);
    }
    
    var groupId = "GRP" + Date.now();
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
    
    groupSheet.appendRow([
      groupId,
      params.name,
      params.createdBy,
      params.memberIds,
      params.memberNames,
      timestamp
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      groupId: groupId
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Send a message to a group
  if (params.action === 'sendGroupMessage' && params.groupId) {
    var msgSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Messages");
    var groupSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("GroupChats");
    
    if (!msgSheet) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      msgSheet = ss.insertSheet("Messages");
      msgSheet.appendRow(["ID", "Sender ID", "Sender Name", "Receiver ID", "Receiver Name", "Content", "Read", "Created At", "Group ID"]);
    }
    
    // Get group name
    var groupName = "Group";
    if (groupSheet) {
      var groupData = groupSheet.getDataRange().getValues();
      for (var i = 1; i < groupData.length; i++) {
        if (groupData[i][0] === params.groupId) {
          groupName = groupData[i][1];
          break;
        }
      }
    }
    
    var msgId = "MSG" + Date.now();
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
    
    msgSheet.appendRow([
      msgId,
      params.senderId,
      params.senderName,
      params.groupId,
      groupName,
      params.content,
      "FALSE",
      timestamp,
      params.groupId
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      messageId: msgId
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Add member to group
  if (params.action === 'addGroupMember' && params.groupId) {
    var groupSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("GroupChats");
    if (!groupSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "GroupChats sheet not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = groupSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === params.groupId) {
        var memberIds = data[i][3] ? data[i][3].toString().split(',') : [];
        var memberNames = data[i][4] ? data[i][4].toString().split(',') : [];
        
        if (memberIds.indexOf(params.memberId) === -1) {
          memberIds.push(params.memberId);
          memberNames.push(params.memberName);
          groupSheet.getRange(i + 1, 4).setValue(memberIds.join(','));
          groupSheet.getRange(i + 1, 5).setValue(memberNames.join(','));
        }
        
        return ContentService.createTextOutput(JSON.stringify({
          success: true
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Group not found"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Remove member from group
  if (params.action === 'removeGroupMember' && params.groupId) {
    var groupSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("GroupChats");
    if (!groupSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "GroupChats sheet not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = groupSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === params.groupId) {
        var memberIds = data[i][3] ? data[i][3].toString().split(',') : [];
        var memberNames = data[i][4] ? data[i][4].toString().split(',') : [];
        var idx = memberIds.indexOf(params.memberId);
        
        if (idx > -1) {
          memberIds.splice(idx, 1);
          memberNames.splice(idx, 1);
          groupSheet.getRange(i + 1, 4).setValue(memberIds.join(','));
          groupSheet.getRange(i + 1, 5).setValue(memberNames.join(','));
        }
        
        return ContentService.createTextOutput(JSON.stringify({
          success: true
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Group not found"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // ========== TYPING INDICATORS (POST) ==========
  
  // Set typing status
  if (params.action === 'setTypingStatus' && params.userId && params.conversationId) {
    var typingSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("TypingStatus");
    if (!typingSheet) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      typingSheet = ss.insertSheet("TypingStatus");
      typingSheet.appendRow(["User ID", "Conversation ID", "Is Group", "Timestamp"]);
    }
    
    var data = typingSheet.getDataRange().getValues();
    var found = false;
    var timestamp = new Date().toISOString();
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === params.userId && data[i][1] === params.conversationId) {
        typingSheet.getRange(i + 1, 4).setValue(timestamp);
        found = true;
        break;
      }
    }
    
    if (!found) {
      typingSheet.appendRow([params.userId, params.conversationId, params.isGroup || "false", timestamp]);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Clear typing status
  if (params.action === 'clearTypingStatus' && params.userId && params.conversationId) {
    var typingSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("TypingStatus");
    if (typingSheet) {
      var data = typingSheet.getDataRange().getValues();
      for (var i = data.length - 1; i >= 1; i--) {
        if (data[i][0] === params.userId && data[i][1] === params.conversationId) {
          typingSheet.deleteRow(i + 1);
          break;
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // ========== READ RECEIPTS (POST) ==========
  
  // Mark group message as read (create read receipt)
  if (params.action === 'markGroupMessageRead' && params.messageId && params.userId) {
    var receiptsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("ReadReceipts");
    if (!receiptsSheet) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      receiptsSheet = ss.insertSheet("ReadReceipts");
      receiptsSheet.appendRow(["ID", "Message ID", "User ID", "User Name", "Read At"]);
    }
    
    // Check if receipt already exists
    var data = receiptsSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] === params.messageId && data[i][2] === params.userId) {
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          exists: true
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    var receiptId = "RR" + Date.now() + Math.random().toString(36).substr(2, 5);
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
    
    receiptsSheet.appendRow([
      receiptId,
      params.messageId,
      params.userId,
      params.userName || "",
      timestamp
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // ADD Fast Moving Part Request
  if (action === 'addFastMovingPart') {
    try {
      var fmSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Fast Moving Inventory");
      if (!fmSheet) {
        return ContentService.createTextOutput(JSON.stringify({
          result: "error",
          message: "Sheet not found: Fast Moving Inventory"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var partId = "FM" + Date.now();
      var timestamp = new Date().toISOString();

      // Use params (e.parameter) consistently
      fmSheet.appendRow([
        partId,
        params.requestedBy || "",
        params.serviceId || "",
        params.partName || "",
        params.deviceType || "",
        params.brand || "",
        params.model || "",
        params.quantity || "",
        params.dateNeeded || "",
        "", // Date Ordered
        "", // Date Received
        "", // Supplier
        "", // Cost
        params.status || "For Ordering",
        timestamp,
        params.remarks || ""
      ]);

      // Notify management about new request (optional)
      var notifSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Notifications");
      var staffSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Staff Management");

      if (notifSheet && staffSheet) {
        var staffData = staffSheet.getDataRange().getValues();
        for (var i = 1; i < staffData.length; i++) {
          if (staffData[i][2] && String(staffData[i][2]).toLowerCase() === "management" && staffData[i][3] === "Active") {
            var notifId = "NOTIF" + Date.now() + Math.random().toString(36).substr(2, 5);
            notifSheet.appendRow([
              notifId,
              staffData[i][0],
              "service_update",
              "New Part Request",
              (params.requestedBy || "") + " requested " + (params.partName || "") + " for Service ID: " + (params.serviceId || ""),
              "",
              timestamp,
              "false"
            ]);
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        result: "success",
        partId: partId
      })).setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        result: "error",
        message: "addFastMovingPart failed: " + err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // UPDATE Fast Moving Part Order (when placing order)
  if (action === 'updateFastMovingPartOrder') {
    var fmSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Fast Moving Inventory");
    var data = fmSheet.getDataRange().getValues();
    var timestamp = new Date().toISOString();
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === e.parameter.partId) {
        fmSheet.getRange(i + 1, 10).setValue(e.parameter.dateOrdered || ""); // Column J
        fmSheet.getRange(i + 1, 12).setValue(e.parameter.supplier || ""); // Column L
        fmSheet.getRange(i + 1, 13).setValue(e.parameter.cost || ""); // Column M
        fmSheet.getRange(i + 1, 14).setValue(e.parameter.status || "Ordered"); // Column N
        fmSheet.getRange(i + 1, 15).setValue(timestamp); // Column O
        if (e.parameter.remarks) {
          fmSheet.getRange(i + 1, 16).setValue(e.parameter.remarks); // Column P
        }
        break;
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "result": "success"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // RECEIVE Fast Moving Part
  if (action === 'receiveFastMovingPart') {
    var fmSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Fast Moving Inventory");
    var serviceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Service Database");
    var data = fmSheet.getDataRange().getValues();
    var timestamp = new Date().toISOString();
    
    var partName = e.parameter.partName; // kept for backwards compatibility (older clients send part name)
    var serviceId = e.parameter.serviceId;
    var cost = e.parameter.cost || "0";
    var quantity = e.parameter.quantity || "1";
    var partId = e.parameter.partId;
    
    // Update Fast Moving sheet
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === partId) {
        fmSheet.getRange(i + 1, 11).setValue(e.parameter.dateReceived || timestamp.split('T')[0]); // Column K
        fmSheet.getRange(i + 1, 14).setValue("Received"); // Column N
        fmSheet.getRange(i + 1, 15).setValue(timestamp); // Column O
        break;
      }
    }
    
    // Update Service Database - Add to Parts Cost (AT) and Parts Used (AU)
    if (serviceSheet && serviceId) {
      var serviceData = serviceSheet.getDataRange().getValues();
      for (var j = 1; j < serviceData.length; j++) {
        if (serviceData[j][0] === serviceId) {
          // Column AT (46) - Parts Cost
          var existingPartsCost = parseFloat(serviceData[j][45]) || 0;
          var newPartsCost = existingPartsCost + (parseFloat(cost) * parseInt(quantity));
          serviceSheet.getRange(j + 1, 46).setValue(newPartsCost);
          
          // Column AU (47) - Parts Used
          // IMPORTANT: store Part ID (not part name)
          var existingPartsUsed = serviceData[j][46] || "";
          var newPart = partId + " (x" + quantity + ")";
          var updatedPartsUsed = existingPartsUsed ? existingPartsUsed + ", " + newPart : newPart;
          serviceSheet.getRange(j + 1, 47).setValue(updatedPartsUsed);
          break;
        }
      }
    }
    
    // NOTE: Notification is handled by frontend via notifyPartReceived() - no duplicate notification here
    
    return ContentService.createTextOutput(JSON.stringify({
      "result": "success"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // UPDATE Fast Moving Part (edit)
  if (action === 'updateFastMovingPart') {
    var fmSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Fast Moving Inventory");
    var data = fmSheet.getDataRange().getValues();
    var timestamp = new Date().toISOString();
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === e.parameter.partId) {
        fmSheet.getRange(i + 1, 4).setValue(e.parameter.partName || data[i][3]); // Column D
        fmSheet.getRange(i + 1, 5).setValue(e.parameter.deviceType || data[i][4]); // Column E
        fmSheet.getRange(i + 1, 6).setValue(e.parameter.brand || data[i][5]); // Column F
        fmSheet.getRange(i + 1, 7).setValue(e.parameter.model || data[i][6]); // Column G
        fmSheet.getRange(i + 1, 8).setValue(e.parameter.quantity || data[i][7]); // Column H
        fmSheet.getRange(i + 1, 15).setValue(timestamp); // Column O
        fmSheet.getRange(i + 1, 16).setValue(e.parameter.remarks || data[i][15]); // Column P
        break;
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "result": "success"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // CANCEL Fast Moving Part (set status to Cancelled, update remarks)
  if (action === 'cancelFastMovingPart') {
    var fmSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Fast Moving Inventory");
    var data = fmSheet.getDataRange().getValues();
    var timestamp = new Date().toISOString();

    // Robust header matching (handles extra spaces/typos like "Requsted By")
    var headers = fmSheet.getRange(1, 1, 1, fmSheet.getLastColumn()).getDisplayValues()[0] || [];
    var norm = function (s) {
      return String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .trim();
    };

    var findCol = function (keyNorm) {
      for (var hi = 0; hi < headers.length; hi++) {
        var h = norm(headers[hi]);
        if (h === keyNorm) return hi + 1;
      }
      return -1;
    };

    // Prefer header-based columns but ALWAYS also update the known correct columns
    var statusCol = findCol('status');
    var lastUpdatedCol = findCol('lastupdated');
    var remarksCol = findCol('remarks');

    // Your sheet order (confirmed): Status=N(14), Last Updated=O(15), Remarks=P(16)
    if (statusCol <= 0) statusCol = 14;
    if (lastUpdatedCol <= 0) lastUpdatedCol = 15;
    if (remarksCol <= 0) remarksCol = 16;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(params.partId)) {
        // Set status (both resolved col and fixed col 14, in case headers are off)
        fmSheet.getRange(i + 1, statusCol).setValue("Cancelled");
        if (statusCol !== 14) {
          fmSheet.getRange(i + 1, 14).setValue("Cancelled");
        }

        fmSheet.getRange(i + 1, lastUpdatedCol).setValue(timestamp);
        if (lastUpdatedCol !== 15) {
          fmSheet.getRange(i + 1, 15).setValue(timestamp);
        }

        var existingRemarks = data[i][remarksCol - 1] || "";
        var cancelNote = params.cancelRemark ? ("[CANCELLED] " + params.cancelRemark) : "[CANCELLED]";
        var updatedRemarks = existingRemarks ? (existingRemarks + " | " + cancelNote) : cancelNote;
        fmSheet.getRange(i + 1, remarksCol).setValue(updatedRemarks);
        if (remarksCol !== 16) {
          fmSheet.getRange(i + 1, 16).setValue(updatedRemarks);
        }

        break;
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      "result": "success"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // DELETE Fast Moving Part
  if (action === 'deleteFastMovingPart') {
    var fmSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Fast Moving Inventory");
    var data = fmSheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === e.parameter.partId) {
        fmSheet.deleteRow(i + 1);
        break;
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "result": "success"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle service form submissions
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Service Database");
  var clientSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Client Database");
  
  // Generate or retrieve Client ID
  var clientId = params["Client ID"] || "";
  var serviceIdValue = params["Service ID"];
  var clientNameValue = params["Client Name"];
  var usernameValue = params["Username"];
  var phoneValue = params["Phone"];
  var emailValue = params["Email"];
  
  if (!clientId) {
    // Generate new Client ID: CL + timestamp
    clientId = "CL" + Date.now();
  }
  
  // Update or create Client Database entry
  var clientData = clientSheet.getDataRange().getValues();
  var clientFound = false;
  
  for (var i = 1; i < clientData.length; i++) {
    if (clientData[i][0] == clientId) {
      // Existing client - append new Service ID
      var existingServiceIds = clientData[i][5] || "";
      var updatedServiceIds = existingServiceIds ? existingServiceIds + ", " + serviceIdValue : serviceIdValue;
      clientSheet.getRange(i + 1, 6).setValue(updatedServiceIds);
      clientFound = true;
      break;
    }
  }
  
  if (!clientFound) {
    // New client - add to Client Database
    // Columns: Client ID, Client Name, Username, Contact Number, Email, Service IDs
    clientSheet.appendRow([
      clientId,
      clientNameValue,
      usernameValue,
      phoneValue,
      emailValue,
      serviceIdValue
    ]);
  }
  
  // Create folder for this service: SERVICE ID - NAME format
  var serviceFolderId = "";
  try {
    var parentFolder = DriveApp.getFolderById("1U1p3e89Av4nfil5cuBihXXFdCC9XgU8J");
    var folderName = params["Service ID"] + " - " + params["Client Name"];
    var serviceFolder = parentFolder.createFolder(folderName);
    serviceFolderId = serviceFolder.getId();
  } catch (error) {
    Logger.log("Error creating service folder: " + error);
  }

  // Resolve target folder (service-specific if created, otherwise default)
  var targetFolder = null;
  try {
    if (serviceFolderId) {
      targetFolder = DriveApp.getFolderById(serviceFolderId);
    } else {
      // fallback folder
      targetFolder = DriveApp.getFolderById("1HODvuMnTrrGXSVByZEdDDH8ctxk7bpUj");
    }
  } catch (error) {
    Logger.log("Error getting target folder: " + error);
  }
  
  // Handle PDF file upload if present
  var pdfUrl = "";
  try {
    var sanitize = function(str) { return String(str || '').replace(/[^a-zA-Z0-9]/g, '_'); };
    var baseName = sanitize(params["Serial"]) + "_" + sanitize(params["Client Name"]) + "_" + sanitize(params["Device Type"]);

    var pdfBlob = null;
    if (e && e.files && e.files.PDF) {
      pdfBlob = e.files.PDF;
      pdfBlob.setName(baseName + ".pdf");
    } else if (params["PDF_Base64"]) {
      var bytes = Utilities.base64Decode(params["PDF_Base64"]);
      var mimeType = params["PDF_MimeType"] || "application/pdf";
      var fileName = params["PDF_FileName"] || (baseName + ".pdf");
      pdfBlob = Utilities.newBlob(bytes, mimeType, fileName);
    }

    if (pdfBlob && targetFolder) {
      var file = targetFolder.createFile(pdfBlob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      pdfUrl = file.getUrl();
    }
  } catch (error) {
    Logger.log("Error uploading PDF: " + error);
  }

  // Handle SIGNATURE upload if present
  var signatureUrl = "";
  try {
    var signatureBlob = null;

    // 1) If coming as real file (FormData.append("Signature", file))
    if (e && e.files && e.files.Signature) {
      signatureBlob = e.files.Signature;
    }
    // 2) Fallback: base64 fields (Signature_Base64, Signature_MimeType, Signature_FileName)
    else if (params["Signature_Base64"]) {
      var sigBytes = Utilities.base64Decode(params["Signature_Base64"]);
      var sigMimeType = params["Signature_MimeType"] || "image/png";
      var sigFileName = params["Signature_FileName"] || (baseName + "_signature.png");
      signatureBlob = Utilities.newBlob(sigBytes, sigMimeType, sigFileName);
    }

    if (signatureBlob && targetFolder) {
      var sigFile = targetFolder.createFile(signatureBlob);
      sigFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      signatureUrl = sigFile.getUrl();
    }
  } catch (error) {
    Logger.log("Error uploading signature: " + error);
  }

  // Handle DEVICE REPORT folder first (needed for device report photos later)
  var deviceReportFolderUrl = "";
  var deviceReportFolder = null;
  try {
    if (targetFolder) {
      // Reuse existing Device Report subfolder if it exists, otherwise create it
      var existingDeviceReportFolders = targetFolder.getFoldersByName("Device Report");
      if (existingDeviceReportFolders.hasNext()) {
        deviceReportFolder = existingDeviceReportFolders.next();
      } else {
        deviceReportFolder = targetFolder.createFolder("Device Report");
      }

      deviceReportFolderUrl = "https://drive.google.com/drive/folders/" + deviceReportFolder.getId();
    }
  } catch (error) {
    Logger.log("Error creating Device Report folder: " + error);
  }

  // Handle DEVICE ANNOTATION upload if present (upload to MAIN folder -> Column AW, NOT Device Report folder)
  var annotationImageUrl = "";
  try {
    var annotationBlob = null;

    // 1) If coming as real file (FormData.append("DeviceAnnotation", file))
    if (e && e.files && e.files.DeviceAnnotation) {
      annotationBlob = e.files.DeviceAnnotation;
    }
    // 2) Fallback: base64 fields (DeviceAnnotation_Base64, DeviceAnnotation_MimeType, DeviceAnnotation_FileName)
    else if (params["DeviceAnnotation_Base64"]) {
      var annBytes = Utilities.base64Decode(params["DeviceAnnotation_Base64"]);
      var annMimeType = params["DeviceAnnotation_MimeType"] || "image/png";
      var annFileName = params["DeviceAnnotation_FileName"] || (baseName + "_device_annotation.png");
      annotationBlob = Utilities.newBlob(annBytes, annMimeType, annFileName);
    }

    // Upload annotation to MAIN folder (targetFolder) and save a direct image URL
    if (annotationBlob && targetFolder) {
      var annotationFile = targetFolder.createFile(annotationBlob);
      annotationFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      var annotationFileId = annotationFile.getId();
      annotationImageUrl = "https://drive.google.com/uc?export=view&id=" + annotationFileId;
    }
  } catch (error) {
    Logger.log("Error uploading device annotation: " + error);
  }

  // Upload device report photos to Device Report folder
  try {
    if (deviceReportFolder) {
      var photoCount = parseInt(params["DeviceReportPhotoCount"] || "0");
      if (photoCount > 0 && e && e.files) {
        for (var i = 1; i <= photoCount; i++) {
          var photoKey = "DeviceReportPhoto" + i;
          if (e.files[photoKey]) {
            var photoBlob = e.files[photoKey];
            photoBlob.setName("device_report_" + i + "_" + baseName + ".jpg");
            var photoFile = deviceReportFolder.createFile(photoBlob);
            photoFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            Logger.log("Uploaded Device Report photo " + i);
          }
        }
      }
    }
  } catch (error) {
    Logger.log("Error uploading device report photos: " + error);
  }
  
  // Map the form data to the correct columns
  var row = [
    params["Service ID"],              // A: Service ID
    "Pending Diagnosis",               // B: Status
    params["Admin Representative"],    // C: Admin Rep
    params["Technician"],              // D: Technician
    params["Timestamp"],               // E: Timestamp
    clientId,                          // F: Client ID
    params["Priority"],                // G: Priority
    params["Client Type"],             // H: Client Type
    params["Client Name"],             // I: Client Name
    params["Username"],                // J: Username
    params["Email"],                   // K: Email
    params["Phone"],                   // L: Phone
    params["Device Type"],             // M: Device Type
    params["Serial"],                  // N: Serial
    params["Brand"],                   // O: Brand
    params["Color"],                   // P: Color
    params["Model"],                   // Q: Model
    params["Memory"],                  // R: Memory
    params["Chief Complaint"],         // S: Chief Complaint
    params["Dents"],                   // T: Dents
    params["Scratches"],               // U: Scratches
    params["Missing Parts"],           // V: Missing Parts
    params["Physical Damage"],         // W: Physical Damage
    params["Important Files"],         // X: Important Files
    params["No Power"],                // Y: No Power
    params["Repair History"],          // Z: Repair History
    "",                                // AA: Service (empty initially)
    params["Time Frame"],              // AB: Time Frame
    "",                                // AC: Target Date
    params["Estimated Cost"],          // AD: Estimated Cost
    "",                                // AE: Technician Diagnosis
    "",                                // AF: Final Cost
    "",                                // AG: Suggested Repair
    params["Acknowledgement 1"],       // AH: Acknowledgement 1
    params["Acknowledgement 2"],       // AI: Acknowledgement 2
    params["Acknowledgement 3"],       // AJ: Acknowledgement 3
    signatureUrl,                      // AK: Physical Signature URL
    "",                                // AL: Admin Notes
    "",                                // AM: Admin Notes Internal
    params["Technician Department"],   // AN: Technician Department
    "",                                // AO: Tech Notes Customer
    pdfUrl,                            // AP: PDF URL
    serviceFolderId ? "https://drive.google.com/drive/folders/" + serviceFolderId : "",  // AQ: Folder Link
    params["Has Password"],            // AR: Has Password (Yes/No)
    params["Device Password"],         // AS: Device Password
    "",                                // AT: Actual Cost
    "",                                // AU: Parts Used
    deviceReportFolderUrl,             // AV: Device Report Folder URL
    annotationImageUrl,                // AW: Device Annotation Image URL
    params["AnnotationNotes"]         // AX: Device Annotation Notes
  ];
  
  sheet.appendRow(row);
  
  return ContentService.createTextOutput(JSON.stringify({
    "result": "success"
  })).setMimeType(ContentService.MimeType.JSON);
}
// =============================================================================
// ONE-TIME FIXER: Run this function ONCE to correct existing notification timestamps
// Go to Apps Script Editor → Select "fixNotificationTimestamps" → Click Run
// =============================================================================
function fixNotificationTimestamps() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Notifications");
  if (!sheet) {
    Logger.log("Notifications sheet not found");
    return;
  }
  
  var data = sheet.getDataRange().getValues();
  var fixedCount = 0;
  
  for (var i = 1; i < data.length; i++) {
    var createdAt = data[i][6];
    if (!createdAt) continue;
    var dateStr = String(createdAt);
    if (dateStr.indexOf('T') > -1 && dateStr.indexOf('Z') > -1) {
      try {
        var wrongDate = new Date(dateStr);
        var correctedDate = new Date(wrongDate.getTime() - (8 * 60 * 60 * 1000));
        var correctedIso = correctedDate.toISOString();
        sheet.getRange(i + 1, 7).setValue(correctedIso);
        fixedCount++;
        Logger.log("Row " + (i + 1) + ": " + dateStr + " → " + correctedIso);
      } catch (e) {
        Logger.log("Error fixing row " + (i + 1) + ": " + e.toString());
      }
    }
  }
  
  Logger.log("Fixed " + fixedCount + " notification timestamps");
  SpreadsheetApp.getUi().alert("Fixed " + fixedCount + " notification timestamps.");
}

*/
