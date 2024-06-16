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
  return item.ref.type === ASTType.IndexExpression;
};

export interface ResolveChainItemWithMember extends ResolveChainItemBase {
  ref: ASTMemberExpression;
  getter: ASTIdentifier;
}

export const isResolveChainItemWithMember = (
  item: ResolveChainItemBase
): item is ResolveChainItemWithMember => {
  return item.ref.type === ASTType.MemberExpression;
};

export interface ResolveChainItemWithIdentifier extends ResolveChainItemBase {
  ref: ASTIdentifier;
  getter: ASTIdentifier;
}

export const isResolveChainItemWithIdentifier = (
  item: ResolveChainItemBase
): item is ResolveChainItemWithIdentifier => {
  return item.ref.type === ASTType.Identifier;
};

export interface ResolveChainItemWithValue extends ResolveChainItemBase {
  ref: ASTLiteral | ASTMapConstructorExpression | ASTListConstructorExpression;
  value: ASTBase;
}

export const isResolveChainItemWithValue = (
  item: ResolveChainItemBase
): item is ResolveChainItemWithValue => {
  return (
    item.ref.type === ASTType.NumericLiteral ||
    item.ref.type === ASTType.StringLiteral ||
    item.ref.type === ASTType.NilLiteral ||
    item.ref.type === ASTType.MapConstructorExpression ||
    item.ref.type === ASTType.ListConstructorExpression
  );
};

export type ResolveChainItemWithGetter =
  | ResolveChainItemWithIdentifier
  | ResolveChainItemWithMember
  | ResolveChainItemWithIndex;
export type ResolveChainItem =
  | ResolveChainItemBase
  | ResolveChainItemWithGetter
  | ResolveChainItemWithValue;
