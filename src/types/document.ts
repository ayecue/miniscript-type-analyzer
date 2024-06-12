import { Container } from 'meta-utils';
import { ASTChunk } from 'miniscript-core';

import { IAggregator } from './aggregator';
import { EntityFactory, IScope } from './object';

export interface DocumentOptions {
  root: ASTChunk;
  factory: EntityFactory;
}

export interface ScopeContext {
  aggregator: IAggregator;
  scope: IScope;
}
