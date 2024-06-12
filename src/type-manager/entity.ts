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

const identifierPropertyHandler: IEntityPropertyHandler<string> = {
  hasProperty(origin: IEntity, property: string): boolean {
    if (!origin.types.has(SignatureDefinitionBaseType.Map)) return false;
    if (origin.values.has(`i:${property}`)) return true;
    return origin.hasDefinition(property);
  },

  resolveProperty(
    origin: IEntity,
    container: Container,
    property: string,
    noInvoke: boolean = false
  ): IEntity | null {
    const entity = origin.types.has(SignatureDefinitionBaseType.Map)
      ? origin.values.get(`i:${property}`)
      : null;

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

    if (entity.isCallable() && !noInvoke) {
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
  },

  setProperty(origin: IEntity, property: string, entity: Entity): boolean {
    if (!origin.types.has(SignatureDefinitionBaseType.Map)) return false;

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
    if (!origin.types.has(SignatureDefinitionBaseType.Map)) return false;
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
    if (!origin.types.has(SignatureDefinitionBaseType.Map)) {
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
    if (!origin.types.has(SignatureDefinitionBaseType.Map)) return false;
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
  private _container: Container;
  private _signatureDefinitions: ObjectSet<SignatureDefinition>;
  private _types: Set<SignatureDefinitionType>;
  private _values: Map<string, IEntity>;

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

  setProperty(property: string | IEntity, entity: Entity): boolean {
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
    for (const keyPair of entity.values) this._values.set(...keyPair);
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

  toJSON() {
    return {
      kind: this.kind,
      signatureDefinitions: this._signatureDefinitions.toJSON(),
      types: Array.from(this._types),
      values: Array.from(this._values).reduce<Record<string, object>>(
        (result, [key, value]) => {
          result[key] = value.toJSON();
          return result;
        },
        {}
      )
    };
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
      )
    });
  }
}
