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
