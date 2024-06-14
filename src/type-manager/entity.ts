import {
  Container,
  Signature,
  SignatureDefinition,
  SignatureDefinitionBaseType,
  SignatureDefinitionFunction,
  SignatureDefinitionType
} from 'meta-utils';

import { CompletionItemKind } from '../types/completion';
import {
  EntityOptions,
  IEntity,
  IEntityPropertyHandler
} from '../types/object';
import { isSignatureDefinitionFunction } from '../types/signature';
import { ObjectSet } from '../utils/object-set';

const isEligibleForProperties = (entity: IEntity) => {
  return (
    entity.types.has(SignatureDefinitionBaseType.Map) ||
    entity.types.has(SignatureDefinitionBaseType.Any)
  );
};

const lookupProperty = (entity: IEntity, property: string): IEntity | null => {
  let current = entity;

  while (isEligibleForProperties(current)) {
    const item = current.values.get(`i:${property}`);

    if (item != null) {
      return item;
    }

    const isa = current.values.get('i:__isa');

    if (isa == null) {
      break;
    }

    current = isa;
  }

  return null;
};

export const resolveEntity = (
  container: Container,
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
        kind: CompletionItemKind.Variable,
        container
      }).addType(...returnTypes);
    }

    return new Entity({
      kind: CompletionItemKind.Variable,
      container
    }).addType(SignatureDefinitionBaseType.Any);
  }

  return entity;
};

const identifierPropertyHandler: IEntityPropertyHandler<string> = {
  hasProperty(origin: IEntity, property: string): boolean {
    return !!lookupProperty(origin, property) || origin.hasDefinition(property);
  },

  resolveProperty(
    origin: IEntity,
    container: Container,
    property: string,
    noInvoke: boolean = false
  ): IEntity | null {
    const entity = lookupProperty(origin, property) ?? null;

    if (entity == null) {
      const def = origin.resolveDefinition(property);

      if (def === null) {
        return new Entity({
          kind: CompletionItemKind.Variable,
          container
        }).addType(SignatureDefinitionBaseType.Any);
      }

      if (
        def.getType().type === SignatureDefinitionBaseType.Function &&
        !noInvoke
      ) {
        const fnDef = def as SignatureDefinitionFunction;
        return new Entity({
          kind: CompletionItemKind.Variable,
          container
        }).addType(...fnDef.getReturns().map((item) => item.type));
      }

      return new Entity({
        kind: CompletionItemKind.Variable,
        container
      }).addSignatureType(def);
    }

    return resolveEntity(container, entity, noInvoke);
  },

  setProperty(origin: IEntity, property: string, entity: Entity): boolean {
    if (!isEligibleForProperties(origin)) return false;

    const key = `i:${property}`;
    const existingEntity = origin.values.get(key);

    if (existingEntity) {
      existingEntity.extend(entity);
    } else {
      origin.values.set(key, entity);
    }

    return true;
  }
};

const entityPropertyHandler: IEntityPropertyHandler<IEntity> = {
  hasProperty(origin: IEntity, property: Entity): boolean {
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
    container: Container,
    property: Entity
  ): IEntity | null {
    if (!isEligibleForProperties(origin)) {
      return new Entity({
        kind: CompletionItemKind.Variable,
        container
      }).addType(SignatureDefinitionBaseType.Any);
    }

    const aggregatedEntity = new Entity({
      kind: CompletionItemKind.Variable,
      container
    });

    for (const type of property.types) {
      const entity = aggregatedEntity.values.get(`t:${type}`);
      if (!entity) continue;
      aggregatedEntity.extend(entity);
    }

    return aggregatedEntity;
  },

  setProperty(origin: IEntity, property: Entity, entity: Entity): boolean {
    if (!isEligibleForProperties(origin)) return false;
    for (const type of property.types) {
      const key = `t:${type}`;
      const existingEntity = origin.values.get(key);

      if (existingEntity) {
        existingEntity.extend(entity);
      } else {
        origin.values.set(key, entity);
      }
    }
    return true;
  }
};

export class Entity implements IEntity {
  readonly kind: CompletionItemKind;
  protected _container: Container;
  protected _signatureDefinitions: ObjectSet<SignatureDefinition>;
  protected _returnEntity: IEntity | null;
  protected _types: Set<SignatureDefinitionType>;
  protected _values: Map<string, IEntity>;

  get signatureDefinitions() {
    return this._signatureDefinitions;
  }

  get types() {
    return this._types;
  }

  get values() {
    return this._values;
  }

  constructor(options: EntityOptions) {
    this.kind = options.kind;
    this._signatureDefinitions =
      options.signatureDefinitions ?? new ObjectSet();
    this._types = options.types ?? new Set();
    this._values = options.values ?? new Map();
    this._container = options.container;
    this._returnEntity = options.returnEntity ?? null;
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

  addType(...types: SignatureDefinitionType[]): this {
    for (const type of types) this._types.add(type);
    return this;
  }

  hasProperty(property: string | IEntity): boolean {
    switch (typeof property) {
      case 'object': {
        return entityPropertyHandler.hasProperty(this, property as IEntity);
      }
      default: {
        return identifierPropertyHandler.hasProperty(this, property);
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

  hasDefinition(property: string): boolean {
    for (const type of this.types) {
      const signature = this._container.getTypeSignature(type);
      if (signature === null) continue;
      if (signature.getDefinitions()[property]) return true;
    }
    return false;
  }

  resolveDefinition(property: string): SignatureDefinition | null {
    return (
      this._container.getDefinition(Array.from(this.types), property) ?? null
    );
  }

  setProperty(property: string | IEntity, entity: IEntity): boolean {
    switch (typeof property) {
      case 'object': {
        return entityPropertyHandler.setProperty(
          this,
          property as IEntity,
          entity
        );
      }
      default: {
        return identifierPropertyHandler.setProperty(this, property, entity);
      }
    }
  }

  extend(entity: IEntity): this {
    this._signatureDefinitions.extend(entity.signatureDefinitions);
    this.addType(...entity.types);
    for (const [key, value] of entity.values) {
      const item = this.values.get(key);
      if (item == null) {
        this.values.set(key, value);
      } else {
        item.extend(value);
      }
    }
    return this;
  }

  insertSignature(signature: Signature): this {
    const properties = Object.keys(signature.getDefinitions());

    this.addType(SignatureDefinitionBaseType.Map);

    for (const property of properties) {
      const entity = new Entity({
        kind: CompletionItemKind.Property,
        container: this._container
      });
      const definition = signature.getDefinition(property);

      entity.addSignatureType(definition);
      this.setProperty(property, entity);
    }

    return this;
  }

  getAllIdentifier(): string[] {
    const identifiers: Set<string> = new Set();

    for (const type of this._types) {
      const keys = Object.keys(
        this._container.getTypeSignature(type).getDefinitions()
      );
      for (const key of keys) identifiers.add(key);
    }

    for (const item of this._values.keys()) {
      if (item.startsWith('i:')) {
        identifiers.add(item.slice(2));
      }
    }

    return Array.from(identifiers);
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

  copy(): IEntity {
    return new Entity({
      kind: this.kind,
      container: this._container,
      signatureDefinitions: new ObjectSet(
        Array.from(this._signatureDefinitions, (value) => value.copy())
      ),
      types: new Set(this._types),
      values: new Map(
        Array.from(this._values, ([key, value]) => [key, value.copy()])
      ),
      returnEntity: this._returnEntity
    });
  }
}
