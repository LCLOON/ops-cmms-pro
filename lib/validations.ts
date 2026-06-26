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
