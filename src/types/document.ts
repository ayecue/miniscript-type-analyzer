import { Container, SignatureDefinitionType } from 'meta-utils';
import {
  ASTAssignmentStatement,
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
  root: ASTChunk;
  intrinsics: Intrinsics;
  globals: IEntity;

  // mainly used for the context of resolving types and defintions in entities
  getPropertiesOfType(type: SignatureDefinitionType): string[];
  hasDefinition(type: SignatureDefinitionType[], property: string): boolean;
  resolveDefinition(
    types: SignatureDefinitionType[],
    property: string,
    noInvoke?: boolean
  ): IEntity | null;

  // used for function comments mainly
  getLastASTItemOfLine(line: number): ASTBase;
  findASTItemInLine(line: number, type: ASTType): ASTBase;

  // for outside use mainly
  analyze(): void;
  merge(...typeDocs: IDocument[]): IDocument;
  getScopeContext(block: ASTBaseBlockWithScope): ScopeContext | null;
  getAllScopeContexts(): ScopeContext[];
  getRootScopeContext(): ScopeContext;
  resolveAvailableAssignments(item: ASTBase): ASTAssignmentStatement[];
  resolveAllAssignmentsWithQuery(query: string): ASTAssignmentStatement[];
  resolveType(item: ASTBase, noInvoke?: boolean): IEntity;
  resolveNamespace(item: ASTBase, noInvoke?: boolean): IEntity | null;
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
