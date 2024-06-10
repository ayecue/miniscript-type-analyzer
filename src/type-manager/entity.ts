import {
  SignatureDefinitionType,
  SignatureDefinitionBaseType,
  SignatureDefinitionFunction,
  Container,
  Signature,
  SignatureDefinition
} from 'meta-utils';
import { ObjectSet } from '../utils/object-set';
import { CompletionItemKind } from '../types/completion';
import { isSignatureDefinitionFunction } from '../types/signature';
import { EntityOptions, IEntity, IEntityPropertyHandler } from '../types/object';

const identifierPropertyHandler: IEntityPropertyHandler<string> = {
  hasProperty(this: IEntity, property: string): boolean {
    if (!this.types.has(SignatureDefinitionBaseType.Map)) return false;
    return this.values.has(`i:${property}`);
  },

  resolveProperty(this: IEntity, container: Container, property: string, noInvoke: boolean = false): IEntity | null {
    const entity = this.types.has(SignatureDefinitionBaseType.Map) ? this.values.get(`i:${property}`) : null;

    if (entity == null) {
      const def = container.getDefinition(Array.from(this.types), property);

      if (def === null) {
        return new Entity({
          kind: CompletionItemKind.Variable,
          container
        }).addType(SignatureDefinitionBaseType.Any);
      }

      if (def.getType().type === SignatureDefinitionBaseType.Function) {
        return new Entity({
          kind: CompletionItemKind.Variable,
          container
        }).addSignatureType(def);
      }

      return new Entity({
        kind: CompletionItemKind.Variable,
        container
      }).addType(def.getType().type);
    }

    if (noInvoke) return entity;

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
  },

  setProperty(this: IEntity, property: string, entity: Entity): boolean {
    if (!this.types.has(SignatureDefinitionBaseType.Map)) return false;
    this.values.set(`i:${property}`, entity);
    return true;
  }
}

const entityPropertyHandler: IEntityPropertyHandler<IEntity> = {
  hasProperty(this: IEntity, property: Entity): boolean {
    if (!this.types.has(SignatureDefinitionBaseType.Map)) return false;
    for (const type of property.types) {
      if (this.values.has(`t:${type}`)) {
        return true;
      }
    }
    return false;
  },

  resolveProperty(this: IEntity, container: Container, property: Entity, noInvoke: boolean = false): IEntity | null {
    if (!this.types.has(SignatureDefinitionBaseType.Map)) {
      return new Entity({
        kind: CompletionItemKind.Variable,
        container
      }).addType(SignatureDefinitionBaseType.Any)
    }

    const entity = new Entity
  }

  setProperty(this: IEntity, property: Entity, entity: Entity): boolean {

  }
}

export class Entity implements IEntity {
  readonly kind: CompletionItemKind;
  private _container: Container;
  private _signatureDefinitions: ObjectSet<SignatureDefinition>;
  private _types: Set<SignatureDefinitionType>;
  private _values: Map<string, IEntity>;

  get types() {
    return this._types;
  }

  get values() {
    return this._values;
  }

  constructor(options: EntityOptions) {
    this.kind = options.kind;
    this._signatureDefinitions = options.signatureDefinitions ?? new ObjectSet();
    this._types = options.types ?? new Set();
    this._values = options.values ?? new Map();
    this._container = options.container;
  }

  isCallable() {
    return this._types.has(SignatureDefinitionBaseType.Function);
  }

  getCallableReturnTypes(): string[] | null {
    if (!this.isCallable()) return null;
    const functionDefs = Array.from(this._signatureDefinitions).filter((item) => isSignatureDefinitionFunction(item)) as SignatureDefinitionFunction[];
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
    this._types = new Set([
      ...types,
      ...this._types
    ]);
    return this;
  }

  hasProperty(property: string | IEntity): boolean {
    switch (typeof property) {
      case 'object': {
        return entityPropertyHandler.hasProperty.call(this, property as IEntity);
      }
      default: {
        return identifierPropertyHandler.hasProperty.call(this, property);
      }
    }
  }

  resolveProperty(property: string | IEntity, noInvoke: boolean = false): IEntity | null {
    switch (typeof property) {
      case 'object': {
        return entityPropertyHandler.resolveProperty.call(this, this._container, property as IEntity, noInvoke);
      }
      default: {
        return identifierPropertyHandler.resolveProperty.call(this, this._container, property, noInvoke);
      }
    }
  }

  setProperty(property: string | IEntity, entity: Entity): boolean {
    switch (typeof property) {
      case 'object': {
        return entityPropertyHandler.setProperty.call(this, property as IEntity, entity);
      }
      default: {
        return identifierPropertyHandler.setProperty.call(this, property, entity);
      }
    }
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
    })
  }
}