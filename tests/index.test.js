const { getDocument } = require('./utils');
const { Entity } = require('../dist');

describe('type-manager', () => {
  describe('1 level depth property', () => {
    test('should return entity', () => {
      const doc = getDocument(`test = "123"`);
      const scope = doc.getRootScopeContext().scope;

      expect(scope.resolveProperty('test').types.size).toEqual(1);
      expect(Array.from(scope.resolveProperty('test').types)).toEqual(['string']);
    });

    test('should return entity with multiple types', () => {
      const doc = getDocument(`
        test = "123"
        test = 123
      `);
      const scope = doc.getRootScopeContext().scope;

      expect(scope.resolveProperty('test').types.size).toEqual(2);
      expect(Array.from(scope.resolveProperty('test').types)).toEqual(['string', 'number']);
    });
  });

  describe('2 level depth property', () => {
    test('should return entity', () => {
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

    test('should return entity with multiple types', () => {
      const doc = getDocument(`
        test = {}
        test.foo = 123
        test.foo = []
      `);
      const scope = doc.getRootScopeContext().scope;

      expect(scope.resolveProperty('test').types.size).toEqual(1);
      expect(Array.from(scope.resolveProperty('test').types)).toEqual(['map']);
      expect(scope.resolveProperty('test').resolveProperty('foo').types.size).toEqual(2);
      expect(Array.from(scope.resolveProperty('test').resolveProperty('foo').types)).toEqual(['number', 'list']);
    });

    test('should return entity with signature', () => {
      const doc = getDocument(`
        test = {}
        test.foo = []
        bar = test.foo.hasIndex
      `);
      const scope = doc.getRootScopeContext().scope;

      expect(Array.from(scope.resolveProperty('bar', true).types)).toEqual(['number']);
    });
  });

  describe('2 level depth property with index', () => {
    test('should return entity', () => {
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

    test('should return entity with multiple types', () => {
      const doc = getDocument(`
        test = {}
        test[222] = "hello"
        test[454] = {}
      `);
      const scope = doc.getRootScopeContext().scope;
      const numberKey = new Entity({
        kind: -1,
        document: doc
      }).addType('number');

      expect(scope.resolveProperty('test').types.size).toEqual(1);
      expect(Array.from(scope.resolveProperty('test').types)).toEqual(['map']);
      expect(scope.resolveProperty('test').resolveProperty(numberKey).types.size).toEqual(2);
      expect(Array.from(scope.resolveProperty('test').resolveProperty(numberKey).types)).toEqual(['string', 'map']);
    });
  });

  describe('function', () => {
    test('should return entity', () => {
      const doc = getDocument(`
        test = function(foo=123)
        end function
      `);
      const scope = doc.getScopeContext(doc.root.scopes[0]).scope;

      expect(scope.resolveProperty('foo').types.size).toEqual(1);
      expect(Array.from(scope.resolveProperty('foo').types)).toEqual(['number']);
    });

    test('should return entity with multiple types', () => {
      const doc = getDocument(`
        test = function(foo=123)
          foo = "test"
        end function
      `);
      const scope = doc.getScopeContext(doc.root.scopes[0]).scope;

      expect(scope.resolveProperty('foo').types.size).toEqual(2);
      expect(Array.from(scope.resolveProperty('foo').types)).toEqual(['number', 'string']);
    });
  });

  describe('intrinsics', () => {
    test('should return entity', () => {
      const doc = getDocument(`
        map.test = function(foo=123)
        end function
        fn = @map.test
        output = map.test
      `);
      const scope = doc.getRootScopeContext().scope;

      expect(scope.resolveProperty('fn', true).signatureDefinitions.first().getArguments().length).toEqual(1);
      expect(Array.from(scope.resolveProperty('fn', true).types)).toEqual(['function']);
      expect(scope.resolveProperty('output').types.size).toEqual(1);
      expect(Array.from(scope.resolveProperty('output').types)).toEqual(['any']);
    });

    test('should return entity from extended intrinsics', () => {
      const doc = getDocument(`
        map.test = function(foo=123)
        end function
        fn = @{}.test
        output = {}.test
      `);
      const scope = doc.getRootScopeContext().scope;

      expect(scope.resolveProperty('fn', true).signatureDefinitions.first().getArguments().length).toEqual(1);
      expect(Array.from(scope.resolveProperty('fn', true).types)).toEqual(['function']);
      expect(scope.resolveProperty('output').types.size).toEqual(1);
      expect(Array.from(scope.resolveProperty('output').types)).toEqual(['any']);
    });

    test('should return entity from extended intrinsics in resolve chain with method', () => {
      const doc = getDocument(`
        list.test = function(foo=123)
        end function
        fn = @join.split.test
        output = join.split.test
      `);
      const scope = doc.getRootScopeContext().scope;

      expect(scope.resolveProperty('fn', true).signatureDefinitions.first().getArguments().length).toEqual(1);
      expect(Array.from(scope.resolveProperty('fn', true).types)).toEqual(['function']);
      expect(scope.resolveProperty('output').types.size).toEqual(1);
      expect(Array.from(scope.resolveProperty('output').types)).toEqual(['any']);
    });
  });

  describe('merged', () => {
    test('should return entity', () => {
      const doc1 = getDocument(`
        map.test = function(foo=123)
        end function
      `);
      const doc2 = getDocument(`
        foo = @{}.test
      `);
      const mergedDoc = doc2.merge(doc1);
      const scope = mergedDoc.getRootScopeContext().scope;

      expect(scope.resolveProperty('foo', true).signatureDefinitions.first().getArguments().length).toEqual(1);
      expect(Array.from(scope.resolveProperty('foo').types)).toEqual(['any']);
    });
  });

  describe('comment', () => {
    test('should return entity', () => {
      const doc = getDocument(`
        // Hello world
        // I am **bold**
        // @param {string} title - The title of the book.
        // @param {string|number} author - The author of the book.
        // @return {crypto} - Some info about return
        test = function(test, abc)
        end function
        output = test
      `);
      const scope = doc.getRootScopeContext().scope;
      const signature = scope.resolveProperty('test', true).signatureDefinitions.first();

      expect(signature.getArguments().length).toEqual(2);
      expect(signature.getReturns().map((it) => it.type)).toEqual(['crypto']);
      expect(Array.from(scope.resolveProperty('output').types)).toEqual(['crypto']);
    });
  });

  describe('addressOf', () => {
    test('should return entity with signature', () => {
      const doc = getDocument(`
        foo = @hasIndex
      `);
      const scope = doc.getRootScopeContext().scope;
      const signature = scope.resolveProperty('foo', true).signatureDefinitions.first();

      expect(signature.getArguments().length).toEqual(2);
      expect(signature.getReturns().map((it) => it.type)).toEqual(['number', 'null']);
    });

    test('should return entity signature return values', () => {
      const doc = getDocument(`
        foo = @hasIndex()
      `);
      const scope = doc.getRootScopeContext().scope;

      expect(Array.from(scope.resolveProperty('foo', true).types)).toEqual(['number', 'null']);
    });

    test('should return entity signature return values from object', () => {
      const doc = getDocument(`
        foo = @{}.hasIndex()
      `);
      const scope = doc.getRootScopeContext().scope;

      expect(Array.from(scope.resolveProperty('foo', true).types)).toEqual(['number']);
    });

    test('should return next entity', () => {
      const doc = getDocument(`
        foo = @split().join()
      `);
      const scope = doc.getRootScopeContext().scope;

      expect(Array.from(scope.resolveProperty('foo', true).types)).toEqual(['string']);
    });
  });

  describe('__isa', () => {
    test('should return entity', () => {
      const doc = getDocument(`
        test = {"foo":123}
        sub = new test
        foo = sub.foo
      `);
      const scope = doc.getRootScopeContext().scope;

      expect(Array.from(scope.resolveProperty('foo', true).types)).toEqual(['number']);
    });

    test('should return entity from 2 layer isa', () => {
      const doc = getDocument(`
        test = {"foo":123}
        test2 = new test
        sub = new test2
        foo = sub.foo
      `);
      const scope = doc.getRootScopeContext().scope;

      expect(Array.from(scope.resolveProperty('foo', true).types)).toEqual(['number']);
    });

    test('should return entity from 2 layer isa with override', () => {
      const doc = getDocument(`
        test = {"foo":123}
        test2 = new test
        test2.foo = "test"
        sub = new test2
        foo = sub.foo
      `);
      const scope = doc.getRootScopeContext().scope;

      expect(Array.from(scope.resolveProperty('foo', true).types)).toEqual(['string']);
    });
  });

  describe('resolve all assignments', () => {
    test('should return all assignments which match query', () => {
      const doc = getDocument(`
        test = {"foo":123}
        bar = {"test":444}
        bar = function
          test = 123

          foo = function
            test = false
            bar.test = "42"
          end function
        end function
      `);
      const assignments = doc.resolveAllAssignmentsWithQuery('test');

      expect(assignments.length).toEqual(6);
      expect(assignments[0].start.line).toEqual(2);
      expect(assignments[1].start.line).toEqual(2);
      expect(assignments[2].start.line).toEqual(3);
      expect(assignments[3].start.line).toEqual(5);
      expect(assignments[4].start.line).toEqual(8);
      expect(assignments[5].start.line).toEqual(9);
    })
  });

  describe('resolve only visible assignments', () => {
    test('should return all assignments which match query', () => {
      const doc = getDocument(`
        level1 = "12345"
        bar = function
          level2 = 123

          foo = function
            level3 = false

            foo = function
              level4 = []
            end function
          end function
        end function
      `);
      const aggregator = doc.getScopeContext(doc.root.scopes[2]).aggregator;
      const assignments = aggregator.resolveAvailableAssignmentsWithQuery('level');

      expect(assignments.length).toEqual(3);
      expect(assignments[0].start.line).toEqual(10);
      expect(assignments[1].start.line).toEqual(7);
      expect(assignments[2].start.line).toEqual(2);
    })

    test('should return all assignments which match namespace', () => {
      const doc = getDocument(`
        tri = "12345"
        bar = function
          tri = 123

          foo = function
            tri = false

            foo = function
              tri = []
              tri
            end function
          end function
        end function
      `);
      const line = doc.root.lines.get(11);
      const aggregator = doc.getScopeContext(doc.root.scopes[2]).aggregator;
      const assignments = aggregator.resolveAvailableAssignments(line[0]);

      expect(assignments.length).toEqual(3);
      expect(assignments[0].start.line).toEqual(10);
      expect(assignments[1].start.line).toEqual(7);
      expect(assignments[2].start.line).toEqual(2);
    })
  });
});