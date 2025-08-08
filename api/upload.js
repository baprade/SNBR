import { put, list, del } from "@vercel/blob";
import { buffer } from "micro";

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", async () => {
      const bodyBuffer = Buffer.concat(chunks);
      const boundary = req.headers["content-type"].split("boundary=")[1];
      const parts = bodyBuffer.toString().split(`--${boundary}`);

      // Parse form fields
      let name = "", description = "", price = "", imageBuffer = null, imageName = "";

      for (let part of parts) {
        if (part.includes("Content-Disposition")) {
          if (part.includes('name="name"')) name = part.split("\r\n\r\n")[1]?.trim();
          if (part.includes('name="description"')) description = part.split("\r\n\r\n")[1]?.trim();
          if (part.includes('name="price"')) price = part.split("\r\n\r\n")[1]?.trim();

          if (part.includes('name="image"')) {
            const fileStart = part.indexOf("\r\n\r\n") + 4;
            const fileContent = part.substring(fileStart, part.lastIndexOf("\r\n"));
            imageBuffer = Buffer.from(fileContent, "binary");
            imageName = `${Date.now()}.jpg`;
          }
        }
      }

      // Upload gambar ke Blob
      const blob = await put(imageName, imageBuffer, { access: "public" });

      // Ambil products.json lama
      let products = [];
      try {
        const productList = await list();
        const jsonFile = productList.blobs.find(b => b.pathname === "products.json");
        if (jsonFile) {
          const resJson = await fetch(jsonFile.url);
          products = await resJson.json();
        }
      } catch {}

      // Tambah produk baru
      products.push({
        name,
        description,
        price,
        image: blob.url
      });

      // Simpan ulang products.json
      await put("products.json", JSON.stringify(products, null, 2), { access: "public" });

      res.status(200).json({ message: "Produk berhasil diupload", product: { name, price, image: blob.url } });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
