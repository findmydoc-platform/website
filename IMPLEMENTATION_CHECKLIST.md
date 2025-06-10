# Registration Implementation Checklist

## Step 1: First Admin User Registration ✅ COMPLETED
- [x] **REFACTORED: Server-side security approach implemented**
- [x] Created secure API route `/api/auth/first-admin/route.ts`
- [x] Uses Supabase Admin API with service role key
- [x] Server-side check for existing admin users before creation
- [x] Page `/admin/first-admin` with server-side redirect logic
- [x] Form component `FirstAdminForm` calls API only
- [x] Added `createAdminClient()` utility for admin operations
- [x] Updated `hasAdminUsers()` to use admin client
- [x] Added Supabase environment variables to `.env.example`
- [x] Updated documentation in `/docs/setup.md`
- [x] **SECURITY: All access control happens server-side**
- [x] **ARCHITECTURE: Separated auth from CMS operations**
- [x] Form includes: firstName, lastName, email, password
- [x] Creates Supabase user with user_type: 'platform' metadata
- [x] Auto-confirms email for first user
- [x] Returns proper success/error responses

## Step 2: Patient Registration Form
- [ ] Create `/register/patient/page.tsx` with server-side access control
- [ ] Create API endpoint `/api/auth/patient/route.ts`
- [ ] Use Supabase Admin API pattern from first-admin
- [ ] Form fields: firstName, lastName, email, password, dateOfBirth, phone
- [ ] Creates Supabase user with user_type: 'patient' metadata
- [ ] Creates corresponding Patient record in Payload CMS
- [ ] Add patient registration link to main navigation/landing in the header collection as data
- [ ] Test patient registration and verify in both Supabase and Patients collection

## Step 3: Clinic Staff Registration Form
- [ ] Create `/register/clinic/page.tsx` with server-side access control
- [ ] Create API endpoint `/api/auth/clinic/route.ts`
- [ ] Form fields: firstName, lastName, email, password, clinicName, position, phone
- [ ] Creates Supabase user with user_type: 'clinic' metadata
- [ ] Creates BasicUser + ClinicStaff profile records in Payload
- [ ] Links to appropriate Clinic record or creates pending clinic entry
- [ ] Test clinic staff registration and verify in both collections

## Step 4: Enhanced Registration Architecture
- [ ] **SECURITY REVIEW**: Ensure all registration routes use server-side validation
- [ ] **ACCESS CONTROL**: Implement rate limiting for registration endpoints
- [ ] **EMAIL VERIFICATION**: Add email confirmation flow for patient/clinic users
- [ ] **ROLE MANAGEMENT**: Ensure proper user_type metadata in all flows
- [ ] **ERROR HANDLING**: Standardize error responses across all registration APIs
- [ ] **LOGGING**: Add proper audit logging for user creation events

## Step 5: Enhanced Seed Data
- [ ] Update seed to include all user types following new architecture
- [ ] Add patient test user (patient@test.com) with proper Payload record
- [ ] Add clinic test user (clinic@test.com) with BasicUser + ClinicStaff
- [ ] Keep existing platform user pattern
- [ ] Ensure seed uses admin API for consistent user creation
- [ ] Test all three user types work in development

## Step 6: Documentation & Testing
- [ ] Update API documentation for new registration endpoints
- [ ] Add registration flow diagrams to docs
- [ ] Create integration tests for all registration paths
- [ ] Update environment variable documentation
- [ ] Add troubleshooting guide for common registration issues

## Current Status: Step 1 Complete - Ready for Step 2

## Architecture Decisions Made:
- **Security First**: All registration flows use server-side validation and Supabase Admin API
- **Separation of Concerns**: Auth operations (Supabase) separate from CMS operations (Payload)
- **Consistent Patterns**: All registration endpoints follow `/api/auth/{userType}/route.ts` pattern
- **Access Control**: Server-side page checks with immediate redirects for security
- **Environment**: Proper Supabase service role key usage for admin operations

## Technical Implementation Notes:
- Use `createAdminClient()` utility for all user creation operations
- Follow server-side page pattern with `redirect()` for access control
- Maintain user_type metadata consistency: 'platform', 'patient', 'clinic'
- Link Supabase users to appropriate Payload CMS records
- All forms should include proper validation and error handling
- Use existing UI components and styling patterns from first-admin implementation

## Files Created/Modified in Step 1:
- `/src/app/api/auth/first-admin/route.ts` - Secure admin user creation API
- `/src/app/(frontend)/admin/first-admin/page.tsx` - Server-side secured registration page
- `/src/utilities/supabase/server.ts` - Added createAdminClient() utility
- `/src/utilities/firstUserCheck.ts` - Updated to use admin client
- `.env.example` - Added Supabase environment variables
- `/docs/setup.md` - Added first admin setup documentation
