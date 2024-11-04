import { ASTType as GreybelASTType } from 'greybel-core';
import {
  SignatureDefinitionBaseType,
  SignatureDefinitionFunction
} from 'meta-utils';
import {
  ASTAssignmentStatement,
  ASTBase,
  ASTBaseBlockWithScope,
  ASTBinaryExpression,
  ASTCallExpression,
  ASTCallStatement,
  ASTComment,
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
  ASTUnaryExpression,
  Keyword
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
import { isValidIdentifierLiteral } from '../utils/is-valid-identifier-literal';
import { parseMapDescription } from '../utils/parse-map-description';
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
      container: this._document.container
    });
  }

  protected createMapDescription(item: ASTBase): string | null {
    const previousItem = this._document.getLastASTItemOfLine(
      item.start.line - 1
    );
    const currentItem = this._document.findASTItemInLine(
      item.start.line,
      ASTType.Comment
    );

    if (previousItem instanceof ASTComment) {
      const visited: Set<ASTBase> = new Set();
      const lines = [];
      let index = item.start.line - 1;

      while (index >= 0) {
        const item = this._document.getLastASTItemOfLine(index--);

        if (visited.has(item)) continue;

        if (item instanceof ASTComment) {
          visited.add(item);
          lines.unshift(item.value);
        } else {
          break;
        }
      }

      return lines.join('\n');
    } else if (currentItem instanceof ASTComment) {
      return currentItem.value;
    }

    return null;
  }

  protected createCustomTypeFromMap(item: ASTBase, entity: IEntity): void {
    const comment = this.createMapDescription(item);

    if (comment == null) {
      return;
    }

    const result = parseMapDescription(comment);

    if (result == null) {
      return;
    }

    result.properties.forEach((property) => {
      if (property.path === '__isa') {
        return;
      }

      const path = property.path.split('.');
      const propertyEntity = this.factory(CompletionItemKind.Property)
        .addType(property.type)
        .setLabel(path[path.length - 1]);

      this.setEntityInPath(entity, path, propertyEntity);
    });

    this._scope.setCustomType(result.type, entity);
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
      const visited: Set<ASTBase> = new Set();
      const lines = [];
      let index = item.start.line - 1;

      while (index >= 0) {
        const item = this._document.getLastASTItemOfLine(index--);

        if (visited.has(item)) continue;

        if (item instanceof ASTComment) {
          visited.add(item);
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
          types: Array.from(this.resolveTypeWithDefault(assignment.init).types)
        };
      }),
      returns: ['any']
    }) as SignatureDefinitionFunction;

    return this.factory(CompletionItemKind.Function)
      .addType(SignatureDefinitionBaseType.Function)
      .addSignatureType(enrichWithMetaInformation(signature))
      .setLine(item.start.line);
  }

  protected resolveParenthesisExpression(item: ASTParenthesisExpression) {
    return this.resolveTypeWithDefault(item.expression);
  }

  protected resolveBinaryExpression(item: ASTBinaryExpression) {
    const binaryExpr = this.factory(CompletionItemKind.Expression)
      .setLabel('Binary Expr')
      .setLine(item.start.line);
    const left = this.resolveTypeWithDefault(item.left);
    const right = this.resolveTypeWithDefault(item.right);

    // improve logic
    binaryExpr.extend(left);
    binaryExpr.extend(right);

    return binaryExpr;
  }

  protected resolveLogicalExpression(item: ASTLogicalExpression) {
    return this.factory(CompletionItemKind.Expression)
      .setLabel('Logical Expr')
      .addType(SignatureDefinitionBaseType.Number)
      .setLine(item.start.line);
  }

  protected resolveComparisonGroupExpression(
    item: ASTComparisonGroupExpression
  ) {
    return this.factory(CompletionItemKind.Expression)
      .setLabel('Comparison Group Expr')
      .addType(SignatureDefinitionBaseType.Number)
      .setLine(item.start.line);
  }

  protected resolveIsaExpression(item: ASTIsaExpression) {
    return this.factory(CompletionItemKind.Expression)
      .setLabel('Isa Expr')
      .addType(SignatureDefinitionBaseType.Number)
      .setLine(item.start.line);
  }

  protected resolveCallStatement(item: ASTCallStatement) {
    const entity = this.resolveNamespace(item);

    if (entity === null) {
      return this.factory(CompletionItemKind.Variable)
        .addType(SignatureDefinitionBaseType.Any)
        .setLine(item.start.line);
    }

    return entity;
  }

  protected resolveCallExpression(item: ASTCallExpression) {
    const entity = this.resolveNamespace(item);

    if (entity === null) {
      return this.factory(CompletionItemKind.Variable)
        .addType(SignatureDefinitionBaseType.Any)
        .setLine(item.start.line);
    }

    return entity;
  }

  protected resolveUnaryExpression(item: ASTUnaryExpression) {
    const entity = this.resolveNamespace(item);

    if (entity === null) {
      return this.factory(CompletionItemKind.Variable)
        .addType(SignatureDefinitionBaseType.Any)
        .setLine(item.start.line);
    }

    return entity;
  }

  protected resolveMapConstructorExpression(item: ASTMapConstructorExpression) {
    const mapEntity = this.factory(CompletionItemKind.MapConstructor).addType(
      SignatureDefinitionBaseType.Map
    );

    for (let index = 0; index < item.fields.length; index++) {
      const field = item.fields[index];
      const value = this.resolveTypeWithDefault(field.value).setLine(
        field.start.line
      );

      if (field.key.type === ASTType.StringLiteral) {
        mapEntity.setProperty(
          (field.key as ASTLiteral).value.toString(),
          value
        );
      } else {
        const key = this.resolveTypeWithDefault(field.key).setLine(
          field.start.line
        );
        mapEntity.setProperty(key, value);
      }
    }

    this.createCustomTypeFromMap(item, mapEntity);

    return mapEntity.setLabel('{}').setLine(item.start.line);
  }

  protected resolveListConstructorExpression(
    item: ASTListConstructorExpression
  ) {
    const listEntity = this.factory(CompletionItemKind.ListConstructor).addType(
      SignatureDefinitionBaseType.List
    );

    for (let index = 0; index < item.fields.length; index++) {
      const field = item.fields[index];
      const key = this.factory(CompletionItemKind.Variable)
        .addType(SignatureDefinitionBaseType.Number)
        .setLine(field.start.line);
      const value = this.resolveTypeWithDefault(field.value).setLine(
        field.start.line
      );

      listEntity.setProperty(key, value);
    }

    return listEntity.setLabel('[]').setLine(item.start.line);
  }

  protected resolveSliceExpression(item: ASTSliceExpression): IEntity {
    const entity = this.resolveNamespace(item);

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

    return entity;
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

    return entity;
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

    return entity;
  }

  resolveType(item: ASTBase, noInvoke: boolean = false): IEntity | null {
    if (item == null) {
      return null;
    }

    switch (item.type) {
      case ASTType.ParenthesisExpression:
        return this.resolveParenthesisExpression(
          item as ASTParenthesisExpression
        );
      case ASTType.CallStatement:
        return this.resolveCallStatement(item as ASTCallStatement);
      case ASTType.CallExpression:
        return this.resolveCallExpression(item as ASTCallExpression);
      case ASTType.BinaryExpression:
        return this.resolveBinaryExpression(item as ASTBinaryExpression);
      case ASTType.LogicalExpression:
        return this.resolveLogicalExpression(item as ASTLogicalExpression);
      case ASTType.IsaExpression:
        return this.resolveIsaExpression(item as ASTIsaExpression);
      case ASTType.ComparisonGroupExpression:
        return this.resolveComparisonGroupExpression(
          item as ASTComparisonGroupExpression
        );
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
      case GreybelASTType.FeatureFileExpression:
        return this.factory(CompletionItemKind.Expression)
          .addType(SignatureDefinitionBaseType.String)
          .setLabel('File Expr')
          .setLine(item.start.line);
      case GreybelASTType.FeatureLineExpression:
        return this.factory(CompletionItemKind.Expression)
          .addType(SignatureDefinitionBaseType.Number)
          .setLabel('Line Expr')
          .setLine(item.start.line);
      case GreybelASTType.FeatureEnvarExpression:
        return this.factory(CompletionItemKind.Expression)
          .addType(SignatureDefinitionBaseType.String)
          .setLabel('Envar Expr')
          .setLine(item.start.line);
      case GreybelASTType.FeatureInjectExpression:
        return this.factory(CompletionItemKind.Expression)
          .addType(SignatureDefinitionBaseType.String)
          .setLabel('Inject Expr')
          .setLine(item.start.line);
      default:
        return null;
    }
  }

  resolveTypeWithDefault(
    item: ASTBase | null = null,
    noInvoke: boolean = false
  ): IEntity {
    const type = this.resolveType(item, noInvoke);

    if (type == null) {
      const defaultType = this.factory(CompletionItemKind.Variable).addType(
        SignatureDefinitionBaseType.Any
      );

      if (item != null) {
        defaultType.setLine(item.start.line);
      }

      return defaultType;
    }

    return type;
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
      } else if (first.getter.name === 'super') {
        const context = this._document
          .getScopeContext(first.ref.scope)
          ?.scope.context?.getIsa();

        if (context == null) {
          current = this.factory(CompletionItemKind.Constant)
            .addType('null')
            .setLabel('super');
        } else {
          current = context.copy({
            kind: CompletionItemKind.Constant,
            label: 'super',
            values: context.values
          });
        }
      } else if (first.getter.name === 'self') {
        const context = this._document.getScopeContext(first.ref.scope)?.scope
          .context;

        if (context == null) {
          current = this.factory(CompletionItemKind.Constant)
            .addType('null')
            .setLabel('self');
        } else {
          current = context.copy({
            kind: CompletionItemKind.Constant,
            label: 'self',
            values: context.values
          });
        }
      } else {
        current =
          this._scope.resolveNamespace(first.getter.name, firstNoInvoke) ??
          this.factory(CompletionItemKind.Variable)
            .addType(SignatureDefinitionBaseType.Any)
            .setLabel(first.getter.name);
      }
    } else if (isResolveChainItemWithValue(first)) {
      current = this.resolveTypeWithDefault(first.value, firstNoInvoke);
    } else {
      return null;
    }

    if (first.unary?.operator === Keyword.New && current !== null) {
      const newInstance = this.factory(CompletionItemKind.Variable)
        .addType(SignatureDefinitionBaseType.Map)
        .setLabel(current.label);
      newInstance.setProperty('__isa', current);
      this.createCustomTypeFromMap(first.unary, newInstance);
      current = newInstance;
    }

    const length = chain.length;

    for (let index = 1; index < length && current !== null; index++) {
      const item = chain[index];
      const itemNoInvoke =
        (item.unary?.operator === '@' && !item.isInCallExpression) ||
        (noInvoke && chain.length - 1 === index);

      if (isResolveChainItemWithMember(item)) {
        current =
          current.resolveProperty(item.getter.name, itemNoInvoke) ??
          this.factory(CompletionItemKind.Variable)
            .addType(SignatureDefinitionBaseType.Any)
            .setLabel(item.getter.name);
      } else if (isResolveChainItemWithIndex(item)) {
        // index expressions do not get invoked automatically
        if (isValidIdentifierLiteral(item.getter)) {
          const name = item.getter.value.toString();
          current =
            current.resolveProperty(name, item.isInCallExpression) ??
            this.factory(CompletionItemKind.Variable)
              .addType(SignatureDefinitionBaseType.Any)
              .setLabel(name);
        } else {
          const index = this.resolveTypeWithDefault(item.getter);
          current =
            current.resolveProperty(index, item.isInCallExpression) ??
            this.factory(CompletionItemKind.Variable).addType(
              SignatureDefinitionBaseType.Any
            );
        }
      } else if (item.ref.type === ASTType.SliceExpression) {
        // while slicing it will remain pretty much as the same value
        current = current.copy();
      } else {
        return null;
      }

      if (item.unary?.operator === Keyword.New && current !== null) {
        const newInstance = this.factory(CompletionItemKind.Property)
          .addType(SignatureDefinitionBaseType.Map)
          .setLabel(current.label);
        newInstance.setProperty('__isa', current);
        this.createCustomTypeFromMap(item.unary, newInstance);
        current = newInstance;
      }
    }

    return current;
  }

  setEntityInPath(source: IEntity, path: string[], value: IEntity): boolean {
    let current: IEntity = source;

    for (let index = 0; index < path.length - 1; index++) {
      const key = path[index];
      let next = current.resolveProperty(key);

      if (next == null) {
        const newEntity = this.factory(CompletionItemKind.Property)
          .addType(SignatureDefinitionBaseType.Map)
          .setLabel(key);
        current.setProperty(key, newEntity);
        next = newEntity;
      }

      current = next;
    }

    return current.setProperty(path[path.length - 1], value);
  }

  getEntityInPath(source: IEntity, path: string[]): IEntity | null {
    let current: IEntity = source;

    for (let index = 0; index < path.length; index++) {
      const key = path[index];
      const next = current.resolveProperty(key);

      if (next == null) {
        return null;
      }

      current = next;
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
        if (isValidIdentifierLiteral(last.getter)) {
          return resolvedContext.setProperty(
            last.getter.value.toString(),
            container
          );
        } else {
          const index = this.resolveTypeWithDefault(last.getter);
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
    let itemId = createExpressionId(item);
    let aggregator: Aggregator = this;

    if (itemId.startsWith('globals.')) {
      aggregator = this._document.getRootScopeContext()
        .aggregator as Aggregator;
      itemId = itemId.slice(8);
    } else if (itemId.startsWith('locals.')) {
      aggregator = this;
      itemId = itemId.slice(7);
    } else if (itemId.startsWith('outer.')) {
      aggregator = this.parent as Aggregator;
      itemId = itemId.slice(6);
    }

    const assignments: ASTAssignmentStatement[] = [];
    const aggregators = new Set([
      aggregator,
      aggregator._parent,
      aggregator._document.getRootScopeContext().aggregator
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
      const value =
        this.resolveType(item.init)?.copy().setLine(item.start.line) ??
        this.factory(CompletionItemKind.Variable)
          .addType(SignatureDefinitionBaseType.Any)
          .setLine(item.start.line);

      this.defineNamespace(item.variable, value);

      let variableId = createExpressionId(item.variable);
      let definitions = this._definitions;

      if (variableId.startsWith('globals.')) {
        definitions =
          this._document.getRootScopeContext().aggregator.definitions;
        variableId = variableId.slice(8);
      } else if (variableId.startsWith('locals.')) {
        definitions = this._definitions;
        variableId = variableId.slice(7);
      } else if (variableId.startsWith('outer.')) {
        definitions = this.parent.definitions;
        variableId = variableId.slice(6);
      }

      const definition = definitions.get(variableId);

      if (definition) {
        definition.push(item);
      } else {
        definitions.set(variableId, [item]);
      }
    }
  }
}
