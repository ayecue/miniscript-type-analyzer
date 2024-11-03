import { Block, parse, Spec } from 'comment-parser';
import {
  SignatureDefinitionBaseType,
  SignatureDefinitionFunction,
  SignaturePayloadDefinitionArg
} from 'meta-utils';

function convertSpecToString(it: Spec): string {
  return [it.name, it.description].filter((it) => it !== undefined).join(' ');
}

export enum FunctionBlockTag {
  Description = 'description',
  Param = 'param',
  Return = 'return',
  Example = 'example'
}

function parseFunctionBlock(def: Block) {
  const descriptions = [
    def.description ?? '',
    ...def.tags
      .filter((it) => it.tag === FunctionBlockTag.Description)
      .map(convertSpecToString)
  ].join('\n\n');
  const args: SignaturePayloadDefinitionArg[] = def.tags
    .filter((it) => it.tag === FunctionBlockTag.Param)
    .map((it) => ({
      label: it.name,
      types: it.type.split('|'),
      opt: it.optional
    }));
  const returns = def.tags.find(
    (it) => it.tag === FunctionBlockTag.Return
  ) ?? { type: 'any' };
  const examples = def.tags
    .filter((it) => it.tag === FunctionBlockTag.Example)
    .map(convertSpecToString);

  return {
    descriptions,
    args,
    returns,
    examples
  };
}

export function enrichWithMetaInformation(item: SignatureDefinitionFunction) {
  const commentDefs = parse(`/**
    ${item.getDescription()}
  */`);
  const [commentDef] = commentDefs;

  if (commentDef.tags.length > 0) {
    const {
      descriptions: commentDescription,
      args: commentArgs,
      returns: commentReturnValues,
      examples: commentExample
    } = parseFunctionBlock(commentDef);

    return SignatureDefinitionFunction.parse({
      type: SignatureDefinitionBaseType.Function,
      arguments: item.getArguments().map((item, index) => {
        const label = item.getLabel();
        const types = item.getTypes().map((it) => it.toString());
        const opt = item.isOptional();

        return {
          types,
          opt,
          ...commentArgs[index],
          label
        };
      }),
      returns: commentReturnValues.type.split('|'),
      description: commentDescription,
      example: commentExample
    });
  }

  return item;
}
