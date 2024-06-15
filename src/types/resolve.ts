import {
  ASTBase,
  ASTIdentifier,
  ASTType,
  ASTUnaryExpression
} from 'miniscript-core';

export interface ResolveChainItemBase {
  type: ASTType;
  unary: ASTUnaryExpression | null;
  isInCallExpression: boolean;
}

export interface ResolveChainItemWithIndex extends ResolveChainItemBase {
  type: ASTType.IndexExpression;
  getter: ASTBase;
}

export const isResolveChainItemWithIndex = (
  item: ResolveChainItemBase
): item is ResolveChainItemWithIndex => {
  return item.type === ASTType.IndexExpression;
};

export interface ResolveChainItemWithMember extends ResolveChainItemBase {
  type: ASTType.MemberExpression;
  getter: ASTIdentifier;
}

export const isResolveChainItemWithMember = (
  item: ResolveChainItemBase
): item is ResolveChainItemWithMember => {
  return item.type === ASTType.MemberExpression;
};

export interface ResolveChainItemWithIdentifier extends ResolveChainItemBase {
  type: ASTType.Identifier;
  getter: ASTIdentifier;
}

export const isResolveChainItemWithIdentifier = (
  item: ResolveChainItemBase
): item is ResolveChainItemWithIdentifier => {
  return item.type === ASTType.Identifier;
};

export interface ResolveChainItemWithValue extends ResolveChainItemBase {
  type:
    | ASTType.NumericLiteral
    | ASTType.StringLiteral
    | ASTType.NilLiteral
    | ASTType.MapConstructorExpression
    | ASTType.ListConstructorExpression;
  value: ASTBase;
}

export const isResolveChainItemWithValue = (
  item: ResolveChainItemBase
): item is ResolveChainItemWithValue => {
  return (
    item.type === ASTType.NumericLiteral ||
    item.type === ASTType.StringLiteral ||
    item.type === ASTType.NilLiteral ||
    item.type === ASTType.MapConstructorExpression ||
    item.type === ASTType.ListConstructorExpression
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
