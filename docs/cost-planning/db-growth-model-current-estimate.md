# Current Estimate: Database Growth Model (Türkiye, 600 Clinics)

## Scope

Estimate timestamp: 2026-09-07.

This document estimates PostgreSQL growth for the current data model under a Türkiye-only clinic market (`600 clinics` max). It includes:

- Collection growth by `Low / Med / High` scenario
- Historical versions for `posts` and `pages`
- Moderate retention overhead for mutable collections
- A fixed baseline data block that does not scale linearly with clinic count

Out of scope:

- Binary image/video file bytes (covered in `media-growth-model-current-estimate.md`)
- Network egress/CDN costs
- Multi-country expansion effects

## Scenario Defaults

| Parameter | Low | Med | High |
| --- | ---: | ---: | ---: |
| clinics | 600 | 600 | 600 |
| doctors_per_clinic | 4 | 8 | 15 |
| reviews_per_clinic | 20 | 80 | 240 |
| clinic_treatments_per_clinic | 12 | 30 | 55 |
| doctor_treatments_per_doctor | 2 | 4 | 6 |
| doctor_specialties_per_doctor | 1 | 2 | 3 |
| clinic_staff_users_per_clinic | 1 | 2 | 4 |
| posts_total | 60 | 180 | 420 |
| pages_total | 8 | 15 | 30 |
| versions_per_post_or_page | 4 | 8 | 20 |
| retention_factor | 1.10 | 1.15 | 1.25 |

Model constants:

- `db_overhead_factor = 2.2`
- `fixed_platform_staff = 8`
- `versions_per_post_or_page` is bounded by technical cap `maxPerDoc: 50`

## 3-Year Adoption Overlay (Reference Dimension)

