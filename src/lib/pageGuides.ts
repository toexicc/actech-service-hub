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
        "**Requests**: parts requested from tickets (Service Update and Manage Client) and parts asked to be taken off them (returns). **Defective** lists defective parts to send back to the supplier.",
        "**Movements**: every stock change and where each part went: the ticket, client, device and technician. Changes that need approval wait here.",
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
      title: "How parts get onto a ticket",
      who: "technicians and staff",
      steps: [
        "Open the ticket: technicians in **Service Update**, admin and management in **Manage Client**, and find **Parts**.",
        "Search the part (or **Scan** its QR label) and check the stock, then click **Request**, set the quantity and **Send request**.",
        "Inventory staff approve it in **Requests**. That takes the stock and adds the part to the ticket's parts used.",
      ],
      tips: [
        "Parts aren't added to a ticket by hand anymore: every part goes through a request, or inventory's **Assign to Ticket**.",
        "Out-of-stock parts can still be requested. They come in as **For Ordering** so inventory orders them.",
        "To take a part off a ticket (not used, wrong entry or defective), click **Return** beside it in the ticket's **Parts** section. Inventory staff or management approve it.",
        "From **Done Repair - Under Observation** onward the ticket's parts are locked: changes still go through a request or return, and someone other than the person who asked approves them.",
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
        "Use this to hand over a part without a request. It only adds parts: to take one off, use **Return** in the ticket's **Parts** section.",
        "Tickets whose parts are locked (Done Repair onward) can't be changed here. Use a request or return on the ticket.",
        "The **Not enough in stock** warning works here too.",
        "Each part you assign shows in **Movements** as **Used on ticket**, and on the ticket's **Activity** with your name.",
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
        "Parts added to a ticket (approved requests and **Assign to Ticket**) are linked to that ticket by themselves.",
        "Rows by **Google Sheet** are the stock in and stock out history copied from the old Google Sheet. The sheet only had dates, so they show **from sheet** instead of a time.",
        "**Returned from ticket** means an approved return took a part off a ticket and put it back into stock. Defective returns don't change stock, so they're on the **Defective** list in **Requests** instead.",
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
      title: "Approve part requests and returns",
      who: "inventory staff and management",
      steps: [
        "New requests and returns show in **Requests** with a **New** badge, plus the ticket, client, device and how many are on hand. Click **Mark as seen** so the requester knows you have it. **Waiting** shows everything not done yet.",
        "In stock: click **Approve & add**, check the part and quantity, then **Approve & add to ticket**. The stock goes down and the part is added to the ticket's parts used.",
        "Not in stock: move the request along with its status menu (For Ordering, Ordering, Ordered). When the part arrives, receive the stock in **Inventory Items**, set the request to **Received**, then approve it.",
        "A request typed in by name has no SKU: when approving, search and pick the inventory part to give. Add it with **Add New Part** first if it's new.",
        "Returns have a **Return** badge with the reason (**Not used**, **Wrong entry** or **Defective**). Click **Approve return**: the part comes off the ticket and its cost comes off the parts cost. Not used and wrong entry go back into stock; defective parts don't, and go on the **Defective** list.",
        "In **Defective**, set where each part is (**Sent to supplier**, **Replaced**, **Credited** or **Disposed**), add a note such as the courier or supplier reference, and click **Save**.",
        "Click **Decline** for a request or return you won't approve. The reason goes to the requester.",
      ],
      tips: [
        "The requester is notified when you approve, decline or change the status.",
        "Approval is blocked when there isn't enough stock, so the count never goes below zero.",
        "**After repair done** marks a request or return made after the ticket's parts were locked. On a locked ticket the person who asked can't approve it: another inventory staff member or management does.",
        "Every request, return, approval and decline is written to the ticket's **Activity** log with who asked and who approved. Click **Parts** there to see only parts entries.",
        "Stock changes made by staff without inventory access wait in **Movements** under **Pending**: approve ✓ or reject ✗ them there. Rejecting needs a reason and undoes the change.",
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

export const PARTS_REQUEST_GUIDE: PageGuideContent = {
  title: "How parts requests work",
  intro: "Parts get onto a ticket through a request and come off through a return. Inventory staff or management approve both, and each step is logged on the ticket with who did it.",
  sections: [
    {
      id: "request",
      title: "Request a part",
      steps: [
        "In the ticket's **Parts** section, search by SKU, part name or model, or tap **Scan** to read a part's QR label.",
        "Each result shows the stock: **In stock**, **Low**, **Out of stock** or **On order**.",
        "Click **Request**, set the quantity, add a note if inventory should know something (e.g. needed today), then **Send request**.",
        "The request shows under **Requests** on the ticket, and in Inventory → **Requests** for inventory staff.",
      ],
      tips: [
        "Requests are sent right away. You don't need to click **Update**.",
        "Not in the list? Click **Can't find it? Request a part that's not in the list** and type the part's name.",
        "If there isn't enough in stock, the request goes in as **Needs ordering** so inventory orders it.",
      ],
    },
    {
      id: "status",
      title: "What the request status means",
      points: [
        "**Waiting for inventory**: it's in stock and waiting for inventory staff to approve it.",
        "**Needs ordering**, **Being ordered**, **Ordered**: there isn't enough in stock yet, and inventory is getting it.",
        "**Arrived, waiting for inventory to release it**: it's in, and inventory approves it next.",
        "**Approved, on this ticket**: it's out of stock and listed under **On this ticket**.",
        "**Cancelled**: you cancelled it, or inventory declined it. The reason is shown.",
        "Returns: **Waiting for approval**, then **Approved, taken off this ticket**.",
      ],
      tips: ["You get a notification when your request is approved, declined or changes status."],
    },
    {
      id: "change",
      title: "Return a part (not used, wrong entry, defective)",
      steps: [
        "Under **On this ticket**, click **Return** beside the part.",
        "Pick why: **Not used** (goes back into stock), **Wrong entry** (recorded by mistake, goes back into stock) or **Defective** (set aside for the supplier; say what's wrong with it).",
        "Set how many and click **Send for approval**. Once inventory staff or management approve it, the part comes off the ticket and its cost comes off the parts cost.",
      ],
      tips: [
        "Changed your mind before it's approved? Click **Cancel request** or **Cancel return** on it.",
        "Parts can't be taken off a ticket any other way, so every removal has a reason and an approver.",
      ],
    },
    {
      id: "locked",
      title: "When parts are locked",
      points: [
        "From **Done Repair - Under Observation** onward (also For Release, Advise Client, Completed, Cancelled and RTO), the ticket's parts are locked.",
        "You can still request or return a part, but someone other than you approves it: inventory staff or management.",
        "Cancelled and RTO tickets can't get new parts. Parts can still be returned.",
        "Requests and returns made while locked show **After repair done** so inventory knows.",
      ],
    },
    {
      id: "approve",
      title: "Approve requests",
      who: "inventory staff and management",
      steps: [
        "Click **Approve & add** on a request (here or in Inventory → **Requests**).",
        "Check the part and quantity. For a request typed in by name, search and pick the inventory part to give.",
        "Click **Approve & add to ticket**. The stock goes down, the part is added to the ticket's parts used, and the requester is told.",
        "For a return, click **Approve return**. Not used and wrong entry go back into stock; defective parts go on the **Defective** list in Inventory → Requests.",
      ],
      tips: [
        "**Decline** needs a reason, which the requester sees.",
        "Approval is blocked when there isn't enough in stock. Receive the stock first.",
        "On a locked ticket you can't approve your own request or return.",
      ],
    },
    {
      id: "log",
      title: "Who did what (ticket Activity)",
      points: [
        "Every request, return, approval, decline and direct add from Inventory is written to the ticket's **Activity** with the person's name and role: who asked, who approved, the reason, and the parts before → after.",
        "Click **Parts** at the top of **Activity** to see only parts entries. Click **Details** on an entry for the full record.",
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
        "**Out of Stock**: none left. You can still request it from the ticket, and inventory orders it.",
        "**On Order**: it's been ordered and hasn't arrived yet.",
      ],
    },
    {
      id: "use",
      title: "Getting a part for a ticket",
      steps: [
        "Open the ticket (**Service Update** for technicians, **Manage Client** for admin and management) and go to its **Parts** section.",
        "Search the part and click **Request**. Inventory staff approve it, which takes it out of stock and adds it to the ticket's parts used.",
      ],
      tips: ["Out of stock? Request it anyway. Inventory sees it needs ordering and you're told when it changes."],
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
