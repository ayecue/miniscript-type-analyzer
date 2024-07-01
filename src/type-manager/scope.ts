import {
  Signature,
  SignatureDefinition,
  SignatureDefinitionBaseType,
  SignatureDefinitionType
} from 'meta-utils';

import { CompletionItem, CompletionItemKind } from '../types/completion';
import { IContainerProxy } from '../types/container-proxy';
import {
  EntityCopyOptions,
  IEntity,
  IScope,
  ScopeOptions
} from '../types/object';
import { ObjectSet } from '../utils/object-set';
import { Entity, resolveEntity } from './entity';

export class Scope implements IScope {
  protected _parent: IScope | null;
  protected _globals: IEntity;
  protected _locals: IEntity;
  protected _container: IContainerProxy;

  get signatureDefinitions(): ObjectSet<SignatureDefinition> {
    return null;
  }

  get kind() {
    return CompletionItemKind.Constant;
  }

  get line() {
    return this._locals.line;
  }

  get label() {
    return this._locals.label;
  }

  get context() {
    return this._locals.context;
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
        kind: CompletionItemKind.Constant,
        container: this._container,
        label: 'locals'
      }).addType(SignatureDefinitionBaseType.Map);
  }

  addSignatureType(): this {
    throw new Error('Cannot add signature type to scope!');
  }

  hasProperty(name: string | IEntity): boolean {
    return this._locals.hasProperty(name);
  }

  resolveProperty(name: string | IEntity, noInvoke?: boolean): IEntity {
    return this._locals.resolveProperty(name, noInvoke);
  }

  resolveNamespace(
    property: string | IEntity,
    noInvoke: boolean = false
  ): IEntity | null {
    if (typeof property !== 'string') {
      throw new Error('Invalid property type for scope!');
    }

    if (property === 'locals') {
      return this._locals;
    } else if (property === 'outer') {
      return this._parent?.locals ?? this._globals;
    } else if (property === 'globals') {
      return this._globals;
    }

    if (this._locals.values.has(`i:${property}`)) {
      const entity = this._locals.values.get(`i:${property}`);
      return resolveEntity(this._container, entity, noInvoke);
    } else if (this._parent?.locals.values.has(`i:${property}`)) {
      const entity = this._parent.locals.values.get(`i:${property}`);
      return resolveEntity(this._container, entity, noInvoke);
    } else if (this._globals.values.has(`i:${property}`)) {
      const entity = this._globals.values.get(`i:${property}`);
      return resolveEntity(this._container, entity, noInvoke);
    }

    return this._container.getGeneralDefinition(property, noInvoke);
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

  setReturnEntity(): this {
    throw new Error('Scope cannot set return entity!');
  }

  getReturnEntity(): IEntity | null {
    throw new Error('Scope cannot get return entity!');
  }

  setKind(kind: CompletionItemKind): this {
    this._locals.setKind(kind);
    return this;
  }

  setLine(line: number): this {
    this._locals.setLine(line);
    return this;
  }

  setLabel(label: string): this {
    this._locals.setLabel(label);
    return this;
  }

  setContext(context: IEntity): this {
    this._locals.setContext(context);
    return this;
  }

  insertSignature(signature: Signature): this {
    this._locals.insertSignature(signature);
    return this;
  }

  isAPI(): boolean {
    return false;
  }

  hasContext(): boolean {
    return false;
  }

  isFromSignature(): boolean {
    return false;
  }

  isCallable(): boolean {
    return false;
  }

  getCallableReturnTypes(): null {
    return null;
  }

  getAllIdentifier(): Map<string, CompletionItem> {
    const localIdentifier = this._locals.getAllIdentifier();
    const outerIdentifier =
      this._parent?.locals.getAllIdentifier() ?? new Map();
    const globalIdentifier = this._globals.getAllIdentifier();
    const apiIdentifier = this._container.getAllIdentifier(
      SignatureDefinitionBaseType.General
    );
    const properties = new Map([
      [
        'globals',
        {
          kind: CompletionItemKind.Constant,
          line: -1
        }
      ],
      [
        'locals',
        {
          kind: CompletionItemKind.Constant,
          line: -1
        }
      ],
      [
        'outer',
        {
          kind: CompletionItemKind.Constant,
          line: -1
        }
      ],
      ...globalIdentifier,
      ...outerIdentifier,
      ...localIdentifier,
      ...apiIdentifier
    ]);

    if (this.isSelfAvailable()) {
      properties.set('self', {
        kind: CompletionItemKind.Constant,
        line: -1
      });
    }

    if (this.isSuperAvailable()) {
      properties.set('super', {
        kind: CompletionItemKind.Constant,
        line: -1
      });
    }

    return properties;
  }

  isSelfAvailable() {
    return (
      this._locals.context != null &&
      this._locals.context.types.has(SignatureDefinitionBaseType.Map)
    );
  }

  isSuperAvailable() {
    return this.isSelfAvailable() && this._locals.context.hasProperty('__isa');
  }

  toJSON() {
    return this._locals.toJSON();
  }

  copy(options: EntityCopyOptions = {}): IScope {
    return new Scope({
      container: options.container ?? this._container,
      parent: this._parent.copy({
        container: options.container
      }),
      globals: this._globals.copy({
        container: options.container
      }),
      locals: this._locals.copy(options)
    });
  }
}
