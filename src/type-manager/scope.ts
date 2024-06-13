import {
  Signature,
  SignatureDefinition,
  SignatureDefinitionBaseType,
  SignatureDefinitionType
} from 'meta-utils';

import { CompletionItemKind } from '../types/completion';
import { EntityFactory, IEntity, IScope, ScopeOptions } from '../types/object';
import { ObjectSet } from '../utils/object-set';
import { Entity } from './entity';

export class Scope implements IScope {
  protected _factory: EntityFactory;
  protected _parent: IScope | null;
  protected _globals: IEntity;
  protected _locals: IEntity;

  get signatureDefinitions(): ObjectSet<SignatureDefinition> {
    return this._locals.signatureDefinitions;
  }

  get types(): Set<SignatureDefinitionType> {
    return this._locals.types;
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
    this._factory = options.factory;
    this._parent = options.parent ?? null;
    this._globals =
      options.globals ??
      this._factory(CompletionItemKind.Variable).addType(
        SignatureDefinitionBaseType.Map
      );
    this._locals =
      options.locals ??
      this._factory(CompletionItemKind.Variable).addType(
        SignatureDefinitionBaseType.Map
      );
  }

  addSignatureType(): this {
    throw new Error('Cannot add signature type to scope!');
  }

  hasProperty(property: string | IEntity): boolean {
    return this._locals.hasProperty(property);
  }

  resolveProperty(
    property: string | IEntity,
    noInvoke: boolean = false
  ): IEntity | null {
    if (this._locals.hasProperty(property)) {
      return this._locals.resolveProperty(property, noInvoke);
    } else if (this.outer?.hasProperty(property)) {
      return this.outer?.resolveProperty(property, noInvoke);
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
      new Set([...globalIdentifier, ...outerIdentifier, ...localIdentifier])
    );
  }

  toJSON() {
    return this._locals.toJSON();
  }

  copy(): IScope {
    return new Scope({
      factory: this._factory,
      parent: this._parent.copy(),
      globals: this._globals.copy(),
      locals: this._locals.copy()
    });
  }
}
