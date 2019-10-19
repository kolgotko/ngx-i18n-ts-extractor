import { BuilderOutput, createBuilder, BuilderContext } from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import { isI18nCall, createId } from '@kolgotko/ngx-i18n-ts-common';
import * as path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';
import * as glob from 'glob';
import * as xmljs from 'xml-js';

type BuildOptions = {
  projectDir: string,
  outputDir: string,
  sourceLang: string,
  ignore: Array<string>,
} & JsonObject;

type GenXliffFileArgs = {
  sourceLang: string,
  outputDir: string,
  transUnitList: Array<object>,
};

type GenTransUnitListArgs = {
  sourceFile: ts.SourceFile,
  relativeCall: (pathToFile: string) => string,
  typeChecker: ts.TypeChecker,
};

export default createBuilder(extractorBuilder);

function extractorBuilder(options: BuildOptions, _context: BuilderContext): Promise<BuilderOutput> {
  const {
    projectDir,
    outputDir,
    sourceLang,
    ignore = [],
  } = options;
    const fileList: Array<string> = glob.sync(path.join(projectDir, '/**/*.ts'), { ignore });
    const program = ts.createProgram(fileList, {});
    const typeChecker = program.getTypeChecker();
    const relativeCall = (pathToFile: string) => path.relative(projectDir, pathToFile);
    let transUnitList = [];

    for (const sourceFile of program.getSourceFiles()) {
      if (!sourceFile.isDeclarationFile) {
        const newTransUnitList = genTransUnitList({
          sourceFile,
          relativeCall,
          typeChecker,
        });
        transUnitList = [...transUnitList, ...newTransUnitList];
      }
    }

    console.log(transUnitList);

    genXliffFile({
      sourceLang,
      outputDir,
      transUnitList,
    });

    return new Promise(resolve => {
      resolve({ success: true });
    });
}

function genTransUnitList(args: GenTransUnitListArgs) {
  const {
    sourceFile,
    relativeCall,
    typeChecker,
  } = args;
  const fileName = relativeCall(sourceFile.fileName);
  const transUnitList = [];
  const visit = (node: ts.Node) => {
    if (isI18nCall(node, typeChecker)) {
      const argumentList = (node as ts.CallExpression).arguments;
      const [textNode, descNode, meaningNode, idNode] = argumentList;
      const idNodeType = typeChecker.getTypeAtLocation(idNode);
      const meaningNodeType = typeChecker.getTypeAtLocation(meaningNode);
      const descNodeType = typeChecker.getTypeAtLocation(descNode);
      let id = createId(node as ts.CallExpression, typeChecker);

      const elements = [];

      elements.push({
        type: 'element',
        name: 'context-group',
        attributes: {
          purpose: 'location',
        },
        elements: [
          {
            type: 'element',
            name: 'context',
            attributes: {
              'context-type': 'sourcefile',
            },
            elements: [
              {
                type: 'text',
                text: fileName,
              },
            ],
          },
          {
            type: 'element',
            name: 'context',
            attributes: {
              'context-type': 'offset',
            },
            elements: [
              {
                type: 'text',
                text: node.getStart(),
              },
            ],
          }
        ],
      });

      elements.push({
        type: 'element',
        name: 'source',
        elements: [
          {
            type: 'text',
            text: textNode.getText(),
          },
        ],
      });

      if (meaningNode && meaningNodeType.isStringLiteral()) {
        elements.push({
          type: 'element',
          name: 'note',
          attributes: {
            from: 'meaning',
            priority: 1,
          },
          elements: [
            {
              type: 'text',
              text: meaningNode.getText().slice(1, -1),
            },
          ],
        });
      }

      if (descNode && descNodeType.isStringLiteral()) {
        elements.push({
          type: 'element',
          name: 'note',
          attributes: {
            from: 'description',
            priority: 1,
          },
          elements: [
            {
              type: 'text',
              text: descNode.getText().slice(1, -1),
            },
          ],
        });
      }

      transUnitList.push({
        type: 'element',
        name: 'trans-unit',
        attributes: {
          id,
        },
        elements,
      });
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);

  return transUnitList;
};

function genXliffFile(args: GenXliffFileArgs) {
  const { 
    sourceLang,
    transUnitList,
    outputDir,
  } = args;
  const xml = xmljs.js2xml({
    declaration: {
      attributes: {
        version: '1.1',
        encoding: 'utf-8',
      },
    },
    elements: [
      {
        type: 'element',
        name: 'xliff',
        attributes: {
          version: '1.2',
          xmlns: 'urn:oasis:names:tc:xliff:document:1.2',
        },
        elements: [
          {
            type: 'element',
            name: 'file',
            attributes: {
              original: 'typescript.file',
              datatype: 'plaintext',
              'source-languge': sourceLang,
            },
            elements: [
              {
                type: 'element',
                name: 'body',
                elements: transUnitList,
              }
            ],
          }
        ],
      }
    ]
  }, { spaces: 2 });

  fs.writeFileSync(path.join(outputDir, '/messages.xlf'), xml);
}
