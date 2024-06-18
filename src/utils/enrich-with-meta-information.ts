import { parse, Spec } from 'comment-parser';
import {
  SignatureDefinitionBaseType,
  SignatureDefinitionFunction,
  SignaturePayloadDefinitionArg
} from 'meta-utils';

function convertSpecToString(it: Spec): string {
  return [it.name, it.description].filter((it) => it !== undefined).join(' ');
}

export function enrichWithMetaInformation(item: SignatureDefinitionFunction) {
  const commentDefs = parse(`/**
    ${item.getDescription()}
  */`);
  const [commentDef] = commentDefs;

  if (commentDef.tags.length > 0) {
    const commentDescription = [
      commentDef.description ?? '',
      ...commentDef.tags
        .filter((it) => it.tag === 'description')
        .map(convertSpecToString)
    ].join('\n\n');
    const commentArgs: SignaturePayloadDefinitionArg[] = commentDef.tags
      .filter((it) => it.tag === 'param')
      .map((it) => ({
        label: it.name,
        types: it.type.split('|'),
        opt: it.optional
      }));
    const commentReturnValues = commentDef.tags.find(
      (it) => it.tag === 'return'
    ) ?? { type: 'any' };
    const commentExample = commentDef.tags
      .filter((it) => it.tag === 'example')
      .map(convertSpecToString);

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
