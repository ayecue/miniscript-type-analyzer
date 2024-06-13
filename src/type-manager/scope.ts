import {
  Container,
  Signature,
  SignatureDefinition,
  SignatureDefinitionBaseType,
  SignatureDefinitionType
} from 'meta-utils';

import { CompletionItemKind } from '../types/completion';
import { IEntity, IScope, ScopeOptions } from '../types/object';
import { ObjectSet } from '../utils/object-set';
import { Entity, resolveEntity } from './entity';

export class Scope implements IScope {
  protected _container: Container;
  protected _parent: IScope | null;
  protected _globals: IEntity;
  protected _locals: IEntity;

  get signatureDefinitions(): ObjectSet<SignatureDefinition> {
    return null;
  }

  get types(): Set<SignatureDefinitionType> {
    return new Set(SignatureDefinitionBaseType.Map);
  }

  get values(): Map<string, IEntity> {
    return this._locals.values;
  }

  get globals(): IEntity {
    return this._globals;
  }

  get outer(): IEntity | null {
    return this._parent?.locals ?? null;
  }

  get locals(): IEntity {
    return this._locals;
  }

  constructor(options: ScopeOptions) {
    this._container = options.container;
    this._parent = options.parent ?? null;
    this._globals = options.globals;
    this._locals =
      options.locals ??
      new Entity({
        kind: CompletionItemKind.Value,
        container: this._container
      }).addType(SignatureDefinitionBaseType.Map);
  }

  addSignatureType(): this {
    throw new Error('Cannot add signature type to scope!');
  }

  hasProperty(property: string | IEntity): boolean {
    if (typeof property !== 'string') {
      throw new Error('Invalid property type for scope!');
    }
    if (
      property === 'locals' ||
      property === 'globals' ||
      property === 'outer'
    ) {
      return true;
    }
    return this._locals.values.has(`i:${property}`);
  }

  resolveProperty(
    property: string | IEntity,
    noInvoke: boolean = false
  ): IEntity | null {
    if (typeof property !== 'string') {
      throw new Error('Invalid property type for scope!');
    }

    if (this.hasProperty(property)) {
      if (property === 'locals') {
        return this._locals;
      } else if (property === 'outer') {
        return this._parent?.locals ?? this._globals;
      } else if (property === 'globals') {
        return this._globals;
      }
      const entity = this._locals.values.get(`i:${property}`);
      return resolveEntity(this._container, entity, noInvoke);
    } else if (this._parent?.hasProperty(property)) {
      return this._parent?.resolveProperty(property, noInvoke);
    } else if (this._globals.hasProperty(property)) {
      return this._globals.resolveProperty(property, noInvoke);
    }

    return null;
  }

  hasDefinition(property: string): boolean {
    return this._locals.hasDefinition(property);
  }

  resolveDefinition(property: string): SignatureDefinition | null {
    return this._locals.resolveDefinition(property);
  }

  setProperty(name: string | IEntity, container: Entity): boolean {
    return this._locals.setProperty(name, container);
  }

  extend(entity: IEntity): this {
    this._locals.extend(entity);
    return this;
  }

  addType(): this {
    throw new Error('Scope cannot get type assigned!');
  }

  insertSignature(signature: Signature): this {
    this._locals.insertSignature(signature);
    return this;
  }

  isCallable(): boolean {
    return false;
  }

  getCallableReturnTypes(): null {
    return null;
  }

  getAllIdentifier(): string[] {
    const localIdentifier = this._locals.getAllIdentifier();
    const outerIdentifier = this._parent?.locals.getAllIdentifier() ?? [];
    const globalIdentifier = this._globals.getAllIdentifier();

    return Array.from(
      new Set([
        'globals',
        'locals',
        'outer',
        ...globalIdentifier,
        ...outerIdentifier,
        ...localIdentifier
      ])
    );
  }

  toJSON() {
    return this._locals.toJSON();
  }

  copy(): IScope {
    return new Scope({
      container: this._container,
      parent: this._parent.copy(),
      globals: this._globals.copy(),
      locals: this._locals.copy()
    });
  }
}
