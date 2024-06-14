import {
  Container,
  Signature,
  SignatureDefinition,
  SignatureDefinitionType
} from 'meta-utils';

import { ObjectSet } from '../utils/object-set';
import { CompletionItemKind } from './completion';

export interface EntityOptions {
  kind: CompletionItemKind;
  container: Container;
  signatureDefinitions?: ObjectSet<SignatureDefinition>;
  types?: Set<SignatureDefinitionType>;
  values?: Map<string, IEntity>;
  returnEntity?: IEntity;
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
  hasDefinition(property: string): boolean;
  resolveDefinition(property: string): SignatureDefinition | null;
  getAllIdentifier(): string[];
  isCallable(): boolean;
  getCallableReturnTypes(): string[] | null;
  setReturnEntity(entitiy: IEntity): this;
  getReturnEntity(): IEntity;
  toJSON(): object;
}

export interface ScopeOptions {
  container: Container;
  globals: IEntity;
  parent?: IScope;
  locals?: IEntity;
}

export interface IScope extends IEntity {
  outer: IEntity;
  globals: IEntity;
  locals: IEntity;
  copy(): IScope;
}
