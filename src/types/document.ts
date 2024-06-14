import { Container, SignatureDefinitionType } from 'meta-utils';
import {
  ASTBase,
  ASTBaseBlockWithScope,
  ASTChunk,
  ASTType
} from 'miniscript-core';

import { IAggregator } from './aggregator';
import { IEntity, IScope } from './object';

export interface DocumentOptions {
  root: ASTChunk;
  container: Container;
  scopeMapping?: WeakMap<ASTBaseBlockWithScope, ScopeContext>;
  intrinsics?: Intrinsics;
  globals?: IEntity;
}

export interface IDocument {
  intrinsics: Intrinsics;
  globals: IEntity;

  getPropertiesOfType(type: SignatureDefinitionType): string[];
  hasDefinition(type: SignatureDefinitionType[], property: string): boolean;
  resolveDefinition(
    types: SignatureDefinitionType[],
    property: string,
    noInvoke: boolean
  ): IEntity | null;
  getLastASTItemOfLine(line: number): ASTBase;
  findASTItemInLine(line: number, type: ASTType): ASTBase;
}

export interface ScopeContext {
  aggregator: IAggregator;
  scope: IScope;
}

export interface Intrinsics {
  map: IEntity;
  funcRef: IEntity;
  number: IEntity;
  string: IEntity;
  list: IEntity;
}
