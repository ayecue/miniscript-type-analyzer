import { Container, SignatureDefinitionBaseType } from 'meta-utils';
import {
  ASTAssignmentStatement,
  ASTBase,
  ASTBaseBlockWithScope,
  ASTChunk
} from 'miniscript-core';

import { CompletionItemKind } from '../types/completion';
import { DocumentOptions, ScopeContext } from '../types/document';
import { IEntity } from '../types/object';
import { createExpressionHash } from '../utils/create-expression-hash';
import { Aggregator } from './aggregator';
import { Entity } from './entity';
import { Scope } from './scope';

export class Document {
  protected _root: ASTChunk;
  protected _scopeMapping: WeakMap<ASTBaseBlockWithScope, ScopeContext>;
  protected _container: Container;
  protected _globals: IEntity;
  protected _cache: Map<number, IEntity>;
  protected _hashRefMap: Map<number, ASTAssignmentStatement[]>;

  constructor(options: DocumentOptions) {
    this._root = options.root;
    this._container = options.container;
    this._scopeMapping = options.scopeMapping ?? new WeakMap();
    this._cache = new Map();
    this._hashRefMap = new Map();
    this._globals =
      options.globals ??
      new Entity({
        kind: CompletionItemKind.Constant,
        container: this._container
      })
        .addType(SignatureDefinitionBaseType.Map)
        .insertSignature(
          this._container.getTypeSignature(SignatureDefinitionBaseType.General)
        );
  }

  protected analyzeScope(block: ASTBaseBlockWithScope): void {
    const parentContext = block.scope
      ? this._scopeMapping.get(block.scope)
      : null;
    const scope = new Scope({
      container: this._container,
      parent: parentContext?.scope,
      globals: this._globals
    });
    const aggregator = new Aggregator({
      scope,
      root: this._root,
      container: this._container
    });

    for (let index = 0; index < block.assignments.length; index++) {
      const item = block.assignments[index] as ASTAssignmentStatement;
      const hash = createExpressionHash(item.variable);
      const value =
        aggregator.resolveType(item.init) ??
        new Entity({
          kind: CompletionItemKind.Value,
          container: this._container
        }).addType(SignatureDefinitionBaseType.Any);
      const cachedEntity = this._cache.get(hash);

      if (cachedEntity) {
        cachedEntity.extend(value);
        this._hashRefMap.get(hash).push(item);
      } else {
        aggregator.defineNamespace(item.variable, value);
        this._cache.set(hash, value);
        this._hashRefMap.set(hash, [item]);
      }
    }

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

  getRootScopeContext(): ScopeContext {
    return this._scopeMapping.get(this._root);
  }

  getAllScopeContexts(): ScopeContext[] {
    return [this._root, ...this._root.scopes].map((item) =>
      this._scopeMapping.get(item)
    );
  }

  getScopeContext(block: ASTBaseBlockWithScope): ScopeContext | null {
    return this._scopeMapping.get(block) ?? null;
  }

  getAssignmentsForElement(item: ASTBase): ASTAssignmentStatement[] {
    const hash = createExpressionHash(item);
    return this._hashRefMap.get(hash) ?? [];
  }

  fork(...typeDocs: Document[]): Document {
    const newTypeDoc = new Document({
      root: this._root,
      container: this._container,
      scopeMapping: this._scopeMapping,
      globals: this._globals.copy()
    });

    for (const typeDoc of typeDocs) {
      newTypeDoc._globals.extend(typeDoc._globals);
    }

    return newTypeDoc;
  }
}
