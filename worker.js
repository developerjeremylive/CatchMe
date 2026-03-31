export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === "/api/stats") {
      return new Response(JSON.stringify({
        totalEvents: 12847,
        activeDays: 23,
        appsTracked: 156,
        sessions: 89,
        memory: "0.2GB",
        storage: "SQLite + FTS5"
      }), {headers:{"Content-Type":"application/json"}});
    }
    
    if (url.pathname === "/api/events") {
      return new Response(JSON.stringify([
        {id:1,kind:"window",app:"VS Code",title:"working on catchme.py",timestamp:Date.now()-120000},
        {id:2,kind:"keystroke",app:"Terminal",title:"git commit -m 'fix worker'",timestamp:Date.now()-300000},
        {id:3,kind:"clipboard",app:"Chrome",title:"copied code snippet",timestamp:Date.now()-480000},
        {id:4,kind:"window",app:"Slack",title:"team discussion",timestamp:Date.now()-720000}
      ]), {headers:{"Content-Type":"application/json"}});
    }
    
    // Chat API - Simulated LLM responses
    if (url.pathname === "/api/chat") {
      const body = await request.json();
      const message = body.message || "";
      const history = body.history || [];
      
      // Simulate different responses based on keywords
      let response = "";
      const lowerMsg = message.toLowerCase();
      
      if (lowerMsg.includes("code") || lowerMsg.includes("coding")) {
        response = "Based on your activity today, you spent 2.3 hours coding in VS Code. You worked on:\n\n• catchme.py - Worker.js for Cloudflare\n• Landing page with playground\n• Wrangler configuration\n\nTotal: 47 keystrokes, 23 file edits, 5 Git commits.";
      } else if (lowerMsg.includes("search") || lowerMsg.includes("find")) {
        response = "Recent search queries found:\n\n• 'Cloudflare Workers deployment'\n• 'CatchMe README'\n• 'wrangler.toml config'\n\nFiles accessed: 12\nDocuments viewed: 5";
      } else if (lowerMsg.includes("files") || lowerMsg.includes("changed")) {
        response = "Files modified today:\n\n• worker.js (6.5KB)\n• wrangler.toml (74 bytes)\n• README.md (updated)\n\nAll changes synced to GitHub.";
      } else if (lowerMsg.includes("help") || lowerMsg.includes("what can")) {
        response = "🎯 I can help you recall:\n\n• What you were coding (type: 'what did I code?')\n• Files you changed (type: 'what files did I edit?')\n• Search queries (type: 'what did I search?')\n• Your digital activities (type: 'what did I do today?')\n• App usage (type: 'which apps did I use?')\n\n🔧 Configure LLM in Settings to enable full AI features.";
      } else {
        response = "Based on your digital footprint, here's what I found:\n\n📊 Today's Activity:\n• 3 hours active on computer\n• 12 apps used\n• 47 files opened\n• 156 events captured\n\n💡 Try asking:\n• 'What was I coding?'\n• 'Which files did I change?'\n• 'What did I search for?'\n\n🔧 Configure your LLM provider in Settings for full AI-powered responses!";
      }
      
      return new Response(JSON.stringify({
        response: response,
        timestamp: Date.now()
      }), {headers:{"Content-Type":"application/json"}});
    }
    
    // Get chat history
    if (url.pathname === "/api/chat/history") {
      return new Response(JSON.stringify([
        {role:"user",content:"What was I coding today?",timestamp:Date.now()-300000},
        {role:"assistant",content:"You spent 2.3 hours coding in VS Code, mainly on the Cloudflare Worker playground and landing page.",timestamp:Date.now()-290000},
        {role:"user",content:"Which files did I change?",timestamp:Date.now()-180000},
        {role:"assistant",content:"You modified worker.js, wrangler.toml, and README.md. All changes are synced to GitHub.",timestamp:Date.now()-170000}
      ]), {headers:{"Content-Type":"application/json"}});
    }
    
    // Settings API - LLM configuration
    if (url.pathname === "/api/settings") {
      return new Response(JSON.stringify({
        llmProvider: "openrouter",
        model: "google/gemini-2.0-flash-exp",
        apiKey: "",
        apiUrl: "https://openrouter.ai/api/v1",
        maxTokens: 4096,
        temperature: 0.7
      }), {headers:{"Content-Type":"application/json"}});
    }
    
    if (url.pathname === "/api/settings" && request.method === "POST") {
      return new Response(JSON.stringify({success:true}), {headers:{"Content-Type":"application/json"}});
    }
    
    return new Response(PLAYGROUND_HTML, {headers:{"Content-Type":"text/html"}});
  }
};

