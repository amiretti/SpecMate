// The template's single list of AI crawlers (FR-006): robots.txt gives each one its own group with the action of
// the per-site setting `site.aiCrawlers` (default "allow"). Tokens as each provider publishes them:
// - OpenAI (GPTBot, OAI-SearchBot, ChatGPT-User): https://platform.openai.com/docs/bots
// - Anthropic (ClaudeBot, Claude-SearchBot, Claude-User): https://support.anthropic.com (crawler article)
// - Perplexity (PerplexityBot, Perplexity-User): https://docs.perplexity.ai/guides/bots
// - Google (Google-Extended): https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers
//   Blocking it does not remove the site from AI Overviews (research R3): that is governed by Googlebot.
// - Apple (Applebot-Extended): https://support.apple.com/en-us/119829
// - Common Crawl (CCBot): https://commoncrawl.org/ccbot
// - Meta (Meta-ExternalAgent): https://developers.facebook.com/docs/sharing/webmasters/web-crawlers
export const AI_CRAWLERS: readonly string[] = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Meta-ExternalAgent',
];
