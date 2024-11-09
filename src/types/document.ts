import {
  ASTBase,
  ASTBaseBlockWithScope,
  ASTChunk,
  ASTType
} from 'miniscript-core';

import { IAggregator } from './aggregator';
import { IContainerProxy } from './container-proxy';
import { ASTDefinitionItem, IEntity, IScope } from './object';

export interface DocumentOptions {
  source: string;
  root: ASTChunk;
  container: IContainerProxy;
  scopeMapping?: WeakMap<ASTBaseBlockWithScope, ScopeContext>;
  intrinsics?: Intrinsics;
  globals?: IEntity;
  api?: IEntity;
}

export interface IDocument {
  root: ASTChunk;
  intrinsics: Intrinsics;
  api: IEntity;
  globals: IEntity;
  container: IContainerProxy;
  source: string;

  // used for function comments mainly
  getLastASTItemOfLine(line: number): ASTBase;
  findASTItemInLine(line: number, type: ASTType): ASTBase;

  // for outside use mainly
  analyze(): void;
  merge(...typeDocs: IDocument[]): IDocument;
  getScopeContext(block: ASTBaseBlockWithScope): ScopeContext | null;
  getAllScopeContexts(): ScopeContext[];
  getRootScopeContext(): ScopeContext;
  resolveAvailableAssignments(item: ASTBase): ASTDefinitionItem[];
  resolveAllAssignmentsWithQuery(query: string): ASTDefinitionItem[];
  resolveType(item: ASTBase, noInvoke?: boolean): IEntity | null;
  resolveTypeWithDefault(item: ASTBase, noInvoke?: boolean): IEntity;
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
