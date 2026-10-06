import { dayPhotoProblem, type DayPhotoFile } from "../outbound/day-photos";

const photoLongestSide = 1600;
const photoJpegQuality = 0.82;

function jpegName(name: string): string {
  const stem = name.replace(/\.[^.]+$/, "");
  return `${stem || "foto"}.jpg`;
}

/** Shrinks a chosen photo to a jpeg the dialog can show. Returns a Spanish problem when it cannot. */
async function shrinkPhoto(file: File): Promise<DayPhotoFile | string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return "No se pudo preparar la imagen.";
  }
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > photoLongestSide ? photoLongestSide / longest : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return "No se pudo preparar la imagen.";
  }
  context.fillStyle = "white";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", photoJpegQuality);
  });
  if (!blob) {
    return "No se pudo preparar la imagen.";
  }
  const name = jpegName(file.name);
  const problem = dayPhotoProblem({ size: blob.size, contentType: "image/jpeg", name });
  if (problem) {
    return problem;
  }
  return { name, bytes: await blob.arrayBuffer(), contentType: "image/jpeg" };
}

/** Opens the file picker and returns the shrunk jpeg, a Spanish problem, or null when cancelled. */
export function chooseImageFile(): Promise<DayPhotoFile | string | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    let settled = false;
    const finish = (value: DayPhotoFile | string | null) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      if (file.size <= 0) {
        finish("La imagen está vacía.");
        return;
      }
      const typeProblem = dayPhotoProblem({ size: 1, contentType: file.type, name: file.name });
      if (typeProblem) {
        finish(typeProblem);
        return;
      }
      settled = true;
      void shrinkPhoto(file).then(resolve);
    };
    window.addEventListener(
      "focus",
      () => {
        setTimeout(() => finish(null), 400);
      },
      { once: true },
    );
    input.click();
  });
}
