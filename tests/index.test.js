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

    test('should return entity from key of type string', () => {
      const doc = getDocument(`
        test = {}
        test["foo"] = "hello"
        test["foo bar"] = "world"
      `);
      const scope = doc.getRootScopeContext().scope;
      const stringKey = new Entity({
        kind: -1,
        document: doc
      }).addType('string');

      expect(scope.resolveProperty('test').resolveProperty('foo').types.size).toEqual(1);
      expect(Array.from(scope.resolveProperty('test').resolveProperty('foo').types)).toEqual(['string']);
      expect(scope.resolveProperty('test').resolveProperty('foo bar')).toBeNull();
      expect(scope.resolveProperty('test').resolveProperty(stringKey).types.size).toEqual(1);
      expect(Array.from(scope.resolveProperty('test').resolveProperty(stringKey).types)).toEqual(['string']);
    });
  });

  describe('globals', () => {
    test('should return entity from either global or api', () => {
      const doc = getDocument(`
        globals.remove
        remove
      `);
      const lineA = doc.root.lines[2][0];
      const lineB = doc.root.lines[3][0];
      const aggregator = doc.getRootScopeContext().aggregator;

      expect(aggregator.resolveNamespace(lineA, true).signatureDefinitions.first().getArguments().length).toEqual(1);
      expect(aggregator.resolveNamespace(lineB, true).signatureDefinitions.first().getArguments().length).toEqual(2);
    });
  });

  describe('expression', () => {
    test('should return entity from isa', () => {
      const doc = getDocument(`
        test = "123" isa string
      `);
      const scope = doc.getRootScopeContext().scope;

      expect(scope.resolveProperty('test').types.size).toEqual(1);
      expect(Array.from(scope.resolveProperty('test').types)).toEqual(['number']);
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

    test('should properly analyze even though syntax is invalid', () => {
      const doc = getDocument(`
        test = function(abc =)

        end function

        test
        foo = 123
      `)
      const scope = doc.getRootScopeContext().scope;

      expect(scope.resolveProperty('foo').types.size).toEqual(1);
      expect(Array.from(scope.resolveProperty('foo').types)).toEqual(['number']);
    });

    test('should properly analyze even though expression is followed by slice expression', () => {
      const doc = getDocument(`
        foo = [1]
        bar = (foo + foo)[ : ]
      `)
      const scope = doc.getRootScopeContext().scope;

      expect(scope.resolveProperty('bar').types.size).toEqual(1);
      expect(Array.from(scope.resolveProperty('bar').types)).toEqual(['any']);
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

    test('should return entity with custom definition', () => {
      const doc = getDocument(`
        map.hasIndex = function(a,b,c)
        end function

        bar = {}
        test = @bar.hasIndex
        bar.test = @bar.hasIndex
      `);
      const scope = doc.getRootScopeContext().scope;
      const entity = scope.resolveProperty('test', true);
      const entity2 = scope.resolveProperty('bar', true).resolveProperty('test', true);

      expect(entity.signatureDefinitions.last().getArguments().length).toEqual(3);
      expect(entity2.signatureDefinitions.last().getArguments().length).toEqual(3);
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
    test('should return entity of return value', () => {
      const doc = getDocument(`
        // Hello world
        // I am **bold**
        // @param {string} test - The title of the book.
        // @param {string|number} abc - The author of the book.
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

    test('should return entities from arguments', () => {
      const doc = getDocument(`
        // Hello world
        // I am **bold**
        // @param {string} test - The title of the book.
        // @param {string|number} abc - The author of the book.
        // @return {crypto} - Some info about return
        test = function(test, abc)
        end function
        output = test
      `);
      const scope = doc.getScopeContext(doc.root.scopes[0]).scope;
      const firstArg = scope.resolveProperty('test', true);
      const secondArg = scope.resolveProperty('abc', true);

      expect(Array.from(firstArg.types)).toEqual(['string']);
      expect(Array.from(secondArg.types)).toEqual(['string', 'number']);
    });

    test('should return entity from arguments which has extended its type', () => {
      const doc = getDocument(`
        // Hello world
        // @return {string}
        map.bar = function

        end function

        // Hello world
        // @param {map} abc
        // @return {number}
        test = function(abc)
        end function
        output = test
      `);
      const scope = doc.getScopeContext(doc.root.scopes[1]).scope;
      const arg = scope.resolveProperty('abc', true);

      expect(Array.from(arg.types)).toEqual(['map']);
      expect(Array.from(arg.resolveProperty('bar').types)).toEqual(['string']);
    });

    test('should return entity from arguments which has extended its type by merged doc', () => {
      const doc1 = getDocument(`
        // Hello world
        // @return {string}
        map.bar = function

        end function
      `);
      const doc2 = getDocument(`
        // Hello world
        // @param {map} abc
        // @return {number}
        test = function(abc)
        end function
        output = test
      `);
      const mergedDoc = doc2.merge(doc1);
      const scope = mergedDoc.getScopeContext(mergedDoc.root.scopes[0]).scope;
      const arg = scope.resolveProperty('abc', true);

      expect(Array.from(arg.types)).toEqual(['map']);
      expect(Array.from(arg.resolveProperty('bar').types)).toEqual(['string']);
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

    test('should return entity from isa property', () => {
      const doc = getDocument(`
        test = {}
        test.foo = function(a, b, c)
        
        end function
        
        bar = @(new test).foo
      `);
      const scope = doc.getRootScopeContext().scope;

      expect(scope.resolveProperty('bar', true).signatureDefinitions.first().getArguments().length).toEqual(3);
    });

    test('should return entity from circular references', () => {
      const doc = getDocument(`
        globals.Test = {"value":"test"}
        Test.A = {
          "__isa": Test,
          "subvalue": "val a",
        }
        Test.B = {
          "__isa": Test,
          "subvalue": "val b",
        }
        Test.C = {
          "__isa": Test,
          "subvalue": "val c",
        }
        Test.D = {
          "__isa": Test,
          "subvalue": "val d",
        }
        Test.E = {
          "__isa": Test,
          "subvalue": "val e",
        }
        Test.F = {
          "__isa": Test,
          "subvalue": "val f",
        }
        Test.G = {
          "__isa": Test,
          "subvalue": "val g",
        }
        Test.H = {
          "__isa": Test,
          "subvalue": "val h",
        }
        Test.I = {
          "__isa": Test,
          "subvalue": "val i",
        }
        Test.J = {
          "__isa": Test,
          "subvalue": "val j",
        }
        Test.K = {
          "__isa": Test,
          "subvalue": "val k",
        }
        Test.L = {
          "__isa": Test,
          "subvalue": "val l",
        }
        Test.M = {
          "__isa": Test,
          "subvalue": "val m",
        }
        Test.N = {
          "__isa": Test,
          "subvalue": "val n",
        }
        Test.T = {
          "__isa": Test,
          "subvalue": "val t",
        }
        Test.U = {
          "__isa": Test,
          "subvalue": "val u",
        }
        Test.V = {
          "__isa": Test,
          "subvalue": "val v",
        }
        Test.X = {
          "__isa": Test,
          "subvalue": "val x",
        }
        Test.Y = {
          "__isa": Test,
          "subvalue": "val y",
        }
        Test.Z = {
          "__isa": Test,
          "subvalue": "val z",
        }
        Test.Q = {
          "__isa": Test,
          "subvalue": "val q",
        }
      `);
      const scope = doc.getRootScopeContext().scope;

      expect(Array.from(scope.resolveProperty('Test').resolveProperty('Q').resolveProperty('subvalue').types)).toEqual(['string']);
      expect(Array.from(scope.resolveProperty('Test').resolveProperty('Q').resolveProperty('value').types)).toEqual(['string']);
    });
  });

  describe('super', () => {
    test('should return entity from __isa', () => {
      const doc = getDocument(`
        test = {}
        test.foo = function(a, b, c)
          super
        end function

        foo = new test
        foo.bar = function(a)
          super
        end function
      `);
      const lineA = doc.root.lines[4][0];
      const aggregatorA = doc.getScopeContext(doc.root.scopes[0]).aggregator;
      const lineB = doc.root.lines[9][0];
      const aggregatorB = doc.getScopeContext(doc.root.scopes[1]).aggregator;

      expect(Array.from(aggregatorA.resolveNamespace(lineA).types)).toEqual(['null']);
      expect(Array.from(aggregatorB.resolveNamespace(lineB).types)).toEqual(['map']);
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
    });

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
      const line = doc.root.lines[11];
      const aggregator = doc.getScopeContext(doc.root.scopes[2]).aggregator;
      const assignments = aggregator.resolveAvailableAssignments(line[0]);

      expect(assignments.length).toEqual(3);
      expect(assignments[0].start.line).toEqual(10);
      expect(assignments[1].start.line).toEqual(7);
      expect(assignments[2].start.line).toEqual(2);
    });
  });

  describe('get identifiers', () => {
    test('should return all identifiers of one type', () => {
      const doc = getDocument(`
        test = []
      `);
      const scope = doc.getRootScopeContext().scope;
      const identifiers = scope.getAllIdentifier();
      const entity = scope.resolveProperty('test', true);
      const entityIdentifiers = entity.getAllIdentifier();

      expect(identifiers.size).toEqual(59);
      expect(identifiers.has('test')).toEqual(true);
      expect(entityIdentifiers.size).toEqual(15);
      expect(entityIdentifiers.has('hasIndex')).toEqual(true);
    });

    test('should return all available identifiers in global scope', () => {
      const doc = getDocument(`
        map.test = function
          foo = "test"
        end function
        bar = 123
      `);
      const scope = doc.getRootScopeContext().scope;
      const identifiers = scope.getAllIdentifier();

      expect(identifiers.size).toEqual(59);
      expect(identifiers.has('bar')).toEqual(true);
      expect(identifiers.has('test')).toEqual(false);
      expect(identifiers.has('foo')).toEqual(false);
    });

    test('should return all identifiers of one type', () => {
      const doc = getDocument(`
        test = unknown
      `);
      const scope = doc.getRootScopeContext().scope;
      const entity = scope.resolveProperty('test', true);
      const entityIdentifiers = entity.getAllIdentifier();

      expect(entityIdentifiers.size).toEqual(25);
      expect(entityIdentifiers.has('hasIndex')).toEqual(true);
    });

    test('should return all identifiers of one type and custom intrinsics', () => {
      const doc = getDocument(`
        map.test = function(foo=123)
        end function
        test = unknown
      `);
      const scope = doc.getRootScopeContext().scope;
      const entity = scope.resolveProperty('test', true);
      const entityIdentifiers = entity.getAllIdentifier();

      expect(entityIdentifiers.size).toEqual(26);
      expect(entityIdentifiers.has('test')).toEqual(true);
    });

    test('should return all identifiers of api', () => {
      const doc = getDocument(``);
      const identifiers = doc.api.getAllIdentifier();

      expect(identifiers.size).toEqual(55);
    });
  });
});