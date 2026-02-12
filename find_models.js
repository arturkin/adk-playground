const { GoogleGenAI } = require("@google/genai");
const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY });

async function findModels() {
  try {
    const res = await genai.models.list();
    if (!res || !res.pageInternal) {
      console.log("No models found or different structure", res);
      return;
    }
    const allModels = res.pageInternal;

    const thinkingModels = allModels.filter((m) =>
      JSON.stringify(m).toLowerCase().includes("thinking"),
    );
    console.log(
      "Thinking models:",
      thinkingModels.map((m) => m.name),
    );

    const flash25 = allModels.filter(
      (m) => m.name.includes("2.5") && m.name.includes("flash"),
    );
    console.log(
      "2.5 Flash models:",
      flash25.map((m) => m.name),
    );

    const proLatest = allModels.filter(
      (m) => m.name.includes("pro") && m.name.includes("latest"),
    );
    console.log(
      "Pro Latest models:",
      proLatest.map((m) => m.name),
    );
  } catch (e) {
    console.error(e);
  }
}

findModels();
