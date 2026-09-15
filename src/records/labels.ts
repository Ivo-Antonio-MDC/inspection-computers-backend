import {
  BatteryStatus,
  EquipmentCondition,
  EquipmentType,
  EsetStatus,
  LocationModality,
  ProblemType,
  RecordStatus,
  StorageType,
  UpdatesStatus,
  UserRole,
} from '../common/enums';

// Etiquetas em português usadas nas exportações e nos resumos de auditoria.

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  laptop: 'Laptop',
  desktop: 'Desktop',
  monitor: 'Monitor',
  teclado: 'Teclado',
  rato: 'Rato',
  headphones: 'Headphones',
  outro: 'Outro',
};

export const CONDITION_LABELS: Record<EquipmentCondition, string> = {
  bom: 'Bom',
  razoavel: 'Razoável',
  mau: 'Mau',
  nao_funciona: 'Não funciona',
};

export const STORAGE_LABELS: Record<StorageType, string> = {
  hdd: 'HDD',
  ssd: 'SSD (SATA)',
  nvme: 'SSD NVMe',
  emmc: 'eMMC',
  hibrido: 'Híbrido (SSD + HDD)',
};

export const BATTERY_LABELS: Record<BatteryStatus, string> = {
  bom: 'Boa',
  razoavel: 'Razoável',
  fraca: 'Fraca',
  nao_segura_carga: 'Não segura carga',
  sem_bateria: 'Sem bateria',
};

export const PROBLEM_LABELS: Record<ProblemType, string> = {
  lento: 'Computador lento',
  bloqueia: 'Bloqueia/congela',
  reinicia: 'Reinicia sozinho',
  arranque: 'Problemas no arranque',
  bateria: 'Problemas de bateria',
  teclado: 'Problemas de teclado',
  ecra: 'Problemas de ecrã',
  conectividade: 'Problemas de conectividade',
  aplicacoes: 'Problemas com aplicações',
  outro: 'Outro',
};

export const UPDATES_LABELS: Record<UpdatesStatus, string> = {
  actualizado: 'Actualizado',
  pendente: 'Actualizações pendentes',
  desactualizado: 'Desactualizado',
  desconhecido: 'Desconhecido',
};

export const ESET_LABELS: Record<EsetStatus, string> = {
  activo: 'Instalado e activo',
  desactualizado: 'Instalado, desactualizado',
  expirado: 'Licença expirada',
  nao_instalado: 'Não instalado',
  desconhecido: 'Desconhecido',
};

export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  rascunho: 'Rascunho',
  submetido: 'Submetido',
  validado: 'Validado',
  requer_correccao: 'Requer correcção',
};

export const MODALITY_LABELS: Record<LocationModality, string> = {
  presencial: 'Presencial',
  remota: 'Remota',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  tecnico: 'Técnico de recolha',
};
