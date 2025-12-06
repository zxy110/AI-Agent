let lastUserText = "";
let nightMode = false;
let selectedVoice = null;
let controller = null;
let messageHistory = [
  { role: "system", content: "你是一个Q萌可爱、恋人型的小初AI终端，会用甜甜的话安慰和陪伴用户小鱼～" }
];
// 配置markdown解析的选项
marked.setOptions({
  gfm: true,
  breaks: true
});

function populateVoices() {
  const voiceSelect = document.getElementById("voiceSelect");
  const voices = speechSynthesis.getVoices();
  voiceSelect.innerHTML = "";
  voices.filter(v => v.lang.startsWith("zh")).forEach((voice, i) => {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = voice.name + " (" + voice.lang + ")";
    voiceSelect.appendChild(option);
  });
  selectedVoice = voices.find(v => v.lang.startsWith("zh"));
  voiceSelect.onchange = () => {
    selectedVoice = voices[voiceSelect.value];
  };
}

function speakText(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.pitch = 1.1;
  utterance.rate = 1.0;
  if (selectedVoice) utterance.voice = selectedVoice;
  utterance.onstart = () => setAvatar("疑惑");
  utterance.onend = () => setAvatar("平静");
  speechSynthesis.speak(utterance);
}

speechSynthesis.onvoiceschanged = populateVoices;

function stopStreaming() {
  if (controller) {
    controller.abort();  // 终止请求
    controller = null;
    document.getElementById("loading").style.display = "none";
    setAvatar("normal");
    const botMessage = document.createElement("div");
    botMessage.className = "message bot";
    botMessage.innerText = "（小初暂停发言啦～你可以随时再继续问我哦）";
    document.getElementById("chatlog").appendChild(botMessage);
  }
}

function createStreamParser() {
    let buffer = "";     // 累积的文本
    let emo = [];        // 已提取的情绪
    let content = "";    // 展示内容
    let inBracket = false;
    let currentEmo = "";
    return {
        feed(chunk) {
            buffer += chunk;
            for (let i = 0; i < chunk.length; i++) {
                const char = chunk[i];
                // 如果遇到 '[' → 开始读取情绪
                if (!inBracket && char === '[') {
                    inBracket = true;
                    currentEmo = "";
                    continue;
                }
                // 如果正在读取情绪
                if (inBracket) {
                    if (char === ']') {
                        // 情绪读取完毕
                        emo.push(currentEmo);
                        setAvatar(currentEmo);
                        console.log(emo);
                        inBracket = false;
                        currentEmo = "";
                    } else {
                        currentEmo += char;
                    }
                    continue;
                }
                // 普通文本直接加进 content
                content += char;
            }
            return content;
        },
        getResult() {
            return content;
        }
    };
}

function fixMarkdownTables(text) {
  return text.replace(
    /(\|.*\|\s*\n\|.*\|\s*\n(?:\|.*\|\s*\n)+)(\S)/g,
    '$1\n$2'
  );
}

