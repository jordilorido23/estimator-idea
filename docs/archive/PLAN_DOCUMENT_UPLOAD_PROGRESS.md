# Plan/Drawing Upload Feature - Implementation Progress

## Overview
Adding the ability to upload and analyze construction plans, architectural drawings, and PDF documents (in addition to photos) to improve estimate accuracy.

## ✅ COMPLETED (Backend & AI - Phases 1-3)

### Phase 1: Database Schema ✅
- [x] Added `Document` model to Prisma schema
  - Fields: `id`, `leadId`, `url`, `key`, `fileName`, `fileType`, `fileSizeBytes`, `metadata`, `createdAt`
  - Support for PDF, IMAGE, DWG, and OTHER file types
- [x] Added `documents` relation to `Lead` model
- [x] Updated `Takeoff` model with:
  - `sourceType` enum (PHOTO | DOCUMENT | HYBRID)
  - `documentIds` field to track which documents were analyzed
- [x] Created and applied database migration `20251120053630_add_document_support`

### Phase 2: Backend Upload Infrastructure ✅
- [x] Created `/api/uploads/presign-document/route.ts`
  - Supports PDF, images, DWG files up to 50MB
  - Rate limiting enabled
  - Validates content types: `application/pdf`, `image/*`, `application/dwg`, etc.
- [x] Created `/api/leads/[id]/documents/route.ts`
  - GET: Retrieve all documents for a lead
  - POST: Associate uploaded documents with a lead
  - DELETE: Remove document from lead (with auth checks)

### Phase 3: AI Analysis - Document Processing ✅
- [x] Created `lib/ai/plan-analyzer.ts`
  - `analyzePlanDocument()` - Analyzes single plan/PDF using Claude Vision
  - `analyzeMultiplePlans()` - Analyzes multiple documents in parallel
  - Extracts: room dimensions, quantities, materials, scope items, structural elements
  - Returns confidence scores and potential issues
- [x] Added document analysis schemas to `lib/ai/schemas.ts`:
  - `RoomDimensionsSchema` - Room measurements with confidence levels
  - `QuantityTakeoffSchema` - Material quantities from plans
  - `PlanAnalysisSchema` - Complete plan analysis structure
  - `CombinedAnalysisSchema` - Merged photo + document analysis
- [x] Updated `lib/ai/scope-generator.ts`
  - Now accepts both `photoAnalyses` and `planAnalyses`
  - Prioritizes plan measurements over photo estimates
  - Combines insights from both sources
  - Flags discrepancies between photos and plans

## 📋 REMAINING (Frontend & Integration - Phases 4-6)

### Phase 4: Frontend Upload UI (NOT STARTED)
**Files to create/modify:**
- [ ] Create `apps/web/components/document-upload.tsx`
  - Similar to photo upload component
  - Accept PDF, DWG, PNG, JPG formats
  - Preview for images, PDF icon for PDFs
  - File size validation (up to 50MB)
  - Display metadata (page count for PDFs, file size)

- [ ] Update `apps/web/components/intake-form.tsx`
  - Add document upload section after photo upload
  - Label: "Construction Plans & Drawings (Optional)"
  - Max 10 documents per lead
  - Wire up to `/api/uploads/presign-document`

- [ ] Update `apps/web/app/dashboard/leads/[id]/page.tsx`
  - Add "Documents" section to display uploaded plans
  - Show document list with download links
  - Display analysis status (pending/analyzing/completed)
  - Add "Analyze Plans" button

### Phase 5: Analysis Workflow Integration (NOT STARTED)
**Files to modify:**
- [ ] Update `apps/web/lib/inngest/functions.ts` (or wherever analyze-lead job is)
  - After photo analysis, check for documents
  - If documents exist, run plan analysis using `analyzeMultiplePlans()`
  - Merge photo + plan analysis into comprehensive takeoff
  - Store combined results with `sourceType: HYBRID`

- [ ] Create `apps/web/app/api/leads/[id]/analyze-documents/route.ts`
  - Endpoint to trigger manual document analysis
  - Queue Inngest job for background processing
  - Return job ID for status tracking

### Phase 6: Testing & Validation (NOT STARTED)
**Files to create:**
- [ ] Create test fixtures in `apps/web/__tests__/fixtures/`
  - Sample PDF plans (kitchen remodel, bathroom, ADU)
  - Expected analysis responses

