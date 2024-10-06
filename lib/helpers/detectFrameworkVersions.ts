// lib/helpers/detectFrameworkVersions.ts

import * as fs from 'fs';

// Function to detect version in XML (e.g., for Maven projects)
export function detectVersionInXml(xmlFile: string, framework: string): string {
  const xmlContent = fs.readFileSync(xmlFile, 'utf8');
  const regex = new RegExp(`${framework}[^\d]*([\d.]+)`);
  const match = xmlContent.match(regex);
  return match ? match[1] : '';
}

// Function to detect version in Gradle (e.g., for Java/Kotlin projects)
export function detectVersionInGradle(gradleContent: string, framework: string): string {
  const regex = new RegExp(`${framework}[^\d]*([\d.]+)`);
  const match = gradleContent.match(regex);
  return match ? match[1] : '';
}

// Function to detect version in Gemfile (e.g., for Ruby projects)
export function detectVersionInGemfile(gemfileContent: string, framework: string): string {
  const regex = new RegExp(`${framework}.*?version:\\s*["'](\\d+\\.\\d+\\.\\d+)["']`);
  const match = gemfileContent.match(regex);
  return match ? match[1] : '';
}

// Function to detect version in SBT (e.g., for Scala projects)
export function detectVersionInSbt(sbtContent: string, framework: string): string {
  const regex = new RegExp(`${framework}[^\d]*([\d.]+)`);
  const match = sbtContent.match(regex);
  return match ? match[1] : '';
}

// Function to detect version in package.json (e.g., for JavaScript/Node projects)
export function detectVersionInPackageJson(dependencies: any, framework: string): string {
  return dependencies[framework] || '';
}
