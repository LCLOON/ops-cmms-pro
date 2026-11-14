import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username required').max(50),
  password: z.string().min(1, 'Password required').max(128),
  betaAccess: z.boolean().optional(),
});

export const assetSchema = z.object({
  siteId: z.string().default(''),
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
  // These are captured by the asset form and stored in dedicated columns, but
  // zod strips unknown keys — omitting them here meant Replacement Cost and
  // Failure Mode were silently discarded on every save. Optional so a partial
  // update does not reset them to defaults.
  area: z.string().optional(),
  system: z.string().optional(),
  // Coerced because form inputs submit strings; an empty box becomes 0.
  replacementCost: z.coerce.number().min(0).optional(),
  failureMode: z.string().optional(),
  isComponent: z.boolean().optional(),
});

export const workOrderSchema = z.object({
  assetId: z.string().default(''),
  siteId: z.string().default(''),
  pmScheduleId: z.string().default(''),
  sourceTestingRecordId: z.string().default(''),
  sourceInspectionId: z.string().default(''),
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
  // Deferral is a formal governance state (reason + approver), so it must
  // survive validation. Without these fields zod stripped them on create and
  // a deferred PM silently reverted to "not deferred" — and kept nagging.
  deferralReason: z.string().default(''),
  deferralApprovedBy: z.string().default(''),
});

export const equipmentTestSchema = z.object({
  assetId: z.string().default(''),
  discipline: z.enum(['electrical', 'mechanical']).default('electrical'),
  testType: z.enum([
    'transformer_oil', 'dga', 'breaker_timing', 'relay_test', 'battery_test',
    'charger_test', 'ir_scan', 'ground_test', 'cable_test', 'protection_settings',
    'vibration_analysis', 'lubrication_analysis', 'alignment_check', 'pressure_test',
    'load_test', 'performance_test', 'ultrasound', 'thermography', 'ndt_inspection', 'other',
  ]).default('other'),
  testDate: z.string().default(''),
  results: z.string().default(''),
  nextDue: z.string().default(''),
  testedBy: z.string().default(''),
  status: z.enum(['pending', 'passed', 'failed', 'attention']).default('pending'),
  notes: z.string().default(''),
});

export const inspectionSchema = z.object({
  siteId: z.string().default(''),
  assetId: z.string().default(''),
  complianceObligationId: z.string().default(''),
  inspectionType: z.enum(['visual','detailed','regulatory','dam_safety','fish_passage','substation','safety','other']).default('visual'),
  title: z.string().min(1, 'Title required'),
  description: z.string().default(''),
  scheduledDate: z.string().default(''),
  completedDate: z.string().default(''),
  inspector: z.string().default(''),
  findings: z.string().default(''),
  recommendations: z.string().default(''),
  correctiveActions: z.string().default(''),
  readings: z.string().default(''),
  photos: z.string().default(''),
  status: z.enum(['scheduled','in_progress','completed','deficient','overdue']).default('scheduled'),
  priority: z.enum(['critical','high','medium','low']).default('medium'),
});

export const rootCauseAnalysisSchema = z.object({
  assetId: z.string().min(1, 'Asset required'),
  workOrderId: z.string().default(''),
  failureDate: z.string().default(''),
  failureMode: z.string().default(''),
  symptoms: z.string().default(''),
  causeCategory: z.enum(['design', 'installation', 'operation', 'maintenance', 'material', 'environment', 'human_factors', 'unknown', 'other']).default('unknown'),
  rootCause: z.string().default(''),
  contributingFactors: z.string().default(''),
  correctiveAction: z.string().default(''),
  preventiveAction: z.string().default(''),
  actionOwner: z.string().default(''),
  dueDate: z.string().default(''),
  status: z.enum(['open', 'investigating', 'actions_in_progress', 'verified', 'closed']).default('open'),
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
