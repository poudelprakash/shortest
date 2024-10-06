// workers/repositoryScanWorker.ts

import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { repositories, repositoryConfigs } from "@/lib/db/schema";
import { db } from "@/lib/db/drizzle";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { getOctokit } from "@/lib/github";
import { getGitlabClient } from "@/lib/gitlab";
import unzipper from "unzipper"; // To extract ZIP files

// Import helper functions
import {
  detectVersionInXml,
  detectVersionInGradle,
  detectVersionInGemfile,
  detectVersionInSbt,
  detectVersionInPackageJson,
} from "@/lib/helpers/detectFrameWorkVersions";

import {
  getFilesByExtension,
  fileExists,
  readFile,
} from "@/lib/helpers/fileUtils";

// Initialize Redis connection
const redisConnection = new Redis();

// Initialize BullMQ worker
const scanWorker = new Worker(
  "repositoryScan",
  async (job: Job) => {
    const { repositoryId } = job.data;

    try {
      // Retrieve repository data
      const repoData = await db.query.repositories.findFirst({
        where: eq(repositories.id, repositoryId),
      });

      if (!repoData) {
        throw new Error(`Repository with ID ${repositoryId} not found.`);
      }

      const { provider, fullPath: slug } = repoData;

      // Download and extract the repository
      const repoPath = path.join("/tmp", `repo-${repositoryId}-${Date.now()}`);

      if (provider === "github") {
        await downloadGitHubRepo(slug, repoPath);
      } else if (provider === "gitlab") {
        await downloadGitLabRepo(slug, repoPath);
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      // Detect test frameworks
      const detectedFrameworks = await detectTestFrameworks(repoPath);

      // Detect test folder patterns and naming conventions
      const testFolderPatterns = getTestFolderPatterns(detectedFrameworks);
      const testFileNamingConvention =
        getTestFileNamingConvention(detectedFrameworks);

      // Detect coverage folder path
      const coverageFolderPath = getDefaultCoverageFolder(detectedFrameworks);

      // Detect user test folder preferences (if any)
      const userTestFolderPreference = await getUserTestFolderPreference(
        repositoryId
      );

      // Detect test type handling (e.g., unit vs integration)
      const testTypeHandling = getTestTypeHandling(detectedFrameworks);

      // Detect feature/domain-based test organization
      const featureDomainBasedTest = detectFeatureDomainBasedTest(repoPath);

      // Detect external test repository (if any)
      const externalTestRepo = detectExternalTestRepo(repoPath);

      // Prepare configuration data
      const configData = {
        repositoryId,
        testFrameworks: detectedFrameworks,
        testFolderPatterns,
        testFileNamingConvention,
        coverageFolderPath,
        userTestFolderPreference,
        testTypeHandling,
        featureDomainBasedTest,
        externalTestRepo,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Insert or update repository configuration
      await db.insert(repositoryConfigs).values(configData).onConflictDoUpdate({
        target: repositoryConfigs.repositoryId,
        set: configData,
      });

      // Clean up temporary directory
      fs.rmSync(repoPath, { recursive: true, force: true });

      console.log(`Successfully scanned repository ${slug}`);
    } catch (error) {
      console.error(`Failed to scan repository ${repositoryId}:`, error);
    }
  },
  { connection: redisConnection }
);

// Function to download GitHub repository using Octokit
async function downloadGitHubRepo(slug: string, destinationPath: string) {
  const [owner, repo] = slug.split("/");

  const octokit = await getOctokit(); // Get authenticated client

  // Get default branch
  const { data: repoData } = await octokit.rest.repos.get({
    owner,
    repo,
  });

  const defaultBranch = repoData.default_branch;

  // Get archive link
  const { url } = await octokit.rest.repos.downloadZipballArchive({
    owner,
    repo,
    ref: defaultBranch,
  });

  // Download and extract
  await downloadAndExtractArchive(url, destinationPath, "github");
}

// Function to download GitLab repository using GitLab client
async function downloadGitLabRepo(slug: string, destinationPath: string) {
  const gitlabClient = await getGitlabClient(); // Get authenticated client

  const encodedSlug = encodeURIComponent(slug);

  // GitLab API to download archive
  const response = await gitlabClient.Repositories.archive(encodedSlug, {});

  // Ensure destination directory exists
  fs.mkdirSync(destinationPath, { recursive: true });

  // Extract the archive
  await new Promise<void>((resolve, reject) => {
    response
      .pipe(unzipper.Extract({ path: destinationPath }))
      .on("close", resolve)
      .on("error", reject);
  });
}

// Function to download and extract archive
async function downloadAndExtractArchive(
  url: string,
  destinationPath: string,
  provider: string
) {
  // Set headers based on provider if needed
  const headers: Record<string, string> = {};
  if (provider === "github") {
    headers["Accept"] = "application/vnd.github.v3.raw";
  }

  // Use existing authenticated client to make the request
  // Assuming you have a function to get the stream using Octokit or GitLab client
  let stream: NodeJS.ReadableStream;

  if (provider === "github") {
    const octokit = await getOctokit(); // Get authenticated Octokit client
    const response = await octokit.request(`GET ${url}`, {
      headers,
      responseType: "stream",
    });
    stream = response.body as NodeJS.ReadableStream;
  } else if (provider === "gitlab") {
    // For GitLab, the response is already a stream
    const gitlabClient = await getGitlabClient();
    const encodedSlug = encodeURIComponent(url); // Adjust if necessary
    const response = await gitlabClient.Repositories.archive(encodedSlug, {});
    stream = response;
  } else {
    throw new Error(
      `Unsupported provider for downloadAndExtractArchive: ${provider}`
    );
  }

  // Ensure destination directory exists
  fs.mkdirSync(destinationPath, { recursive: true });

  // Extract the archive
  await new Promise<void>((resolve, reject) => {
    stream
      .pipe(unzipper.Extract({ path: destinationPath }))
      .on("close", resolve)
      .on("error", reject);
  });
}

// Function to detect test frameworks across multiple languages
async function detectTestFrameworks(repoPath: string): Promise<any[]> {
  const frameworks = [];

  // JavaScript/TypeScript Projects (Node.js)
  const packageJsonPath = path.join(repoPath, "package.json");
  if (fileExists(packageJsonPath)) {
    const packageJson = JSON.parse(readFile(packageJsonPath));
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (dependencies["jest"]) {
      frameworks.push({ type: "jest", version: dependencies["jest"] });
    }
    if (dependencies["mocha"]) {
      frameworks.push({ type: "mocha", version: dependencies["mocha"] });
    }
    if (dependencies["jasmine"]) {
      frameworks.push({ type: "jasmine", version: dependencies["jasmine"] });
    }
    // Add more JavaScript frameworks as needed
  }

  // Python Projects
  const requirementsTxtPath = path.join(repoPath, "requirements.txt");
  const pyProjectPath = path.join(repoPath, "pyproject.toml");
  if (fileExists(requirementsTxtPath)) {
    const requirements = readFile(requirementsTxtPath).split("\n");
    requirements.forEach((line) => {
      if (line.startsWith("pytest")) {
        const version = line.split("==")[1] || "";
        frameworks.push({ type: "pytest", version });
      }
      if (line.startsWith("unittest")) {
        frameworks.push({ type: "unittest", version: "" });
      }
      // Add more Python frameworks as needed
    });
  }
  if (fileExists(pyProjectPath)) {
    const pyProject = readFile(pyProjectPath);
    if (pyProject.includes("pytest")) {
      frameworks.push({ type: "pytest", version: "" });
    }
    // Add more checks if necessary
  }

  // Java Projects
  const pomXmlPath = path.join(repoPath, "pom.xml");
  const buildGradlePath = path.join(repoPath, "build.gradle");
  if (fileExists(pomXmlPath)) {
    frameworks.push({
      type: "JUnit",
      version: detectVersionInXml(pomXmlPath, "junit"),
    });
  }
  if (fileExists(buildGradlePath)) {
    const gradleContent = readFile(buildGradlePath);
    if (gradleContent.includes("junit")) {
      frameworks.push({
        type: "JUnit",
        version: detectVersionInGradle(gradleContent, "junit"),
      });
    }
    if (gradleContent.includes("testng")) {
      frameworks.push({
        type: "TestNG",
        version: detectVersionInGradle(gradleContent, "testng"),
      });
    }
    if (gradleContent.includes("spek")) {
      frameworks.push({
        type: "Spek",
        version: detectVersionInGradle(gradleContent, "spek"),
      });
    }
    // Add more Java/Kotlin frameworks as needed
  }

  // PHP Projects
  const composerJsonPath = path.join(repoPath, "composer.json");
  if (fileExists(composerJsonPath)) {
    const composerJson = JSON.parse(readFile(composerJsonPath));
    const require = { ...composerJson.require, ...composerJson["require-dev"] };

    if (require["phpunit/phpunit"]) {
      frameworks.push({ type: "PHPUnit", version: require["phpunit/phpunit"] });
    }
    if (require["codeception/codeception"]) {
      frameworks.push({
        type: "Codeception",
        version: require["codeception/codeception"],
      });
    }
    // Add more PHP frameworks as needed
  }

  // C# Projects
  const csprojFiles = getFilesByExtension(repoPath, ".csproj");
  csprojFiles.forEach((file) => {
    const csprojContent = readFile(file);
    if (csprojContent.includes("NUnit")) {
      frameworks.push({
        type: "NUnit",
        version: detectVersionInXml(file, "NUnit"),
      });
    }
    if (csprojContent.includes("xUnit")) {
      frameworks.push({
        type: "xUnit",
        version: detectVersionInXml(file, "xUnit"),
      });
    }
    if (csprojContent.includes("MSTest")) {
      frameworks.push({
        type: "MSTest",
        version: detectVersionInXml(file, "MSTest"),
      });
    }
    // Add more C# frameworks as needed
  });

  // Go Projects
  const goModPath = path.join(repoPath, "go.mod");
  if (fileExists(goModPath)) {
    frameworks.push({ type: "Go Testing", version: "" });
    // Note: Go's native testing framework doesn't require external dependencies
  }

  // Kotlin Projects
  if (fileExists(buildGradlePath)) {
    const gradleContent = readFile(buildGradlePath);
    if (gradleContent.includes("spek")) {
      frameworks.push({
        type: "Spek",
        version: detectVersionInGradle(gradleContent, "spek"),
      });
    }
    if (gradleContent.includes("junit")) {
      frameworks.push({
        type: "JUnit",
        version: detectVersionInGradle(gradleContent, "junit"),
      });
    }
    // Add more Kotlin frameworks as needed
  }

  // Swift Projects
  const packageSwiftPath = path.join(repoPath, "Package.swift");
  if (fileExists(packageSwiftPath)) {
    frameworks.push({ type: "XCTest", version: "" });
    // Note: XCTest is native to Swift and doesn't require external dependencies
  }

  // Ruby Projects
  const gemfilePath = path.join(repoPath, "Gemfile");
  if (fileExists(gemfilePath)) {
    const gemfile = readFile(gemfilePath);
    if (gemfile.includes("rspec")) {
      frameworks.push({
        type: "RSpec",
        version: detectVersionInGemfile(gemfile, "rspec"),
      });
    }
    if (gemfile.includes("minitest")) {
      frameworks.push({
        type: "Minitest",
        version: detectVersionInGemfile(gemfile, "minitest"),
      });
    }
    // Add more Ruby frameworks as needed
  }

  // Scala Projects
  const buildSbtPath = path.join(repoPath, "build.sbt");
  if (fileExists(buildSbtPath)) {
    const sbtContent = readFile(buildSbtPath);
    if (sbtContent.includes("scalatest")) {
      frameworks.push({
        type: "ScalaTest",
        version: detectVersionInSbt(sbtContent, "scalatest"),
      });
    }
    // Add more Scala frameworks as needed
  }

  // Rust Projects
  const cargoTomlPath = path.join(repoPath, "Cargo.toml");
  if (fileExists(cargoTomlPath)) {
    frameworks.push({ type: "Rust Test", version: "" });
    // Note: Rust's native testing framework doesn't require external dependencies
  }

  return frameworks;
}

// Function to get test folder patterns based on detected frameworks
function getTestFolderPatterns(
  detectedFrameworks: any[]
): Record<string, string[]> {
  const patterns: Record<string, string[]> = {};

  detectedFrameworks.forEach((fw) => {
    switch (fw.type) {
      case "jest":
        patterns["jest"] = ["__tests__/", "src/components/"];
        break;
      case "mocha":
        patterns["mocha"] = ["test/"];
        break;
      case "jasmine":
        patterns["jasmine"] = ["spec/"];
        break;
      case "pytest":
        patterns["pytest"] = ["tests/"];
        break;
      case "unittest":
        patterns["unittest"] = ["tests/"];
        break;
      case "JUnit":
        patterns["JUnit"] = ["src/test/java/"];
        break;
      case "TestNG":
        patterns["TestNG"] = ["src/test/java/"];
        break;
      case "Spek":
        patterns["Spek"] = ["src/test/kotlin/"];
        break;
      case "PHPUnit":
        patterns["PHPUnit"] = ["tests/"];
        break;
      case "Codeception":
        patterns["Codeception"] = ["tests/"];
        break;
      case "NUnit":
        patterns["NUnit"] = ["Tests/"];
        break;
      case "xUnit":
        patterns["xUnit"] = ["Tests/"];
        break;
      case "MSTest":
        patterns["MSTest"] = ["Tests/"];
        break;
      case "Go Testing":
        patterns["Go Testing"] = ["tests/"];
        break;
      case "XCTest":
        patterns["XCTest"] = ["Tests/"];
        break;
      case "RSpec":
        patterns["RSpec"] = ["spec/"];
        break;
      case "Minitest":
        patterns["Minitest"] = ["test/"];
        break;
      case "ScalaTest":
        patterns["ScalaTest"] = ["test/"];
        break;
      case "Rust Test":
        patterns["Rust Test"] = ["tests/"];
        break;
      // Add more cases as needed
      default:
        patterns[fw.type] = ["tests/"];
    }
  });

  return patterns;
}

// Function to get test file naming conventions based on detected frameworks
function getTestFileNamingConvention(
  detectedFrameworks: any[]
): Record<string, string[]> {
  const conventions: Record<string, string[]> = {};

  detectedFrameworks.forEach((fw) => {
    switch (fw.type) {
      case "jest":
        conventions["javascript"] = ["*.test.js", "*.test.tsx", "*.spec.js"];
        break;
      case "mocha":
        conventions["javascript"] = ["*.test.js", "*.spec.js"];
        break;
      case "jasmine":
        conventions["javascript"] = ["*.spec.js"];
        break;
      case "pytest":
        conventions["python"] = ["test_*.py", "*_test.py"];
        break;
      case "unittest":
        conventions["python"] = ["test_*.py", "*_test.py"];
        break;
      case "JUnit":
        conventions["java"] = ["*Test.java", "*Tests.java"];
        break;
      case "TestNG":
        conventions["java"] = ["*Test.java", "*Tests.java"];
        break;
      case "Spek":
        conventions["kotlin"] = ["*Test.kt", "*Tests.kt"];
        break;
      case "PHPUnit":
        conventions["php"] = ["*Test.php"];
        break;
      case "Codeception":
        conventions["php"] = ["*Test.php"];
        break;
      case "NUnit":
        conventions["csharp"] = ["*Tests.cs"];
        break;
      case "xUnit":
        conventions["csharp"] = ["*Tests.cs"];
        break;
      case "MSTest":
        conventions["csharp"] = ["*Tests.cs"];
        break;
      case "Go Testing":
        conventions["go"] = ["*_test.go"];
        break;
      case "XCTest":
        conventions["swift"] = ["*Tests.swift"];
        break;
      case "RSpec":
        conventions["ruby"] = ["*_spec.rb"];
        break;
      case "Minitest":
        conventions["ruby"] = ["*_test.rb"];
        break;
      case "ScalaTest":
        conventions["scala"] = ["*Spec.scala"];
        break;
      case "Rust Test":
        conventions["rust"] = ["*_test.rs"];
        break;
      // Add more cases as needed
      default:
        conventions["unknown"] = ["*.test.*", "*.spec.*"];
    }
  });

  return conventions;
}

// Function to get default coverage folder based on detected frameworks
function getDefaultCoverageFolder(detectedFrameworks: any[]): string {
  if (detectedFrameworks.some((fw) => fw.type === "jest")) {
    return "coverage/";
  }
  if (detectedFrameworks.some((fw) => fw.type === "pytest")) {
    return "htmlcov/";
  }
  if (detectedFrameworks.some((fw) => fw.type === "JUnit")) {
    return "target/site/jacoco/";
  }
  // Add more conditions as needed
  return "coverage/"; // Default if no specific framework is found
}

// Function to get user test folder preference from repositoryConfigs
async function getUserTestFolderPreference(
  repositoryId: string
): Promise<any | null> {
  const config = await db.query.repositoryConfigs.findFirst({
    where: eq(repositoryConfigs.repositoryId, repositoryId),
  });

  return config ? config.userTestFolderPreference : null;
}

function getTestTypeHandling(
  detectedFrameworks: any[]
): Record<string, string> {
  const handling: Record<string, string> = {};

  detectedFrameworks.forEach((fw) => {
    switch (fw.type) {
      // JavaScript/TypeScript frameworks
      case "jest":
        handling["unit"] = "same-folder-as-component";
        handling["integration"] = "__tests__/";
        const jestVersion = detectVersionInPackageJson(fw.version, "jest");
        console.log(`Detected Jest version: ${jestVersion}`);
        break;

      case "mocha":
        handling["unit"] = "test/";
        handling["integration"] = "test/integration/";
        const mochaVersion = detectVersionInPackageJson(fw.version, "mocha");
        console.log(`Detected Mocha version: ${mochaVersion}`);
        break;

      case "jasmine":
        handling["unit"] = "spec/";
        const jasmineVersion = detectVersionInPackageJson(
          fw.version,
          "jasmine"
        );
        console.log(`Detected Jasmine version: ${jasmineVersion}`);
        break;

      // Python frameworks
      case "pytest":
      case "unittest":
        handling["unit"] = "tests/unit/";
        handling["integration"] = "tests/integration/";
        break;

      // Java/Kotlin frameworks
      case "JUnit":
      case "TestNG":
        handling["unit"] = "src/test/java/";
        handling["integration"] = "src/test/integration/";
        break;

      case "Spek":
        handling["unit"] = "src/test/kotlin/";
        handling["integration"] = "src/integration/kotlin/";
        break;

      // PHP frameworks
      case "PHPUnit":
        handling["unit"] = "tests/unit/";
        handling["integration"] = "tests/integration/";
        break;

      case "Codeception":
        handling["unit"] = "tests/unit/";
        handling["integration"] = "tests/functional/";
        break;

      // C# frameworks
      case "NUnit":
      case "xUnit":
      case "MSTest":
        handling["unit"] = "Tests/UnitTests/";
        handling["integration"] = "Tests/IntegrationTests/";
        break;

      // Go's native testing framework
      case "Go Testing":
        handling["unit"] = "tests/";
        handling["integration"] = "integration_tests/";
        break;

      // Swift's XCTest
      case "XCTest":
        handling["unit"] = "Tests/UnitTests/";
        handling["integration"] = "Tests/IntegrationTests/";
        break;

      // Ruby frameworks (RSpec, Minitest)
      case "RSpec":
        handling["unit"] = "spec/models/";
        handling["integration"] = "spec/integration/";
        handling["system"] = "spec/system/";
        break;

      case "Minitest":
        handling["unit"] = "test/models/";
        handling["integration"] = "test/integration/";
        handling["system"] = "test/system/";
        break;

      // Scala framework
      case "ScalaTest":
        handling["unit"] = "src/test/scala/";
        handling["integration"] = "src/integration/scala/";
        break;

      // Rust's native testing framework
      case "Rust Test":
        handling["unit"] = "tests/unit/";
        handling["integration"] = "tests/integration/";
        break;

      // Default case for unknown or unsupported frameworks
      default:
        handling["unit"] = "tests/";
    }
  });

  return handling;
}

// Function to detect if the project uses feature/domain-based test organization
function detectFeatureDomainBasedTest(repoPath: string): boolean {
  // Example: Check for folders like src/features or src/domains
  const featuresPath = path.join(repoPath, "src", "features");
  const domainsPath = path.join(repoPath, "src", "domains");

  return fileExists(featuresPath) || fileExists(domainsPath);
}

// Function to detect if the project uses an external test repository
function detectExternalTestRepo(repoPath: string): string | null {
  // Example: Look for a submodule or a specific folder name indicating an external repo
  const testsRepoPath = path.join(repoPath, "tests-repo");
  if (fileExists(testsRepoPath)) {
    return "tests-repo/";
  }
  return null;
}
