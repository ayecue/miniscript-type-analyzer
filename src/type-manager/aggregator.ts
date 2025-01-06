import {
  ASTFeatureImportExpression,
  ASTType as GreybelASTType
} from 'greybel-core';
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
  ASTForGenericStatement,
  ASTFunctionStatement,
  ASTIdentifier,
  ASTIdentifierKind,
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
import {
  ASTDefinitionItem,
  IEntity,
  IScope,
  PropertyType
} from '../types/object';
import {
  isResolveChainItemWithIdentifier,
  isResolveChainItemWithIndex,
  isResolveChainItemWithMember,
  isResolveChainItemWithValue,
  ResolveChainItem
} from '../types/resolve';
import { createExpressionId } from '../utils/create-expression-id';
import { createResolveChain } from '../utils/create-resolve-chain';
import { enrichWithMetaInformation } from '../utils/enrich-with-meta-information';
import { isValidIdentifierLiteral } from '../utils/is-valid-identifier-literal';
import { merge } from '../utils/merge';
import { mergeUnique } from '../utils/merge-unique';
import { parseMapDescription } from '../utils/parse-map-description';
import { Entity } from './entity';

export class ASTChainIterator implements Iterator<IEntity> {
  aggregator: IAggregator;
  chain: ResolveChainItem[];
  current: IEntity;
  index: number;
  endIndex: number;
  noInvoke: boolean;
  assume: boolean;

  constructor(
    aggregator: IAggregator,
    chain: ResolveChainItem[],
    noInvoke: boolean = false,
    assume: boolean = false
  ) {
    this.aggregator = aggregator;
    this.chain = chain;
    this.noInvoke = noInvoke;
    this.assume = assume;
    this.index = 0;
    this.endIndex = this.chain.length - 1;
    this.current = null;
  }

  private defineAssumedProperty(
    entity: IEntity,
    property: string | IEntity
  ): IEntity {
    const value = this.aggregator.factory(
      this.index === 0
        ? CompletionItemKind.Variable
        : CompletionItemKind.Property
    );

    if (typeof property === 'string') {
      value.setLabel(property);
    }

    if (this.assume) {
      value.addType(SignatureDefinitionBaseType.Map);

      entity.setProperty(property, value);

      return entity.resolveProperty(property, true);
    }

    value.addType(SignatureDefinitionBaseType.Any);

    return value;
  }

  private getInitial(): IEntity {
    let initial: IEntity = null;
    const scope = this.aggregator.scope;
    const document = this.aggregator.document;
    const first = this.chain[0];
    const firstNoInvoke =
      (first.unary?.operator === '@' && !first.isInCallExpression) ||
      (this.noInvoke && this.index === this.endIndex);

    if (isResolveChainItemWithIdentifier(first)) {
      if (first.getter.name === 'globals') {
        initial = scope.globals;
      } else if (first.getter.name === 'outer') {
        initial = scope.outer;
      } else if (first.getter.name === 'locals') {
        initial = scope.locals;
      } else if (first.getter.name === 'super') {
        const context = document
          .getScopeContext(first.ref.scope)
          ?.scope.context?.getIsa();

        if (context == null) {
          initial = this.aggregator
            .factory(CompletionItemKind.Constant)
            .addType('null')
            .setLabel('super');
        } else {
          initial = context.copy({
            kind: CompletionItemKind.Constant,
            label: 'super',
            values: context.values
          });
        }
      } else if (first.getter.name === 'self') {
        const context = document.getScopeContext(first.ref.scope)?.scope
          .context;

        if (context == null) {
          initial = this.aggregator
            .factory(CompletionItemKind.Constant)
            .addType('null')
            .setLabel('self');
        } else {
          initial = context.copy({
            kind: CompletionItemKind.Constant,
            label: 'self',
            values: context.values
          });
        }
      } else {
        let nextEntity = scope.resolveNamespace(
          first.getter.name,
          firstNoInvoke
        );

        if (nextEntity == null) {
          nextEntity = this.defineAssumedProperty(
            scope.globals,
            first.getter.name
          );
        }

        initial = nextEntity;
      }
    } else if (isResolveChainItemWithValue(first)) {
      initial = this.aggregator.resolveTypeWithDefault(
        first.value,
        firstNoInvoke
      );
    } else {
      return null;
    }

    if (first.unary?.operator === Keyword.New && initial !== null) {
      const newInstance = this.aggregator
        .factory(CompletionItemKind.Variable)
        .addType(SignatureDefinitionBaseType.Map)
        .setLabel(initial.label);
      newInstance.setProperty('__isa', initial);
      this.aggregator.createCustomTypeFromMap(first.unary, newInstance);
      initial = newInstance;
    }

    return initial;
  }

