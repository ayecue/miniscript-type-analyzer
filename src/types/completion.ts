export enum CompletionItemKind {
  Variable = 'var',
  Property = 'var',
  Function = 'function',
  Literal = 'literal',
  Constant = 'constant',
  ListConstructor = 'list',
  MapConstructor = 'map',
  Expression = 'expr',
  Unknown = 'unknown'
}

export interface CompletionItem {
  kind: CompletionItemKind;
  line: number;
}
