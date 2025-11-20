// Google Sheets Integration
// To set this up:
// 1. Create a Google Apps Script in your Google Sheet
// 2. Deploy it as a web app
// 3. Replace YOUR_SCRIPT_ID with your actual script ID

export const GOOGLE_SHEETS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby3fTTcFoMpwyqF90CBgdu-5xjSZwSjscd-kKD2qPVorh5Pqrxle28vBha59qt9g9c0pA/exec";

/**
 * Google Sheets Integration - Required Setup:
 *
 * The Google Apps Script must handle these actions in doGet/doPost:
 *
 * STAFF MANAGEMENT (Users Sheet):
 * Users sheet columns: Staff ID | Username | Password | Name | Role | Department | Status
 * - getStaffList: Returns all users from Users sheet with staffId field
 * - addStaff: Adds new user (staffId, username, password, name, role, department, status)
 * - updateStaff: Updates user by username (includes staffId)
 * - removeStaff: Removes user by username
 *
 * SERVICE MANAGEMENT:
 * - searchService: Finds service by ID and device type
 * - updateService: Updates service details
 * - updateTechnicianService: Updates service from technician portal
 * - getAllServices: Returns ALL services (for Service Tracker with filtering)
 * - getAllOngoingServices: Returns only non-completed services
 *
 * ACTIVITY LOGS:
 * - getServiceLogs: Gets activity logs for a service
 * - logActivity: Logs service updates
 *
 * INVENTORY:
 * - getInventory: Returns available inventory items
 */

// IMPORTANT GOOGLE SHEETS SETUP:
//
// 1. Create a new sheet named "Activity Logs" with these columns:
//    A: Log ID | B: Service ID | C: Username | D: Role | E: Timestamp | F: Activity
//
// 2. Create a new sheet named "Inventory" with these columns:
//    A: Item ID | B: Item Name | C: Cost | D: Quantity
//
// 3. Update "Staff Management" sheet to include:
//    A: Staff ID | B: Name | C: Role | D: Status | E: Department (for technicians)
//
// 4. Add these columns to "Service Database" sheet:
//    Column AN (40): Technician Department
//    Column AK (37): Physical Signature URL (Google Drive link to signature image) - uploaded by Apps Script
//    Column AQ (43): Google Drive Folder URL - created by Apps Script
//    Column AR (44): Has Password (Yes/No)
//    Column AS (45): Device Password
//    Column AT (46): Actual Cost (for Transaction Tracker profit calculations)
//    Column AU (47): Parts Used
//
// 5. Update your Google Apps Script doPost handler to:
//    - Accept 'Signature', 'Signature_Base64', 'Signature_MimeType', 'Signature_FileName' parameters
//    - Create a folder in Google Drive for each service (serviceId_clientName_deviceType)
//    - Upload the signature image to the folder
//    - Save the signature image URL to Column AK (37)
//    - Save the folder URL to Column AQ (43)
//
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
            "pdfUrl": data[i][41],
            "hasPassword": data[i][43],
            "devicePassword": data[i][44],
            "technicianDepartment": data[i][39],
            "deviceReportFolderUrl": data[i][47]
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
    // Columns: Part ID, Part Name, Device Type, Brand, Model, Quantity, Date Ordered, Supplier, Cost/Unit, Status, Last Updated, Remarks
    for (var i = 1; i < data.length; i++) {
      var status = data[i][9]; // Status column
      var quantity = parseInt(data[i][5] || 0);
      
      // Only include items that are in stock
      if (status !== "Out of Stock" && quantity > 0) {
        inventory.push({
          "id": data[i][0],
          "name": data[i][1],
          "cost": parseFloat(data[i][8]) || 0,
          "quantity": quantity
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
          "department": data[i][44] || "N/A", // Column AS (Technician Department)
          "deviceType": data[i][12],
          "clientName": data[i][8],
          "service": data[i][26],
          "quotedPrice": parseFloat(data[i][29]) || 0,
          "actualCost": parseFloat(data[i][45]) || 0 // Column AT (Actual Cost)
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
        if (params.actualCost) sheet.getRange(i + 1, 46).setValue(params.actualCost); // Column AT
        if (params.partsUsed) sheet.getRange(i + 1, 47).setValue(params.partsUsed); // Column AU
        
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

  // Handle DEVICE REPORT folder and optional photos
  var deviceReportFolderUrl = "";
  try {
    if (targetFolder) {
      // Reuse existing Device Report subfolder if it exists, otherwise create it
      var deviceReportFolder = null;
      var existingDeviceReportFolders = targetFolder.getFoldersByName("Device Report");
      if (existingDeviceReportFolders.hasNext()) {
        deviceReportFolder = existingDeviceReportFolders.next();
      } else {
        deviceReportFolder = targetFolder.createFolder("Device Report");
      }

      deviceReportFolderUrl = "https://drive.google.com/drive/folders/" + deviceReportFolder.getId();

      // Upload photos if any were sent with the request
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
    Logger.log("Error handling device report folder/photos: " + error);
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
    deviceReportFolderUrl              // AV: Device Report Folder URL
  ];
  
  sheet.appendRow(row);
  
  return ContentService.createTextOutput(JSON.stringify({
    "result": "success"
  })).setMimeType(ContentService.MimeType.JSON);
}

*/
