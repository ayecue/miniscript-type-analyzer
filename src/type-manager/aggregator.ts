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
  ASTSliceExpression,
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
import { createExpressionId } from '../utils/create-expression-id';
import { enrichWithMetaInformation } from '../utils/enrich-with-meta-information';
import { createResolveChain } from '../utils/get-ast-chain';
import { Entity } from './entity';

export class Aggregator implements IAggregator {
  protected _parent: Aggregator | null;
  protected _scope: IScope;
  protected _document: IDocument;
  protected _root: ASTBaseBlockWithScope;
  protected _definitions: Map<string, ASTAssignmentStatement[]>;

  get definitions(): Map<string, ASTAssignmentStatement[]> {
    return this._definitions;
  }

  get parent(): IAggregator | null {
    return this._parent;
  }

  constructor(options: AggregatorOptions) {
    this._root = options.root;
    this._scope = options.scope;
    this._document = options.document;
    this._parent = (options.parent as Aggregator) ?? null;
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
      .addSignatureType(enrichWithMetaInformation(signature))
      .setLine(item.start.line);
  }

  protected resolveBinaryExpression(item: ASTEvaluationExpression) {
    // improve logic
    const left =
      this.resolveType(item.left) ??
      this.factory(CompletionItemKind.Variable).addType(
        SignatureDefinitionBaseType.Any
      );
    const right =
      this.resolveType(item.right) ??
      this.factory(CompletionItemKind.Variable).addType(
        SignatureDefinitionBaseType.Any
      );
    return left.extend(right).setLine(item.start.line);
  }

  protected resolveLogicalExpression(item: ASTEvaluationExpression) {
    // improve logic
    const left =
      this.resolveType(item.left) ??
      this.factory(CompletionItemKind.Variable).addType(
        SignatureDefinitionBaseType.Any
      );
    const right =
      this.resolveType(item.right) ??
      this.factory(CompletionItemKind.Variable).addType(
        SignatureDefinitionBaseType.Any
      );
    return left.extend(right).setLine(item.start.line);
  }

  protected resolveUnaryExpression(item: ASTUnaryExpression) {
    const entity = this.resolveNamespace(item);

    if (entity === null) {
      return this.factory(CompletionItemKind.Variable)
        .addType(SignatureDefinitionBaseType.Any)
        .setLine(item.start.line);
    }

    return entity.setLine(item.start.line);
  }

  protected resolveMapConstructorExpression(item: ASTMapConstructorExpression) {
    const mapEntity = this.factory(CompletionItemKind.MapConstructor).addType(
      SignatureDefinitionBaseType.Map
    );

    for (const field of item.fields) {
      const value = this.resolveType(field.value).setLine(field.start.line);

      if (field.key.type === ASTType.StringLiteral) {
        mapEntity.setProperty(
          (field.key as ASTLiteral).value.toString(),
          value
        );
      } else {
        const key = this.resolveType(field.key).setLine(field.start.line);
        mapEntity.setProperty(key, value);
      }
    }

    return mapEntity.setLabel('{}').setLine(item.start.line);
  }

  protected resolveListConstructorExpression(
    item: ASTListConstructorExpression
  ) {
    const listEntity = this.factory(CompletionItemKind.ListConstructor).addType(
      SignatureDefinitionBaseType.List
    );

    for (const field of item.fields) {
      const key = this.factory(CompletionItemKind.Variable)
        .addType(SignatureDefinitionBaseType.Number)
        .setLine(field.start.line);
      const value = this.resolveType(field.value).setLine(field.start.line);

      listEntity.setProperty(key, value);
    }

    return listEntity.setLabel('[]').setLine(item.start.line);
  }

  protected resolveSliceExpression(item: ASTSliceExpression): IEntity {
    const entity = this.resolveNamespace(item).setLine(item.start.line);

    if (entity === null) {
      return this.factory(CompletionItemKind.Variable)
        .addType(SignatureDefinitionBaseType.Any)
        .setLine(item.start.line);
    }

    return entity.setLine(item.start.line);
  }

  protected resolveIndexExpression(
    item: ASTIndexExpression,
    noInvoke: boolean = false
  ): IEntity {
    const entity = this.resolveNamespace(item, noInvoke);

    if (entity === null) {
      return this.factory(CompletionItemKind.Variable)
        .addType(SignatureDefinitionBaseType.Any)
        .setLine(item.start.line);
    }

    return entity.setLine(item.start.line);
  }

  protected resolveMemberExpression(
    item: ASTMemberExpression,
    noInvoke: boolean = false
  ): IEntity {
    const entity = this.resolveNamespace(item, noInvoke);

    if (entity === null) {
      return this.factory(CompletionItemKind.Property)
        .addType(SignatureDefinitionBaseType.Any)
        .setLabel((item.identifier as ASTIdentifier).name)
        .setLine(item.start.line);
    }

    return entity.setLine(item.start.line);
  }

