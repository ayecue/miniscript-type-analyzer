import {
  ASTBase,
  ASTIdentifier,
  ASTIndexExpression,
  ASTListConstructorExpression,
  ASTLiteral,
  ASTMapConstructorExpression,
  ASTMemberExpression,
  ASTType,
  ASTUnaryExpression
} from 'miniscript-core';

export interface ResolveChainItemBase {
  ref: ASTBase;
  unary: ASTUnaryExpression | null;
  isInCallExpression: boolean;
}

export interface ResolveChainItemWithIndex extends ResolveChainItemBase {
  ref: ASTIndexExpression;
  getter: ASTBase;
}

export const isResolveChainItemWithIndex = (
  item: ResolveChainItemBase
): item is ResolveChainItemWithIndex => {
  return item != null && item.ref.type === ASTType.IndexExpression;
};

export interface ResolveChainItemWithMember extends ResolveChainItemBase {
  ref: ASTMemberExpression;
  getter: ASTIdentifier;
}

export const isResolveChainItemWithMember = (
  item: ResolveChainItemBase
): item is ResolveChainItemWithMember => {
  return item != null && item.ref.type === ASTType.MemberExpression;
};

export interface ResolveChainItemWithIdentifier extends ResolveChainItemBase {
  ref: ASTIdentifier;
  getter: ASTIdentifier;
}

export const isResolveChainItemWithIdentifier = (
  item: ResolveChainItemBase
): item is ResolveChainItemWithIdentifier => {
  return item != null && item.ref.type === ASTType.Identifier;
};

export interface ResolveChainItemWithValue extends ResolveChainItemBase {
  ref: ASTLiteral | ASTMapConstructorExpression | ASTListConstructorExpression;
  value: ASTBase;
}

const resolveChainItemWithValueTypes: Set<string> = new Set([
  ASTType.NumericLiteral,
  ASTType.StringLiteral,
  ASTType.NilLiteral,
  ASTType.BooleanLiteral,
  ASTType.MapConstructorExpression,
  ASTType.ListConstructorExpression,
  ASTType.BinaryExpression,
  ASTType.LogicalExpression,
  ASTType.ComparisonGroupExpression
]);

export const isResolveChainItemWithValue = (
  item: ResolveChainItemBase
): item is ResolveChainItemWithValue => {
  return item != null && resolveChainItemWithValueTypes.has(item.ref.type);
};

export type ResolveChainItemWithGetter =
  | ResolveChainItemWithIdentifier
  | ResolveChainItemWithMember
  | ResolveChainItemWithIndex;
export type ResolveChainItem =
  | ResolveChainItemBase
  | ResolveChainItemWithGetter
  | ResolveChainItemWithValue;
