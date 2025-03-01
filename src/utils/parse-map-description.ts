import { Block, parse, Spec } from 'comment-parser';
import { SignatureDefinitionTypeMeta } from 'meta-utils';

import { createCommentBlock } from './create-comment-block';

export enum MapTag {
  Type = 'type',
  Property = 'property'
}

const AllowedMapTags: Set<string> = new Set(Object.values(MapTag));

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
  const typeTag = def.tags.find((it) => it.tag === MapTag.Type);

  if (!typeTag) {
    return null;
  }

  const properties = def.tags.filter((it) => it.tag === MapTag.Property);

  return {
    type: typeTag.name,
    properties: properties.map(parseMapBlockProperty)
  };
}

function isSupportedTag(item: Pick<Spec, 'tag'>) {
  return AllowedMapTags.has(item.tag);
}

export function parseMapDescription(source: string) {
  const commentDefs = parse(createCommentBlock(source));
  const [commentDef] = commentDefs;
  const tags = commentDef.tags.filter(isSupportedTag);

  if (tags.length > 0) {
    return parseMapBlock(commentDef);
  }

  return null;
}
