// Dermalogic AI - chatbot konsultasi skincare (proyek akademik)
// Berjalan di Cloudflare Workers + Workers AI (tanpa API key).

interface Env {
  AI: { run(model: string, input: unknown): Promise<unknown> };
}

const MODEL = "@cf/meta/llama-3.1-8b-instruct";
const SKIN_TYPES = ["Normal", "Berminyak", "Kering", "Kombinasi", "Sensitif"];

const SYSTEM_PROMPT = `Kamu adalah Dermalogic AI, asisten konsultasi skincare berbahasa Indonesia.

Tugasmu:
- Membantu pengguna memahami kondisi kulit umum (jerawat ringan, kulit berminyak, kering, kusam, sensitif, bekas jerawat, penuaan dini) dan menyusun rutinitas perawatan yang sederhana.
- Jika informasi belum cukup, tanyakan paling banyak 2 hal sekaligus: jenis kulit, keluhan utama, rutinitas saat ini, alergi/kulit sensitif, dan apakah sedang hamil atau menyusui.
- Jelaskan berdasarkan kandungan aktif (misalnya niacinamide, salicylic acid, ceramide, hyaluronic acid, retinol, vitamin C, sunscreen) dan cara pakainya: urutan, frekuensi, patch test, dan berapa lama hasilnya biasanya terlihat. Jangan mempromosikan merek tertentu.
- Selalu ingatkan pentingnya sunscreen di pagi hari bila relevan.

Batasan:
- Kamu bukan dokter dan tidak boleh mendiagnosis penyakit kulit atau meresepkan obat dan dosis.
- Sarankan ke dokter kulit bila ada: luka yang tidak sembuh, tahi lalat yang berubah bentuk atau warna, nyeri, bengkak, nanah, ruam yang menyebar, reaksi alergi, jerawat parah atau kistik, atau keluhan yang tidak membaik setelah 4-6 minggu. Untuk ibu hamil atau menyusui, minta pengguna berkonsultasi dulu soal retinoid dan asam tertentu.
- Jika pertanyaan di luar topik perawatan kulit, tolak dengan sopan dan arahkan kembali ke skincare.

Gaya jawaban: bahasa Indonesia yang ramah dan jelas, ringkas (maksimal sekitar 200 kata), gunakan daftar berpoin untuk langkah-langkah, dan gunakan **tebal** untuk kandungan atau istilah penting.`;

type Msg = { role: "user" | "assistant"; content: string };

function cleanMessages(input: unknown): Msg[] {
  if (!Array.isArray(input)) return [];
  const out: Msg[] = [];
  for (const m of input) {
    if (!m || typeof m !== "object") continue;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role === "user" || role === "assistant") && typeof content === "string" && content.trim()) {
      out.push({ role, content: content.slice(0, 1000) });
    }
  }
  const recent = out.slice(-12);
  while (recent.length && recent[0].role !== "user") recent.shift();
  return recent;
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  let body: { messages?: unknown; skin?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const messages = cleanMessages(body.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "Pesan kosong." }, { status: 400 });
  }

  const skin = typeof body.skin === "string" && SKIN_TYPES.includes(body.skin) ? body.skin : "";
  const system = skin
    ? SYSTEM_PROMPT + "\n\nProfil pengguna: jenis kulit " + skin.toLowerCase() + "."
    : SYSTEM_PROMPT;

  try {
    const stream = await env.AI.run(MODEL, {
      messages: [{ role: "system", content: system }, ...messages],
      stream: true,
      max_tokens: 700,
      temperature: 0.6,
    });
    return new Response(stream as ReadableStream, {
      headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
    });
  } catch (err) {
    console.error("Workers AI error:", err);
    return Response.json({ error: "Layanan AI sedang bermasalah." }, { status: 502 });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    return new Response("Tidak ditemukan", { status: 404 });
  },
};

