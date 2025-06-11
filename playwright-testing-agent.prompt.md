# Playwright Testing Agent Prompt for FindMyDoc Platform

## Testing Context
You are testing the FindMyDoc platform, a PayloadCMS-powered website for medical practice discovery. The application consists of a public-facing website for finding doctors and clinics, and an admin panel for content management.

## Application Architecture
- **Frontend**: Next.js application on port 3000
- **Admin Panel**: PayloadCMS admin at `/admin`
- **Database**: PostgreSQL with PayloadCMS collections
- **Authentication**: PayloadCMS built-in auth system

## Key User Flows to Test

### Public Website Testing
1. **Homepage Functionality**
   - Verify hero section loads correctly
   - Test navigation menu functionality
   - Validate responsive design across devices
   - Check content blocks render properly

2. **Doctor/Clinic Discovery**
   - Search functionality for doctors and clinics
   - Filter and sort capabilities
   - Doctor profile page navigation
   - Clinic information display

3. **Content Pages**
   - Blog post listing and individual post pages
   - SEO meta tags and social sharing
   - Related content suggestions
   - Comment functionality if enabled

4. **Performance Testing**
   - Page load times
   - Image optimization and loading
   - Core Web Vitals metrics
   - Mobile performance

### Admin Panel Testing
1. **Authentication Flow**
   - Login page functionality
   - User registration if enabled
   - Password reset functionality
   - Session management

2. **Content Management**
   - Creating and editing pages
   - Publishing and draft workflows
   - Media upload and management
   - Layout builder functionality

3. **Collection Management**
   - Doctor profile creation/editing
   - Clinic information management
   - Category and tag management
   - User management for admins

4. **Advanced Features**
   - SEO field completion
   - Version history and drafts
   - Live preview functionality
   - Bulk operations

## Testing Patterns

### Page Object Model
Create page objects for:
- Homepage (`HomePage`)
- Doctor listing (`DoctorListPage`)
- Doctor profile (`DoctorProfilePage`)
- Clinic listing (`ClinicListPage`)
- Admin login (`AdminLoginPage`)
- Admin dashboard (`AdminDashboardPage`)
- Content editor (`ContentEditorPage`)

### Common Test Utilities
```typescript
// Example utility functions to implement
async function loginAsAdmin(page: Page, email: string, password: string)
async function createTestDoctor(page: Page, doctorData: DoctorData)
async function uploadTestMedia(page: Page, filePath: string)
async function publishDraftContent(page: Page, contentId: string)
```

### Test Data Management
- Use test fixtures for doctor/clinic data
- Implement database seeding for consistent test state
- Clean up test data after each test suite
- Use environment variables for test configuration

## Critical Test Scenarios

### User Journey Tests
1. **Visitor Finding a Doctor**
   - Navigate to homepage
   - Use search to find doctors by specialty
   - View doctor profile
   - Check contact information availability

2. **Admin Content Creation**
   - Login to admin panel
   - Create new doctor profile
   - Add profile image and details
   - Publish content
   - Verify on public site

3. **Responsive Design Validation**
   - Test on mobile, tablet, desktop viewports
   - Verify navigation menu responsiveness
   - Check form usability on mobile
   - Validate image scaling and layout

### Error Handling Tests
- Invalid login attempts
- Network failure scenarios
- Missing required form fields
- File upload error conditions
- Database connection issues

## Environment Setup
```typescript
// Example test configuration
const config: PlaywrightTestConfig = {
  baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
    { name: 'mobile', use: devices['iPhone 12'] },
  ],
};
```

## Test Organization
```
tests/
├── e2e/
│   ├── public/
│   │   ├── homepage.spec.ts
│   │   ├── doctor-search.spec.ts
│   │   └── clinic-listing.spec.ts
│   └── admin/
│       ├── auth.spec.ts
│       ├── content-management.spec.ts
│       └── media-upload.spec.ts
├── fixtures/
│   ├── doctors.json
│   └── clinics.json
└── utils/
    ├── test-helpers.ts
    └── page-objects/
```

## Performance Benchmarks
- Homepage load time: < 2 seconds
- Search results: < 1 second
- Admin panel load: < 3 seconds
- Image upload: < 5 seconds for typical sizes
- Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1

## Accessibility Testing
- Keyboard navigation throughout the site
- Screen reader compatibility
- Color contrast ratios
- ARIA labels and semantic HTML
- Focus management in dynamic content

## Integration Points
- Test PayloadCMS API endpoints
- Verify S3 storage integration
- Check email notification systems
- Validate search plugin functionality
- Test redirect plugin behavior

## Browser Compatibility
Target modern browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Monitoring and Reporting
- Generate test reports with screenshots
- Track test execution time trends
- Monitor flaky test patterns
- Integration with CI/CD pipeline
- Visual regression testing for UI changes