/**
 * Regras do formulário dinâmico (TR §8 a §12).
 *
 * Este ficheiro é a fonte de verdade das regras e é copiado tal e qual para
 * frontend/src/lib/equipment-rules.ts — ao alterar um, alterar o outro.
 * Não importa nada de NestJS nem de React.
 */

export type EquipmentTypeKey =
  | 'laptop'
  | 'desktop'
  | 'monitor'
  | 'teclado'
  | 'rato'
  | 'headphones'
  | 'outro';

export type ConditionKey = 'bom' | 'razoavel' | 'mau' | 'nao_funciona';

export type EquipmentField =
  | 'otherDescription'
  | 'brand'
  | 'model'
  | 'serialNumber'
  | 'serialUnavailable'
  | 'assetTag'
  | 'processor'
  | 'ramGb'
  | 'storageType'
  | 'storageCapacityGb'
  | 'operatingSystem'
  | 'hostname'
  | 'ipAddress'
  | 'screenSizeInches'
  | 'condition'
  | 'conditionNotes'
  | 'batteryStatus'
  | 'problems'
  | 'problemDescription'
  | 'observations'
  | 'updatesStatus'
  | 'esetStatus'
  | 'appIssues'
  | 'softwareNotes'
  | 'softwareVerified'
  | 'needsMaintenance'
  | 'needsReplacement';

/** Estrutura mínima de um equipamento para efeitos de validação. */
export interface EquipmentInput {
  type: EquipmentTypeKey;
  otherDescription?: string | null;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  serialUnavailable?: boolean | null;
  assetTag?: string | null;
  processor?: string | null;
  ramGb?: number | string | null;
  storageType?: string | null;
  storageCapacityGb?: number | string | null;
  operatingSystem?: string | null;
  hostname?: string | null;
  ipAddress?: string | null;
  screenSizeInches?: number | string | null;
  condition?: string | null;
  conditionNotes?: string | null;
  batteryStatus?: string | null;
  problems?: string[] | null;
  problemDescription?: string | null;
  observations?: string | null;
  updatesStatus?: string | null;
  esetStatus?: string | null;
  appIssues?: string | null;
  softwareNotes?: string | null;
  softwareVerified?: boolean | null;
  needsMaintenance?: boolean | null;
  needsReplacement?: boolean | null;
}

interface TypeRules {
  /** Campos apresentados para este tipo — os restantes não são mostrados nem gravados */
  fields: EquipmentField[];
  /** Campos obrigatórios para submissão */
  required: EquipmentField[];
  /** Mostra a secção de Informações de software (TR §11) */
  software: boolean;
  /** Mostra a lista padronizada de problemas (TR §10 — computadores) */
  problemChecklist: boolean;
}

const TAIL: EquipmentField[] = [
  'condition',
  'conditionNotes',
  'problemDescription',
  'observations',
  'needsMaintenance',
  'needsReplacement',
];

const COMPUTER_SOFTWARE: EquipmentField[] = [
  'updatesStatus',
  'esetStatus',
  'appIssues',
  'softwareNotes',
  'softwareVerified',
];

export const EQUIPMENT_RULES: Record<EquipmentTypeKey, TypeRules> = {
  // TR §8.1
  laptop: {
    fields: [
      'brand', 'model', 'serialNumber', 'serialUnavailable', 'assetTag',
      'processor', 'ramGb', 'storageType', 'storageCapacityGb', 'operatingSystem',
      'hostname', 'ipAddress', 'batteryStatus', 'problems',
      ...TAIL, ...COMPUTER_SOFTWARE,
    ],
    required: [
      'brand', 'model', 'serialNumber', 'processor', 'ramGb', 'storageType',
      'storageCapacityGb', 'operatingSystem', 'condition', 'batteryStatus',
      'updatesStatus', 'esetStatus',
    ],
    software: true,
    problemChecklist: true,
  },
  // TR §8.2
  desktop: {
    fields: [
      'brand', 'model', 'serialNumber', 'serialUnavailable',
      'processor', 'ramGb', 'storageType', 'storageCapacityGb', 'operatingSystem',
      'hostname', 'ipAddress', 'problems',
      ...TAIL, ...COMPUTER_SOFTWARE,
    ],
    required: [
      'brand', 'model', 'serialNumber', 'processor', 'ramGb', 'storageType',
      'storageCapacityGb', 'operatingSystem', 'condition', 'updatesStatus', 'esetStatus',
    ],
    software: true,
    problemChecklist: true,
  },
  // TR §8.3
  monitor: {
    fields: ['brand', 'model', 'screenSizeInches', 'serialNumber', 'serialUnavailable', ...TAIL],
    required: ['brand', 'model', 'screenSizeInches', 'serialNumber', 'condition'],
    software: false,
    problemChecklist: false,
  },
  // TR §8.4
  teclado: {
    fields: ['brand', 'model', 'serialNumber', ...TAIL],
    required: ['brand', 'model', 'condition'],
    software: false,
    problemChecklist: false,
  },
  rato: {
    fields: ['brand', 'model', 'serialNumber', ...TAIL],
    required: ['brand', 'model', 'condition'],
    software: false,
    problemChecklist: false,
  },
  headphones: {
    fields: ['brand', 'model', 'serialNumber', ...TAIL],
    required: ['brand', 'model', 'condition'],
    software: false,
    problemChecklist: false,
  },
  // TR §8.5
  outro: {
    fields: ['otherDescription', 'brand', 'model', 'serialNumber', ...TAIL],
    required: ['otherDescription', 'brand', 'model', 'condition'],
    software: false,
    problemChecklist: false,
  },
};

