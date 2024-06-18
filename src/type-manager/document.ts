import {
  Container,
  Signature,
  SignatureDefinitionBaseType,
  SignatureDefinitionFunction,
  SignatureDefinitionType
} from 'meta-utils';
import {
  ASTAssignmentStatement,
  ASTBase,
  ASTBaseBlockWithScope,
  ASTChunk,
  ASTFunctionStatement,
  ASTType
} from 'miniscript-core';

import { CompletionItem, CompletionItemKind } from '../types/completion';
import {
  DocumentOptions,
  IDocument,
  Intrinsics,
  ScopeContext
} from '../types/document';
import { IEntity } from '../types/object';
import { Aggregator } from './aggregator';
import { Entity, resolveEntity } from './entity';
import { Scope } from './scope';

const insertSignatureToProperties = (
  properties: Map<string, CompletionItem>,
  signature: Signature
) => {
  const signatureKeys = Object.keys(signature.getDefinitions());
  for (const property of signatureKeys) {
    properties.set(property, {
      kind: CompletionItemKind.Function,
      line: -1
    });
  }
};

const insertIntrinsicToProperties = (
  properties: Map<string, CompletionItem>,
  intrinsic: Map<string, IEntity>
) => {
  for (const [property, entity] of intrinsic) {
    properties.set(property.slice(2), {
      kind: entity.kind,
      line: entity.line
    });
  }
};

export class Document implements IDocument {
  protected _root: ASTChunk;
  protected _scopeMapping: WeakMap<ASTBaseBlockWithScope, ScopeContext>;
  protected _container: Container;
  protected _globals: IEntity;
  protected _intrinscis: Intrinsics;

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
      document: this,
      label: 'globals'
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

