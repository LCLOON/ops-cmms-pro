import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username required').max(50),
  password: z.string().min(1, 'Password required').max(128),
  betaAccess: z.boolean().optional(),
});

export const assetSchema = z.object({
  name: z.string().min(1, 'Name required'),
  category: z.enum(['mechanical','electrical','hvac','plumbing','structural','vehicle','it','safety','other']),
  location: z.string().default(''),
  department: z.string().default(''),
  manufacturer: z.string().default(''),
  model: z.string().default(''),
  serialNumber: z.string().default(''),
  installDate: z.string().default(''),
  warrantyExpiry: z.string().default(''),
  status: z.enum(['operational','down','maintenance','retired']).default('operational'),
  criticality: z.enum(['critical','high','medium','low']).default('low'),
  notes: z.string().default(''),
  parentId: z.string().default(''),
});

export const workOrderSchema = z.object({
  assetId: z.string().default(''),
  title: z.string().min(1, 'Title required'),
  description: z.string().default(''),
  type: z.enum(['corrective','preventive','predictive','emergency','inspection']).default('corrective'),
  priority: z.enum(['critical','high','medium','low']).default('medium'),
  status: z.enum(['open','in_progress','on_hold','completed','cancelled']).default('open'),
  assignedTo: z.string().default(''),
  requestedBy: z.string().default(''),
  dueDate: z.string().default(''),
  resolution: z.string().default(''),
  laborHours: z.number().default(0),
  partsCost: z.number().default(0),
});

export const pmScheduleSchema = z.object({
  assetId: z.string().default(''),
  title: z.string().min(1, 'Title required'),
  description: z.string().default(''),
  frequencyType: z.enum(['daily','weekly','monthly','quarterly','semi_annual','annual','runtime_hours']).default('weekly'),
  frequencyValue: z.number().int().min(1).default(1),
  lastCompleted: z.string().default(''),
  nextDue: z.string().default(''),
  assignedTo: z.string().default(''),
  estimatedHours: z.number().min(0).default(1),
  active: z.boolean().default(true),
  procedureId: z.string().default(''),
});

export const procedureStepSchema = z.object({
  stepOrder: z.number().int().min(1).default(1),
  instruction: z.string().min(1, 'Step instruction required'),
  expectedResult: z.string().default(''),
  responseType: z.enum(['checkbox', 'reading', 'pass_fail', 'text']).default('checkbox'),
  unit: z.string().default(''),
  safetyNote: z.string().default(''),
});

export const procedureSchema = z.object({
  title: z.string().min(1, 'Title required'),
  description: z.string().default(''),
  category: z.enum(['mechanical', 'electrical', 'hvac', 'plumbing', 'structural', 'safety', 'inspection', 'other']).default('other'),
  assetId: z.string().default(''),
  version: z.string().default('1.0'),
  status: z.enum(['draft', 'approved', 'retired']).default('draft'),
  approvedBy: z.string().default(''),
  approvedAt: z.string().default(''),
  active: z.boolean().default(true),
  steps: z.array(procedureStepSchema).default([]),
});

export const inventoryItemSchema = z.object({
  name: z.string().min(1, 'Name required'),
  partNumber: z.string().default(''),
  category: z.enum(['mechanical','electrical','hvac','plumbing','safety','consumable','general']).default('general'),
  quantityOnHand: z.number().int().min(0).default(0),
  minQuantity: z.number().int().min(0).default(0),
  unitCost: z.number().min(0).default(0),
  supplier: z.string().default(''),
  location: z.string().default(''),
  notes: z.string().default(''),
});
