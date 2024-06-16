import {
  Signature,
  SignatureDefinition,
  SignatureDefinitionType
} from 'meta-utils';

import { ObjectSet } from '../utils/object-set';
import { CompletionItem, CompletionItemKind } from './completion';
import { IDocument } from './document';

export interface EntityOptions {
  kind: CompletionItemKind;
  line?: number;
  document: IDocument;
  signatureDefinitions?: ObjectSet<SignatureDefinition>;
  label?: string;
  types?: Set<SignatureDefinitionType>;
  values?: Map<string, IEntity>;
  returnEntity?: IEntity;
  context?: IEntity;
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
  line: number;
  signatureDefinitions: ObjectSet<SignatureDefinition>;
  types: Set<SignatureDefinitionType>;
  values: Map<string, IEntity>;
  label: string;
  context: IEntity | null;
  addSignatureType(definition: SignatureDefinition): this;
  hasProperty(name: string | IEntity): boolean;
  resolveProperty(name: string | IEntity, noInvoke?: boolean): IEntity | null;
  setProperty(name: string | IEntity, item: IEntity): boolean;
  addType(...types: SignatureDefinitionType[]): this;
  insertSignature(signature: Signature): this;
  copy(
    options?: Partial<
      Pick<EntityOptions, 'document' | 'label' | 'kind' | 'context' | 'line'>
    >
  ): IEntity;
  extend(entity: IEntity): this;
  getAllIdentifier(): Map<string, CompletionItem>;
  isCallable(): boolean;
  getCallableReturnTypes(): string[] | null;
  setReturnEntity(entitiy: IEntity): this;
  getReturnEntity(): IEntity;
  setKind(kind: CompletionItemKind): this;
  setLine(line: number): this;
  setLabel(label: string): this;
  setContext(context: IEntity): this;
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
  copy(
    options?: Partial<
      Pick<EntityOptions, 'document' | 'label' | 'kind' | 'context' | 'line'>
    >
  ): IScope;
}