export const EQUIPMENT_TYPE_ORDER: EquipmentTypeKey[] = [
  'laptop', 'desktop', 'monitor', 'teclado', 'rato', 'headphones', 'outro',
];

export const FIELD_LABELS: Record<EquipmentField, string> = {
  otherDescription: 'Tipo/descrição do equipamento',
  brand: 'Marca',
  model: 'Modelo',
  serialNumber: 'Número de série',
  serialUnavailable: 'Sem número de série / ilegível',
  assetTag: 'Número/ID do activo',
  processor: 'Processador',
  ramGb: 'Memória RAM (GB)',
  storageType: 'Tipo de armazenamento',
  storageCapacityGb: 'Capacidade de armazenamento (GB)',
  operatingSystem: 'Sistema operativo',
  hostname: 'Nome do host (hostname)',
  ipAddress: 'Endereço IP',
  screenSizeInches: 'Tamanho (polegadas)',
  condition: 'Estado físico',
  conditionNotes: 'Descrição do problema',
  batteryStatus: 'Estado da bateria',
  problems: 'Problemas identificados',
  problemDescription: 'Descrição dos problemas',
  observations: 'Observações',
  updatesStatus: 'Estado das actualizações',
  esetStatus: 'Estado do ESET',
  appIssues: 'Problemas com aplicações',
  softwareNotes: 'Outras observações relevantes',
  softwareVerified: 'Informação de software verificada pela TI',
  needsMaintenance: 'Necessita de manutenção',
  needsReplacement: 'Necessita de substituição',
};

export const MAX_LENGTHS: Partial<Record<EquipmentField, number>> = {
  otherDescription: 120,
  brand: 80,
  model: 120,
  serialNumber: 80,
  assetTag: 60,
  processor: 120,
  operatingSystem: 80,
  hostname: 63,
  ipAddress: 45,
  conditionNotes: 2000,
  problemDescription: 2000,
  observations: 2000,
  appIssues: 2000,
  softwareNotes: 2000,
};

export const NUMBER_RANGES: Partial<Record<EquipmentField, { min: number; max: number; integer: boolean }>> = {
  ramGb: { min: 0.5, max: 1024, integer: false },
  storageCapacityGb: { min: 8, max: 100000, integer: true },
  screenSizeInches: { min: 10, max: 100, integer: false },
};

/** Estados que exigem descrição do problema (TR §9). */
export const CONDITIONS_REQUIRING_NOTES: ConditionKey[] = ['mau', 'nao_funciona'];

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HOSTNAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const SERIAL = /^[A-Za-z0-9][A-Za-z0-9 ._/-]*$/;

export interface ItemValidation {
  errors: Partial<Record<EquipmentField, string>>;
  /** Campos obrigatórios em falta (independentemente do modo) */
  missing: EquipmentField[];
}

export interface RecordValidation {
  valid: boolean;
  formErrors: string[];
  items: ItemValidation[];
}

export type ValidationMode = 'draft' | 'submit';

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function normalizeSerialForCompare(value: string | null | undefined): string | null {
  const v = (value ?? '').replace(/[\s-]+/g, '').toUpperCase();
  return v.length > 0 ? v : null;
}

/** Equipamento com problemas: lista de problemas, descrição, ou estado Mau/Não funciona. */
export function computeHasProblems(item: EquipmentInput): boolean {
  return (
    (item.problems?.length ?? 0) > 0 ||
    !isEmpty(item.problemDescription) ||
    !isEmpty(item.appIssues) ||
    CONDITIONS_REQUIRING_NOTES.includes(item.condition as ConditionKey)
  );
}

