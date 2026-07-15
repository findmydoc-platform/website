import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $migration$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM "basic_users" AS legacy
        LEFT JOIN "platform_staff" AS platform_principal ON platform_principal."user_id" = legacy."id"
        LEFT JOIN "clinic_staff" AS clinic_principal ON clinic_principal."user_id" = legacy."id"
        WHERE (legacy."user_type" = 'platform' AND (platform_principal."id" IS NULL OR clinic_principal."id" IS NOT NULL))
           OR (legacy."user_type" = 'clinic' AND (clinic_principal."id" IS NULL OR platform_principal."id" IS NOT NULL))
      ) THEN
        RAISE EXCEPTION 'Direct staff auth contract aborted: a legacy staff identity does not map exactly once to its direct principal collection';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM "platform_staff" AS principal
        LEFT JOIN "basic_users" AS legacy ON legacy."id" = principal."user_id"
        WHERE principal."user_id" IS NOT NULL
          AND (legacy."id" IS NULL OR legacy."user_type" <> 'platform')
      ) OR EXISTS (
        SELECT 1
        FROM "clinic_staff" AS principal
        LEFT JOIN "basic_users" AS legacy ON legacy."id" = principal."user_id"
        WHERE principal."user_id" IS NOT NULL
          AND (legacy."id" IS NULL OR legacy."user_type" <> 'clinic')
      ) THEN
        RAISE EXCEPTION 'Direct staff auth contract aborted: a direct staff principal has an invalid legacy identity link';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM "posts_rels" AS relation
        LEFT JOIN "platform_staff" AS principal ON principal."user_id" = relation."basic_users_id"
        WHERE relation."basic_users_id" IS NOT NULL
          AND (principal."id" IS NULL OR relation."platform_staff_id" IS DISTINCT FROM principal."id")
      ) OR EXISTS (
        SELECT 1
        FROM "_posts_v_rels" AS relation
        LEFT JOIN "platform_staff" AS principal ON principal."user_id" = relation."basic_users_id"
        WHERE relation."basic_users_id" IS NOT NULL
          AND (principal."id" IS NULL OR relation."platform_staff_id" IS DISTINCT FROM principal."id")
      ) THEN
        RAISE EXCEPTION 'Direct staff auth contract aborted: a post author relation does not match its PlatformStaff target';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM "platform_content_media" AS media
        LEFT JOIN "platform_staff" AS principal ON principal."user_id" = media."legacy_created_by_id"
        WHERE media."legacy_created_by_id" IS NOT NULL
          AND (principal."id" IS NULL OR media."created_by_id" IS DISTINCT FROM principal."id")
      ) OR EXISTS (
        SELECT 1
        FROM "patient_clinic_inquiries" AS inquiry
        LEFT JOIN "platform_staff" AS principal ON principal."user_id" = inquiry."legacy_assigned_to_id"
        WHERE inquiry."legacy_assigned_to_id" IS NOT NULL
          AND (principal."id" IS NULL OR inquiry."assigned_to_id" IS DISTINCT FROM principal."id")
      ) OR EXISTS (
        SELECT 1
        FROM "reviews" AS review
        LEFT JOIN "platform_staff" AS principal ON principal."user_id" = review."legacy_edited_by_id"
        WHERE review."legacy_edited_by_id" IS NOT NULL
          AND (principal."id" IS NULL OR review."edited_by_id" IS DISTINCT FROM principal."id")
      ) THEN
        RAISE EXCEPTION 'Direct staff auth contract aborted: a platform-only actor relation does not match its PlatformStaff target';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM "payload_preferences_rels" AS relation
        LEFT JOIN "platform_staff" AS platform_principal ON platform_principal."user_id" = relation."legacy_basic_users_id"
        LEFT JOIN "clinic_staff" AS clinic_principal ON clinic_principal."user_id" = relation."legacy_basic_users_id"
        WHERE relation."legacy_basic_users_id" IS NOT NULL
          AND (
            (platform_principal."id" IS NULL AND clinic_principal."id" IS NULL)
            OR (platform_principal."id" IS NOT NULL AND clinic_principal."id" IS NOT NULL)
            OR (
              platform_principal."id" IS NOT NULL
              AND (
                relation."platform_staff_id" IS DISTINCT FROM platform_principal."id"
                OR relation."clinic_staff_id" IS NOT NULL
              )
            )
            OR (
              clinic_principal."id" IS NOT NULL
              AND (
                relation."clinic_staff_id" IS DISTINCT FROM clinic_principal."id"
                OR relation."platform_staff_id" IS NOT NULL
              )
            )
          )
      ) OR EXISTS (
        SELECT 1
        FROM "user_profile_media_rels" AS relation
        LEFT JOIN "platform_staff" AS platform_principal ON platform_principal."user_id" = relation."basic_users_id"
        LEFT JOIN "clinic_staff" AS clinic_principal ON clinic_principal."user_id" = relation."basic_users_id"
        WHERE relation."basic_users_id" IS NOT NULL
          AND (
            (platform_principal."id" IS NULL AND clinic_principal."id" IS NULL)
            OR (platform_principal."id" IS NOT NULL AND clinic_principal."id" IS NOT NULL)
            OR (
              platform_principal."id" IS NOT NULL
              AND (
                relation."platform_staff_id" IS DISTINCT FROM platform_principal."id"
                OR relation."clinic_staff_id" IS NOT NULL
              )
            )
            OR (
              clinic_principal."id" IS NOT NULL
              AND (
                relation."clinic_staff_id" IS DISTINCT FROM clinic_principal."id"
                OR relation."platform_staff_id" IS NOT NULL
              )
            )
          )
      ) THEN
        RAISE EXCEPTION 'Direct staff auth contract aborted: a polymorphic staff relation does not match its direct principal target';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM "clinic_media" AS source
        LEFT JOIN "platform_staff" AS platform_principal ON platform_principal."user_id" = source."created_by_id"
        LEFT JOIN "clinic_staff" AS clinic_principal ON clinic_principal."user_id" = source."created_by_id"
        WHERE source."created_by_id" IS NOT NULL
          AND (
            (platform_principal."id" IS NULL AND clinic_principal."id" IS NULL)
            OR (platform_principal."id" IS NOT NULL AND clinic_principal."id" IS NOT NULL)
            OR (
              SELECT count(*)
              FROM "clinic_media_rels" AS target
              WHERE target."parent_id" = source."id" AND target."path" = 'createdBy'
            ) <> 1
            OR (
              SELECT count(*)
              FROM "clinic_media_rels" AS target
              WHERE target."parent_id" = source."id"
                AND target."path" = 'createdBy'
                AND (
                  (platform_principal."id" IS NOT NULL AND target."platform_staff_id" = platform_principal."id" AND target."clinic_staff_id" IS NULL)
                  OR (clinic_principal."id" IS NOT NULL AND target."clinic_staff_id" = clinic_principal."id" AND target."platform_staff_id" IS NULL)
                )
            ) <> 1
          )
      ) OR EXISTS (
        SELECT 1
        FROM "clinic_gallery_media" AS source
        LEFT JOIN "platform_staff" AS platform_principal ON platform_principal."user_id" = source."created_by_id"
        LEFT JOIN "clinic_staff" AS clinic_principal ON clinic_principal."user_id" = source."created_by_id"
        WHERE source."created_by_id" IS NOT NULL
          AND (
            (platform_principal."id" IS NULL AND clinic_principal."id" IS NULL)
            OR (platform_principal."id" IS NOT NULL AND clinic_principal."id" IS NOT NULL)
            OR (
              SELECT count(*)
              FROM "clinic_gallery_media_rels" AS target
              WHERE target."parent_id" = source."id" AND target."path" = 'createdBy'
            ) <> 1
            OR (
              SELECT count(*)
              FROM "clinic_gallery_media_rels" AS target
              WHERE target."parent_id" = source."id"
                AND target."path" = 'createdBy'
                AND (
                  (platform_principal."id" IS NOT NULL AND target."platform_staff_id" = platform_principal."id" AND target."clinic_staff_id" IS NULL)
                  OR (clinic_principal."id" IS NOT NULL AND target."clinic_staff_id" = clinic_principal."id" AND target."platform_staff_id" IS NULL)
                )
            ) <> 1
          )
      ) OR EXISTS (
        SELECT 1
        FROM "clinic_gallery_entries" AS source
        LEFT JOIN "platform_staff" AS platform_principal ON platform_principal."user_id" = source."created_by_id"
        LEFT JOIN "clinic_staff" AS clinic_principal ON clinic_principal."user_id" = source."created_by_id"
        WHERE source."created_by_id" IS NOT NULL
          AND (
            (platform_principal."id" IS NULL AND clinic_principal."id" IS NULL)
            OR (platform_principal."id" IS NOT NULL AND clinic_principal."id" IS NOT NULL)
            OR (
              SELECT count(*)
              FROM "clinic_gallery_entries_rels" AS target
              WHERE target."parent_id" = source."id" AND target."path" = 'createdBy'
            ) <> 1
            OR (
              SELECT count(*)
              FROM "clinic_gallery_entries_rels" AS target
              WHERE target."parent_id" = source."id"
                AND target."path" = 'createdBy'
                AND (
                  (platform_principal."id" IS NOT NULL AND target."platform_staff_id" = platform_principal."id" AND target."clinic_staff_id" IS NULL)
                  OR (clinic_principal."id" IS NOT NULL AND target."clinic_staff_id" = clinic_principal."id" AND target."platform_staff_id" IS NULL)
                )
            ) <> 1
          )
      ) OR EXISTS (
        SELECT 1
        FROM "doctor_media" AS source
        LEFT JOIN "platform_staff" AS platform_principal ON platform_principal."user_id" = source."created_by_id"
        LEFT JOIN "clinic_staff" AS clinic_principal ON clinic_principal."user_id" = source."created_by_id"
        WHERE source."created_by_id" IS NOT NULL
          AND (
            (platform_principal."id" IS NULL AND clinic_principal."id" IS NULL)
            OR (platform_principal."id" IS NOT NULL AND clinic_principal."id" IS NOT NULL)
            OR (
              SELECT count(*)
              FROM "doctor_media_rels" AS target
              WHERE target."parent_id" = source."id" AND target."path" = 'createdBy'
            ) <> 1
            OR (
              SELECT count(*)
              FROM "doctor_media_rels" AS target
              WHERE target."parent_id" = source."id"
                AND target."path" = 'createdBy'
                AND (
                  (platform_principal."id" IS NOT NULL AND target."platform_staff_id" = platform_principal."id" AND target."clinic_staff_id" IS NULL)
                  OR (clinic_principal."id" IS NOT NULL AND target."clinic_staff_id" = clinic_principal."id" AND target."platform_staff_id" IS NULL)
                )
            ) <> 1
          )
      ) THEN
        RAISE EXCEPTION 'Direct staff auth contract aborted: a media actor relation does not match its direct principal target';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM "clinic_applications"
        WHERE "linked_records_basic_user_id" IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'Direct staff auth contract aborted: a clinic application still references BasicUsers';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM "payload_locked_documents_rels"
        WHERE "basic_users_id" IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'Direct staff auth contract aborted: a Payload document lock still references BasicUsers';
      END IF;
    END
    $migration$;

    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_basic_users_fk";

    ALTER TABLE "posts_rels" DROP COLUMN "basic_users_id";
    ALTER TABLE "_posts_v_rels" DROP COLUMN "basic_users_id";
    ALTER TABLE "platform_content_media" DROP COLUMN "legacy_created_by_id";
    ALTER TABLE "clinic_media" DROP COLUMN "created_by_id";
    ALTER TABLE "clinic_gallery_media" DROP COLUMN "created_by_id";
    ALTER TABLE "clinic_gallery_entries" DROP COLUMN "created_by_id";
    ALTER TABLE "doctor_media" DROP COLUMN "created_by_id";
    ALTER TABLE "user_profile_media_rels" DROP COLUMN "basic_users_id";
    ALTER TABLE "clinic_staff" DROP COLUMN "user_id";
    ALTER TABLE "platform_staff" DROP COLUMN "user_id";
    ALTER TABLE "clinic_applications" DROP COLUMN "linked_records_basic_user_id";
    ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "legacy_assigned_to_id";
    ALTER TABLE "reviews" DROP COLUMN "legacy_edited_by_id";
    ALTER TABLE "payload_preferences_rels" DROP COLUMN "legacy_basic_users_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "basic_users_id";

    DROP TABLE "basic_users";
    DROP TYPE "public"."enum_basic_users_user_type";
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    'The direct staff auth contract migration is irreversible. Restore the pre-contract backup or use PITR.',
  )
}
