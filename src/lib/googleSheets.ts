// Google Sheets Integration
// To set this up:
// 1. Create a Google Apps Script in your Google Sheet
// 2. Deploy it as a web app
// 3. Replace YOUR_SCRIPT_ID with your actual script ID

export const GOOGLE_SHEETS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby3fTTcFoMpwyqF90CBgdu-5xjSZwSjscd-kKD2qPVorh5Pqrxle28vBha59qt9g9c0pA/exec";

// Complete Google Apps Script code for your Google Sheet:
/*
function doGet(e) {
  var params = e.parameter;
  
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
            "serviceCost": data[i][29],
            "status": data[i][1] || "PENDING - APPROVAL",
            "technician": data[i][3],
            "techNotes": data[i][39],
            "adminNotes": data[i][37],
            "adminNotesInternal": data[i][38],
            "chiefComplaint": data[i][18],
            "technicianDiagnosis": data[i][30],
            "suggestedRepair": data[i][32],
            "technicianNotesCustomer": data[i][39],
            "technicianNotesInternal": data[i][40],
            "finalCost": data[i][31],
            "clientType": data[i][7],
            "priority": data[i][6],
            "dents": data[i][19],
            "scratches": data[i][20],
            "missingParts": data[i][21],
            "physicalDamage": data[i][22],
            "importantFiles": data[i][23],
            "noPower": data[i][24],
            "repairHistory": data[i][25],
            "pdfUrl": data[i][41]
          }
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "not_found"
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
              "pdfUrl": serviceData[j][41] // Column AP (42nd column, index 41)
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
    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) { // If Staff ID exists
        staffList.push({
          "staffId": data[i][0],
          "name": data[i][1],
          "role": data[i][2],
          "status": data[i][3]
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
        "service": data[i][26],
        "deviceType": data[i][12],
        "brand": data[i][14],
        "device": data[i][16],
        "targetDate": data[i][28],
        "status": data[i][1],
        "clientName": data[i][8]
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "services": services
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle request for inventory (inventory management)
  if (params.action === 'getInventory') {
    var inventorySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory Management");
    var data = inventorySheet.getDataRange().getDisplayValues();
    var inventory = [];
    
    // Loop through all rows (skip header row)
    // Columns: Part ID, Part Name, Device Type, Brand, Model, Quantity, Date Ordered, Supplier, Cost/Unit, Status, Last Updated, Remarks
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
        "remarks": data[i][11]
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
    // Columns: Log ID, Part ID, Part Name, Device Type, Transaction Type, Quantity Changed, Previous Quantity, New Quantity, Date & Time, Remarks/Notes
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
        "remarks": data[i][9]
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "logs": logs
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    "error": "Invalid request"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var params = e.parameter;
  
  // Handle update requests for Manage Client
  if (params.action === 'updateService' && params.serviceId) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Service Database");
    var data = sheet.getDataRange().getValues();
    
    // Search for the service ID in column A (index 0)
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == params.serviceId) {
        // Update the specified columns
        if (params.status) sheet.getRange(i + 1, 2).setValue(params.status);
        if (params.technician) sheet.getRange(i + 1, 4).setValue(params.technician);
        if (params.priority) sheet.getRange(i + 1, 7).setValue(params.priority);
        if (params.clientType) sheet.getRange(i + 1, 8).setValue(params.clientType);
        if (params.services) sheet.getRange(i + 1, 27).setValue(params.services);
        if (params.timeFrame) sheet.getRange(i + 1, 28).setValue(params.timeFrame);
        if (params.targetDate) sheet.getRange(i + 1, 29).setValue(params.targetDate);
        if (params.finalCost) sheet.getRange(i + 1, 30).setValue(params.finalCost);
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
  
  // Handle update requests for Technician Portal
  if (params.action === 'updateTechnicianService' && params.serviceId) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Service Database");
    var data = sheet.getDataRange().getValues();
    
    // Search for the service ID in column A (index 0)
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == params.serviceId) {
        if (params.status) sheet.getRange(i + 1, 2).setValue(params.status);
        if (params.technicianDiagnosis) sheet.getRange(i + 1, 31).setValue(params.technicianDiagnosis);
        if (params.suggestedRepair) sheet.getRange(i + 1, 33).setValue(params.suggestedRepair);
        if (params.technicianNotesCustomer) sheet.getRange(i + 1, 40).setValue(params.technicianNotesCustomer);
        if (params.technicianNotesInternal) sheet.getRange(i + 1, 41).setValue(params.technicianNotesInternal);
        
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
    var partId = "PART" + Date.now();
    var logId = "LOG" + Date.now();
    
    // Add to Inventory Management sheet
    // Columns: Part ID, Part Name, Device Type, Brand, Model, Quantity, Date Ordered, Supplier, Cost/Unit, Status, Last Updated, Remarks
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
      params.remarks
    ]);
    
    // Log the initial stock to Inventory Log
    // Columns: Log ID, Part ID, Part Name, Device Type, Transaction Type, Quantity Changed, Previous Quantity, New Quantity, Date & Time, Remarks/Notes
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
      params.remarks
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      "result": "success"
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
        // Columns: Log ID, Part ID, Part Name, Device Type, Transaction Type, Quantity Changed, Previous Quantity, New Quantity, Date & Time, Remarks/Notes
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
          params.remarks
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
          "Ordered: " + orderedQty + " units | Current Stock: " + currentQty + " units"
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
          "Received: " + orderedQty + " units | Current Stock: " + newQty + " units"
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
    var timestamp = new Date().getTime();
    var staffId = "STAFF" + timestamp;
    var row = [staffId, params.name, params.role, params.status];
    staffSheet.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "staffId": staffId
    })).setMimeType(ContentService.MimeType.JSON);
  }

  if (params.action === 'removeStaff' && params.staffId) {
    var staffSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Staff Management");
    if (!staffSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "Staff Management sheet not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    var data = staffSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == params.staffId) {
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

    if (pdfBlob) {
      var folder = DriveApp.getFolderById("1HODvuMnTrrGXSVByZEdDDH8ctxk7bpUj");
      var file = folder.createFile(pdfBlob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      pdfUrl = file.getUrl();
    }
  } catch (error) {
    Logger.log("Error uploading PDF: " + error);
  }
  
  // Map the form data to the correct columns
  var row = [
    params["Service ID"],
    "Pending Diagnosis",
    params["Admin Representative"],
    params["Technician"],
    params["Timestamp"],
    clientId,
    params["Priority"],
    params["Client Type"],
    params["Client Name"],
    params["Username"],
    params["Email"],
    params["Phone"],
    params["Device Type"],
    params["Serial"],
    params["Brand"],
    params["Color"],
    params["Model"],
    params["Memory"],
    params["Chief Complaint"],
    params["Dents"],
    params["Scratches"],
    params["Missing Parts"],
    params["Physical Damage"],
    params["Important Files"],
    params["No Power"],
    params["Repair History"],
    "",
    params["Time Frame"],
    "",
    params["Estimated Cost"],
    "",
    "",
    "",
    params["Acknowledgement 1"],
    params["Acknowledgement 2"],
    params["Acknowledgement 3"],
    "",
    "",
    "",
    "",
    "",
    pdfUrl,
  ];
  
  sheet.appendRow(row);
  
  return ContentService.createTextOutput(JSON.stringify({
    "result": "success"
  })).setMimeType(ContentService.MimeType.JSON);
}

*/
