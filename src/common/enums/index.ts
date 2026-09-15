// Enumerações do domínio — os valores seguem o Termo de Referência (secções 7 a 11).

export enum UserRole {
  /** Desenvolvimento, administração, validação e consolidação dos dados */
  ADMIN = 'admin',
  /** Recolha de dados e apoio às actividades de inspecção */
  TECNICO = 'tecnico',
}

export enum LocationModality {
  PRESENCIAL = 'presencial',
  REMOTA = 'remota',
}

export enum InspectionStatus {
  PLANEADA = 'planeada',
  EM_CURSO = 'em_curso',
  CONCLUIDA = 'concluida',
}

export enum RecordStatus {
  RASCUNHO = 'rascunho',
  SUBMETIDO = 'submetido',
  VALIDADO = 'validado',
  REQUER_CORRECCAO = 'requer_correccao',
}

export enum EquipmentType {
  LAPTOP = 'laptop',
  DESKTOP = 'desktop',
  MONITOR = 'monitor',
  TECLADO = 'teclado',
  RATO = 'rato',
  HEADPHONES = 'headphones',
  OUTRO = 'outro',
}

/** Secção 9 — Estado dos equipamentos */
export enum EquipmentCondition {
  BOM = 'bom',
  RAZOAVEL = 'razoavel',
  MAU = 'mau',
  NAO_FUNCIONA = 'nao_funciona',
}

export enum StorageType {
  HDD = 'hdd',
  SSD = 'ssd',
  NVME = 'nvme',
  EMMC = 'emmc',
  HIBRIDO = 'hibrido',
}

export enum BatteryStatus {
  BOM = 'bom',
  RAZOAVEL = 'razoavel',
  FRACA = 'fraca',
  NAO_SEGURA_CARGA = 'nao_segura_carga',
  SEM_BATERIA = 'sem_bateria',
}

/** Secção 10 — Problemas de funcionamento (computadores) */
export enum ProblemType {
  LENTO = 'lento',
  BLOQUEIA = 'bloqueia',
  REINICIA = 'reinicia',
  ARRANQUE = 'arranque',
  BATERIA = 'bateria',
  TECLADO = 'teclado',
  ECRA = 'ecra',
  CONECTIVIDADE = 'conectividade',
  APLICACOES = 'aplicacoes',
  OUTRO = 'outro',
}

/** Secção 11 — Informações de software */
export enum UpdatesStatus {
  ACTUALIZADO = 'actualizado',
  PENDENTE = 'pendente',
  DESACTUALIZADO = 'desactualizado',
  DESCONHECIDO = 'desconhecido',
}

export enum EsetStatus {
  ACTIVO = 'activo',
  DESACTUALIZADO = 'desactualizado',
  EXPIRADO = 'expirado',
  NAO_INSTALADO = 'nao_instalado',
  DESCONHECIDO = 'desconhecido',
}

export enum AuditAction {
  LOGIN = 'login',
  LOGOUT = 'logout',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  SUBMIT = 'submit',
  VALIDATE = 'validate',
  REQUEST_CORRECTION = 'request_correction',
  EXPORT = 'export',
  PASSWORD_CHANGE = 'password_change',
}
