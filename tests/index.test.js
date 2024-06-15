const { getDocument } = require('./utils');
const { Entity } = require('../dist');

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

  test('should return entity for 2 level depth property with index', () => {
    const doc = getDocument(`
      test = {}
      test[222] = "hello"
    `);
    const scope = doc.getRootScopeContext().scope;
    const numberKey = new Entity({
      kind: -1,
      document: doc
    }).addType('number');

    expect(scope.resolveProperty('test').types.size).toEqual(1);
    expect(Array.from(scope.resolveProperty('test').types)).toEqual(['map']);
    expect(scope.resolveProperty('test').resolveProperty(numberKey).types.size).toEqual(1);
    expect(Array.from(scope.resolveProperty('test').resolveProperty(numberKey).types)).toEqual(['string']);
  });
});