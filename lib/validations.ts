import { z } from 'zod'

export const SaveFlowchartSchema = z.object({
  title:    z.string().min(1).max(100).trim(),
  code:     z.string().max(50_000),
  language: z.enum(['javascript', 'typescript', 'python']),
})

export const UpdateFlowchartSchema = z.object({
  title:    z.string().min(1).max(100).trim().optional(),
  code:     z.string().max(50_000).optional(),
  language: z.enum(['javascript', 'typescript', 'python']).optional(),
})

export const RenameSchema = z.object({
  title: z.string().min(1).max(100).trim(),
})

export type SaveFlowchartInput   = z.infer<typeof SaveFlowchartSchema>
export type UpdateFlowchartInput = z.infer<typeof UpdateFlowchartSchema>
