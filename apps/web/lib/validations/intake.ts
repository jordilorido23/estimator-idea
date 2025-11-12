import { z } from "zod"
import { TradeType } from "@scopeguard/db"

/**
 * Intake form validation schema
 * Shared between client and server for consistent validation
 */
export const intakeFormSchema = z.object({
  // Homeowner details
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long"),
  email: z.string().email("Invalid email address"),
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .max(20, "Phone number is too long")
    .regex(/^[\d\s()+-]+$/, "Invalid phone number format"),
  address: z
    .string()
    .min(5, "Address must be at least 5 characters")
    .max(200, "Address is too long"),

  // Project details
  tradeType: z.nativeEnum(TradeType, {
    errorMap: () => ({ message: "Please select a project type" }),
  }),
  budget: z
    .number({
      invalid_type_error: "Budget must be a number",
    })
    .int("Budget must be a whole number")
    .positive("Budget must be greater than 0")
    .optional(),
  timeline: z.string().optional(),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(1000, "Description is too long"),

  // Contractor reference
  contractorSlug: z.string().min(1, "Contractor slug is required"),
})

/**
 * Type inference from schema
 */
export type IntakeFormData = z.infer<typeof intakeFormSchema>

/**
 * Photo metadata for future upload implementation
 */
export interface PhotoFile {
  file: File
  preview: string
  id: string
}

/**
 * Server action response type
 */
export interface IntakeSubmissionResult {
  success: boolean
  leadId?: string
  error?: string
}
