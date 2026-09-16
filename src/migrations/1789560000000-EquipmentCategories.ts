import { MigrationInterface, QueryRunner } from "typeorm";

export class EquipmentCategories1789560000000 implements MigrationInterface {
    name = 'EquipmentCategories1789560000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "equipment_categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(80) NOT NULL, "description" character varying(120), "is_active" boolean NOT NULL DEFAULT true, "created_by_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_equipment_categories_name" UNIQUE ("name"), CONSTRAINT "PK_equipment_categories" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "equipment_categories" ADD CONSTRAINT "FK_equipment_categories_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "equipment_categories" DROP CONSTRAINT "FK_equipment_categories_created_by"`);
        await queryRunner.query(`DROP TABLE "equipment_categories"`);
    }
}
