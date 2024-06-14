import {
  Container,
  SignatureDefinitionBaseType,
  SignatureDefinitionFunction,
  SignatureDefinitionType
} from 'meta-utils';
import {
  ASTAssignmentStatement,
  ASTBaseBlockWithScope,
  ASTChunk
} from 'miniscript-core';

import { CompletionItemKind } from '../types/completion';
import {
  DocumentOptions,
  IDocument,
  Intrinsics,
  ScopeContext
} from '../types/document';
import { IEntity } from '../types/object';
import { Aggregator } from './aggregator';
import { Entity } from './entity';
import { Scope } from './scope';

export class Document implements IDocument {
  protected _root: ASTChunk;
  protected _scopeMapping: WeakMap<ASTBaseBlockWithScope, ScopeContext>;
  protected _container: Container;
  protected _globals: IEntity;
  protected _intrinscis: Intrinsics;

  get container() {
    return this._container;
  }

  get intrinsics() {
    return this._intrinscis;
  }

  get globals() {
    return this._globals;
  }

  constructor(options: DocumentOptions) {
    this._root = options.root;
    this._container = options.container;
    this._scopeMapping = options.scopeMapping ?? new WeakMap();
    this._intrinscis = options.intrinsics ?? this.createIntrinscis();
    this._globals = options.globals ?? this.initGlobals();
  }

  protected createIntrinscis(): Intrinsics {
    return {
      map: new Entity({
        kind: CompletionItemKind.Constant,
        document: this
      })
        .addType(SignatureDefinitionBaseType.Map)
        .insertSignature(
          this._container.getTypeSignature(SignatureDefinitionBaseType.Map)
        ),
      funcRef: new Entity({
        kind: CompletionItemKind.Constant,
        document: this
      })
        .addType(SignatureDefinitionBaseType.Map)
        .insertSignature(
          this._container.getTypeSignature(SignatureDefinitionBaseType.Function)
        ),
      number: new Entity({
        kind: CompletionItemKind.Constant,
        document: this
      })
        .addType(SignatureDefinitionBaseType.Map)
        .insertSignature(
          this._container.getTypeSignature(SignatureDefinitionBaseType.Number)
        ),
      string: new Entity({
        kind: CompletionItemKind.Constant,
        document: this
      })
        .addType(SignatureDefinitionBaseType.Map)
        .insertSignature(
          this._container.getTypeSignature(SignatureDefinitionBaseType.String)
        ),
      list: new Entity({
        kind: CompletionItemKind.Constant,
        document: this
      })
        .addType(SignatureDefinitionBaseType.Map)
        .insertSignature(
          this._container.getTypeSignature(SignatureDefinitionBaseType.List)
        )
    };
  }

  protected initGlobals(): IEntity {
    const globals = new Entity({
      kind: CompletionItemKind.Constant,
      document: this
    })
      .addType(SignatureDefinitionBaseType.Map)
      .insertSignature(
        this._container.getTypeSignature(SignatureDefinitionBaseType.General)
      );

    globals.resolveProperty('map', true).setReturnEntity(this._intrinscis.map);
    globals
      .resolveProperty('funcRef', true)
      .setReturnEntity(this._intrinscis.funcRef);
    globals
      .resolveProperty('number', true)
      .setReturnEntity(this._intrinscis.number);
    globals
      .resolveProperty('string', true)
      .setReturnEntity(this._intrinscis.string);
    globals
      .resolveProperty('list', true)
      .setReturnEntity(this._intrinscis.list);

    return globals;
  }

