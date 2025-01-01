# miniscript-type-analyzer

[![miniscript-type-analyzer](https://circleci.com/gh/ayecue/miniscript-type-analyzer.svg?style=svg)](https://circleci.com/gh/ayecue/miniscript-type-analyzer)

Analyzes MiniScript and suggests types. Recommended to be used with [greybel-core](https://github.com/ayecue/greybel-core) even though it should be also able to digest [miniscript-core](https://github.com/ayecue/miniscript-core) AST.

## Example
```ts
import { miniscriptMeta } from 'miniscript-meta';
import { Parser } from 'greybel-core';

const typeManager = new TypeManager({
  container: greyscriptMeta
});
const parser = new Parser(content, {
  unsafe: true
});
const chunk = parser.parseChunk();

typeManager.analyze(document.uri, chunk);

const allIdentifier = typeManager.getRootScopeContext().scope.getAvailableIdentifier();
console.log(`Your code includes: ${allIdentifier.size}`);
```