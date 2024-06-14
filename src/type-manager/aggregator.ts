import {
  SignatureDefinitionBaseType,
  SignatureDefinitionFunction
} from 'meta-utils';
import {
  ASTAssignmentStatement,
  ASTBase,
  ASTBaseBlockWithScope,
  ASTComment,
  ASTEvaluationExpression,
  ASTFunctionStatement,
  ASTIdentifier,
  ASTIndexExpression,
  ASTListConstructorExpression,
  ASTLiteral,
  ASTMapConstructorExpression,
  ASTMemberExpression,
  ASTType,
  ASTUnaryExpression
} from 'miniscript-core';

import {
  AggregatorOptions,
  DEFAULT_CUSTOM_FUNCTION_DESCRIPTION,
  IAggregator
} from '../types/aggregator';
import { CompletionItemKind } from '../types/completion';
import { IDocument } from '../types/document';
import { IEntity, IScope } from '../types/object';
import {
  isResolveChainItemWithIdentifier,
  isResolveChainItemWithIndex,
  isResolveChainItemWithMember,
  isResolveChainItemWithValue,
  ResolveChainItem
} from '../types/resolve';
import { createExpressionHash } from '../utils/create-expression-hash';
import { enrichWithMetaInformation } from '../utils/enrich-with-meta-information';
import { createResolveChain } from '../utils/get-ast-chain';
import { Entity } from './entity';

export class Aggregator implements IAggregator {
  protected _parent: IAggregator | null;
  protected _scope: IScope;
  protected _document: IDocument;
  protected _root: ASTBaseBlockWithScope;
  protected _definitions: Map<number, ASTAssignmentStatement[]>;

  constructor(options: AggregatorOptions) {
    this._root = options.root;
    this._scope = options.scope;
    this._document = options.document;
    this._parent = options.parent ?? null;
    this._definitions = new Map();
  }

  protected factory(kind: CompletionItemKind): IEntity {
    return new Entity({
      kind,
      document: this._document
    });
  }

  protected createFunctionDescription(
    item: ASTBase,
    defaultText: string = DEFAULT_CUSTOM_FUNCTION_DESCRIPTION
  ): string | null {
    const previousItem = this._document.getLastASTItemOfLine(
      item.start.line - 1
    );
    const currentItem = this._document.findASTItemInLine(
      item.start.line,
      ASTType.Comment
    );

    if (previousItem instanceof ASTComment) {
      const lines = [previousItem.value];
      let index = item.start.line - 2;

      while (index >= 0) {
        const item = this._document.getLastASTItemOfLine(index--);

        if (item instanceof ASTComment) {
          lines.unshift(item.value);
        } else {
          break;
        }
      }

      return lines.join('\n\n');
    } else if (currentItem instanceof ASTComment) {
      return currentItem.value;
    }

    return defaultText;
  }

  protected resolveFunctionStatement(item: ASTFunctionStatement) {
    const signature = SignatureDefinitionFunction.parse({
      type: SignatureDefinitionBaseType.Function,
      description: this.createFunctionDescription(item),
      arguments: item.parameters.map((arg: ASTBase) => {
        if (arg.type === ASTType.Identifier) {
          return {
            label: (arg as ASTIdentifier).name ?? 'unknown',
            type: SignatureDefinitionBaseType.Any
          };
        }

        const assignment = arg as ASTAssignmentStatement;

        return {
          label: (assignment.variable as ASTIdentifier)?.name ?? 'unknown',
          types: Array.from(this.resolveType(assignment.init).types)
        };
      }),
      returns: ['any']
    });

    return this.factory(CompletionItemKind.Function)
      .addType(SignatureDefinitionBaseType.Function)
      .addSignatureType(enrichWithMetaInformation(signature));
  }

  protected resolveBinaryExpression(item: ASTEvaluationExpression) {
    // improve logic
    const left =
      this.resolveType(item.left) ??
      this.factory(CompletionItemKind.Value).addType(
        SignatureDefinitionBaseType.Any
      );
    const right =
      this.resolveType(item.right) ??
      this.factory(CompletionItemKind.Value).addType(
        SignatureDefinitionBaseType.Any
      );
    return left.extend(right);
  }

  protected resolveLogicalExpression(item: ASTEvaluationExpression) {
    // improve logic
    const left =
      this.resolveType(item.left) ??
      this.factory(CompletionItemKind.Value).addType(
        SignatureDefinitionBaseType.Any
      );
    const right =
      this.resolveType(item.right) ??
      this.factory(CompletionItemKind.Value).addType(
        SignatureDefinitionBaseType.Any
      );
    return left.extend(right);
  }