- [ ] Write unit tests `apps/web/__tests__/lib/ai/plan-analyzer.test.ts`
  - Test PDF analysis with various formats
  - Test dimension extraction accuracy
  - Test quantity calculations
  - Test schema validation

- [ ] Write integration tests
  - End-to-end document upload flow
  - Combined photo + document analysis
  - Scope generation with both sources

## Key Technical Details

### API Endpoints Created
```
POST /api/uploads/presign-document
  - Generate presigned S3 URL for document upload
  - Max 50MB, supports PDF/images/CAD files

GET /api/leads/[id]/documents
  - Retrieve all documents for a lead

POST /api/leads/[id]/documents
  - Associate uploaded document with lead

DELETE /api/leads/[id]/documents?documentId={id}
  - Remove document from lead
```

### AI Analysis Flow
1. Document uploaded to S3 via presigned URL
2. Document record created in database
3. Inngest job triggered for background analysis
4. Claude Vision API analyzes PDF/plan using `analyzePlanDocument()`
5. Extracted data (dimensions, quantities, scope) stored in `Takeoff` model
6. If both photos and plans exist, they're combined in scope generation
7. Plans take priority for measurements, photos for conditions

### Database Schema
```prisma
model Document {
  id            String       @id @default(cuid())
  leadId        String
  fileName      String
  fileType      DocumentType // PDF | IMAGE | DWG | OTHER
  fileSizeBytes Int
  metadata      Json?        // Page count, dimensions, etc.
  url           String
  key           String       @unique
  createdAt     DateTime     @default(now())
}

model Takeoff {
  sourceType       TakeoffSourceType  @default(PHOTO) // PHOTO | DOCUMENT | HYBRID
  documentIds      String[]            // Document IDs used in analysis
  // ... existing fields
}
```

## Next Steps (Recommended Order)

1. **Frontend Upload Component** (2-3 hours)
   - Start with `document-upload.tsx` component
   - Test file upload flow with S3 presign endpoint
   - Ensure error handling and loading states work

2. **Intake Form Integration** (1 hour)
   - Add document upload to intake form
   - Test full homeowner → contractor workflow

3. **Lead Detail Page** (1 hour)
   - Display uploaded documents
   - Add download links
   - Show analysis status

4. **Inngest Job Integration** (2 hours)
   - Wire up document analysis to background job
   - Test combined photo + document analysis
   - Verify Takeoff record stores both sources

5. **Testing** (2-3 hours)
   - Write comprehensive tests
   - Test with real PDF plans
   - Validate AI extraction accuracy

## Testing the Backend (Available Now)

You can test the backend right now using curl:

### 1. Request presigned URL for document upload
```bash
curl -X POST http://localhost:3000/api/uploads/presign-document \
  -H "Content-Type: application/json" \
  -d '{
    "contractorSlug": "demo-contractor",
    "leadTempId": "test-123",
    "contentType": "application/pdf",
    "fileName": "kitchen-plan.pdf",
    "fileSize": 1048576
  }'
```

### 2. Upload document to S3 (use presigned URL from step 1)
```bash
# Use the presigned URL and fields from step 1
```

### 3. Associate document with lead
```bash
curl -X POST http://localhost:3000/api/leads/{leadId}/documents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {clerk-token}" \
  -d '{
    "url": "https://...",
    "key": "contractors/...",
    "fileName": "kitchen-plan.pdf",
    "fileType": "PDF",
    "fileSizeBytes": 1048576
  }'
```

### 4. Test plan analysis directly
```typescript
import { analyzePlanDocument } from '@/lib/ai/plan-analyzer';

const analysis = await analyzePlanDocument(
  'https://your-s3-url/kitchen-plan.pdf',
  'kitchen-plan.pdf',
  'PDF'
);

console.log(analysis.rooms); // Room dimensions
console.log(analysis.quantities); // Material quantities
console.log(analysis.scopeItems); // Scope of work items
```

## Estimated Remaining Effort
- Frontend components: 4-5 hours
- Inngest integration: 2 hours
- Testing: 2-3 hours

**Total remaining: ~8-10 hours of focused work**

## Notes
- Backend is production-ready with proper auth, rate limiting, and error handling
- AI analysis uses Claude Vision with 90s timeout for complex PDFs
- Schema supports both photos and documents independently or combined
- Backwards compatible - existing photo-only leads continue to work
