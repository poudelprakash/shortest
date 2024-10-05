import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { GenerateTestsInput } from "./schema";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 30;

async function debugGenerateObject(prompt: string, model: "anthropic" | "gemini") {
  // 2. Minimal schema
  const schema = z.object({
    name: z.string(),
    content: z.string(),
  });

  try {
    console.log("Starting generateObject call...");

    let result;

    if (model === "anthropic") {
      result = await generateObject({
        model: anthropic("claude-3-haiku-20240307"),  // Using Claude 3 Haiku
        schema: schema,
        prompt: prompt,
      });
    } else if (model === "gemini") {
      const GEMENI_KEY = process.env.GEMINI_API_KEY || ''
      const genAI = new GoogleGenerativeAI(GEMENI_KEY);
      const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-002" });
      
      const geminiResult = await geminiModel.generateContent(prompt);
      
      let generatedText = await geminiResult.response.text();
      console.log('generatedText', generatedText);

      // Preprocess the generatedText to remove code block markers
      const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
      const match = generatedText.match(codeBlockRegex);

      let jsonContent;

      if (match && match[1]) {
        jsonContent = match[1].trim();
      } else {
        // If no code blocks are found, use the generatedText as is
        jsonContent = generatedText.trim();
      }

      try {
        return JSON.parse(jsonContent);
      } catch (e) {
        console.error('Failed to parse JSON:', e);
        return [];
      }
    } else {
      throw new Error("Invalid model specified");
    }

    if (result && typeof result === 'object' && 'object' in result) {
      console.log("Parsed object:", result.object);
      return result.object;
    } else {
      console.log("Unexpected result structure");
      return [];
    }

  } catch (error) {
    console.error("Error in generateObject:", error);
    return [];
  }
}



export async function POST(req: Request) {
  const { mode, pr_diff, test_files } =
    (await req.json()) as GenerateTestsInput;

    const prompt = `You are an expert software engineer. ${
      mode === "write"
        ? "Write entirely new tests and update relevant existing tests in order to reflect the added/edited/removed functionality."
        : "Update existing test files in order to get the PR build back to passing. Make updates to tests solely, do not add or remove tests."
    }
  
    PR Diff:
    <PR Diff>
    ${pr_diff}
    </PR Diff>
  
    Existing test files:
    <Test Files>
    ${test_files
      .map((file) => `${file.name}\n${file.content ? `: ${file.content}` : ""}`)
      .join("\n")}
    </Test Files>

    Respond with an array of test files. Each test file should be represented as an object with a 'name' and 'content' (where 'name' refers to the path to the file).

    When analyzing a file, if the file name includes 'spec,' respond by outputting all tests found in that file using the RSpec format. Ensure that the test structure follows RSpec conventions (e.g., describe, context, it) and includes appropriate matchers.
    `+ "Do not include any code block formatting (e.g., ``` or language names) in your response. Ensure that the 'content' value uses double quotes with escaped newlines (\\n) for multi-line strings.";
  
  const tests = await debugGenerateObject(prompt, "gemini");

  console.log('tests', tests);

  return new Response(JSON.stringify(tests), {
    headers: { "Content-Type": "application/json" },
  });
}
