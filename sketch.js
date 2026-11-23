
const W = 1280;
const H = 720;

// 时钟位于画面高度的三分之一
const CLOCK_Y = H / 3.5;
const CLOCK_X = W / 3;

// 海洋从秒数字下方开始
const SOURCE_Y = CLOCK_Y + 188;

// 秒数字所在区域的中心
const SOURCE_X = 576;

let pg;
let seaLayer;

let timeString = "";

let clockGroups = [];
let falling = [];
let fallingDigits = [];
let ocean = [];
let ripples = [];

let oceanTime = 0;
let frameT = 0;

const SLOT = 72;
const DIGIT_SIZE = 104;
const GLYPH_STEP = 3;

const MAX_FALLING = 1800;
const MAX_RIPPLES = 120;

// 海洋粒子循环容量
const OCEAN_CAPACITY = W * 9;

// =====================================
// SETUP
// =====================================

function setup() {
  pixelDensity(1);

  const renderer = createCanvas(W, H);

  // 手机全屏显示
  renderer.elt.style.width = "100vw";
  renderer.elt.style.height = "auto";
  renderer.elt.style.maxHeight = "100dvh";
  renderer.elt.style.objectFit = "contain";
  renderer.elt.style.display = "block";
  renderer.elt.style.position = "fixed";
  renderer.elt.style.top = "50%";
  renderer.elt.style.left = "50%";
  renderer.elt.style.transform = "translate(-50%, -50%)";
  renderer.elt.style.margin = "0";

  pg = createGraphics(100, 130);
  pg.pixelDensity(1);

  seaLayer = createGraphics(W, H);
  seaLayer.pixelDensity(1);
  seaLayer.background(0);

  timeString = getTime();

  initializeClock();
}

// =====================================
// MAIN DRAW
// =====================================

function draw() {
  frameT += 0.008;

  drawBackground();

  checkTime();

  updateFalling();
  updateOcean();
  updateRipples();

  drawOcean();
  drawRipples();
  drawFalling();
  drawClock();
  drawSourceGlow();
  drawAtmosphere();
}

// =====================================
// TIME
// =====================================

function getTime() {
  return nf(hour(), 2) + ":" +
         nf(minute(), 2) + ":" +
         nf(second(), 2);
}

function checkTime() {
  let now = getTime();

  if (now === timeString) return;

  let old = timeString;

  for (let i = 0; i < 8; i++) {
    if (old[i] === now[i]) continue;
    if (old[i] === ":") continue;

    releaseDigit(i);
    clockGroups[i] = createDigit(now[i], i);

    // 秒数字变化时，在其下方产生涟漪
    if (i === 6 || i === 7) {
      let x = getSlotX(i) + SLOT / 2;

      addRipple(x, SOURCE_Y, 1);
    }
  }

  timeString = now;
}

// =====================================
// CLOCK POSITION
// =====================================

function getSlotX(i) {
  let total = 8 * SLOT;
  let start = (W - total) / 2 + 30;

  return start + i * SLOT;
}

function initializeClock() {
  clockGroups = [];

  for (let i = 0; i < 8; i++) {
    clockGroups.push(
      createDigit(timeString[i], i)
    );
  }
}

// =====================================
// PARTICLE FONT
// =====================================

function createDigit(char, index) {
  if (char === undefined || char === null) {
    char = "0";
  }

  pg.clear();

  pg.textAlign(CENTER, CENTER);
  pg.textFont("monospace");
  pg.textStyle(BOLD);
  pg.textSize(DIGIT_SIZE);
  pg.noStroke();
  pg.fill(255);

  pg.text(String(char), 50, 65);
  pg.loadPixels();

  let points = [];

  for (let y = 0; y < 130; y += GLYPH_STEP) {
    for (let x = 0; x < 100; x += GLYPH_STEP) {
      let idx = 4 * (y * 100 + x);

      if (pg.pixels[idx] > 100) {
        points.push({
          x: getSlotX(index) + x - 50,
          y: CLOCK_Y + y - 65,
          size: random(0.8, 1.3),
          alpha: random(210, 255)
        });
      }
    }
  }

  return {
    char: String(char),
    points
  };
}

// =====================================
// DRAW CLOCK
// =====================================

function drawClock() {
  noStroke();

  for (let i = 0; i < 8; i++) {
    let group = clockGroups[i];

    if (!group) continue;

    for (let p of group.points) {
      fill(245, 250, 255, p.alpha);
      circle(p.x, p.y, p.size);
    }
  }
}

// =====================================
// FALLING DIGITS
// =====================================

// 时间变化时，保存完整数字形状
function releaseDigit(index) {
  let group = clockGroups[index];

  if (!group) return;

  fallingDigits.push({
    points: group.points,
    offset: 0,
    speed: 20
  });
}

// =====================================
// UPDATE FALLING
// =====================================

function updateFalling() {

  // 完整数字整体下落
  for (let i = fallingDigits.length - 1; i >= 0; i--) {

    let d = fallingDigits[i];

    // 保持数字原有形状
    d.offset += d.speed;

    // 计算数字最下方的位置
    let bottomY = Math.max(
      ...d.points.map(p => p.y)
    );

    // 整个数字到达海面后才开始消散
    if (bottomY + d.offset >= SOURCE_Y) {

      for (let p of d.points) {

        if (falling.length >= MAX_FALLING) {
          falling.shift();
        }

        falling.push({
          x: p.x,
          y: p.y + d.offset,

          vx: random(-1.2, 1.2),
          vy: random(-0.5, 1.2),

          size: random(0.8, 1.5),
          alpha: random(210, 255)
        });
      }

      // 数字抵达海面，产生涟漪
      let rippleX = d.points.reduce(
        (sum, p) => sum + p.x,
        0
      ) / d.points.length;

      addRipple(rippleX, SOURCE_Y, 1);

      fallingDigits.splice(i, 1);
    }
  }

  // 海面颗粒扩散、消散
  for (let i = falling.length - 1; i >= 0; i--) {

    let p = falling[i];

    p.x += p.vx;
    p.y += p.vy;

    // 逐渐减速
    p.vx *= 0.985;
    p.vy *= 0.985;

    // 逐渐缩小
    p.size *= 0.99;

    // 逐渐消失
    p.alpha -= 3;

    if (p.alpha <= 0 || p.size < 0.1) {
      falling.splice(i, 1);
    }
  }
}

