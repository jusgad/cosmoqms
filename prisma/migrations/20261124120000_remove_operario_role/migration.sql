-- CosmoQMS trabaja con 5 roles: el trabajo de planta (pesaje, mezclado,
-- envasado) lo hace el jefe de planta. Quien tenía el rol operario pasa a
-- jefe_planta y conserva su estado (activo o desactivado); su historial de
-- firmas y eventos no cambia porque guarda el usuario, no el rol. El cambio
-- queda en audit_log.

INSERT INTO "audit_log" ("id", "tenant_id", "table_name", "record_id", "action", "before_data", "after_data", "actor_user_id")
SELECT gen_random_uuid()::text, "tenant_id", 'User', "id", 'update',
       jsonb_build_object('role', 'operario'),
       jsonb_build_object('role', 'jefe_planta', 'motivo', 'Se retira el rol operario: CosmoQMS trabaja con 5 roles'),
       'migracion-sistema'
FROM "users" WHERE "role" = 'operario';

UPDATE "users" SET "role" = 'jefe_planta' WHERE "role" = 'operario';

ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('jefe_planta', 'calidad', 'director_tecnico', 'bodega', 'admin');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
DROP TYPE "Role_old";
