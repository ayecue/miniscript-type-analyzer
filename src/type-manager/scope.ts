import {
  Signature,
  SignatureDefinition,
  SignatureDefinitionBaseType,
  SignatureDefinitionType
} from 'meta-utils';

import { CompletionItem, CompletionItemKind } from '../types/completion';
import { IDocument } from '../types/document';
import { EntityOptions, IEntity, IScope, ScopeOptions } from '../types/object';
import { ObjectSet } from '../utils/object-set';
import { Entity, resolveEntity } from './entity';

export class Scope implements IScope {
  protected _parent: IScope | null;
  protected _globals: IEntity;
  protected _locals: IEntity;
  protected _document: IDocument;

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
    this._document = options.document;
    this._parent = options.parent ?? null;
    this._globals = options.globals;
    this._locals =
      options.locals ??
      new Entity({
        kind: CompletionItemKind.Constant,
        document: this._document,
        label: 'locals'
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
      return resolveEntity(this._document, entity, noInvoke);
    } else if (this._parent?.locals.hasProperty(property)) {
      return this._parent?.locals.resolveProperty(property, noInvoke);
    } else if (this._globals.hasProperty(property)) {
      return this._globals.resolveProperty(property, noInvoke);
    }

    return null;
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
      ...globalIdentifier.entries(),
      ...outerIdentifier.entries(),
      ...localIdentifier.entries()
    ]);

    if (
      this._locals.context != null &&
      this._locals.context.types.has(SignatureDefinitionBaseType.Map)
    ) {
      properties.set('self', {
        kind: CompletionItemKind.Constant,
        line: -1
      });
    }

    return properties;
  }

  toJSON() {
    return this._locals.toJSON();
  }

  copy(
    options: Partial<
      Pick<
        EntityOptions,
        'document' | 'label' | 'kind' | 'context' | 'line' | 'values'
      >
    > = {}
  ): IScope {
    return new Scope({
      document: options.document ?? this._document,
      parent: this._parent.copy({
        document: options.document
      }),
      globals: this._globals.copy({
        document: options.document
      }),
      locals: this._locals.copy(options)
    });
  }
}