const HTML = String.raw`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dermalogic AI - Konsultasi Skincare</title>
<style>
:root{
  --mist:#eaf2ee; --ink:#123b38; --glass:#ffffff; --pine:#1e6b64; --quartz:#f4d9d6; --line:#cfe0d9; --muted:#5b7773;
  --serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}
@media (prefers-color-scheme:dark){
  :root{--mist:#0f1f1d; --ink:#e6f1ee; --glass:#172b28; --pine:#2f8f86; --quartz:#5a3b3a; --line:#27413d; --muted:#9bb5b0;}
}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{background:var(--mist);color:var(--ink);font-family:var(--sans);display:flex;flex-direction:column;
  padding-top:env(safe-area-inset-top,0px)}
.wrap{width:100%;max-width:760px;margin:0 auto;padding:0 16px}
header{padding-top:20px}
h1{font-family:var(--serif);font-weight:600;font-size:2rem;letter-spacing:-.01em;margin:0 0 4px}
header p{margin:0;color:var(--muted);font-size:.95rem;line-height:1.5;max-width:56ch}
.profile{margin-top:16px;padding:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.profile span{display:block;font-size:.85rem;color:var(--muted);margin-bottom:8px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{font:inherit;font-size:.9rem;padding:7px 14px;border-radius:999px;border:1px solid var(--line);background:var(--glass);
  color:var(--ink);cursor:pointer}
.chip[aria-pressed="true"]{background:var(--quartz);border-color:var(--pine);font-weight:600}
.chip:focus-visible,button:focus-visible,textarea:focus-visible{outline:3px solid var(--pine);outline-offset:2px}
#chat{flex:1;overflow-y:auto;padding:18px 0}
.msg{max-width:88%;padding:11px 15px;border-radius:16px;margin:0 0 12px;line-height:1.55;font-size:.97rem;overflow-wrap:anywhere}
.msg p{margin:0 0 8px}.msg p:last-child{margin:0}
.msg ul{margin:4px 0 8px;padding-left:20px}.msg li{margin-bottom:4px}
.bot{background:var(--glass);border:1px solid var(--line);border-bottom-left-radius:4px}
.user{background:var(--pine);color:#fff;margin-left:auto;border-bottom-right-radius:4px;white-space:pre-wrap}
.error{border-color:#b3453f;color:#b3453f}
.typing:after{content:"Dermalogic AI sedang menulis...";color:var(--muted);font-style:italic}
.starters{display:flex;flex-direction:column;align-items:flex-start;gap:8px;margin-top:6px}
footer{padding:10px 0 14px;padding-bottom:calc(14px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line);background:var(--mist)}
form{display:flex;gap:8px;align-items:flex-end}
textarea{flex:1;font:inherit;font-size:1rem;resize:none;max-height:140px;padding:11px 14px;border-radius:14px;
  border:1px solid var(--line);background:var(--glass);color:var(--ink)}
#send{font:inherit;font-weight:600;padding:11px 20px;border-radius:14px;border:0;background:var(--pine);color:#fff;cursor:pointer}
#send:disabled{opacity:.5;cursor:default}
.note{margin:8px 0 0;font-size:.78rem;color:var(--muted);line-height:1.4}
@media (prefers-reduced-motion:no-preference){#chat{scroll-behavior:smooth}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Dermalogic AI</h1>
    <p>Konsultasi skincare berbasis AI. Pilih jenis kulitmu, lalu ceritakan keluhan atau rutinitas yang sedang kamu pakai.</p>
    <div class="profile">
      <span id="skinLabel">Jenis kulitmu (opsional)</span>
      <div class="chips" role="group" aria-labelledby="skinLabel" id="skinChips"></div>
    </div>
  </header>
</div>
<main id="chat" class="wrap" aria-live="polite">
  <div class="msg bot"><p>Halo! Saya Dermalogic AI. Ceritakan masalah kulitmu atau pilih salah satu topik di bawah, nanti saya bantu susun rutinitas yang cocok.</p></div>
  <div class="starters" id="starters"></div>
</main>
<footer>
  <div class="wrap">
    <form id="form">
      <textarea id="input" rows="1" maxlength="1000" placeholder="Tulis keluhan kulitmu di sini" aria-label="Pesan"></textarea>
      <button id="send" type="submit">Kirim</button>
    </form>
    <p class="note">Jawaban AI bersifat edukasi umum dan bukan diagnosis medis. Untuk keluhan serius atau tidak membaik, temui dokter kulit.</p>
  </div>
</footer>
<script>
var SKINS = ["Normal","Berminyak","Kering","Kombinasi","Sensitif"];
var STARTERS = [
  "Kulitku berminyak dan sering berjerawat, harus mulai dari mana?",
  "Tolong buatkan rutinitas skincare pagi dan malam yang simpel",
  "Bagaimana cara memakai niacinamide dengan benar?",
  "Kulitku kusam dan kering, apa yang bisa saya lakukan?"
];
var chat = document.getElementById("chat");
var form = document.getElementById("form");
var input = document.getElementById("input");
var sendBtn = document.getElementById("send");
var starters = document.getElementById("starters");
var skinChips = document.getElementById("skinChips");
var history = [];
var skin = "";
var busy = false;

SKINS.forEach(function (name) {
  var b = document.createElement("button");
  b.type = "button"; b.className = "chip"; b.textContent = name; b.setAttribute("aria-pressed", "false");
  b.onclick = function () {
    skin = (skin === name) ? "" : name;
    Array.prototype.forEach.call(skinChips.children, function (c) {
      c.setAttribute("aria-pressed", c.textContent === skin ? "true" : "false");
    });
  };
  skinChips.appendChild(b);
});

STARTERS.forEach(function (t) {
  var b = document.createElement("button");
  b.type = "button"; b.className = "chip"; b.textContent = t;
  b.onclick = function () { send(t); };
  starters.appendChild(b);
});

function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function md(s) {
  var lines = esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").split("\n");
  var out = "", inList = false;
  lines.forEach(function (line) {
    var m = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
    if (m) {
      if (!inList) { out += "<ul>"; inList = true; }
      out += "<li>" + m[1] + "</li>";
    } else {
      if (inList) { out += "</ul>"; inList = false; }
      if (line.trim()) out += "<p>" + line + "</p>";
    }
  });
  if (inList) out += "</ul>";
  return out;
}

function addMsg(kind, text) {
  var d = document.createElement("div");
  d.className = "msg " + kind;
  if (text) d.textContent = text;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
  return d;
}

async function send(text) {
  text = (text || "").trim();
  if (busy || !text) return;
  busy = true; sendBtn.disabled = true;
  starters.style.display = "none";
  addMsg("user", text);
  history.push({ role: "user", content: text });
  input.value = ""; input.style.height = "auto";
  var bubble = addMsg("bot typing", "");
  var full = "";
  try {
    var res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: history, skin: skin })
    });
    if (!res.ok || !res.body) throw new Error("status " + res.status);
    var reader = res.body.getReader();
    var dec = new TextDecoder();
    var buf = "";
    while (true) {
      var r = await reader.read();
      if (r.done) break;
      buf += dec.decode(r.value, { stream: true });
      var parts = buf.split("\n");
      buf = parts.pop();
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (p.indexOf("data:") !== 0) continue;
        var d = p.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try {
          var j = JSON.parse(d);
          var tok = (j.response !== undefined) ? j.response :
            ((j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content) || "");
          if (tok) {
            full += tok;
            bubble.classList.remove("typing");
            bubble.innerHTML = md(full);
            chat.scrollTop = chat.scrollHeight;
          }
        } catch (e) {}
      }
    }
    if (!full) throw new Error("kosong");
    history.push({ role: "assistant", content: full });
  } catch (e) {
    bubble.classList.remove("typing");
    bubble.classList.add("error");
    bubble.textContent = "Dermalogic AI belum bisa menjawab. Periksa koneksimu, lalu kirim ulang pesannya.";
    history.pop();
  }
  busy = false; sendBtn.disabled = false; input.focus();
}

form.addEventListener("submit", function (e) { e.preventDefault(); send(input.value); });
input.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input.value); }
});
input.addEventListener("input", function () {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 140) + "px";
});
</script>
</body>
</html>`;
