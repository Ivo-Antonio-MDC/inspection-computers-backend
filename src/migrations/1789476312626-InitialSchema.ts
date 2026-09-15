import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1789476312626 implements MigrationInterface {
    name = 'InitialSchema1789476312626'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TYPE "public"."user_role" AS ENUM('admin', 'tecnico')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "email" character varying(160) NOT NULL, "password_hash" character varying NOT NULL, "role" "public"."user_role" NOT NULL DEFAULT 'tecnico', "is_active" boolean NOT NULL DEFAULT true, "must_change_password" boolean NOT NULL DEFAULT true, "last_login_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."audit_action" AS ENUM('login', 'logout', 'create', 'update', 'delete', 'submit', 'validate', 'request_correction', 'export', 'password_change')`);
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "action" "public"."audit_action" NOT NULL, "entity" character varying(40) NOT NULL, "entity_id" character varying(64), "summary" character varying(255), "changes" jsonb, "ip" character varying(64), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bd2726fd31b35443f2245b93ba" ON "audit_logs" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_2cd10fda8276bb995288acfbfb" ON "audit_logs" ("created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_82edbc5f8a1821ff01b8b9c865" ON "audit_logs" ("entity", "entity_id") `);
        await queryRunner.query(`CREATE TABLE "sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "user_agent" character varying(255), "ip" character varying(64), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_085d540d9f418cfbdc7bd55bb1" ON "sessions" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "departments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_8681da666ad9699d568b3e91064" UNIQUE ("name"), CONSTRAINT "PK_839517a681a86bb84cbcc6a1e9d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."location_modality" AS ENUM('presencial', 'remota')`);
        await queryRunner.query(`CREATE TABLE "locations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(80) NOT NULL, "modality" "public"."location_modality" NOT NULL DEFAULT 'remota', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_227023051ab1fedef7a3b6c7e2a" UNIQUE ("name"), CONSTRAINT "PK_7cc1c9e3853b94816c094825e74" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."inspection_status" AS ENUM('planeada', 'em_curso', 'concluida')`);
        await queryRunner.query(`CREATE TABLE "inspections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(160) NOT NULL, "description" text, "start_date" date, "end_date" date, "status" "public"."inspection_status" NOT NULL DEFAULT 'planeada', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_d7ab95d1ae4e2f38a85fe3f4360" UNIQUE ("name"), CONSTRAINT "PK_a484980015782324454d8c88abe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."equipment_type" AS ENUM('laptop', 'desktop', 'monitor', 'teclado', 'rato', 'headphones', 'outro')`);
        await queryRunner.query(`CREATE TYPE "public"."storage_type" AS ENUM('hdd', 'ssd', 'nvme', 'emmc', 'hibrido')`);
        await queryRunner.query(`CREATE TYPE "public"."equipment_condition" AS ENUM('bom', 'razoavel', 'mau', 'nao_funciona')`);
        await queryRunner.query(`CREATE TYPE "public"."battery_status" AS ENUM('bom', 'razoavel', 'fraca', 'nao_segura_carga', 'sem_bateria')`);
        await queryRunner.query(`CREATE TYPE "public"."problem_type" AS ENUM('lento', 'bloqueia', 'reinicia', 'arranque', 'bateria', 'teclado', 'ecra', 'conectividade', 'aplicacoes', 'outro')`);
        await queryRunner.query(`CREATE TYPE "public"."updates_status" AS ENUM('actualizado', 'pendente', 'desactualizado', 'desconhecido')`);
        await queryRunner.query(`CREATE TYPE "public"."eset_status" AS ENUM('activo', 'desactualizado', 'expirado', 'nao_instalado', 'desconhecido')`);
        await queryRunner.query(`CREATE TABLE "equipment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "record_id" uuid NOT NULL, "inspection_id" uuid NOT NULL, "type" "public"."equipment_type" NOT NULL, "position" smallint NOT NULL DEFAULT '0', "other_description" character varying(120), "brand" character varying(80), "model" character varying(120), "serial_number" character varying(80), "serial_normalized" character varying(80), "serial_unavailable" boolean NOT NULL DEFAULT false, "asset_tag" character varying(60), "processor" character varying(120), "ram_gb" numeric(6,1), "storage_type" "public"."storage_type", "storage_capacity_gb" integer, "operating_system" character varying(80), "hostname" character varying(63), "ip_address" character varying(45), "screen_size_inches" numeric(4,1), "condition" "public"."equipment_condition", "condition_notes" text, "battery_status" "public"."battery_status", "problems" "public"."problem_type" array NOT NULL DEFAULT '{}', "problem_description" text, "observations" text, "updates_status" "public"."updates_status", "eset_status" "public"."eset_status", "app_issues" text, "software_notes" text, "software_verified" boolean NOT NULL DEFAULT false, "needs_maintenance" boolean NOT NULL DEFAULT false, "needs_replacement" boolean NOT NULL DEFAULT false, "has_problems" boolean NOT NULL DEFAULT false, "is_complete" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0722e1b9d6eb19f5874c1678740" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e82b9d1e63958965580aa20b5d" ON "equipment" ("record_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_07770482f484d448acb7eb1444" ON "equipment" ("type") `);
        await queryRunner.query(`CREATE INDEX "IDX_c7e6de7bdc9a6bd67c037d3ce3" ON "equipment" ("condition") `);
        await queryRunner.query(`CREATE INDEX "IDX_f28d2ddebcb2b8a0a5f4ac9e45" ON "equipment" ("has_problems") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_equipment_serial_per_inspection" ON "equipment" ("inspection_id", "type", "serial_normalized") WHERE "serial_normalized" IS NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."record_status" AS ENUM('rascunho', 'submetido', 'validado', 'requer_correccao')`);
        await queryRunner.query(`CREATE TABLE "inspection_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "number" SERIAL NOT NULL, "inspection_id" uuid NOT NULL, "collaborator_id" uuid NOT NULL, "status" "public"."record_status" NOT NULL DEFAULT 'rascunho', "general_notes" text, "incomplete_count" integer NOT NULL DEFAULT '0', "created_by_id" uuid NOT NULL, "updated_by_id" uuid, "submitted_at" TIMESTAMP WITH TIME ZONE, "validated_by_id" uuid, "validated_at" TIMESTAMP WITH TIME ZONE, "review_comment" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_bee62c563602c7f1eb4796210a6" UNIQUE ("number"), CONSTRAINT "PK_e9f0ce0e98037d32f6cab479a88" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d8911b3bb86823e9acfca78448" ON "inspection_records" ("inspection_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_65313b24c4ba34601c132be6f8" ON "inspection_records" ("status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_record_inspection_collaborator" ON "inspection_records" ("inspection_id", "collaborator_id") `);
        await queryRunner.query(`CREATE TABLE "collaborators" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(160) NOT NULL, "name_normalized" character varying(160) NOT NULL, "department_id" uuid NOT NULL, "location_id" uuid NOT NULL, "position" character varying(120) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f579a5df9d66287f400806ad875" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_25a21e800f073c20042140d840" ON "collaborators" ("department_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d5fedd346a58c4a9cd56122f4f" ON "collaborators" ("location_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_collaborator_name_location" ON "collaborators" ("name_normalized", "location_id") `);
        await queryRunner.query(`ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_bd2726fd31b35443f2245b93ba0" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sessions" ADD CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "equipment" ADD CONSTRAINT "FK_e82b9d1e63958965580aa20b5d7" FOREIGN KEY ("record_id") REFERENCES "inspection_records"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inspection_records" ADD CONSTRAINT "FK_d8911b3bb86823e9acfca784480" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inspection_records" ADD CONSTRAINT "FK_7e6141d4f2fea4fdd7a30758cca" FOREIGN KEY ("collaborator_id") REFERENCES "collaborators"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inspection_records" ADD CONSTRAINT "FK_4cff60e29ff8172ce6722ff8534" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inspection_records" ADD CONSTRAINT "FK_fac2a35dce6dd588d8e534b01b4" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inspection_records" ADD CONSTRAINT "FK_303223ed5de7f403c1057de4c0d" FOREIGN KEY ("validated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "collaborators" ADD CONSTRAINT "FK_25a21e800f073c20042140d8405" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "collaborators" ADD CONSTRAINT "FK_d5fedd346a58c4a9cd56122f4f9" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "collaborators" DROP CONSTRAINT "FK_d5fedd346a58c4a9cd56122f4f9"`);
        await queryRunner.query(`ALTER TABLE "collaborators" DROP CONSTRAINT "FK_25a21e800f073c20042140d8405"`);
        await queryRunner.query(`ALTER TABLE "inspection_records" DROP CONSTRAINT "FK_303223ed5de7f403c1057de4c0d"`);
        await queryRunner.query(`ALTER TABLE "inspection_records" DROP CONSTRAINT "FK_fac2a35dce6dd588d8e534b01b4"`);
        await queryRunner.query(`ALTER TABLE "inspection_records" DROP CONSTRAINT "FK_4cff60e29ff8172ce6722ff8534"`);
        await queryRunner.query(`ALTER TABLE "inspection_records" DROP CONSTRAINT "FK_7e6141d4f2fea4fdd7a30758cca"`);
        await queryRunner.query(`ALTER TABLE "inspection_records" DROP CONSTRAINT "FK_d8911b3bb86823e9acfca784480"`);
        await queryRunner.query(`ALTER TABLE "equipment" DROP CONSTRAINT "FK_e82b9d1e63958965580aa20b5d7"`);
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19"`);
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_bd2726fd31b35443f2245b93ba0"`);
        await queryRunner.query(`DROP INDEX "public"."uq_collaborator_name_location"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d5fedd346a58c4a9cd56122f4f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_25a21e800f073c20042140d840"`);
        await queryRunner.query(`DROP TABLE "collaborators"`);
        await queryRunner.query(`DROP INDEX "public"."uq_record_inspection_collaborator"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_65313b24c4ba34601c132be6f8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d8911b3bb86823e9acfca78448"`);
        await queryRunner.query(`DROP TABLE "inspection_records"`);
        await queryRunner.query(`DROP TYPE "public"."record_status"`);
        await queryRunner.query(`DROP INDEX "public"."uq_equipment_serial_per_inspection"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f28d2ddebcb2b8a0a5f4ac9e45"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c7e6de7bdc9a6bd67c037d3ce3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_07770482f484d448acb7eb1444"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e82b9d1e63958965580aa20b5d"`);
        await queryRunner.query(`DROP TABLE "equipment"`);
        await queryRunner.query(`DROP TYPE "public"."eset_status"`);
        await queryRunner.query(`DROP TYPE "public"."updates_status"`);
        await queryRunner.query(`DROP TYPE "public"."problem_type"`);
        await queryRunner.query(`DROP TYPE "public"."battery_status"`);
        await queryRunner.query(`DROP TYPE "public"."equipment_condition"`);
        await queryRunner.query(`DROP TYPE "public"."storage_type"`);
        await queryRunner.query(`DROP TYPE "public"."equipment_type"`);
        await queryRunner.query(`DROP TABLE "inspections"`);
        await queryRunner.query(`DROP TYPE "public"."inspection_status"`);
        await queryRunner.query(`DROP TABLE "locations"`);
        await queryRunner.query(`DROP TYPE "public"."location_modality"`);
        await queryRunner.query(`DROP TABLE "departments"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_085d540d9f418cfbdc7bd55bb1"`);
        await queryRunner.query(`DROP TABLE "sessions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_82edbc5f8a1821ff01b8b9c865"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2cd10fda8276bb995288acfbfb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bd2726fd31b35443f2245b93ba"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP TYPE "public"."audit_action"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."user_role"`);
    }

}