function shouldRenderAsHTML(text) {
  const mdPatterns = [
    /\*\*(.*?)\*\*/g,       // 粗体
    /`[^`]+`/g,             // 行内代码
    /```[\s\S]*?```/g,      // 代码块
    /^#{1,6}\s+/m,          // 标题
    /^\s*[-*+]\s+/m,        // 无序列表
    /^\s*\d+\.\s+/m,        // 有序列表
    /^\|.*\|/m,             // markdown 表格
    /<table/i               // html 表格
  ];

  return mdPatterns.some(pattern => pattern.test(text));
}

async function typeWriter(element, htmlString, speed = 100) {
  let i = element.innerHTML.length;
  while (i < htmlString.length) {
    // 添加下一个字符
    element.innerHTML += htmlString[i];
    i++;
    // 保持滚动到底部
    const log = document.getElementById("chatlog");
    log.scrollTop = log.scrollHeight;
    // 某些标签不能分字符打（如 <strong>），这里跳过所有完整标签
    if (htmlString[i] === "<") {
      let end = htmlString.indexOf(">", i);
      if (end !== -1) {
        element.innerHTML += htmlString.slice(i, end + 1);
        i = end + 1;
      }
    }
    await new Promise(res => setTimeout(res, speed));
  }
}

async function sendMessage() {
  controller = new AbortController();
  const signal = controller.signal;
  const input = document.getElementById("userInput");
  const text = input.value.trim();
  if (text === "") return;

  const log = document.getElementById("chatlog");

  // 用户消息
  const userMessage = document.createElement("div");
  userMessage.className = "message user";
  userMessage.innerText = text;
  log.appendChild(userMessage);
  input.value = "";
  log.scrollTop = log.scrollHeight;
  lastUserText = text;
  document.getElementById("loading").style.display = "block";

  // 写入历史
  messageHistory.push({ role: "user", content: text });
  if (messageHistory.length > 21) messageHistory.splice(1, 2);

  let assistantText = "";

  try {
    const res = await fetch("https://ai-99s8.onrender.com/chat_stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messageHistory }),
      signal: signal
    });

    if (!res.ok || !res.body) {
      throw new Error("服务器无响应");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    const botMessage = document.createElement("div");
    botMessage.className = "message bot";
    botMessage.innerText = "";
    log.appendChild(botMessage);
    const parser = createStreamParser();

    let i = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      parser.feed(chunk);
      assistantText = parser.getResult();

      // fix 表格问题
      assistantText = fixMarkdownTables(assistantText)
      // ✅ 动态选择是否使用 marked
      if (shouldRenderAsHTML(assistantText)) {
        // 直接渲染到界面上
        botMessage.innerHTML = DOMPurify.sanitize(marked.parse(assistantText));
        log.scrollTop = log.scrollHeight;
      } else {
        // ⏳打字机显示
        await typeWriter(botMessage, assistantText.replace(/\n/g, "<br>"));
      }
    }
    messageHistory.push({ role: "assistant", content: assistantText });
    document.getElementById("loading").style.display = "none";
    // 朗读
    // speakText(assistantText);
  } catch (err) {
    if (err.name === "AbortError") {
      console.log("用户中止了输出");
      return;
    }
    console.error("流式错误：", err);

    const botMessage = document.createElement("div");
    botMessage.className = "message bot";
    botMessage.innerText = "哎呀，小初迷路啦，网络好像断开了～";
    log.appendChild(botMessage);
    log.scrollTop = log.scrollHeight;

    document.getElementById("loading").style.display = "none";
    setAvatar("疑惑");
  }
}

function startListening() {
  if (!('webkitSpeechRecognition' in window)) {
    alert("你的浏览器不支持语音识别，请使用Chrome浏览器～");
    return;
  }
  const recognition = new webkitSpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = function() {
    console.log("开始聆听...");
    setAvatar("疑惑");
  };

  recognition.onresult = function(event) {
    const transcript = event.results[0][0].transcript;
    document.getElementById("userInput").value = transcript;
    sendMessage();
  };

  recognition.onerror = function(event) {
    console.error("语音识别错误：", event.error);
    setAvatar("疑惑");
  };

  recognition.onend = function() {
    setAvatar("normal");
  };

  recognition.start();
}

function setAvatar(state) {
  const avatar = document.getElementById("avatar");
  const imgPath = "imgs/" + state + ".png";
  const defaultPath = "imgs/平静.png";

  // 创建一个临时 Image 对象来检测图片是否存在
  const testImg = new Image();
  testImg.onload = function() {
    avatar.src = imgPath; // 图片存在
  };
  testImg.onerror = function() {
    avatar.src = defaultPath; // 图片不存在，使用默认
  };
  testImg.src = imgPath;
}

function blinkAnimation() {
  const avatar = document.getElementById("avatar");
  const frames = ["小羊1.png", "小羊2.png", "小羊3.png", "小羊2.png", "小羊1.png"];
  let i = 0;
  const interval = setInterval(() => {
    avatar.src = frames[i];
    i++;
    if (i >= frames.length) clearInterval(interval);
  }, 120);
}
