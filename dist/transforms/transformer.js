export function transformData(data, rules) {
    const result = {};
    for (const rule of rules) {
        const sourceValue = getNestedValue(data, rule.source);
        if (sourceValue !== undefined) {
            const transformedValue = rule.transform ? rule.transform(sourceValue) : sourceValue;
            setNestedValue(result, rule.target, transformedValue);
        }
    }
    return result;
}
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
}
function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
        if (!current[key]) {
            current[key] = {};
        }
        return current[key];
    }, obj);
    target[lastKey] = value;
}
export function createPropertySystemTransformation() {
    return [
        {
            source: 'unit_id',
            target: 'unitNumber',
            transform: (value) => {
                const match = value.match(/unit-(\d+)$/);
                return match ? match[1] : value;
            },
        },
        {
            source: 'unit_id',
            target: 'buildingId',
            transform: (value) => {
                const match = value.match(/bldg-(\d+)/);
                return match ? match[1] : value;
            },
        },
        {
            source: 'tenant_name',
            target: 'resident.fullName',
        },
        {
            source: 'lease_start',
            target: 'resident.leaseStartDate',
            transform: (value) => {
                const date = new Date(value);
                return date.toISOString();
            },
        },
        {
            source: 'monthly_rent',
            target: 'resident.rentAmount',
            transform: (value) => parseFloat(value.toFixed(2)),
        },
    ];
}
