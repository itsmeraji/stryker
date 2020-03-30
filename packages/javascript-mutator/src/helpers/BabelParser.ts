import generate from '@babel/generator';
import { parse, ParserOptions } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as types from '@babel/types';
import { Logger } from '@stryker-mutator/api/logging';
import { commonTokens, tokens } from '@stryker-mutator/api/plugin';
import { MutatorDescriptor } from '@stryker-mutator/api/core';

import { NodeWithParent } from './ParentNode';

export default class BabelParser {
  public static inject = tokens(commonTokens.logger, commonTokens.mutatorDescriptor);
  private readonly options: ParserOptions;
  public readonly excludedExpressions: string[];

  constructor(private readonly log: Logger, mutatorDescriptor: MutatorDescriptor) {
    this.options = this.createOptions(mutatorDescriptor.plugins);
    this.excludedExpressions = mutatorDescriptor.excludedExpressions;
  }

  public parse(code: string): types.File {
    return parse(code, this.options);
  }

  private createOptions(pluginOverrides: string[] | null): ParserOptions {
    const plugins = pluginOverrides || [
      'asyncGenerators',
      'bigInt',
      'classProperties',
      'dynamicImport',
      'flow',
      'jsx',
      'objectRestSpread',
      ['decorators', { decoratorsBeforeExport: true }] as any
    ];
    const options: ParserOptions = {
      plugins,
      sourceType: 'unambiguous'
    };
    if (this.log.isDebugEnabled()) {
      this.log.debug(`Using options ${JSON.stringify(options)}`);
    }
    return options;
  }

  public getNodes(ast: types.File): NodeWithParent[] {
    const nodes: NodeWithParent[] = [];
    const excludedExpressions = this.excludedExpressions;

    traverse(ast, {
      enter(path: NodePath<types.Node>) {
        const node: NodeWithParent = path.node;
        node.parent = path.parent as any;
        if (excludedExpressions.some(excludedExpression => (
          (node.type === 'AssignmentExpression' && node.left && node.left.property && node.left.property.name && node.left.property.name.includes(excludedExpression)) || // in case of object property - eg., xx.propTypes = {}
          (node.type === 'JSXAttribute' && typeof node.name === 'object' && node.name && node.name.name.includes(excludedExpression)) // in case of component prop - eg., <xx propName={true} ...>
        ))) {
          path.remove();
        } else {
          Object.freeze(node);
          nodes.push(node);
        }
      }
    });

    return nodes;
  }

  public generateCode(ast: types.Node) {
    return generate(ast).code;
  }
}