This section adds a time-axis view without replacing the base capacity model.  
Source reference: [Notion forecast page](https://www.notion.so/32b283c73e61803697c9dc59b82bae32) (fetched via MCP, snapshot timestamp `2026-03-22`).

Scenario mapping:

- `Low` ↔ Notion `Conservative`
- `Med` ↔ Notion `Realistic`
- `High` ↔ Notion `Optimistic`

Notion reference inputs:

| Mapped Scenario | Year 1 Users | Year 2 Users | Year 3 Users | Year 1 Clinics | Year 2 Clinics | Year 3 Clinics |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Low | 12000 | 35000 | 80000 | 30 | 55 | 90 |
| Med | 25000 | 75000 | 180000 | 50 | 100 | 160 |
| High | 50000 | 150000 | 350000 | 80 | 170 | 260 |

Overlay rules:

- Clinic-linked collections scale with Notion `active clinics` (`clinics`, `doctors`, `reviews`, treatment joins, clinic staff).
- `posts` and `pages` are scaled by `user_multiplier = users_year_n / users_year_3` within each scenario.
- Historical versions and retention logic follow the same assumptions.

### 3-Year Trajectory (DB Rows and Size)

| Scenario | Year | Active Clinics | Forecast Users | Derived Doctors | Derived Reviews | Derived Posts | Derived Pages | Estimated DB Total MB (incl. baseline) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Low | 1 | 30 | 12000 | 120 | 600 | 9 | 1 | 1.43 |
| Low | 2 | 55 | 35000 | 220 | 1100 | 26 | 4 | 3.05 |
| Low | 3 | 90 | 80000 | 360 | 1800 | 60 | 8 | 5.74 |
| Med | 1 | 50 | 25000 | 400 | 4000 | 25 | 2 | 7.67 |
| Med | 2 | 100 | 75000 | 800 | 8000 | 75 | 6 | 17.32 |
| Med | 3 | 160 | 180000 | 1280 | 12800 | 180 | 15 | 32.64 |
| High | 1 | 80 | 50000 | 1200 | 19200 | 60 | 4 | 37.81 |
| High | 2 | 170 | 150000 | 2550 | 40800 | 180 | 13 | 90.33 |
| High | 3 | 260 | 350000 | 3900 | 62400 | 420 | 30 | 165.59 |

Note: This overlay reflects an adoption trajectory over 3 years and stays intentionally below the `600-clinic` max-capacity planning envelope of this document.

## Formulas

```text
retention_rows = round(active_rows * (retention_factor - 1))
historical_rows_posts_or_pages = active_rows * versions_per_post_or_page

estimated_mb = (active_rows + historical_rows + retention_rows)
               * avg_row_bytes
               * db_overhead_factor
               / 1024^2
```


## Average Row Size Assumptions

| Collection | avg_row_bytes |
| --- | ---: |
| clinics | 1030 |
| doctors | 250 |
| reviews | 360 |
| clinictreatments | 160 |
| doctortreatments | 180 |
| doctorspecialties | 185 |
| clinicStaff | 150 |
| platformStaff | 120 |
| posts | 4084 |
| pages | 2500 |
| countries | 120 |
| cities | 176 |
| treatments | 533 |
| tags | 72 |
| categories | 77 |
| accreditation | 468 |
| medical-specialties | 291 |
| globals (header+footer) | 899 |

## Collection-Centric Growth

### Low Scenario

| Collection | Active Rows | Historical Rows | Retention Rows | Estimated MB | Growth Driver |
| --- | ---: | ---: | ---: | ---: | --- |
| clinics | 600 | 0 | 60 | 1.43 | clinics |
| doctors | 2400 | 0 | 240 | 1.38 | clinics * doctors_per_clinic |
| reviews | 12000 | 0 | 1200 | 9.97 | clinics * reviews_per_clinic |
| clinictreatments | 7200 | 0 | 720 | 2.66 | clinics * clinic_treatments_per_clinic |
| doctortreatments | 4800 | 0 | 480 | 1.99 | doctors * doctor_treatments_per_doctor |
| doctorspecialties | 2400 | 0 | 240 | 1.02 | doctors * doctor_specialties_per_doctor |
| clinicStaff | 600 | 0 | 60 | 0.21 | clinics * clinic_staff_users_per_clinic |
| platformStaff | 8 | 0 | 1 | 0.00 | fixed platform operations team |
| posts | 60 | 240 | 6 | 2.62 | posts_total |
| pages | 8 | 32 | 1 | 0.22 | pages_total |
| **Dynamic total** |  |  |  | **21.51** |  |

### Med Scenario

| Collection | Active Rows | Historical Rows | Retention Rows | Estimated MB | Growth Driver |
| --- | ---: | ---: | ---: | ---: | --- |
| clinics | 600 | 0 | 90 | 1.49 | clinics |
| doctors | 4800 | 0 | 720 | 2.90 | clinics * doctors_per_clinic |
| reviews | 48000 | 0 | 7200 | 41.69 | clinics * reviews_per_clinic |
| clinictreatments | 18000 | 0 | 2700 | 6.95 | clinics * clinic_treatments_per_clinic |
| doctortreatments | 19200 | 0 | 2880 | 8.34 | doctors * doctor_treatments_per_doctor |
| doctorspecialties | 9600 | 0 | 1440 | 4.29 | doctors * doctor_specialties_per_doctor |
| clinicStaff | 1200 | 0 | 180 | 0.43 | clinics * clinic_staff_users_per_clinic |
| platformStaff | 8 | 0 | 1 | 0.00 | fixed platform operations team |
| posts | 180 | 1440 | 27 | 14.11 | posts_total |
| pages | 15 | 120 | 2 | 0.72 | pages_total |
| **Dynamic total** |  |  |  | **80.92** |  |

### High Scenario

| Collection | Active Rows | Historical Rows | Retention Rows | Estimated MB | Growth Driver |
| --- | ---: | ---: | ---: | ---: | --- |
| clinics | 600 | 0 | 150 | 1.62 | clinics |
| doctors | 9000 | 0 | 2250 | 5.90 | clinics * doctors_per_clinic |
| reviews | 144000 | 0 | 36000 | 135.96 | clinics * reviews_per_clinic |
| clinictreatments | 33000 | 0 | 8250 | 13.85 | clinics * clinic_treatments_per_clinic |
| doctortreatments | 54000 | 0 | 13500 | 25.49 | doctors * doctor_treatments_per_doctor |
| doctorspecialties | 27000 | 0 | 6750 | 13.10 | doctors * doctor_specialties_per_doctor |
| clinicStaff | 2400 | 0 | 600 | 0.94 | clinics * clinic_staff_users_per_clinic |
| platformStaff | 8 | 0 | 2 | 0.00 | fixed platform operations team |
| posts | 420 | 8400 | 105 | 76.47 | posts_total |
| pages | 30 | 600 | 8 | 3.35 | pages_total |
| **Dynamic total** |  |  |  | **276.68** |  |

## Fixed Baseline (Non-Linear Block)

These rows are modeled as fixed reference data and are not multiplied by clinic count.

| Collection | Fixed Rows | Estimated MB | Growth Factor |
| --- | ---: | ---: | --- |
| countries | 1 | 0.000 | fixed baseline |
| cities | 5 | 0.002 | fixed baseline |
| treatments | 39 | 0.044 | fixed baseline |
| tags | 6 | 0.001 | fixed baseline |
| categories | 5 | 0.001 | fixed baseline |
| accreditation | 1 | 0.001 | fixed baseline |
| medical-specialties | 22 | 0.013 | fixed baseline |
| globals (header+footer) | 2 | 0.004 | fixed baseline |
| **Baseline total** |  | **0.066 MB** |  |

Naming note: the Payload collection slug is `accreditation` (singular), and this document uses that canonical name consistently.

## Centric Views

| Scenario | Clinic-Centric MB | Page/Post-Centric MB | User-Centric MB | Dynamic MB | Baseline MB | Total MB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Low | 18.46 | 2.83 | 0.21 | 21.50 | 0.066 | 21.57 |
| Med | 65.65 | 14.84 | 0.44 | 80.92 | 0.066 | 80.99 |
| High | 195.92 | 79.82 | 0.94 | 276.68 | 0.066 | 276.75 |

Centric definitions:

- Clinic-centric: `clinics`, `doctors`, `reviews`, `clinictreatments`, `doctortreatments`, `doctorspecialties`
- Page/Post-centric: `posts`, `pages`
- User-centric: `clinicStaff`, `platformStaff`

## Consistency Checks

### Totals Check

| Scenario | Dynamic MB (Exact) | Baseline MB (Exact) | Dynamic + Baseline (Exact) | Total MB (Exact) | Match |
| --- | ---: | ---: | ---: | ---: | --- |
| Low | 21.505532 | 0.065611 | 21.571143 | 21.571143 | Yes |
| Med | 80.919782 | 0.065611 | 80.985393 | 80.985393 | Yes |
| High | 276.684026 | 0.065611 | 276.749637 | 276.749637 | Yes |

## Seed Plausibility Check

### Row-Size Calibration Against Seed Data

| Collection | Seed Avg Compact JSON Bytes | Model avg_row_bytes | Delta |
| --- | ---: | ---: | ---: |
| clinics | 1028.8 | 1030 | +0.1% |
| doctors | 248.4 | 250 | +0.6% |
| reviews | 361.3 | 360 | -0.4% |
| clinictreatments | 157.4 | 160 | +1.7% |
| doctortreatments | 178.7 | 180 | +0.7% |
| doctorspecialties | 183.1 | 185 | +1.0% |
| posts | 4083.5 | 4084 | +0.0% |
| treatments | 533.2 | 533 | -0.0% |
| medical-specialties | 290.9 | 291 | +0.0% |

### 10-Clinic Demo Density vs Low Scenario Density

| Metric | Demo Seed (10 Clinics) | Low Model @10 Clinics | Difference |
| --- | ---: | ---: | ---: |
| doctors | 10 | 40 | +300% |
| reviews | 18 | 200 | +1011% |
| clinictreatments | 30 | 120 | +300% |
| doctortreatments | 20 | 80 | +300% |
| doctorspecialties | 10 | 40 | +300% |

Interpretation: demo seed is intentionally sparse; the `Low` scenario already models a denser production footprint.

## Optional Extension Collections (Not in Main Totals)

| Collection | Suggested Driver | Reason Excluded from Main Total |
| --- | --- | --- |
| favoriteclinics | `patients * favorites_per_patient` | feature still low-volume in current seed |
| patients | `registered_patients` | no stable growth target provided |
| clinicApplications | `clinic_onboarding_attempts` | intake funnel can exceed accepted clinics |
| forms | fixed + marketing expansion | mostly operational content, low DB footprint |
| form-submissions | `submissions_per_form` | campaign-dependent and non-clinic-linear |
| redirects | `url_changes_per_release` | release-process dependent |

No public API or schema changes are introduced by this plan document.

## Assumptions and Confidence

Assumptions:

- Estimates target Supabase PostgreSQL growth for current product data only.
- Image/object storage is modeled separately in `media-growth-model-current-estimate.md`.
- Egress/CDN/network costs are intentionally excluded.
- Türkiye-only market (`600 clinics`) is fixed for this model.

Confidence:

- High for internal growth mechanics (`versions`, `retention`) because assumptions are directly mapped to the current model and seed structure.
