import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { computeHasProblems, requiredFieldsFor, validateEquipment, validateRecord } from './equipment-rules';

const laptop = {
  type: 'laptop' as const,
  brand: 'HP',
  model: 'EliteBook 840 G8',
  serialNumber: '5CG123ABC',
  processor: 'Intel Core i5',
  ramGb: 16,
  storageType: 'nvme',
  storageCapacityGb: 512,
  operatingSystem: 'Windows 11 Pro',
  condition: 'bom',
  batteryStatus: 'bom',
  updatesStatus: 'actualizado',
  esetStatus: 'activo',
};

describe('equipment-rules', () => {
  it('aceita um laptop completo', () => {
    expect(validateRecord([laptop], 'submit').valid).toBe(true);
  });

  it('exige os campos obrigatórios na submissão mas não no rascunho', () => {
    const item = { type: 'monitor' as const, brand: 'Dell' };
    expect(Object.keys(validateEquipment(item, 'submit').errors)).toEqual(
      expect.arrayContaining(['model', 'screenSizeInches', 'serialNumber', 'condition']),
    );
    expect(validateEquipment(item, 'draft').errors).toEqual({});
    expect(validateEquipment(item, 'draft').missing.length).toBeGreaterThan(0);
  });

  it('não exige nº de série quando marcado como indisponível, mas rejeita ambos', () => {
    expect(requiredFieldsFor({ ...laptop, serialUnavailable: true })).not.toContain('serialNumber');
    expect(validateEquipment({ ...laptop, serialUnavailable: true }, 'submit').errors.serialNumber).toBeDefined();
  });

  it('aplica campos condicionais (descrição para Mau/Não funciona e para "Outro")', () => {
    expect(requiredFieldsFor({ ...laptop, condition: 'mau' })).toContain('conditionNotes');
    expect(requiredFieldsFor({ ...laptop, problems: ['outro'] })).toContain('problemDescription');
    expect(requiredFieldsFor({ type: 'rato', condition: 'razoavel' })).not.toContain('conditionNotes');
  });

  it('valida formatos de IP, hostname e intervalos numéricos', () => {
    const errors = validateEquipment({ ...laptop, ipAddress: '10.0.0.256', hostname: 'PC 01', ramGb: 0 }, 'submit').errors;
    expect(errors.ipAddress).toBeDefined();
    expect(errors.hostname).toBeDefined();
    expect(errors.ramGb).toBeDefined();
  });

  it('impede respostas incompatíveis', () => {
    expect(validateEquipment({ ...laptop, type: 'desktop', problems: ['bateria'] }, 'draft').errors.problems).toBeDefined();
    expect(validateEquipment({ ...laptop, condition: 'bom', needsReplacement: true }, 'draft').errors.needsReplacement).toBeDefined();
  });

  it('detecta nº de série duplicado no mesmo formulário (ignorando espaços e hífens)', () => {
    const a = { type: 'monitor' as const, brand: 'Dell', model: 'P24', screenSizeInches: 24, serialNumber: 'cn-12 34', condition: 'bom' };
    const result = validateRecord([a, { ...a, serialNumber: 'CN1234' }], 'submit');
    expect(result.valid).toBe(false);
    expect(result.items[1].errors.serialNumber).toMatch(/repetido/);
  });

  it('exige pelo menos um equipamento para submeter', () => {
    expect(validateRecord([], 'submit').formErrors).toHaveLength(1);
    expect(validateRecord([], 'draft').valid).toBe(true);
  });

  it('classifica equipamentos com problemas', () => {
    expect(computeHasProblems(laptop)).toBe(false);
    expect(computeHasProblems({ ...laptop, condition: 'nao_funciona' })).toBe(true);
    expect(computeHasProblems({ ...laptop, problems: ['lento'] })).toBe(true);
  });

  it('mantém a cópia do frontend idêntica', () => {
    const frontend = join(__dirname, '../../../frontend/src/lib/equipment-rules.ts');
    if (!existsSync(frontend)) return;
    const normalize = (s: string) => s.replace(/^﻿/, '').replace(/\r\n/g, '\n');
    expect(normalize(readFileSync(frontend, 'utf8'))).toBe(
      normalize(readFileSync(join(__dirname, 'equipment-rules.ts'), 'utf8')),
    );
  });
});