const PLAYGROUND_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CatchMe - Playground</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0f0f1a;color:#f8f9fa;min-height:100vh}
.container{max-width:1400px;margin:0 auto;padding:1rem}
h1{font-size:2rem;background:linear-gradient(135deg,#ff6b35,#f7931e);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:0.5rem}
.subtitle{color:#6c757d;margin-bottom:1.5rem;font-size:0.95rem}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem;padding-bottom:1rem;border-bottom:1px solid rgba(255,255,255,0.1)}
.nav{display:flex;gap:1rem}
.nav a{color:#6c757d;text-decoration:none;padding:0.5rem 1rem;border-radius:8px;transition:all 0.2s}
.nav a:hover,.nav a.active{background:rgba(255,107,53,0.2);color:#ff6b35}
.btn{background:linear-gradient(135deg,#ff6b35,#f7931e);color:#fff;border:none;padding:0.6rem 1.2rem;border-radius:8px;cursor:pointer;font-weight:600;transition:all 0.2s}
.btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(255,107,53,0.3)}
.playground-grid{display:grid;grid-template-columns:1fr 350px;gap:1.5rem}
.main-panel{background:#1a1a2e;border-radius:16px;padding:1.5rem;border:1px solid rgba(255,107,53,0.2)}
.sidebar{display:flex;flex-direction:column;gap:1rem}
.card{background:#1a1a2e;border-radius:12px;padding:1rem;border:1px solid rgba(255,255,255,0.05)}
.card h3{font-size:0.9rem;color:#6c757d;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem}
.stats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:0.75rem}
.stat{background:rgba(255,107,53,0.1);padding:0.75rem;border-radius:8px;text-align:center}
.stat-value{font-size:1.25rem;font-weight:700;color:#ff6b35}
.stat-label{font-size:0.75rem;color:#6c757d}
.events-list{display:flex;flex-direction:column;gap:0.5rem;max-height:200px;overflow-y:auto}
.event{padding:0.6rem;background:rgba(255,255,255,0.02);border-radius:6px;border-left:3px solid #ff6b35;font-size:0.85rem}
.event-app{font-weight:600}
.event-title{color:#6c757d;font-size:0.8rem}
/* Chat Styles */
.chat-container{display:flex;flex-direction:column;height:500px}
.chat-messages{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:1rem}
.message{padding:1rem;border-radius:12px;max-width:80%}
.message.user{background:rgba(255,107,53,0.2);align-self:flex-end;border-bottom-right-radius:4px}
.message.assistant{background:rgba(22,199,154,0.15);align-self:flex-start;border-bottom-left-radius:4px}
.message-content{font-size:0.95rem;line-height:1.5}
.message-time{font-size:0.7rem;color:#6c757d;margin-top:0.5rem}
.chat-input{display:flex;gap:0.75rem;padding:1rem;border-top:1px solid rgba(255,255,255,0.1)}
.chat-input input{flex:1;padding:0.75rem;border-radius:8px;border:1px solid rgba(255,107,53,0.3);background:#0f0f1a;color:#fff;font-size:0.95rem}
.chat-input input:focus{outline:none;border-color:#ff6b35}
/* Settings */
.settings-form{display:flex;flex-direction:column;gap:1rem}
.form-group{display:flex;flex-direction:column;gap:0.5rem}
.form-group label{font-size:0.85rem;color:#6c757d}
.form-group input,.form-group select{padding:0.75rem;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:#0f0f1a;color:#fff;font-size:0.9rem}
.form-group input:focus,.form-group select:focus{outline:none;border-color:#ff6b35}
.llm-info{background:rgba(255,107,53,0.1);padding:1rem;border-radius:8px;font-size:0.85rem}
.llm-info h4{color:#ff6b35;margin-bottom:0.5rem}
.llm-info code{background:rgba(0,0,0,0.3);padding:0.2rem 0.4rem;border-radius:4px;font-size:0.8rem}
/* Tabs */
.tab-content{display:none}
.tab-content.active{display:block}
.tabs{display:flex;gap:0.5rem;margin-bottom:1rem}
.tab{padding:0.5rem 1rem;background:transparent;border:1px solid rgba(255,255,255,0.1);color:#6c757d;border-radius:8px;cursor:pointer}
.tab.active{background:rgba(255,107,53,0.2);border-color:#ff6b35;color:#ff6b35}
.loading{text-align:center;padding:2rem;color:#6c757d}
.loading::after{content:'';display:inline-block;width:20px;height:20px;border:2px solid #ff6b35;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;margin-left:0.5rem}
@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:900px){.playground-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="container">
<div class="header">
<div>
<h1>🦞 CatchMe Playground</h1>
<p class="subtitle">Experience the full CatchMe digital footprint tracker interface</p>
</div>
<nav class="nav">
<a href="#" class="active" onclick="showTab('playground')">🎮 Playground</a>
<a href="#" onclick="showTab('chat')">💬 Chat</a>
<a href="#" onclick="showTab('settings')">⚙️ Settings</a>
</nav>
</div>

<!-- Playground Tab -->
<div id="playground" class="tab-content active">
<div class="playground-grid">
<div class="main-panel">
<h2 style="margin-bottom:1rem">📊 Activity Dashboard</h2>
<div class="stats-grid">
<div class="stat"><div class="stat-value" id="totalEvents">-</div><div class="stat-label">Total Events</div></div>
<div class="stat"><div class="stat-value" id="activeDays">-</div><div class="stat-label">Active Days</div></div>
<div class="stat"><div class="stat-value" id="appsTracked">-</div><div class="stat-label">Apps Tracked</div></div>
<div class="stat"><div class="stat-value" id="sessions">-</div><div class="stat-label">Sessions</div></div>
</div>
<h3 style="margin:1.5rem 0 0.75rem">📝 Recent Activity</h3>
<div class="events-list" id="eventsList"></div>
</div>
<div class="sidebar">
<div class="card">
<h3>💾 Storage</h3>
<div style="font-size:0.9rem"><div>Memory: <span style="color:#ff6b35">0.2GB</span></div><div style="margin-top:0.5rem">Storage: <span style="color:#16c79a">SQLite + FTS5</span></div></div>
</div>
<div class="card">
<h3>🔗 LLM Provider</h3>
<div style="font-size:0.85rem;color:#6c757d">
<div>Provider: <span style="color:#ff6b35">OpenRouter</span></div>
<div style="margin-top:0.5rem">Model: <span style="color:#16c79a">gemini-2.0-flash</span></div>
</div>
</div>
<div class="card">
<h3>🎯 Quick Actions</h3>
<div style="display:flex;flex-direction:column;gap:0.5rem">
<button class="btn" style="font-size:0.85rem;padding:0.5rem" onclick="quickQuery('what did I code?')">What did I code?</button>
<button class="btn" style="font-size:0.85rem;padding:0.5rem;background:rgba(22,199,154,0.3)" onclick="quickQuery('what files changed?')">What files changed?</button>
<button class="btn" style="font-size:0.85rem;padding:0.5rem;background:rgba(255,107,53,0.3)" onclick="quickQuery('what did I search?')">What did I search?</button>
</div>
</div>
</div>
</div>
</div>

<!-- Chat Tab -->
<div id="chat" class="tab-content">
<div class="card" style="padding:0">
<div class="chat-container">
<div class="chat-messages" id="chatMessages">
<div class="message assistant">
<div class="message-content">👋 Hi! I'm your CatchMe assistant. I can help you recall your digital activities. Try asking:</div>
<div class="message-time">Just now</div>
</div>
</div>
<div class="chat-input">
<input type="text" id="chatInput" placeholder="Ask anything about your digital footprint... (e.g., What was I coding today?)" onkeypress="handleChatKey(event)">
<button class="btn" onclick="sendMessage()">Send</button>
</div>
</div>
</div>
</div>

<!-- Settings Tab -->
<div id="settings" class="tab-content">
<div class="card">
<h2 style="margin-bottom:1.5rem">⚙️ LLM Configuration</h2>
<div class="llm-info">
<h4>📡 Free LLM Options (Recommended)</h4>
<p>Configure your LLM provider to enable AI-powered responses. For free usage:</p>
<p style="margin-top:0.5rem"><strong>OpenRouter</strong> (recommended): Get free API key at <a href="https://openrouter.ai/keys" target="_blank" style="color:#ff6b35">openrouter.ai/keys</a></p>
<p style="margin-top:0.5rem"><strong>Google Gemini</strong>: Get free API key at <a href="https://aistudio.google.com/apikey" target="_blank" style="color:#ff6b35">aistudio.google.com/apikey</a></p>
</div>
<form class="settings-form" onsubmit="saveSettings(event)">
<div class="form-group">
<label>LLM Provider</label>
<select id="llmProvider">
<option value="openrouter">OpenRouter (Recommended - Free tier available)</option>
<option value="gemini">Google Gemini</option>
<option value="ollama">Ollama (Local)</option>
</select>
</div>
<div class="form-group">
<label>API Key</label>
<input type="password" id="apiKey" placeholder="Enter your API key">
</div>
<div class="form-group">
<label>Model</label>
<select id="model">
<option value="google/gemini-2.0-flash-exp">Google Gemini 2.0 Flash (Free)</option>
<option value="google/gemini-1.5-flash">Google Gemini 1.5 Flash (Free)</option>
<option value="anthropic/claude-3-haiku">Claude 3 Haiku (Free)</option>
<option value="meta-llama/llama-3.2-90b-vision-instruct">Llama 3.2 Vision (Free)</option>
</select>
</div>
<div class="form-group">
<label>Max Tokens</label>
<input type="number" id="maxTokens" value="4096">
</div>
<div class="form-group">
<label>Temperature</label>
<input type="range" id="temperature" min="0" max="1" step="0.1" value="0.7" oninput="document.getElementById('tempValue').textContent=this.value">
<span id="tempValue">0.7</span>
</div>
<button type="submit" class="btn">Save Configuration</button>
</form>
</div>
</div>
</div>

<script>
// Tab switching
function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav a').forEach(n => n.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  event.target.classList.add('active');
}

// Load stats
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    document.getElementById('totalEvents').textContent = data.totalEvents.toLocaleString();
    document.getElementById('activeDays').textContent = data.activeDays;
    document.getElementById('appsTracked').textContent = data.appsTracked;
    document.getElementById('sessions').textContent = data.sessions;
  } catch(e) { console.error(e); }
}

// Load events
async function loadEvents() {
  try {
    const res = await fetch('/api/events');
    const events = await res.json();
    const list = document.getElementById('eventsList');
    list.innerHTML = '';
    for(var i=0;i<events.length;i++) {
      var e = events[i];
      var time = Math.round((Date.now()-e.timestamp)/60000);
      list.innerHTML += '<div class="event"><span class="event-app">'+e.app+'</span><span class="event-title"> - '+e.title+' ('+time+' min ago)</span></div>';
    }
  } catch(e) { console.error(e); }
}

// Chat functions
async function sendMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if(!message) return;
  
  addMessage('user', message);
  input.value = '';
  
  // Show loading
  const messages = document.getElementById('chatMessages');
  messages.innerHTML += '<div class="message assistant" id="loadingMsg"><div class="message-content loading">Thinking...</div></div>';
  messages.scrollTop = messages.scrollHeight;
  
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({message: message, history: []})
    });
    const data = await res.json();
    
    document.getElementById('loadingMsg').remove();
    addMessage('assistant', data.response);
  } catch(e) {
    document.getElementById('loadingMsg').remove();
    addMessage('assistant', 'Sorry, I encountered an error. Please check your LLM configuration in Settings.');
  }
}

function addMessage(role, content) {
  const messages = document.getElementById('chatMessages');
  const time = new Date().toLocaleTimeString();
  messages.innerHTML += '<div class="message '+role+'"><div class="message-content">'+content.replace(/\n/g,'<br>')+'</div><div class="message-time">'+time+'</div></div>';
  messages.scrollTop = messages.scrollHeight;
}

function handleChatKey(e) {
  if(e.key === 'Enter') sendMessage();
}

function quickQuery(query) {
  showTab('chat');
  document.getElementById('chatInput').value = query;
  sendMessage();
}

function saveSettings(e) {
  e.preventDefault();
  alert('Settings saved! (Demo mode - settings stored in browser localStorage)');
  localStorage.setItem('catchme_settings', JSON.stringify({
    provider: document.getElementById('llmProvider').value,
    apiKey: document.getElementById('apiKey').value,
    model: document.getElementById('model').value
  }));
}

// Initialize
loadStats();
loadEvents();
</script>
</body>
</html>`;