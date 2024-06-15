import {
  ASTAssignmentStatement,
  ASTBase,
  ASTBaseBlockWithScope
} from 'miniscript-core';

import { IDocument } from './document';
import { IEntity, IScope } from './object';

export interface AggregatorOptions {
  parent?: IAggregator;
  root: ASTBaseBlockWithScope;
  scope: IScope;
  document: IDocument;
}

export interface IAggregator {
  definitions: Map<string, ASTAssignmentStatement[]>;
  parent: IAggregator | null;

  resolveType(item: ASTBase, noInvoke: boolean): IEntity;
  resolveNamespace(item: ASTBase): IEntity;
  defineNamespace(item: ASTBase, entity: IEntity): boolean;
  resolveAvailableAssignments(item: ASTBase): ASTAssignmentStatement[];
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
