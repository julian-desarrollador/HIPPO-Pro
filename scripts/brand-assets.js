const fs = require("fs");
const path = require("path");
const Jimp = require("jimp-compact");

const SOURCE = path.join("assets", "images", "logo.jpeg");
const CARD = [0xf3, 0xf8, 0xfc];
const NAVY = [0x1c, 0x51, 0x7d];

function inkAt(data, width, x, y) {
  const index = (y * width + x) * 4;
  return data[index] < 240 || data[index + 1] < 240 || data[index + 2] < 240;
}

function bounds(image, yStart, yEnd) {
  const { width, height, data } = image.bitmap;
  const bottom = Math.min(yEnd, height - 1);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = yStart; y <= bottom; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!inkAt(data, width, x, y)) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function fit(crop, canvasSize, margin) {
  const inner = canvasSize - margin * 2;
  const scale = Math.min(inner / crop.bitmap.width, inner / crop.bitmap.height);
  const width = Math.round(crop.bitmap.width * scale);
  const height = Math.round(crop.bitmap.height * scale);
  crop.resize(width, height);
  const canvas = new Jimp(canvasSize, canvasSize, 0xffffffff);
  canvas.composite(crop, Math.round((canvasSize - width) / 2), Math.round((canvasSize - height) / 2));
  return canvas;
}

function knockWhite(image, background) {
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function scan(_x, _y, index) {
    const data = this.bitmap.data;
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const alpha = Math.max(255 - red, 255 - green, 255 - blue) / 255;
    if (alpha < 0.02) {
      data[index] = background[0];
      data[index + 1] = background[1];
      data[index + 2] = background[2];
      data[index + 3] = 255;
      return;
    }
    const mix = (channel, paper) => Math.round(Math.min(255, Math.max(0, (channel - 255 * (1 - alpha)) / alpha)) * alpha + paper * (1 - alpha));
    data[index] = mix(red, background[0]);
    data[index + 1] = mix(green, background[1]);
    data[index + 2] = mix(blue, background[2]);
    data[index + 3] = 255;
  });
}

function channel(value) {
  const scaled = value / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function contrast(color) {
  const paint = 0.2126 * channel(color[0]) + 0.7152 * channel(color[1]) + 0.0722 * channel(color[2]);
  const navy = 0.2126 * channel(NAVY[0]) + 0.7152 * channel(NAVY[1]) + 0.0722 * channel(NAVY[2]);
  const [high, low] = paint > navy ? [paint, navy] : [navy, paint];
  return (high + 0.05) / (low + 0.05);
}

function brandGreen() {
  const hue = 111 / 360;
  const saturation = 0.42;
  let lightness = 0.36;
  let color = [72, 120, 64];
  while (lightness < 0.8 && contrast(color) < 3.15) {
    lightness += 0.005;
    color = hslToRgb(hue, saturation, lightness);
  }
  return color;
}

function hslToRgb(hue, saturation, lightness) {
  const hueToChannel = (offset) => {
    const wrapped = (offset + hue) % 1;
    const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;
    if (wrapped < 1 / 6) {
      return p + (q - p) * 6 * wrapped;
    }
    if (wrapped < 1 / 2) {
      return q;
    }
    if (wrapped < 2 / 3) {
      return p + (q - p) * (2 / 3 - wrapped) * 6;
    }
    return p;
  };
  return [4, 0, 8].map((shift) => Math.round(hueToChannel(shift / 12) * 255));
}

async function main() {
  const image = await Jimp.read(SOURCE);
  const symbolBox = bounds(image, 0, 530);
  const fullBox = bounds(image, 0, image.bitmap.height - 1);
  const symbol = image.clone().crop(symbolBox.x, symbolBox.y, symbolBox.w, symbolBox.h);
  const full = image.clone().crop(fullBox.x, fullBox.y, fullBox.w, fullBox.h);

  fs.mkdirSync("public", { recursive: true });
  await fit(symbol.clone(), 512, 28).writeAsync(path.join("assets", "images", "brand-mark.png"));
  await fit(symbol.clone(), 180, 12).writeAsync(path.join("public", "apple-touch-icon.png"));

  const preview = new Jimp(1200, 630, 0xffffffff);
  const previewScale = Math.min(1104 / full.bitmap.width, 534 / full.bitmap.height);
  const previewWidth = Math.round(full.bitmap.width * previewScale);
  const previewHeight = Math.round(full.bitmap.height * previewScale);
  const fitted = full.clone().resize(previewWidth, previewHeight);
  preview.composite(fitted, Math.round((1200 - previewWidth) / 2), Math.round((630 - previewHeight) / 2));
  await preview.writeAsync(path.join("public", "og.png"));

  const card = full.clone();
  knockWhite(card, CARD);
  const padded = new Jimp(card.bitmap.width + 32, card.bitmap.height + 32, Jimp.rgbaToInt(...CARD, 255));
  padded.composite(card, 16, 16);
  await padded.writeAsync(path.join("assets", "images", "logo-card.png"));

  const green = brandGreen();
  const hex = green.map((part) => part.toString(16).padStart(2, "0")).join("");
  console.log(`symbol ${symbolBox.w}x${symbolBox.h} at ${symbolBox.x},${symbolBox.y}`);
  console.log(`brand #${hex} contrast ${contrast(green).toFixed(2)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
