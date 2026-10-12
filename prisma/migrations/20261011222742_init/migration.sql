-- CreateEnum
CREATE TYPE "Role" AS ENUM ('operario', 'jefe_planta', 'calidad', 'director_tecnico', 'bodega', 'admin');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('cuarentena', 'liberado', 'rechazado');

-- CreateEnum
CREATE TYPE "FormulaStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('planificado', 'pesado', 'mezclado', 'envasado', 'calidad', 'liberado', 'rechazado');

-- CreateEnum
CREATE TYPE "QcResultStatus" AS ENUM ('pass', 'fail');

-- CreateEnum
CREATE TYPE "DeviationStatus" AS ENUM ('abierta', 'en_investigacion', 'pendiente_aprobacion', 'cerrada');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nit" TEXT,
    "invima_registration" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_materials" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "category" TEXT,

    CONSTRAINT "raw_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_material_lots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "raw_material_id" TEXT NOT NULL,
    "supplier_lot_code" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiry_date" DATE NOT NULL,
    "quantity_received" DECIMAL(65,30) NOT NULL,
    "quantity_available" DECIMAL(65,30) NOT NULL,
    "status" "LotStatus" NOT NULL DEFAULT 'cuarentena',
    "qr_code" TEXT,
    "supplier_provided_code" TEXT,
    "coa_document_url" TEXT,

    CONSTRAINT "raw_material_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_formulas" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "FormulaStatus" NOT NULL DEFAULT 'draft',
    "product_type" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),

    CONSTRAINT "master_formulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formula_ingredients" (
    "id" TEXT NOT NULL,
    "formula_id" TEXT NOT NULL,
    "raw_material_id" TEXT NOT NULL,
    "percentage" DECIMAL(6,3) NOT NULL,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "formula_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "formula_id" TEXT NOT NULL,
    "formula_version" INTEGER NOT NULL,
    "planned_quantity" DECIMAL(65,30) NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'planificado',
    "planned_start" TIMESTAMP(3),
    "actual_start" TIMESTAMP(3),
    "actual_end" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "client_event_id" TEXT NOT NULL,
    "device_id" TEXT,

    CONSTRAINT "batch_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_signatures" (
    "id" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "signed_by" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meaning_statement" TEXT NOT NULL,
    "reauth_verified" BOOLEAN NOT NULL,

    CONSTRAINT "batch_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_specifications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "formula_id" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "min_value" DECIMAL(65,30),
    "max_value" DECIMAL(65,30),
    "unit" TEXT,

    CONSTRAINT "qc_specifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_results" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "measured_value" DECIMAL(65,30) NOT NULL,
    "result" "QcResultStatus" NOT NULL,
    "recorded_by" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qc_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deviations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "investigation" TEXT,
    "corrective_action" TEXT,
    "status" "DeviationStatus" NOT NULL DEFAULT 'abierta',
    "raised_by" TEXT NOT NULL,
    "investigation_started_by" TEXT,
    "investigation_started_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),

    CONSTRAINT "deviations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finished_product_lots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "released_by" TEXT,
    "released_at" TIMESTAMP(3),

    CONSTRAINT "finished_product_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sops" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "sops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sop_acknowledgments" (
    "id" TEXT NOT NULL,
    "sop_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ack_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sop_acknowledgments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "actor_user_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "raw_materials_tenant_id_code_key" ON "raw_materials"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "raw_material_lots_tenant_id_status_idx" ON "raw_material_lots"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "master_formulas_tenant_id_code_version_key" ON "master_formulas"("tenant_id", "code", "version");

-- CreateIndex
CREATE INDEX "production_orders_tenant_id_status_idx" ON "production_orders"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_tenant_id_order_number_key" ON "production_orders"("tenant_id", "order_number");

-- CreateIndex
CREATE UNIQUE INDEX "batch_events_client_event_id_key" ON "batch_events"("client_event_id");

-- CreateIndex
CREATE INDEX "batch_events_production_order_id_idx" ON "batch_events"("production_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "batch_signatures_production_order_id_stage_key" ON "batch_signatures"("production_order_id", "stage");

-- CreateIndex
CREATE INDEX "qc_specifications_tenant_id_idx" ON "qc_specifications"("tenant_id");

-- CreateIndex
CREATE INDEX "qc_results_tenant_id_idx" ON "qc_results"("tenant_id");

-- CreateIndex
CREATE INDEX "deviations_tenant_id_idx" ON "deviations"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "finished_product_lots_production_order_id_key" ON "finished_product_lots"("production_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "finished_product_lots_tenant_id_code_key" ON "finished_product_lots"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "sops_tenant_id_code_version_key" ON "sops"("tenant_id", "code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "sop_acknowledgments_sop_id_user_id_key" ON "sop_acknowledgments"("sop_id", "user_id");

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_table_name_idx" ON "audit_log"("tenant_id", "table_name");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_material_lots" ADD CONSTRAINT "raw_material_lots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_material_lots" ADD CONSTRAINT "raw_material_lots_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_formulas" ADD CONSTRAINT "master_formulas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formula_ingredients" ADD CONSTRAINT "formula_ingredients_formula_id_fkey" FOREIGN KEY ("formula_id") REFERENCES "master_formulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formula_ingredients" ADD CONSTRAINT "formula_ingredients_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_formula_id_fkey" FOREIGN KEY ("formula_id") REFERENCES "master_formulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_events" ADD CONSTRAINT "batch_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_events" ADD CONSTRAINT "batch_events_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_signatures" ADD CONSTRAINT "batch_signatures_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_specifications" ADD CONSTRAINT "qc_specifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_specifications" ADD CONSTRAINT "qc_specifications_formula_id_fkey" FOREIGN KEY ("formula_id") REFERENCES "master_formulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_results" ADD CONSTRAINT "qc_results_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_results" ADD CONSTRAINT "qc_results_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviations" ADD CONSTRAINT "deviations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviations" ADD CONSTRAINT "deviations_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_product_lots" ADD CONSTRAINT "finished_product_lots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_product_lots" ADD CONSTRAINT "finished_product_lots_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sops" ADD CONSTRAINT "sops_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sop_acknowledgments" ADD CONSTRAINT "sop_acknowledgments_sop_id_fkey" FOREIGN KEY ("sop_id") REFERENCES "sops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
