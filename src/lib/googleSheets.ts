// Google Sheets Integration
// To set this up:
// 1. Create a Google Apps Script in your Google Sheet
// 2. Deploy it as a web app
// 3. Replace YOUR_SCRIPT_ID with your actual script ID

export const GOOGLE_SHEETS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby3fTTcFoMpwyqF90CBgdu-5xjSZwSjscd-kKD2qPVorh5Pqrxle28vBha59qt9g9c0pA/exec";

// Sample Google Apps Script code for your Google Sheet:
/*
function doGet(e) {
  var params = e.parameter;
  
  // Handle search requests
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
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Service Database");
  var params = e.parameter;
  
  // Map the form data to the correct columns
  var row = [
    params["Service ID"], // Column A
    "", // Column B
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
    "", // Column AJ
    params["Acknowledgement 3"] // Column AK
  ];
  
  sheet.appendRow(row);
  
  return ContentService.createTextOutput(JSON.stringify({
    "result": "success"
  })).setMimeType(ContentService.MimeType.JSON);
}
*/
