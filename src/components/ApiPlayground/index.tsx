import React, {useState} from 'react';

const BASE = 'https://api.imagegpt.online';

type Media = 'text' | 'image' | 'audio' | 'video';

interface QueryParam {
  name: string;
  label?: string;
  default?: string;
  options?: string[];
}

interface Props {
  /** Endpoint path, e.g. "/generate/text". */
  endpoint: string;
  /** HTTP method. Defaults to POST. */
  method?: 'GET' | 'POST';
  /** Prefilled JSON request body (POST only). */
  defaultBody?: string;
  /** Query-param inputs (GET only). */
  queryParams?: QueryParam[];
  /** How to render a successful response. */
  media?: Media;
  /** Async flow: submit returns a taskId, then poll statusEndpoint. */
  async?: boolean;
  statusEndpoint?: string;
}

const box: React.CSSProperties = {
  border: '1px solid var(--ifm-color-emphasis-300)',
  borderRadius: 'var(--ifm-global-radius)',
  padding: '1rem',
  marginBottom: '1rem',
  background: 'var(--ifm-background-surface-color)',
};

const label: React.CSSProperties = {
  display: 'block',
  fontWeight: 600,
  marginBottom: '0.25rem',
};

const input: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  borderRadius: 'var(--ifm-global-radius)',
  border: '1px solid var(--ifm-color-emphasis-300)',
  fontFamily: 'var(--ifm-font-family-monospace)',
  background: 'var(--ifm-background-color)',
  color: 'var(--ifm-font-color-base)',
};

export default function ApiPlayground({
  endpoint,
  method = 'POST',
  defaultBody = '{}',
  queryParams = [],
  media = 'text',
  async: isAsync = false,
  statusEndpoint = '/generate/video-status',
}: Props): React.ReactElement {
  const [apiKey, setApiKey] = useState('');
  const [body, setBody] = useState(defaultBody);
  const [query, setQuery] = useState<Record<string, string>>(() =>
    Object.fromEntries(queryParams.map((q) => [q.name, q.default ?? ''])),
  );
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');

  function reset() {
    setError('');
    setText('');
    setMediaUrl('');
    setStatus('');
  }

  // Read a response: JSON -> show it (and preview any url); binary -> blob.
  async function handleResponse(res: Response) {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await res.json();
      setText(JSON.stringify(data, null, 2));
      if (data.url) setMediaUrl(data.url);
      else if (data.base64) setMediaUrl(`data:image/png;base64,${data.base64}`);
      return;
    }
    if (media === 'text') {
      setText(await res.text());
      return;
    }
    const blob = await res.blob();
    setMediaUrl(URL.createObjectURL(blob));
  }

  async function poll(taskId: string) {
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      const res = await fetch(
        `${BASE}${statusEndpoint}?taskId=${encodeURIComponent(taskId)}&outputType=url`,
        {headers: {'x-api-key': apiKey}},
      );
      const data = await res.json();
      setStatus(`Status: ${data.status}`);
      if (data.status === 'success' && data.url) {
        setMediaUrl(data.url);
        return;
      }
      if (data.status === 'failed' || data.success === false) {
        throw new Error('Task failed.');
      }
    }
    throw new Error('Timed out waiting for the task to finish.');
  }

  async function send() {
    reset();
    if (!apiKey) {
      setError('Enter your API key first.');
      return;
    }
    setLoading(true);
    try {
      if (method === 'GET') {
        const qs = queryParams
          .map(
            (q) =>
              `${encodeURIComponent(q.name)}=${encodeURIComponent(query[q.name] ?? '')}`,
          )
          .join('&');
        const res = await fetch(`${BASE}${endpoint}${qs ? `?${qs}` : ''}`, {
          headers: {'x-api-key': apiKey},
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(`${res.status} ${res.statusText}${t ? `: ${t}` : ''}`);
        }
        await handleResponse(res);
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new Error('Request body is not valid JSON.');
      }
      const res = await fetch(`${BASE}${endpoint}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'x-api-key': apiKey},
        body: JSON.stringify(parsed),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`${res.status} ${res.statusText}${t ? `: ${t}` : ''}`);
      }
      if (isAsync) {
        const data = await res.json();
        setStatus(`Task ${data.taskId} submitted. Polling…`);
        await poll(data.taskId);
      } else {
        await handleResponse(res);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={box}>
      <div style={{marginBottom: '0.75rem'}}>
        <label style={label} htmlFor="pg-key">
          API key (x-api-key)
        </label>
        <input
          id="pg-key"
          style={input}
          type="password"
          placeholder="YOUR_API_KEY"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>

      {method === 'GET' ? (
        queryParams.map((q) => (
          <div key={q.name} style={{marginBottom: '0.75rem'}}>
            <label style={label} htmlFor={`pg-${q.name}`}>
              {q.label ?? q.name}
            </label>
            {q.options ? (
              <select
                id={`pg-${q.name}`}
                style={input}
                value={query[q.name] ?? ''}
                onChange={(e) =>
                  setQuery((s) => ({...s, [q.name]: e.target.value}))
                }>
                {q.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`pg-${q.name}`}
                style={input}
                value={query[q.name] ?? ''}
                placeholder={q.name}
                onChange={(e) =>
                  setQuery((s) => ({...s, [q.name]: e.target.value}))
                }
              />
            )}
          </div>
        ))
      ) : (
        <div style={{marginBottom: '0.75rem'}}>
          <label style={label} htmlFor="pg-body">
            Request body (JSON)
          </label>
          <textarea
            id="pg-body"
            style={{...input, minHeight: '9rem', resize: 'vertical'}}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
      )}

      <button
        className="button button--primary"
        onClick={send}
        disabled={loading}>
        {loading ? 'Sending…' : 'Send request'}
      </button>

      {status && <p style={{marginTop: '1rem'}}>{status}</p>}
      {error && (
        <pre
          style={{
            marginTop: '1rem',
            whiteSpace: 'pre-wrap',
            color: 'var(--ifm-color-danger)',
          }}>
          {error}
        </pre>
      )}
      {text && (
        <pre style={{marginTop: '1rem', whiteSpace: 'pre-wrap'}}>{text}</pre>
      )}
      {mediaUrl && media === 'image' && (
        <img
          style={{marginTop: '1rem', maxWidth: '100%'}}
          src={mediaUrl}
          alt="Generated result"
        />
      )}
      {mediaUrl && media === 'audio' && (
        <audio style={{marginTop: '1rem', width: '100%'}} controls src={mediaUrl} />
      )}
      {mediaUrl && media === 'video' && (
        <video
          style={{marginTop: '1rem', maxWidth: '100%'}}
          controls
          src={mediaUrl}
        />
      )}
    </div>
  );
}