  protected resolveIdentifier(
    item: ASTIdentifier,
    noInvoke: boolean = false
  ): IEntity {
    const entity = this.resolveNamespace(item, noInvoke);

    if (entity === null) {
      return this.factory(CompletionItemKind.Property)
        .addType(SignatureDefinitionBaseType.Any)
        .setLabel(item.name)
        .setLine(item.start.line);
    }

    return entity.setLine(item.start.line);
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
      case ASTType.SliceExpression:
        return this.resolveSliceExpression(item as ASTSliceExpression);
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
        return this.factory(CompletionItemKind.Literal)
          .addType('null')
          .setLabel('null')
          .setLine(item.start.line);
      case ASTType.StringLiteral: {
        const label = (item as ASTLiteral).value.toString();
        return this.factory(CompletionItemKind.Literal)
          .addType(SignatureDefinitionBaseType.String)
          .setLabel(
            `"${label.length > 20 ? label.substr(0, 20) + '...' : label}"`
          )
          .setLine(item.start.line);
      }
      case ASTType.NumericLiteral:
      case ASTType.BooleanLiteral: {
        const label = (item as ASTLiteral).value.toString();
        return this.factory(CompletionItemKind.Literal)
          .addType(SignatureDefinitionBaseType.Number)
          .setLabel(label)
          .setLine(item.start.line);
      }
      default:
        return this.factory(CompletionItemKind.Literal)
          .addType(SignatureDefinitionBaseType.Any)
          .setLine(item.start.line);
    }
  }

  protected resolveChain(
    chain: ResolveChainItem[],
    noInvoke: boolean = false
  ): IEntity | null {
    if (chain.length === 0) {
      return null;
    }

    let current: IEntity = null;
    const first = chain[0];
    const firstNoInvoke =
      (first.unary?.operator === '@' && !first.isInCallExpression) ||
      (noInvoke && chain.length === 1);

    if (isResolveChainItemWithIdentifier(first)) {
      if (first.getter.name === 'globals') {
        current = this._scope.globals;
      } else if (first.getter.name === 'outer') {
        current = this._scope.outer;
      } else if (first.getter.name === 'locals') {
        current = this._scope.locals;
      } else if (first.getter.name === 'self') {
        const context = this._document.getScopeContext(first.ref.scope)?.scope
          .context;

        if (context == null) {
          current = this.factory(CompletionItemKind.Constant)
            .addType(
              SignatureDefinitionBaseType.Map,
              SignatureDefinitionBaseType.Any
            )
            .setLabel('self');
        } else {
          current = context.copy({
            kind: CompletionItemKind.Constant,
            label: 'self'
          });
        }
      } else {
        current = this._scope.resolveProperty(first.getter.name, firstNoInvoke);
      }
    } else if (isResolveChainItemWithValue(first)) {
      current = this.resolveType(first.value, firstNoInvoke);
    } else {
      return null;
    }

    if (first.unary?.operator === 'new' && current !== null) {
      const newInstance = this.factory(CompletionItemKind.Variable)
        .addType(SignatureDefinitionBaseType.Map)
        .setLabel(current.label);
      newInstance.setProperty('__isa', current);
      current = newInstance;
    }

    const length = chain.length;

    for (let index = 1; index < length && current !== null; index++) {
      const item = chain[index];
      const itemNoInvoke =
        (item.unary?.operator === '@' && !item.isInCallExpression) ||
        (noInvoke && chain.length - 1 === index);

      if (isResolveChainItemWithMember(item)) {
        current = current.resolveProperty(item.getter.name, itemNoInvoke);
      } else if (isResolveChainItemWithIndex(item)) {
        // index expressions do not get invoked automatically
        if (item.getter.type === ASTType.StringLiteral) {
          const name = (item.getter as ASTLiteral).value.toString();
          current = current.resolveProperty(name, item.isInCallExpression);
        } else {
          const index = this.resolveType(item.getter);
          current = current.resolveProperty(index, item.isInCallExpression);
        }
      } else if (item.ref.type === ASTType.SliceExpression) {
        // while slicing it will remain pretty much as the same value
        current = current.copy();
      } else {
        return null;
      }

      if (first.unary?.operator === 'new' && current !== null) {
        const newInstance = this.factory(CompletionItemKind.Property)
          .addType(SignatureDefinitionBaseType.Map)
          .setLabel(current.label);
        newInstance.setProperty('__isa', current);
        current = newInstance;
      }
    }

    return current;
  }

  resolveNamespace(item: ASTBase, noInvoke: boolean = false): IEntity | null {
    const astChain = createResolveChain(item);
    return this.resolveChain(astChain, noInvoke);
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

  resolveAvailableAssignmentsWithQuery(
    query: string
  ): ASTAssignmentStatement[] {
    const assignments: ASTAssignmentStatement[] = [];
    const aggregators = new Set([
      this,
      this._parent,
      this._document.getRootScopeContext().aggregator
    ]) as Set<Aggregator>;

    for (const aggregator of aggregators) {
      const definitions = aggregator.definitions;

      for (const definitionId of definitions.keys()) {
        if (definitionId.includes(query)) {
          const definition = definitions.get(definitionId)!;
          assignments.push(...definition);
        }
      }
    }

    return assignments;
  }

  resolveAvailableAssignments(item: ASTBase): ASTAssignmentStatement[] {
    const itemId = createExpressionId(item);
    const assignments: ASTAssignmentStatement[] = [];
    const aggregators = new Set([
      this,
      this._parent,
      this._document.getRootScopeContext().aggregator
    ]) as Set<Aggregator>;

    for (const aggregator of aggregators) {
      if (aggregator == null) continue;
      const definition = aggregator._definitions.get(itemId);
      if (definition != null) assignments.push(...definition);
    }

    return assignments;
  }

  analyze() {
    for (let index = 0; index < this._root.assignments.length; index++) {
      const item = this._root.assignments[index] as ASTAssignmentStatement;
      const variableId = createExpressionId(item.variable);
      const value =
        this.resolveType(item.init)?.copy().setLine(item.start.line) ??
        new Entity({
          kind: CompletionItemKind.Variable,
          document: this._document
        })
          .addType(SignatureDefinitionBaseType.Any)
          .setLine(item.start.line);

      this.defineNamespace(item.variable, value);

      const definition = this._definitions.get(variableId);

      if (definition) {
        definition.push(item);
      } else {
        this._definitions.set(variableId, [item]);
      }
    }
  }
}
