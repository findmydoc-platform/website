# Cost Plan MVP: Media Growth Model (Turkey, 600 Clinics)

## Scope

This document estimates image growth for the current MVP media scope and splits:

- Object storage bytes (original + generated derivatives)
- PostgreSQL metadata bytes for media collections

In scope collections:

- `clinicMedia`
- `clinicGalleryMedia`
- `doctorMedia`
- `platformContentMedia`
- `userProfileMedia`

Out of scope:

- DICOM / X-ray / radiology imaging
- Video files and video streaming
- Any media type not currently supported by the existing collections

## Scenario Defaults

### Structural Growth Inputs

| Parameter | Low | Med | High |
|---|---:|---:|---:|
| clinics | 600 | 600 | 600 |
| doctors_per_clinic | 4 | 8 | 15 |
| clinic_staff_users_per_clinic | 1 | 2 | 4 |
| posts_total | 60 | 180 | 420 |
| pages_total | 8 | 15 | 30 |
| clinicMedia_per_clinic | 6 | 15 | 30 |
| clinicGalleryEntries_per_clinic | 4 | 12 | 30 |
| clinicGalleryMedia_per_entry | 2 | 2 | 2 |
| doctorMedia_per_doctor | 1 | 1 | 2 |
| platformContentMedia_per_post | 2 | 4 | 8 |
| platformContentMedia_per_page | 1 | 3 | 6 |
| userProfileMedia_per_user | 0.6 | 0.8 | 1.0 |

### Storage Inputs

| Parameter | Low | Med | High |
|---|---:|---:|---:|
| avg_original_mb | 0.35 | 0.75 | 1.50 |
| derivative_multiplier | 2.0 | 2.6 | 3.2 |

Constants:

- `fixed_platform_staff = 8`
- `baseline_platform_content_media = 22` (reference from baseline seed)
- Upload hard limit is `5 MB` per file in config ([payload.config.ts](../../src/payload.config.ts))

## Formulas

```text
object_storage_mb = image_count * avg_original_mb * derivative_multiplier

db_metadata_mb = metadata_rows * avg_metadata_row_bytes * db_overhead_factor / 1024^2
```

`db_overhead_factor = 2.2`

## Metadata Row Size Assumptions

| Collection | avg_metadata_row_bytes | Calibration Source |
|---|---:|---|
| clinicMedia | 211 | demo seed average (`210.5`) |
| clinicGalleryMedia | 295 | inferred from schema (status + publishedAt + storageKey + relationships) |
| doctorMedia | 230 | inferred from schema (doctor + clinic + uploader + storage fields) |
| platformContentMedia | 214 | baseline seed average (`214.2`) |
| userProfileMedia | 309 | demo seed average (`309.0`) |

## Media Collection Growth

### Low Scenario

| Collection | Image Count | Metadata Rows | Object MB | Object GB | DB Metadata MB | Driver |
|---|---:|---:|---:|---:|---:|---|
| clinicMedia | 3600 | 3600 | 2520.00 | 2.46 | 1.594 | clinics * clinicMedia_per_clinic |
| clinicGalleryMedia | 4800 | 4800 | 3360.00 | 3.28 | 2.971 | clinicGalleryEntries_per_clinic * 2 |
| doctorMedia | 2400 | 2400 | 1680.00 | 1.64 | 1.158 | doctors * doctorMedia_per_doctor |
| platformContentMedia | 150 | 150 | 105.00 | 0.10 | 0.067 | baseline + posts/pages media usage |
| userProfileMedia | 365 | 365 | 255.50 | 0.25 | 0.237 | users * userProfileMedia_per_user |
| **Total** | **11315** | **11315** | **7920.50** | **7.73** | **6.03** |  |

### Med Scenario

