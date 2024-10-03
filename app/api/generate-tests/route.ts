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
      const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro-002" });
      
      const geminiResult = await geminiModel.generateContent(prompt);
      
      const generatedText = geminiResult.response.text();
      console.log('generatedText', generatedText);
      return JSON.parse(generatedText);
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

    const prompt = "You are an expert software engineer. " + 
    (mode === "write"
        ? "Write entirely new tests and update relevant existing tests to reflect the added/edited/removed functionality."
        : "Update existing test files to get the PR build back to passing. Make updates to tests only—do not add or remove tests.") +
    "\n\nPR Diff:\n<PR Diff>\n" + pr_diff + "\n</PR Diff>" +
    "\n\nRespond with an array of test files. Each test file should be represented as an object with a 'name' and 'content' (where 'name' refers to the path to the file). Do not include any code block formatting (e.g., ``` or language names) in your response. Ensure that the 'content' value uses double quotes with escaped newlines (\\n) for multi-line strings.";
    
  const tests = await debugGenerateObject(prompt, "gemini");

  console.log('tests1', tests);

  return new Response(JSON.stringify(tests), {
    headers: { "Content-Type": "application/json" },
  });
}
