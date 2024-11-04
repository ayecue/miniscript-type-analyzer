import {
  Signature,
  SignatureDefinition,
  SignatureDefinitionType
} from 'meta-utils';

import { ObjectSet } from '../utils/object-set';
import { CompletionItem, CompletionItemKind } from './completion';
import { IContainerProxy } from './container-proxy';

export interface EntityOptions {
  kind: CompletionItemKind;
  isFromSignature?: boolean;
  isAPI?: boolean;
  line?: number;
  container: IContainerProxy;
  signatureDefinitions?: ObjectSet<SignatureDefinition>;
  label?: string;
  types?: Set<SignatureDefinitionType>;
  values?: Map<string, IEntity>;
  returnEntity?: IEntity;
  context?: IEntity;
}

export type EntityCopyOptions = Partial<
  Pick<
    EntityOptions,
    | 'container'
    | 'label'
    | 'kind'
    | 'context'
    | 'line'
    | 'values'
    | 'isAPI'
    | 'isFromSignature'
  >
> & {
  deepCopy?: boolean;
};

export interface IEntityPropertyHandler<T> {
  hasProperty(
    origin: IEntity,
    container: IContainerProxy,
    property: T
  ): boolean;
  resolveProperty(
    origin: IEntity,
    container: IContainerProxy,
    property: T,
    noInvoke?: boolean
  ): IEntity | null;
  setProperty(
    origin: IEntity,
    container: IContainerProxy,
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
  copy(options?: EntityCopyOptions): IEntity;
  extend(entity: IEntity): this;
  getAllIdentifier(): Map<string, CompletionItem>;
  isCallable(): boolean;
  isAPI(): boolean;
  isFromSignature(): boolean;
  hasContext(): boolean;
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
  container: IContainerProxy;
  globals: IEntity;
  parent?: IScope;
  locals?: IEntity;
}

export interface IScope extends IEntity {
  outer: IEntity;
  globals: IEntity;
  locals: IEntity;
  isSelfAvailable(): boolean;
  isSuperAvailable(): boolean;
  setCustomType(type: SignatureDefinitionType, entitiy: IEntity): void;
  resolveNamespace(name: string | IEntity, noInvoke?: boolean): IEntity | null;
  copy(options?: EntityCopyOptions): IScope;
}