  protected analyzeScope(block: ASTBaseBlockWithScope): void {
    const parentContext = block.scope
      ? this._scopeMapping.get(block.scope)
      : null;
    const scope = new Scope({
      document: this,
      parent: parentContext?.scope,
      globals: this._globals
    });
    const aggregator = new Aggregator({
      scope,
      root: this._root,
      document: this
    });

    for (let index = 0; index < block.assignments.length; index++) {
      const item = block.assignments[index] as ASTAssignmentStatement;
      const value =
        aggregator.resolveType(item.init) ??
        new Entity({
          kind: CompletionItemKind.Value,
          document: this
        }).addType(SignatureDefinitionBaseType.Any);

      aggregator.defineNamespace(item.variable, value);
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

  protected hasDefinitionEx(type: SignatureDefinitionType, property: string) {
    switch (type) {
      case SignatureDefinitionBaseType.Function:
        return this._intrinscis.funcRef.values.has(`i:${property}`);
      case SignatureDefinitionBaseType.Map:
        return this._intrinscis.map.values.has(`i:${property}`);
      case SignatureDefinitionBaseType.List:
        return this._intrinscis.list.values.has(`i:${property}`);
      case SignatureDefinitionBaseType.String:
        return this._intrinscis.string.values.has(`i:${property}`);
      case SignatureDefinitionBaseType.Number:
        return this._intrinscis.number.values.has(`i:${property}`);
      default:
        const signature = this._container.getTypeSignature(type);
        return signature !== null && !!signature.getDefinitions()[property];
    }
  }

  hasDefinition(types: SignatureDefinitionType[], property: string): boolean {
    for (const type of types) {
      if (this.hasDefinitionEx(type, property)) return true;
    }
    return false;
  }

  protected resolveDefinitionEx(
    type: SignatureDefinitionType,
    property: string
  ): IEntity | null {
    switch (type) {
      case SignatureDefinitionBaseType.Function:
        return this._intrinscis.funcRef.values.get(`i:${property}`) ?? null;
      case SignatureDefinitionBaseType.Map:
        return this._intrinscis.map.values.get(`i:${property}`) ?? null;
      case SignatureDefinitionBaseType.List:
        return this._intrinscis.list.values.get(`i:${property}`) ?? null;
      case SignatureDefinitionBaseType.String:
        return this._intrinscis.string.values.get(`i:${property}`) ?? null;
      case SignatureDefinitionBaseType.Number:
        return this._intrinscis.number.values.get(`i:${property}`) ?? null;
      default:
        return null;
    }
  }

  resolveDefinition(
    types: SignatureDefinitionType[],
    property: string,
    noInvoke: boolean = false
  ): IEntity {
    const innerMatchingEntity: IEntity = new Entity({
      kind: CompletionItemKind.Value,
      document: this
    });
    const signatureDef = this._container.getDefinition(types, property);

    for (const type of types) {
      const item = this.resolveDefinitionEx(type, property);
      if (item !== null) innerMatchingEntity.extend(item);
    }

    if (innerMatchingEntity.types.size > 0) {
      return innerMatchingEntity;
    }

    if (signatureDef === null) {
      return new Entity({
        kind: CompletionItemKind.Variable,
        document: this
      }).addType(SignatureDefinitionBaseType.Any);
    }

    if (
      signatureDef.getType().type === SignatureDefinitionBaseType.Function &&
      !noInvoke
    ) {
      const fnDef = signatureDef as SignatureDefinitionFunction;
      return new Entity({
        kind: CompletionItemKind.Variable,
        document: this
      }).addType(...fnDef.getReturns().map((item) => item.type));
    }

    return new Entity({
      kind: CompletionItemKind.Variable,
      document: this
    }).addSignatureType(signatureDef);
  }

  getPropertiesOfType(type: SignatureDefinitionType): string[] {
    switch (type) {
      case SignatureDefinitionBaseType.Function:
        return Array.from(this._intrinscis.funcRef.values.keys()).map((key) =>
          key.slice(2)
        );
      case SignatureDefinitionBaseType.Map:
        return Array.from(this._intrinscis.map.values.keys()).map((key) =>
          key.slice(2)
        );
      case SignatureDefinitionBaseType.List:
        return Array.from(this._intrinscis.list.values.keys()).map((key) =>
          key.slice(2)
        );
      case SignatureDefinitionBaseType.String:
        return Array.from(this._intrinscis.string.values.keys()).map((key) =>
          key.slice(2)
        );
      case SignatureDefinitionBaseType.Number:
        return Array.from(this._intrinscis.number.values.keys()).map((key) =>
          key.slice(2)
        );
      default:
        const signature = this._container.getTypeSignature(type);
        if (signature === null) return [];
        return Object.keys(signature.getDefinitions());
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

  merge(...typeDocs: Document[]): Document {
    const newTypeDoc = new Document({
      root: this._root,
      container: this._container
    });

    for (const typeDoc of typeDocs) {
      newTypeDoc._globals.extend(typeDoc._globals);
      newTypeDoc._intrinscis.map.extend(typeDoc._intrinscis.map);
      newTypeDoc._intrinscis.funcRef.extend(typeDoc._intrinscis.funcRef);
      newTypeDoc._intrinscis.number.extend(typeDoc._intrinscis.number);
      newTypeDoc._intrinscis.string.extend(typeDoc._intrinscis.string);
      newTypeDoc._intrinscis.list.extend(typeDoc._intrinscis.list);
    }

    newTypeDoc.analyze();

    return newTypeDoc;
  }
}
