// Step-by-step "How to use" guides shown by <PageGuide /> on the Inventory and Company Repairs pages.
// Wrap button, tab and field names in **double asterisks** so they stand out. Keep the wording in
// step with the screens: if a button is renamed, rename it here too.

export interface GuideSection {
  id: string;
  title: string;
  /** Who the section is for, e.g. "inventory staff and management". Leave out when it's everyone. */
  who?: string;
  intro?: string;
  /** Bullet points (no order). */
  points?: string[];
  /** Numbered steps (in order). */
  steps?: string[];
  tips?: string[];
}

export interface PageGuideContent {
  title: string;
  intro: string;
  sections: GuideSection[];
}

export const INVENTORY_GUIDE: PageGuideContent = {
  title: "How to use Inventory",
  intro: "Every part, its stock count and every stock change in one place. Open a topic below.",
  sections: [
    {
      id: "tabs",
      title: "What's on this page",
      points: [
        "**Overview**: what's running low, reorder suggestions, tickets waiting for parts, most-used parts and the latest stock movements.",
        "**Inventory Items**: the full parts list with quantity, re-order level and status.",
        "**Requests**: part requests sent by technicians from **Request for Parts**.",
        "**Movements**: every stock change and where each part went: the ticket, client, device and technician. Changes that need approval wait here.",
        "**Pre-Ordered Parts**: parts ordered for specific tickets, from order to arrival.",
        "**Inventory Logs**: the history of added parts, edits, stock in and out, and parts used on tickets.",
      ],
      tips: ["Technicians and admins can look parts up on **Check Parts** in the menu. It's view-only."],
    },
    {
      id: "status",
      title: "What the stock status means",
      points: [
        "**Out of Stock**: the quantity is 0.",
        "**Low Stock**: the quantity is at or below the part's **Re-order** level.",
        "**In Stock**: the quantity is above the re-order level.",
        "**On Order**: you placed an order. It stays On Order until you click **Receive**.",
      ],
      tips: [
        "The status updates by itself whenever the quantity changes. You never set it by hand.",
        "A re-order level of 0 (shown as —) means no early warning: the part only shows up once it's out of stock.",
      ],
    },
    {
      id: "find",
      title: "Find a part",
      steps: [
        "Open **Inventory Items** and type in the search box. SKU, name, brand, model, colour and type all work.",
        "Narrow the list with the device type, model and status filters.",
        "Click a part to open its details (supplier, cost, remarks) and recent activity. Click it again to close.",
        "For a part's QR label, open its **⋯** menu and choose **QR code**.",
      ],
      tips: [
        "Click **Part**, **SKU**, **Stock** or **Updated** at the top of the list to sort by it.",
        "**CSV** downloads the list exactly as it's filtered on screen.",
      ],
    },
    {
      id: "tickets",
      title: "Record parts used on a ticket",
      who: "technicians and staff",
      steps: [
        "Open the ticket: technicians use **Service Update** (Parts Used from Inventory), admin and management can use the **Parts Used** panel in **Manage Client**.",
        "Search the part by SKU or name, add it, and set how many you used.",
        "Save (**Update** in Service Update, **Save parts** in the Parts Used panel). The stock goes down by itself.",
        "If inventory shows fewer than you're taking, you'll see **Not enough in stock**. Check the shelf first. **Save anyway** brings that part to 0, so recount it afterwards.",
      ],
      tips: [
        "Taking a part off a ticket puts it back in stock.",
        "Only parts added since the last save count toward the warning, so re-saving a ticket never deducts twice.",
        "Stock changes made by technicians wait in **Movements** for inventory staff to approve.",
      ],
    },
    {
      id: "assign",
      title: "Assign parts to a ticket from Inventory",
      who: "inventory staff and management",
      steps: [
        "Click **Assign to Ticket** (beside Add New Part), or open a part's **⋯** menu and choose **Assign to ticket**.",
        "Type the ticket number or the client's name and pick the ticket. With an empty search you'll see the latest open tickets.",
        "Add the parts and how many were used, then click **Save parts**. Stock goes down and the ticket's Parts Used updates, the same as recording them on the ticket.",
      ],
      tips: [
        "Use this when a technician takes a part from you, so the count stays right even if they forget to record it.",
        "The **Not enough in stock** warning works here too.",
        "Each part you assign shows in **Movements** as **Used on ticket**.",
      ],
    },
    {
      id: "movements",
      title: "See where parts went (Movements)",
      intro: "Every stock change is listed here, newest first, with the ticket it went to.",
      steps: [
        "Open **Movements**. Each row shows the part, the change (for example **-1**, with the count before → after) and where it went.",
        "**Used on ticket** rows show the ticket number, client, device and technician. Click the ticket number to open the ticket.",
        "Click a card at the top to switch the list: **All movements**, **Used on tickets**, **Stock in**, **Stock out** (parts that left without a ticket, like returns and recounts) or **Pending**.",
        "Search by part, SKU, ticket number, client, technician or staff name. Click a part's name to see only that part's history.",
        "Pick a start and end date to look at a period. Without dates the list shows the latest 1,000 changes.",
      ],
      tips: [
        "Parts recorded on a ticket (Service Update, the Parts Used panel or **Assign to Ticket**) are linked to that ticket by themselves.",
        "Rows by **Google Sheet** are the stock in and stock out history copied from the old Google Sheet. The sheet only had dates, so they show **from sheet** instead of a time.",
        "**Returned from ticket** means a part was taken off a ticket and went back into stock.",
        "**CSV** downloads the list as it's filtered, with the client, device and technician for each ticket.",
      ],
    },
    {
      id: "add",
      title: "Add a new part",
      who: "inventory staff and management",
      steps: [
        "Click **Add New Part** for one part, or **Batch Add Parts** for several parts of the same device model.",
        "Fill in the name, device type, brand, model, part type and colour.",
        "Choose **In stock now** and enter the quantity, or **On Order** if it hasn't arrived yet.",
        "Set a **Re-order Level** so the part turns Low Stock before it runs out, then save.",
      ],
      tips: [
        "Parts added here get an automatic ID (PRT…). To give a new part your own SKU, add it with **Import CSV** instead.",
        "**Duplicate** in a part's **⋯** menu starts a new part with the same details.",
      ],
    },
    {
      id: "adjust",
      title: "Stock in, stock out and recounts",
      who: "inventory staff and management",
      steps: [
        "Click **Adjust** on the part's row.",
        "Pick **Add Stock (Stock In)** for deliveries, **Remove Stock (Stock Out)** for parts that leave without a ticket (defective, returned to supplier), or **Manual Adjustment** to set the exact count after a recount.",
        "Enter the quantity and the reason in **Remarks**, check the **New Quantity** preview, then click **Update Stock**.",
      ],
      tips: [
        "Parts used on tickets are deducted automatically. Don't remove them again here.",
        "Recount Low Stock parts regularly and fix any difference with **Manual Adjustment**.",
      ],
    },
    {
      id: "order",
      title: "Order and receive parts",
      who: "inventory staff and management",
      steps: [
        "Click **Adjust**, choose **Place Order** and enter how many you ordered. The part shows **On Order**; stock doesn't change yet.",
        "When the delivery arrives, click **Receive** on the part's row.",
        "Check the **Quantity received** (filled in with the ordered amount when it's known) and click **Receive**. Those units are added to stock and the status updates.",
      ],
    },
    {
      id: "requests",
      title: "Part requests and approvals",
      who: "inventory staff and management",
      steps: [
        "New technician requests appear in **Requests** with a **New** badge. Click **Receive request** so the technician knows you've seen it.",
        "Move each request along with its status menu: For Ordering, Ordering, Ordered, Received, Released to technician (or Cancelled).",
        "In **Movements**, click the **Pending** card (or the yellow banner) to see stock changes waiting for approval, then approve ✓ or reject ✗ each one. Tick several to review them together.",
      ],
      tips: [
        "Changes by inventory staff and management are approved automatically.",
        "Rejecting needs a reason. It undoes the stock change and tells the person why.",
      ],
    },
    {
      id: "import",
      title: "Update many parts at once (Import CSV)",
      who: "inventory staff and management",
      steps: [
        "Get a CSV: click **CSV** on Inventory Items to download the current list.",
        "Edit it in Google Sheets or Excel. Keep the **Part ID** column: that's how rows are matched to parts. Add new rows for new parts with your own SKU.",
        "Click **Import CSV** and choose **Update details only** (names, prices, re-order levels; stock stays the same) or **Stock count** (also sets each quantity to the number in the file).",
        "Choose the file and read the preview: new parts, what will change, and any rows with errors. Nothing is saved yet.",
        "Click the **Import** button (it shows how many changes) to save. Rows with errors are skipped, so fix them in the file and upload it again.",
      ],
      tips: [
        "Import never deletes parts, and blank cells never erase what's already saved.",
        "Use **Stock count** right after a full physical count.",
        "Downloading a Google Sheet tab with File → Download → Comma-separated values (.csv) also works.",
      ],
    },
  ],
};

