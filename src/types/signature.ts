import {
  SignatureDefinition,
  SignatureDefinitionBaseType,
  SignatureDefinitionFunction
} from 'meta-utils';

export const isSignatureDefinitionFunction = (
  item: SignatureDefinition
): item is SignatureDefinitionFunction => {
  return item.getType().type === SignatureDefinitionBaseType.Function;
};