| Collection | Image Count | Metadata Rows | Object MB | Object GB | DB Metadata MB | Driver |
|---|---:|---:|---:|---:|---:|---|
| clinicMedia | 9000 | 9000 | 17550.00 | 17.14 | 3.984 | clinics * clinicMedia_per_clinic |
| clinicGalleryMedia | 14400 | 14400 | 28080.00 | 27.42 | 8.913 | clinicGalleryEntries_per_clinic * 2 |
| doctorMedia | 4800 | 4800 | 9360.00 | 9.14 | 2.316 | doctors * doctorMedia_per_doctor |
| platformContentMedia | 787 | 787 | 1534.65 | 1.50 | 0.353 | baseline + posts/pages media usage |
| userProfileMedia | 966 | 966 | 1883.70 | 1.84 | 0.626 | users * userProfileMedia_per_user |
| **Total** | **29953** | **29953** | **58408.35** | **57.04** | **16.19** |  |

### High Scenario

| Collection | Image Count | Metadata Rows | Object MB | Object GB | DB Metadata MB | Driver |
|---|---:|---:|---:|---:|---:|---|
| clinicMedia | 18000 | 18000 | 86400.00 | 84.38 | 7.969 | clinics * clinicMedia_per_clinic |
| clinicGalleryMedia | 36000 | 36000 | 172800.00 | 168.75 | 22.282 | clinicGalleryEntries_per_clinic * 2 |
| doctorMedia | 18000 | 18000 | 86400.00 | 84.38 | 8.686 | doctors * doctorMedia_per_doctor |
| platformContentMedia | 3562 | 3562 | 17097.60 | 16.70 | 1.599 | baseline + posts/pages media usage |
| userProfileMedia | 2408 | 2408 | 11558.40 | 11.29 | 1.561 | users * userProfileMedia_per_user |
| **Total** | **77970** | **77970** | **374256.00** | **365.48** | **42.10** |  |

## Summary Metrics

| Scenario | Total Object Storage MB | Total Object Storage GB | DB Metadata MB | Object MB per Clinic | Metadata MB per Clinic |
|---|---:|---:|---:|---:|---:|
| Low | 7920.50 | 7.73 | 6.03 | 13.20 | 0.010 |
| Med | 58408.35 | 57.04 | 16.19 | 97.35 | 0.027 |
| High | 374256.00 | 365.48 | 42.10 | 623.76 | 0.070 |

## 3-Year Adoption Overlay (Reference Dimension)