export const CHECK_PARTS_GUIDE: PageGuideContent = {
  title: "How to use Check Parts",
  intro: "Look up any part to see if it's in stock. This page is view-only; inventory staff make changes in Inventory Management.",
  sections: [
    {
      id: "search",
      title: "Find a part",
      steps: [
        "Type in the search box: SKU, part name, model or brand all work. A few words are enough, e.g. \"battery 13 pro\".",
        "Narrow it with the device type and stock filters (**In stock (1+)**, **Low stock**, **Out of stock**).",
        "Click a part to see more details, like the supplier and remarks.",
      ],
      tips: ["Click **Part**, **SKU**, **Stock** or **Updated** at the top of the list to sort by it."],
    },
    {
      id: "status",
      title: "What the stock status means",
      points: [
        "**In Stock**: there's enough on the shelf.",
        "**Low Stock**: only a few left. Tell inventory staff if you'll need more soon.",
        "**Out of Stock**: none left. Use **Request a part** to ask for it.",
        "**On Order**: it's been ordered and hasn't arrived yet.",
      ],
    },
    {
      id: "use",
      title: "Using a part on a ticket",
      steps: [
        "Record it on the ticket in **Service Update** under **Parts Used from Inventory**, then click **Update**.",
        "The stock goes down by itself, and inventory staff approve the change.",
      ],
    },
  ],
};

