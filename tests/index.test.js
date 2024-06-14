const { getDocument } = require('./utils');

describe('type-manager', () => {
  test('should return entity for 1 level depth property', () => {
    const doc = getDocument(`test = "123"`);
    const scope = doc.getRootScopeContext().scope;

    expect(scope.resolveProperty('test').types.size).toEqual(1);
    expect(Array.from(scope.resolveProperty('test').types)).toEqual(['string']);
  });

  test('should return entity for 2 level depth property ', () => {
    const doc = getDocument(`
      test = {}
      test.foo = 123
    `);
    const scope = doc.getRootScopeContext().scope;

    expect(scope.resolveProperty('test').types.size).toEqual(1);
    expect(Array.from(scope.resolveProperty('test').types)).toEqual(['map']);
    expect(scope.resolveProperty('test').resolveProperty('foo').types.size).toEqual(1);
    expect(Array.from(scope.resolveProperty('test').resolveProperty('foo').types)).toEqual(['number']);
  });
});