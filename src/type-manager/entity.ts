import {
  Signature,
  SignatureDefinition,
  SignatureDefinitionBaseType,
  SignatureDefinitionFunction,
  SignatureDefinitionType
} from 'meta-utils';

import { CompletionItem, CompletionItemKind } from '../types/completion';
import { IContainerProxy } from '../types/container-proxy';
import {
  ASTDefinitionItem,
  EntityCopyOptions,
  EntityExtendStackItem,
  EntityOptions,
  IEntity,
  IEntityPropertyHandler
} from '../types/object';
import { isSignatureDefinitionFunction } from '../types/signature';
import { injectIdentifers } from '../utils/inject-identifiers';
import { isEligibleForProperties } from '../utils/is-eligible-for-properties';
import { lookupProperty } from '../utils/lookup-property';
import { mergeUnique } from '../utils/mergeUnique';
import { ObjectSet } from '../utils/object-set';

export const resolveEntity = (
  container: IContainerProxy,
  entity: IEntity,
  noInvoke: boolean = false
) => {
  if (entity.isCallable() && !noInvoke) {
    const returnEntity = entity.getReturnEntity();

    if (returnEntity !== null) {
      return returnEntity;
    }

    const returnTypes = entity.getCallableReturnTypes();

    if (returnTypes) {
      return new Entity({
        source: entity.source,
        kind: CompletionItemKind.Variable,
        container,
        label: entity.label,
        context: entity.context
      }).addTypes(returnTypes);
    }

    return new Entity({
      source: entity.source,
      kind: CompletionItemKind.Variable,
      container,
      label: entity.label,
      context: entity.context
    }).addType(SignatureDefinitionBaseType.Any);
  }

  return entity;
};

const identifierPropertyHandler: IEntityPropertyHandler<string> = {
  hasProperty(
    origin: IEntity,
    container: IContainerProxy,
    property: string
  ): boolean {
    return (
      !!lookupProperty(origin, property) ||
      (!origin.isAPI() &&
        !!container.getDefinition(Array.from(origin.types), property, true))
    );
  },

  resolveProperty(
    origin: IEntity,
    container: IContainerProxy,
    property: string,
    noInvoke: boolean = false
  ): IEntity | null {
    const entity = lookupProperty(origin, property) ?? null;

    if (entity == null) {
      if (!origin.isAPI()) {
        return container.getDefinition(
          Array.from(origin.types),
          property,
          noInvoke
        );
      }

      return null;
    }

    return resolveEntity(container, entity, noInvoke);
  },

  setProperty(
    origin: IEntity,
    container: IContainerProxy,
    property: string,
    entity: IEntity
  ): boolean {
    if (!isEligibleForProperties(origin)) return false;

    const key = `i:${property}`;
    const existingEntity = origin.values.get(key);

    if (existingEntity) {
      existingEntity.extend(entity);
    } else {
      origin.values.set(
        key,
        entity.copy({
          container,
          label: property,
          context: origin,
          definitions: []
        })
      );
    }

    return true;
  }
};

const entityPropertyHandler: IEntityPropertyHandler<IEntity> = {
  hasProperty(
    origin: IEntity,
    _container: IContainerProxy,
    property: IEntity
  ): boolean {
    if (!isEligibleForProperties(origin)) return false;
    for (const type of property.types) {
      if (origin.values.has(`t:${type}`)) {
        return true;
      }
    }
    return false;
  },

  resolveProperty(
    origin: IEntity,
    container: IContainerProxy,
    property: IEntity,
    noInvoke: boolean = false
  ): IEntity | null {
    if (!isEligibleForProperties(origin)) {
      return new Entity({
        source: origin.source,
        kind: CompletionItemKind.Variable,
        container,
        label: property.label,
        context: origin
      }).addType(SignatureDefinitionBaseType.Any);
    }

    const aggregatedEntity = new Entity({
      source: property.source,
      kind: CompletionItemKind.Variable,
      container,
      label: property.label,
      context: origin
    });

    for (const type of property.types) {
      const entity = origin.values.get(`t:${type}`);
      if (!entity) continue;
      aggregatedEntity.extend(entity);
    }

    if (aggregatedEntity.types.size === 0) {
      aggregatedEntity.addType(SignatureDefinitionBaseType.Any);
    }

    return resolveEntity(container, aggregatedEntity, noInvoke);
  },

  setProperty(
    origin: IEntity,
    container: IContainerProxy,
    property: IEntity,
    entity: IEntity
  ): boolean {
    if (!isEligibleForProperties(origin)) return false;
    for (const type of property.types) {
      const key = `t:${type}`;
      const existingEntity = origin.values.get(key);

      if (existingEntity) {
        existingEntity.extend(entity);
      } else {
        origin.values.set(
          key,
          entity.copy({
            container,
            label: type,
            context: origin,
            definitions: []
          })
        );
      }
    }
    return true;
  }
};

