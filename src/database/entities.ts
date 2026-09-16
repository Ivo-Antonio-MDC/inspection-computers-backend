import { AuditLog } from '../audit/entities/audit-log.entity';
import { Session } from '../auth/entities/session.entity';
import { Collaborator } from '../collaborators/entities/collaborator.entity';
import { Department } from '../departments/entities/department.entity';
import { EquipmentCategory } from '../equipment-categories/entities/equipment-category.entity';
import { Inspection } from '../inspections/entities/inspection.entity';
import { Location } from '../locations/entities/location.entity';
import { Equipment } from '../records/entities/equipment.entity';
import { InspectionRecord } from '../records/entities/inspection-record.entity';
import { User } from '../users/entities/user.entity';

export const ENTITIES = [
  User,
  Session,
  Location,
  Department,
  Inspection,
  Collaborator,
  InspectionRecord,
  Equipment,
  EquipmentCategory,
  AuditLog,
];
