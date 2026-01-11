```mermaid
---
config:
  theme: neo-dark
---
erDiagram
    direction TB

    BasicUsers {
        text id PK "UUID, auto by Payload"
        text supabaseUserId "Supabase user id, unique, set by auth hook"
        text firstName "Given name, required"
        text lastName "Family name, required"
        email email "Login email, required, unique"
        select userType "enum: clinic, platform"
        upload profileImage FK "Relationship to UserProfileMedia"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    PlatformStaff {
        text id PK "UUID, auto by Payload"
        relationship user FK "Relationship to BasicUsers (userType=platform), required, unique"
        select role "enum: admin, support, content-manager (default: support)"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    ClinicStaff {
        text id PK "UUID, auto by Payload"
        relationship user FK "Relationship to BasicUsers (userType=clinic), required, unique"
        relationship clinic FK "Relationship to Clinics, optional until assignment"
        select status "enum: pending, approved, rejected, default: pending"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    Patients {
        text id PK "UUID, auto by Payload"
        email email "Patient email, required, unique"
        text supabaseUserId "Supabase user id, unique, set by auth hook"
        text firstName "First name, required"
        text lastName "Last name, required"
        date dateOfBirth "Optional birth date"
        select gender "enum: male, female, other, not_specified"
        text phoneNumber "Optional contact number"
        text address "Optional street info"
        relationship country FK "Relationship to Countries"
        select language "enum: en, de, fr, es, ar, ru, zh (default: en)"
        upload profileImage FK "Relationship to UserProfileMedia"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    UserProfileMedia {
        text id PK "UUID, auto by Payload"
        text alt "Screen-reader text, required"
        richText caption "Optional caption"
        relationship user FK "Polymorphic relationship to BasicUsers or Patients, required"
        relationship createdBy FK "Uploader (BasicUsers or Patients), auto-set"
        text storagePath "Resolved storage path, readOnly"
        text prefix "S3 prefix, readOnly"
        upload file "User-owned image asset"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    ClinicApplications {
        text id PK "UUID, auto by Payload"
        text clinicName "Clinic label, required"
        text contactFirstName "Primary contact first name"
        text contactLastName "Primary contact last name"
        email contactEmail "Primary email, required"
        text contactPhone "Primary phone, optional"
        text addressStreet "Street name, required"
        text addressHouseNumber "House number, required"
        number addressZipCode "Zip/postal code, required"
        text addressCity "City, required"
        text addressCountry "Country, default: Turkey"
        textarea additionalNotes "Optional free-text notes"
        select status "enum: submitted, approved, rejected (platform managed)"
        textarea reviewNotes "Internal reviewer notes"
        relationship linkedClinic FK "Optional relationship to Clinics"
        relationship linkedBasicUser FK "Optional relationship to BasicUsers"
        relationship linkedClinicStaff FK "Optional relationship to ClinicStaff"
        date processedAt "Timestamp when materialized"
        text sourceIp "Captured submitter IP"
        text sourceUserAgent "Captured user agent"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    Clinics {
        text id PK "UUID, auto by Payload"
        text name "Clinic name, required"
        number averageRating "Readonly: aggregated from Reviews"
        richText description "Long-form clinic description"
        relationship tags FK "Relationship to Tags, hasMany"
        join treatments "Join to ClinicTreatments (treatment, price)"
        upload thumbnail FK "Relationship to ClinicMedia"
        relationship galleryEntries FK "Relationship to ClinicGalleryEntries, ordered list"
        point coordinates "Optional lat/long"
        text addressCountry "Country, default: Turkey"
        text addressStreet "Street name, required"
        text addressHouseNumber "House number, required"
        number addressZipCode "Zip code, required"
        relationship city FK "Relationship to Cities, required"
        text phoneNumber "Primary phone, required"
        email email "Primary email, required"
        text website "Public website URL"
        relationship accreditations FK "Relationship to Accreditation, hasMany"
        select status "enum: draft, pending, approved, rejected"
        select supportedLanguages "Select[], required (languageOptions)"
        text slug "System: generated from name"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    ClinicMedia {
        text id PK "UUID, auto by Payload"
        text alt "Screen-reader alt text, required"
        richText caption "Optional caption"
        relationship clinic FK "Relationship to Clinics, required"
        relationship createdBy FK "Uploader (BasicUsers), auto-set"
        text storagePath "Resolved storage path, readOnly"
        text prefix "S3 prefix, readOnly"
        upload file "Clinic-owned image asset"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    ClinicGalleryMedia {
        text id PK "UUID, auto by Payload"
        text alt "Screen-reader alt text, required"
        richText description "Optional context text"
        relationship clinic FK "Owning clinic, required"
        select status "enum: draft, published"
        date publishedAt "Auto-set when status=published"
        relationship createdBy FK "Uploader (BasicUsers), auto-set"
        text storageKey "Immutable storage key, unique"
        text storagePath "Resolved storage path, readOnly"
        text prefix "S3 prefix, readOnly"
        upload file "Gallery media image asset"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    ClinicGalleryEntries {
        text id PK "UUID, auto by Payload"
        relationship clinic FK "Owning clinic, required"
        text title "Internal title, required"
        relationship beforeMedia FK "Relationship to ClinicGalleryMedia"
        relationship afterMedia FK "Relationship to ClinicGalleryMedia"
        richText description "Optional story/summary"
        select status "enum: draft, published"
        date publishedAt "Auto-set when status=published"
        relationship createdBy FK "Curator (BasicUsers), auto-set"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    Doctors {
        text id PK "UUID, auto by Payload"
        select title "enum: dr, specialist, surgeon, assoc_prof, prof_dr"
        text firstName "Required given name"
        text lastName "Required family name"
        text fullName "Computed value, readonly"
        richText biography "Professional bio"
        upload profileImage FK "Relationship to DoctorMedia"
        relationship clinic FK "Primary clinic, required"
        array qualifications "Required textual list"
        number experienceYears "Optional years of experience"
        select languages "Select[], required (languageOptions)"
        number averageRating "Readonly: aggregated from Reviews"
        join treatments "Join to DoctorTreatments (treatment, specializationLevel)"
        join specialties "Join to DoctorSpecialties (medicalSpecialty, level, certifications)"
        text slug "System: generated from fullName"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    DoctorMedia {
        text id PK "UUID, auto by Payload"
        text alt "Screen-reader alt text, required"
        richText caption "Optional caption"
        relationship doctor FK "Owning doctor, required"
        relationship clinic FK "Derived clinic, readonly"
        relationship createdBy FK "Uploader (BasicUsers), auto-set"
        text storagePath "Resolved storage path, readOnly"
        text prefix "S3 prefix, readOnly"
        upload file "Doctor-owned image asset"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    DoctorTreatments {
        text id PK "UUID, auto by Payload"
        relationship doctor FK "Relationship to Doctors, required"
        relationship treatment FK "Relationship to Treatments, required"
        select specializationLevel "enum: general_practice, specialist, sub_specialist"
        number treatmentsPerformed "Future metric, readonly"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    DoctorSpecialties {
        text id PK "UUID, auto by Payload"
        relationship doctor FK "Relationship to Doctors, required"
        relationship medicalSpecialty FK "Relationship to MedicalSpecialties, required"
        select specializationLevel "enum: beginner, intermediate, advanced, expert, specialist"
        array certifications "Certifications array"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    MedicalSpecialties {
        text id PK "UUID, auto by Payload"
        text name "Specialty name, required"
        textarea description "Optional short description"
        relationship parentSpecialty FK "Self-reference for hierarchy"
        relationship icon FK "Relationship to PlatformContentMedia"
        join doctorLinks "Join to DoctorSpecialties"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    Treatments {
        text id PK "UUID, auto by Payload"
        text name "Treatment name, required"
        relationship tags FK "Relationship to Tags, hasMany"
        richText description "Detailed description, required"
        relationship medicalSpecialty FK "Relationship to MedicalSpecialties, required"
        number averagePrice "Readonly: computed from ClinicTreatments"
        number averageRating "Readonly: aggregated from Reviews"
        join clinics "Join to ClinicTreatments (clinic, price)"
        join doctors "Join to DoctorTreatments (doctor, specializationLevel)"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    ClinicTreatments {
        text id PK "UUID, auto by Payload"
        number price "Clinic price (USD), required"
        relationship clinic FK "Relationship to Clinics, required"
        relationship treatment FK "Relationship to Treatments, required"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    Tags {
        text id PK "UUID, auto by Payload"
        text name "Tag name, required"
        text slug "System: generated from name"
        join posts "Join to Posts"
        join clinics "Join to Clinics"
        join treatments "Join to Treatments"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    Categories {
        text id PK "UUID, auto by Payload"
        text title "Category title, required"
        text slug "System: generated from title"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    FavoriteClinics {
        text id PK "UUID, auto by Payload"
        relationship patient FK "Relationship to Patients, required"
        relationship clinic FK "Relationship to Clinics, required"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    Reviews {
        text id PK "UUID, auto by Payload"
        date reviewDate "Auto-set on create"
        relationship patient FK "Relationship to PlatformStaff (temporary), required"
        select status "enum: pending, approved, rejected"
        number starRating "1-5 rating, required"
        textarea comment "Review text, required"
        relationship clinic FK "Relationship to Clinics, required"
        relationship doctor FK "Relationship to Doctors, required"
        relationship treatment FK "Relationship to Treatments, required"
        date lastEditedAt "Audit timestamp, readonly"
        text editedByName "Editor display name"
        relationship editedBy FK "Relationship to BasicUsers"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    Countries {
        text id PK "UUID, auto by Payload"
        text name "Country name, required"
        text isoCode "ISO alpha-2 code, required"
        text language "Primary language, required"
        text currency "Currency code, required"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    Cities {
        text id PK "UUID, auto by Payload"
        text name "City name, required"
        text airportcode "Optional IATA code"
        point coordinates "Required lat/long"
        relationship country FK "Relationship to Countries, required"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    Accreditation {
        text id PK "UUID, auto by Payload"
        text name "Accreditation name, required"
        text abbreviation "Abbreviation, required"
        text country "Issuing country, required"
        richText description "Details, required"
        relationship icon FK "Relationship to PlatformContentMedia"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    PlatformContentMedia {
        text id PK "UUID, auto by Payload"
        text alt "Screen-reader alt text, required"
        richText caption "Optional caption"
        relationship createdBy FK "Uploader (BasicUsers), auto-set"
        text storagePath "Resolved storage path, readOnly"
        text prefix "S3 prefix, readOnly"
        upload file "Platform-managed media asset"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    Posts {
        text id PK "UUID, auto by Payload"
        text title "Post title, required"
        text slug "System: generated, unique"
        relationship tags FK "Relationship to Tags, hasMany"
        upload heroImage FK "Relationship to PlatformContentMedia"
        richText content "Article rich text, required"
        text excerpt "SEO/meta summary, required"
        relationship relatedPosts FK "Self-relationship, hasMany"
        relationship categories FK "Relationship to Categories, hasMany"
        text metaTitle "SEO title"
        text metaDescription "SEO description"
        upload metaImage FK "Relationship to PlatformContentMedia"
        date publishedAt "Optional publish date"
        relationship authors FK "Relationship to PlatformStaff, hasMany"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    Pages {
        text id PK "UUID, auto by Payload"
        text title "Page title, required"
        blocks layout "CMS blocks: CallToAction, Content, MediaBlock, Archive, FormBlock"
        text metaTitle "SEO title"
        text metaDescription "SEO description"
        upload metaImage FK "Relationship to PlatformContentMedia"
        date publishedAt "Optional publish time"
        text slug "System: generated from title"
        date createdAt "System: timestamps: true"
        date updatedAt "System: timestamps: true"
    }

    %% Relationships
    BasicUsers ||--o{ PlatformStaff : "has platform profile"
    BasicUsers ||--o{ ClinicStaff : "has clinic profile"
    BasicUsers }o--|| UserProfileMedia : "profile image"
    BasicUsers ||--o{ ClinicGalleryEntries : "createdBy"
    BasicUsers ||--o{ ClinicGalleryMedia : "createdBy"
    BasicUsers ||--o{ ClinicMedia : "createdBy"
    BasicUsers ||--o{ DoctorMedia : "createdBy"
    BasicUsers ||--o{ PlatformContentMedia : "createdBy"

    Patients }o--|| Countries : "resides in"
    Patients ||--o{ FavoriteClinics : "saves"
    Patients ||--o{ UserProfileMedia : "owns media"

    ClinicStaff }o--|| Clinics : "assigned to"

    ClinicApplications }o--o{ Clinics : "linkedRecords.clinic"
    ClinicApplications }o--o{ BasicUsers : "linkedRecords.basicUser"
    ClinicApplications }o--o{ ClinicStaff : "linkedRecords.clinicStaff"

    Clinics ||--o{ Doctors : "employs"
    Clinics ||--o{ ClinicTreatments : "offers"
    Clinics ||--o{ Reviews : "receives"
    Clinics ||--o{ FavoriteClinics : "is favorited"
    Clinics }o--|| Cities : "located in"
    Clinics }o--o{ Tags : "tagged with"
    Clinics }o--o{ Accreditation : "holds"
    Clinics }o--o{ ClinicGalleryEntries : "owns gallery entries"
    Clinics }o--o{ ClinicGalleryMedia : "owns gallery media"
    Clinics }o--o{ ClinicMedia : "owns media"

    ClinicGalleryEntries }o--|| ClinicGalleryMedia : "beforeMedia"
    ClinicGalleryEntries }o--|| ClinicGalleryMedia : "afterMedia"

    Doctors }o--|| Clinics : "works at"
    Doctors ||--o{ DoctorTreatments : "performs"
    Doctors ||--o{ DoctorSpecialties : "specializes"
    Doctors ||--o{ Reviews : "is reviewed"
    Doctors }o--o{ DoctorMedia : "profile image"
    DoctorMedia }o--|| Clinics : "derived clinic ownership"

    MedicalSpecialties ||--o{ MedicalSpecialties : "parent of"
    MedicalSpecialties ||--o{ Treatments : "includes"
    MedicalSpecialties ||--o{ DoctorSpecialties : "practiced by"
    MedicalSpecialties }o--|| PlatformContentMedia : "icon"

    Treatments ||--o{ ClinicTreatments : "priced at clinics"
    Treatments ||--o{ DoctorTreatments : "performed by"
    Treatments ||--o{ Reviews : "reviewed"
    Treatments }o--o{ Tags : "tagged"
    Treatments }o--|| MedicalSpecialties : "belongs to"

    Tags }o--o{ Posts : "categorizes posts"
    Tags }o--o{ Clinics : "categorizes clinics"
    Tags }o--o{ Treatments : "categorizes treatments"

    Categories }o--o{ Posts : "categorizes posts"

    PlatformStaff ||--o{ Posts : "authors"
    PlatformStaff ||--o{ Reviews : "stored as patient (current implementation)"

    Posts ||--o{ Posts : "related posts"
    Posts }o--|| PlatformContentMedia : "hero/meta image"
    Pages }o--|| PlatformContentMedia : "meta image"
    MedicalSpecialties }o--|| PlatformContentMedia : "icon asset"
    Accreditation }o--|| PlatformContentMedia : "icon asset"
    Doctors }o--|| DoctorMedia : "profileImage"
    Clinics }o--|| ClinicMedia : "thumbnail"

    Reviews ||--|| Clinics : "references clinic"
    Reviews ||--|| Doctors : "references doctor"
    Reviews ||--|| Treatments : "references treatment"

    FavoriteClinics ||--|| Clinics : "references clinic"

    Countries ||--o{ Cities : "has cities"
```
