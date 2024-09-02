import {
  ASTAssignmentStatement,
  ASTBase,
  ASTBinaryExpression,
  ASTCallExpression,
  ASTComparisonGroupExpression,
  ASTFunctionStatement,
  ASTIdentifier,
  ASTIndexExpression,
  ASTIsaExpression,
  ASTListConstructorExpression,
  ASTLiteral,
  ASTLogicalExpression,
  ASTMapConstructorExpression,
  ASTMemberExpression,
  ASTParenthesisExpression,
  ASTSliceExpression,
  ASTType,
  ASTUnaryExpression
} from 'miniscript-core';

import { getHashCode, getStringHashCode } from './hash';
import { isValidIdentifierLiteral } from './is-valid-identifier-literal';

const attachCache = (c: any, h: number): number => (c.$$hash = h);
const retreiveCache = (c: any): number | null => c.$$hash ?? null;

function hashHandler(current: ASTBase): number {
  const cachedHash = retreiveCache(current);
  if (cachedHash !== null) return cachedHash;

  let result = getStringHashCode(current.type);

  switch (current.type) {
    case ASTType.BinaryExpression: {
      const evalExpr = current as ASTBinaryExpression;
      result ^= getStringHashCode(evalExpr.operator);
      result ^= hashHandler(evalExpr.left);
      result ^= hashHandler(evalExpr.right);
      return attachCache(current, result);
    }
    case ASTType.LogicalExpression: {
      const evalExpr = current as ASTLogicalExpression;
      result ^= getStringHashCode(evalExpr.operator);
      result ^= hashHandler(evalExpr.left);
      result ^= hashHandler(evalExpr.right);
      return attachCache(current, result);
    }
    case ASTType.IsaExpression: {
      const evalExpr = current as ASTIsaExpression;
      result ^= getStringHashCode(evalExpr.operator);
      result ^= hashHandler(evalExpr.left);
      result ^= hashHandler(evalExpr.right);
      return attachCache(current, result);
    }
    case ASTType.ComparisonGroupExpression: {
      const comparisonGroupExpr = current as ASTComparisonGroupExpression;

      for (
        let index = 0;
        index < comparisonGroupExpr.expressions.length;
        index++
      ) {
        result ^= hashHandler(comparisonGroupExpr.expressions[index]);
      }

      for (
        let index = 0;
        index < comparisonGroupExpr.operators.length;
        index++
      ) {
        result ^= getStringHashCode(comparisonGroupExpr.operators[index]);
      }

      return attachCache(current, result);
    }
    case ASTType.FunctionDeclaration: {
      const fnStatement = current as ASTFunctionStatement;
      result ^= getHashCode(fnStatement.parameters.length);
      for (let index = 0; index < fnStatement.parameters.length; index++) {
        const parameter = fnStatement.parameters[index];
        if (parameter.type === ASTType.Identifier) {
          result ^= getStringHashCode((parameter as ASTIdentifier).name);
          continue;
        }
        const assignment = parameter as ASTAssignmentStatement;
        result ^= getStringHashCode(
          (assignment.variable as ASTIdentifier).name
        );
        result ^= hashHandler(assignment.init);
      }
      return attachCache(current, result);
    }
    case ASTType.ParenthesisExpression: {
      const parenExpr = current as ASTParenthesisExpression;
      return hashHandler(parenExpr.expression);
    }
    case ASTType.MemberExpression: {
      const memberExpr = current as ASTMemberExpression;
      if (memberExpr.base.type === ASTType.Identifier) {
        const identifier = (memberExpr.base as ASTIdentifier).name;

        if (
          identifier === 'globals' ||
          identifier === 'locals' ||
          identifier === 'outer'
        ) {
          result = getStringHashCode(ASTType.Identifier);
          result ^= getStringHashCode(
            (memberExpr.identifier as ASTIdentifier).name
          );
          return attachCache(current, result);
        }
      }
      result ^= hashHandler(memberExpr.base);
      result ^= hashHandler(memberExpr.identifier);
      return attachCache(current, result);
    }
    case ASTType.IndexExpression: {
      const indexExpr = current as ASTIndexExpression;
      if (isValidIdentifierLiteral(indexExpr.index)) {
        if (indexExpr.base.type === ASTType.Identifier) {
          const identifier = (indexExpr.base as ASTIdentifier).name;

          if (
            identifier === 'globals' ||
            identifier === 'locals' ||
            identifier === 'outer'
          ) {
            result = getStringHashCode(ASTType.Identifier);
            result ^= getStringHashCode(indexExpr.index.value.toString());
            return attachCache(current, result);
          }
        }

        result = getStringHashCode(ASTType.MemberExpression);
        result ^= hashHandler(indexExpr.base);
        let identifierHash = getStringHashCode(ASTType.Identifier);
        identifierHash ^= getStringHashCode(
          (indexExpr.index as ASTLiteral).value.toString()
        );
        result ^= identifierHash;
      } else {
        result ^= hashHandler(indexExpr.base);
        result ^= hashHandler(indexExpr.index);
      }
      return attachCache(current, result);
    }
    case ASTType.CallExpression: {
      const callExpr = current as ASTCallExpression;
      result ^= hashHandler(callExpr.base);
      result ^= getHashCode(callExpr.arguments.length);
      for (let index = 0; index < callExpr.arguments.length; index++) {
        const arg = callExpr.arguments[index];
        result ^= hashHandler(arg);
      }
      return attachCache(current, result);
    }
    case ASTType.NegationExpression:
    case ASTType.BinaryNegatedExpression:
    case ASTType.UnaryExpression: {
      const unaryExpr = current as ASTUnaryExpression;
      result ^= unaryExpr.operator ? getStringHashCode(unaryExpr.operator) : 1;
      result ^= hashHandler(unaryExpr.argument);
      return attachCache(current, result);
    }
    case ASTType.Identifier: {
      const identifier = current as ASTIdentifier;
      result ^= getStringHashCode(identifier.name);
      return attachCache(current, result);
    }
    case ASTType.NumericLiteral:
    case ASTType.StringLiteral:
    case ASTType.NilLiteral: {
      result ^= getStringHashCode((current as ASTLiteral).value.toString());
      return attachCache(current, result);
    }
    case ASTType.MapConstructorExpression: {
      const mapExpr = current as ASTMapConstructorExpression;
      result ^= getHashCode(mapExpr.fields.length);
      for (let index = 0; index < mapExpr.fields.length; index++) {
        const field = mapExpr.fields[index];
        result ^= hashHandler(field.key);
        result ^= hashHandler(field.value);
      }
      return attachCache(current, result);
    }
    case ASTType.ListConstructorExpression: {
      const listExpr = current as ASTListConstructorExpression;
      result ^= getHashCode(listExpr.fields.length);
      for (let index = 0; index < listExpr.fields.length; index++) {
        const field = listExpr.fields[index];
        result ^= hashHandler(field.value);
      }
      return attachCache(current, result);
    }
    case ASTType.SliceExpression: {
      const sliceExpr = current as ASTSliceExpression;
      result ^= hashHandler(sliceExpr.base);
      result ^= hashHandler(sliceExpr.left);
      result ^= hashHandler(sliceExpr.right);
      return attachCache(current, result);
    }
  }

  return attachCache(current, result);
}

export function createExpressionHash(item: ASTBase): number {
  return hashHandler(item);
}
