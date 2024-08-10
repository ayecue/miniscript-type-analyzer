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

import { isValidIdentifierLiteral } from './is-valid-identifier-literal';

const attachCache = (c: any, h: string): string => (c.$$id = h);
const retreiveCache = (c: any): string | null => c.$$id ?? null;

function stringHandler(current: ASTBase): string {
  const cachedHash = retreiveCache(current);
  if (cachedHash !== null) return cachedHash;

  switch (current.type) {
    case ASTType.BinaryExpression: {
      const evalExpr = current as ASTBinaryExpression;
      return attachCache(
        current,
        stringHandler(evalExpr.left) +
          evalExpr.operator +
          stringHandler(evalExpr.right)
      );
    }
    case ASTType.LogicalExpression: {
      const evalExpr = current as ASTLogicalExpression;
      return attachCache(
        current,
        stringHandler(evalExpr.left) +
          evalExpr.operator +
          stringHandler(evalExpr.right)
      );
    }
    case ASTType.IsaExpression: {
      const evalExpr = current as ASTIsaExpression;
      return attachCache(
        current,
        stringHandler(evalExpr.left) +
          evalExpr.operator +
          stringHandler(evalExpr.right)
      );
    }
    case ASTType.ComparisonGroupExpression: {
      const comparisonGroupExpr = current as ASTComparisonGroupExpression;
      const expressions: string[] = comparisonGroupExpr.expressions.map((it) =>
        stringHandler(it)
      );
      const segments: string[] = [expressions[0]];

      for (
        let index = 0;
        index < comparisonGroupExpr.operators.length;
        index++
      ) {
        segments.push(
          comparisonGroupExpr.operators[index],
          expressions[index + 1]
        );
      }

      return attachCache(current, segments.join(' '));
    }
    case ASTType.FunctionDeclaration: {
      const fnStatement = current as ASTFunctionStatement;
      let body = 'function';
      const params: string[] = [];
      for (let index = 0; index < fnStatement.parameters.length; index++) {
        const parameter = fnStatement.parameters[index];
        if (parameter.type === ASTType.Identifier) {
          params.push((parameter as ASTIdentifier).name);
          continue;
        }
        const assignment = parameter as ASTAssignmentStatement;
        params.push(
          (assignment.variable as ASTIdentifier).name +
            '=' +
            stringHandler(assignment.init)
        );
      }
      if (params.length > 0) {
        body += '(' + params.join(',') + ')';
      }
      return attachCache(current, body);
    }
    case ASTType.ParenthesisExpression: {
      const parenExpr = current as ASTParenthesisExpression;
      return attachCache(current, stringHandler(parenExpr.expression));
    }
    case ASTType.MemberExpression: {
      const memberExpr = current as ASTMemberExpression;
      return attachCache(
        current,
        stringHandler(memberExpr.base) +
          '.' +
          (memberExpr.identifier as ASTIdentifier).name
      );
    }
    case ASTType.IndexExpression: {
      const indexExpr = current as ASTIndexExpression;
      if (isValidIdentifierLiteral(indexExpr.index)) {
        return attachCache(
          current,
          stringHandler(indexExpr.base) + '.' + indexExpr.index.value.toString()
        );
      }
      return attachCache(
        current,
        stringHandler(indexExpr.base) +
          '[' +
          stringHandler(indexExpr.index) +
          ']'
      );
    }
    case ASTType.CallExpression: {
      const callExpr = current as ASTCallExpression;
      let body = stringHandler(callExpr.base);
      const args: string[] = [];
      for (let index = 0; index < callExpr.arguments.length; index++) {
        const arg = callExpr.arguments[index];
        args.push(stringHandler(arg));
      }
      if (args.length > 0) {
        body += '(' + args.join(',') + ')';
      }
      return attachCache(current, body);
    }
    case ASTType.NegationExpression:
    case ASTType.BinaryNegatedExpression:
    case ASTType.UnaryExpression: {
      const unaryExpr = current as ASTUnaryExpression;
      if (unaryExpr.operator == null) {
        return attachCache(current, stringHandler(unaryExpr.argument));
      } else if (unaryExpr.operator === '@') {
        return attachCache(
          current,
          unaryExpr.operator + stringHandler(unaryExpr.argument)
        );
      }
      return attachCache(
        current,
        unaryExpr.operator + ' ' + stringHandler(unaryExpr.argument)
      );
    }
    case ASTType.Identifier: {
      const identifier = current as ASTIdentifier;
      return attachCache(current, identifier.name);
    }
    case ASTType.NumericLiteral:
    case ASTType.StringLiteral:
    case ASTType.NilLiteral: {
      return attachCache(current, (current as ASTLiteral).raw.toString());
    }
    case ASTType.MapConstructorExpression: {
      const mapExpr = current as ASTMapConstructorExpression;
      const fields: string[] = [];
      for (let index = 0; index < mapExpr.fields.length; index++) {
        const field = mapExpr.fields[index];
        fields.push(
          stringHandler(field.key) + ':' + stringHandler(field.value)
        );
      }
      return attachCache(current, '{' + fields.join(',') + '}');
    }
    case ASTType.ListConstructorExpression: {
      const listExpr = current as ASTListConstructorExpression;
      const fields: string[] = [];
      for (let index = 0; index < listExpr.fields.length; index++) {
        const field = listExpr.fields[index];
        fields.push(stringHandler(field.value));
      }
      return attachCache(current, '[' + fields.join(',') + ']');
    }
    case ASTType.SliceExpression: {
      const sliceExpr = current as ASTSliceExpression;
      return attachCache(
        current,
        stringHandler(sliceExpr.base) +
          '[' +
          stringHandler(sliceExpr.left) +
          ':' +
          stringHandler(sliceExpr.right) +
          ']'
      );
    }
  }

  console.warn(`Unexpected ast type ${current.type} in hash handler!`);

  return attachCache(current, '');
}

export function createExpressionId(item: ASTBase): string {
  return stringHandler(item);
}