  private getNext(): IEntity {
    let current: IEntity = this.current;
    const item = this.chain[this.index];

    if (isResolveChainItemWithMember(item)) {
      const itemNoInvoke =
        (item.unary?.operator === '@' && !item.isInCallExpression) ||
        (this.noInvoke && this.index === this.endIndex);
      let nextEntity = current.resolveProperty(item.getter.name, itemNoInvoke);

      if (nextEntity == null) {
        nextEntity = this.defineAssumedProperty(current, item.getter.name);
      }

      current = nextEntity;
    } else if (isResolveChainItemWithIndex(item)) {
      const itemNoInvoke =
        (item.unary?.operator === '@' && !item.isInCallExpression) ||
        (this.noInvoke && this.index === this.endIndex) ||
        (!item.ref.isStatementStart && !item.isInCallExpression);

      // index expressions do not get invoked automatically
      if (isValidIdentifierLiteral(item.getter)) {
        const name = item.getter.value.toString();
        let nextEntity = current.resolveProperty(name, itemNoInvoke);

        if (nextEntity == null) {
          nextEntity = this.defineAssumedProperty(current, name);
        }

        current = nextEntity;
      } else {
        const index = this.aggregator.resolveTypeWithDefault(item.getter);
        let nextEntity = current.resolveProperty(
          index,
          itemNoInvoke
        );

        if (nextEntity == null) {
          nextEntity = this.defineAssumedProperty(current, index);
        }

        current = nextEntity;
      }
    } else if (item.ref.type === ASTType.SliceExpression) {
      // while slicing it will remain pretty much as the same value
      current = current.copy();
    } else {
      return null;
    }

    if (item.unary?.operator === Keyword.New && this.current !== null) {
      const newInstance = this.aggregator
        .factory(CompletionItemKind.Property)
        .addType(SignatureDefinitionBaseType.Map)
        .setLabel(current.label);
      newInstance.setProperty('__isa', current);
      this.aggregator.createCustomTypeFromMap(item.unary, newInstance);
      current = newInstance;
    }

    return current;
  }

  next(): IteratorResult<IEntity> {
    if (this.index >= this.chain.length) {
      return {
        value: null,
        done: true
      };
    }

    const value = this.index === 0 ? this.getInitial() : this.getNext();

    if (value == null) {
      return {
        value: null,
        done: true
      };
    }

    this.index++;
    this.current = value;

    return {
      value,
      done: false
    };
  }
}

export class Aggregator implements IAggregator {
  protected _parent: Aggregator | null;
  protected _scope: IScope;
  protected _document: IDocument;
  protected _root: ASTBaseBlockWithScope;
  protected _definitions: Map<string, ASTDefinitionItem[]>;
  private _lastModifiedProperty: IEntity | null;

  get definitions(): Map<string, ASTDefinitionItem[]> {
    return this._definitions;
  }

  get parent(): IAggregator | null {
    return this._parent;
  }

  get scope(): IScope {
    return this._scope;
  }

  get document(): IDocument {
    return this._document;
  }

  constructor(options: AggregatorOptions) {
    this._root = options.root;
    this._scope = options.scope;
    this._document = options.document;
    this._parent = (options.parent as Aggregator) ?? null;
    this._definitions = new Map();
    this._lastModifiedProperty = null;
  }

