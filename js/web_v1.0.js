let lastUserText = "";
let nightMode = false;
let selectedVoice = null;
let controller = null;
let currentAvatar = null;
let messageHistory = [
  { role: "system", content: "你是一个Q萌可爱的小初AI终端" }
];
// 配置markdown解析的选项
marked.setOptions({
  gfm: true,
  breaks: true
});

function setAvatar(state) {
  if (currentAvatar === state) return; // 避免重复加载
  currentAvatar = state;

  const avatar = document.getElementById("avatar");
  const imgPath = "imgs/" + state + ".png";
  const defaultPath = "imgs/平静.png";

  const testImg = new Image();
  testImg.onload = () => { avatar.src = imgPath; };
  testImg.onerror = () => { avatar.src = defaultPath; };
  testImg.src = imgPath;
}

function stopStreaming() {
  if (controller) {
    controller.abort();  // 终止请求
    controller = null;
    document.getElementById("loading").style.display = "none";
    setAvatar("平静");
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
    let inBracket = false; // 是否在读取 []
    let currentEmo = "";   // 当前正在读取的情绪
    let emoMap = {};       // 存放 char 下标 -> currentEmo
    let index = 0;

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
                        // 记录下标和情绪，即当前情绪插入位置
                        emoMap[index] = currentEmo;
                        console.log(emoMap)
                        inBracket = false;
                        currentEmo = "";
                    } else {
                        currentEmo += char;
                    }
                    continue;
                }
                // 普通文本直接加进 content
                content += char;
                if (char === '\n') {
                    index += 4;
                } else {
                    index += 1;
                }
            }
            return content;
        },
        getResult() {
            return content;
        },
        getEmoMap() {
            return emoMap;
        }
    };
}

function fixMarkdownTables(text) {
    // 在表格后添加明确的换行分隔符
    const lines = text.split('\n');
    let inTable = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
            inTable = true;
        } else if (inTable && lines[i].trim() === '') {
            // 空行结束表格
            inTable = false;
        } else if (inTable && !lines[i].trim().startsWith('|')) {
            // 非表格行，在上一个表格行后添加换行
            lines[i-1] = lines[i-1] + '\n';
            inTable = false;
        }
    }
    // 如果最后还在表格中，确保有换行
    if (inTable && lines.length > 0) {
        lines[lines.length - 1] = lines[lines.length - 1] + '\n';
    }
    return lines.join('\n');
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

async function typeWriter(element, emoMap, htmlString, speed = 100) {
  let i = element.innerHTML.length;
  while (i < htmlString.length) {
    // 情绪变换
    if (emoMap.hasOwnProperty(i)) {
        setAvatar(emoMap[i]);
    }
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
      emoMap = parser.getEmoMap()

      // fix 表格问题
      assistantText = fixMarkdownTables(assistantText)
      // ✅ 动态选择是否使用 marked
      if (shouldRenderAsHTML(assistantText)) {
        // 直接渲染到界面上
        botMessage.innerHTML = DOMPurify.sanitize(marked.parse(assistantText));
        log.scrollTop = log.scrollHeight;
      } else {
        // ⏳打字机显示
        await typeWriter(botMessage, emoMap, assistantText.replace(/\n/g, "<br>"));
      }
    }
    messageHistory.push({ role: "assistant", content: assistantText });
    document.getElementById("loading").style.display = "none";

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
    setAvatar("困惑");
  }
}

