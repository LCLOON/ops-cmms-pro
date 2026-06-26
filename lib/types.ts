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
