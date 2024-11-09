import { ASTBase, ASTBaseBlockWithScope } from 'miniscript-core';

import { IDocument } from './document';
import { ASTDefinitionItem, IEntity, IScope } from './object';

export interface AggregatorOptions {
  parent?: IAggregator;
  root: ASTBaseBlockWithScope;
  scope: IScope;
  document: IDocument;
}

export interface IAggregator {
  definitions: Map<string, ASTDefinitionItem[]>;
  parent: IAggregator | null;

  resolveType(item: ASTBase, noInvoke?: boolean): IEntity | null;
  resolveTypeWithDefault(item: ASTBase, noInvoke?: boolean): IEntity;
  resolveNamespace(item: ASTBase, noInvoke?: boolean): IEntity | null;
  setEntityInPath(source: IEntity, path: string[], value: IEntity): boolean;
  getEntityInPath(source: IEntity, path: string[]): IEntity | null;
  defineNamespace(item: ASTBase, entity: IEntity): boolean;
  resolveAvailableAssignmentsWithQuery(query: string): ASTDefinitionItem[];
  resolveAvailableAssignments(item: ASTBase): ASTDefinitionItem[];
  extend(aggregator: IAggregator): void;
  analyze(): void;
}

export const DEFAULT_CUSTOM_FUNCTION_DESCRIPTION =
  `This is a custom method. You can add a description for this method by adding a comment above or after the function.
\`\`\`
myFunction = function(a, b, c) // This function does xyz
\`\`\`
or
\`\`\`
/*
  This function does xyz
*/
myFunction = function(a, b, c)
\`\`\`` as const;
