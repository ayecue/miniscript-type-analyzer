import { SignatureDefinitionBaseType } from 'meta-utils';
import { ASTBase, ASTIdentifier, ASTType } from 'miniscript-core';

import { AggregatorOptions, IAggregator } from '../types/aggregator';
import { CompletionItemKind } from '../types/completion';
import { EntityFactory, IEntity, IScope } from '../types/object';
import {
  isResolveChainItemWithIdentifier,
  isResolveChainItemWithIndex,
  isResolveChainItemWithMember,
  isResolveChainItemWithValue
} from '../types/resolve';
import { createResolveChain } from '../utils/get-ast-chain';

export class Aggregator implements IAggregator {
  private _scope: IScope;
  private _factory: EntityFactory;

  constructor(options: AggregatorOptions) {
    this._scope = options.scope;
    this._factory = options.factory;
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
      case ASTType.Identifier:
        return this.resolveIdentifier(item as ASTIdentifier, noInvoke);
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

  resolveNamespace(item: ASTBase): IEntity | null {
    const astChain = createResolveChain(item);
    let current: IEntity = null;
    const first = astChain[0];

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

    const length = astChain.length;

    for (let index = 1; index < length; index++) {
      const item = astChain[index];

      if (isResolveChainItemWithMember(item)) {
        current = current.resolveProperty(
          item.getter.name,
          item.unary?.operator === '@'
        );
      } else if (isResolveChainItemWithIndex(item)) {
        const index = this.resolveType(item.getter);
        current = current.resolveProperty(index, item.unary?.operator === '@');
      }
    }

    return current;
  }

  defineNamespace(item: ASTBase, container: IEntity): boolean {
    const astChain = createResolveChain(item);
    const lastIndex = astChain.length - 1;
    let current: IEntity = this._scope;

    if (lastIndex > 0) {
      const first = astChain[0];

      if (isResolveChainItemWithIdentifier(first)) {
        current = current.resolveProperty(
          first.getter.name,
          first.unary?.operator === '@'
        );
      } else {
        return false;
      }

      for (let index = 1; index < lastIndex; index) {
        const item = astChain[index];

        if (isResolveChainItemWithMember(item)) {
          current = current.resolveProperty(
            item.getter.name,
            item.unary?.operator === '@'
          );
        } else if (isResolveChainItemWithIndex(item)) {
          const index = this.resolveType(item.getter);
          current = current.resolveProperty(
            index,
            item.unary?.operator === '@'
          );
        }
      }
    }
  }
}
