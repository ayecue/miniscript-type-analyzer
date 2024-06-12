import { SignatureDefinitionBaseType } from 'meta-utils';
import {
  ASTAssignmentStatement,
  ASTBaseBlockWithScope,
  ASTChunk
} from 'miniscript-core';

import { CompletionItemKind } from '../types/completion';
import { DocumentOptions, ScopeContext } from '../types/document';
import { EntityFactory, IEntity } from '../types/object';
import { Aggregator } from './aggregator';
import { Scope } from './scope';

export class Document {
  private _root: ASTChunk;
  private _scopeMapping: WeakMap<ASTBaseBlockWithScope, ScopeContext>;
  private _factory: EntityFactory;
  private _globals: IEntity;

  constructor(options: DocumentOptions) {
    this._root = options.root;
    this._factory = options.factory;
    this._scopeMapping = new WeakMap();
    this._globals = options
      .factory(CompletionItemKind.Variable)
      .addType(SignatureDefinitionBaseType.Map, 'general');
  }

  private analyzeScope(block: ASTBaseBlockWithScope): void {
    const parentContext = block.scope
      ? this._scopeMapping.get(block.scope)
      : null;
    const scope = new Scope({
      factory: this._factory,
      parent: parentContext?.scope,
      globals: this._globals
    });
    const aggregator = new Aggregator({
      scope,
      factory: this._factory
    });

    for (let index = 0; index < block.assignments.length; index++) {
      const item = block.assignments[index] as ASTAssignmentStatement;
      const value = aggregator.resolveNamespace(item.init);
      aggregator.defineNamespace(item.variable, value);
    }

    console.log(JSON.stringify(scope.toJSON(), null, 4));

    this._scopeMapping.set(block, {
      scope,
      aggregator
    });
  }

  analyze() {
    const queue: ASTBaseBlockWithScope[] = [this._root, ...this._root.scopes];

    while (queue.length > 0) {
      const item = queue.pop();
      this.analyzeScope(item);
    }
  }
}
