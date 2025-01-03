import { Block, parse, Spec } from 'comment-parser';
import { SignatureDefinitionTypeMeta } from 'meta-utils';

function parseItemType(item: string): SignatureDefinitionTypeMeta {
  return SignatureDefinitionTypeMeta.fromString(item);
}

function parseMapBlockProperty(def: Spec) {
  return {
    path: def.name,
    type: def.type.split('|').map(parseItemType)
  };
}

function parseMapBlock(def: Block) {
  const typeTag = def.tags.find((it) => it.tag === 'type');

  if (!typeTag) {
    return null;
  }

  const properties = def.tags.filter((it) => it.tag === 'property');

  return {
    type: typeTag.name,
    properties: properties.map(parseMapBlockProperty)
  };
}

export function parseMapDescription(source: string) {
  const commentDefs = parse(`/**
    ${source}
  */`);
  const [commentDef] = commentDefs;

  if (commentDef.tags.length > 0) {
    return parseMapBlock(commentDef);
  }

  return null;
}
