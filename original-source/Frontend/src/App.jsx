import { useState } from "react";
import "./App.css";

function App() {
  const [url, setUrl] = useState("github.com");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const analyzeUrl = async () => {
    if (!url) return;

    setLoading(true);
    setError("");
    setData(null);

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/analyze?url=${encodeURIComponent(url)}`
      );

      if (!response.ok) {
        throw new Error("Unable to analyze URL");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError("Could not connect to the backend.");
    }

    setLoading(false);
  };

  return (
    <div className="app">
      <h1>Internet Request Visualizer</h1>

      <p className="subtitle">
        Visualize what happens when you visit a website
      </p>

      <div className="input-section">
        <input
          type="text"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />

        <button onClick={analyzeUrl}>
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </div>

      {error && <p>{error}</p>}

      {data && (
        <div className="flow">

          <div className="step">
            <h2>DNS Lookup</h2>
            <p>Domain: {data.domain}</p>
            <p>IP Address: {data.ip}</p>
            <span>{data.dns_time_ms} ms</span>
          </div>

          <div className="arrow">↓</div>

          <div className="step">
            <h2>HTTP Request</h2>
            <p>GET /</p>
            <p>Status: {data.status_code}</p>
            <span>{data.response_time_ms} ms</span>
          </div>

          <div className="arrow">↓</div>

          <div className="step success">
            <h2>Request Complete</h2>
            <p>Response Size: {data.response_size_bytes} bytes</p>
            <p>Server responded successfully</p>
          </div>

        </div>
      )}
    </div>
  );
}

export default App;