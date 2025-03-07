export { isValidIdentifierLiteral } from './utils/is-valid-identifier-literal';
export { createExpressionHash } from './utils/create-expression-hash';
export { createExpressionId } from './utils/create-expression-id';
export { enrichWithMetaInformation } from './utils/enrich-with-meta-information';
export { createResolveChain } from './utils/create-resolve-chain';
export { getHashCode, getStringHashCode, rotateBits } from './utils/hash';
export { ObjectSet, ObjectSetIterator } from './utils/object-set';
export { AggregatorOptions, IAggregator, DEFAULT_CUSTOM_FUNCTION_DESCRIPTION } from './types/aggregator';
export { CompletionItemKind, CompletionItem } from './types/completion';
export { DocumentOptions, IDocument, ScopeContext, Intrinsics } from './types/document';
export { PropertyType, IdentifierPropertyPattern, IsaPropertyPattern, EntityOptions, IEntityPropertyHandler, IEntity, ScopeOptions, IScope, ASTDefinitionItem, EntityCopyOptions, EntityExtendStackItem } from './types/object';
export { ContainerProxyOptions, IContainerProxy } from './types/container-proxy';
export {
  ResolveChainItem,
  ResolveChainItemBase,
  ResolveChainItemWithGetter,
  ResolveChainItemWithIdentifier,
  ResolveChainItemWithIndex,
  ResolveChainItemWithMember,
  ResolveChainItemWithValue,
  isResolveChainItemWithIdentifier,
  isResolveChainItemWithIndex,
  isResolveChainItemWithMember,
  isResolveChainItemWithValue
} from './types/resolve';
export { isSignatureDefinitionFunction } from './types/signature';
export { TypeManagerOptions } from './types/type-manager';
export { injectIdentifers } from './utils/inject-identifiers';
export { isEligibleForProperties } from './utils/is-eligible-for-properties';
export { lookupProperty } from './utils/lookup-property';
export { aggregateEntity } from './utils/aggregate-entities';
export { Entity } from './type-manager/entity';
export { Scope } from './type-manager/scope';
export { Aggregator } from './type-manager/aggregator';
export { Document } from './type-manager/document';
export { ContainerProxy } from './container-proxy';
export { TypeManager } from './type-manager';
