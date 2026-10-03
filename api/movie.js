module.exports = async (req, res) => {
  const params = new URLSearchParams(req.query).toString();
  const targetUrl = `http://143.198.214.247:25583/api/movie?${params}`;

  try {
    const response = await fetch(targetUrl);
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Gagal nyambung ke VPS Pterodactyl: " + error.message });
  }
};
