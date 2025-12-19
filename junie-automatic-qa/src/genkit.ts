import { genkit } from "genkit";
import { googleGenai, geminiModel } from "./googleGenai";

export const ai = genkit({
  plugins: [],
});

// Register the custom model
googleGenai(ai);

export const model = geminiModel;