  protected analyzeScope(block: ASTFunctionStatement): void {
    const parentContext = this._scopeMapping.get(block.scope)!;
    const scope = new Scope({
      document: this,
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

    if (block.assignment instanceof ASTAssignmentStatement) {
      const fnEntity = this.resolveNamespace(block.assignment.variable, true);
      const fnDef =
        fnEntity.signatureDefinitions.first() as SignatureDefinitionFunction;

      if (fnDef != null) {
        for (const arg of fnDef.getArguments()) {
          const property = scope.resolveProperty(arg.getLabel(), true);
          if (property === null) continue;
          property.types.delete(SignatureDefinitionBaseType.Any);
          property.addType(...arg.getTypes().map((it) => it.type));
        }
      }

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
  }

  analyze() {
    const scope = new Scope({
      document: this,
      globals: this._globals,
      locals: this._globals
    });
    const aggregator = new Aggregator({
      scope,
      root: this._root,
      document: this
    });

    aggregator.analyze();

    this._scopeMapping.set(this._root, {
      scope,
      aggregator
    });

    for (let index = 0; index < this._root.scopes.length; index++) {
      const item = this._root.scopes[index];
      this.analyzeScope(item as ASTFunctionStatement);
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
    const uniqTypes = new Set(types);

    if (uniqTypes.has(SignatureDefinitionBaseType.Any)) {
      uniqTypes.add(SignatureDefinitionBaseType.Function);
      uniqTypes.add(SignatureDefinitionBaseType.Map);
      uniqTypes.add(SignatureDefinitionBaseType.List);
      uniqTypes.add(SignatureDefinitionBaseType.String);
      uniqTypes.add(SignatureDefinitionBaseType.Number);
    }

    for (const type of uniqTypes) {
      if (this.hasDefinitionEx(type, property)) return true;
    }

    return false;
  }

  protected resolveInnerDefinition(
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

  protected resolveInnerDefintions(
    types: SignatureDefinitionType[],
    property: string
  ): IEntity | null {
    const uniqTypes = new Set(types);

    if (uniqTypes.has(SignatureDefinitionBaseType.Any)) {
      uniqTypes.add(SignatureDefinitionBaseType.Function);
      uniqTypes.add(SignatureDefinitionBaseType.Map);
      uniqTypes.add(SignatureDefinitionBaseType.List);
      uniqTypes.add(SignatureDefinitionBaseType.String);
      uniqTypes.add(SignatureDefinitionBaseType.Number);
    }

    const innerMatchingEntity: IEntity = new Entity({
      kind: CompletionItemKind.Variable,
      document: this,
      label: property
    });

    for (const type of uniqTypes) {
      const item = this.resolveInnerDefinition(type, property);
      if (item !== null) innerMatchingEntity.extend(item);
    }

    return innerMatchingEntity.types.size > 0 ? innerMatchingEntity : null;
  }

  protected resolveExternalDefinitions(
    types: SignatureDefinitionType[],
    property: string
  ): IEntity | null {
    const signatureDef = this._container.getDefinition(types, property);

    if (signatureDef === null) {
      return null;
    }

    return new Entity({
      kind:
        signatureDef.getType().type === SignatureDefinitionBaseType.Function
          ? CompletionItemKind.Function
          : CompletionItemKind.Variable,
      document: this,
      label: property
    }).addSignatureType(signatureDef);
  }

  resolveDefinition(
    types: SignatureDefinitionType[],
    property: string,
    noInvoke: boolean = false
  ): IEntity {
    const innerMatchingEntity = this.resolveInnerDefintions(types, property);
    const externalDefinitionEntity = this.resolveExternalDefinitions(
      types,
      property
    );

    if (innerMatchingEntity === null && externalDefinitionEntity === null) {
      return new Entity({
        kind: CompletionItemKind.Variable,
        document: this,
        label: property
      }).addType(SignatureDefinitionBaseType.Any);
    }

    const mergedEntity = new Entity({
      kind: CompletionItemKind.Variable,
      document: this,
      label: property
    });

    if (innerMatchingEntity !== null) mergedEntity.extend(innerMatchingEntity);
    if (externalDefinitionEntity !== null)
      mergedEntity.extend(externalDefinitionEntity);

    return resolveEntity(this, mergedEntity, noInvoke);
  }

  protected getAllProperties(): Map<string, CompletionItem> {
    const properties = new Map();

    for (const signature of this._container.getTypes().values()) {
      insertSignatureToProperties(properties, signature);
    }

    const intrinsics = [
      this._intrinscis.funcRef.values,
      this._intrinscis.map.values,
      this._intrinscis.list.values,
      this._intrinscis.string.values,
      this._intrinscis.number.values
    ];

    for (const intrinsic of intrinsics) {
      insertIntrinsicToProperties(properties, intrinsic);
    }

    return properties;
  }

  getPropertiesOfType(
    type: SignatureDefinitionType
  ): Map<string, CompletionItem> {
    if (type === SignatureDefinitionBaseType.Any) {
      return this.getAllProperties();
    }

    const properties = new Map();

    switch (type) {
      case SignatureDefinitionBaseType.Function: {
        insertIntrinsicToProperties(
          properties,
          this._intrinscis.funcRef.values
        );
        break;
      }
      case SignatureDefinitionBaseType.Map: {
        insertIntrinsicToProperties(properties, this._intrinscis.map.values);
        break;
      }
      case SignatureDefinitionBaseType.List: {
        insertIntrinsicToProperties(properties, this._intrinscis.list.values);
        break;
      }
      case SignatureDefinitionBaseType.String: {
        insertIntrinsicToProperties(properties, this._intrinscis.string.values);
        break;
      }
      case SignatureDefinitionBaseType.Number: {
        insertIntrinsicToProperties(properties, this._intrinscis.number.values);
        break;
      }
      default: {
        const signature = this._container.getTypeSignature(type);
        if (signature !== null) {
          insertSignatureToProperties(properties, signature);
        }
        break;
      }
    }

    return properties;
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
    if (this._root.lines.has(line)) {
      const items = this._root.lines.get(line);

      if (items.length > 0) {
        return items[items.length - 1];
      }
    }

    return null;
  }

  findASTItemInLine(line: number, type: ASTType): ASTBase {
    if (this._root.lines.has(line)) {
      const items = this._root.lines.get(line);
      const result = items.find((item) => item.type === type);

      if (result) {
        return result;
      }
    }

    return null;
  }

  resolveAllAssignmentsWithQuery(query: string): ASTAssignmentStatement[] {
    const assignments: ASTAssignmentStatement[] = [];
    const scopes = [this._root, ...this._root.scopes];

    for (let index = 0; index < scopes.length; index++) {
      const current = this._scopeMapping.get(scopes[index]).aggregator;
      const definitions = current.definitions;

      for (const definitionId of definitions.keys()) {
        if (definitionId.includes(query)) {
          const definition = definitions.get(definitionId)!;
          assignments.push(...definition);
        }
      }
    }

    return assignments;
  }

  resolveAvailableAssignments(item: ASTBase): ASTAssignmentStatement[] {
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