// =====================================
// DRAW FALLING
// =====================================

function drawFalling() {
  noStroke();

  // 绘制保持完整形状的下落数字
  for (let d of fallingDigits) {

    for (let p of d.points) {

      fill(245, 250, 255, p.alpha);

      circle(
        p.x,
        p.y + d.offset,
        p.size
      );
    }
  }

  // 绘制抵达海面后消散的颗粒
  for (let p of falling) {

    fill(245, 250, 255, p.alpha);

    circle(
      p.x,
      p.y,
      p.size
    );
  }
}

// =====================================
// OCEAN PARTICLES
// Based on original staircase waterway
// =====================================

function updateOcean() {

  // 每帧生成 36 个粒子，增加颗粒密度
  let particleCount = 36;

  while (particleCount > 0) {
    particleCount--;

    // 粒子索引循环替换
    let index = oceanTime % (W * 9);

    // 按照参考算法横向分布
    let px = random(W);

    // 从画布顶部生成
    ocean[index] = {
      x: px,
      y: 400,
      g: 0,
      s: 3
    };

    oceanTime++;
  }

  // 原始 Noise 粒子运动算法
  for (let idx = 0; idx < ocean.length; idx++) {

    let p = ocean[idx];

    if (!p) continue;

    // 粒子逐渐缩小
    p.s = p.s * 0.997;

    // Perlin Noise
    let Noise = noise(
      p.x / W,
      p.y / 9,
      oceanTime / W
    );

    // 横向运动
    if (Noise > 0.4) {

      p.x += 0;

    } else {

      if (Noise % 0.1 > 0.05) {
        p.x += 1;
      } else {
        p.x += -1;
      }

      // 重置重力
      p.g = 0;
    }

    // 纵向运动
    if (Noise > 0.4) {

      p.g += 0.5;
      p.y += p.g;

    } else {

      p.y += 0.5;
    }
  }
}

// =====================================
// DRAW OCEAN
// 保留原来的蓝色粒子颜色和拖尾
// =====================================

function drawOcean() {

  // 黑色半透明覆盖，保留上一帧轨迹
  seaLayer.background(0, 9);

  // 原来的模糊效果
  seaLayer.filter(BLUR);

  // 保留原来的蓝色 Noise 粒子
  for (let p of ocean) {

    if (!p) continue;

    let depth = constrain(
      (p.y - SOURCE_Y) / (H - SOURCE_Y),
      0,
      1
    );

    seaLayer.stroke(
      75 + depth * 30,
      155 + depth * 45,
      255,
      210
    );

    seaLayer.strokeWeight(p.s);
    seaLayer.point(p.x, p.y);
  }

  image(seaLayer, 0, 0);
}

// =====================================
// RIPPLE
// =====================================

function addRipple(x, y, initialRadius = 1) {

  ripples.push({
    x: x,
    y: y,
    radius: initialRadius,
    alpha: 150,
    strength: 1
  });

  // 限制涟漪数量，避免长期运行造成性能下降
  if (ripples.length > MAX_RIPPLES) {
    ripples.shift();
  }
}

function updateRipples() {
  for (let i = ripples.length - 1; i >= 0; i--) {
    let r = ripples[i];

    // 向外扩散
    r.radius += 0.8;

    // 逐渐淡出
    r.alpha *= 0.94;

    // 动画结束后移除
    if (r.alpha < 2) {
      ripples.splice(i, 1);
    }
  }
}

function drawRipples() {
  noFill();

  for (let r of ripples) {
    stroke(160, 215, 255, r.alpha);
    strokeWeight(0.8);

    ellipse(
      r.x-10,
      r.y,
      r.radius * 4,
      r.radius * 0.8
    );
  }
}

// =====================================
// SOURCE GLOW
// =====================================

function drawSourceGlow() {
  noStroke();

  // 秒数字下方的柔和蓝色光源
  for (let i = 0; i < 5; i++) {
    fill(80, 165, 255, 5);

    ellipse(
      SOURCE_X,
      SOURCE_Y,
      25 + i * 28,
      12 + i * 12
    );
  }

  // 中心光点
  fill(180, 225, 255, 65);

  circle(
    SOURCE_X,
    SOURCE_Y,
    3
  );
}

// =====================================
// BACKGROUND
// =====================================

function drawBackground() {
  let ctx = drawingContext;

  let gradient = ctx.createLinearGradient(
    0, 0, 0, H
  );

  gradient.addColorStop(0, "#071a3b");
  gradient.addColorStop(0.45, "#0b3268");
  gradient.addColorStop(0.65, "#10457e");
  gradient.addColorStop(1, "#03152f");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
}

// =====================================
// ATMOSPHERE
// =====================================

function drawAtmosphere() {
  noStroke();

  fill(195, 220, 255, 125);

  textAlign(CENTER, CENTER);
  textFont("monospace");
  textSize(11);

  fill(145, 185, 225, 80);
  textSize(9);
}
