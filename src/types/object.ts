import {
  Container,
  Signature,
  SignatureDefinition,
  SignatureDefinitionType
} from 'meta-utils';

import { ObjectSet } from '../utils/object-set';
import { CompletionItemKind } from './completion';

export interface EntityFactory {
  (kind: CompletionItemKind): IEntity;
}

export interface EntityOptions {
  kind: CompletionItemKind;
  container: Container;
  signatureDefinitions?: ObjectSet<SignatureDefinition>;
  types?: Set<SignatureDefinitionType>;
  values?: Map<string, IEntity>;
}

export interface IEntityPropertyHandler<T> {
  hasProperty(origin: IEntity, property: T): boolean;
  resolveProperty(
    origin: IEntity,
    container: Container,
    property: T,
    noInvoke?: boolean
  ): IEntity | null;
  setProperty(origin: IEntity, property: T, item: IEntity): boolean;
}

export interface IEntity {
  signatureDefinitions: ObjectSet<SignatureDefinition>;
  types: Set<SignatureDefinitionType>;
  values: Map<string, IEntity>;
  addSignatureType(definition: SignatureDefinition): this;
  hasProperty(name: string | IEntity): boolean;
  resolveProperty(name: string | IEntity, noInvoke?: boolean): IEntity | null;
  setProperty(name: string | IEntity, item: IEntity): boolean;
  addType(...types: SignatureDefinitionType[]): this;
  insertSignature(signature: Signature): this;
  copy(): IEntity;
  extend(entity: IEntity): this;
  isCallable(): boolean;
  getCallableReturnTypes(): string[] | null;
}

export interface ScopeOptions {
  factory: EntityFactory;
  parent?: IScope;
  globals?: IEntity;
  locals?: IEntity;
}

export interface IScope extends IEntity {
  outer: IEntity;
  globals: IEntity;
  locals: IEntity;
  copy(): IScope;
}
