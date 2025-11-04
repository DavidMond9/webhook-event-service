import { transformData, createPropertySystemTransformation } from '../src/transforms/transformer.js';

describe('Transformer', () => {
  describe('transformData', () => {
    it('should transform data according to rules', () => {
      const data = {
        unit_id: 'bldg-123-unit-45',
        tenant_name: 'John Smith',
        lease_start: '2024-01-01',
        monthly_rent: 2500,
      };

      const rules = createPropertySystemTransformation();
      const result = transformData(data, rules);

      expect(result.unitNumber).toBe('45');
      expect(result.buildingId).toBe('123');
      expect(result.resident.fullName).toBe('John Smith');
      expect(result.resident.leaseStartDate).toBe('2024-01-01T00:00:00.000Z');
      expect(result.resident.rentAmount).toBe(2500.0);
    });

    it('should handle nested target paths', () => {
      const data = {
        name: 'Test',
        value: 100,
      };

      const rules = [
        { source: 'name', target: 'nested.data.name' },
        { source: 'value', target: 'nested.value' },
      ];

      const result = transformData(data, rules);

      expect(result.nested.data.name).toBe('Test');
      expect(result.nested.value).toBe(100);
    });

    it('should apply custom transform functions', () => {
      const data = {
        price: 100,
      };

      const rules = [
        {
          source: 'price',
          target: 'formattedPrice',
          transform: (value: number) => `$${value.toFixed(2)}`,
        },
      ];

      const result = transformData(data, rules);

      expect(result.formattedPrice).toBe('$100.00');
    });

    it('should handle missing source values gracefully', () => {
      const data = {
        existing: 'value',
      };

      const rules = [
        { source: 'existing', target: 'existing' },
        { source: 'missing', target: 'missing' },
      ];

      const result = transformData(data, rules);

      expect(result.existing).toBe('value');
      expect(result.missing).toBeUndefined();
    });
  });

  describe('createPropertySystemTransformation', () => {
    it('should create correct transformation rules for propertysysA', () => {
      const rules = createPropertySystemTransformation();
      const data = {
        unit_id: 'bldg-123-unit-45',
        tenant_name: 'John Smith',
        lease_start: '2024-01-01',
        monthly_rent: 2500,
      };

      const result = transformData(data, rules);

      expect(result).toMatchObject({
        unitNumber: '45',
        buildingId: '123',
        resident: {
          fullName: 'John Smith',
          rentAmount: 2500.0,
        },
      });
      expect(result.resident.leaseStartDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});

