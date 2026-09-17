require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const ModelClient = require("@azure-rest/ai-inference").default;
const { AzureKeyCredential } = require("@azure/core-auth");
const { isUnexpected } = require("@azure-rest/ai-inference");

// Env variables
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// GPT-4.1 config
const endpoint = "https://models.github.ai/inference";
const model = "openai/gpt-4.1";

// Create Telegram Bot
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Base Prompt Enter the base prompt as your need
const BASE_PROMPT = `respect user, be usefull and keep the reply short`;

// Ask GPT-4.1 via GitHub API
async function askGPT41(userInput) {
  try {
    const client = ModelClient(endpoint, new AzureKeyCredential(GITHUB_TOKEN));
    const response = await client.path("/chat/completions").post({
      body: {
        model,
        messages: [
          { role: "system", content: BASE_PROMPT },
          { role: "user", content: `Theist's statement: "${userInput}"\nAI Reply:` },
        ],
        temperature: 0.9,
        top_p: 0.95,
        max_tokens: 2048,
      },
    });

    if (isUnexpected(response)) {
      console.error("API Error:", response.body.error);
      return "Error from GPT-4.1 API.";
    }

    return response.body.choices?.[0]?.message?.content || "No response from the model.";
  } catch (err) {
    console.error("GPT-4.1 Exception:", err);
    return "Error: Failed to connect to GPT-4.1 API.";
  }
}

// Telegram Handler
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const chatType = msg.chat.type;
  const botUsername = (await bot.getMe()).username;
  const mentionPattern = new RegExp(`^@${botUsername}\\s+(.+)$`, "i");

  const isGroup = chatType === "group" || chatType === "supergroup";
  const isMentioned = isGroup && mentionPattern.test(text || "");
  const isPrivate = chatType === "private";

  if (!text) return;

  let question = null;

  if (isPrivate) {
    question = text;
    console.log(`[PRIVATE] ${msg.from.first_name}: ${question}`);
  } else if (isMentioned) {
    question = text.match(mentionPattern)[1].trim();
    console.log(`[GROUP][Mentioned] ${msg.from.first_name}: ${question}`);
  }

  if (question) {
    const reply = await askGPT41(question);
    bot.sendMessage(chatId, reply, {
      reply_to_message_id: msg.message_id,
    });
  }
});
