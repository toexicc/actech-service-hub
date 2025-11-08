// Google Sheets Integration
// To set this up:
// 1. Create a Google Apps Script in your Google Sheet
// 2. Deploy it as a web app
// 3. Replace YOUR_SCRIPT_ID with your actual script ID

export const GOOGLE_SHEETS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby3fTTcFoMpwyqF90CBgdu-5xjSZwSjscd-kKD2qPVorh5Pqrxle28vBha59qt9g9c0pA/exec";

// Sample Google Apps Script code for your Google Sheet:
/*
function doGet(e) {
  var params = e.parameter;
  
  // Handle search requests for Service Database (tracking page)
  if (params.action === 'searchService' && params.serviceId) {
    var serviceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Service Database");
    var data = serviceSheet.getDataRange().getValues();
    
    // Search for the service ID in column A (index 0)
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == params.serviceId) {
        return ContentService.createTextOutput(JSON.stringify({
          "status": "found",
          "data": {
            "adminRep": data[i][2],          // Column C - Admin Representative
            "clientName": data[i][8],        // Column I - Client Name
            "username": data[i][9],          // Column J - Username
            "email": data[i][10],            // Column K - Email
            "phone": data[i][11],            // Column L - Phone
            "device": data[i][16],           // Column Q - Model
            "deviceType": data[i][12],       // Column M - Device Type
            "serialNumber": data[i][13],     // Column N - Serial
            "brand": data[i][14],            // Column O - Brand
            "colorMemory": data[i][15] + " | " + data[i][17], // Column P (Color) | R (Memory)
            "timestamp": data[i][4],         // Column E - Service Date
            "timeFrame": data[i][27],        // Column AB - Time Frame
            "service": data[i][26],          // Column AA - Service/s
            "serviceCost": data[i][29],      // Column AD - Estimated Cost
            "status": data[i][1] || "PENDING - APPROVAL",  // Column B - Status
            "technician": data[i][3],        // Column D - Technician
            "techNotes": data[i][39],        // Column AN - Technician Notes
            "adminNotes": data[i][37],       // Column AL - Admin Notes
            "adminNotesInternal": data[i][38], // Column AM - Admin Notes (Internal)
            "chiefComplaint": data[i][18],   // Column S - Chief Complaint
            "technicianDiagnosis": data[i][30], // Column AE - Technician Diagnosis
            "suggestedRepair": data[i][32],  // Column AG - Suggested Repair
            "technicianNotesCustomer": data[i][39], // Column AN - Technician Notes (Customer)
            "technicianNotesInternal": data[i][40], // Column AO - Technician Notes (Internal)
            "finalCost": data[i][31],        // Column AF - Final Cost
            "clientType": data[i][7],        // Column H - Client Type
            "priority": data[i][6],          // Column G - Priority
            "dents": data[i][19],            // Column T - Dents
            "scratches": data[i][20],        // Column U - Scratches
            "missingParts": data[i][21],     // Column V - Missing Parts
            "physicalDamage": data[i][22],   // Column W - Physical Damage
            "importantFiles": data[i][23],   // Column X - Important Files
            "noPower": data[i][24],          // Column Y - No Power
            "repairHistory": data[i][25],    // Column Z - Repair History
            "pdfUrl": data[i][41]            // Column AP - PDF Link
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
            "name": data[i][4],            // Column E - Client Name
            "contactNumber": data[i][6],   // Column G - Phone
            "device": data[i][8],          // Column I - Model
            "initialDiagnosis": data[i][9], // Column J - Chief Complaint
            "estimatedCost": data[i][10]   // Column K - Estimated Cost
          }
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "found": false
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
        if (params.status) sheet.getRange(i + 1, 2).setValue(params.status); // Column B - Status
        if (params.technician) sheet.getRange(i + 1, 4).setValue(params.technician); // Column D - Technician
        if (params.priority) sheet.getRange(i + 1, 7).setValue(params.priority); // Column G - Priority
        if (params.clientType) sheet.getRange(i + 1, 8).setValue(params.clientType); // Column H - Client Type
        if (params.services) sheet.getRange(i + 1, 27).setValue(params.services); // Column AA - Service/s
        if (params.timeFrame) sheet.getRange(i + 1, 28).setValue(params.timeFrame); // Column AB - Time Frame
        if (params.finalCost) sheet.getRange(i + 1, 30).setValue(params.finalCost); // Column AD - Service Cost
        if (params.adminNotes) sheet.getRange(i + 1, 38).setValue(params.adminNotes); // Column AL - Admin Notes
        if (params.adminNotesInternal) sheet.getRange(i + 1, 39).setValue(params.adminNotesInternal); // Column AM - Admin Notes (Internal)
        if (params.technicianNotesInternal) sheet.getRange(i + 1, 41).setValue(params.technicianNotesInternal); // Column AO - Technician Notes (Internal)
        
        // Upload NEW PDF if provided and update Column AP with its link
        try {
          var pdfBlob = null;
          // Prefer multipart file upload
          if (e && e.files && e.files.PDF) {
            pdfBlob = e.files.PDF;
          } else if (params["PDF_Base64"]) {
            // Fallback: base64 fields
            var bytes = Utilities.base64Decode(params["PDF_Base64"]);
            var mimeType = params["PDF_MimeType"] || "application/pdf";
            var fallbackName = "ServiceReport.pdf";
            var base64FileName = params["PDF_FileName"] || fallbackName;
            pdfBlob = Utilities.newBlob(bytes, mimeType, base64FileName);
          }

          if (pdfBlob) {
            // Build updated, timestamped filename
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

            // Upload to Drive and set sharing
            var folder = DriveApp.getFolderById("1HODvuMnTrrGXSVByZEdDDH8ctxk7bpUj");
            var file = folder.createFile(pdfBlob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

            // Write new link to Column AP (column 42)
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
        // Update the specified columns for technician
        if (params.status) sheet.getRange(i + 1, 2).setValue(params.status); // Column B - Status
        if (params.technicianDiagnosis) sheet.getRange(i + 1, 31).setValue(params.technicianDiagnosis); // Column AE - Technician Diagnosis
        if (params.suggestedRepair) sheet.getRange(i + 1, 33).setValue(params.suggestedRepair); // Column AG - Suggested Repair
        if (params.technicianNotesCustomer) sheet.getRange(i + 1, 40).setValue(params.technicianNotesCustomer); // Column AN - Technician Notes (Customer)
        if (params.technicianNotesInternal) sheet.getRange(i + 1, 41).setValue(params.technicianNotesInternal); // Column AO - Technician Notes (Internal)
        
        return ContentService.createTextOutput(JSON.stringify({
          "result": "success"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "result": "not_found"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle service form submissions
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Service Database");
  
  // Handle PDF file upload if present
  var pdfUrl = "";
  try {
    var sanitize = function(str) { return String(str || '').replace(/[^a-zA-Z0-9]/g, '_'); };
    var baseName = sanitize(params["Serial"]) + "_" + sanitize(params["Client Name"]) + "_" + sanitize(params["Device Type"]);

    var pdfBlob = null;
    if (e && e.files && e.files.PDF) {
      // Preferred: multipart file upload
      pdfBlob = e.files.PDF;
      pdfBlob.setName(baseName + ".pdf");
    } else if (params["PDF_Base64"]) {
      // Fallback: base64 fields
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
    params["Service ID"], // Column A
    "Pending Diagnosis", // Column B
    params["Admin Representative"], // Column C
    params["Technician"], // Column D
    params["Timestamp"], // Column E
    "", // Column F
    params["Priority"], // Column G
    params["Client Type"], // Column H
    params["Client Name"], // Column I
    params["Username"], // Column J
    params["Email"], // Column K
    params["Phone"], // Column L
    params["Device Type"], // Column M
    params["Serial"], // Column N
    params["Brand"], // Column O
    params["Color"], // Column P
    params["Model"], // Column Q
    params["Memory"], // Column R
    params["Chief Complaint"], // Column S
    params["Dents"], // Column T
    params["Scratches"], // Column U
    params["Missing Parts"], // Column V
    params["Physical Damage"], // Column W
    params["Important Files"], // Column X
    params["No Power"], // Column Y
    params["Repair History"], // Column Z
    "", // Column AA
    params["Time Frame"], // Column AB
    "", // Column AC
    params["Estimated Cost"], // Column AD
    "", // Column AE
    "", // Column AF
    "", // Column AG
    params["Acknowledgement 1"], // Column AH
    params["Acknowledgement 2"], // Column AI
    params["Acknowledgement 3"], // Column AJ
    "", // Column AK
    "", // Column AL
    "", // Column AM
    "", // Column AN
    "", // Column AO
    pdfUrl, // Column AP - PDF Link
  ];
  
  sheet.appendRow(row);
  
  return ContentService.createTextOutput(JSON.stringify({
    "result": "success"
  })).setMimeType(ContentService.MimeType.JSON);
}
*/
