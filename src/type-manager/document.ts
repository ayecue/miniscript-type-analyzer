import {
  SignatureDefinitionBaseType,
  SignatureDefinitionFunction
} from 'meta-utils';
import {
  ASTAssignmentStatement,
  ASTBase,
  ASTBaseBlockWithScope,
  ASTChunk,
  ASTFunctionStatement,
  ASTType
} from 'miniscript-core';

import { CompletionItemKind } from '../types/completion';
import { IContainerProxy } from '../types/container-proxy';
import {
  DocumentOptions,
  IDocument,
  Intrinsics,
  ScopeContext
} from '../types/document';
import { ASTDefinitionItem, IEntity } from '../types/object';
import { merge } from '../utils/merge';
import { Aggregator } from './aggregator';
import { Entity } from './entity';
import { Scope } from './scope';

export class Document implements IDocument {
  protected _root: ASTChunk;
  protected _scopeMapping: WeakMap<ASTBaseBlockWithScope, ScopeContext>;
  protected _container: IContainerProxy;
  protected _globals: IEntity;
  protected _intrinscis: Intrinsics;
  protected _api: IEntity;
  protected _source: string;

  get source() {
    return this._source;
  }

  get root() {
    return this._root;
  }

  get container() {
    return this._container;
  }

  get intrinsics() {
    return this._intrinscis;
  }

  get globals() {
    return this._globals;
  }

  get api() {
    return this._api;
  }

  constructor(options: DocumentOptions) {
    this._source = options.source;
    this._root = options.root;
    this._container = options.container;
    this._scopeMapping = options.scopeMapping ?? new WeakMap();
    this._intrinscis = options.intrinsics ?? this.createIntrinscis();
    this._api = options.api ?? this.initApi();
    this._globals = options.globals ?? this.initGlobals();
  }

  protected createIntrinscis(): Intrinsics {
    return {
      map: this._container.primitives.get(SignatureDefinitionBaseType.Map),
      funcRef: this._container.primitives.get(
        SignatureDefinitionBaseType.Function
      ),
      number: this._container.primitives.get(
        SignatureDefinitionBaseType.Number
      ),
      string: this._container.primitives.get(
        SignatureDefinitionBaseType.String
      ),
      list: this._container.primitives.get(SignatureDefinitionBaseType.List)
    };
  }

  protected initApi() {
    const general = this._container.primitives.get(
      SignatureDefinitionBaseType.General
    );

    general.resolveProperty('map', true).setReturnEntity(this._intrinscis.map);
    general
      .resolveProperty('funcRef', true)
      .setReturnEntity(this._intrinscis.funcRef);
    general
      .resolveProperty('number', true)
      .setReturnEntity(this._intrinscis.number);
    general
      .resolveProperty('string', true)
      .setReturnEntity(this._intrinscis.string);
    general
      .resolveProperty('list', true)
      .setReturnEntity(this._intrinscis.list);

    return general;
  }

  protected initGlobals(): IEntity {
    return new Entity({
      source: this._source,
      kind: CompletionItemKind.Constant,
      container: this._container,
      label: 'globals'
    }).addType(SignatureDefinitionBaseType.Map);
  }

  protected analyzeScope(block: ASTFunctionStatement): void {
    const parentContext = this._scopeMapping.get(block.scope)!;
    const scope = new Scope({
      source: this._source,
      container: this._container,
      parent: parentContext?.scope,
      globals: this._globals
    });
    const aggregator = new Aggregator({
      scope,
      root: block,
      document: this,
      parent: parentContext?.aggregator
    });

    this._scopeMapping.set(block, {
      scope,
      aggregator
    });

    const fnEntity =
      block.assignment instanceof ASTAssignmentStatement
        ? this.resolveNamespace(block.assignment.variable, true)
        : null;

    // set context for function block/scope
    if (fnEntity !== null) {
      const context = fnEntity?.context;

      if (
        context != null &&
        context.types.has(SignatureDefinitionBaseType.Map) &&
        context !== this._globals
      ) {
        scope.setContext(context);
      }
    }

    aggregator.analyze();

    // override argument types if custom
    if (fnEntity !== null) {
      const fnDef =
        fnEntity.signatureDefinitions.last() as SignatureDefinitionFunction;

      if (fnDef != null) {
        const args = fnDef.getArguments();

        for (let index = 0; index < args.length; index++) {
          const arg = args[index];
          const property = scope.resolveProperty(arg.getLabel(), true);
          const types = arg.getTypes();
          if (property === null) {
            scope.setProperty(
              arg.getLabel(),
              new Entity({
                source: this._source,
                kind: CompletionItemKind.Variable,
                container: this._container
              }).addTypesWithMeta(types)
            );
          } else {
            property.types.delete(SignatureDefinitionBaseType.Any);
            property.addTypesWithMeta(types);
          }
        }
      }
    }
  }

