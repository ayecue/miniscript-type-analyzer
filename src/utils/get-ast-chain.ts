import {
  ASTBase,
  ASTCallExpression,
  ASTIdentifier,
  ASTIndexExpression,
  ASTMemberExpression,
  ASTParenthesisExpression,
  ASTSliceExpression,
  ASTType,
  ASTUnaryExpression
} from 'miniscript-core';

import { ResolveChainItem } from '../types/resolve';

function handler(
  current: ASTBase,
  chain: ResolveChainItem[],
  unary: ASTUnaryExpression | null = null,
  isInCallExpression: boolean = false
): void {
  switch (current.type) {
    case ASTType.ParenthesisExpression: {
      const parenExpr = current as ASTParenthesisExpression;
      handler(parenExpr.expression, chain, unary);
      return;
    }
    case ASTType.MemberExpression: {
      const memberExpr = current as ASTMemberExpression;
      handler(memberExpr.base, chain);
      chain.push({
        ref: current,
        getter: memberExpr.identifier as ASTIdentifier,
        unary,
        isInCallExpression
      });
      return;
    }
    case ASTType.IndexExpression: {
      const indexExpr = current as ASTIndexExpression;
      handler(indexExpr.base, chain);
      chain.push({
        ref: current,
        getter: indexExpr.index,
        unary,
        isInCallExpression
      });
      return;
    }
    case ASTType.CallExpression: {
      const callExpr = current as ASTCallExpression;
      handler(callExpr.base, chain, unary, true);
      return;
    }
    case ASTType.NegationExpression:
    case ASTType.BinaryNegatedExpression:
    case ASTType.UnaryExpression: {
      const unaryExpr = current as ASTUnaryExpression;
      handler(unaryExpr.argument, chain, unaryExpr);
      return;
    }
    case ASTType.Identifier: {
      chain.push({
        ref: current,
        getter: current as ASTIdentifier,
        unary,
        isInCallExpression
      });
      return;
    }
    case ASTType.NumericLiteral:
    case ASTType.StringLiteral:
    case ASTType.NilLiteral:
    case ASTType.MapConstructorExpression:
    case ASTType.ListConstructorExpression: {
      chain.push({
        ref: current,
        value: current,
        unary,
        isInCallExpression
      });
      return;
    }
    case ASTType.SliceExpression: {
      const sliceExpr = current as ASTSliceExpression;
      handler(sliceExpr.base, chain);
      chain.push({
        ref: current,
        unary,
        isInCallExpression
      });
    }
  }
}

export function createResolveChain(item: ASTBase): ResolveChainItem[] {
  const chain: ResolveChainItem[] = [];
  handler(item, chain);
  return chain;
}
