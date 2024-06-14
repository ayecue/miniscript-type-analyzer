const { getDocument } = require('./utils');

describe('type-manager', () => {
  test('should return entity for property', () => {
    const doc = getDocument(`test = "123"`);
    const scope = doc.getRootScopeContext().scope;
    expect(scope.resolveProperty('test').types.size).toEqual(1);
    expect(Array.from(scope.resolveProperty('test').types)).toEqual(['string']);
  });
});