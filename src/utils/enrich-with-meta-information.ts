import { Block, parse, Spec } from 'comment-parser';
import {
  SignatureDefinitionBaseType,
  SignatureDefinitionFunction,
  SignaturePayloadDefinitionArg,
  SignaturePayloadDefinitionTypeMeta,
  TypeParser
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

function parseItemType(item: string): SignaturePayloadDefinitionTypeMeta {
  return new TypeParser(item).parse();
}

function parseReturnType(commentType: Spec): SignaturePayloadDefinitionTypeMeta[] {
  return commentType.type.split('|').map(parseItemType);
}

function parseArgType(commentType: Spec): SignaturePayloadDefinitionArg {
  return {
    types: commentType.type.split('|').map(parseItemType),
    label: commentType.name,
    opt: commentType.optional
  };
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
    .map(parseArgType);
  const returns = def.tags
    .filter((it) => it.tag === FunctionBlockTag.Return)
    .flatMap(parseReturnType)
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
      returns: commentReturn,
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
      returns: commentReturn,
      description: commentDescription,
      example: commentExample
    });
  }

  return item;
}