  analyze() {
    const scope = new Scope({
      source: this._source,
      container: this._container,
      globals: this._globals,
      locals: this._globals
    });
    const aggregator = new Aggregator({
      scope,
      root: this._root,
      document: this
    });

    this._scopeMapping.set(this._root, {
      scope,
      aggregator
    });

    aggregator.analyze();

    for (let index = 0; index < this._root.scopes.length; index++) {
      const item = this._root.scopes[index];
      this.analyzeScope(item as ASTFunctionStatement);
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

  getLastASTItemOfLine(line: number): ASTBase {
    const items = this._root.lines[line];

    if (items && items.length > 0) {
      return items[items.length - 1];
    }

    return null;
  }

  findASTItemInLine(line: number, type: ASTType): ASTBase {
    const items = this._root.lines[line];

    if (items && items.length > 0) {
      const result = items.find((item) => item.type === type);

      if (result) {
        return result;
      }
    }

    return null;
  }

  resolveAllAssignmentsWithQuery(query: string): ASTDefinitionItem[] {
    const assignments: ASTDefinitionItem[] = [];
    const scopes = [this._root, ...this._root.scopes];

    for (let index = 0; index < scopes.length; index++) {
      const current = this._scopeMapping.get(scopes[index]).aggregator;
      const definitions = current.definitions;

      definitions.forEach((_, definitionId) => {
        if (definitionId.includes(query)) {
          const definition = definitions.get(definitionId)!;
          merge(assignments, definition);
        }
      });
    }

    return assignments;
  }

  resolveAvailableAssignments(item: ASTBase): ASTDefinitionItem[] {
    return (
      this._scopeMapping
        .get(item.scope)
        ?.aggregator.resolveAvailableAssignments(item) ?? []
    );
  }

  resolveType(item: ASTBase, noInvoke?: boolean): IEntity | null {
    return (
      this._scopeMapping
        .get(item.scope)
        ?.aggregator.resolveType(item, noInvoke) ?? null
    );
  }

  resolveTypeWithDefault(item: ASTBase, noInvoke?: boolean): IEntity {
    return this._scopeMapping
      .get(item.scope)
      ?.aggregator.resolveTypeWithDefault(item, noInvoke);
  }

  resolveNamespace(item: ASTBase, noInvoke: boolean = false): IEntity | null {
    return (
      this._scopeMapping
        .get(item.scope)
        ?.aggregator.resolveNamespace(item, noInvoke) ?? null
    );
  }

  merge(...typeDocs: Document[]): Document {
    const newTypeDoc = new Document({
      source: this._source,
      root: this._root,
      container: this._container.copy()
    });

    for (let index = 0; index < typeDocs.length; index++) {
      const typeDoc = typeDocs[index];
      newTypeDoc._globals.extend(typeDoc._globals, true, true);
      newTypeDoc._intrinscis.map.extend(typeDoc._intrinscis.map, true, true);
      newTypeDoc._intrinscis.funcRef.extend(
        typeDoc._intrinscis.funcRef,
        true,
        true
      );
      newTypeDoc._intrinscis.number.extend(
        typeDoc._intrinscis.number,
        true,
        true
      );
      newTypeDoc._intrinscis.string.extend(
        typeDoc._intrinscis.string,
        true,
        true
      );
      newTypeDoc._intrinscis.list.extend(typeDoc._intrinscis.list, true, true);
      newTypeDoc._container.mergeCustomTypes(typeDoc._container);
    }

    newTypeDoc.analyze();

    for (let index = 0; index < typeDocs.length; index++) {
      const typeDoc = typeDocs[index];
      newTypeDoc
        .getRootScopeContext()
        .aggregator.extend(typeDoc.getRootScopeContext().aggregator);
    }

    return newTypeDoc;
  }
}