/** Campos obrigatórios efectivos, incluindo os condicionais. */
export function requiredFieldsFor(item: EquipmentInput): EquipmentField[] {
  const rules = EQUIPMENT_RULES[item.type];
  if (!rules) return [];
  const required = new Set<EquipmentField>(rules.required);

  if (required.has('serialNumber') && item.serialUnavailable) required.delete('serialNumber');
  if (CONDITIONS_REQUIRING_NOTES.includes(item.condition as ConditionKey)) required.add('conditionNotes');
  if (item.problems?.includes('outro')) required.add('problemDescription');

  return [...required];
}

export function validateEquipment(item: EquipmentInput, mode: ValidationMode): ItemValidation {
  const errors: Partial<Record<EquipmentField, string>> = {};
  const rules = EQUIPMENT_RULES[item.type];
  if (!rules) return { errors: { brand: 'Tipo de equipamento inválido' }, missing: [] };

  const allowed = new Set(rules.fields);
  const data = item as unknown as Record<string, unknown>;

  // ── Campos obrigatórios ────────────────────────────────────────────────────
  const missing = requiredFieldsFor(item).filter((f) => isEmpty(data[f]));
  if (mode === 'submit') {
    for (const f of missing) errors[f] = `${FIELD_LABELS[f]}: campo obrigatório`;
  }

  // ── Formatos ───────────────────────────────────────────────────────────────
  for (const [field, max] of Object.entries(MAX_LENGTHS) as [EquipmentField, number][]) {
    const v = data[field];
    if (allowed.has(field) && typeof v === 'string' && v.trim().length > max) {
      errors[field] = `${FIELD_LABELS[field]}: máximo de ${max} caracteres`;
    }
  }

  for (const [field, range] of Object.entries(NUMBER_RANGES) as [
    EquipmentField,
    { min: number; max: number; integer: boolean },
  ][]) {
    const v = data[field];
    if (!allowed.has(field) || isEmpty(v)) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) errors[field] = `${FIELD_LABELS[field]} deve ser numérico`;
    else if (range.integer && !Number.isInteger(n)) errors[field] = `${FIELD_LABELS[field]} deve ser um número inteiro`;
    else if (n < range.min || n > range.max)
      errors[field] = `${FIELD_LABELS[field]} deve estar entre ${range.min} e ${range.max}`;
  }

  if (allowed.has('ipAddress') && !isEmpty(item.ipAddress) && !IPV4.test(String(item.ipAddress).trim())) {
    errors.ipAddress = 'Endereço IP inválido (ex.: 192.168.1.25)';
  }
  if (allowed.has('hostname') && !isEmpty(item.hostname) && !HOSTNAME.test(String(item.hostname).trim())) {
    errors.hostname = 'Hostname inválido: apenas letras, números e hífens (sem espaços)';
  }
  if (allowed.has('serialNumber') && !isEmpty(item.serialNumber)) {
    const s = String(item.serialNumber).trim();
    if (s.length < 3) errors.serialNumber = 'Número de série demasiado curto';
    else if (!SERIAL.test(s)) errors.serialNumber = 'Número de série contém caracteres inválidos';
  }

  // ── Respostas incompatíveis ────────────────────────────────────────────────
  if (item.serialUnavailable && !isEmpty(item.serialNumber)) {
    errors.serialNumber = 'Indique o número de série ou marque-o como indisponível — não ambos';
  }
  if (item.problems?.length) {
    const unique = new Set(item.problems);
    if (unique.size !== item.problems.length) errors.problems = 'Problemas repetidos';
    if (item.type !== 'laptop' && item.problems.includes('bateria')) {
      errors.problems = 'Problemas de bateria só se aplicam a laptops';
    }
  }
  if (item.condition === 'bom' && item.needsReplacement) {
    errors.needsReplacement = 'Um equipamento em bom estado não deve ser marcado para substituição';
  }
  return { errors, missing };
}

export function validateRecord(items: EquipmentInput[], mode: ValidationMode): RecordValidation {
  const formErrors: string[] = [];
  const results = items.map((item) => validateEquipment(item, mode));

  if (mode === 'submit' && items.length === 0) {
    formErrors.push('Seleccione pelo menos um equipamento em posse do colaborador');
  }

  // Números de série duplicados no mesmo formulário
  const seen = new Map<string, number>();
  items.forEach((item, idx) => {
    if (item.serialUnavailable) return;
    const key = normalizeSerialForCompare(item.serialNumber);
    if (!key) return;
    const composite = `${item.type}:${key}`;
    const first = seen.get(composite);
    if (first !== undefined) {
      results[idx].errors.serialNumber = `Número de série repetido (igual ao equipamento nº ${first + 1})`;
    } else {
      seen.set(composite, idx);
    }
  });

  const valid = formErrors.length === 0 && results.every((r) => Object.keys(r.errors).length === 0);
  return { valid, formErrors, items: results };
}
