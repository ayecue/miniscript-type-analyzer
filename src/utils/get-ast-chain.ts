import {
  ASTBase,
  ASTCallExpression,
  ASTIdentifier,
  ASTIndexExpression,
  ASTMemberExpression,
  ASTParenthesisExpression,
  ASTType,
  ASTUnaryExpression
} from 'miniscript-core';

import { ResolveChainItem } from '../types/resolve';

function handler(
  current: ASTBase,
  chain: ResolveChainItem[],
  unary: ASTUnaryExpression | null = null
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
        type: current.type,
        getter: memberExpr.identifier as ASTIdentifier,
        unary
      });
      return;
    }
    case ASTType.IndexExpression: {
      const indexExpr = current as ASTIndexExpression;
      handler(indexExpr.base, chain);
      chain.push({
        type: current.type,
        getter: indexExpr.index,
        unary
      });
      return;
    }
    case ASTType.CallExpression: {
      const callExpr = current as ASTCallExpression;
      handler(callExpr.base, chain);
      chain.push({
        type: current.type,
        unary
      });
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
        type: current.type,
        getter: current as ASTIdentifier,
        unary
      });
      return;
    }
    case ASTType.NumericLiteral:
    case ASTType.StringLiteral:
    case ASTType.NilLiteral:
    case ASTType.MapConstructorExpression:
    case ASTType.ListConstructorExpression: {
      chain.push({
        type: current.type,
        value: current,
        unary
      });
      return;
    }
    case ASTType.SliceExpression: {
      chain.push({
        type: current.type,
        unary
      });
    }
  }
}

export function createResolveChain(item: ASTBase): ResolveChainItem[] {
  const chain: ResolveChainItem[] = [];
  handler(item, chain);
  return chain;
}
