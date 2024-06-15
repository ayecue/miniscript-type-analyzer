import {
  Signature,
  SignatureDefinition,
  SignatureDefinitionType
} from 'meta-utils';

import { ObjectSet } from '../utils/object-set';
import { CompletionItemKind } from './completion';
import { IDocument } from './document';

export interface EntityOptions {
  kind: CompletionItemKind;
  document: IDocument;
  signatureDefinitions?: ObjectSet<SignatureDefinition>;
  label?: string;
  types?: Set<SignatureDefinitionType>;
  values?: Map<string, IEntity>;
  returnEntity?: IEntity;
}

export interface IEntityPropertyHandler<T> {
  hasProperty(origin: IEntity, document: IDocument, property: T): boolean;
  resolveProperty(
    origin: IEntity,
    document: IDocument,
    property: T,
    noInvoke?: boolean
  ): IEntity | null;
  setProperty(
    origin: IEntity,
    document: IDocument,
    property: T,
    item: IEntity
  ): boolean;
}

export interface IEntity {
  kind: CompletionItemKind;
  label: string;
  signatureDefinitions: ObjectSet<SignatureDefinition>;
  types: Set<SignatureDefinitionType>;
  values: Map<string, IEntity>;
  addSignatureType(definition: SignatureDefinition): this;
  hasProperty(name: string | IEntity): boolean;
  resolveProperty(name: string | IEntity, noInvoke?: boolean): IEntity | null;
  setProperty(name: string | IEntity, item: IEntity): boolean;
  addType(...types: SignatureDefinitionType[]): this;
  insertSignature(signature: Signature): this;
  copy(document?: IDocument): IEntity;
  extend(entity: IEntity): this;
  getAllIdentifier(): Map<string, CompletionItemKind>;
  isCallable(): boolean;
  getCallableReturnTypes(): string[] | null;
  setReturnEntity(entitiy: IEntity): this;
  getReturnEntity(): IEntity;
  toJSON(): object;
}

export interface ScopeOptions {
  document: IDocument;
  globals: IEntity;
  parent?: IScope;
  locals?: IEntity;
}

export interface IScope extends IEntity {
  outer: IEntity;
  globals: IEntity;
  locals: IEntity;
  copy(document?: IDocument): IScope;
}
