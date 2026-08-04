import jspdfmod from "jspdf";
const jsPDF: any = (jspdfmod as any).jsPDF || jspdfmod;
import fs from "fs";
import { drawQuotation } from "/dev-server/src/lib/quotationPdfGenerator";

const logo = "data:image/png;base64," + fs.readFileSync("/dev-server/public/ac-tech-logo-pdf.png").toString("base64");

const diagnosis = `Findings:
The unit is stuck on the charging indicator even when unplugged. Corrosion was found on the charging port.
Cause of Issue:
The charging port has corrosion, which is causing the unit to incorrectly display the charging indicator. The logic board component CD32 may also be affected.
Suggested Solution:
Replacement of the charging port and the CD32 component on the logic board.
Recommendations:
To prevent future corrosion, avoid exposing the device to moisture or humid environments. Ensure the charging port is clean and dry before plugging in the charger.
IMPORTANT NOTE:
- During our inspection, we found that the charging port has broken pins, which caused damage not only to the charging port itself but also affected the logic board. Because of this, the unit will require logic board repair in addition to the hardware replacements listed above.
- Logic board repairs are complex and require detailed diagnosis.
- Repair timelines may vary depending on the severity and extent of the damage, and the estimated timeframe may change as the repair progresses.
- Additional components, such as the LCD/display, battery, keyboard, trackpad, and other peripherals, can only be fully tested once the device powers on successfully.
- If additional damaged components are discovered during or after the logic board repair, we will notify you first and obtain your approval before proceeding. Any additional repairs or replacement parts will incur separate charges.
- We will continue to provide updates throughout the repair process and will only proceed with any additional work upon your approval.
- To proceed with the service, PROCEED or APPROVE to confirm your approval and kindly review our Terms and Conditions: bit.ly/actech-termsnconditions
SUMMARY:
Charging port and logic board component replacement needed due to corrosion causing a stuck charging indicator.`;

const data = {
  serviceId: "AC040826015",
  timestamp: "2026-08-04T14:07:23.111742+00:00",
  adminRep: "Rachel Bumanglag",
  technician: "Ezekiel Pascual",
  receivingStaff: "Rachel Bumanglag",
  clientType: "New Client - Walk In",
  priority: "Normal",
  clientName: "Sample Client Name",
  username: "sample.client",
  phone: "0917 000 0000",
  email: "sample@email.com",
  deviceType: "Mobile (iPhone)",
  serial: "N/A",
  brand: "Apple",
  color: "Silver",
  model: "Iphone 17 Pro Max",
  memory: "1 TB",
  technicianDiagnosis: diagnosis,
  serviceSummary: "Charging port and logic board component replacement needed due to corrosion causing a stuck charging indicator.",
  serviceCost: "20000",
  partsUsed: "",
  discount: "0",
  totalCost: "20000.00",
};

const doc = new jsPDF({ format: "letter", unit: "mm" });
drawQuotation(doc, data as any, logo);
fs.writeFileSync("/mnt/documents/service-quotation-premium-preview_v8.pdf", Buffer.from(doc.output("arraybuffer")));
console.log("ok pages", (doc as any).getNumberOfPages());
