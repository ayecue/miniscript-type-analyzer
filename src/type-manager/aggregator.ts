import { SignatureDefinitionBaseType } from 'meta-utils';
import {
  ASTBase,
  ASTIdentifier,
  ASTIndexExpression,
  ASTListConstructorExpression,
  ASTLiteral,
  ASTMapConstructorExpression,
  ASTMemberExpression,
  ASTType
} from 'miniscript-core';

import { AggregatorOptions, IAggregator } from '../types/aggregator';
import { CompletionItemKind } from '../types/completion';
import { EntityFactory, IEntity, IScope } from '../types/object';
import {
  isResolveChainItemWithIdentifier,
  isResolveChainItemWithIndex,
  isResolveChainItemWithMember,
  isResolveChainItemWithValue,
  ResolveChainItem
} from '../types/resolve';
import { createResolveChain } from '../utils/get-ast-chain';

export class Aggregator implements IAggregator {
  private _scope: IScope;
  private _factory: EntityFactory;

  constructor(options: AggregatorOptions) {
    this._scope = options.scope;
    this._factory = options.factory;
  }

  private resolveMapConstructorExpression(item: ASTMapConstructorExpression) {
    return this._factory(CompletionItemKind.Value).addType(
      SignatureDefinitionBaseType.Map
    );
  }

  private resolveListConstructorExpression(item: ASTListConstructorExpression) {
    return this._factory(CompletionItemKind.Value).addType(
      SignatureDefinitionBaseType.List
    );
  }

  private resolveIndexExpression(
    item: ASTIndexExpression,
    noInvoke: boolean = false
  ): IEntity {
    const entity = this.resolveNamespace(item);

    if (entity === null) {
      return this._factory(CompletionItemKind.Value).addType(
        SignatureDefinitionBaseType.Any
      );
    }

    return entity;
  }

  private resolveMemberExpression(
    item: ASTMemberExpression,
    noInvoke: boolean = false
  ): IEntity {
    const entity = this.resolveNamespace(item);

    if (entity === null) {
      return this._factory(CompletionItemKind.Value).addType(
        SignatureDefinitionBaseType.Any
      );
    }

    if (entity.isCallable() && !noInvoke) {
      const returnTypes = entity.getCallableReturnTypes();

      if (returnTypes) {
        return this._factory(CompletionItemKind.Variable).addType(
          ...returnTypes
        );
      }

      return this._factory(CompletionItemKind.Value).addType(
        SignatureDefinitionBaseType.Any
      );
    }

    return entity;
  }

  private resolveIdentifier(
    item: ASTIdentifier,
    noInvoke: boolean = false
  ): IEntity {
    return this._scope.resolveProperty(item.name, noInvoke);
  }

  resolveType(item: ASTBase, noInvoke: boolean = false): IEntity {
    if (item == null) {
      return null;
    }

    switch (item.type) {
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
      case ASTType.NilLiteral:
        return this._factory(CompletionItemKind.Value).addType('null');
      case ASTType.StringLiteral:
        return this._factory(CompletionItemKind.Value).addType(
          SignatureDefinitionBaseType.String
        );
      case ASTType.NumericLiteral:
      case ASTType.BooleanLiteral:
        return this._factory(CompletionItemKind.Value).addType(
          SignatureDefinitionBaseType.Number
        );
      default:
        return this._factory(CompletionItemKind.Value).addType(
          SignatureDefinitionBaseType.Any
        );
    }
  }

  private resolveChain(chain: ResolveChainItem[]): IEntity | null {
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
      const newInstance = this._factory(CompletionItemKind.Value).addType(
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
        current = this._factory(CompletionItemKind.Property).addType(
          ...current.getCallableReturnTypes()
        );
      } else {
        return null;
      }

      if (first.unary?.operator === 'new' && current !== null) {
        const newInstance = this._factory(CompletionItemKind.Value).addType(
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
}
