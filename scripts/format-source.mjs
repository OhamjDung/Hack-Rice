import ts from 'typescript';
import { readdir,readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
async function walk(dir){const files=await readdir(dir,{withFileTypes:true});for(const file of files){const name=path.join(dir,file.name);if(file.isDirectory())await walk(name);else if(/\.tsx?$/.test(name)){const input=await readFile(name,'utf8');const ast=ts.createSourceFile(name,input,ts.ScriptTarget.Latest,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);const printer=ts.createPrinter({newLine:ts.NewLineKind.LineFeed});await writeFile(name,printer.printFile(ast));}}}
await walk('src');await walk('tests');
