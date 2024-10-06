// lib/helpers/fileUtils.ts

import * as fs from 'fs';
import * as path from 'path';

// Helper to get all files with a specific extension in a directory
export function getFilesByExtension(dir: string, ext: string): string[] {
  const files = fs.readdirSync(dir);
  return files.filter(file => file.endsWith(ext)).map(file => path.join(dir, file));
}

// Helper to check if a file exists
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

// Helper to read a file content
export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}
