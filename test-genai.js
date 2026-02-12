const { GoogleGenAI } = require("@google/genai");

async function main() {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_GENAI_API_KEY is not set");
    process.exit(1);
  }

  console.log("Initializing GoogleGenAI...");
  const genai = new GoogleGenAI({ apiKey });

  console.log("Listing available models...");
  try {
    const modelsResponse = await genai.models.list();
    if (modelsResponse) {
      console.log("Models found:", JSON.stringify(modelsResponse, null, 2));
    } else {
      console.log("No response from list()");
    }
  } catch (error) {
    console.error("❌ Failed to list models");
    console.error(error.message);
  }

  const modelsToTest = [
    "gemini-2.5-flash",
    "gemini-pro-latest",
    "gemini-2.0-flash-thinking-exp",
    "gemini-exp-1206",
  ];

  for (const modelName of modelsToTest) {
    console.log(`\nTesting model: ${modelName}`);
    try {
      const response = await genai.models.generateContent({
        model: modelName,
        contents: [{ role: "user", parts: [{ text: "Hello" }] }],
      });
      console.log(`✅ Success with ${modelName}`);
      if (typeof response.text === "function") {
        console.log("response.text():", response.text());
      } else {
        console.log("No response.text() function");
        console.log(
          "Candidates:",
          JSON.stringify(response.candidates, null, 2),
        );
      }
    } catch (error) {
      console.error(`❌ Failed with ${modelName}`);
      console.error(error.message);
    }
  }
}

main();
