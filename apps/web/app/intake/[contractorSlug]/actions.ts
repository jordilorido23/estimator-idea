"use server"

import { type IntakeFormData, type IntakeSubmissionResult, intakeFormSchema } from "@/lib/validations/intake"

/**
 * Server action to handle intake form submission
 * TODO: Save to database, trigger triage scoring, send notifications
 */
export async function submitIntakeForm(
  data: IntakeFormData
): Promise<IntakeSubmissionResult> {
  try {
    // Validate input on server
    const validatedData = intakeFormSchema.parse(data)

    // Log to server console for now
    console.log("📝 Intake form submitted:")
    console.log("Contractor Slug:", validatedData.contractorSlug)
    console.log("Homeowner:", validatedData.name, `<${validatedData.email}>`)
    console.log("Phone:", validatedData.phone)
    console.log("Address:", validatedData.address)
    console.log("Trade Type:", validatedData.tradeType)
    console.log("Budget:", validatedData.budget ? `$${validatedData.budget}` : "Not specified")
    console.log("Timeline:", validatedData.timeline || "Not specified")
    console.log("Description:", validatedData.description)
    console.log("---")

    // TODO: Implementation steps:
    // 1. Check if contractor exists by slug
    // 2. Create Lead record in database
    // 3. Upload photos to S3 (when photo upload is implemented)
    // 4. Create Photo records
    // 5. Trigger triage scoring (background job)
    // 6. Send notification to contractor
    // 7. Send confirmation email to homeowner

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Return mock success for now
    return {
      success: true,
      leadId: `lead_${Date.now()}`, // TODO: return actual cuid from DB
    }
  } catch (error) {
    console.error("❌ Error submitting intake form:", error)

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    }
  }
}