export class Entity implements IEntity {
  protected _source: string;
  protected _kind: CompletionItemKind;
  protected _line: number;
  protected _context: IEntity | null;
  protected _label: string;
  protected _container: IContainerProxy;
  protected _signatureDefinitions: ObjectSet<SignatureDefinition>;
  protected _returnEntity: IEntity | null;
  protected _types: Set<SignatureDefinitionType>;
  protected _values: Map<string, IEntity>;
  protected _isAPI: boolean;
  protected _isFromSignature: boolean;
  protected _definitions: ASTDefinitionItem[];

  get source() {
    return this._source;
  }

  get definitions() {
    return this._definitions;
  }

  get kind() {
    return this._kind;
  }

  get line() {
    return this._line;
  }

  get signatureDefinitions() {
    return this._signatureDefinitions;
  }

  get context() {
    return this._context;
  }

  get label() {
    return this._label;
  }

  get types() {
    return this._types;
  }

  get values() {
    return this._values;
  }

  constructor(options: EntityOptions) {
    this._source = options.source;
    this._isAPI = options.isAPI ?? false;
    this._isFromSignature = options.isFromSignature ?? false;
    this._kind = options.kind;
    this._line = options.line ?? -1;
    this._label = options.label ?? 'anonymous';
    this._signatureDefinitions =
      options.signatureDefinitions ?? new ObjectSet();
    this._types = options.types ?? new Set();
    this._values = options.values ?? new Map();
    this._context = options.context ?? null;
    this._container = options.container;
    this._definitions = options.definitions ?? [];
    this._returnEntity = options.returnEntity ?? null;
  }

  isFromSignature(): boolean {
    return this._isFromSignature;
  }

  hasContext() {
    return this._context != null && !this._context.isAPI;
  }

  getIsa() {
    return this._values.get('i:__isa') ?? null;
  }

  hasIsa() {
    return this._values.has('i:__isa');
  }

  isAPI() {
    return this._isAPI;
  }

  isCallable() {
    return this._types.has(SignatureDefinitionBaseType.Function);
  }

  getCallableReturnTypes(): string[] | null {
    if (!this.isCallable()) return null;
    const functionDefs = Array.from(this._signatureDefinitions).filter((item) =>
      isSignatureDefinitionFunction(item)
    ) as SignatureDefinitionFunction[];
    if (functionDefs.length === 0) return null;
    return functionDefs
      .flatMap((item) => item.getReturns())
      .map((item) => item.type);
  }

  addSignatureType(definition: SignatureDefinition): this {
    this._signatureDefinitions.add(definition);
    this.addType(definition.getType().type);
    return this;
  }

  setReturnEntity(entitiy: IEntity): this {
    this._returnEntity = entitiy;
    return this;
  }

  getReturnEntity(): IEntity | null {
    return this._returnEntity;
  }

  setKind(kind: CompletionItemKind): this {
    this._kind = kind;
    return this;
  }

  setLine(line: number): this {
    this._line = line;
    return this;
  }

  setLabel(label: string): this {
    this._label = label;
    return this;
  }

  setContext(context: IEntity): this {
    this._context = context;
    return this;
  }

  addType(type: SignatureDefinitionType): this {
    this._types.add(type);
    return this;
  }

  addTypes(types: SignatureDefinitionType[]): this {
    for (let index = 0; index < types.length; index++) {
      this._types.add(types[index]);
    }
    return this;
  }

  hasProperty(property: string | IEntity): boolean {
    switch (typeof property) {
      case 'object': {
        return entityPropertyHandler.hasProperty(
          this,
          this._container,
          property as IEntity
        );
      }
      default: {
        return identifierPropertyHandler.hasProperty(
          this,
          this._container,
          property
        );
      }
    }
  }

  resolveProperty(
    property: string | IEntity,
    noInvoke: boolean = false
  ): IEntity | null {
    switch (typeof property) {
      case 'object': {
        return entityPropertyHandler.resolveProperty(
          this,
          this._container,
          property as IEntity,
          noInvoke
        );
      }
      default: {
        return identifierPropertyHandler.resolveProperty(
          this,
          this._container,
          property,
          noInvoke
        );
      }
    }
  }

  setProperty(property: string | IEntity, entity: IEntity): boolean {
    switch (typeof property) {
      case 'object': {
        return entityPropertyHandler.setProperty(
          this,
          this._container,
          property as IEntity,
          entity
        );
      }
      default: {
        return identifierPropertyHandler.setProperty(
          this,
          this._container,
          property,
          entity
        );
      }
    }
  }

