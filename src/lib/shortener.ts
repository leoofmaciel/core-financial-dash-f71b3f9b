export async function shortenUrl(longUrl: string): Promise<string> {
  try {
    const tinyUrlEndpoint = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(tinyUrlEndpoint)}`;
    
    // Some adblockers might block allorigins or tinyurl. We use a short timeout.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (res.ok) {
      const text = await res.text();
      if (text.startsWith("http")) return text;
    }
  } catch (e) {
    console.warn("Failed to shorten url", e);
  }
  return longUrl;
}