This section adds a time-axis projection (adoption over 3 years) without replacing base `Low/Med/High` capacity assumptions.  
Source reference: [Notion forecast page](https://www.notion.so/32b283c73e61803697c9dc59b82bae32) (fetched via MCP, snapshot timestamp `2026-03-22`).

Scenario mapping:

- `Low` ↔ Notion `Conservative`
- `Med` ↔ Notion `Realistic`
- `High` ↔ Notion `Optimistic`

Overlay rules:

- Clinic-linked media (`clinicMedia`, `clinicGalleryMedia`, `doctorMedia`) scales with Notion active clinic growth.
- `platformContentMedia` scales with scenario `user_multiplier = users_year_n / users_year_3`, plus fixed baseline media.
- `userProfileMedia` scales with derived active users (`clinic staff users + fixed platform staff`).
- Storage formulas and per-scenario image-size assumptions remain unchanged.

### 3-Year Trajectory (Image Count and Storage)

| Scenario | Year | Active Clinics | Forecast Users | Total Images | Object Storage GB | DB Metadata MB |
|---|---:|---:|---:|---:|---:|---:|
| Low | 1 | 30 | 12000 | 604 | 0.41 | 0.32 |
| Low | 2 | 55 | 35000 | 1106 | 0.76 | 0.58 |
| Low | 3 | 90 | 80000 | 1829 | 1.25 | 0.96 |
| Med | 1 | 50 | 25000 | 2564 | 4.88 | 1.38 |
| Med | 2 | 100 | 75000 | 5207 | 9.92 | 2.80 |
| Med | 3 | 160 | 180000 | 8569 | 16.32 | 4.58 |
| High | 1 | 80 | 50000 | 10456 | 49.01 | 5.64 |
| High | 2 | 170 | 150000 | 22627 | 106.06 | 12.17 |
| High | 3 | 260 | 350000 | 35810 | 167.86 | 19.15 |

Note: The adoption overlay is intentionally separate from the `600 clinics` max-capacity planning layer and should be read as a trajectory reference, not as a replacement.

## Consistency Checks

### Section Sum Consistency (Exact, Unrounded)

| Scenario | Object MB (Sum of Collections) | Object MB (Reported Total) | Match | Metadata MB (Sum of Collections) | Metadata MB (Reported Total) | Match |
|---|---:|---:|---|---:|---:|---|
| Low | 7920.500 | 7920.500 | Yes | 6.026713 | 6.026713 | Yes |
| Med | 58408.350 | 58408.350 | Yes | 16.192824 | 16.192824 | Yes |
| High | 374256.000 | 374256.000 | Yes | 42.096661 | 42.096661 | Yes |

## Competitor Research and Mapping

| Source | Observed Media Pattern | Mapping to Current Collections | Confidence |
|---|---|---|---|
| [Bookimed clinics overview](https://us-uk.bookimed.com/clinics/) | Large clinic listings with image-heavy cards, ratings, doctor snippets, and clinic detail entry points. | `clinicMedia` for listing/gallery visuals, `doctorMedia` for doctor cards. | High |
| [Bookimed clinic example](https://us-uk.bookimed.com/clinic/westdent-clinic/) | Explicit gallery behavior (`Show all photos`), dedicated `Before & after photos (111)`, doctor cards, certificates, and patient review media blocks. | `clinicMedia` + `clinicGalleryEntries` + `clinicGalleryMedia` + `doctorMedia`; certificate/static assets fit `platformContentMedia` if centrally managed. | High |
| [FlyMedi clinic example](https://www.flymedi.com/id-clinic/745) | Clinic detail pages with image carousel previews (multiple lead images), review tab, staff tab with doctor portraits, and treatment detail pages. | `clinicMedia` for clinic photos, `doctorMedia` for staff portraits, `platformContentMedia` for static explanatory assets. | High |
| [FlyMedi clinic example 2](https://www.flymedi.com/cyberknife-center/58) | Same pattern across another clinic page: preview images + clinic details + review indicators + contact-focused CTA blocks. | Confirms reusable clinic-gallery baseline for `clinicMedia` and recurring staff/brand visuals. | High |
| [WhatClinic clinic example](https://www.whatclinic.com/cosmetic-plastic-surgery/turkey/antalya-province/antalya/aesthetics-antalya) | Crawled snippets indicate image-backed clinic profiles with review-centric presentation and service metadata. | `clinicMedia` as primary fit; no reliable evidence for structured before/after volume in current crawl. | Medium-Low |
| [WhatClinic clinic example 2](https://www.whatclinic.com/bariatric-surgery/turkey/istanbul-province/istanbul/atasehir/clinichub) | Crawled snippets show repeated `Image:` entities and badge/service-heavy profile presentation. | `clinicMedia` + optional `platformContentMedia` for standardized badges/icons. | Medium-Low |
| [WhatClinic photo guidance](https://www.whatclinic.com/info/for-clinics/industry-news/how-to-take-clinic-photos) | Intended policy/guidance source for clinic photography quality. Direct content retrieval was limited in this crawl run. | Use as qualitative direction only; do not treat as hard quantitative input. | Low |

Notes:

- Bookimed and FlyMedi provide strong evidence for gallery-driven clinic pages and before/after-heavy aesthetic verticals.
- WhatClinic evidence is partially snippet-based due to retrieval constraints, so estimates using WhatClinic patterns are intentionally discounted.

## Seed Plausibility Notes

| Metric | Demo Seed Signal | Model Interpretation |
|---|---|---|
| clinicMedia density | `10 images / 10 clinics` (1 per clinic) | planning baseline starts at `6 per clinic` (production-ready content uplift) |
| platformContentMedia footprint | `22 baseline + 6 demo` | scenario includes larger post/page editorial growth |
| userProfileMedia | very sparse in seed | modeled from clinic staff growth + fixed platform staff |

No public API or schema changes are introduced by this plan document.

## Assumptions and Confidence

Assumptions:

- This model estimates only image/object storage and media metadata rows.
- Network egress/CDN transfer is intentionally excluded.
- Unsupported media types (DICOM, radiology/X-ray, video) remain out of scope.

Confidence:

- High for internal media row/object calculations because formulas and growth drivers map directly to collection structure.
- Medium for competitor-derived image-density calibration overall.
- Medium-Low for WhatClinic-specific detail due partial snippet-based evidence.
