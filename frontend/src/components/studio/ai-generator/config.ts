/**
 * AI Service Configuration
 * 
 * Centralized config for AI generation. When migrating to a backend,
 * simply change `API_ENDPOINT` to your own server URL and remove
 * the Authorization header (your backend will handle auth).
 */

export const AI_CONFIG = {
  /** 
   * OpenAI API endpoint. 
   * Replace with your backend URL later, e.g. "https://api.yourapp.com/ai/generate"
   */
  API_ENDPOINT: "https://api.openai.com/v1/chat/completions",

  /** Model to use */
  MODEL: "gpt-4o-mini",

  /** Generation temperature (0-1). Higher = more creative */
  TEMPERATURE: 0.7,

  /** Max tokens for response */
  MAX_TOKENS: 2000,

  /** LocalStorage key for API key */
  STORAGE_KEY: "koda-openai-api-key",

  /** LocalStorage key for the model override */
  MODEL_STORAGE_KEY: "koda-openai-model",

  /** 
   * When true, sends API key directly to OpenAI from browser.
   * Set to false when using your own backend proxy. 
   */
  DIRECT_MODE: true,
};