  protected resolveUnaryExpression(item: ASTUnaryExpression) {
    const entity = this.resolveNamespace(item);

    if (entity === null) {
      return this.factory(CompletionItemKind.Value).addType(
        SignatureDefinitionBaseType.Any
      );
    }

    return entity;
  }

  protected resolveMapConstructorExpression(item: ASTMapConstructorExpression) {
    const mapEntity = this.factory(CompletionItemKind.Value).addType(
      SignatureDefinitionBaseType.Map
    );

    for (const field of item.fields) {
      const value = this.resolveType(field.value);

      if (field.key.type === ASTType.StringLiteral) {
        mapEntity.setProperty(
          (field.key as ASTLiteral).value.toString(),
          value
        );
      } else {
        const key = this.resolveType(field.key);
        mapEntity.setProperty(key, value);
      }
    }

    return mapEntity;
  }

  protected resolveListConstructorExpression(
    item: ASTListConstructorExpression
  ) {
    const listEntity = this.factory(CompletionItemKind.Value).addType(
      SignatureDefinitionBaseType.List
    );

    for (const field of item.fields) {
      const key = this.factory(CompletionItemKind.Value).addType(
        SignatureDefinitionBaseType.Number
      );
      const value = this.resolveType(field.value);

      listEntity.setProperty(key, value);
    }

    return listEntity;
  }

  protected resolveIndexExpression(
    item: ASTIndexExpression,
    noInvoke: boolean = false
  ): IEntity {
    const entity = this.resolveNamespace(item);

    if (entity === null) {
      return this.factory(CompletionItemKind.Value).addType(
        SignatureDefinitionBaseType.Any
      );
    }

    return entity;
  }

  protected resolveMemberExpression(
    item: ASTMemberExpression,
    noInvoke: boolean = false
  ): IEntity {
    const entity = this.resolveNamespace(item);

    if (entity === null) {
      return this.factory(CompletionItemKind.Value).addType(
        SignatureDefinitionBaseType.Any
      );
    }

    if (entity.isCallable() && !noInvoke) {
      const returnTypes = entity.getCallableReturnTypes();

      if (returnTypes) {
        return this.factory(CompletionItemKind.Variable).addType(
          ...returnTypes
        );
      }

      return this.factory(CompletionItemKind.Value).addType(
        SignatureDefinitionBaseType.Any
      );
    }

    return entity;
  }

  protected resolveIdentifier(
    item: ASTIdentifier,
    noInvoke: boolean = false
  ): IEntity {
    return (
      this._scope.resolveProperty(item.name, noInvoke) ??
      this.factory(CompletionItemKind.Value).addType(
        SignatureDefinitionBaseType.Any
      )
    );
  }

  resolveType(item: ASTBase, noInvoke: boolean = false): IEntity {
    if (item == null) {
      return null;
    }

    switch (item.type) {
      case ASTType.BinaryExpression:
        return this.resolveBinaryExpression(item as ASTEvaluationExpression);
      case ASTType.LogicalExpression:
      case ASTType.IsaExpression:
        return this.resolveLogicalExpression(item as ASTEvaluationExpression);
      case ASTType.FunctionDeclaration:
        return this.resolveFunctionStatement(item as ASTFunctionStatement);
      case ASTType.IndexExpression:
        return this.resolveIndexExpression(
          item as ASTIndexExpression,
          noInvoke
        );
      case ASTType.MemberExpression:
        return this.resolveMemberExpression(
          item as ASTMemberExpression,
          noInvoke
        );
      case ASTType.Identifier:
        return this.resolveIdentifier(item as ASTIdentifier, noInvoke);
      case ASTType.MapConstructorExpression:
        return this.resolveMapConstructorExpression(
          item as ASTMapConstructorExpression
        );
      case ASTType.ListConstructorExpression:
        return this.resolveListConstructorExpression(
          item as ASTListConstructorExpression
        );
      case ASTType.NegationExpression:
      case ASTType.BinaryNegatedExpression:
      case ASTType.UnaryExpression:
        return this.resolveUnaryExpression(item as ASTUnaryExpression);
      case ASTType.NilLiteral:
        return this.factory(CompletionItemKind.Value).addType('null');
      case ASTType.StringLiteral:
        return this.factory(CompletionItemKind.Value).addType(
          SignatureDefinitionBaseType.String
        );
      case ASTType.NumericLiteral:
      case ASTType.BooleanLiteral:
        return this.factory(CompletionItemKind.Value).addType(
          SignatureDefinitionBaseType.Number
        );
      default:
        return this.factory(CompletionItemKind.Value).addType(
          SignatureDefinitionBaseType.Any
        );
    }
  }

