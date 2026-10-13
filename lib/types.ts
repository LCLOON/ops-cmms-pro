export interface Asset {
  id: string;
  name: string;
  category: 'mechanical' | 'electrical' | 'hvac' | 'plumbing' | 'structural' | 'vehicle' | 'it' | 'safety' | 'other';
  location: string;
  department: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  installDate: string;
  warrantyExpiry: string;
  status: 'operational' | 'down' | 'maintenance' | 'retired';
  criticality: 'critical' | 'high' | 'medium' | 'low';
  notes: string;
  parentId: string;
  area?: string;
  system?: string;
  replacementCost?: number;
  failureMode?: string;
  isComponent?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrder {
  id: string;
  assetId: string;
  title: string;
  description: string;
  type: 'corrective' | 'preventive' | 'predictive' | 'emergency' | 'inspection';
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  assignedTo: string;
  requestedBy: string;
  dueDate: string;
  completedDate: string;
  laborHours: number;
  partsCost: number;
  resolution: string;
  createdAt: string;
  updatedAt: string;
}

export interface PmSchedule {
  id: string;
  assetId: string;
  title: string;
  description: string;
  frequencyType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'runtime_hours';
  frequencyValue: number;
  lastCompleted: string;
  nextDue: string;
  assignedTo: string;
  estimatedHours: number;
  active: boolean;
  deferralReason?: string;
  deferralApprovedBy?: string;
  procedureId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  partNumber: string;
  category: 'mechanical' | 'electrical' | 'hvac' | 'plumbing' | 'safety' | 'consumable' | 'general';
  quantityOnHand: number;
  minQuantity: number;
  unitCost: number;
  supplier: string;
  location: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SiteConfig {
  companyName: string;
  siteName: string;
  siteAddress: string;
  managerName: string;
  managerEmail: string;
  managerPhone: string;
  setupComplete: boolean;
}

export interface DbUser {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  role: 'admin' | 'manager' | 'technician' | 'viewer';
  active: number;
  force_password_change: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WoPart {
  id: number;
  workOrderId: string;
  inventoryItemId: string;
  inventoryName?: string;
  partNumber?: string;
  quantity: number;
  unitCost: number;
  createdAt: string;
}

export interface WoLabor {
  id: number;
  workOrderId: string;
  userId: number;
  username: string;
  hours: number;
  loggedDate: string;
  notes: string;
  createdAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  paymentTerms: string;
  notes: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  vendorId: string;
  vendorName?: string;
  poNumber: string;
  status: 'draft' | 'sent' | 'received' | 'cancelled';
  orderDate: string;
  expectedDate: string;
  receivedDate: string;
  totalCost: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PoItem {
  id: number;
  poId: string;
  inventoryItemId: string;
  itemName: string;
  quantity: number;
  unitCost: number;
  createdAt: string;
}

export interface MeterReading {
  id: number;
  assetId: string;
  readingType: string;
  value: number;
  unit: string;
  readingDate: string;
  recordedBy: string;
  notes: string;
  createdAt: string;
}

export interface Site {
  id: string;
  name: string;
  fercNo: string;
  riverSystem: string;
  riverMile: number;
  capacityMw: string;
  county: string;
  state: string;
  operator: string;
  yearBuilt: number;
  status: 'operational' | 'standby' | 'decommissioned' | 'construction';
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceObligation {
  id: string;
  siteId: string;
  obligationType: 'dam_safety' | 'ferc_license' | 'fish_passage' | 'environmental' | 'water_quality' | 'public_safety' | 'eap' | 'dssmp' | 'nerc' | 'ot_cyber' | 'other';
  title: string;
  description: string;
  regulationRef: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | '5-year' | 'seasonal' | 'as-needed';
  lastCompleted: string;
  nextDue: string;
  ownerRole: string;
  evidenceRequired: string;
  status: 'open' | 'in_progress' | 'completed' | 'overdue' | 'waived';
  priority: 'critical' | 'high' | 'medium' | 'low';
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Inspection {
  id: string;
  assetId: string;
  complianceObligationId: string;
  inspectionType: 'visual' | 'detailed' | 'regulatory' | 'dam_safety' | 'fish_passage' | 'substation' | 'safety' | 'other';
  title: string;
  description: string;
  scheduledDate: string;
  completedDate: string;
  inspector: string;
  findings: string;
  recommendations: string;
  correctiveActions: string;
  readings: string;
  photos: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'deficient' | 'overdue';
  priority: 'critical' | 'high' | 'medium' | 'low';
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  assetId: string;
  documentType: 'om_manual' | 'drawing' | 'one_line' | 'relay_settings' | 'plc_backup' | 'sop' | 'eap' | 'loto' | 'inspection_report' | 'test_report' | 'photo' | 'certification' | 'other';
  title: string;
  description: string;
  filePath: string;
  fileUrl: string;
  version: string;
  uploadedBy: string;
  uploadDate: string;
  reviewDueDate: string;
  tags: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyPermit {
  id: string;
  workOrderId: string;
  assetId: string;
  permitType: 'loto' | 'confined_space' | 'hot_work' | 'excavation' | 'diving' | 'crane' | 'working_at_heights' | 'other';
  permitNumber: string;
  issuedBy: string;
  issuedDate: string;
  expiryDate: string;
  status: 'draft' | 'issued' | 'active' | 'closed' | 'expired' | 'cancelled';
  description: string;
  hazards: string;
  precautions: string;
  approvedBy: string;
  attachments: string;
  createdAt: string;
  updatedAt: string;
}

export type ProcedureCategory = 'mechanical' | 'electrical' | 'hvac' | 'plumbing' | 'structural' | 'safety' | 'inspection' | 'other';
export type ProcedureResponseType = 'checkbox' | 'reading' | 'pass_fail' | 'text';

export interface ProcedureStep {
  id: number;
  procedureId: string;
  stepOrder: number;
  instruction: string;
  expectedResult: string;
  responseType: ProcedureResponseType;
  unit: string;
  safetyNote: string;
}

export interface Procedure {
  id: string;
  title: string;
  description: string;
  category: ProcedureCategory;
  assetId: string;
  version: string;
  active: boolean;
  stepCount?: number;
  steps?: ProcedureStep[];
  createdAt: string;
  updatedAt: string;
}

export interface WoChecklistItem {
  id: number;
  workOrderId: string;
  procedureId: string;
  stepOrder: number;
  instruction: string;
  expectedResult: string;
  responseType: ProcedureResponseType;
  unit: string;
  safetyNote: string;
  completed: boolean;
  resultValue: string;
  resultStatus: '' | 'pass' | 'fail' | 'na';
  notes: string;
  completedBy: string;
  completedAt: string;
}

export interface ElectricalTest {
  id: string;
  assetId: string;
  testType: 'transformer_oil' | 'dga' | 'breaker_timing' | 'relay_test' | 'battery_test' | 'charger_test' | 'ir_scan' | 'ground_test' | 'cable_test' | 'protection_settings' | 'other';
  testDate: string;
  results: string;
  nextDue: string;
  testedBy: string;
  status: 'pending' | 'passed' | 'failed' | 'attention';
  notes: string;
  createdAt: string;
  updatedAt: string;
}