export const COMPANY_GUIDE: PageGuideContent = {
  title: "How to use Company Repairs",
  intro:
    "For companies that send several devices at once. Each device is still its own ticket and follows the normal repair flow.",
  sections: [
    {
      id: "overview",
      title: "What's on these pages",
      points: [
        "**All companies**: one card per company with how many devices are at each stage and how many are waiting for a quotation.",
        "**Stage cards**: Pending diagnosis, Pending approval, In repair, Pending payment and Completed. Inside a company, tap one to show only those devices; tap it again to clear.",
        "**Company page**: contact details, the client link, every device grouped by batch, and the quotations made for that company.",
      ],
    },
    {
      id: "company",
      title: "Add a company",
      who: "admin and management",
      steps: [
        "Click **New company**.",
        "Enter the company name (required), contact person, contact number, email, TIN and billing address.",
        "Turn on **Show VAT on quotations** if this client needs VAT shown.",
        "Click **Save**. Use **Edit** on the company page to change details later.",
      ],
    },
    {
      id: "intake",
      title: "Intake devices",
      who: "admin and management",
      steps: [
        "Open the company and click **Intake devices**.",
        "Pick the **Admin Rep**, **Receiving Staff**, **Batch** (or **+ New batch**, e.g. the delivery date), priority and diagnostic time frame. Set a **Default Location / Site** if the devices came from one site.",
        "For each device, choose the **Device Type** and fill in serial, brand, model, colour, storage, location and the **Chief Complaint**. **Duplicate** copies a device to save typing.",
        "Leave **Technician** on **Auto** to give the device to a timed-in technician of its department (the same rule as normal intake), or pick someone.",
        "Tick **Needs individual quote** for a device that should get its own quotation.",
        "Click **Create ticket(s)**. Each device becomes its own ticket.",
      ],
      tips: [
        "Have the company's list in a spreadsheet? Open **Paste from the company sheet**, paste the rows (Location, Serial, Model, Reported Issue), pick a device type and click **Add rows**.",
        "Client name, contact and address come from the company, so you don't type them for every device.",
      ],
    },
    {
      id: "work",
      title: "Find and work on devices",
      steps: [
        "Use **All**, **Ongoing** and **Completed**, the search box (serial, model, ticket, issue) and the batch and location filters to find devices.",
        "Tap a device to open its ticket: **Manage Client** for admin and management, **Service Update** for technicians.",
        "Diagnose, update the status and record parts as usual. The company page follows along by itself.",
      ],
      tips: [
        "**Quote: RFQ** on a device means it still needs a quotation.",
        "Technicians can open tickets from here but can't add companies, intake devices or make quotations.",
      ],
    },
    {
      id: "quote",
      title: "Make a quotation or billing statement",
      who: "admin and management",
      steps: [
        "Tick the devices to include. The box beside a batch name selects the whole batch.",
        "Click **Generate quotation**.",
        "Choose **One document for all** or **One document per device**, then check each line: part(s), issue, solution, cost, quantity and warranty.",
        "Add notes, the estimated time frame and overall warranty. Set a discount (one document for all only) and **Show VAT 12%** if needed.",
        "Click **Generate & download**. The PDF downloads, it's listed under **Quotations**, and those devices change to **Quote: Quotation Sent**.",
      ],
      tips: [
        "When the company replies, select the devices and use **Set quotation status** to mark them **Approved** or **Declined**.",
        "**Move to batch** moves the selected devices to another batch.",
        "Preview or download any past quotation from the **Quotations** list.",
      ],
    },
    {
      id: "link",
      title: "Share progress with the company",
      who: "admin and management",
      steps: [
        "On the company page, click **Copy** next to **Client link** and send it to your contact.",
        "With the link they can see every device's status by batch and view their quotations and billing statements. They can't change anything.",
        "If the link reached the wrong person, click the refresh icon beside it to make a new one. The old link stops working.",
      ],
    },
  ],
};