  protected resolveChain(chain: ResolveChainItem[]): IEntity | null {
    if (chain.length === 0) {
      return null;
    }

    let current: IEntity = null;
    const first = chain[0];

    if (isResolveChainItemWithIdentifier(first)) {
      if (first.getter.name === 'globals') {
        current = this._scope.globals;
      } else if (first.getter.name === 'outer') {
        current = this._scope.outer;
      } else if (first.getter.name === 'locals') {
        current = this._scope.outer;
      } else {
        current = this._scope.resolveProperty(
          first.getter.name,
          first.unary?.operator === '@'
        );
      }
    } else if (isResolveChainItemWithValue(first)) {
      current = this.resolveType(first.value);
    } else {
      return null;
    }

    if (first.unary?.operator === 'new' && current !== null) {
      const newInstance = this.factory(CompletionItemKind.Value).addType(
        SignatureDefinitionBaseType.Map
      );
      newInstance.setProperty('__isa', current);
      current = newInstance;
    }

    const length = chain.length;

    for (let index = 1; index < length && current !== null; index++) {
      const item = chain[index];

      if (isResolveChainItemWithMember(item)) {
        current = current.resolveProperty(
          item.getter.name,
          item.unary?.operator === '@'
        );
      } else if (isResolveChainItemWithIndex(item)) {
        if (item.getter.type === ASTType.StringLiteral) {
          current = current.resolveProperty(
            (item.getter as ASTLiteral).value.toString(),
            item.unary?.operator === '@'
          );
        } else {
          const index = this.resolveType(item.getter);
          current = current.resolveProperty(
            index,
            item.unary?.operator === '@'
          );
        }
      } else if (item.type === ASTType.CallExpression && current.isCallable()) {
        current = this.factory(CompletionItemKind.Property).addType(
          ...current.getCallableReturnTypes()
        );
      } else if (item.type === ASTType.SliceExpression) {
        // while slicing it will remain pretty much as the same value
        current = current.copy();
      } else {
        return null;
      }

      if (first.unary?.operator === 'new' && current !== null) {
        const newInstance = this.factory(CompletionItemKind.Value).addType(
          SignatureDefinitionBaseType.Map
        );
        newInstance.setProperty('__isa', current);
        current = newInstance;
      }
    }

    return current;
  }

  resolveNamespace(item: ASTBase) {
    const astChain = createResolveChain(item);
    return this.resolveChain(astChain);
  }

  defineNamespace(item: ASTBase, container: IEntity): boolean {
    const astChain = createResolveChain(item);
    const last = astChain.pop();

    if (astChain.length > 0) {
      const resolvedContext = this.resolveChain(astChain);

      if (resolvedContext === null) {
        return false;
      }

      if (isResolveChainItemWithMember(last)) {
        return resolvedContext.setProperty(last.getter.name, container);
      } else if (isResolveChainItemWithIndex(last)) {
        if (last.getter.type === ASTType.StringLiteral) {
          return resolvedContext.setProperty(
            (last.getter as ASTLiteral).value.toString(),
            container
          );
        } else {
          const index = this.resolveType(last.getter);
          return resolvedContext.setProperty(index, container);
        }
      }

      return false;
    }

    const context: IEntity = this._scope;

    if (isResolveChainItemWithIdentifier(last)) {
      return context.setProperty(last.getter.name, container);
    }

    return false;
  }

  findAssignments(item: ASTBase): ASTAssignmentStatement[] {
    const itemHash = createExpressionHash(item);
    return this._definitions.get(itemHash) ?? [];
  }

  analyze() {
    for (let index = 0; index < this._root.assignments.length; index++) {
      const item = this._root.assignments[index] as ASTAssignmentStatement;
      const variableHash = createExpressionHash(item.variable);
      const value =
        this.resolveType(item.init) ??
        new Entity({
          kind: CompletionItemKind.Value,
          document: this._document
        }).addType(SignatureDefinitionBaseType.Any);

      this.defineNamespace(item.variable, value);

      const definition = this._definitions.get(variableHash);

      if (definition) {
        definition.push(item);
      } else {
        this._definitions.set(variableHash, [item]);
      }
    }
  }
}
