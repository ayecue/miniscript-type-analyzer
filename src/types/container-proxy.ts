import {
  Container,
  SignatureDefinitionBaseType,
  SignatureDefinitionType
} from 'meta-utils';

import { CompletionItem } from './completion';
import { IEntity } from './object';

export interface ContainerProxyOptions {
  container: Container;
  primitives?: Map<SignatureDefinitionBaseType, IEntity>;
  types?: Map<SignatureDefinitionType, IEntity>;
}

export interface IContainerProxy {
  primitives: Map<SignatureDefinitionBaseType, IEntity>;
  types: Map<SignatureDefinitionType, IEntity>;

  getTypeSignature(type: SignatureDefinitionType): IEntity | null;
  setCustomType(type: SignatureDefinitionType, entitiy: IEntity): void;
  mergeCustomTypes(proxy: IContainerProxy): void;
  searchDefinitionMatches(
    types: string | SignatureDefinitionType[],
    property: string
  ): Map<SignatureDefinitionType, IEntity>;
  getDefinition(
    types: SignatureDefinitionType | SignatureDefinitionType[],
    property: string,
    noInvoke?: boolean
  ): IEntity | null;
  getGeneralDefinition(property: string, noInvoke?: boolean): IEntity | null;
  getAvailableIdentifier(
    type: string | SignatureDefinitionType
  ): Map<string, CompletionItem>;
  copy(): IContainerProxy;
}