  extend(
    entity: IEntity,
    includeDefinitions: boolean = false,
    deepCopy: boolean = false
  ): this {
    if (entity === this) return this;

    const refs: WeakSet<IEntity> = new WeakSet([entity]);
    const stack: EntityExtendStackItem[] = [{ target: this, source: entity }];

    while (stack.length > 0) {
      const current = stack.pop()!;
      const target = current.target as Entity;
      const source = current.source as Entity;

      target._isFromSignature = false;
      target._signatureDefinitions.extend(source._signatureDefinitions);

      if (includeDefinitions) {
        if (deepCopy) {
          target._definitions = [
            ...target._definitions,
            ...source._definitions
          ];
        } else {
          mergeUnique(target._definitions, source._definitions);
        }
      }

      target.addTypes(Array.from(source.types));

      for (const [key, value] of source.values) {
        const item = target._values.get(key);

        if (item == null) {
          target._values.set(
            key,
            value.copy({
              container: target._container,
              context: target,
              deepCopy
            })
          );
        } else if (!refs.has(value)) {
          refs.add(value);
          stack.push({ target: item, source: value });
        }
      }
    }
    return this;
  }

  insertSignature(signature: Signature): this {
    const properties = Object.keys(signature.getDefinitions());

    this.addType(SignatureDefinitionBaseType.Map);

    for (let index = 0; index < properties.length; index++) {
      const property = properties[index];
      const definition = signature.getDefinition(property);
      const entity = new Entity({
        source: this._source,
        label: property,
        kind:
          definition.getType().type === SignatureDefinitionBaseType.Function
            ? CompletionItemKind.Function
            : CompletionItemKind.Property,
        container: this._container,
        isFromSignature: true
      });

      entity.addSignatureType(definition);
      this.setProperty(property, entity);
    }

    return this;
  }

  getAllIdentifier(): Map<string, CompletionItem> {
    const properties = new Map();

    for (const type of this._types) {
      const items = this._container.getAllIdentifier(type);
      for (const keyPair of items) {
        properties.set(...keyPair);
      }
    }

    injectIdentifers(properties, this);

    return properties;
  }

  toJSONInternal(visited = new WeakMap()) {
    if (visited.has(this)) {
      return visited.get(this);
    }

    const ref: Partial<{
      kind: CompletionItemKind;
      signatureDefinitions: object;
      types: string[];
      values: Record<string, object>;
    }> = {};

    visited.set(this, ref);

    ref.kind = this.kind;
    ref.signatureDefinitions = this._signatureDefinitions.toJSON();
    ref.types = Array.from(this._types);
    ref.values = Array.from(this._values).reduce<Record<string, object>>(
      (result, [key, value]) => {
        // for some reason value can be null here but shouldn't
        result[key] = (value as Entity)?.toJSONInternal(visited);
        return result;
      },
      {}
    );

    return ref;
  }

  toJSON() {
    return this.toJSONInternal();
  }

  copy(options: EntityCopyOptions = {}): IEntity {
    const newCopy = new Entity({
      source: options.source ?? this._source,
      kind: options.kind ?? this._kind,
      line: options.line ?? this._line,
      isFromSignature: options.isFromSignature ?? this._isFromSignature,
      isAPI: options.isAPI ?? this._isAPI,
      container: options.container ?? this._container,
      label: options.label ?? this._label,
      context: options.context ?? this._context,
      signatureDefinitions: new ObjectSet(
        Array.from(this._signatureDefinitions, (value) => value.copy())
      ),
      types: new Set(this._types),
      returnEntity: this._returnEntity,
      values: options.values ?? this.values,
      definitions: options.definitions ?? this._definitions
    });

    if (!options.deepCopy) {
      return newCopy;
    }

    const cache = new WeakMap<IEntity, IEntity>();

    function deepCopyEntity(newContext: IEntity, entity: IEntity): IEntity {
      const cachedCopy = cache.get(entity);

      if (cachedCopy) {
        return cachedCopy;
      }

      const entityCopy = entity.copy({
        container: options.container,
        line: options.line,
        context: newContext,
        values: new Map()
      }) as Entity;

      cache.set(entity, entityCopy);

      for (const [key, value] of entity.values) {
        entityCopy._values.set(key, deepCopyEntity(entityCopy, value));
      }

      entityCopy._definitions = [...entity.definitions];

      return entityCopy;
    }

    newCopy._values = new Map();

    for (const [key, value] of this._values) {
      newCopy._values.set(key, deepCopyEntity(newCopy, value));
    }

    newCopy._definitions = [...this._definitions];

    return newCopy;
  }
}
