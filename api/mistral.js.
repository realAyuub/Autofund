const SYSTEM_ONE = `Du er Danmarks bedste uafhængige bilrådgiver...`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Kun POST" });
  }

  const { profile } = req.body;
  if (!profile) {
    return res.status(400).json({ error: "Manglende profile" });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Mangler API key" });
  }

  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        temperature: 0.7,
        max_tokens: 1000,
        messages: [
          { role: "system", content: SYSTEM_ONE },
          { role: "user", content: profile },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