  factory(kind: CompletionItemKind): IEntity {
    return new Entity({
      source: this._document.source,
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

  createCustomTypeFromMap(item: ASTBase, entity: IEntity): void {
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
        .addTypesWithMeta(property.type)
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
        const property = (field.key as ASTLiteral).value.toString();
        mapEntity.setProperty(property, value);
        mapEntity.values
          .get(`${PropertyType.Identifier}:${property}`)
          ?.definitions.push({
            source: this._document.source,
            node: field
          });
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
    noInvoke: boolean = false,
    assume: boolean = false
  ): IEntity | null {
    if (chain.length === 0) {
      return null;
    }

    const iterator = new ASTChainIterator(this, chain, noInvoke, assume);
    let current: IEntity = null;
    let next = iterator.next();

    while (!next.done) {
      current = next.value;
      next = iterator.next();
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

  private defineProperty(
    context: IEntity,
    name: string | IEntity,
    item: IEntity
  ): boolean {
    const success = context.setProperty(name, item);
    this._lastModifiedProperty = context.resolveProperty(name, true);
    return success;
  }

  defineNamespace(item: ASTBase, container: IEntity): boolean {
    const astChain = createResolveChain(item);
    const last = astChain.pop();

    this._lastModifiedProperty = null;

    if (astChain.length > 0) {
      const resolvedContext = this.resolveChain(astChain, false, true);

      if (resolvedContext === null) {
        return false;
      }

      if (isResolveChainItemWithMember(last)) {
        return this.defineProperty(
          resolvedContext,
          last.getter.name,
          container
        );
      } else if (isResolveChainItemWithIndex(last)) {
        if (isValidIdentifierLiteral(last.getter)) {
          return this.defineProperty(
            resolvedContext,
            last.getter.value.toString(),
            container
          );
        } else {
          const index = this.resolveTypeWithDefault(last.getter);
          return this.defineProperty(resolvedContext, index, container);
        }
      }

      return false;
    }

    const context: IEntity = this._scope;

    if (isResolveChainItemWithIdentifier(last)) {
      return this.defineProperty(context, last.getter.name, container);
    }

    return false;
  }

  private addDefinition(node: ASTBase, variable: ASTBase): void {
    this._lastModifiedProperty?.definitions.push({
      source: this._document.source,
      node
    });

    let variableId = createExpressionId(variable);
    let definitions = this._definitions;

    if (variableId.startsWith('globals.')) {
      definitions = this._document.getRootScopeContext().aggregator.definitions;
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
      definition.push({
        source: this._document.source,
        node
      });
    } else {
      definitions.set(variableId, [
        {
          source: this._document.source,
          node
        }
      ]);
    }
  }

  resolveAvailableAssignmentsWithQuery(query: string): ASTDefinitionItem[] {
    const assignments: ASTDefinitionItem[] = [];
    const aggregators = new Set([
      this,
      this._parent,
      this._document.getRootScopeContext().aggregator
    ]) as Set<Aggregator>;

    aggregators.forEach((aggregator) => {
      const definitions = aggregator.definitions;

      definitions.forEach((_, definitionId) => {
        if (definitionId.includes(query)) {
          const definition = definitions.get(definitionId)!;
          merge(assignments, definition);
        }
      });
    });

    return assignments;
  }

  resolveAvailableAssignments(item: ASTBase): ASTDefinitionItem[] {
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

    const assignments: ASTDefinitionItem[] = [];
    const aggregators = new Set([
      aggregator,
      aggregator._parent,
      aggregator._document.getRootScopeContext().aggregator
    ]) as Set<Aggregator>;

    aggregators.forEach((aggregator) => {
      if (aggregator == null) return;
      const entity = aggregator.resolveNamespace(item, true);
      if (entity != null) merge(assignments, entity.definitions);
    });

    return assignments;
  }

  private analyzeAssignmentDefinition(item: ASTAssignmentStatement) {
    const value =
      this.resolveType(item.init)
        ?.copy({ source: this._document.source })
        .setLine(item.start.line) ??
      this.factory(CompletionItemKind.Variable)
        .addType(SignatureDefinitionBaseType.Any)
        .setLine(item.start.line);

    this.defineNamespace(item.variable, value);
    this.addDefinition(item, item.variable);
  }

  private analyzeForDefinition(item: ASTForGenericStatement) {
    // define the iterator variable
    const iteratorValue =
      this.resolveType(item.iterator)
        ?.copy({ source: this._document.source })
        .setLine(item.start.line) ??
      this.factory(CompletionItemKind.Variable)
        .addType(SignatureDefinitionBaseType.Any)
        .setLine(item.start.line);
    const value = this.factory(CompletionItemKind.Variable).setLine(
      item.start.line
    );

    if (iteratorValue.types.has(SignatureDefinitionBaseType.List)) {
      const itemEntity = iteratorValue.values.get(
        `${PropertyType.Type}:number`
      );
      if (itemEntity != null) {
        value.extend(itemEntity);
      }
    }

    if (iteratorValue.types.has(SignatureDefinitionBaseType.String)) {
      value.addType(SignatureDefinitionBaseType.String);
    }

    if (iteratorValue.types.has(SignatureDefinitionBaseType.Map)) {
      const propertyEntity = this.factory(CompletionItemKind.Variable)
        .addTypes(iteratorValue.getPropertyTypes())
        .setLine(item.start.line);
      const valueEntity = this.factory(CompletionItemKind.Property)
        .addTypes(iteratorValue.getValueTypes())
        .setLine(item.start.line);
      value.addType(SignatureDefinitionBaseType.Map);
      value.setProperty('key', propertyEntity);
      value.setProperty('value', valueEntity);
    }

    if (value.types.size === 0) {
      value.addType(SignatureDefinitionBaseType.Any);
    }

    this.defineNamespace(item.variable, value);
    this.addDefinition(item, item.variable);

    // define the index variable
    const idxValue = this.factory(CompletionItemKind.Variable)
      .addType(SignatureDefinitionBaseType.Number)
      .setLine(item.start.line);
    const idxItem = new ASTIdentifier({
      name: `__${item.variable.name}_idx`,
      kind: ASTIdentifierKind.Variable,
      range: item.range,
      start: item.start,
      end: item.end
    });

    this.defineNamespace(idxItem, idxValue);
    this.addDefinition(item, idxItem);
  }

  private analyzeImportDefinition(item: ASTFeatureImportExpression) {
    // use any if import namespace is not defined yet
    const identifier = item.name as ASTIdentifier;
    const existingEntity = this.scope.resolveProperty(identifier.name, true);

    if (existingEntity != null) {
      this._lastModifiedProperty = existingEntity;
      this.addDefinition(item, item.name);
      return;
    }

    const value = this.factory(CompletionItemKind.Variable)
      .addType(SignatureDefinitionBaseType.Any)
      .setLine(item.start.line);

    this.defineNamespace(item.name, value);
    this.addDefinition(item, item.name);
  }

  analyze() {
    for (let index = 0; index < this._root.definitions.length; index++) {
      const item = this._root.definitions[index];

      switch (item.type) {
        case ASTType.AssignmentStatement: {
          this.analyzeAssignmentDefinition(item as ASTAssignmentStatement);
          break;
        }
        case ASTType.ForGenericStatement: {
          this.analyzeForDefinition(item as ASTForGenericStatement);
          break;
        }
        case GreybelASTType.FeatureImportExpression: {
          this.analyzeImportDefinition(item as ASTFeatureImportExpression);
          break;
        }
      }
    }
  }

  extend(aggregator: Aggregator): void {
    aggregator.definitions.forEach((value, key) => {
      const definition = this.definitions.get(key);

      if (definition) {
        mergeUnique(definition, value);
      } else {
        this.definitions.set(key, value);
      }
    });
  }
}
