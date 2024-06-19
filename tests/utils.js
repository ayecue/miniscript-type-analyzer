const { Parser } = require('miniscript-core');
const { miniscriptMeta } = require('miniscript-meta');
const { TypeManager } = require('../dist');

const parse = (code) => {
  const parser = new Parser(code);
  return parser.parseChunk();
};

exports.parse = parse;

const getDocument = (code) => {
  const typeManager = new TypeManager({
    container: miniscriptMeta
  });

  return typeManager.analyze({ uri: 'test' }, parse(code));
}

exports.getDocument = getDocument;