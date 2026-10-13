// The application's self-knowledge: what every module does, how to use it and
// what fields it tracks. This module is intentionally free of any server-only
// imports (fs, database, etc.) so both the advisor (server) and the Help page
// (client) can import it without pulling server code into the browser bundle.

export interface KnowledgeEntry {
  module: string;
  page: string;
  what: string;
  how: string[];
  fields: string[];
  related: string[];
}

// This is what makes the advisor able to explain "every function" without
// depending on an external model.
export const KNOWLEDGE: KnowledgeEntry[] = [
  {
    module: 'Dashboard', page: 'dashboard',
    what: 'Landing view with live KPIs: asset counts, open work orders, overdue PMs, down assets, low stock and completions this month.',
    how: ['Sign in and land here', 'Click a KPI card region to jump to the owning module', 'Use the header search or Ctrl+K to find any asset, work order or PM'],
    fields: ['totalAssets', 'openWorkOrders', 'overduePMs', 'downAssets', 'lowStock', 'completedThisMonth'],
    related: ['Assets', 'Work Orders', 'PM Schedule', 'Inventory'],
  },
  {
    module: 'Assets', page: 'assets',
    what: 'The asset registry: every maintainable item with identity, location, criticality and hierarchy (parent/component).',
    how: ['Assets in the sidebar', 'Add to create one, or edit a row', 'Use Import to bulk-load a register', 'Document ingestion can build assets from manuals or nameplates'],
    fields: ['name', 'category', 'location', 'department', 'manufacturer', 'model', 'serialNumber', 'installDate', 'warrantyExpiry', 'status', 'criticality', 'parentId', 'replacementCost', 'failureMode'],
    related: ['Work Orders', 'PM Schedule', 'Documents', 'Inspections'],
  },
  {
    module: 'Work Orders', page: 'work-orders',
    what: 'Corrective, preventive, predictive, emergency and inspection work. Tracks assignment, due dates, labor hours, parts cost and resolution.',
    how: ['Work Orders in the sidebar', 'Create with a title, asset and priority', 'Log parts and labor on the work order', 'Move status open → in_progress → completed'],
    fields: ['title', 'assetId', 'type', 'priority', 'status', 'assignedTo', 'dueDate', 'laborHours', 'partsCost', 'resolution'],
    related: ['Assets', 'Inventory', 'Safety', 'Reports', 'Procedures'],
  },
  {
    module: 'Procedures', page: 'procedures',
    what: 'Reusable standard operating procedures. Each procedure is a versioned list of steps with a response type (checkbox, reading, pass/fail or text). Applying a procedure copies a snapshot onto a work order so later edits do not rewrite completed work.',
    how: ['Procedures in the sidebar', 'Create a procedure with ordered steps', 'Attach it to a PM schedule so generated work orders inherit the checklist', 'Or apply it directly from a work order Checklist tab'],
    fields: ['title', 'category', 'version', 'assetId', 'active', 'instruction', 'expectedResult', 'responseType', 'unit', 'safetyNote'],
    related: ['Work Orders', 'PM Schedule', 'Safety', 'Documents'],
  },
  {
    module: 'PM Schedule', page: 'pm-schedule',
    what: 'Recurring preventive maintenance with daily through annual and runtime-hour frequencies, plus deferral tracking with approval.',
    how: ['PM Schedule in the sidebar', 'Create a schedule against an asset', 'Attach a procedure so generated work orders copy its checklist', 'Generate a work order from a due PM', 'Deferrals require a reason and approver'],
    fields: ['title', 'assetId', 'frequencyType', 'frequencyValue', 'lastCompleted', 'nextDue', 'assignedTo', 'estimatedHours', 'active', 'deferralReason', 'deferralApprovedBy', 'procedureId'],
    related: ['Work Orders', 'Assets', 'Compliance', 'Procedures'],
  },
  {
    module: 'Inventory', page: 'inventory',
    what: 'Spare parts and consumables with on-hand quantity, minimum level and unit cost. Drives low-stock warnings.',
    how: ['Inventory in the sidebar', 'Add parts with part number and reorder level', 'Consume parts from a work order'],
    fields: ['name', 'partNumber', 'category', 'quantityOnHand', 'minQuantity', 'unitCost', 'supplier', 'location'],
    related: ['Work Orders', 'Purchase Orders', 'Vendors'],
  },
  {
    module: 'Vendors', page: 'vendors',
    what: 'Supplier and contractor directory with contacts, payment terms and active flag.',
    how: ['Vendors in the sidebar', 'Add a vendor', 'Reference the vendor on a purchase order'],
    fields: ['name', 'contactName', 'email', 'phone', 'address', 'website', 'paymentTerms', 'active'],
    related: ['Purchase Orders', 'Inventory'],
  },
  {
    module: 'Purchase Orders', page: 'purchase-orders',
    what: 'Procurement of parts: draft → sent → received, with line items linked to inventory.',
    how: ['Purchase Orders in the sidebar', 'Create a PO against a vendor', 'Add line items', 'Mark received when goods arrive'],
    fields: ['poNumber', 'vendorId', 'status', 'orderDate', 'expectedDate', 'receivedDate', 'totalCost'],
    related: ['Vendors', 'Inventory'],
  },
  {
    module: 'Compliance', page: 'compliance',
    what: 'Regulatory obligations (FERC licence, dam safety, fish passage, environmental, water quality, public safety, EAP, DSSMP, NERC, OT cyber) with frequency, owner and evidence required.',
    how: ['Compliance in the sidebar', 'Define an obligation with its regulation reference', 'Set frequency and next due', 'Record completion evidence'],
    fields: ['obligationType', 'title', 'regulationRef', 'frequency', 'lastCompleted', 'nextDue', 'ownerRole', 'evidenceRequired', 'status', 'priority'],
    related: ['Inspections', 'Documents', 'PM Schedule'],
  },
  {
    module: 'Documents', page: 'documents',
    what: 'Controlled document library: O&M manuals, drawings, one-lines, relay settings, PLC backups, SOPs, EAPs, LOTO procedures, inspection and test reports, photos, certifications.',
    how: ['Documents in the sidebar', 'Add a document with type, version and review due date', 'Ingest a document to extract asset candidates', 'Link documents to an asset ID'],
    fields: ['title', 'documentType', 'assetId', 'version', 'fileUrl', 'reviewDueDate', 'tags', 'active'],
    related: ['Assets', 'Compliance', 'Inspections'],
  },
  {
    module: 'Safety', page: 'safety',
    what: 'Permits to work: LOTO, confined space, hot work, excavation, diving, crane, working at heights — with hazards, precautions and approval.',
    how: ['Safety in the sidebar', 'Issue a permit against a work order or asset', 'Record hazards and precautions', 'Close the permit when work ends'],
    fields: ['permitType', 'permitNumber', 'workOrderId', 'assetId', 'issuedBy', 'issuedDate', 'expiryDate', 'status', 'hazards', 'precautions', 'approvedBy'],
    related: ['Work Orders', 'Documents'],
  },
  {
    module: 'Inspections', page: 'inspections',
    what: 'Scheduled and completed inspections — visual, detailed, regulatory, dam safety, fish passage, substation and safety — with findings and corrective actions.',
    how: ['Inspections in the sidebar', 'Schedule an inspection linked to an asset or obligation', 'Record findings and recommendations', 'Raise corrective actions'],
    fields: ['inspectionType', 'title', 'assetId', 'complianceObligationId', 'scheduledDate', 'completedDate', 'inspector', 'findings', 'recommendations', 'correctiveActions', 'status', 'priority'],
    related: ['Compliance', 'Assets', 'Documents'],
  },
  {
    module: 'Electrical', page: 'electrical',
    what: 'Electrical test records: transformer oil, DGA, breaker timing, relay tests, battery and charger tests, IR scans, ground tests, cable tests and protection settings.',
    how: ['Electrical in the sidebar', 'Record a test with date and results', 'Set the next due date', 'Failures or attention flags surface in reports'],
    fields: ['testType', 'assetId', 'testDate', 'results', 'nextDue', 'testedBy', 'status'],
    related: ['Assets', 'PM Schedule', 'Compliance'],
  },
  {
    module: 'Reports', page: 'reports',
    what: 'Reliability and cost analytics: MTTR, MTBF, cost by asset, PM compliance, work orders by status and type, monthly costs, inventory value, YTD totals and backlog aging.',
    how: ['Reports in the sidebar', 'Review MTTR/MTBF for failing assets', 'Track PM compliance rate', 'Use backlog aging to prioritise'],
    fields: ['mttr', 'mtbf', 'costByAsset', 'pmCompliance', 'woByStatus', 'woByType', 'monthlyCosts', 'inventoryValue', 'ytdStats', 'backlog'],
    related: ['Work Orders', 'PM Schedule', 'Assets'],
  },
  {
    module: 'Admin', page: 'admin',
    what: 'User administration and site configuration: roles (admin, manager, technician, viewer), password resets, activation and company/site details.',
    how: ['Admin in the sidebar (admins only)', 'Create users and assign roles', 'Set company and site details', 'Force a password change when needed'],
    fields: ['username', 'displayName', 'role', 'active', 'forcePasswordChange', 'companyName', 'siteName', 'siteAddress', 'managerName', 'managerEmail', 'managerPhone'],
    related: ['Dashboard'],
  },
];
