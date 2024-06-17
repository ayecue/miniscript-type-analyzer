export { createExpressionHash } from './utils/create-expression-hash';
export { createExpressionId } from './utils/create-expression-id';
export { enrichWithMetaInformation } from './utils/enrich-with-meta-information';
export { createResolveChain } from './utils/get-ast-chain';
export { getHashCode, getStringHashCode, rotateBits } from './utils/hash';
export { ObjectSet, ObjectSetIterator } from './utils/object-set';
export { AggregatorOptions, IAggregator, DEFAULT_CUSTOM_FUNCTION_DESCRIPTION } from './types/aggregator';
export { CompletionItemKind, CompletionItem } from './types/completion';
export { DocumentOptions, IDocument, ScopeContext, Intrinsics } from './types/document';
export { EntityOptions, IEntityPropertyHandler, IEntity, ScopeOptions, IScope } from './types/object';
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
export { TextDocumentLike, TypeManagerOptions } from './types/type-manager';
export { Entity } from './type-manager/entity';
export { Scope } from './type-manager/scope';
export { Aggregator } from './type-manager/aggregator';
export { Document } from './type-manager/document';
export { TypeManager } from './type-manager';
