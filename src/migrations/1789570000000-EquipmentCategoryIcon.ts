import { MigrationInterface, QueryRunner } from "typeorm";

export class EquipmentCategoryIcon1789570000000 implements MigrationInterface {
    name = 'EquipmentCategoryIcon1789570000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "equipment_categories" ADD "icon" character varying(40)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "equipment_categories" DROP COLUMN "icon"`);
    }
}
